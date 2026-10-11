/**
 * Site terrain from world data (ADR 0003: draw from data, never baked layouts). OWNER: module:web.
 *
 * Pure and deterministic (same site + places -> same ground), with no three.js dependency so it
 * can be unit-tested. Everything here is presentation: nothing flows back into a Command.
 *
 * Coordinates are in tiles (site grid; x east, y south). Heights are in meters.
 *
 * - The creek is routed north->south through the "water-side" places (mill, landing, ford,
 *   anything tagged water/creek), steering around building footprints row by row.
 * - The coulee floor is flat around the creek and every place; outside that the land ramps up to
 *   sandstone bluffs with dolomite caps (01 §1 landforms).
 * - Trees are scattered by an integer hash: sparse on the bottomland, thick on the slopes.
 */

export interface PlaceLike {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: string;
  tags: readonly string[];
}

export interface SiteLike {
  w: number;
  h: number;
  tileFt: number;
}

export const WATER_TAGS = ['mill', 'landing', 'ford', 'creek', 'water', 'bridge', 'springhouse', 'ferry'];
const OPEN_KINDS = new Set(['road', 'outdoor', 'wild', 'field', 'yard', 'landing']);

export function isWaterSide(p: PlaceLike): boolean {
  return p.kind === 'landing' || p.tags.some((t) => WATER_TAGS.includes(t));
}

/** Integer hash -> [0, 1). Stable across engines (no Math.random). */
export function hash01(a: number, b: number, salt = 0): number {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function insideFootprint(p: PlaceLike, x: number, y: number, pad = 0): boolean {
  return x >= p.x - pad && x < p.x + p.w + pad && y >= p.y - pad && y < p.y + p.h + pad;
}

/**
 * The creek's centerline as one x (tile, float) per row y = 0..h-1 (row centers at y + 0.5).
 */
export function routeCreek(site: SiteLike, places: readonly PlaceLike[]): number[] {
  const anchors = places
    .filter(isWaterSide)
    .map((p) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const mid = site.w / 2;
  if (anchors.length === 0) anchors.push({ x: mid, y: site.h / 2 });
  const first = anchors[0] as { x: number; y: number };
  const lastA = anchors[anchors.length - 1] as { x: number; y: number };
  const pts = [{ x: first.x, y: -1 }, ...anchors, { x: lastA.x, y: site.h + 1 }];
  const desiredAt = (y: number): number => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i] as { x: number; y: number };
      const b = pts[i + 1] as { x: number; y: number };
      if (y >= a.y && y <= b.y) {
        const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
        return a.x + (b.x - a.x) * t;
      }
    }
    return lastA.x;
  };
  const blockers = places.filter((p) => !OPEN_KINDS.has(p.kind) && !isWaterSide(p));
  const roads = places.filter((p) => p.kind === 'road');
  const raw: number[] = [];
  let prev = Math.round(desiredAt(0));
  for (let y = 0; y < site.h; y++) {
    const want = desiredAt(y + 0.5);
    let best = prev;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let x = 1; x < site.w - 1; x++) {
      let cost = Math.abs(x + 0.5 - want) + 0.6 * Math.abs(x - prev);
      if (blockers.some((p) => insideFootprint(p, x, y, 1))) cost += 1000;
      // Water-side buildings (the mill) sit ON the bank, not over the stream.
      if (places.some((p) => isWaterSide(p) && p.kind !== 'landing' && insideFootprint(p, x, y))) cost += 1000;
      if (roads.some((p) => insideFootprint(p, x, y))) cost += 4;
      if (cost < bestCost) {
        bestCost = cost;
        best = x;
      }
    }
    raw.push(best + 0.5);
    prev = best;
  }
  // Smooth (moving average) and add a gentle meander so it reads as a stream, not a ditch.
  const out: number[] = [];
  for (let y = 0; y < raw.length; y++) {
    let s = 0;
    let n = 0;
    for (let k = -3; k <= 3; k++) {
      const v = raw[y + k];
      if (v !== undefined) {
        s += v;
        n++;
      }
    }
    out.push(s / n + Math.sin(y * 0.37) * 0.35);
  }
  return out;
}

export interface Terrain {
  site: SiteLike;
  creek: number[];
  /** Creek half-width, tiles. */
  creekHalf: number;
  /** Margin beyond the grid that the ground mesh covers, tiles. */
  margin: number;
  /** Highest bluff, meters. */
  bluffHeight: number;
  /** Row (tiles) where the river begins south of the site, or null. */
  riverFrom: number | null;
  heightAt: (x: number, y: number) => number;
  /** 0 = water, 1 = bottomland, 2 = slope, 3 = cap. */
  zoneAt: (x: number, y: number) => 0 | 1 | 2 | 3;
  creekXAt: (y: number) => number;
}

