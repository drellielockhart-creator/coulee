/**
 * Walking paths between places, for drawing actors moving (presentation only). OWNER: module:web.
 *
 * The sim moves actors between places hourly (T1). The renderer shows the walk: out the door,
 * onto the nearest road, along it, and in at the other door. Pure functions in tile units.
 */
import type { PlaceLike } from './terrain.ts';

export interface Pt {
  x: number;
  y: number;
}

const ROADISH = new Set(['road']);

function center(p: PlaceLike): Pt {
  return { x: p.x + p.w / 2, y: p.y + p.h / 2 };
}

function clampToRect(pt: Pt, p: PlaceLike, inset = 0): Pt {
  return {
    x: Math.max(p.x + inset, Math.min(p.x + p.w - inset, pt.x)),
    y: Math.max(p.y + inset, Math.min(p.y + p.h - inset, pt.y)),
  };
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function nearestRoad(p: PlaceLike, roads: readonly PlaceLike[]): PlaceLike | null {
  let best: PlaceLike | null = null;
  let bd = Number.POSITIVE_INFINITY;
  const c = center(p);
  for (const r of roads) {
    const d = dist(c, clampToRect(c, r));
    if (d < bd - 1e-9 || (Math.abs(d - bd) < 1e-9 && best !== null && r.id < best.id)) {
      bd = d;
      best = r;
    }
  }
  return best;
}

/**
 * The door: the point on the footprint's edge facing its nearest road (or the south edge).
 * Open places (roads, yards, landings) have no door: their center.
 */
export function doorOf(p: PlaceLike, roads: readonly PlaceLike[]): Pt {
  if (ROADISH.has(p.kind) || p.kind === 'outdoor' || p.kind === 'landing' || p.kind === 'field' || p.kind === 'yard') {
    return center(p);
  }
  const r = nearestRoad(p, roads);
  const c = center(p);
  if (!r) return { x: c.x, y: p.y + p.h + 0.4 };
  const onRoad = clampToRect(c, r);
  const dx = onRoad.x - c.x;
  const dy = onRoad.y - c.y;
  // Exit through the side facing the road.
  if (Math.abs(dx) * p.h >= Math.abs(dy) * p.w) {
    return { x: dx >= 0 ? p.x + p.w + 0.4 : p.x - 0.4, y: Math.max(p.y + 0.5, Math.min(p.y + p.h - 0.5, onRoad.y)) };
  }
  return { x: Math.max(p.x + 0.5, Math.min(p.x + p.w - 0.5, onRoad.x)), y: dy >= 0 ? p.y + p.h + 0.4 : p.y - 0.4 };
}

/** Polyline from place A to place B via the road network (single hop between road rects). */
export function routeBetween(a: PlaceLike, b: PlaceLike, places: readonly PlaceLike[]): Pt[] {
  if (a.id === b.id) return [doorOf(a, []), doorOf(b, [])];
  const roads = places.filter((p) => ROADISH.has(p.kind));
  const da = doorOf(a, roads);
  const db = doorOf(b, roads);
  const ra = nearestRoad(a, roads);
  const rb = nearestRoad(b, roads);
  if (!ra || !rb) return [da, db];
  const ja = clampToRect(da, ra, 0.5);
  const jb = clampToRect(db, rb, 0.5);
  const pts: Pt[] = [da, ja];
  if (ra.id !== rb.id) {
    // Cross from road A to road B at the point of A closest to B.
    const meet = clampToRect(center(rb), ra, 0.5);
    pts.push(meet, clampToRect(meet, rb, 0.5));
  }
  pts.push(jb, db);
  // Drop zero-length legs.
  return pts.filter((p, i) => i === 0 || dist(p, pts[i - 1] as Pt) > 1e-6);
}

export function pathLength(pts: readonly Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1] as Pt, pts[i] as Pt);
  return s;
}

/** Point at fraction t (0..1) of the path's arc length. */
export function pointAlong(pts: readonly Pt[], t: number): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1 || t <= 0) return { ...(pts[0] as Pt) };
  const total = pathLength(pts);
  if (t >= 1 || total === 0) return { ...(pts[pts.length - 1] as Pt) };
  let want = t * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt;
    const b = pts[i] as Pt;
    const d = dist(a, b);
    if (want <= d) {
      const f = d === 0 ? 0 : want / d;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    want -= d;
  }
  return { ...(pts[pts.length - 1] as Pt) };
}

/**
 * Where the n-th of `count` actors stands at a place: a loose crowd in front of the door, or
 * spread over an open place. Deterministic by slot.
 */
export function standingSpot(p: PlaceLike, slot: number, count: number, roads: readonly PlaceLike[]): Pt {
  const open = ROADISH.has(p.kind) || p.kind === 'outdoor' || p.kind === 'landing' || p.kind === 'field';
  if (open) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(count * (p.w / Math.max(1, p.h)))));
    const rows = Math.max(1, Math.ceil(count / cols));
    const cx = slot % cols;
    const cy = Math.floor(slot / cols);
    return { x: p.x + ((cx + 0.5) * p.w) / cols, y: p.y + ((cy + 0.5) * p.h) / rows };
  }
  const d = doorOf(p, roads);
  const c = center(p);
  // Outward normal from the building toward its door.
  const nx = d.x - c.x;
  const ny = d.y - c.y;
  const len = Math.hypot(nx, ny) || 1;
  const ux = nx / len;
  const uy = ny / len;
  // Rows of four along the facade, stepping outward.
  const row = Math.floor(slot / 4);
  const col = slot % 4;
  const along = (col - 1.5) * 0.55;
  const out = 0.35 + row * 0.5;
  return { x: d.x + ux * out - uy * along, y: d.y + uy * out + ux * along };
}
