/**
 * Provisions state: nutrition per actor, household stores policy, purses, stores, fires
 * (00 P8; 03 §6.4, §8; 05 §6.1). OWNER: module:provisions.
 *
 * Item instances themselves live in world.items (items/state.ts, also provisions-owned).
 * Everything here is integers and plain data.
 */
import { type ActorId, type HouseholdId, idsOf, mustGet, type PlaceId, type Table } from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import type { GameMinute } from '../time.ts';
import type { World } from '../world.ts';
import { DEFAULT_POLICY_ID } from './rules.ts';

/** One day's intake (integers). */
export interface DayIntake {
  dayIndex: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  /** Σ fresh × servings (fresh-points), for the scurvy guard. */
  freshPoints: number;
  servings: number;
  /** Distinct food groups eaten that day (monotony). */
  groups: string[];
  /** Hot meals eaten (morale). */
  hotMeals: number;
  /** Distinct foods (item def ids) eaten that day (monotony). */
  foods: string[];
  /** Full-ration energy obligation, kcal (need x meal shares); cutting rations does not cut physiology. */
  needKcal: number;
  /** Σ morale per serving eaten, summed over the day's meals (the food-morale hook). */
  morale: number;
  /** Meals eaten, and how many of them were cold. */
  meals: number;
  coldMeals: number;
}

export interface Nutrition {
  today: DayIntake;
  /** Last 14 complete days, oldest first. */
  history: DayIntake[];
  lastMealAt: GameMinute | null;
  /** 0..1000 accumulated scurvy risk (rises on low fresh, falls with fresh food). */
  scurvy: number;
  /** 0..1000 monotony (same few foods day after day). */
  monotony: number;
  /** Personal ration, percent of full: used when eating from one's own kit (households use theirs). */
  rationPct: number;
  /** Consecutive days with a fresh index below 10 (the "scurvy watch" counter). */
  lowFreshDays: number;
  /** 0..1000 intoxication, decaying hourly. */
  intoxication: number;
  /** Game minute until which the actor is hungover, or null. */
  hungoverUntil: GameMinute | null;
}

export interface HouseholdProvisions {
  cashCents: number;
  /** Water hauled for household cooking each day, ml. */
  waterMl: number;
  /** Last daily water/fuel replenishment; optional for earlier saves. */
  lastSuppliesDay?: number | null;
  /** Ration level, percent of full (100). Lowered when stores run short. */
  rationPct: number;
  /** Storage kind of the household's pantry (drives storage temperature). */
  storage: 'indoor' | 'cellar' | 'springhouse';
  /** Eat-order policy id (a ration_policy record). */
  policy: string;
  /** Index of the ration step the household has fallen to (0 = full rations). */
  shortageStep: number;
  /** Day index of the last shortage notice, or null. */
  lastShortageDay: number | null;
}

export interface Store {
  placeId: PlaceId;
  /** Household that owns and keeps the till, if any. */
  ownerHouseholdId: HouseholdId | null;
  markupPct: number;
  /** Largest tab one customer may run, cents. */
  creditLimitCents: number;
  /** Restock table id, or null if the shelves are never refilled. */
  restockId: string | null;
  /** Customer -> cents owed to the store (Gussie's ledger, 01 §8.3 / 03 §8.5). */
  tabs: Table<ActorId, number>;
  /** Sales taken at a store that has no owning household, cents. */
  tillCents: number;
  /** Owed to the wholesaler for goods ordered beyond the owner's cash, cents. */
  wholesaleDebtCents: number;
  /** Day index of the last wholesale delivery, or null. */
  lastRestockDay: number | null;
  /** Item def id -> usual stock level (the opening shelves), the scarcity baseline. */
  targets: Record<string, number>;
}

export interface Fire {
  placeId: PlaceId;
  lit: boolean;
  /** Remaining minutes of fuel on the fire. */
  fuelMinutes: number;
}

/** Switches a harness or test can flip. They change what happens in the world, never the rules by who is playing. */
export interface ProvisionsSettings {
  /** Households run to the store when the larder runs low. */
  npcBuying: boolean;
  /** Households cut rations on shortage. */
  autoRations: boolean;
  /** Households gather their own firewood. */
  householdWood: boolean;
  /** Weekly wages (occupation wage_cents_per_day x 6) are paid into household cash. */
  wages: boolean;
}

