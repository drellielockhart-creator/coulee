import type { ContentBundle } from '../content.ts';
import { type ActorId, idsOf, type PlaceId, type Table } from '../ids.ts';
import { airTempF, isRaining } from '../provisions/api.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { World } from '../world.ts';
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

/** Slice 1 fixtures can pin weather; ordinary regions retain the standalone seasonal defaults. */
export function fixedEnvironment(world: World) {
  return world.region?.definition.fixed_weather;
}

/** The shared environmental query; future regional regimes can replace this standalone fallback. */
export function environmentAt(world: World, at = world.time) {
  const cal = calendarAt(asGameMinute(at));
  return { temperatureF: airTempF(cal, world), raining: isRaining(world.meta.seed, cal, world) };
}
