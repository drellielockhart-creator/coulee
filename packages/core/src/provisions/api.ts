import { tacticalPinned } from '../activity/api.ts';
import { authorizeAct, type Basis, commandBasis, standingOrders } from '../psyche/api.ts';
import { processesActor } from '../region/processing.ts';
/**
 * Provisions cross-module API. OWNER: module:provisions.
 */

import { isAsleep, onJourney, reservePreparation, walkMinutes } from '../activity/api.ts';
import type { ContentBundle } from '../content.ts';
import { term } from '../explain.ts';
import type { ActorId, HouseholdId, ItemId, PlaceId } from '../ids.ts';
import { rowsOf } from '../ids.ts';
import {
  atPlace,
  campContext,
  carriedBy,
  consumeSupply,
  type InventoryIndex,
  inventoryIndex,
  moveStack,
  rootOf,
  stacksAt,
  stacksDeep,
  supplyUnits,
  withInventoryPass,
} from '../items/api.ts';
import { fitsInContainer } from '../items/containers.ts';
import { loadReport, MOVE_LIMIT_PCT, movableRoomG } from '../items/encumbrance.ts';
import { canAct, drink, needValue, rousedBy } from '../needs/api.ts';
import type { SimContext } from '../sim/context.ts';
import { inheritMoneyLedger } from '../social/api.ts';
import type { Urge, UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { cashOf, creditLimitFor, larderKcal } from './economy.ts';
import { accessibleStack, awaitingMeal, holderOfActor, holderStacks, mealExplain, serveMeal } from './meals.ts';
import { pieceRate, pieceStock, saleTotal } from './piece-rates.ts';
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
  isWaterSource,
  type Kitchen,
  kitchenOf,
  membersOf,
  recipesFor,
  waterAvailable,
} from './meals.ts';
import { planReadiness } from './planner.ts';
import { agePct, MONOTONY, SHOPPING, shoppingDays } from './rules.ts';
import { tripReadiness } from './trip.ts';

/** The spoilage kernel the planner uses, for hosts that explain "spoils first" (P1/P8). Read-only. */
export { minutesUntil, type SpoilFactors, shelfMinutes, spoilageFactors } from './spoilage.ts';
/** Outdoor air temperature, °F (the weather hook; needs reads exposure from here). */
export { airTempF, isRaining, storageTempF, tempBand } from './temperature.ts';

/**
 * P8 legibility: "days of food at current rations, what spoils first, weight/bulk
 * tradeoffs". Computed for an actor's carried kit or a household's pantry.
 */
export interface Readiness {
  trip?: import('./trip.ts').TripReadiness | string;
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
  /** Fae charms in the kit (13 §5.7): exact rows counted, conditional rows shown only, claims not included. */
  charms?: import('../fae/forecast.ts').CharmForecastRow[];
  /** One eater: today's scheduled daily need, by labor hours (P1). */
  needExplain?: import('../explain.ts').Explain;
  /** One eater: the lowest and highest daily need over the coming week, kcal at current rations. */
  needRange?: { min: number; max: number };
}

export type ReadinessHolder = { actorId: ActorId } | { householdId: HouseholdId };

