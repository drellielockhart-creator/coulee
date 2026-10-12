/**
 * Chronicle state: structured entries sifted from the event log (05 §9, §11).
 * OWNER: module:chronicle.
 *
 * Everything here is integers, strings and booleans in plain objects/arrays, so the slice is
 * JSON-able and hashes the same after a save/load round trip. The `ChronicleEntry` shape is
 * additive-only: the web reads it through `view.ts`.
 */
import type { Explain } from '../explain.ts';
import type { ActorId, ChronicleEntryId, EventId, PlaceId } from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import type { GameMinute } from '../time.ts';
import type { World } from '../world.ts';

/**
 * The voices (05 §11.2): journal (a literate writer, first person), paper (public), almanac
 * (dates, digests), ballad (folklore), ledger (a household's account book: the P8 crunch),
 * epilogue (the omniscient post-run reckoning; never shown during play).
 */
export type ChronicleVoice = 'journal' | 'paper' | 'almanac' | 'ballad' | 'ledger' | 'epilogue';

/**
 * Knowledge basis (05 §11.1): during a run the player sees only what their character knows
 * or what is public; the omniscient epilogue reveals the rest.
 */
export type KnowledgeBasis = 'public' | 'witnessed' | 'heard' | 'omniscient';

export type EntryKind = 'event' | 'pattern' | 'digest' | 'almanac' | 'closing' | 'truth';

export interface ChronicleEntry {
  id: ChronicleEntryId;
  t: GameMinute;
  tEnd: GameMinute;
  voice: ChronicleVoice;
  /** Optional headline (paper voice). */
  headline: string | null;
  text: string;
  /** 0..100 */
  importance: number;
  /** −100..100 */
  valence: number;
  actorIds: ActorId[];
  placeIds: PlaceId[];
  sourceEventIds: EventId[];
  pattern: string | null;
  templateId: string | null;
  knowledge: KnowledgeBasis;
  /**
   * Who could have known (P1): for 'witnessed'/'heard' entries, the actors whose knowledge
   * the entry draws on. 'public' entries ignore it; 'omniscient' entries have none.
   */
  knownBy?: ActorId[];
  /** The writer of a journal or ledger entry. */
  authorId?: ActorId | null;
  kind?: EntryKind;
  /** Pattern milestone (1, 2, 3...) or 0. */
  level?: number;
  threadId?: number | null;
  /** Coarse subjects for the UI filter: 'feud', 'food', 'faith', 'courtship'... */
  topics?: string[];
  /** Why the Chronicle kept this (notability terms). Omniscient math. */
  explain?: Explain;
}

/** One event as a thread remembers it (small, JSON-able). */
export interface ThreadFact {
  e: number;
  t: number;
  /** Agent / first actor id, 0 if none. */
  a: number;
  /** Target / second actor id, 0 if none. */
  b: number;
  /** 1 if the event was public. */
  pub: 0 | 1;
  /** Who knew, when not public. */
  by: number[];
  /** Detector-defined sub-kind: 'harm', 'help', 'grudge', 'court', 'hostile', 'warm'... */
  k: string;
  /** Detector-defined magnitude (rung, cents, tenths of days, credence). */
  w: number;
  /** 1 if the act succeeded. */
  s: 0 | 1;
  /** Place id, 0 if none. */
  p: number;
  /** Detector-defined short string (defense id, label, predicate). */
  x: string;
}

export interface ChronicleThread {
  id: number;
  pattern: string;
  key: string;
  openedAt: GameMinute;
  lastAt: GameMinute;
  actorIds: number[];
  householdIds: number[];
  facts: ThreadFact[];
  /** Highest level already written per knowledge view. */
  emitted: { pub: number; pc: number; all: number };
  data: Record<string, number>;
  tags: Record<string, string>;
  closed: boolean;
  truthDone: boolean;
  entryIds: number[];
}

