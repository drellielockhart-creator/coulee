import type { ActorId } from '../ids.ts';
import type { World } from '../world.ts';
import { locationOf } from './api.ts';
import { dormantNews } from './dormant.ts';

/** Slice 1 knows roads between known nodes. No county raster or bearings are installed yet. */
export function regionMapView(world: World, perspective: ActorId) {
  if (!world.region) return null;
  const known = new Set(world.region.knownNodes[perspective] ?? []);
  const nodes = world.region.definition.nodes
    .filter((n) => known.has(n.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const columns = Math.max(1, Math.min(3, nodes.length));
  const sites = nodes.map((n, i) => ({
    id: n.id,
    siteId: n.site,
    name: n.name,
    x: 100 + (i % columns) * 240,
    y: 100 + Math.floor(i / columns) * 180,
  }));
  const roads = world.region.definition.edges
    .filter((e) => known.has(e.a) && known.has(e.b))
    .map((e) => ({ id: e.id, a: e.a, b: e.b, name: e.name, distanceFt: e.distance_ft }));
  const location = locationOf(world, perspective);
  const road = location.kind === 'edge' ? roads.find((e) => e.id === location.edgeId) : undefined;
  return {
    layout: 'schematic' as const,
    observedAt: world.time,
    sites,
    roads,
    currentNodeId: location.kind === 'site' ? (sites.find((n) => n.siteId === location.siteId)?.id ?? null) : null,
    position:
      location.kind === 'edge' && road
        ? {
            edgeId: road.id,
            direction: location.direction,
            feet: location.feet,
            distanceFt: road.distanceFt,
            progressPermille: Math.max(0, Math.min(1000, Math.floor((location.feet * 1000) / road.distanceFt))),
            towardNodeId: location.direction === 'ab' ? road.b : road.a,
            status: location.status,
          }
        : null,
    reports: nodes.flatMap((n) =>
      dormantNews(world, n.site, perspective).map((f) => ({ nodeId: n.id, at: f.at, text: f.text })),
    ),
  };
}

export function regionView(world: World, perspective: ActorId) {
  if (!world.region) return null;
  const known = world.region.knownNodes[perspective] ?? [];
  return {
    map: regionMapView(world, perspective),
    name: world.region.definition.name,
    location: locationOf(world, perspective),
    destinations: world.region.definition.nodes
      .filter((n) => known.includes(n.id))
      .map((n) => ({ id: n.id, name: n.name })),
    journey: world.activity.journeys?.[perspective] ?? null,
  };
}
