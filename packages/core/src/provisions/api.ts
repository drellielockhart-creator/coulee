/**
 * Provisions cross-module API. OWNER: module:provisions.
 */
import type { ContentBundle } from '../content.ts';
import type { ActorId, HouseholdId, PlaceId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';

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

/** STUB: returns an empty readiness (module:provisions implements). */
export function readinessOf(_world: World, _content: ContentBundle, _holder: ReadinessHolder, _now: number): Readiness {
  return {
    kcalOnHand: 0,
    kcalPerDay: 0,
    daysOfFoodTenths: 0,
    daysOfFuelTenths: null,
    spoilsFirst: null,
    unpreparable: [],
    warnings: [],
  };
}

/** Price in cents of one unit at a store (03 §8.1 markup; opinion-adjusted later). */
export function priceAt(world: World, content: ContentBundle, placeId: PlaceId, defId: string): number | null {
  const store = world.provisions.stores[placeId];
  const def = content.items[defId];
  if (!store || !def) return null;
  return Math.round((def.value_cents * store.markupPct) / 100);
}

/** Id-voiced "eat now" / superego "buy flour before Sunday" urges. STUB. */
export function proposeProvisionUrges(_world: World, _ctx: SimContext, _actorId: ActorId): UrgeProposal[] {
  return [];
}