/** Food, stores and supply accounting over a span (a week, a year, the run). P8. */
export interface Tally {
  meals: number;
  coldMeals: number;
  kcal: number;
  /** Servings eaten, and Σ fresh × servings, for the fresh share. */
  servings: number;
  freshPoints: number;
  /** Food eaten, by item def: units. */
  foods: Record<string, number>;
  /** Spoiled, by item def: units; and by cause label: count. */
  lost: Record<string, number>;
  lostWhy: Record<string, number>;
  /** Bought, by item def: units. */
  bought: Record<string, number>;
  spentCents: number;
  creditCents: number;
  /** Supplies burned or used (fuel, oil, powder...), by item def: units. */
  consumed: Record<string, number>;
  shortages: number;
  /** Lowest days of food seen (tenths), −1 if no shortage event; lowest ration percent seen. */
  lowestDaysTenths: number;
  lowestRationPct: number;
  /** Nutrition condition events, by condition id. */
  nutrition: Record<string, number>;
  /** Interaction classes seen: harm, help, courtship, gossip... */
  acts: Record<string, number>;
  defenses: number;
  /** Entries written, by voice. */
  entries: Record<string, number>;
}

export interface PriceTrack {
  /** This week: Σ unit price (mills = tenths of a cent) and sample count. */
  sum: number;
  n: number;
  /** Last completed week's average, mills; 0 = none. */
  last: number;
}

export interface ChronicleTallies {
  week: Tally;
  year: Tally;
  total: Tally;
  /** This week's accounting per household id (0 = unattributed). */
  households: Record<number, Tally>;
  prices: Record<string, PriceTrack>;
  /** This week, counting only what the town could see (the public digest reads this). Additive. */
  pubWeek?: Tally;
}

export interface ChronicleState {
  counters: { entry: number; thread: number };
  /** Last event id processed by sifting. */
  cursor: number;
  entries: ChronicleEntry[];
  /** Open pattern threads (partial matches and live stories), in creation order. */
  threads: ChronicleThread[];
  /** The most recent closed threads (facts trimmed). */
  closedThreads: ChronicleThread[];
  /** 0..100 per actor: how much the chronicle has been talking about them lately. */
  notoriety: Record<number, number>;
  /** Cumulative importance of the entries an actor appears in (the cast list). */
  cast: Record<number, number>;
  /** Repeat suppression: key -> game minute last told. */
  recent: Record<string, number>;
  /** Omen caps use day/week indices, independent of timestamp-based repeat cleanup. */
  omenPeriods?: Record<string, number>;
  omenCounts?: Record<string, number>;
  /**
   * Per-charm story memory (fae 1b), kept past `closedThreads` eviction: the pounds the last
   * Truth named, and who kept the charm when its last story closed. Created on first use.
   */
  charmMemo?: Record<number, { truthLb?: number; keeperId?: number }>;
  /** Template id -> variant index last used (variety). */
  variants: Record<string, number>;
  /** Entries written this week, for the fatigue term. */
  weekLoad: { week: number; entries: number; epilogue: number };
  tallies: ChronicleTallies;
  /** Weeks whose digest has been written. */
  lastDigestWeek: number;
}

export function emptyTally(): Tally {
  return {
    meals: 0,
    coldMeals: 0,
    kcal: 0,
    servings: 0,
    freshPoints: 0,
    foods: {},
    lost: {},
    lostWhy: {},
    bought: {},
    spentCents: 0,
    creditCents: 0,
    consumed: {},
    shortages: 0,
    lowestDaysTenths: -1,
    lowestRationPct: 100,
    nutrition: {},
    acts: {},
    defenses: 0,
    entries: {},
  };
}

export function createChronicleState(): ChronicleState {
  return {
    counters: { entry: 0, thread: 0 },
    cursor: 0,
    entries: [],
    threads: [],
    closedThreads: [],
    notoriety: {},
    cast: {},
    recent: {},
    variants: {},
    weekLoad: { week: -1, entries: 0, epilogue: 0 },
    tallies: {
      week: emptyTally(),
      year: emptyTally(),
      total: emptyTally(),
      households: {},
      prices: {},
      pubWeek: emptyTally(),
    },
    lastDigestWeek: -1,
  };
}

/** Fill any field an older saved world lacks (the slice only ever grows). */
export function ensureChronicleState(st: ChronicleState): void {
  const fresh = createChronicleState();
  const rec = st as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(fresh)) {
    if (rec[k] === undefined) rec[k] = v;
  }
  if (st.counters.thread === undefined) st.counters.thread = 0;
  if (st.tallies.pubWeek === undefined) st.tallies.pubWeek = emptyTally();
  if (st.weekLoad.epilogue === undefined) st.weekLoad.epilogue = 0;
}

export function initChronicleState(_world: World, _ctx: InitContext): void {
  // Nothing to seed. Threads open from events; scenario tensions are the Director's.
}
