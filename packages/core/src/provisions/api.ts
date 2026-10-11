/**
 * Provisions cross-module API. OWNER: module:provisions.
 */
import type { ContentBundle } from '../content.ts';
import { term } from '../explain.ts';
import type { ActorId, HouseholdId, PlaceId } from '../ids.ts';
import { rowsOf } from '../ids.ts';
import { atPlace, stacksDeep } from '../items/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { larderKcal } from './economy.ts';

/** Money outside the store (loans, repayments): see economy.ts. */
export { cashOf, purchase, transferCash } from './economy.ts';

import { yearsBetween } from '../time.ts';
import { dailyKcal, hungry, membersOf } from './meals.ts';
import { planReadiness } from './planner.ts';
import { SHOPPING, shoppingDays } from './rules.ts';

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
    if ((household.headId === actorId || urgent) && larder < daily * shoppingDays(ctx.cal.month).trigger) {
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
