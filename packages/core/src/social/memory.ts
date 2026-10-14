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
import { processesActor } from '../region/processing.ts';
import type { SimContext } from '../sim/context.ts';
import { calendarAt, type GameMinute, ordinal } from '../time.ts';
import type { World } from '../world.ts';
import { clampInt, floorDiv } from './model.ts';
import type { Memory, MemoryInput } from './state.ts';
import { memoryKindOf, tuningOf, valueView } from './tuning.ts';

// ---------------------------------------------------------------------------------------------
// The single write path. `Memory` rows, `social.memories` and `social.memoriesByOwner` are
// readonly to every other file (state.ts types; packages/cli/test/memory-digests.test.ts rejects
// casts and table writes outside this file). Every change to an owner's memories goes through
// the functions below, which keep that owner's cached digests equal to the full scan:
//   - a new row is folded in (max per kind, negative total and worst: all monotone);
//   - a removed row below its kind's max (and below the worst) is folded out exactly; one at a
//     max re-scans just that (owner, about) pair; a pair with no rows left is dropped;
//   - any salience change (decay, softening, consolidation, backstory) drops the owner's cache.
// ---------------------------------------------------------------------------------------------

type Writable<T> = { -readonly [K in keyof T]: T[K] };
type MemoryTable = World['social']['memories'];

/** A memory row opened for writing a field the digests read: drops the owner's cached digests. */
function writable(world: World, m: Memory): Writable<Memory> {
  touch(world, m.ownerId);
  return m as Writable<Memory>;
}
function rowsTable(world: World): Record<number, Memory> {
  return world.social.memories as Record<number, Memory>;
}
function ownerList(world: World, owner: ActorId): MemoryId[] | undefined {
  return world.social.memoriesByOwner[owner] as MemoryId[] | undefined;
}

/** Per (owner, about): rows counted, and the negative total and worst behind `negative`. */
interface PairStat {
  n: number;
  worst: number;
  total: number;
}
interface OwnerDigests {
  digests: Map<ActorId, MemoryDigest>;
  stats: Map<ActorId, PairStat>;
}
/**
 * Derived digests per owner (never saved, never world state), keyed by the memories table so a
 * loaded, forked or cloned world never sees another world's cache; owner-local facades that
 * share the table (dormant upkeep) share its cache too. Content is checked by identity.
 */
interface DigestCache {
  content: ContentBundle;
  byOwner: Map<ActorId, OwnerDigests>;
}
const digestCaches = new Map<MemoryTable, DigestCache>();

function touch(world: World, owner: ActorId): void {
  digestCaches.get(world.social.memories)?.byOwner.delete(owner);
}

const withNegative = (d: MemoryDigest, st: PairStat): MemoryDigest => {
  d.negative = st.worst + floorDiv(st.total - st.worst, 4);
  return d;
};

/** Fold a new row into its owner's cached digests (copy-on-write: readers keep their snapshot). */
function digestInserted(world: World, m: Memory): void {
  const cache = digestCaches.get(world.social.memories);
  const od = cache?.byOwner.get(m.ownerId);
  if (!cache || !od || m.aboutId === null) return;
  const old = od.digests.get(m.aboutId);
  const st = od.stats.get(m.aboutId) ?? { n: 0, worst: 0, total: 0 };
  const d: MemoryDigest = old
    ? { done: { ...old.done }, did: { ...old.did }, negative: old.negative }
    : { done: {}, did: {}, negative: 0 };
  const kinds = m.did ? d.did : d.done;
  if ((kinds[m.kind] ?? 0) < m.salience) kinds[m.kind] = m.salience;
  const next: PairStat = { n: st.n + 1, worst: st.worst, total: st.total };
  if (!m.did && isNegativeKind(cache.content, m.kind)) {
    next.total += m.salience;
    next.worst = Math.max(next.worst, m.salience);
  }
  od.stats.set(m.aboutId, next);
  od.digests.set(m.aboutId, withNegative(d, next));
}

/** Fold a removed row (already gone from the tables) out of its owner's cached digests. */
function digestRemoved(world: World, m: Memory): void {
  const cache = digestCaches.get(world.social.memories);
  const od = cache?.byOwner.get(m.ownerId);
  if (!cache || !od || m.aboutId === null) return;
  const about = m.aboutId;
  const old = od.digests.get(about);
  const st = od.stats.get(about);
  if (!old || !st) {
    cache.byOwner.delete(m.ownerId);
    return;
  }
  if (st.n <= 1) {
    od.digests.delete(about);
    od.stats.delete(about);
    return;
  }
  const negative = !m.did && isNegativeKind(cache.content, m.kind);
  const atMax = m.salience >= ((m.did ? old.did : old.done)[m.kind] ?? 0);
  if (atMax || (negative && m.salience >= st.worst)) {
    rescanPair(world, cache.content, od, m.ownerId, about);
    return;
  }
  const next: PairStat = { n: st.n - 1, worst: st.worst, total: negative ? st.total - m.salience : st.total };
  od.stats.set(about, next);
  od.digests.set(about, withNegative({ done: old.done, did: old.did, negative: 0 }, next));
}

function addToBucket(content: ContentBundle, d: MemoryDigest, st: PairStat, m: Memory): void {
  const kinds = m.did ? d.did : d.done;
  if ((kinds[m.kind] ?? 0) < m.salience) kinds[m.kind] = m.salience;
  st.n += 1;
  if (!m.did && isNegativeKind(content, m.kind)) {
    st.total += m.salience;
    st.worst = Math.max(st.worst, m.salience);
  }
}