export interface ProvisionsState {
  nutrition: Table<ActorId, Nutrition>;
  households: Table<HouseholdId, HouseholdProvisions>;
  /** Actor purse, cents. */
  purses: Table<ActorId, number>;
  stores: Table<PlaceId, Store>;
  fires: Table<PlaceId, Fire>;
  settings: ProvisionsSettings;
}

export function createProvisionsState(): ProvisionsState {
  return {
    nutrition: {},
    households: {},
    purses: {},
    stores: {},
    fires: {},
    settings: { npcBuying: true, autoRations: true, householdWood: true, wages: true },
  };
}

export function emptyIntake(dayIndex: number): DayIntake {
  return {
    dayIndex,
    kcal: 0,
    proteinG: 0,
    fatG: 0,
    freshPoints: 0,
    servings: 0,
    groups: [],
    hotMeals: 0,
    foods: [],
    needKcal: 0,
    morale: 0,
    meals: 0,
    coldMeals: 0,
  };
}

export function emptyNutrition(dayIndex: number): Nutrition {
  return {
    today: emptyIntake(dayIndex),
    history: [],
    lastMealAt: null,
    scurvy: 0,
    monotony: 0,
    rationPct: 100,
    lowFreshDays: 0,
    intoxication: 0,
    hungoverUntil: null,
  };
}

export function initProvisionsState(world: World, ctx: InitContext): void {
  const st = world.provisions;
  const day0 = Math.floor(ctx.now / 1440);
  for (const id of idsOf<ActorId>(world.actors)) {
    mustGet(world.actors, id, 'actor');
    st.nutrition[id] = emptyNutrition(day0);
    st.purses[id] = 0;
  }
  for (const a of ctx.scenario.actors) {
    const id = world.index.actorByKey[a.key];
    if (id !== undefined) st.purses[id] = a.purse_cents;
  }
  for (const h of ctx.scenario.households) {
    const id = world.index.householdByKey[h.key];
    if (id === undefined) continue;
    st.households[id] = {
      cashCents: h.cash_cents,
      waterMl: (world.households[id]?.memberIds.length ?? 1) * 5000,
      lastSuppliesDay: null,
      rationPct: 100,
      storage: h.storage,
      policy: h.ration_policy ?? DEFAULT_POLICY_ID,
      shortageStep: 0,
      lastShortageDay: null,
    };
  }
  for (const s of ctx.scenario.stocks) {
    const pid = world.index.placeByDef[s.place];
    if (pid === undefined) continue;
    let owner: HouseholdId | null = null;
    for (const hid of idsOf<HouseholdId>(world.households)) {
      if (world.households[hid]?.homePlaceId === pid) owner = hid;
    }
    // A restock table that names this place applies even if the scenario did not link it.
    const linked = s.restock ?? Object.values(ctx.content.restocks ?? {}).find((r) => r.place === s.place)?.id ?? null;
    const targets: Record<string, number> = {};
    for (const seed of s.items) targets[seed.item] = (targets[seed.item] ?? 0) + seed.qty;
    // Opening tabs: creditor edges owed to someone in the owning household (Gussie's ledger).
    const tabs: Table<ActorId, number> = {};
    for (const rel of ctx.scenario.relationships) {
      if (rel.kind !== 'creditor' || rel.amount_cents === undefined || rel.amount_cents <= 0) continue;
      const creditor = world.index.actorByKey[rel.a];
      const debtor = world.index.actorByKey[rel.b];
      if (creditor === undefined || debtor === undefined) continue;
      if (owner !== null && world.actors[creditor]?.householdId === owner) {
        tabs[debtor] = (tabs[debtor] ?? 0) + rel.amount_cents;
      }
    }
    st.stores[pid] = {
      placeId: pid,
      ownerHouseholdId: owner,
      markupPct: s.markup_pct,
      creditLimitCents: s.credit_limit_cents,
      restockId: linked,
      tabs,
      tillCents: 0,
      wholesaleDebtCents: 0,
      lastRestockDay: null,
      targets,
    };
  }
}
