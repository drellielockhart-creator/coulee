/**
 * Typed message protocol between the UI thread and the sim worker. OWNER: module:web.
 *
 * The sim runs in a Web Worker (ADR 0001). The UI only ever receives plain-data
 * ViewModel snapshots; it never touches World directly. Player actions go in as Commands
 * (ADR 0002 parity rule: the only state-changing message is `command`).
 */
import type { ContentBundle } from '@coulee/content/schema';
import type { ActorId, Command, HouseholdId, provisions, ViewModel, ViewOptions } from '@coulee/core';

/**
 * Game-hours per real second at each speed. 1× ≈ 40 real seconds per game-hour (ADR 0001,
 * 11 §1.6). RimWorld-style ladder: pause, 1×, 2×, 3×, plus Ultra for sleeping through days
 * of provisions (11 §1.6 "Ultra": 8 h in ≤ 5 s).
 */
export const SPEEDS = { paused: 0, x1: 1 / 40, x2: 2 / 40, x3: 3 / 40, ultra: 2 } as const;
export type Speed = keyof typeof SPEEDS;
export const SPEED_ORDER: readonly Speed[] = ['paused', 'x1', 'x2', 'x3', 'ultra'];

/**
 * Pure queries (11 §1.7 "The UI asks; the core answers"): the UI never recomputes rules.
 * Each is answered by a core module api function, filtered by viewer knowledge.
 * Extend this union as module APIs land (odds, planProvisions, loadConsequences...).
 */
export type Query = { kind: 'readiness'; holder: { actorId: ActorId } | { householdId: HouseholdId } };
export type QueryResult = { kind: 'readiness'; readiness: provisions.Readiness };

/** Static content the panels format (catalog copy, nutrition fields). Data, not rules. */
export type ItemCatalog = ContentBundle['items'];

/** What the player can ask for through `core.urge` (labels only; the sim decides). */
export interface ActionCatalog {
  activities: Array<{
    id: string;
    name: string;
    verb: string;
    at: string;
    venue_tags: string[];
    /** Content flag: the actor sleeps through it (the map draws them indoors, not standing). */
    asleep: boolean;
  }>;
  interactions: Array<{ id: string; name: string; label: string; description: string }>;
}

/**
 * A snapshot after the first is a patch (11 §5.4 "only changed view models are posted"): actors
 * and places by id, other slices whole when they changed. Unchanged slices keep their object
 * identity on the UI thread, so memoized panels and the renderer skip them.
 */
export interface VmPatch {
  time: ViewModel['time'];
  playerId: ViewModel['playerId'];
  eventCount: number;
  /** Full id order of the actors in view (perspective can add or drop people). */
  actorIds: number[];
  actors: ViewModel['actors'];
  placeIds: number[];
  places: ViewModel['places'];
  scenario?: ViewModel['scenario'];
  seed?: number;
  site?: ViewModel['site'];
  households?: ViewModel['households'];
  chronicle?: ViewModel['chronicle'];
  belief?: ViewModel['belief'];
}

/**
 * An auto-pause (11 §1.6) raised by the shared @coulee/play interrupt policy (ADR 0002 §3) on
 * an event the PC perceived. `text` is display copy built in the worker.
 */
export interface Alert {
  category: string;
  reason: string;
  text: string;
  score: number;
  eventId?: number;
  t: number;
}

export type ToWorker =
  | { type: 'query'; id: number; query: Query }
  | { type: 'init'; scenarioId: string; seed: number; withPlayer: boolean }
  | { type: 'set_speed'; speed: Speed }
  | { type: 'step'; hours: number }
  | { type: 'command'; command: Command }
  | { type: 'set_view'; options: Partial<ViewOptions> };

export type FromWorker =
  | {
      type: 'ready';
      scenarios: Array<{ id: string; name: string }>;
      contentHash: string;
      /** Item definitions (content data) for the Book and the nutrition strips. */
      items: ItemCatalog;
      actions: ActionCatalog;
    }
  | {
      type: 'snapshot';
      /** A full view model (first snapshot, or after the view options change)... */
      vm?: ViewModel;
      /** ...or the slices that changed since the last snapshot. */
      patch?: VmPatch;
      hash: string | null;
      stepMs: number;
      /** Commands queued for the next step (shown as "orders given"). */
      pending: number;
      /** Hours the worker actually stepped for this snapshot (0 = view refresh only). */
      stepped: number;
      /** Auto-pauses raised during this step; the worker has already stopped the clock. */
      alerts?: Alert[];
    }
  /**
   * Display-only progress through the current game-hour (≈4 Hz while running). The sim steps
   * hourly; this lets the strip show minutes passing and when the next order applies. It never
   * feeds back into a Command (11 §1.7).
   */
  | { type: 'progress'; t: number; frac: number }
  | { type: 'query_result'; id: number; result: QueryResult }
  | { type: 'error'; message: string };