/** Projects the same meals, preparation and hourly storage rules used by the simulation. */
export function readinessOf(
  world: World,
  content: ContentBundle,
  holder: ReadinessHolder,
  now: number,
  horizonDays?: number,
  itinerary?: { actorId: ActorId; order: import('../activity/api.ts').TravelOrder },
): Readiness {
  const result = planReadiness(world, content, holder, now, horizonDays);
  if (itinerary) result.trip = tripReadiness(world, content, itinerary.actorId, itinerary.order);
  return result;
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
  // With nothing to drink at hand, the nearest spring, creek or ford within a short walk is
  // where water is (and where vessels fill); otherwise the urge walks home as before.
  // Only afield (open ground away from home) and only when the water is nearer than home: in
  // town the walk home brings water and the household meal together.
  const water = drinkingWater(world, ctx.content, actorId) > 0;
  const home = world.households[actor.householdId]?.homePlaceId;
  const found =
    water || !campContext(world, ctx.content, actorId).afield
      ? null
      : nearestWaterSource(world, ctx.content, actorId, SOURCE_WALK_MINUTES);
  const source =
    found && (home === undefined || found.minutes < walkMinutes(world, ctx.content, actor.placeId, home))
      ? found
      : null;
  if (thirst < 600 && (water || source) && ctx.content.activities.fetch_water) {
    const intensity = Math.min(1000, 400 + (600 - thirst) * 2);
    out.push({
      urge: { kind: 'activity', activityId: 'fetch_water', placeId: source?.placeId ?? actor.placeId },
      voice: 'id',
      intensity,
      label: source
        ? `Thirsty: water at ${world.places[source.placeId]?.name ?? 'the spring'}`
        : onJourney(world, actorId)
          ? 'Drink from carried water'
          : 'Drink accessible water',
      source: 'provisions',
      drive: 'hunger',
      reasons: [
        term('need', 'Thirst deficit', intensity),
        ...(source ? [term('water', 'Walk to the nearest water, minutes', source.minutes)] : []),
      ],
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
  // Monotony (05 §6, 10): the same few foods day after day are an Appetite thought toward
  // something different. It is a low-pressure wish (it rarely beats a duty) and names the foods.
  const nutrition = world.provisions.nutrition[actorId];
  if (nutrition && nutrition.monotony >= MONOTONY.thinOnset && yearsBetween(actor.born, ctx.now) >= SHOPPING.minAge) {
    const store = bestIntentStore(world, ctx, actorId);
    const commerce = Object.values(ctx.content.activities)
      .filter((a) => a.tags.includes('commerce'))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    const foods = [...new Set(nutrition.history.slice(-3).flatMap((d) => d.foods))]
      .slice(0, 3)
      .map((id) => (ctx.content.items[id]?.name ?? id).split(/[,(/]/)[0]?.trim().toLowerCase());
    if (store && commerce && storeOpen(world, ctx.content, store.placeId, ctx.now) && foods.length)
      out.push({
        urge: { kind: 'activity', activityId: commerce.id, placeId: store.placeId },
        voice: 'id',
        intensity: Math.min(400, 150 + Math.floor((nutrition.monotony - MONOTONY.thinOnset) / 2)),
        label: `Sick of ${foods.join(' and ')}: something different from the store`,
        source: 'provisions',
        drive: 'hunger',
        reasons: [term('food', 'Monotony of the last fortnight', nutrition.monotony)],
      });
  }
  const household = world.households[actor.householdId];
  // Store hours: the head of the household goes when the larder runs low; when it is nearly
  // empty any grown member will go. The duty presses harder the emptier the shelves.
  const adult = yearsBetween(actor.born, ctx.now) >= SHOPPING.minAge;
  // A lodger boards at another household's table: there is no pantry of their own to keep
  // stocked (playtest r2: "The pantry is nearly bare: go to the store" for a tavern lodger).
  const keeper = household ? world.provisions.stores[household.homePlaceId]?.ownerHouseholdId : undefined;
  const boarding =
    household !== undefined &&
    keeper !== undefined &&
    keeper !== null &&
    keeper !== household.id &&
    serviceAt(world, ctx.content, household.homePlaceId)?.bed_cents !== undefined;
  if (
    world.provisions.settings.npcBuying &&
    household &&
    !boarding &&
    adult &&
    ctx.cal.hour >= SHOPPING.openHour &&
    ctx.cal.hour < SHOPPING.closeHour &&
    !ctx.cal.isSabbath
  ) {
    const pass = decisionPass(world, ctx);
    let supply = pass.households.get(household.id);
    if (!supply) {
      supply = {
        daily: membersOf(world, { householdId: household.id }).reduce(
          (n, id) => n + dailyKcal(world, ctx.content, id, ctx.now),
          0,
        ),
        larder: larderKcal(world, ctx, household.id),
      };
      pass.households.set(household.id, supply);
    }
    const { daily, larder } = supply;
    const urgent = larder < daily * SHOPPING.urgentDays;
    if (
      (household.headId === actorId || !canAct(world, household.headId) || urgent) &&
      larder < daily * shoppingDays(ctx.cal.month).trigger
    ) {
      const intensity = urgent ? 950 : 800;
      const store = bestIntentStore(world, ctx, actorId);
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
export function bestStore(world: World, ctx: Pick<SimContext, 'content'>, buyerId?: ActorId) {
  return rankStores(world, ctx, buyerId);
}

// Psyche's inventory pass is read-only. All actors see the same stock, while
// cash, credit, and the keeper's judgment remain personal and are checked afresh.
function bestIntentStore(world: World, ctx: SimContext, buyerId: ActorId) {
  return rankStores(world, ctx, buyerId, decisionPass(world, ctx).stockKcal);
}
function rankStores(
  world: World,
  ctx: Pick<SimContext, 'content'>,
  buyerId?: ActorId,
  stockKcal?: Map<PlaceId, number>,
) {
  let best: { store: (typeof world.provisions.stores)[number]; kcal: number } | undefined;
  for (const store of rowsOf(world.provisions.stores)) {
    // M5: a traveler shops only at stores on the site where they stand.
    if (
      world.region &&
      buyerId !== undefined &&
      world.places[store.placeId]?.siteId !== world.places[world.actors[buyerId]?.placeId ?? 0]?.siteId
    )
      continue;
    if (
      buyerId !== undefined &&
      cashOf(world, buyerId) <= 0 &&
      creditLimitFor(world, ctx.content, store.placeId, buyerId) <= (store.tabs[buyerId] ?? 0)
    )
      continue;
    let kcal = stockKcal?.get(store.placeId);
    if (kcal === undefined) {
      kcal = 0;
      for (const { stack } of stacksDeep(world, atPlace(store.placeId)))
        kcal += (ctx.content.items[stack.defId]?.food?.kcal ?? 0) * stack.qty;
      stockKcal?.set(store.placeId, kcal);
    }
    if (!best || kcal > best.kcal) best = { store, kcal };
  }
  return best?.store;
}

// Shared kernels exposed for command validation and telemetry; hosts must not duplicate prep rules.
export {
  accessibleStack,
  dailyKcal,
  dailyNeedExplain,
  foodServings,
  holderOfActor,
  isWaterSource,
  recipesFor,
} from './meals.ts';

/** First marginal bid: piece-rate demand or ordinary buyback, always below county retail. */
export function saleQuote(
  world: World,
  content: ContentBundle,
  placeId: PlaceId,
  itemId: ItemId,
  stocked?: number,
): number | null {
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
  return saleBid(world, content, placeId, stack.defId, stocked);
}
/** Posted marginal bid, using the same stock and county resale ceiling as a sale. */
export function saleBid(
  world: World,
  content: ContentBundle,
  placeId: PlaceId,
  defId: string,
  stocked?: number,
): number | null {
  const retail = priceAt(world, content, placeId, defId);
  if (retail === null) return null;
  const lowestRetail = Math.min(
    ...rowsOf(world.provisions.stores).map((store) => priceAt(world, content, store.placeId, defId) ?? retail),
  );
  if (lowestRetail <= 0) return null;
  const rate = pieceRate(world, content, placeId, defId);
  if (!rate && Object.values(content.pieceRates ?? {}).some((r) => r.item === defId)) return null;
  const stock = rate ? (stocked ?? pieceStock(world, placeId, defId)) : 0;
  if (rate && stock >= rate.capacity) return null;
  const pct = content.domesticRules?.daily?.buyback_pct ?? 65;
  const bid = rate
    ? Math.max(1, Math.ceil((rate.buy_cents * (rate.capacity - stock)) / rate.capacity))
    : Math.floor(((content.items[defId]?.value_cents ?? 0) * pct) / 100);
  return Math.max(0, Math.min(retail - 1, lowestRetail - 1, bid));
}
/** Same-goods counter sale across separate stacks, preserving wetness and preparation state. */
export function saleBundleCheck(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  placeId: PlaceId,
  itemIds: readonly ItemId[],
  qty: number,
): string | null {
  if (
    !Number.isSafeInteger(qty) ||
    qty <= 0 ||
    !itemIds.length ||
    itemIds.length > 128 ||
    new Set(itemIds).size !== itemIds.length
  )
    return 'Choose a positive quantity of carried goods';
  const defId = world.items.stacks[itemIds[0] ?? 0]?.defId;
  if (!defId || itemIds.some((id) => world.items.stacks[id]?.defId !== defId)) return 'Choose stacks of the same goods';
  const copy: World = JSON.parse(JSON.stringify(world));
  const projected = { ...ctx, emit: () => 0 as import('../ids.ts').EventId };
  let remaining = qty;
  for (const id of itemIds) {
    const amount = Math.min(remaining, copy.items.stacks[id]?.qty ?? 0);
    if (amount > 0 && !sell(copy, projected, actorId, placeId, id, amount)) {
      // Name the business refusals (wave 10 D) that a single-stack sale would name.
      const refused = storeBidRefusal(copy, placeId, actorId, commandBasis(ctx, actorId, ['provisions.sell']));
      if (refused) return refused;
      const total = saleTotal(copy, ctx.content, placeId, id, amount);
      if (total !== null && total > storeCash(copy, placeId, actorId))
        return 'The store lacks the cash to buy that many of these goods just now';
      return 'Store cannot buy that quantity of these goods (check demand, condition and available cash)';
    }
    remaining -= amount;
    if (!remaining) return null;
  }
  return 'You do not carry that many of these goods';
}
export function sellAcrossStacks(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  placeId: PlaceId,
  itemIds: readonly ItemId[],
  qty: number,
): boolean {
  if (saleBundleCheck(world, ctx, actorId, placeId, itemIds, qty)) return false;
  let remaining = qty;
  for (const id of itemIds) {
    const amount = Math.min(remaining, world.items.stacks[id]?.qty ?? 0);
    if (amount > 0) sell(world, ctx, actorId, placeId, id, amount);
    remaining -= amount;
    if (!remaining) break;
  }
  return true;
}

/** Business buying funds use its cashbox and proprietor's purse, like employer payments. */
export function storeCash(world: World, placeId: PlaceId, sellerId?: ActorId): number {
  const store = world.provisions.stores[placeId];
  if (!store) return 0;
  if (store.ownerHouseholdId === null) return Math.max(0, store.tillCents);
  const head = world.households[store.ownerHouseholdId]?.headId;
  return (
    Math.max(0, world.provisions.households[store.ownerHouseholdId]?.cashCents ?? 0) +
    (head === undefined || head === sellerId ? 0 : Math.max(0, world.provisions.purses[head] ?? 0))
  );
}
export function storeBidRefusal(world: World, placeId: PlaceId, sellerId: ActorId, basis?: Basis): string | null {
  const store = world.provisions.stores[placeId];
  const head = store?.ownerHouseholdId == null ? undefined : world.households[store.ownerHouseholdId]?.headId;
  if (head === undefined) return null; // Legacy ownerless businesses use their authored till.
  return authorizeAct(
    world,
    head,
    { kind: 'transfer' },
    head === sellerId ? (basis ?? { kind: 'command', issuer: { kind: 'player' } }) : { kind: 'own' },
  ).ok
    ? null
    : 'No one can agree to that purchase just now';
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
  const cost = saleTotal(world, ctx.content, placeId, itemId, qty);
  if (cost === null || cost <= 0) return false;
  if (
    storeCash(world, placeId, actorId) < cost ||
    storeBidRefusal(world, placeId, actorId, commandBasis(ctx, actorId, ['provisions.sell']))
  )
    return false;
  const head = store.ownerHouseholdId === null ? undefined : world.households[store.ownerHouseholdId]?.headId;
  const pursePaid = head === undefined || head === actorId ? 0 : Math.min(world.provisions.purses[head] ?? 0, cost);
  const moved = moveStack(world, ctx, itemId, qty, atPlace(placeId));
  const sold = world.items.stacks[moved];
  if (sold) delete sold.forSale;
  if (head !== undefined && pursePaid) world.provisions.purses[head] = (world.provisions.purses[head] ?? 0) - pursePaid;
  if (owner) owner.cashCents -= cost - pursePaid;
  else store.tillCents -= cost;
  world.provisions.purses[actorId] = (world.provisions.purses[actorId] ?? 0) + cost;
  ctx.emit({
    kind: 'provisions.sale',
    data: { sellerId: actorId, placeId, defId: stack.defId, qty, priceCents: cost },
    roles: [
      { actor: actorId, role: 'agent' },
      ...(head !== undefined && head !== actorId ? [{ actor: head, role: 'target' as const }] : []),
    ],
    visibility: 'private',
    explain: {
      kind: 'formula',
      label: 'Store buys goods at marginal piece rates / resale spread',
      subjects: [actorId, ...(head !== undefined && head !== actorId ? [head] : [])],
      knowledge: 'participants',
      terms: [term('price', 'First-unit bid (below county retail)', price), term('item', 'Quantity', qty)],
      total: cost,
      outcome: 'sold',
      note: 'Piece-rate batches sum the bid for each unit as it fills the shelves; other goods use the resale spread.',
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
  const available = waterAvailable(world, ctx.content, { actorId }, index);
  const home = homeWaterHolder(world, actorId);
  if (
    !canAct(world, actorId) ||
    !Number.isSafeInteger(ml) ||
    ml <= 0 ||
    ml > available + (home ? (world.provisions.households[home.householdId]?.waterMl ?? 0) : 0)
  )
    return false;
  const carried = Math.min(ml, available);
  drawWater(world, ctx.content, { actorId }, carried, index);
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
  index?: InventoryIndex,
): number | null {
  const check = refillCheck(world, content, actorId, itemId, ml, index);
  return 'ml' in check ? check.ml : null;
}
/**
 * Filling a vessel: the millilitres it would take, or the plain reason it cannot be filled here.
 * Water weighs 1 g/ml, so a vessel in the pack is filled only as far as the carrier can still
 * move (the 150% load limit): a fill to the brim is trimmed to that room (`shortMl` says how much
 * was left out) and a fill with nothing to spare, or an explicit `ml` past it, is refused.
 */
export function refillCheck(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  itemId: ItemId,
  ml?: number,
  index?: InventoryIndex,
): { ml: number; shortMl?: number } | { reason: string } {
  const actor = world.actors[actorId],
    stack = world.items.stacks[itemId];
  if (!actor?.alive || !stack || !accessibleStack(world, actorId, stack))
    return { reason: 'That vessel is not in your pack or pantry here' };
  const name = content.items[stack.defId]?.name ?? stack.defId;
  const capacity = content.items[stack.defId]?.container?.liquid_ml ?? 0;
  if (capacity <= 0) return { reason: `${name} does not hold water` };
  // Water does not fill around solids: the vessel must be emptied first.
  const inside = stacksAt(world, { kind: 'container', itemId });
  if (inside.length)
    return {
      reason: `${name} holds ${inside.map((s) => content.items[s.defId]?.name ?? s.defId).join(', ')}; unpack it before filling`,
    };
  const wanted = ml ?? capacity - (stack.waterMl ?? 0);
  if (!Number.isSafeInteger(wanted) || wanted <= 0 || wanted + stack.waterMl > capacity)
    return { reason: `${name} is full (${stack.waterMl} of ${capacity} ml)` };
  const home = homeWaterHolder(world, actorId),
    source = isWaterSource(world, content, actor.placeId);
  if (!source && (!home || waterAvailable(world, content, home) < wanted)) {
    const near = nearestWaterSource(world, content, actorId);
    return {
      reason: `No water to draw here${home ? ' (the household water is used up)' : ''}: fill at a spring, creek or ford${near ? `; the nearest is ${world.places[near.placeId]?.name}, ${near.minutes} min on foot` : ''}, or at your lodgings`,
    };
  }
  // Water in the pack is weight on the carrier's back: never fill past the point of being able to walk.
  let fill = wanted;
  const root = rootOf(world, stack);
  if (root.kind === 'actor' && root.actorId === actorId) {
    const room = movableRoomG(world, content, actorId, index);
    if (ml !== undefined ? wanted > room : room <= 0) {
      const load = loadReport(world, content, actorId, index);
      const after = Math.floor(((load.weightG + wanted) * 100) / Math.max(1, load.capacityG));
      return {
        reason: `Too heavy: ${wanted} ml of water would put your load at ${after}% of what you can carry (now ${load.loadPct}%, ${load.band.label}); over ${MOVE_LIMIT_PCT}% you cannot walk. ${room > 0 ? `You can take on ${room} ml more` : 'Drink some, empty a vessel or lighten your pack first'}`,
      };
    }
    fill = Math.min(wanted, room);
  }
  const parent = stack.location.kind === 'container' ? world.items.stacks[stack.location.itemId] : undefined;
  if (parent) {
    const filled = { ...stack, waterMl: stack.waterMl + fill };
    const projected: World = {
      ...world,
      items: { ...world.items, stacks: { ...world.items.stacks, [itemId]: filled } },
    };
    const fit = fitsInContainer(projected, content, filled, filled.qty, parent);
    if (!fit.ok) return { reason: `Filled, it would not fit: ${fit.reason ?? 'no room'}` };
  }
  return fill < wanted ? { ml: fill, shortMl: wanted - fill } : { ml: fill };
}
export function refillWater(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  itemId: ItemId,
  ml?: number,
  index?: InventoryIndex,
): boolean {
  const check = refillCheck(world, ctx.content, actorId, itemId, ml, index),
    actor = world.actors[actorId],
    stack = world.items.stacks[itemId];
  if (!('ml' in check) || !actor || !stack) return false;
  const filled = check.ml;
  const home = homeWaterHolder(world, actorId),
    source = isWaterSource(world, ctx.content, actor.placeId);
  const capacity = ctx.content.items[stack.defId]?.container?.liquid_ml ?? 0;
  const before = stack.waterMl;
  stack.waterMl += filled;
  if (!source && home) drawWater(world, ctx.content, home, filled);
  ctx.emit({
    kind: 'provisions.refilled',
    data: { actorId, itemId, ml: filled, ...(check.shortMl ? { shortMl: check.shortMl } : {}) },
    roles: [{ actor: actorId, role: 'agent' }],
    visibility: 'private',
    explain: mealExplain('Refill water vessel', [actorId], stack.waterMl, [
      term('water', 'Previous stored ml', before),
      term('water', 'Water drawn ml', filled),
      term('item', 'Vessel capacity ml', capacity),
      ...(check.shortMl ? [term('load', 'Left out at the load limit ml', check.shortMl)] : []),
    ]),
  });
  return true;
}
/** Pouring a vessel out: the millilitres it holds, or the plain reason there is nothing to pour. */
export function emptyCheck(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  itemId: ItemId,
): { ml: number } | { reason: string } {
  const actor = world.actors[actorId],
    stack = world.items.stacks[itemId];
  if (!actor?.alive || !stack || !accessibleStack(world, actorId, stack))
    return { reason: 'That vessel is not in your pack or pantry here' };
  const name = content.items[stack.defId]?.name ?? stack.defId;
  if ((content.items[stack.defId]?.container?.liquid_ml ?? 0) <= 0) return { reason: `${name} does not hold water` };
  return (stack.waterMl ?? 0) > 0 ? { ml: stack.waterMl } : { reason: `${name} is already empty` };
}
/** Pour a vessel's water out on the ground (an explicit way to lighten a pack that automatic filling loaded). */
export function emptyVessel(world: World, ctx: SimContext, actorId: ActorId, itemId: ItemId): boolean {
  const check = emptyCheck(world, ctx.content, actorId, itemId),
    stack = world.items.stacks[itemId];
  if (!('ml' in check) || !stack || !canAct(world, actorId)) return false;
  stack.waterMl = 0;
  ctx.emit({
    kind: 'provisions.emptied',
    data: { actorId, itemId, ml: check.ml },
    roles: [{ actor: actorId, role: 'agent' }],
    visibility: 'private',
    explain: mealExplain('Pour out water vessel', [actorId], 0, [term('water', 'Poured out ml', check.ml)]),
  });
  return true;
}
/** How far a thirsty actor will walk for a spring or creek on their own account, minutes. */
export const SOURCE_WALK_MINUTES = 30;

/** The nearest natural water on this site by walking time (the actor's own place first). */
export function nearestWaterSource(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  maxMinutes = 24 * 60,
): { placeId: PlaceId; minutes: number } | null {
  const actor = world.actors[actorId];
  if (!actor) return null;
  if (isWaterSource(world, content, actor.placeId)) return { placeId: actor.placeId, minutes: 0 };
  const site = world.places[actor.placeId]?.siteId;
  let best: { placeId: PlaceId; minutes: number } | null = null;
  for (const place of rowsOf(world.places)) {
    if (place.siteId !== site || !isWaterSource(world, content, place.id)) continue;
    const minutes = walkMinutes(world, content, actor.placeId, place.id);
    if (minutes <= maxMinutes && (!best || minutes < best.minutes)) best = { placeId: place.id, minutes };
  }
  return best;
}

/** A fetch-water order this hour authorizes drawing water into one's vessels. */
function fetchOrdered(world: World, ctx: SimContext, actorId: ActorId): boolean {
  const command = ctx.commands.find(
    (c) =>
      c.actorId === actorId &&
      c.kind === 'core.urge' &&
      c.data.urge.kind === 'activity' &&
      c.data.urge.activityId === 'fetch_water',
  );
  return (
    !!command &&
    authorizeAct(world, actorId, { kind: 'drink' }, { kind: 'command', issuer: command.issuer ?? { kind: 'player' } })
      .ok
  );
}

/** Ordinary sipping and filling at an accessible source, also used in readiness projections. */
export function waterHour(world: World, ctx: SimContext, onlyActor?: ActorId): void {
  const index = inventoryIndex(world);
  for (const actor of rowsOf(world.actors)) {
    if (onlyActor !== undefined && actor.id !== onlyActor) continue;
    if (!processesActor(world, actor.id)) continue;
    if (tacticalPinned(world, actor.id)) continue;
    if (
      !actor.alive ||
      (!authorizeAct(world, actor.id, { kind: 'consequential' }, { kind: 'own' }).ok &&
        !standingOrders(world, actor.id).drink &&
        !fetchOrdered(world, ctx, actor.id))
    )
      continue;
    const value = needValue(world, actor.id, 'thirst');
    // A sleeper sips nothing, but a band that rouses (Parched) wakes them to drink what they carry.
    if (isAsleep(world, ctx, actor.id) && !rousedBy(world, ctx.content, actor.id)) continue;
    if (value < 600) {
      const def = ctx.content.needs.thirst;
      const ml = Math.min(
        drinkingWater(world, ctx.content, actor.id, index),
        Math.max(0, Math.ceil((900 - value) * (def?.intake?.per_point ?? 2))),
      );
      if (ml > 0) drinkWater(world, ctx, actor.id, ml, index);
    }
    if (isWaterSource(world, ctx.content, actor.placeId))
      for (const { stack } of stacksDeep(world, carriedBy(actor.id), index))
        if ((ctx.content.items[stack.defId]?.container?.liquid_ml ?? 0) > stack.waterMl)
          refillWater(world, ctx, actor.id, stack.id, undefined, index);
  }
}

export { nutritionRestLoss } from './nutrition.ts';
export { admitSleep, boardMeal, boardMealAvailability, serviceAt, settleBeds, storeOpen } from './services.ts';

/** Decision-time inventory/kitchens, scoped to this immutable proposal pass. The next hourly
 * context gets a new index; no memo enters a save or survives inventory mutations into a pass. */
type DecisionContext = SimContext & {
  provisionsDecisionPass?: {
    index: InventoryIndex;
    kitchens: Map<string, Kitchen>;
    stockKcal: Map<PlaceId, number>;
    households: Map<HouseholdId, { daily: number; larder: number }>;
    usableFood: Map<string, boolean>;
  };
};
function decisionPass(world: World, ctx: SimContext) {
  const context = ctx as DecisionContext;
  context.provisionsDecisionPass ??= {
    index: inventoryIndex(world),
    kitchens: new Map(),
    stockKcal: new Map(),
    households: new Map(),
    usableFood: new Map(),
  };
  return context.provisionsDecisionPass;
}
function decisionKitchen(world: World, ctx: SimContext, holder: ReadinessHolder): Kitchen {
  const pass = decisionPass(world, ctx);
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
  const usable = (holder: ReadinessHolder) => {
    const memo = decisionPass(world, ctx).usableFood;
    const key = 'householdId' in holder ? `h${holder.householdId}` : `a${holder.actorId}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const kitchen = decisionKitchen(world, ctx, holder);
    const result = kitchen.stacks.some(
      (stack) =>
        !stack.forSale &&
        foodServings(ctx.content, stack) > 0 &&
        (ctx.content.items[stack.defId]?.food?.kcal ?? 0) > 0 &&
        recipesFor(world, ctx.content, holder, stack, 1, false, undefined, undefined, kitchen).some(
          (r) => r.kcal > 0 && r.missing.length === 0,
        ),
    );
    memo.set(key, result);
    return result;
  };
  // The household's own plate, or one here, is the meal. A bought plate left at another place
  // does not hold her "at table" while she goes hungry: with food in her pack she eats that.
  const pending = (world.provisions.pendingMeals ?? []).find((m) => m.plates.some((p) => p.id === actorId));
  if (
    pending &&
    (pending.placeId === actor.placeId ||
      pending.householdId === actor.householdId ||
      pending.householdId === null ||
      !usable({ actorId }))
  )
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
    if (usable(holder)) {
      if (waitForMeal) return null;
      const placeId = 'householdId' in holder ? world.households[holder.householdId]?.homePlaceId : actor.placeId;
      return { kind: 'activity', activityId: 'take_meal', ...(placeId === undefined ? {} : { placeId }) };
    }
  }
  if (yearsBetween(actor.born, ctx.now) < SHOPPING.minAge) return null;
  const activity = Object.values(ctx.content.activities).find((a) => a.tags.includes('commerce'));
  const store = bestIntentStore(world, ctx, actorId);
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
      !stack.forSale &&
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
      (p) => p.siteId === world.places[a.placeId]?.siteId && isWaterSource(world, content, p.id),
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

/**
 * An already paid bed or one's own noncommercial home, available through arrival. With
 * `payable`, also one's own lodgings where a bed can be paid on arrival (the standing sleep
 * order's entitlement): the charge falls only when the sleeper is in it.
 */
export function lodgingPlace(
  world: World,
  content: ContentBundle,
  id: ActorId,
  arrival: number,
  payable = false,
): PlaceId | null {
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
  if (service?.bed_cents === undefined || owned) return home;
  return payable && cashOf(world, id) >= service.bed_cents ? home : null;
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

/**
 * Set a ration order for oneself (householdId null) or one's own household, as the
 * `provisions.set_rations` command does. A host may apply it at the moment it is given, since
 * settings take no game time (playtest r2). Returns the refusal reason, or null when set.
 */
export function applyRations(
  world: World,
  actorId: ActorId,
  householdId: HouseholdId | null,
  rationPct: number,
): string | null {
  const actor = world.actors[actorId];
  if (!actor) return 'No such person';
  if (!Number.isInteger(rationPct) || rationPct < 10 || rationPct > 150)
    return 'Rations must be an integer percent from 10 to 150';
  if (householdId !== null) {
    const h = world.provisions.households[householdId];
    if (actor.householdId !== householdId || !h) return 'Cannot set another household’s rations';
    h.rationPct = rationPct;
    return null;
  }
  const n = world.provisions.nutrition[actorId];
  if (n) n.rationPct = rationPct;
  return null;
}

export { type TripReadiness, tripReadiness } from './trip.ts';

/** Road preparations stay at the stopping point; they cannot follow a moving traveler. */
export function roadPreparationPending(world: World, id: ActorId): boolean {
  const place = world.region?.transit[id];
  return place !== undefined && awaitingMeal(world, id, place);
}

/** Leaving a private roadside camp extinguishes its paid fire, without refunding fuel. */
export function leaveRoadCamp(world: World, ctx: SimContext, id: ActorId): void {
  const place = world.region?.transit[id];
  const fire = place === undefined ? undefined : world.provisions.fires[place];
  if (place === undefined || !fire?.lit) return;
  fire.lit = false;
  fire.fuelMinutes = 0;
  fire.until = ctx.now;
  ctx.emit({
    kind: 'provisions.fire',
    data: { placeId: place, lit: false, fuelMinutes: 0, ignition: 'Leaving roadside camp' },
    place,
    roles: [{ actor: id, role: 'agent' }],
    visibility: 'private',
    explain: {
      kind: 'formula',
      label: 'Extinguish roadside fire before walking',
      subjects: [id],
      knowledge: 'self',
      terms: [{ source: 'fuel', label: 'Remaining fire minutes', value: 0 }],
      total: 0,
      outcome: 'Extinguished; spent fuel is not returned',
    },
  });
}
export { creditLimitFor } from './economy.ts';
export {
  activeEmployment,
  dismissWorker,
  employmentDayMinutes,
  hireOn,
  hiringAvailability,
  hiringOffer,
  quitWork,
  workAvailability,
} from './hiring.ts';
/** Shared household day kernel for region scheduling; retains real stores and ration policy. */
export { householdEconomyDay } from './household.ts';
export { pieceRate, pieceStock, saleTotal } from './piece-rates.ts';
export { type FoodParcel, householdFoodDays, type ReliefPlanningMemo, reliefParcel } from './relief.ts';
export { executeProvisionCommands, provisionsSystem as householdProcessingHour } from './system.ts';
export * from './tactical.ts';

/** Three-day P8 projection, sufficient for the Director's <3 day threshold. */
export function tensionProvisions(world: World, content: ContentBundle, id: ActorId, now: number, survivalFloor = 0) {
  const a = world.actors[id];
  if (!a) return { food: 0, scurvy: 0, cash: 0 };
  const home = world.households[a.householdId]?.homePlaceId;
  const holder = a.placeId === home ? { householdId: a.householdId } : { actorId: id };
  const scurvy = world.provisions.nutrition[id]?.scurvy ?? 0;
  // Once food pressure is below the other survival terms, further projection cannot
  // change their maximum. This shortens work without approximating the final term.
  const floor = Math.max(survivalFloor, scurvy);
  const horizon = Math.max(0, Math.min(3, Math.ceil(((1000 - floor) * 3) / 1000)));
  const days =
    horizon === 0
      ? 30
      : withInventoryPass(world, () => planReadiness(world, content, holder, now, horizon, false)).daysOfFoodTenths;
  return {
    food: Math.max(0, Math.floor(((30 - days) * 1000) / 30)),
    scurvy,
    cash: cashOf(world, id),
  };
}

export { dormantHouseholdMeal, dormantNutritionDay, dormantPantries, finishDormantMeals } from './dormant.ts';
