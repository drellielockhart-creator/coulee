import type { ContentBundle } from '../content.ts';
import { type ActorId, idsOf, type PlaceId, type Table } from '../ids.ts';
import { airTempF, isRaining } from '../provisions/api.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { ensureCensus } from './census.ts';
import { ensureLod, selectRegionTiers } from './lod.ts';

export * from './census.ts';
export * from './evidence.ts';
export * from './lod.ts';
export * from './processing.ts';
export { regionSystem } from './system.ts';
/** Called once after scoped site/population installation. No arrival reseeds stocks or actors. */
export function initRegion(
  world: World,
  content: ContentBundle,
  regionId: string,
  transit: Table<ActorId, PlaceId>,
): void {
  const definition = content.regions[regionId];
  if (!definition) throw new Error(`Unknown region ${regionId}`);
  world.region = { version: 1, definition, worldSeed: world.meta.seed, sites: {}, transit, knownNodes: {} };
  for (const n of definition.nodes) {
    const entranceId = world.index.placeByDef[n.entrance];
    if (entranceId === undefined) throw new Error(`Uninstalled entrance ${n.entrance}`);
    world.region.sites[n.id] = {
      nodeId: n.id,
      siteId: n.site,
      entranceId,
      layoutVersion: 1,
      tier: 'T1',
      installedAt: world.time,
    };
  }
  for (const id of idsOf<ActorId>(world.actors)) world.region.knownNodes[id] = definition.nodes.map((n) => n.id).sort();
  ensureCensus(world);
  const focusKey = content.scenarios[world.meta.scenarioId]?.player;
  ensureLod(world, world.meta.playerId ?? (focusKey ? (world.index.actorByKey[focusKey] ?? null) : null));
  selectRegionTiers(world);
}
export function nodeAt(world: World, actorId: ActorId): string | null {
  const site = world.places[world.actors[actorId]?.placeId ?? 0]?.siteId;
  return world.region?.definition.nodes.find((n) => n.site === site)?.id ?? null;
}
export function locationOf(world: World, actorId: ActorId) {
  const j = world.activity.journeys?.[actorId];
  if (j && j.status !== 'arrived')
    return {
      kind: 'edge' as const,
      edgeId: j.legs[j.segment]?.edgeId ?? '',
      name: world.region?.definition.edges.find((e) => e.id === j.legs[j.segment]?.edgeId)?.name ?? 'the road',
      direction: j.legs[j.segment]?.direction ?? 'ab',
      feet: j.feet,
      status: j.status,
    };
  const a = world.actors[actorId];
  return {
    kind: 'site' as const,
    siteId: world.places[a?.placeId ?? 0]?.siteId ?? '',
    placeId: a?.placeId ?? null,
    level: 0,
  };
}

/** Physical road prose uses the traveler's position, rather than the private transit placeholder. */
export function describeRoad(world: World, actorId: ActorId, placeId: PlaceId): string[] | null {
  if (world.region?.transit[actorId] !== placeId) return null;
  const location = locationOf(world, actorId);
  if (location.kind !== 'edge') return null;
  const edge = world.region.definition.edges.find((e) => e.id === location.edgeId);
  if (!edge) return null;
  const destination = world.region.definition.nodes.find(
    (n) => n.id === (location.direction === 'ab' ? edge.b : edge.a),
  );
  return [
    `${edge.name}, toward ${destination?.name ?? 'the next junction'}. ${edge.description ?? (edge.climb_ft || edge.descent_ft ? 'The road rises and falls across sloping ground.' : 'The road runs across level ground.')}`,
    calendarAt(world.time).isDaylight
      ? 'In daylight you can see the road ahead and the ground on either side.'
      : 'In the dark, the road ahead and the land beyond its edges are hard to make out.',
  ];
}

/** Slice 1 fixtures can pin weather; ordinary regions retain the standalone seasonal defaults. */
export function fixedEnvironment(world: World) {
  return world.region?.definition.fixed_weather;
}

/** The shared environmental query; future regional regimes can replace this standalone fallback. */
export function environmentAt(world: World, at = world.time) {
  const cal = calendarAt(asGameMinute(at));
  return { temperatureF: airTempF(cal, world), raining: isRaining(world.meta.seed, cal, world) };
}

export { settleDailySites } from './coarse.ts';
/** Explicit hostile pins within an hour, weighted by known proximity; no new LOD pins in D0. */
export function pinnedPursuit(world: World, pc: ActorId, hostiles: readonly ActorId[]): number {
  const node = nodeAt(world, pc);
  const distances = tensionRouteDistances(world, node);
  let pressure = 0;
  for (const id of hostiles) {
    if (!world.region?.lod?.relevance[id]?.pinned) continue;
    const other = nodeAt(world, id);
    const minutes = other === node ? 0 : other === null ? 1440 : (distances[other] ?? 1440);
    // Co-presence is known location; an off-site pin has proximity, not clairvoyance.
    const known = world.actors[id]?.placeId === world.actors[pc]?.placeId;
    pressure = Math.max(pressure, Math.floor((Math.max(0, 1000 - minutes * 10) * (known ? 1000 : 500)) / 1000));
  }
  return pressure;
}

import { routeDistances as tensionRouteDistances } from './lod.ts';
