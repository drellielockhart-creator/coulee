import { hashValue } from '../hash.ts';
import { type ActorId, type MemoryId, rowsOf } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import { addMemory, decayMemorySnapshot, memoryDecayPolicy } from '../social/api.ts';
import type { MemoryInput } from '../social/state.ts';
import type { World } from '../world.ts';
import { ensureCensus } from './census.ts';
import { settleDailySites } from './coarse.ts';
import { settleDormantSites, wakeDormantSite } from './dormant.ts';
import { actorSite } from './processing.ts';

/** The producer supplies an already-perceived, resolved cause snapshot and a stable cause key.
 * Never call this merely because an event occurred at a distant site. No event lookup is needed. */
export function recordCensusEvidence(world: World, key: string, memory: MemoryInput): boolean {
  if (!world.region || (!world.actors[memory.ownerId] && !world.region.census?.members[memory.ownerId])) return false;
  if (!key || memory.at > world.time) throw new Error('Census evidence needs a committed cause');
  const existing = world.region.census?.evidence.find((e) => e.key === key && e.memory.ownerId === memory.ownerId);
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
  const census = ensureCensus(world);
  if (!census?.members[memory.ownerId]) return false;
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

/** A producer calls this after resolving perception and the day's mind upkeep. The snapshot
 * starts at the current day, not the historical event date (a newly told old story is fresh).
 * The legacy evidence API remains unchanged for existing callers and saves. */
export function recordCoarseCensusEvidence(world: World, ctx: SimContext, key: string, memory: MemoryInput): boolean {
  if (ctx.now !== world.time) throw new Error('Coarse evidence requires the committed producer time');
  const recorded = recordCensusEvidence(world, key, memory);
  if (!recorded) return false;
  const evidence = world.region?.census?.evidence.find((e) => e.key === key && e.memory.ownerId === memory.ownerId);
  if (evidence)
    evidence.decay = {
      policy: memoryDecayPolicy(world, ctx.content, memory),
      throughDay: ctx.cal.dayIndex,
      salience: Math.max(0, Math.min(1000, memory.salience)),
      forgottenAt: null,
    };
  return true;
}

/** At a completed-hour boundary, today's midnight upkeep has run only AFTER 00:00.
 * A promotion at exactly midnight leaves that day's decay to the ordinary social executor.
 * Settled memories are never aged here again: exactly one decay owner for each day. */
export function decayCensusEvidence(world: World, through = world.time): void {
  if (world.tactical?.frame && world.tactical.frame.phase !== 'settled') return;
  const completedDay = Math.ceil(through / 1440) - 1;
  for (const evidence of world.region?.census?.evidence ?? []) {
    const decay = evidence.decay;
    if (!decay || evidence.hydratedMemoryId !== null || decay.forgottenAt !== null) continue;
    while (decay.throughDay < completedDay) {
      decay.throughDay++;
      const salience = decayMemorySnapshot(decay.salience, evidence.memory.pinned, decay.policy);
      if (salience === null) {
        decay.forgottenAt = decay.throughDay * 1440;
        break;
      }
      decay.salience = salience;
    }
  }
}

/** Ordered, exactly-once hydration through the mind owner's API. Applied receipts outlive log eviction. */
export function hydrateCensusEvidence(world: World, ctx: SimContext, actorId?: ActorId): MemoryId[] {
  if (world.tactical?.frame && world.tactical.frame.phase !== 'settled') return [];
  decayCensusEvidence(world, ctx.now);
  const out: MemoryId[] = [];
  for (const evidence of world.region?.census?.evidence ?? []) {
    if (evidence.hydratedMemoryId !== null || (actorId !== undefined && evidence.memory.ownerId !== actorId)) continue;
    if (evidence.decay?.forgottenAt != null) continue;
    const id = addMemory(world, ctx, {
      ...evidence.memory,
      ...(evidence.decay ? { salience: evidence.decay.salience } : {}),
    });
    if (id !== null) {
      evidence.hydratedMemoryId = id;
      out.push(id);
    }
  }
  return out;
}

/** A visit reuses the full sheet. It cannot reconstruct stocks, settle a debt twice, or revive the dead. */
export function promoteCensusActor(world: World, ctx: SimContext, actorId: ActorId) {
  if (world.tactical?.frame && world.tactical.frame.phase !== 'settled') return world.actors[actorId] ?? null;
  settleDormantSites(world, ctx, true);
  wakeDormantSite(world, ctx, actorSite(world, actorId));
  settleDailySites(world, ctx);
  const census = ensureCensus(world);
  const member = census?.members[actorId];
  const actor = world.actors[actorId];
  if (!member || !actor) return null; // Unmaterialized generation belongs to foundation's future adapter.
  if (!member.alive && actor.alive) throw new Error('Census death contradicts materialized actor');
  hydrateCensusEvidence(world, ctx, actorId);
  const tier = world.region?.lod?.actors[actorId];
  if (tier) {
    // Contact promotes the whole shared site after its unfinished interval is settled.
    const site = world.places[world.households[actor.householdId]?.homePlaceId ?? 0]?.siteId;
    if (site && world.region?.processing?.sites) {
      delete world.region.processing.sites[site];
      for (const other of rowsOf(world.actors)) {
        if (world.places[world.households[other.householdId]?.homePlaceId ?? 0]?.siteId !== site) continue;
        const row = world.region.lod?.actors[other.id];
        if (row?.processing === 'T2') row.processing = 'T1';
      }
    }
    tier.processing = tier.selected === 'T0' || tier.processing === 'T0' ? 'T0' : 'T1';
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
