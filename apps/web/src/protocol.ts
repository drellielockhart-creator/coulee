/**
 * Typed message protocol between the UI thread and the sim worker. OWNER: module:web.
 *
 * The worker runs a headless `PlaySession` (ADR 0002): the UI only ever receives plain data,
 * the view model for the map and dossiers plus the session's fair observation for the play
 * panels. Player actions go in as Commands (or a headless wait phrase), are validated against
 * the session's available actions, and enter its replay log; a web session's log replays
 * headlessly (`coulee play --replay`) to the same state hash.
 */
import type { ContentBundle } from '@coulee/content/schema';
import type { ActorId, Command, Explain, HouseholdId, provisions, ViewModel, ViewOptions } from '@coulee/core';
import type {
  FoodLedger,
  Interrupt,
  KnownEvent,
  MoneyChange,
  Observation,
  ObservationMode,
  ReplayLog,
  RoutePreview,
  Storefront,
  TradeOrder,
  TradePreview,
} from '@coulee/play';

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
 * Each is answered in the worker by core or @coulee/play host functions over the session's world.
 */
export type Query =
  | { kind: 'readiness'; holder: { actorId: ActorId } | { householdId: HouseholdId } }
  | { kind: 'storefront' }
  | { kind: 'trade_preview'; order: TradeOrder }
  /** Food Explains for her kit, or (her own, or anyone's in God view) a kit or pantry. */
  | { kind: 'ledger'; holder?: { actorId: ActorId } | { householdId: HouseholdId } }
  | { kind: 'save' }
  | { kind: 'log' };
export type QueryResult =
  | { kind: 'readiness'; readiness: provisions.Readiness }
  | { kind: 'storefront'; storefront: Storefront | null }
  | { kind: 'trade_preview'; preview: TradePreview }
  | { kind: 'ledger'; ledger: FoodLedger | null }
  /** `PlaySession.save()`: the whole session, for browser storage. */
  | { kind: 'save'; json: string; stamp: string; place: string; t: number }
  /** The replay log (`commands.jsonl`) and the state hash it must reproduce. */
  | { kind: 'log'; log: ReplayLog; hash: string };

/** Static content the panels format (catalog copy, nutrition fields). Data, not rules. */
export type ItemCatalog = ContentBundle['items'];

/** Activity and interaction catalog: labels and tags for grouping the offered actions. */
export interface ActionCatalog {
  activities: Array<{
    id: string;
    name: string;
    verb: string;
    at: string;
    venue_tags: string[];
    /** Content flag: the actor sleeps through it (the map draws them indoors, not standing). */
    asleep: boolean;
    tags?: string[];
    labor?: string;
  }>;
  interactions: Array<{ id: string; name: string; label: string; description: string; tags?: string[] }>;
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

/** The session's observation as the play panels read it (god-only bulk stripped; the map has it). */
export type PlayObservation = Omit<Observation, 'truth' | 'beliefGraph'>;

/** What one action did: `PlaySession.act`'s result without its observation (posted separately). */
export interface ActOutcome {
  ok: boolean;
  /** Why it was refused (no time passed). */
  reason?: string;
  /** Accepted, but the world said no (a core rejection), in words. */
  warning?: string;
  notice?: string;
  stopped?: { at: number; wanted: number | null; reasons: string[] };
  elapsedMinutes: number;
  interrupts: Interrupt[];
  detail?: unknown;
  routePreview?: RoutePreview;
  /** The detail as the headless REPL prints it (`renderDetail`): one grammar for both players. */
  text?: string;
  /** What was ordered, in words ("Buy Hardtack ×3"). */
  label: string;
  /** Game time when the result came in. */
  t: number;
}

/** "Since last look" (11 §1.3, ADR 0002 `changes`): what the PC perceived since her last order. */
export interface Digest {
  from: number;
  to: number;
  elapsed: number;
  money: MoneyChange[];
  /** Need band changes, collapsed per need ("Hunger: steady → peckish"). */
  needs: string[];
  /** Plain-English events she saw or was party to (routine bookkeeping left out). */
  events: Array<{ id: number; t: number; summary: string; explain: Explain | null }>;
  /** What was said, in the speakers' words; her own exchange first. */
  said: KnownEvent[];
  /** Minor conversations nearby that were not worth a stop. */
  skipped: number;
  /** Waits cut short and auto-pauses, in words. */
  stops: string[];
}

export interface PlayState {
  observation: PlayObservation;
  digest: Digest;
  last: ActOutcome | null;
  mode: ObservationMode;
  /** Every money movement seen this sitting, newest last (purse and household, with reasons). */
  money: MoneyChange[];
  /** Accepted entries in the replay log. */
  steps: number;
}

export type ToWorker =
  | { type: 'query'; id: number; query: Query }
  /** Start a new arrival (or resume `save`, a `PlaySession.save()` string). */
  | { type: 'init'; scenarioId: string; seed: number; withPlayer: boolean; save?: string }
  | { type: 'set_speed'; speed: Speed }
  /** Let the clock run `hours` (each hour is an `advance(60)` in the log). */
  | { type: 'step'; hours: number }
  /** A player order: validated against the session's available actions, then `act`. */
  | { type: 'command'; command: Command; id?: number; label?: string }
  /** A headless wait phrase ("wait 4h", "wait until dawn"), parsed by @coulee/play like the REPL. */
  | { type: 'wait'; text: string; id?: number; label?: string }
  /** The player has read the "since last look" digest. */
  | { type: 'seen' }
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
      /** Kept for older panels: orders now act at once, so nothing waits. */
      pending: number;
      /** Hours the worker actually stepped for this snapshot (0 = view refresh only). */
      stepped: number;
      /** Auto-pauses raised during this step; the worker has already stopped the clock. */
      alerts?: Alert[];
    }
  /** The play session after any change: observation, digest, last outcome. */
  | { type: 'play'; play: PlayState }
  /** The reply to a `command` or `wait` that carried an id. */
  | { type: 'acted'; id: number; outcome: ActOutcome }
  /** The worker stopped its own clock (an interrupt, an ending, a fresh or loaded session). */
  | { type: 'paused' }
  /** A save could not be loaded; the session already running carries on untouched. */
  | { type: 'load_failed'; message: string }
  /**
   * Display-only progress through the current game-hour (≈4 Hz while running). The sim steps
   * hourly; this lets the strip show minutes passing and when the next order applies. It never
   * feeds back into a Command (11 §1.7).
   */
  | { type: 'progress'; t: number; frac: number }
  | { type: 'query_result'; id: number; result: QueryResult }
  | { type: 'error'; message: string };
