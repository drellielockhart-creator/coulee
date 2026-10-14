/**
 * Tunable rules and built-in defaults for the food crunch. OWNER: module:provisions.
 *
 * Everything here is an integer. Meal plans and ration policies are content (content/base/provisions);
 * the copies below are the fallback when a bundle has none, so the sim never depends on a table being present.
 */

import type { MealPlanDef, RationPolicyDef } from '@coulee/content/schema';
import type { ContentBundle, ItemDef, PeopleDef } from '../content.ts';

/** Baseline daily energy at light labor, kcal (05 §6.1). */
export const BASE_KCAL_PER_DAY = 2400;

/** Hourly energy burn by labor level, percent of baseline (a day of mixed work averages ~110%). */
export const LABOR_PCT = { rest: 70, light: 100, heavy: 150 } as const;
/** Anyone eating from a kit in the wild is travelling hard: 05 §6.1 "x1.5 for heavy labor, travel". */
export const TRAIL_LABOR_PCT = 150;

/** Energy needs by age in years, percent of an adult's (children eat less, growing teens a full share). */
export function agePct(years: number): number {
  if (years < 2) return 25;
  if (years < 5) return 40;
  if (years < 9) return 60;
  if (years < 13) return 80;
  if (years < 65) return 100;
  return 85;
}

/** A single food may supply at most this share of a meal's kcal in the first pass, so plates stay varied. */
export const MAX_SHARE_PCT = 55;
/** Foods at or below this many kcal per serving are "sides" (coffee, tea, salt): served for morale, not energy. */
export const SIDE_KCAL_MAX = 60;
/** Fire-minutes held back before a side that needs its own fire is worth lighting for (an armload's worth x2). */
export const SIDE_FIRE_RESERVE_MIN = 120;
/** Kindling burned lighting a cold fire, fire-minutes. */
export const KINDLING_MIN = 10;
/** Place kinds where a mess is "on the trail" and eats from its kit rather than a household pantry. */
export const TRAIL_PLACE_KINDS: readonly string[] = ['wild'];

/** Scurvy (03 §3.7.3): daily fresh index from fresh-points over this many reference servings. */
export const SCURVY_REF_SERVINGS = 5;
export const SCURVY = {
  /** Accrual per day when the fresh index is below 10: (12 - index). Six weeks at 0 reaches `earlyOn`. */
  accrualBase: 12,
  accrualBelow: 10,
  /** Relief per day by fresh index band: [10..24], [25..39], [40..]. */
  reliefLow: 4,
  reliefMid: 12,
  reliefHigh: 30,
  earlyOn: 500,
  earlyOff: 350,
  fullOn: 800,
  fullOff: 600,
} as const;

/** Monotony (03 §3.7.3): 1000 minus a penalty per distinct food and group in the last 14 days. */
export const MONOTONY = { perFood: 100, perGroup: 50, thinOnset: 600 } as const;

/** The standing eat order skips a meal only when this full (hunger meter); snacks need real hunger (600). */
export const STANDING_FULL = 900;

/** Malnourishment: mean intake over the last 7 recorded days, percent of need, with hysteresis; and lean-fat floor. */
export const MALNOURISHED = { onPct: 70, offPct: 85, minDays: 3, fatFloorPct: 10 } as const;

/** Household ration policy (03 §3.7.6): days of food at which rations step down, and where they step back up. */
export const RATION_STEPS = [
  { belowDays: 4, pct: 50 },
  { belowDays: 10, pct: 75 },
  { belowDays: 21, pct: 90 },
] as const;
export const RATION_RESTORE_DAYS = 30;
/** Below this many days of food a household gets a shortage notice every day (household.ts). */
export const SHORTAGE_NOTICE_DAYS = 4;
/**
 * A ration forecast with days to spare holds for them (2026-10-13 food forecast): a forecast of
 * D days that leaves the ration in place stands until D - (next cut) - `safetyDays` days have
 * passed, at most `maxDays`. It is re-checked at once if the larder falls faster than `guardPct`
 * of the planned daily need, gains food while rations are short (a restore may be due), or the
 * table changes. Full-ration forecasts look `horizonDays` ahead.
 */
export const RATION_LEASE = { horizonDays: 36, safetyDays: 1, maxDays: 14, guardPct: 125 } as const;

/** Shopping (03 §8): top up to this many days when the larder dips under the trigger; errands run at this hour. */
export const SHOPPING = {
  triggerDays: 21,
  targetDays: 28,
  /** Below this many days any grown member goes, and the duty presses harder. */
  urgentDays: 7,
  /** Store hours (the urge only forms while the store is open; not on the Sabbath). */
  openHour: 8,
  closeHour: 17,
  minAge: 14,
  hour: 9,
  /** Laying in for winter (05 §4.3): in these months a household buys toward `winterDays`. */
  winterStockMonths: [10, 11] as readonly number[],
  winterTriggerDays: 60,
  winterDays: 90,
  reserveCents: 100,
  reservePct: 15,
} as const;

