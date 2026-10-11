/**
 * Episodic memory (04 §4): encoding, daily decay, forgetting, weekly consolidation.
 * OWNER: module:social.
 *
 * Salience is integer 0..1000. Decay is a daily fixed-point step that approximates
 * s·e^(−1/τ) with the (2τ−1)/(2τ+1) Padé ratio (no `exp`), floored, and never below the
 * kind's floor (scaled by intensity). τ in days follows 04 §4.3 with the owner's Rancor
 * (negative memories) or Neighborliness (positive memories) view.
 */
import { shortName } from '../actor.ts';
import type { ContentBundle } from '../content.ts';
import { type ActorId, asMemoryId, type MemoryId, nextId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import { calendarAt, type GameMinute, ordinal } from '../time.ts';
import type { World } from '../world.ts';
import { clampInt, floorDiv } from './model.ts';
import type { Memory, MemoryInput } from './state.ts';
import { memoryKindOf, tuningOf, valueView } from './tuning.ts';

/** Encoding salience s0 = base + per_intensity × intensity (04 §4.2-4.3), 0..1000. */
export function encodeSalience(content: ContentBundle, intensity: number): number {
  const t = tuningOf(content);
  return clampInt(t.salience_base + t.salience_per_intensity * clampInt(intensity, 0, 100), 0, 1000);
}

/** τ in days for one memory (04 §4.3 integer forms), at least 1. */
export function memoryTauDays(world: World, content: ContentBundle, m: Memory): number {
  const kind = memoryKindOf(content, m.kind);
  const owner = world.actors[m.ownerId];
  const i = clampInt(m.intensity, 0, 100);
  let tau: number;
  if (kind.valence === 'negative') {
    const r = owner ? valueView(owner, 'rancor') : 0;
    tau = floorDiv(kind.tau_days * (50 + i) * (4 + r), 200);
  } else if (kind.valence === 'positive') {
    const n = owner ? valueView(owner, 'neighborliness') : 0;
    tau = floorDiv(kind.tau_days * (50 + i) * (20 + 3 * n), 1000);
  } else {
    tau = floorDiv(kind.tau_days * (50 + i), 50);
  }
  return Math.max(1, tau);
}

/** Salience floor: the kind's floor at intensity 100, scaled by intensity. */
export function memoryFloor(content: ContentBundle, m: Memory): number {
  return floorDiv(memoryKindOf(content, m.kind).floor * clampInt(m.intensity, 0, 100), 100);
}

/** One day of decay for a salience value. */
export function decayOneDay(salience: number, tauDays: number, floor: number): number {
  const s = floorDiv(salience * (2 * tauDays - 1), 2 * tauDays + 1);
  return Math.max(floor, Math.min(salience, s));
}

export function isNegativeKind(content: ContentBundle, kind: string): boolean {
  return memoryKindOf(content, kind).valence === 'negative';
}

/**
 * Store a memory. Derives `aboutId`/`did` from roles when absent, clamps numbers, evicts the
 * weakest unpinned memory past `max_memories`. Returns the new id.
 */
export function insertMemory(world: World, ctx: Pick<SimContext, 'content' | 'emit'>, input: MemoryInput): MemoryId {
  const owner = input.ownerId;
  const others = input.roles.filter((r) => r.who !== owner);
  const mine = input.roles.find((r) => r.who === owner);
  const id = asMemoryId(nextId(world.social.counters, 'memory'));
  const m: Memory = {
    id,
    ownerId: owner,
    eventId: input.eventId,
    kind: input.kind,
    at: input.at,
    placeId: input.placeId,
    roles: input.roles.map((r) => ({ who: r.who, role: r.role, conf: clampInt(Math.round(r.conf), 0, 100) })),
    source: input.source,
    emotion: input.emotion,
    intensity: clampInt(Math.round(input.intensity), 0, 100),
    salience: clampInt(Math.round(input.salience), 0, 1000),
    confidence: clampInt(Math.round(input.confidence), 0, 1000),
    rehearsals: Math.max(0, Math.round(input.rehearsals)),
    pinned: input.pinned,
    summary: input.summary,
    aboutId: input.aboutId !== undefined ? input.aboutId : (others[0]?.who ?? null),
    did: input.did ?? (mine !== undefined && (mine.role === 'agent' || mine.role === 'speaker')),
    count: Math.max(1, Math.round(input.count ?? 1)),
    since: input.since ?? input.at,
  };
  world.social.memories[id] = m;
  const list = world.social.memoriesByOwner[owner] ?? [];
  list.push(id);
  world.social.memoriesByOwner[owner] = list;
  enforceMemoryCap(world, ctx.content, owner);
  if (m.intensity >= 60 && world.social.memories[id]) {
    ctx.emit({
      kind: 'social.memory_formed',
      roles: [{ actor: owner, role: 'subject' }],
      visibility: 'inner',
      ...(m.placeId !== null ? { place: m.placeId } : {}),
      ...(m.eventId !== null ? { causes: [m.eventId] } : {}),
      data: { ownerId: owner, memoryId: id, kind: m.kind, intensity: m.intensity },
    });
  }
  return id;
}

function removeMemory(world: World, id: MemoryId): void {
  const m = world.social.memories[id];
  if (!m) return;
  delete world.social.memories[id];
  const list = world.social.memoriesByOwner[m.ownerId];
  if (list) {
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
  }
}

function enforceMemoryCap(world: World, content: ContentBundle, owner: ActorId): void {
  const cap = tuningOf(content).max_memories;
  const list = world.social.memoriesByOwner[owner] ?? [];
  while (list.length > cap) {
    let worst: Memory | null = null;
    for (const id of list) {
      const m = world.social.memories[id];
      if (!m || m.pinned) continue;
      if (worst === null || m.salience < worst.salience || (m.salience === worst.salience && m.id < worst.id))
        worst = m;
    }
    if (!worst) break;
    removeMemory(world, worst.id);
  }
}

/** Memories of `owner` (oldest first). */
export function ownerMemories(world: World, owner: ActorId): Memory[] {
  const out: Memory[] = [];
  for (const id of world.social.memoriesByOwner[owner] ?? []) {
    const m = world.social.memories[id];
    if (m) out.push(m);
  }
  return out;
}

/** What `owner` remembers about `other`, digested for volition drivers (one scan). */
export interface MemoryDigest {
  /** kind -> max salience of memories of `other` doing it (to the owner or seen). */
  done: Record<string, number>;
  /** kind -> max salience of memories of the owner doing it to `other`. */
  did: Record<string, number>;
  /** Remembered wrongs: the worst negative memory's salience + a quarter of the rest. */
  negative: number;
}

export function memoryDigest(world: World, content: ContentBundle, owner: ActorId, other: ActorId): MemoryDigest {
  const d: MemoryDigest = { done: {}, did: {}, negative: 0 };
  let worst = 0;
  let total = 0;
  for (const id of world.social.memoriesByOwner[owner] ?? []) {
    const m = world.social.memories[id];
    if (!m || m.aboutId !== other) continue;
    const bucket = m.did ? d.did : d.done;
    if ((bucket[m.kind] ?? 0) < m.salience) bucket[m.kind] = m.salience;
    if (!m.did && isNegativeKind(content, m.kind)) {
      total += m.salience;
      if (m.salience > worst) worst = m.salience;
    }
  }
  d.negative = worst + floorDiv(total - worst, 4);
  return d;
}

/** All targets in one owner scan; valid only until memories change. */
export function memoryDigests(world: World, content: ContentBundle, owner: ActorId): Map<ActorId, MemoryDigest> {
  const buckets = new Map<ActorId, { digest: MemoryDigest; worst: number; total: number }>();
  for (const id of world.social.memoriesByOwner[owner] ?? []) {
    const m = world.social.memories[id];
    if (!m || m.aboutId === null) continue;
    let b = buckets.get(m.aboutId);
    if (!b) {
      b = { digest: { done: {}, did: {}, negative: 0 }, worst: 0, total: 0 };
      buckets.set(m.aboutId, b);
    }
    const kinds = m.did ? b.digest.did : b.digest.done;
    if ((kinds[m.kind] ?? 0) < m.salience) kinds[m.kind] = m.salience;
    if (!m.did && isNegativeKind(content, m.kind)) {
      b.total += m.salience;
      b.worst = Math.max(b.worst, m.salience);
    }
  }
  const out = new Map<ActorId, MemoryDigest>();
  for (const [id, b] of buckets) {
    b.digest.negative = b.worst + floorDiv(b.total - b.worst, 4);
    out.set(id, b.digest);
  }
  return out;
}

/**
 * Lower the salience of `owner`'s negative memories of `about` doing things by `pct`
 * (apology, forgiveness: 04 §6.2 — amends act on memories, so cited Reasons weaken).
 */
export function softenMemories(
  world: World,
  content: ContentBundle,
  owner: ActorId,
  about: ActorId,
  pct: number,
): number {
  if (pct <= 0) return 0;
  let n = 0;
  for (const id of world.social.memoriesByOwner[owner] ?? []) {
    const m = world.social.memories[id];
    if (!m || m.aboutId !== about || m.did || m.pinned) continue;
    if (!isNegativeKind(content, m.kind)) continue;
    const floor = memoryFloor(content, m);
    m.salience = Math.max(floor, m.salience - floorDiv(m.salience * clampInt(pct, 0, 100), 100));
    n++;
  }
  return n;
}

/** Daily decay and forgetting for every owner (ascending ids). Returns forgotten ids. */
export function decayMemoriesDaily(world: World, content: ContentBundle): MemoryId[] {
  const t = tuningOf(content);
  const forgotten: MemoryId[] = [];
  const owners = Object.keys(world.social.memoriesByOwner)
    .map(Number)
    .sort((a, b) => a - b);
  for (const owner of owners) {
    const list = world.social.memoriesByOwner[owner] ?? [];
    for (const id of [...list]) {
      const m = world.social.memories[id];
      if (!m) continue;
      const floor = memoryFloor(content, m);
      m.salience = decayOneDay(m.salience, memoryTauDays(world, content, m), floor);
      // A memory held up by its floor (a dead child) is never forgotten.
      if (!m.pinned && m.salience < t.forget_below && floor < t.forget_below) {
        removeMemory(world, id);
        forgotten.push(id);
      }
    }
  }
  return forgotten;
}

export interface ConsolidationMerge {
  ownerId: ActorId;
  aboutId: ActorId | null;
  into: MemoryId;
  merged: MemoryId[];
}

function sinceText(t: GameMinute): string {
  const c = calendarAt(t);
  return `the ${ordinal(c.day)} of ${c.monthName}`;
}

/**
 * Weekly consolidation (04 §4.3): an owner's faded memories (salience < consolidate_below)
 * of one kind about one other party, done in one direction, merge into a Summary memory.
 * The most salient instance survives and becomes the summary. Returns the merges so the
 * opinion side can re-point the Reasons that cited the merged memories.
 */
export function consolidateMemories(world: World, content: ContentBundle): ConsolidationMerge[] {
  const t = tuningOf(content);
  const out: ConsolidationMerge[] = [];
  const owners = Object.keys(world.social.memoriesByOwner)
    .map(Number)
    .sort((a, b) => a - b) as ActorId[];
  for (const owner of owners) {
    const groups = new Map<string, Memory[]>();
    const keys: string[] = [];
    for (const m of ownerMemories(world, owner)) {
      if (m.pinned || m.salience >= t.consolidate_below || m.aboutId === null) continue;
      if (!memoryKindOf(content, m.kind).consolidate) continue;
      const key = `${m.kind}|${m.aboutId}|${m.did ? 1 : 0}`;
      const g = groups.get(key);
      if (g) g.push(m);
      else {
        groups.set(key, [m]);
        keys.push(key);
      }
    }
    for (const key of keys) {
      const g = groups.get(key) ?? [];
      if (g.length < 2) continue;
      // Survivor: most salient, then highest intensity, then oldest id (total order).
      const sorted = [...g].sort(
        (a, b) => b.salience - a.salience || b.intensity - a.intensity || (a.id as number) - (b.id as number),
      );
      const keep = sorted[0] as Memory;
      const rest = sorted.slice(1);
      let count = keep.count;
      let since = keep.since;
      for (const m of rest) {
        count += m.count;
        if (m.since < since) since = m.since;
      }
      const other = keep.aboutId !== null ? world.actors[keep.aboutId] : undefined;
      const tpl = memoryKindOf(content, keep.kind).summary;
      keep.summary = tpl
        .replaceAll('{other}', other ? shortName(other) : 'someone')
        .replaceAll('{count}', String(count))
        .replaceAll('{since}', sinceText(since));
      keep.count = count;
      keep.since = since;
      keep.salience = Math.min(1000, keep.salience + 20 * rest.length);
      keep.rehearsals += rest.length;
      for (const m of rest) removeMemory(world, m.id);
      out.push({ ownerId: owner, aboutId: keep.aboutId, into: keep.id, merged: rest.map((m) => m.id) });
    }
  }
  return out;
}