function rescanPair(world: World, content: ContentBundle, od: OwnerDigests, owner: ActorId, about: ActorId): void {
  const d: MemoryDigest = { done: {}, did: {}, negative: 0 };
  const st: PairStat = { n: 0, worst: 0, total: 0 };
  for (const id of world.social.memoriesByOwner[owner] ?? []) {
    const m = world.social.memories[id];
    if (m && m.aboutId === about) addToBucket(content, d, st, m);
  }
  if (st.n === 0) {
    od.digests.delete(about);
    od.stats.delete(about);
  } else {
    od.stats.set(about, st);
    od.digests.set(about, withNegative(d, st));
  }
}

function scanOwner(world: World, content: ContentBundle, owner: ActorId): OwnerDigests {
  const digests = new Map<ActorId, MemoryDigest>();
  const stats = new Map<ActorId, PairStat>();
  for (const id of world.social.memoriesByOwner[owner] ?? []) {
    const m = world.social.memories[id];
    if (!m || m.aboutId === null) continue;
    let d = digests.get(m.aboutId);
    let st = stats.get(m.aboutId);
    if (!d || !st) {
      d = { done: {}, did: {}, negative: 0 };
      st = { n: 0, worst: 0, total: 0 };
      digests.set(m.aboutId, d);
      stats.set(m.aboutId, st);
    }
    addToBucket(content, d, st, m);
  }
  for (const [about, d] of digests) withNegative(d, stats.get(about) as PairStat);
  return { digests, stats };
}

/**
 * Replace `owner`'s memories with complete rows as given (ids kept; fixtures and save surgery).
 * Rows previously listed for the owner are removed.
 */
export function replaceOwnerMemories(world: World, owner: ActorId, rows: readonly Memory[]): void {
  touch(world, owner);
  for (const id of ownerList(world, owner) ?? []) delete rowsTable(world)[id];
  for (const m of rows) rowsTable(world)[m.id] = { ...m, ownerId: owner };
  (world.social.memoriesByOwner as Record<number, MemoryId[]>)[owner] = rows.map((m) => m.id);
}

/** Ensure `owner` has a (possibly empty) memory list (init: every actor starts with one). */
export function ensureMemoryOwner(world: World, owner: ActorId): void {
  const lists = world.social.memoriesByOwner as Record<number, MemoryId[]>;
  lists[owner] ??= [];
}

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
  rowsTable(world)[id] = m;
  const list = ownerList(world, owner) ?? [];
  list.push(id);
  (world.social.memoriesByOwner as Record<number, MemoryId[]>)[owner] = list;
  digestInserted(world, m);
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
  delete rowsTable(world)[id];
  const list = ownerList(world, m.ownerId);
  if (list) {
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
  }
  digestRemoved(world, m);
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

/**
 * All targets of one owner's memories, kept equal to the full scan by the write path above.
 * The map and its digests are shared and copy-on-write: callers must not mutate them.
 */
export function memoryDigests(
  world: World,
  content: ContentBundle,
  owner: ActorId,
): ReadonlyMap<ActorId, MemoryDigest> {
  let cache = digestCaches.get(world.social.memories);
  if (!cache || cache.content !== content) {
    if (!cache && digestCaches.size >= 16) digestCaches.clear();
    cache = { content, byOwner: new Map() };
    digestCaches.set(world.social.memories, cache);
  }
  let od = cache.byOwner.get(owner);
  if (!od) {
    od = scanOwner(world, content, owner);
    cache.byOwner.set(owner, od);
  }
  return od.digests;
}

/** The uncached full scan `memoryDigests` must always equal (the equivalence test uses it). */
export function scanMemoryDigests(world: World, content: ContentBundle, owner: ActorId): Map<ActorId, MemoryDigest> {
  return scanOwner(world, content, owner).digests;
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
    writable(world, m).salience = Math.max(floor, m.salience - floorDiv(m.salience * clampInt(pct, 0, 100), 100));
    n++;
  }
  return n;
}

/**
 * Backstory: age a freshly seeded memory `days` days (never below the floor), then lift it to
 * `forget_below` so a seeded memory is not forgotten on the first night.
 */
export function ageSeededMemory(world: World, content: ContentBundle, id: MemoryId, days: number): void {
  const row = world.social.memories[id];
  if (!row) return;
  const m = writable(world, row);
  const tau = memoryTauDays(world, content, m);
  const floor = memoryFloor(content, m);
  for (let d = 0; d < days && m.salience > floor; d++) m.salience = decayOneDay(m.salience, tau, floor);
  const forgetBelow = tuningOf(content).forget_below;
  if (m.salience < forgetBelow) m.salience = forgetBelow;
}

/** Daily decay and forgetting for every owner (ascending ids). Returns forgotten ids. */
export function decayMemoriesDaily(world: World, content: ContentBundle): MemoryId[] {
  const t = tuningOf(content);
  const forgotten: MemoryId[] = [];
  const owners = Object.keys(world.social.memoriesByOwner)
    .map(Number)
    .sort((a, b) => a - b);
  for (const owner of owners) {
    if (!processesActor(world, owner)) continue;
    const list = world.social.memoriesByOwner[owner] ?? [];
    for (const id of [...list]) {
      const m = world.social.memories[id];
      if (!m) continue;
      const floor = memoryFloor(content, m);
      writable(world, m).salience = decayOneDay(m.salience, memoryTauDays(world, content, m), floor);
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
    if (!processesActor(world, owner)) continue;
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
      const keep = writable(world, sorted[0] as Memory);
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
