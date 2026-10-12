/**
 * World state: one plain, JSON-able object. FOUNDATION-OWNED composition.
 *
 * The world is COMPOSED of per-module slices; each slice type is defined in its module's
 * own `state.ts`. Rules:
 *   - A module writes only its own slice (+ appends events via ctx.emit). To change another
 *     module's data, call that module's api.ts function.
 *   - Exception: the activity module writes ActorCore.placeId; modules toggle only the
 *     condition ids they own (see MODULES.md) via setCondition().
 *   - Integers only in accumulated state. Tables keyed by integer ids (see ids.ts Table).
 *   - No class instances, Maps, Sets, functions, undefined-in-arrays, or cycles.
 */

import type { ActivityState } from './activity/state.ts';
import type { ActorCore, Household, Place } from './actor.ts';
import type { BeliefState } from './belief/state.ts';
import type { ChronicleState } from './chronicle/state.ts';
import type { EventLog } from './events/index.ts';
import type { FaeState } from './fae/state.ts';
import type { ActorId, HouseholdId, PlaceId, Table } from './ids.ts';
import type { ItemsState } from './items/state.ts';
import type { NeedsState } from './needs/state.ts';
import type { ProvisionsState } from './provisions/state.ts';
import type { PsycheState } from './psyche/state.ts';
import type { SocialState } from './social/state.ts';
import type { GameMinute } from './time.ts';

export interface WorldMeta {
  format: 1;
  seed: number;
  scenarioId: string;
  /** Content bundle hash the world was created with (saves/replays must match). */
  contentHash: string;
  /** The actor the player controls in the web build, if any. */
  playerId: ActorId | null;
}

export interface World {
  meta: WorldMeta;
  /** Start of the next hour to simulate. */
  time: GameMinute;
  counters: { actor: number; household: number; place: number };
  actors: Table<ActorId, ActorCore>;
  households: Table<HouseholdId, Household>;
  places: Table<PlaceId, Place>;
  /** Lookups from content/scenario string keys to runtime ids. */
  index: {
    actorByKey: Record<string, ActorId>;
    householdByKey: Record<string, HouseholdId>;
    placeByDef: Record<string, PlaceId>;
  };
  log: EventLog;

  // ---- module slices (each type owned by its module) ----
  fae: FaeState;
  needs: NeedsState;
  activity: ActivityState;
  psyche: PsycheState;
  social: SocialState;
  belief: BeliefState;
  items: ItemsState;
  provisions: ProvisionsState;
  chronicle: ChronicleState;
}
