/**
 * Provisions events (food crunch, P8). OWNER: module:provisions.
 */
import type { EventOf } from '../events/base.ts';
import type { ActorId, HouseholdId, ItemId, PlaceId } from '../ids.ts';

export type ProvisionsEvent =
  | EventOf<
      'provisions.hiring',
      {
        workerId: ActorId;
        employerId: ActorId;
        accepted: boolean;
        reason: string;
        workplaceId?: PlaceId;
        dailyCents?: number;
        hours?: number;
        fromHour?: number;
        toHour?: number;
        endsAt?: number;
        pay?: 'daily' | 'weekly';
      }
    >
  | EventOf<
      'provisions.employment_ended',
      { workerId: ActorId; employerId: ActorId; reason: 'quit' | 'dismissed' | 'term_end' }
    >
  | EventOf<
      'provisions.credit_extended' | 'provisions.credit_refused',
      { keeperId: ActorId; buyerId: ActorId; placeId: PlaceId; limitCents: number }
    >
  | EventOf<
      'provisions.production',
      { actorId: ActorId; activityId: string; yields: Array<{ defId: string; qty: number }> }
    >
  | EventOf<
      'provisions.load_movement',
      { actorId: ActorId; loadPct: number; speedPct: number; minutes: number; blocked: boolean }
    >
  | EventOf<'provisions.fire', { placeId: PlaceId; lit: boolean; fuelMinutes: number; ignition: string }>
  | EventOf<
      'provisions.refilled',
      {
        actorId: ActorId;
        itemId: ItemId;
        ml: number;
        /** Millilitres left unfilled because the extra weight would leave the carrier unable to move. */
        shortMl?: number;
      }
    >
  | EventOf<'provisions.emptied', { actorId: ActorId; itemId: ItemId; ml: number }>
  | EventOf<'provisions.prep_started', { cookId: ActorId; completesAt: number; activeMinutes: number; minutes: number }>
  | EventOf<
      'provisions.shopping_plan',
      { householdId: HouseholdId; energyKcal: number; fatG: number; proteinG: number; freshPoints: number }
    >
  | EventOf<'provisions.sale', { sellerId: ActorId; placeId: PlaceId; defId: string; qty: number; priceCents: number }>
  | EventOf<
      'provisions.intake',
      {
        actorId: ActorId;
        dayIndex: number;
        kcal: number;
        proteinG: number;
        fatG: number;
        fresh: number;
        scurvy: number;
        monotony: number;
        morale: number;
      }
    >
  | EventOf<
      'provisions.prepared',
      {
        itemId: ItemId;
        from: string;
        into: string;
        servings: number;
        servingsPm?: number;
        methods: string[];
        fireMinutes: number;
        waterMl: number;
        minutes: number;
      }
    >
  | EventOf<'provisions.prep_failed', { itemId: ItemId; missing: string[] }>
  | EventOf<'provisions.vermin', { itemId: ItemId; defId: string; qty: number }>
  | EventOf<'provisions.light', { itemId: ItemId; lit: boolean; reason: string }>
  | EventOf<'provisions.supply_used', { itemId: ItemId; kind: string; units: number }>
  | EventOf<
      'provisions.wages',
      {
        householdId: HouseholdId;
        cents: number;
        actorId?: ActorId;
        payerHouseholdId?: HouseholdId;
        arrearsCents?: number;
      }
    >
  | EventOf<'provisions.water', { householdId: HouseholdId; ml: number }>
  | EventOf<
      'provisions.restock',
      { placeId: PlaceId; defId: string; qty: number; costCents: number; cashPaidCents?: number; boundary?: 'freight' }
    >
  | EventOf<'provisions.command_rejected', { actorId: ActorId; command: string; reason: string }>
  | EventOf<'provisions.rations', { actorId: ActorId; householdId: HouseholdId | null; rationPct: number }>

  /** Someone ate (Explain may carry prep checks). */
  | EventOf<
      'provisions.meal',
      {
        actorId: ActorId;
        householdId: HouseholdId | null;
        items: Array<{ defId: string; qty: number; method: string; servingsPm?: number }>;
        kcal: number;
        hot: boolean;
        morale: number;
        assistedBy?: ActorId;
        /** Eaten under a standing order, not a command or the eater's own choice. */
        standing?: boolean;
      }
    >
  /** Food spoiled (temperature/wetness/packaging named in the Explain). */
  | EventOf<'provisions.spoiled', { itemId: ItemId; defId: string; qty: number; into: string | null }>
  /** Purchase at a store (03 §8). */
  | EventOf<
      'provisions.purchase',
      {
        buyerId: ActorId;
        placeId: PlaceId;
        defId: string;
        qty: number;
        priceCents: number;
        onCredit: boolean;
        /** Bought for the household pantry (an errand), not carried away in the buyer's pack. */
        toPantry?: boolean;
      }
    >
  /** Cash changed hands outside a store (a loan, a repayment): integer cents, purse then household. */
  | EventOf<
      'provisions.cash_transfer',
      { fromId: ActorId; toId: ActorId; cents: number; wantedCents: number; reason: string }
    >
  /** A household's stores fell below a threshold (days of food), or rations were cut. */
  | EventOf<'provisions.shortage', { householdId: HouseholdId; daysOfFoodTenths: number; rationPct: number }>
  /** Nutrition condition changed (scurvy stages, malnourished). Chronicle-worthy. */
  | EventOf<'provisions.nutrition', { actorId: ActorId; condition: string; on: boolean; reason?: string }>;
