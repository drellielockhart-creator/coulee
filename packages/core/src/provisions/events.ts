/**
 * Provisions events (food crunch, P8). OWNER: module:provisions.
 */
import type { EventOf } from '../events/base.ts';
import type { ActorId, HouseholdId, ItemId, PlaceId } from '../ids.ts';

export type ProvisionsEvent =
  /** Someone ate (Explain may carry prep checks). */
  | EventOf<
      'provisions.meal',
      {
        actorId: ActorId;
        householdId: HouseholdId | null;
        items: Array<{ defId: string; qty: number; method: string }>;
        kcal: number;
        hot: boolean;
        morale: number;
      }
    >
  /** Food spoiled (temperature/wetness/packaging named in the Explain). */
  | EventOf<'provisions.spoiled', { itemId: ItemId; defId: string; qty: number; into: string | null }>
  /** Purchase at a store (03 §8). */
  | EventOf<
      'provisions.purchase',
      { buyerId: ActorId; placeId: PlaceId; defId: string; qty: number; priceCents: number; onCredit: boolean }
    >
  /** A household's stores fell below a threshold (days of food), or rations were cut. */
  | EventOf<'provisions.shortage', { householdId: HouseholdId; daysOfFoodTenths: number; rationPct: number }>
  /** Nutrition condition changed (scurvy stages, malnourished). Chronicle-worthy. */
  | EventOf<'provisions.nutrition', { actorId: ActorId; condition: string; on: boolean }>;
