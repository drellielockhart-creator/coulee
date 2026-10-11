/**
 * Social state: opinions with reasons, memories, relationships (04 §4, §6, §7).
 * OWNER: module:social.
 *
 * Integer scales: affection/respect/trust −100..100, fear 0..100, memory intensity 0..100,
 * salience and confidence 0..1000 (per-mille), obligation in favors and cents.
 * P1/04 §6.2 DECISION: opinions are never set directly — only via reasons (and the
 * memories/beliefs they cite).
 */
import type { RelationshipKind } from '../content.ts';
import type { EventRoleKind } from '../events/base.ts';
import {
  type ActorId,
  type BeliefId,
  type EventId,
  idsOf,
  type MemoryId,
  mustGet,
  type PlaceId,
  type RumorId,
  type Table,
} from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import type { GameMinute } from '../time.ts';
import type { World } from '../world.ts';

export interface OpinionDims {
  affection: number;
  respect: number;
  trust: number;
  fear: number;
}

export type ReasonCite =
  | { kind: 'memory'; id: MemoryId }
  | { kind: 'belief'; id: BeliefId }
  | { kind: 'relationship'; rel: RelationshipKind }
  | { kind: 'seed' };

export interface OpinionReason {
  /** "Dunned him in front of customers" */
  label: string;
  cites: ReasonCite;
  delta: OpinionDims;
  since: GameMinute;
}

export interface Opinion {
  targetId: ActorId;
  /** Compatibility + kin + group priors (04 §6.2 base). */
  base: OpinionDims;
  /** Capped list (04: 8 + "other" bucket). */
  reasons: OpinionReason[];
  /** Short-term, fast-decaying (today's spat). */
  volatile: OpinionDims;
  /** Ledger: positive = target owes holder. */
  obligation: { favors: number; cents: number };
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
  salience: number;
  confidence: number;
  rehearsals: number;
  /** PC-observed: never silently rewritten (04 §4.4). */
  pinned: boolean;
  /** One-line gist for UI/chronicle: "Gussie Pratt dunned me at the store". */
  summary: string;
}

export interface Relationship {
  a: ActorId;
  b: ActorId;
  /** Directed kinds read "a is <kind> of b" (parent, employer, creditor, patron, lodger). */
  kind: RelationshipKind;
  since: GameMinute;
  amountCents: number | null;
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
}

export function createSocialState(): SocialState {
  return { counters: { memory: 0 }, opinions: {}, memories: {}, memoriesByOwner: {}, relationships: [] };
}

export const ZERO_DIMS: OpinionDims = { affection: 0, respect: 0, trust: 0, fear: 0 };

export function emptyOpinion(targetId: ActorId): Opinion {
  return {
    targetId,
    base: { ...ZERO_DIMS },
    reasons: [],
    volatile: { ...ZERO_DIMS },
    obligation: { favors: 0, cents: 0 },
  };
}

/** Seed relationships and opinion reasons from the scenario. */
export function initSocialState(world: World, ctx: InitContext): void {
  const key = (k: string) => world.index.actorByKey[k];
  for (const id of idsOf<ActorId>(world.actors)) {
    mustGet(world.actors, id, 'actor');
    world.social.opinions[id] = {};
    world.social.memoriesByOwner[id] = [];
  }
  for (const r of ctx.scenario.relationships) {
    const a = key(r.a);
    const b = key(r.b);
    if (a === undefined || b === undefined) continue;
    world.social.relationships.push({ a, b, kind: r.kind, since: ctx.now, amountCents: r.amount_cents ?? null });
  }
  for (const o of ctx.scenario.opinions) {
    const from = key(o.from);
    const to = key(o.to);
    if (from === undefined || to === undefined) continue;
    const table = world.social.opinions[from] ?? {};
    const op = table[to] ?? emptyOpinion(to);
    op.reasons.push({
      label: o.reason,
      cites: { kind: 'seed' },
      delta: { affection: o.affection, respect: o.respect, trust: o.trust, fear: o.fear },
      since: ctx.now,
    });
    table[to] = op;
    world.social.opinions[from] = table;
  }
}