/** A storekeeper who shuns a customer (04 §9.2 rung 3): this percent of the shelf price, and no credit. */
export const SHUNNED = { markupPct: 150 } as const;

/** Vermin (03 §3.7.2): per-day chance per susceptible stack, per mille, by storage kind. */
export const VERMIN_DAILY_PERMILLE: Record<string, number> = {
  outdoor: 90,
  indoor: 30,
  cellar: 20,
  springhouse: 15,
  body: 0,
};
/** Packaging classes that keep mice out. */
export const VERMIN_BLOCKERS = ['vermin_proof', 'airtight', 'brine'] as const;

/** Turning food costs this much morale per serving (03 §3.7.4). */
export const TURNING_MORALE = -2;
/** A failed cookery check costs this much morale per serving and burns one serving in five. */
export const FAILED_COOK_MORALE = -3;

/**
 * Fuel a household splits and carries in per day, in armloads of the cheapest fire supply, up to a
 * woodpile cap. A house burns wood whether one person lives in it or six (a cookstove through an
 * April day is ~5 armloads, with cooking ~7; 1850s households burned 15-30 cords a year), so the
 * yard has a per-house base plus a share per member, and a woodpile of weeks.
 */
export const WOODPILE = { baseDay: 10, perMemberDay: 2, capBase: 80, capPerMember: 12 } as const;

/** Evening: lamps are lit from dusk until this hour (the household's bedtime). */
export const BEDTIME_HOUR = 21;

/** Alcohol: grams of ethanol per standard drink, points of intoxication per gram, per hour decay. */
export const ALCOHOL = {
  gramsPerDrink: 14,
  pointsPerGram: 14,
  decayPerHour: 60,
  drunkOn: 300,
  drunkOff: 150,
  hungoverHours: 8,
} as const;

export const DEFAULT_POLICY_ID = 'spoils_first';
export const HOUSEHOLD_PLAN_ID = 'household';
export const TRAIL_PLAN_ID = 'trail';

export const FALLBACK_PLANS: Record<string, MealPlanDef> = {
  household: {
    id: 'household',
    name: 'Three meals at table',
    description: '',
    meals: [
      { id: 'breakfast', name: 'Breakfast', hour: 6, share_pct: 25, cold: false },
      { id: 'dinner', name: 'Dinner', hour: 12, share_pct: 40, cold: false },
      { id: 'supper', name: 'Supper', hour: 18, share_pct: 35, cold: false },
    ],
  },
  trail: {
    id: 'trail',
    name: 'Trail fare',
    description: '',
    meals: [
      { id: 'breakfast', name: 'Camp breakfast', hour: 6, share_pct: 30, cold: false },
      { id: 'noon_piece', name: 'Noon piece', hour: 12, share_pct: 20, cold: true },
      { id: 'supper', name: 'Camp supper', hour: 18, share_pct: 50, cold: false },
    ],
  },
};

export const FALLBACK_POLICY: RationPolicyDef = {
  id: DEFAULT_POLICY_ID,
  name: 'Spoils first',
  description: '',
  weights: { preparation_time: 2, spoils_first: 20, morale: 10, variety: 10, lightness: 0, thrift: 10, fresh_need: 10 },
  reserve_tags: [],
};

export function mealPlanFor(content: ContentBundle, id: string): MealPlanDef {
  return content.mealPlans?.[id] ?? FALLBACK_PLANS[id] ?? (FALLBACK_PLANS[HOUSEHOLD_PLAN_ID] as MealPlanDef);
}

export function policyFor(content: ContentBundle, id: string | undefined): RationPolicyDef {
  return (
    content.rationPolicies?.[id ?? DEFAULT_POLICY_ID] ?? content.rationPolicies?.[DEFAULT_POLICY_ID] ?? FALLBACK_POLICY
  );
}

/** A people's energy need, percent of baseline (goblins eat 70%, 12 §13). Reads `kcal_pct` if the people has one. */
export function peopleKcalPct(people: PeopleDef | undefined): number {
  const v = (people as { kcal_pct?: number } | undefined)?.kcal_pct;
  return typeof v === 'number' && v > 0 ? Math.round(v) : 100;
}

/** kcal one serving of a food gives, as served (before prep losses). */
export function kcalPerServing(food: NonNullable<ItemDef['food']>): number {
  return Math.round(food.kcal / Math.max(1, food.servings));
}

/** Shopping horizon (trigger and target days) for the month: ordinary, or laying in for winter. */
export function shoppingDays(month: number): { trigger: number; target: number } {
  return SHOPPING.winterStockMonths.includes(month)
    ? { trigger: SHOPPING.winterTriggerDays, target: SHOPPING.winterDays }
    : { trigger: SHOPPING.triggerDays, target: SHOPPING.targetDays };
}
