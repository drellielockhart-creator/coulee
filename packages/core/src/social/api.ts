/**
 * Social cross-module API. OWNER: module:social.
 */
import type { ActorId, MemoryId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import type { Memory, OpinionDims, OpinionReason, Relationship } from './state.ts';
import { emptyOpinion, ZERO_DIMS } from './state.ts';

const clampDims = (d: OpinionDims): OpinionDims => ({
  affection: Math.max(-100, Math.min(100, d.affection)),
  respect: Math.max(-100, Math.min(100, d.respect)),
  trust: Math.max(-100, Math.min(100, d.trust)),
  fear: Math.max(0, Math.min(100, d.fear)),
});

/**
 * Current opinion of `from` toward `to`: base + Σ reasons (weighted by cited memory
 * salience / belief credence — STUB weights all reasons fully) + volatile, clamped.
 */
export function opinionOf(world: World, from: ActorId, to: ActorId): OpinionDims {
  const op = world.social.opinions[from]?.[to];
  if (!op) return { ...ZERO_DIMS };
  const sum = { ...op.base };
  for (const r of op.reasons) {
    sum.affection += r.delta.affection;
    sum.respect += r.delta.respect;
    sum.trust += r.delta.trust;
    sum.fear += r.delta.fear;
  }
  sum.affection += op.volatile.affection;
  sum.respect += op.volatile.respect;
  sum.trust += op.volatile.trust;
  sum.fear += op.volatile.fear;
  return clampDims(sum);
}

/** Add a reason (the only way opinions change, 04 §6.2). */
export function addOpinionReason(
  world: World,
  _ctx: SimContext,
  from: ActorId,
  to: ActorId,
  reason: OpinionReason,
): void {
  const table = world.social.opinions[from] ?? {};
  const op = table[to] ?? emptyOpinion(to);
  op.reasons.push(reason);
  table[to] = op;
  world.social.opinions[from] = table;
}

/** Encode a memory for an actor (perception, being told, etc.). STUB returns null. */
export function addMemory(_world: World, _ctx: SimContext, _memory: Omit<Memory, 'id'>): MemoryId | null {
  return null; // STUB
}

export function memoriesOf(world: World, actorId: ActorId): Memory[] {
  const ids = world.social.memoriesByOwner[actorId] ?? [];
  const out: Memory[] = [];
  for (const id of ids) {
    const m = world.social.memories[id];
    if (m) out.push(m);
  }
  return out;
}

export function relationshipsOf(world: World, actorId: ActorId): Relationship[] {
  return world.social.relationships.filter((r) => r.a === actorId || r.b === actorId);
}

const KIN: ReadonlySet<string> = new Set(['parent', 'sibling', 'spouse', 'cousin', 'in_law', 'betrothed']);
export function areKin(world: World, a: ActorId, b: ActorId): boolean {
  return world.social.relationships.some(
    (r) => KIN.has(r.kind) && ((r.a === a && r.b === b) || (r.a === b && r.b === a)),
  );
}

/** Derived label (04 §6.1): Friend, Enemy, Rival, Cowed, Admirer, or '' — labels on numbers. */
export function opinionLabel(d: OpinionDims): string {
  if (d.affection > 40 && d.trust > 20) return 'Friend';
  if (d.affection < -40) return 'Enemy';
  if (d.fear > 50 && d.affection < 0) return 'Cowed';
  if (d.respect > 20 && d.affection < -20) return 'Rival';
  if (d.respect > 50) return 'Admirer';
  return '';
}

/** Urges to seek company / confront / avoid (proposed to psyche each hour). */
export function proposeSocialUrges(_world: World, _ctx: SimContext, _actorId: ActorId): UrgeProposal[] {
  return []; // STUB
}
