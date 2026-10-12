import { authorizeAct, commandBasis, standingOrders } from '../psyche/api.ts';
/**
 * Provisions cross-module API. OWNER: module:provisions.
 */

import { isAsleep, reservePreparation } from '../activity/api.ts';
import type { ContentBundle } from '../content.ts';
import { term } from '../explain.ts';
import type { ActorId, HouseholdId, ItemId, PlaceId } from '../ids.ts';
import { rowsOf } from '../ids.ts';
import {
  atPlace,
  carriedBy,
  consumeSupply,
  type InventoryIndex,
  inventoryIndex,
  moveStack,
  rootOf,
  stacksAt,
  stacksDeep,
  supplyUnits,
} from '../items/api.ts';
import { fitsInContainer } from '../items/containers.ts';
import { canAct, drink, needValue } from '../needs/api.ts';
import type { SimContext } from '../sim/context.ts';
import { inheritMoneyLedger } from '../social/api.ts';
import type { Urge, UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { larderKcal } from './economy.ts';
import { accessibleStack, awaitingMeal, holderOfActor, holderStacks, mealExplain, serveMeal } from './meals.ts';
import { serviceAt, storeOpen } from './services.ts';

/** Money outside the store (loans, repayments): see economy.ts. */
export { cashOf, purchase, synchronizeStoreTabs, transferCash } from './economy.ts';

import { yearsBetween } from '../time.ts';
import {
  dailyKcal,
  drawWater,
  dueMeal,
  foodServings,
  hungry,
  type Kitchen,
  kitchenOf,
  membersOf,
  recipesFor,
  waterAvailable,
} from './meals.ts';
import { planReadiness } from './planner.ts';
import { agePct, SHOPPING, shoppingDays } from './rules.ts';

/** Outdoor air temperature, °F (the weather hook; needs reads exposure from here). */
export { airTempF, isRaining, storageTempF, tempBand } from './temperature.ts';

/**
 * P8 legibility: "days of food at current rations, what spoils first, weight/bulk
 * tradeoffs". Computed for an actor's carried kit or a household's pantry.
 */
export interface Readiness {
  /** Food on hand, kcal (usable given available prep). */
  kcalOnHand: number;
  /** Daily need at current labor and rations, kcal. */
  kcalPerDay: number;
  /** Days of food at current rations, tenths. */
  daysOfFoodTenths: number;
  /** Days of fuel for cooking, tenths (null if none needed/known). */
  daysOfFuelTenths: number | null;
  /** Stored water horizon including drinking and preparation (null for a replenished source). */
  daysOfWaterTenths?: number | null;
  /** The stack that will spoil soonest and when (days, tenths). */
  spoilsFirst: { defId: string; name: string; inDaysTenths: number } | null;
  /** Foods you have but cannot prepare with what's here ("beans: no kettle"). */
  unpreparable: Array<{ defId: string; name: string; missing: string[] }>;
  /** Plain-language warnings: "No fresh food: scurvy in ~5 weeks". */
  warnings: string[];
}

export type ReadinessHolder = { actorId: ActorId } | { householdId: HouseholdId };

/** Projects the same meals, preparation and hourly storage rules used by the simulation. */
export function readinessOf(
  world: World,
  content: ContentBundle,
  holder: ReadinessHolder,
  now: number,
  horizonDays?: number,
): Readiness {
  return planReadiness(world, content, holder, now, horizonDays);
}

/** Price in cents of one unit at a store (03 §8.1 markup; opinion-adjusted later). */
export function priceAt(world: World, content: ContentBundle, placeId: PlaceId, defId: string): number | null {
  const store = world.provisions.stores[placeId];
  const def = content.items[defId];
  if (!store || !def) return null;
  return Math.round((def.value_cents * store.markupPct) / 100);
}

/** Appetite and a household shopping errand enter ordinary psyche arbitration. */
export function proposeProvisionUrges(world: World, ctx: SimContext, actorId: ActorId): UrgeProposal[] {
  const actor = world.actors[actorId];
  if (!actor?.alive || !canAct(world, actorId)) return [];
  const out: UrgeProposal[] = [];
  const thirst = needValue(world, actorId, 'thirst');
  if (thirst < 600 && drinkingWater(world, ctx.content, actorId) > 0 && ctx.content.activities.fetch_water) {
    const intensity = Math.min(1000, 400 + (600 - thirst) * 2);
    out.push({
      urge: { kind: 'activity', activityId: 'fetch_water', placeId: actor.placeId },
      voice: 'id',
      intensity,
      label: 'Drink accessible water',
      source: 'provisions',
      drive: 'hunger',
      reasons: [term('need', 'Thirst deficit', intensity)],
    });
  }
  const foodUrge = hungry(world, actorId) ? foodSeekingUrge(world, ctx, actorId) : null;
  if (
    foodUrge &&
    hungry(world, actorId) &&
    ctx.content.activities.take_meal &&
    world.provisions.nutrition[actorId]?.lastMealAt !== ctx.now
  ) {
    out.push({
      urge: foodUrge,
      voice: 'id',
      intensity: 650,
      label:
        foodUrge.kind === 'activity' && ctx.content.activities[foodUrge.activityId]?.tags.includes('commerce')
          ? 'Hungry: buy food for the empty pantry'
          : 'Hungry: eat from the larder or pack',
      source: 'provisions',
      drive: 'hunger',
      reasons: [term('need', 'Hunger', 650)],
    });
  }
  const household = world.households[actor.householdId];
  // Store hours: the head of the household goes when the larder runs low; when it is nearly
  // empty any grown member will go. The duty presses harder the emptier the shelves.
  const adult = yearsBetween(actor.born, ctx.now) >= SHOPPING.minAge;
  if (
    world.provisions.settings.npcBuying &&
    household &&
    adult &&
    ctx.cal.hour >= SHOPPING.openHour &&
    ctx.cal.hour < SHOPPING.closeHour &&
    !ctx.cal.isSabbath
  ) {
    const daily = membersOf(world, { householdId: household.id }).reduce(
      (n, id) => n + dailyKcal(world, ctx.content, id, ctx.now),
      0,
    );
    const larder = larderKcal(world, ctx, household.id);
    const urgent = larder < daily * SHOPPING.urgentDays;
    if (
      (household.headId === actorId || !canAct(world, household.headId) || urgent) &&
      larder < daily * shoppingDays(ctx.cal.month).trigger
    ) {
      const intensity = urgent ? 950 : 800;
      const store = bestStore(world, ctx);
      const activity = Object.values(ctx.content.activities)
        .filter((a) => a.tags.includes('commerce'))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
      if (store && activity)
        out.push({
          urge: { kind: 'activity', activityId: activity.id, placeId: store.placeId },
          voice: 'superego',
          intensity,
          label: urgent ? 'The pantry is nearly bare: go to the store' : 'The pantry is running low: buy provisions',
          source: 'provisions',
          norm: 'duty',
          reasons: [term('food', urgent ? 'Nearly bare shelves' : 'Household provision duty', intensity)],
        });
    }
  }
  return out;
}

/** The store with the most food on its shelves (kcal), ties to the lowest place id: where a household goes to buy. */
export function bestStore(world: World, ctx: Pick<SimContext, 'content'>) {
  let best: { store: (typeof world.provisions.stores)[number]; kcal: number } | undefined;
  for (const store of rowsOf(world.provisions.stores)) {
    let kcal = 0;
    for (const { stack } of stacksDeep(world, atPlace(store.placeId)))
      kcal += (ctx.content.items[stack.defId]?.food?.kcal ?? 0) * stack.qty;
    if (!best || kcal > best.kcal) best = { store, kcal };
  }
  return best?.store;
}

// Shared kernels exposed for command validation and telemetry; hosts must not duplicate prep rules.
export { accessibleStack, dailyKcal, foodServings, holderOfActor, recipesFor } from './meals.ts';

/** Stores buy intact goods at base value, capped by the current retail price. */
export function saleQuote(world: World, content: ContentBundle, placeId: PlaceId, itemId: ItemId): number | null {
  const stack = world.items.stacks[itemId];
  if (
    !stack ||
    stack.partial ||
    stack.foodPartialPm ||
    stack.waterMl ||
    stack.condition < 100 ||
    stack.spoilage >= 1000 ||
    stacksAt(world, { kind: 'container', itemId }).length
  )
    return null;
  const retail = priceAt(world, content, placeId, stack.defId);
  if (retail === null) return null;
  const lowestRetail = Math.min(
    ...rowsOf(world.provisions.stores).map((store) => priceAt(world, content, store.placeId, stack.defId) ?? retail),
  );
  if (lowestRetail <= 0) return null;
  const pct = content.domesticRules?.daily?.buyback_pct ?? 65;
  return Math.max(
    0,
    Math.min(retail - 1, lowestRetail - 1, Math.floor(((content.items[stack.defId]?.value_cents ?? 0) * pct) / 100)),
  );
}
export function sell(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  placeId: PlaceId,
  itemId: ItemId,
  qty: number,
): boolean {
  if (!authorizeAct(world, actorId, { kind: 'sell', itemId }, commandBasis(ctx, actorId, ['provisions.sell'])).ok)
    return false;
  const actor = world.actors[actorId],
    store = world.provisions.stores[placeId],
    stack = world.items.stacks[itemId];
  if (!storeOpen(world, ctx.content, placeId, ctx.now)) return false;
  const price = saleQuote(world, ctx.content, placeId, itemId);
  if (
    !actor?.alive ||
    actor.placeId !== placeId ||
    !store ||
    !stack ||
    price === null ||
    !Number.isSafeInteger(qty) ||
    qty <= 0 ||
    qty > stack.qty
  )
    return false;
  const root = rootOf(world, stack);
  if (root.kind !== 'actor' || root.actorId !== actorId) return false;
  const owner = store.ownerHouseholdId === null ? undefined : world.provisions.households[store.ownerHouseholdId];
  const cost = price * qty;
  if ((owner?.cashCents ?? store.tillCents) < cost) return false;
  moveStack(world, ctx, itemId, qty, atPlace(placeId));
  if (owner) owner.cashCents -= cost;
  else store.tillCents -= cost;
  world.provisions.purses[actorId] = (world.provisions.purses[actorId] ?? 0) + cost;
  ctx.emit({
    kind: 'provisions.sale',
    data: { sellerId: actorId, placeId, defId: stack.defId, qty, priceCents: cost },
    roles: [{ actor: actorId, role: 'agent' }],
    visibility: 'private',
    explain: {
      kind: 'formula',
      label: 'Store buys intact goods',
      subjects: [actorId],
      knowledge: 'participants',
      terms: [
        term('price', 'Unit cents (used-goods spread, below county retail)', price),
        term('item', 'Quantity', qty),
      ],
      total: cost,
      outcome: 'sold',
    },
  });
  return true;
}

/** Water sources and carried vessels share the physical preparation ledger. */
function homeWaterHolder(world: World, actorId: ActorId): { householdId: HouseholdId } | null {
  const actor = world.actors[actorId];
  return actor && world.households[actor.householdId]?.homePlaceId === actor.placeId
    ? { householdId: actor.householdId }
    : null;
}
export function drinkingWater(world: World, content: ContentBundle, actorId: ActorId, index?: InventoryIndex): number {
  const home = homeWaterHolder(world, actorId);
  return (
    waterAvailable(world, content, { actorId }, index) +
    (home ? (world.provisions.households[home.householdId]?.waterMl ?? 0) : 0)
  );
}
export function drinkWater(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  ml: number,
  index?: InventoryIndex,
): boolean {
  if (
    !canAct(world, actorId) ||
    !Number.isSafeInteger(ml) ||
    ml <= 0 ||
    ml > drinkingWater(world, ctx.content, actorId, index)
  )
    return false;
  const carried = Math.min(ml, waterAvailable(world, ctx.content, { actorId }, index));
  drawWater(world, ctx.content, { actorId }, carried, index);
  const home = homeWaterHolder(world, actorId);
  if (home && carried < ml) drawWater(world, ctx.content, home, ml - carried, index);
  drink(world, ctx, actorId, ml, { label: 'Drink accessible water' });
  return true;
}
export function refillQuote(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  itemId: ItemId,
  ml?: number,
): number | null {
  const actor = world.actors[actorId],
    stack = world.items.stacks[itemId];
  if (!actor?.alive || !stack || !accessibleStack(world, actorId, stack)) return null;
  const capacity = content.items[stack.defId]?.container?.liquid_ml ?? 0;
  const wanted = ml ?? capacity - (stack.waterMl ?? 0);
  const home = homeWaterHolder(world, actorId),
    source = world.places[actor.placeId]?.tags.includes('water');
  if (
    !Number.isSafeInteger(wanted) ||
    wanted <= 0 ||
    wanted + stack.waterMl > capacity ||
    (!source && (!home || waterAvailable(world, content, home) < wanted))
  )
    return null;
  const parent = stack.location.kind === 'container' ? world.items.stacks[stack.location.itemId] : undefined;
  if (parent) {
    const filled = { ...stack, waterMl: stack.waterMl + wanted };
    const projected: World = {
      ...world,
      items: { ...world.items, stacks: { ...world.items.stacks, [itemId]: filled } },
    };
    if (!fitsInContainer(projected, content, filled, filled.qty, parent).ok) return null;
  }
  return wanted;
}
export function refillWater(world: World, ctx: SimContext, actorId: ActorId, itemId: ItemId, ml?: number): boolean {
  const wanted = refillQuote(world, ctx.content, actorId, itemId, ml),
    actor = world.actors[actorId],
    stack = world.items.stacks[itemId];
  if (wanted === null || !actor || !stack) return false;
  const home = homeWaterHolder(world, actorId),
    source = world.places[actor.placeId]?.tags.includes('water');
  const capacity = ctx.content.items[stack.defId]?.container?.liquid_ml ?? 0;
  const before = stack.waterMl;
  stack.waterMl += wanted;
  if (!source && home) drawWater(world, ctx.content, home, wanted);
  ctx.emit({
    kind: 'provisions.refilled',
    data: { actorId, itemId, ml: wanted },
    roles: [{ actor: actorId, role: 'agent' }],
    visibility: 'private',
    explain: mealExplain('Refill water vessel', [actorId], stack.waterMl, [
      term('water', 'Previous stored ml', before),
      term('water', 'Water drawn ml', wanted),
      term('item', 'Vessel capacity ml', capacity),
    ]),
  });
  return true;
}
/** Ordinary sipping and filling at an accessible source, also used in readiness projections. */
export function waterHour(world: World, ctx: SimContext): void {
  const index = inventoryIndex(world);
  for (const actor of rowsOf(world.actors)) {
    if (
      !actor.alive ||
      isAsleep(world, ctx, actor.id) ||
      (!authorizeAct(world, actor.id, { kind: 'consequential' }, { kind: 'own' }).ok &&
        !standingOrders(world, actor.id).drink)
    )
      continue;
    const value = needValue(world, actor.id, 'thirst');
    if (value < 600) {
      const def = ctx.content.needs.thirst;
      const ml = Math.min(
        drinkingWater(world, ctx.content, actor.id, index),
        Math.max(0, Math.ceil((900 - value) * (def?.intake?.per_point ?? 2))),
      );
      if (ml > 0) drinkWater(world, ctx, actor.id, ml, index);
    }
    if (world.places[actor.placeId]?.tags.includes('water'))
      for (const { stack } of stacksDeep(world, carriedBy(actor.id), index))
        if ((ctx.content.items[stack.defId]?.container?.liquid_ml ?? 0) > stack.waterMl)
          refillWater(world, ctx, actor.id, stack.id);
  }
}

export { nutritionRestLoss } from './nutrition.ts';
export { admitSleep, boardMeal, serviceAt, storeOpen } from './services.ts';

/** Decision-time inventory/kitchens, scoped to this immutable proposal pass. The next hourly
 * context gets a new index; no memo enters a save or survives inventory mutations into a pass. */
type DecisionContext = SimContext & {
  provisionsDecisionPass?: { index: InventoryIndex; kitchens: Map<string, Kitchen> };
};
function decisionKitchen(world: World, ctx: SimContext, holder: ReadinessHolder): Kitchen {
  const context = ctx as DecisionContext;
  let pass = context.provisionsDecisionPass;
  if (!pass) {
    pass = { index: inventoryIndex(world), kitchens: new Map() };
    context.provisionsDecisionPass = pass;
  }
  const key = 'householdId' in holder ? `h${holder.householdId}` : `a${holder.actorId}`;
  let kitchen = pass.kitchens.get(key);
  if (!kitchen) {
    kitchen = kitchenOf(world, ctx.content, holder, ctx.now, pass.index);
    pass.kitchens.set(key, kitchen);
  }
  return kitchen;
}
/** Hunger seeks available food. An empty pantry cannot trap a funded actor in an endless
 * meal urge: buying staples is the actionable way to eat, under the same market rules. */
export function foodSeekingUrge(world: World, ctx: SimContext, actorId: ActorId): Urge | null {
  const actor = world.actors[actorId];
  if (!actor?.alive) return null;
  const pending = (world.provisions.pendingMeals ?? []).find((m) => m.plates.some((p) => p.id === actorId));
  if (pending)
    return pending.completesAt > ctx.now
      ? null
      : { kind: 'activity', activityId: 'take_meal', placeId: pending.placeId };
  const last = world.provisions.nutrition[actorId]?.lastMealAt;
  let waitForMeal = last !== null && last !== undefined && ctx.now - last < 180;
  const holder = { householdId: actor.householdId };
  if (!dueMeal(world, ctx.content, holder, ctx.cal.hour))
    for (let offset = 1; offset <= 3; offset++)
      if (dueMeal(world, ctx.content, holder, (ctx.cal.hour + offset) % 24)) waitForMeal = true;
  const holders: ReadinessHolder[] = [{ actorId }, { householdId: actor.householdId }];
  for (const holder of holders) {
    const kitchen = decisionKitchen(world, ctx, holder);
    if (
      kitchen.stacks.some(
        (stack) =>
          foodServings(ctx.content, stack) > 0 &&
          (ctx.content.items[stack.defId]?.food?.kcal ?? 0) > 0 &&
          recipesFor(world, ctx.content, holder, stack, 1, false, undefined, undefined, kitchen).some(
            (r) => r.kcal > 0 && r.missing.length === 0,
          ),
      )
    ) {
      if (waitForMeal) return null;
      const placeId = 'householdId' in holder ? world.households[holder.householdId]?.homePlaceId : actor.placeId;
      return { kind: 'activity', activityId: 'take_meal', ...(placeId === undefined ? {} : { placeId }) };
    }
  }
  if (yearsBetween(actor.born, ctx.now) < SHOPPING.minAge) return null;
  const activity = Object.values(ctx.content.activities).find((a) => a.tags.includes('commerce'));
  const store = bestStore(world, ctx);
  if (!activity || !store || !storeOpen(world, ctx.content, store.placeId, ctx.now)) return null;
  return { kind: 'activity', activityId: activity.id, placeId: store.placeId };
}

/** Needs and the planner use the same age factor; a child's ration matches their physiology. */
export function energyAgePct(world: World, actorId: ActorId): number {
  const actor = world.actors[actorId];
  return actor ? agePct(yearsBetween(actor.born, world.time)) : 100;
}

/** Heating and cooking burn the same fire. A paid cooking interval supplies heat before
 * the hearth draws more wood; partially covered hours pay only the uncovered share. */
export function heatingFuel(
  world: World,
  ctx: SimContext,
  placeId: PlaceId,
  loc: import('../items/state.ts').ItemLocation,
  kind: string,
  wanted: number,
  index?: InventoryIndex,
): number | null {
  if (!world.provisions?.fires)
    return supplyUnits(world, ctx.content, loc, kind, index) >= wanted
      ? consumeSupply(world, ctx.content, loc, kind, wanted, index)
      : null;
  const fire = world.provisions.fires[placeId];
  const credit = fire?.lit ? Math.max(0, (fire.until ?? ctx.now + fire.fuelMinutes) - ctx.now) : 0;
  const needed = Math.ceil((wanted * Math.max(0, 60 - credit)) / 60);
  if (supplyUnits(world, ctx.content, loc, kind, index) < needed) return null;
  const paid = consumeSupply(world, ctx.content, loc, kind, needed, index);
  const until = Math.max(fire?.until ?? 0, ctx.now + 60);
  world.provisions.fires[placeId] = { placeId, lit: true, until, fuelMinutes: until - ctx.now };
  return paid;
}

export { countyCash } from './employment.ts';

/** Aid consumes the same real water and meal supplies as ordinary provisioning. */
export function assistIntake(
  world: World,
  ctx: SimContext,
  helper: ActorId,
  patient: ActorId,
  wantedMl: number,
): number {
  if (
    !canAct(world, helper) ||
    !world.actors[patient]?.alive ||
    world.actors[helper]?.placeId !== world.actors[patient]?.placeId
  )
    return 0;
  if (!authorizeAct(world, helper, { kind: 'aid' }, commandBasis(ctx, helper, ['needs.aid'])).ok) return 0;
  // A shared address does not make the patient's empty pantry the helper's pantry.
  const sources = patient === helper ? [patient] : [patient, helper];
  let ml = 0;
  for (const giver of sources) {
    const amount =
      needValue(world, patient, 'thirst') < 800
        ? Math.min(Math.max(0, wantedMl - ml), drinkingWater(world, ctx.content, giver))
        : 0;
    const carried = Math.min(amount, waterAvailable(world, ctx.content, { actorId: giver }));
    drawWater(world, ctx.content, { actorId: giver }, carried);
    const home = homeWaterHolder(world, giver);
    if (home && carried < amount) drawWater(world, ctx.content, home, amount - carried);
    ml += amount;
  }
  if (ml) drink(world, ctx, patient, ml, { label: 'Water given by a helper' });
  for (const meal of world.provisions.pendingMeals ?? []) {
    if (meal.placeId === world.actors[helper]?.placeId && meal.plates.some((p) => p.id === patient)) {
      meal.caregiverId = helper;
      meal.caregiverBasis = commandBasis(ctx, helper, ['needs.aid']);
      reservePreparation(world, ctx, helper, Math.max(60, meal.completesAt - ctx.now + 60));
    }
  }
  if (needValue(world, patient, 'hunger') < 600 && !awaitingMeal(world, patient)) {
    for (const giver of sources) {
      const holder = holderOfActor(world, giver);
      if (!usableCareFood(world, ctx.content, holder)) continue;
      if (serveMeal(world, ctx, holder, [patient], 35, false, undefined, undefined, helper).kcal > 0) break;
    }
  }
  return ml;
}

/** A purse and, when a household has no living residents, its cash pass to the heir. */
export function settleEstate(world: World, ctx: SimContext, deceased: ActorId, heir: ActorId): void {
  const a = world.actors[deceased],
    b = world.actors[heir];
  if (!a || !b?.alive || world.provisions.estates?.some((e) => e.deceasedId === deceased)) return;
  const rule = ctx.content.survival_tuning?.survival?.estate_money ?? 'inherit';
  const claims = inheritMoneyLedger(world, ctx, deceased, heir);
  world.provisions.estates ??= [];
  world.provisions.estates.push({ deceasedId: deceased, representativeId: heir, at: ctx.now, rule, claims });
  let cents = world.provisions.purses[deceased] ?? 0;
  world.provisions.purses[deceased] = 0;
  const old = world.provisions.households[a.householdId],
    next = world.provisions.households[b.householdId];
  if (
    old &&
    a.householdId !== b.householdId &&
    !world.households[a.householdId]?.memberIds.some((id) => world.actors[id]?.alive)
  ) {
    cents += old.cashCents;
    old.cashCents = 0;
    for (const store of rowsOf(world.provisions.stores))
      if (store.ownerHouseholdId === a.householdId) store.ownerHouseholdId = b.householdId;
  }
  if (next) next.cashCents += cents;
  else world.provisions.purses[heir] = (world.provisions.purses[heir] ?? 0) + cents;
}

/** Uses the ordinary recipe kernel, including cookware, water, ignition and fuel. */
function usableCareFood(world: World, content: ContentBundle, holder: ReadinessHolder): boolean {
  const kitchen = kitchenOf(world, content, holder, world.time);
  return holderStacks(world, holder).some(
    (stack) =>
      foodServings(content, stack) > 0 &&
      recipesFor(world, content, holder, stack, 1, false, undefined, undefined, kitchen).some(
        (r) => r.kcal > 0 && r.missing.length === 0,
      ),
  );
}

/** A place to nurse someone: prefer their own stocked home, then the helper's. */
export function careHome(world: World, content: ContentBundle, helper: ActorId, patient: ActorId): PlaceId | undefined {
  const a = world.actors[patient],
    b = world.actors[helper];
  if (!a || !b) return undefined;
  const own = world.households[a.householdId]?.homePlaceId;
  const donor = world.households[b.householdId]?.homePlaceId;
  if (needValue(world, patient, 'thirst') < 200 && (world.provisions.households[a.householdId]?.waterMl ?? 0) < 500) {
    if ((world.provisions.households[b.householdId]?.waterMl ?? 0) >= 500) return donor;
    const water = rowsOf(world.places).find(
      (p) => p.siteId === world.places[a.placeId]?.siteId && p.tags.includes('water'),
    );
    if (water) return water.id;
  }
  if (
    needValue(world, patient, 'hunger') < 600 &&
    !usableCareFood(world, content, { householdId: a.householdId }) &&
    usableCareFood(world, content, { householdId: b.householdId })
  )
    return donor;
  return own;
}

/** An already paid bed or one's own noncommercial home, available through arrival. */
export function lodgingPlace(world: World, content: ContentBundle, id: ActorId, arrival: number): PlaceId | null {
  const bed = world.provisions.beds?.[id];
  if (bed && bed.until > arrival) return bed.placeId;
  const actor = world.actors[id];
  const home = actor && world.households[actor.householdId]?.homePlaceId;
  if (home === undefined) return null;
  const service = serviceAt(world, content, home);
  const owned = rowsOf(world.actors).some(
    (a) =>
      a.alive &&
      a.householdId === actor?.householdId &&
      content.occupations[a.occupationId]?.roles.includes(service?.keeper_role ?? ''),
  );
  return service?.bed_cents === undefined || owned ? home : null;
}

/** Food that standing orders can serve here, using ordinary preparation requirements. */
export function foodToHand(world: World, content: ContentBundle, id: ActorId): boolean {
  const actor = world.actors[id];
  if (!actor) return false;
  if (
    (world.provisions.pendingMeals ?? []).some((m) => m.placeId === actor.placeId && m.plates.some((p) => p.id === id))
  )
    return true;
  return usableCareFood(world, content, holderOfActor(world, id));
}

/** Do not consume a neighbor's working hour when no intake or shelter can be supplied. */
export function careSuppliesAvailable(
  world: World,
  content: ContentBundle,
  helper: ActorId,
  patient: ActorId,
): boolean {
  const a = world.actors[patient],
    b = world.actors[helper];
  if (!a || !b) return false;
  if ((world.provisions.pendingMeals ?? []).some((m) => m.plates.some((p) => p.id === patient))) return true;
  if (
    needValue(world, patient, 'hunger') < 600 &&
    [a.householdId, b.householdId].some((householdId) => usableCareFood(world, content, { householdId }))
  )
    return true;
  if (
    needValue(world, patient, 'thirst') < 800 &&
    (drinkingWater(world, content, helper) > 0 ||
      drinkingWater(world, content, patient) > 0 ||
      [a.householdId, b.householdId].some((id) => (world.provisions.households[id]?.waterMl ?? 0) > 0))
  )
    return true;
  return needValue(world, patient, 'warmth') < 200 && a.placeId !== world.households[a.householdId]?.homePlaceId;
}
