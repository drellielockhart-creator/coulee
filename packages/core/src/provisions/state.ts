/**
 * Provisions state: nutrition per actor, household stores policy, purses, stores, fires
 * (00 P8; 03 §6.4, §8; 05 §6.1). OWNER: module:provisions.
 *
 * Item instances themselves live in world.items (items/state.ts, also provisions-owned).
 */
import { type ActorId, type HouseholdId, idsOf, mustGet, type PlaceId, type Table } from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import type { GameMinute } from '../time.ts';
import type { World } from '../world.ts';

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
}

export interface HouseholdProvisions {
  cashCents: number;
  /** Ration level, percent of full (100). Lowered when stores run short. */
  rationPct: number;
  /** Storage kind of the household's pantry (drives storage temperature). */
  storage: 'indoor' | 'cellar' | 'springhouse';
}

export interface Store {
  placeId: PlaceId;
  /** Household that owns and keeps the till, if any. */
  ownerHouseholdId: HouseholdId | null;
  markupPct: number;
}

export interface Fire {
  placeId: PlaceId;
  lit: boolean;
  /** Remaining minutes of fuel on the fire. */
  fuelMinutes: number;
}

export interface ProvisionsState {
  nutrition: Table<ActorId, Nutrition>;
  households: Table<HouseholdId, HouseholdProvisions>;
  /** Actor purse, cents. */
  purses: Table<ActorId, number>;
  stores: Table<PlaceId, Store>;
  fires: Table<PlaceId, Fire>;
}

export function createProvisionsState(): ProvisionsState {
  return { nutrition: {}, households: {}, purses: {}, stores: {}, fires: {} };
}

export function emptyIntake(dayIndex: number): DayIntake {
  return { dayIndex, kcal: 0, proteinG: 0, fatG: 0, freshPoints: 0, servings: 0, groups: [], hotMeals: 0 };
}

export function initProvisionsState(world: World, ctx: InitContext): void {
  const st = world.provisions;
  for (const id of idsOf<ActorId>(world.actors)) {
    mustGet(world.actors, id, 'actor');
    st.nutrition[id] = { today: emptyIntake(0), history: [], lastMealAt: null, scurvy: 0, monotony: 0 };
    st.purses[id] = 0;
  }
  for (const a of ctx.scenario.actors) {
    const id = world.index.actorByKey[a.key];
    if (id !== undefined) st.purses[id] = a.purse_cents;
  }
  for (const h of ctx.scenario.households) {
    const id = world.index.householdByKey[h.key];
    if (id !== undefined) st.households[id] = { cashCents: h.cash_cents, rationPct: 100, storage: 'indoor' };
  }
  for (const s of ctx.scenario.stocks) {
    const pid = world.index.placeByDef[s.place];
    if (pid === undefined) continue;
    let owner: HouseholdId | null = null;
    for (const hid of idsOf<HouseholdId>(world.households)) {
      if (world.households[hid]?.homePlaceId === pid) owner = hid;
    }
    st.stores[pid] = { placeId: pid, ownerHouseholdId: owner, markupPct: s.markup_pct };
  }
}
