import { hashValue } from '../hash.ts';
import type { ActorId, MemoryId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import { addMemory } from '../social/api.ts';
import type { MemoryInput } from '../social/state.ts';
import type { World } from '../world.ts';
import { ensureCensus } from './census.ts';

/** The producer supplies an already-perceived, resolved cause snapshot and a stable cause key.
 * Never call this merely because an event occurred at a distant site. No event lookup is needed. */
export function recordCensusEvidence(world: World, key: string, memory: MemoryInput): boolean {
  const census = ensureCensus(world);
  if (!census?.members[memory.ownerId]) return false;
  if (!key || memory.at > world.time) throw new Error('Census evidence needs a committed cause');
  const existing = census.evidence.find((e) => e.key === key && e.memory.ownerId === memory.ownerId);
  if (existing) {
    if (hashValue(existing.memory) !== hashValue(memory)) throw new Error('Conflicting census evidence key');
    return false;
  }
  // This boundary accepts resolved integer snapshots, not unrounded summary calculations.
  for (const n of [
    memory.at,
    memory.intensity,
    memory.salience,
    memory.confidence,
    memory.rehearsals,
    ...memory.roles.map((r) => r.conf),
    ...(memory.count === undefined ? [] : [memory.count]),
    ...(memory.since === undefined ? [] : [memory.since]),
  ])
    if (!Number.isSafeInteger(n) || Object.is(n, -0)) throw new Error('Non-integer census evidence');
  census.evidence.push({
    key,
    memory: { ...memory, source: { ...memory.source }, roles: memory.roles.map((r) => ({ ...r })) },
    hydratedMemoryId: null,
  });
  census.evidence.sort(
    (a, b) =>
      a.memory.at - b.memory.at || a.memory.ownerId - b.memory.ownerId || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  return true;
}

/** Ordered, exactly-once hydration through the mind owner's API. Applied receipts outlive log eviction. */
export function hydrateCensusEvidence(world: World, ctx: SimContext, actorId?: ActorId): MemoryId[] {
  const out: MemoryId[] = [];
  for (const evidence of world.region?.census?.evidence ?? []) {
    if (evidence.hydratedMemoryId !== null || (actorId !== undefined && evidence.memory.ownerId !== actorId)) continue;
    const id = addMemory(world, ctx, evidence.memory);
    if (id !== null) {
      evidence.hydratedMemoryId = id;
      out.push(id);
    }
  }
  return out;
}

/** A visit reuses the full sheet. It cannot reconstruct stocks, settle a debt twice, or revive the dead. */
export function promoteCensusActor(world: World, ctx: SimContext, actorId: ActorId) {
  const census = ensureCensus(world);
  const member = census?.members[actorId];
  const actor = world.actors[actorId];
  if (!member || !actor) return null; // Unmaterialized generation belongs to foundation's future adapter.
  if (!member.alive && actor.alive) throw new Error('Census death contradicts materialized actor');
  hydrateCensusEvidence(world, ctx, actorId);
  const tier = world.region?.lod?.actors[actorId];
  if (tier) {
    tier.selected = tier.processing;
    tier.belowSince = null;
    if (!tier.reasons.includes('contact')) tier.reasons.push('contact');
  }
  return actor;
}

/** Owning witness/god only: census truth is never a remote-map report. Returns detached data. */
export function censusEvidenceView(world: World, actorId: ActorId, perspective: ActorId, omniscient = false) {
  if (actorId !== perspective && !omniscient) return [];
  return (world.region?.census?.evidence ?? [])
    .filter((e) => e.memory.ownerId === actorId)
    .map((e) => ({ key: e.key, at: e.memory.at, summary: e.memory.summary, source: { ...e.memory.source } }));
}
