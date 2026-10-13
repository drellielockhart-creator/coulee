import type { RegionDef } from '@coulee/content/schema';
import { type ActorId, idsOf, rowsOf } from '../ids.ts';
import { opinionOf } from '../social/api.ts';
import { calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { nodeAt } from './api.ts';
import type { LodRecord, LodState } from './state.ts';

export const LOD_POLICY = { version: 1, radiusMinutes: 360, demotionMinutes: 1440, hourlySoftCap: 400 } as const;

/** Directed shortest travel times. Closed/unsupported routes are not nearby by straight-line distance. */
export function routeDistances(world: World, from: string | null): Record<string, number> {
  const region = world.region;
  if (!region || from === null) return {};
  const distances: Record<string, number> = { [from]: 0 };
  const remaining = new Set(region.definition.nodes.map((n) => n.id));
  const month = calendarAt(world.time).month;
  while (remaining.size) {
    const current: string | undefined = [...remaining]
      .filter((id) => distances[id] !== undefined)
      .sort((a, b) => (distances[a] ?? 0) - (distances[b] ?? 0) || (a < b ? -1 : a > b ? 1 : 0))[0];
    if (current === undefined) break;
    remaining.delete(current);
    for (let edgeIndex = 0; edgeIndex < region.definition.edges.length; edgeIndex++) {
      const edge: RegionDef['edges'][number] | undefined = region.definition.edges[edgeIndex];
      if (!edge) continue;
      if (edge.capability !== 'walk' || !edge.available_months.includes(month)) continue;
      const next: string | null = edge.a === current ? edge.b : edge.b === current ? edge.a : null;
      if (next === null || !remaining.has(next)) continue;
      const cost: number =
        (distances[current] ?? 0) + (edge.a === current ? edge.cost_minutes.ab : edge.cost_minutes.ba);
      if (distances[next] === undefined || cost < (distances[next] ?? 0)) distances[next] = cost;
    }
  }
  return distances;
}

export function ensureLod(world: World, focusActorId: ActorId | null = world.meta.playerId): LodState | undefined {
  if (!world.region) return undefined;
  if (world.region.lod) {
    if (world.region.lod.version !== 1) throw new Error('Unsupported regional LOD version');
    return world.region.lod;
  }
  world.region.lod = { version: 1, focusActorId, actors: {}, relevance: {}, evaluatedAt: world.time };
  return world.region.lod;
}

/** Called by hosts when changing the observation focus; never alters actor agency. */
export function setRegionFocus(world: World, actorId: ActorId | null): void {
  if (actorId !== null && !world.actors[actorId]) throw new Error('Unknown regional focus');
  const lod = ensureLod(world, actorId);
  if (lod) lod.focusActorId = actorId;
}
export function setRegionRelevance(
  world: World,
  actorId: ActorId,
  score: number,
  pinned: boolean,
  reason: string,
): void {
  if (!world.actors[actorId] || !Number.isSafeInteger(score) || score < 0)
    throw new Error('Invalid regional relevance');
  const lod = ensureLod(world);
  if (lod) lod.relevance[actorId] = { score: score || 0, pinned, reason };
}

/** Select detail without removing a single sheet. T2 remains an explicit policy-only result until 2b. */
export function selectRegionTiers(world: World): void {
  const lod = ensureLod(world);
  if (!lod || !world.region) return;
  const focus = lod.focusActorId;
  const focusNode = focus === null ? null : nodeAt(world, focus);
  const journey = focus === null ? undefined : world.activity.journeys?.[focus];
  const traveling = journey && journey.status !== 'arrived';
  const distanceFrom = focusNode ?? (traveling ? journey.legs[journey.segment]?.from : null) ?? null;
  const distances = routeDistances(world, distanceFrom);
  const relevance = new Map<ActorId, { score: number; reasons: string[] }>();
  const relevant = (id: ActorId, score: number, reason: string) => {
    const entry = relevance.get(id) ?? { score: 0, reasons: [] };
    entry.score = Math.max(entry.score, score);
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    relevance.set(id, entry);
  };
  if (focus !== null) {
    for (const relation of world.social.relationships) {
      if (relation.a !== focus && relation.b !== focus) continue;
      if (['parent', 'sibling', 'spouse', 'cousin', 'in_law', 'betrothed'].includes(relation.kind))
        relevant(relation.a === focus ? relation.b : relation.a, 60, 'kin');
    }
    // Current ledgers, including purchases without a structural creditor edge.
    for (const id of idsOf<ActorId>(world.actors)) {
      const debt = world.social.opinions[focus]?.[id]?.obligation;
      if (debt && (debt.cents !== 0 || debt.favors !== 0)) relevant(id, 80, 'obligation');
      if (opinionOf(world, focus, id).affection <= -40) relevant(id, 70, 'rival');
    }
    for (const grudge of rowsOf(world.belief.grudges)) {
      if (grudge.intensity <= 0 || grudge.target.kind !== 'actor') continue;
      if (grudge.holderId === focus) relevant(grudge.target.id, 80, 'grudge');
      if (grudge.target.id === focus) relevant(grudge.holderId, 80, 'grudge');
    }
    for (const thread of world.chronicle.threads)
      if (!thread.closed && thread.actorIds.includes(focus) && world.time - thread.lastAt <= 14 * 1440)
        for (const id of thread.actorIds) relevant(id as ActorId, 50, 'active thread');
  }
  const candidates: Array<{ id: ActorId; row: LodRecord; nearby: boolean; live: boolean }> = [];
  for (const id of idsOf<ActorId>(world.actors)) {
    const node = nodeAt(world, id);
    const live = focusNode !== null && node === focusNode;
    const hint = lod.relevance[id];
    if (hint?.score) relevant(id, hint.score, hint.reason);
    if (traveling && node === journey.destinationNodeId) relevant(id, 90, 'destination');
    const rel = relevance.get(id);
    const pinned =
      id === focus ||
      (hint?.pinned ?? false) ||
      (world.activity.journeys?.[id] !== undefined && world.activity.journeys[id]?.status !== 'arrived');
    const distance = node === null ? null : (distances[node] ?? null);
    candidates.push({
      id,
      live,
      nearby: distance !== null && distance <= LOD_POLICY.radiusMinutes,
      row: {
        selected: 'T1',
        processing: live ? 'T0' : 'T1',
        belowSince: lod.actors[id]?.belowSince ?? null,
        distanceMinutes: distance,
        relevance: rel?.score ?? 0,
        pinned,
        reasons: [...(rel?.reasons ?? []), ...(live ? ['occupied site'] : []), ...(pinned ? ['pinned'] : [])],
      },
    });
  }
  candidates.sort(
    (a, b) =>
      b.row.relevance - a.row.relevance ||
      (a.row.distanceMinutes ?? Number.MAX_SAFE_INTEGER) - (b.row.distanceMinutes ?? Number.MAX_SAFE_INTEGER) ||
      a.id - b.id,
  );
  let selectedHourly = candidates.filter((c) => c.row.pinned && !c.live).length;
  for (const c of candidates) {
    const wanted = c.row.pinned || ((c.nearby || c.row.relevance > 0) && selectedHourly < LOD_POLICY.hourlySoftCap);
    if (c.live || wanted) {
      c.row.selected = c.live ? 'T0' : 'T1';
      c.row.belowSince = null;
      if (!c.live && !c.row.pinned) selectedHourly++;
      if (c.nearby) c.row.reasons.push('within six hours');
    } else {
      c.row.belowSince ??= world.time;
      c.row.selected = world.time - c.row.belowSince >= LOD_POLICY.demotionMinutes ? 'T2' : 'T1';
      c.row.reasons.push(
        c.row.selected === 'T2' ? 'below relevance for 24 hours; T1 executor retained' : '24-hour demotion grace',
      );
    }
    lod.actors[c.id] = c.row;
  }
  lod.evaluatedAt = world.time;
}
