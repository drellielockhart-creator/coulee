/**
 * Social state: opinions with reasons, memories, relationships (04 §4, §6, §7).
 * OWNER: module:social.
 *
 * Integer scales: affection/respect/trust −100..100, fear 0..100, memory intensity 0..100,
 * salience and confidence 0..1000 (per-mille), familiarity 0..1000, obligation in favors
 * and cents.
 * P1/04 §6.2 DECISION: opinions are never set directly — only via reasons (and the
 * memories/beliefs they cite). `base` is derived (compatibility + structural priors) and
 * is only ever recomputed, never edited.
 */
import type { DefenseId, RelationshipKind } from '../content.ts';
import type { EventRoleKind } from '../events/base.ts';
import type { ActorId, BeliefId, EventId, MemoryId, PlaceId, PropId, RumorId, Table } from '../ids.ts';
import type { GameMinute } from '../time.ts';

export { initSocialState } from './init.ts';
export { emptyOpinion, ZERO_DIMS } from './model.ts';

export interface OpinionDims {
  affection: number;
  respect: number;
  trust: number;
  fear: number;
}

export type ReasonCite =
  | { kind: 'memory'; id: MemoryId }
  /** `propId` lets social weight the reason by the holder's credence via belief/api. */
  | { kind: 'belief'; id: BeliefId; propId?: PropId }
  | { kind: 'relationship'; rel: RelationshipKind }
  | { kind: 'seed' }
  /**
   * A reason a psyche defense manufactured (rationalization's "had it coming"), citing the
   * `psyche.defense` event. Its strength (per mille) fades daily like the "other" bucket.
   */
  | { kind: 'defense'; eventId: EventId; strength: number }
  /**
   * The folded "other reasons" bucket (04 §6.2: cap 8 + other). `strength` is per mille and
   * decays daily with `bucket_tau_days`; the bucket's weight is that strength.
   */
  | { kind: 'other'; strength: number };

export interface OpinionReason {
  /** "Dunned him in front of customers" */
  label: string;
  cites: ReasonCite;
  delta: OpinionDims;
  since: GameMinute;
  /** Set when a psyche defense created this reason (04 §6.2 viaDefense; omniscient provenance). */
  viaDefense?: DefenseId;
}

export interface Opinion {
  targetId: ActorId;
  /** Compatibility + kin + household priors (04 §3.1, §6.2, §7.1). Derived; recomputed. */
  base: OpinionDims;
  /** Capped list (04: 8 + "other" bucket). */
  reasons: OpinionReason[];
  /** Short-term, fast-decaying (today's spat). */
  volatile: OpinionDims;
  /** Ledger: positive = target owes holder. Mirrored on the target's record. */
  obligation: { favors: number; cents: number };
  /** 0..1000: how well the holder knows the target (encounters raise it, absence lowers it). */
  familiarity: number;
  /** Interaction id -> game minute before which the holder will not repeat it at the target. */
  cooldowns: Record<string, number>;
  /** Last derived label ('Friend', 'Enemy'...), for `social.label_changed`. */
  label: string;
  /**
   * Game minutes of recent hostile acts between the pair, either direction (strife.ts:
   * weariness and rupture windows). Mirrored on both records; absent until the first.
   */
  strife?: number[];
  /** Game minutes of recent fights between the pair (subset of `strife`). */
  fights?: number[];
}

export type MemorySource =
  | { kind: 'witnessed' }
  | { kind: 'overheard' }
  | { kind: 'told'; by: ActorId; rumorId: RumorId | null }
  | { kind: 'inferred' }
  | { kind: 'dreamt' };

export interface Memory {
  id: MemoryId;
  ownerId: ActorId;
  /** Ground-truth event, or null for confabulations / lies received. */
  eventId: EventId | null;
  /** MEMORY_KINDS from the interactions schema ('insult', 'help', 'misfortune'...). */
  kind: string;
  at: GameMinute;
  placeId: PlaceId | null;
  roles: Array<{ who: ActorId; role: EventRoleKind; conf: number }>;
  source: MemorySource;
  emotion: string;
  intensity: number;
  /** Current salience 0..1000 (decayed daily, 04 §4.3). */
  salience: number;
  confidence: number;
  rehearsals: number;
  /** PC-observed: never silently rewritten (04 §4.4). */
  pinned: boolean;
  /** One-line gist for UI/chronicle: "Gussie Pratt dunned me at the store". */
  summary: string;
  /** The other party the memory is about (the doer, or whom the owner did it to), or null. */
  aboutId: ActorId | null;
  /** True if the owner was the doer ("I insulted him"), false if done to/seen by the owner. */
  did: boolean;
  /** Instances folded into this memory (1, or more for a consolidated Summary memory). */
  count: number;
  /** Earliest instance (== at unless consolidated). */
  since: GameMinute;
}

/**
 * What callers pass to `addMemory`. The social-only bookkeeping fields are optional: when
 * absent they are derived from `roles` (aboutId = first other actor; did = owner is agent).
 */
export type MemoryInput = Omit<Memory, 'id' | 'aboutId' | 'did' | 'count' | 'since'> &
  Partial<Pick<Memory, 'aboutId' | 'did' | 'count' | 'since'>>;

export interface Relationship {
  a: ActorId;
  b: ActorId;
  /** Directed kinds read "a is <kind> of b" (parent, employer, creditor, patron, lodger). */
  kind: RelationshipKind;
  since: GameMinute;
  amountCents: number | null;
}

/** Per-day tallies for stats.csv (reset at 00:00). */
export interface SocialDaily {
  interactions: number;
  checks: number;
  gossip: number;
  told: number;
  hostile: number;
  defenses: number;
  /** Candidate evaluations by the encounter sampler (complexity counter, 04 §13.2). */
  encounterWork: number;
}

export interface SocialState {
  counters: { memory: number };
  /** opinions[holder][target] */
  opinions: Table<ActorId, Table<ActorId, Opinion>>;
  memories: Table<MemoryId, Memory>;
  /** Owner -> memory ids, oldest first. */
  memoriesByOwner: Table<ActorId, MemoryId[]>;
  /** Insertion order. */
  relationships: Relationship[];
  daily: SocialDaily;
  /** Run totals (interactions resolved, sampler work), for tests and stats. */
  totals: { interactions: number; encounterWork: number };
  /**
   * Talk lines said between each pair this week ("a-b" with a < b -> line id -> game minute)
   * and in each room these few hours ("p<placeId>"), so a pair does not hear the same words twice
   * in seven days, nor a room the same joke twice in an evening (talk.ts). Absent until the first.
   */
  talk?: Record<string, Record<string, number>>;
}

export function emptyDaily(): SocialDaily {
  return { interactions: 0, checks: 0, gossip: 0, told: 0, hostile: 0, defenses: 0, encounterWork: 0 };
}

export function createSocialState(): SocialState {
  return {
    counters: { memory: 0 },
    opinions: {},
    memories: {},
    memoriesByOwner: {},
    relationships: [],
    daily: emptyDaily(),
    totals: { interactions: 0, encounterWork: 0 },
  };
}
