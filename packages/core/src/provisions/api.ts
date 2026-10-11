/**
 * Provisions cross-module API. OWNER: module:provisions.
 */
import type { ContentBundle } from '../content.ts';
import { term } from '../explain.ts';
import type { ActorId, HouseholdId, ItemId, PlaceId } from '../ids.ts';
import { rowsOf } from '../ids.ts';
import { atPlace, moveStack, rootOf, stacksAt } from '../items/api.ts';
import { drink } from '../needs/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { larderKcal } from './economy.ts';
import { dailyKcal, drawWater, holderOfActor, hungry, membersOf, waterAvailable } from './meals.ts';
import { planReadiness } from './planner.ts';
import { SHOPPING } from './rules.ts';

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
  /** The stack that will spoil soonest and when (days, tenths). */
  spoilsFirst: { defId: string; name: string; inDaysTenths: number } | null;
  /** Foods you have but cannot prepare with what's here ("beans: no kettle"). */
  unpreparable: Array<{ defId: string; name: string; missing: string[] }>;
  /** Plain-language warnings: "No fresh food: scurvy in ~5 weeks". */
  warnings: string[];
}

export type ReadinessHolder = { actorId: ActorId } | { householdId: HouseholdId };

/** Projects the same meals, preparation and hourly storage rules used by the simulation. */
export function readinessOf(world: World, content: ContentBundle, holder: ReadinessHolder, now: number): Readiness {
  return planReadiness(world, content, holder, now);
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
  if (!actor?.alive) return [];
  const out: UrgeProposal[] = [];
  if (
    hungry(world, actorId) &&
    ctx.content.activities.take_meal &&
    world.provisions.nutrition[actorId]?.lastMealAt !== ctx.now
  ) {
    out.push({
      urge: { kind: 'activity', activityId: 'take_meal' },
      voice: 'id',
      intensity: 650,
      label: 'Hungry: eat from the larder or pack',
      source: 'provisions',
      drive: 'hunger',
      reasons: [term('need', 'Hunger', 650)],
    });
  }
  const household = world.households[actor.householdId];
  if (world.provisions.settings.npcBuying && household?.headId === actorId && ctx.cal.hour === SHOPPING.hour) {
    const daily = membersOf(world, { householdId: household.id }).reduce(
      (n, id) => n + dailyKcal(world, ctx.content, id, ctx.now),
      0,
    );
    if (larderKcal(world, ctx, household.id) < daily * SHOPPING.triggerDays) {
      const store = rowsOf(world.provisions.stores)[0];
      const activity = Object.values(ctx.content.activities)
        .filter((a) => a.tags.includes('commerce'))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
      if (store && activity)
        out.push({
          urge: { kind: 'activity', activityId: activity.id, placeId: store.placeId },
          voice: 'superego',
          intensity: 800,
          label: 'The pantry is running low: buy provisions',
          source: 'provisions',
          norm: 'duty',
          reasons: [term('food', 'Household provision duty', 800)],
        });
    }
  }
  return out;
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
  return retail === null ? null : Math.min(retail, content.items[stack.defId]?.value_cents ?? 0);
}
export function sell(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  placeId: PlaceId,
  itemId: ItemId,
  qty: number,
): boolean {
  const actor = world.actors[actorId],
    store = world.provisions.stores[placeId],
    stack = world.items.stacks[itemId];
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
      terms: [term('price', 'Unit cents (base value capped at retail)', price), term('item', 'Quantity', qty)],
      total: cost,
      outcome: 'sold',
    },
  });
  return true;
}

/** Drink uses the same accessible water and depletion kernel as meal preparation. */
export function drinkingWater(world: World, content: ContentBundle, actorId: ActorId): number {
  return waterAvailable(world, content, holderOfActor(world, actorId));
}
export function drinkWater(world: World, ctx: SimContext, actorId: ActorId, ml: number): boolean {
  if (
    !world.actors[actorId]?.alive ||
    !Number.isSafeInteger(ml) ||
    ml <= 0 ||
    ml > drinkingWater(world, ctx.content, actorId)
  )
    return false;
  drawWater(world, ctx.content, holderOfActor(world, actorId), ml);
  drink(world, ctx, actorId, ml, { label: 'Drink available water' });
  return true;
}
