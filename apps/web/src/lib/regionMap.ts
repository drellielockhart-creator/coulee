import type { PlayObservation } from '../protocol.ts';

export type RegionMapData = NonNullable<NonNullable<PlayObservation['region']>['map']>;
export interface Point {
  x: number;
  y: number;
}
export interface MapCamera extends Point {
  scale: number;
}

export function fitRegion(sites: RegionMapData['sites'], width: number, height: number): MapCamera {
  if (!sites.length) return { x: width / 2, y: height / 2, scale: 1 };
  const xs = sites.map((n) => n.x),
    ys = sites.map((n) => n.y);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  // Leave room for labels, the map toolbar and a pocket route sheet below the map.
  const scale = Math.max(
    0.05,
    Math.min(2, (width - 160) / Math.max(240, right - left), (height - 180) / Math.max(180, bottom - top)),
  );
  return { scale, x: width / 2 - ((left + right) / 2) * scale, y: height * 0.38 - ((top + bottom) / 2) * scale };
}

export function zoomRegion(camera: MapCamera, factor: number, anchor: Point): MapCamera {
  const scale = Math.max(0.05, Math.min(6, camera.scale * factor));
  const ratio = scale / camera.scale;
  return { scale, x: anchor.x - (anchor.x - camera.x) * ratio, y: anchor.y - (anchor.y - camera.y) * ratio };
}

export function roadPosition(map: RegionMapData): (Point & { from: Point; to: Point }) | null {
  const p = map.position,
    road = map.roads.find((r) => r.id === p?.edgeId);
  if (!p || !road) return null;
  const a = map.sites.find((n) => n.id === road.a),
    b = map.sites.find((n) => n.id === road.b);
  if (!a || !b) return null;
  const from = p.direction === 'ab' ? a : b,
    to = p.direction === 'ab' ? b : a;
  const fraction = p.progressPermille / 1000;
  return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction, from, to };
}