export function buildTerrain(site: SiteLike, places: readonly PlaceLike[]): Terrain {
  const creek = routeCreek(site, places);
  const creekXAt = (y: number): number => {
    // Row r's centerline sits at y = r + 0.5; interpolate between neighbouring rows.
    const fy = y - 0.5;
    const base = Math.floor(fy);
    const i = Math.max(0, Math.min(creek.length - 1, base));
    const j = Math.max(0, Math.min(creek.length - 1, base + 1));
    const t = Math.max(0, Math.min(1, fy - base));
    return (creek[i] as number) * (1 - t) + (creek[j] as number) * t;
  };
  // Valley half-width: wide enough for every place plus a yard.
  let half = 10;
  for (const p of places) {
    const cy = Math.max(0, Math.min(site.h - 1, p.y + p.h / 2));
    const cx = creekXAt(cy);
    half = Math.max(half, Math.abs(p.x - cx) + 3, Math.abs(p.x + p.w - cx) + 3);
  }
  const ramp = 14;
  const bluffHeight = 38;
  const creekHalf = 0.7;
  const margin = 26;
  const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const flatBoost = (x: number, y: number): boolean => places.some((p) => insideFootprint(p, x, y, 1.5));
  // A landing or ferry near the south edge means the creek drops into a river there (01 §8.2).
  const riverFrom = places.some(
    (p) => (p.kind === 'landing' || p.tags.includes('ferry')) && p.y + p.h >= site.h - 8,
  )
    ? site.h + 3
    : null;

  const heightAt = (x: number, y: number): number => {
    if (riverFrom !== null && y >= riverFrom && y < riverFrom + 12) return -1.2;
    const cy = Math.max(0, Math.min(site.h - 1, y));
    const d = Math.abs(x - creekXAt(cy));
    if (d < creekHalf && (riverFrom === null || y < riverFrom)) return -0.9;
    if (d < creekHalf + 0.6) return -0.25;
    const wobble = (hash01(Math.floor(x / 3), Math.floor(y / 3), 7) - 0.5) * 4;
    let t = smooth((d - half + wobble) / ramp);
    // The coulee mouth opens onto the river bottoms.
    if (riverFrom !== null && y > riverFrom - 10) t *= Math.max(0, 1 - (y - (riverFrom - 10)) / 9);
    let h = t * bluffHeight;
    if (h > 0.6 * bluffHeight) {
      // Terraced cap: sandstone face, then the dolomite shelf.
      h = 0.6 * bluffHeight + (h - 0.6 * bluffHeight) * 0.5;
    }
    h += (hash01(Math.floor(x), Math.floor(y), 3) - 0.5) * (0.15 + t * 2.5);
    if (flatBoost(x, y)) h = Math.min(h, 0.05);
    return h;
  };
  const zoneAt = (x: number, y: number): 0 | 1 | 2 | 3 => {
    if (riverFrom !== null && y >= riverFrom && y < riverFrom + 12) return 0;
    const cy = Math.max(0, Math.min(site.h - 1, y));
    if (Math.abs(x - creekXAt(cy)) < creekHalf + 0.2) return 0;
    const h = heightAt(x, y);
    if (h < 2) return 1;
    if (h < 0.6 * bluffHeight - 1) return 2;
    return 3;
  };
  return { site, creek, creekHalf, margin, bluffHeight, riverFrom, heightAt, zoneAt, creekXAt };
}

export type TreeKind = 'pine' | 'oak' | 'maple';
export interface TreeSpot {
  x: number;
  y: number;
  kind: TreeKind;
  /** Uniform scale around 1. */
  scale: number;
}

/** Deterministic tree scatter, avoiding places, roads, and the creek. */
export function scatterTrees(t: Terrain, places: readonly PlaceLike[], max = 1400): TreeSpot[] {
  const out: TreeSpot[] = [];
  const { site, margin } = t;
  for (let y = -margin; y < site.h + margin; y++) {
    for (let x = -margin; x < site.w + margin; x++) {
      if (out.length >= max) return out;
      const zone = t.zoneAt(x + 0.5, y + 0.5);
      if (zone === 0) continue;
      if (places.some((p) => insideFootprint(p, x, y, p.kind === 'road' ? 1 : 2))) continue;
      const chance = zone === 1 ? 0.03 : zone === 2 ? 0.32 : 0.16;
      if (hash01(x, y, 11) >= chance) continue;
      const k = hash01(x, y, 13);
      const kind: TreeKind = zone === 3 ? (k < 0.7 ? 'pine' : 'oak') : k < 0.25 ? 'pine' : k < 0.65 ? 'oak' : 'maple';
      out.push({
        x: x + 0.2 + hash01(x, y, 17) * 0.6,
        y: y + 0.2 + hash01(x, y, 19) * 0.6,
        kind,
        scale: 0.75 + hash01(x, y, 23) * 0.6,
      });
    }
  }
  return out;
}

/** Tile -> meters. */
export function tileMeters(site: SiteLike): number {
  return site.tileFt * 0.3048;
}
