import { hashString32, mixKey, rng } from '@coulee/core';
import {
  COUNTY_GEN_VERSION,
  COUNTY_LAYERS,
  type CountyLayer,
  type CountyRecipe,
  type ResolvedCountyRecipe,
} from './types.ts';
export const CELL_FT = 1320;
export const countyRandom = (r: ResolvedCountyRecipe, layer: CountyLayer, key: number | string) =>
  rng(
    r.seed,
    'worldgen',
    r.layerVersions[layer],
    // The raster namespace remains v2; revisions advance only affected layers.
    mixKey(2, hashString32(`county:${layer}`), typeof key === 'number' ? key : hashString32(key)),
  );
export function resolveRecipe(r: CountyRecipe): ResolvedCountyRecipe {
  if (r.genVersion !== COUNTY_GEN_VERSION) throw new Error('Unsupported county genVersion');
  if (!Number.isSafeInteger(r.seed) || r.seed < 0 || r.seed > 0xffffffff) throw new Error('County seed must be uint32');
  const preset = r.preset ?? 'coulee';
  if (!['coulee', 'river'].includes(preset)) throw new Error('Unknown county preset');
  const size = { ...(r.size ?? { width: 100, height: 128 }) };
  if (![size.width, size.height].every((n) => Number.isInteger(n) && n >= 32 && n <= 256))
    throw new Error('County dimensions must be 32..256 cells');
  const layerVersions = Object.fromEntries(
    COUNTY_LAYERS.map((l) => [l, r.layerVersions?.[l] ?? (l === 'settlements' || l === 'routes' ? 2 : 1)]),
  ) as Record<CountyLayer, number>;
  if (Object.values(layerVersions).some((n) => !Number.isSafeInteger(n) || n < 1 || n > 0xffffffff))
    throw new Error('Layer versions must be positive uint32');
  const protectedCells = [...new Set(r.constraints?.protectedCells ?? [])].sort((a, b) => a - b);
  if (protectedCells.some((n) => !Number.isInteger(n) || n < 0 || n >= size.width * size.height))
    throw new Error('Invalid protected cell');
  const fordTownMaxAnchorMinutes = r.constraints?.fordTownMaxAnchorMinutes ?? 480;
  if (!Number.isInteger(fordTownMaxAnchorMinutes) || fordTownMaxAnchorMinutes < 1)
    throw new Error('Anchor distance must be positive minutes');
  return {
    genVersion: r.genVersion,
    seed: r.seed,
    preset,
    size,
    layerVersions,
    constraints: { protectedCells, fordTownMaxAnchorMinutes },
  };
}
export function neighbors(id: number, width: number, height: number): number[] {
  const x = id % width,
    y = Math.floor(id / width),
    out: number[] = [];
  if (y > 0) out.push(id - width);
  if (x < width - 1) out.push(id + 1);
  if (y < height - 1) out.push(id + width);
  if (x > 0) out.push(id - 1);
  return out;
}
export const distance = (a: number, b: number, w: number) =>
  Math.abs((a % w) - (b % w)) + Math.abs(Math.floor(a / w) - Math.floor(b / w));

/** Integer priority queue, total ordering by cost then cell. */
export class Heap {
  data: Array<[number, number]> = [];
  less(a: [number, number], b: [number, number]) {
    return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  }
  push(v: [number, number]) {
    let i = this.data.length;
    this.data.push(v);
    while (i > 0) {
      const p = Math.floor((i - 1) / 2),
        parent = this.data[p] as [number, number];
      if (!this.less(v, parent)) break;
      this.data[i] = parent;
      i = p;
    }
    this.data[i] = v;
  }
  pop() {
    const first = this.data[0] as [number, number],
      last = this.data.pop() as [number, number];
    if (this.data.length) {
      let i = 0;
      while (i * 2 + 1 < this.data.length) {
        let c = i * 2 + 1;
        if (
          c + 1 < this.data.length &&
          this.less(this.data[c + 1] as [number, number], this.data[c] as [number, number])
        )
          c++;
        if (!this.less(this.data[c] as [number, number], last)) break;
        this.data[i] = this.data[c] as [number, number];
        i = c;
      }
      this.data[i] = last;
    }
    return first;
  }
}

export function neighbors8(id: number, width: number, height: number): number[] {
  const x = id % width,
    y = Math.floor(id / width),
    out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if ((dx || dy) && x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height)
        out.push((y + dy) * width + x + dx);
  return out;
}
export const CREEK_THRESHOLD = 25;
/** Strahler order starts at channel heads, not at every dry raster cell. */
export function streamOrders(
  t: import('./types.ts').TerrainCell[],
  threshold = CREEK_THRESHOLD,
  sorted = [...t].sort((a, b) => a.catchment - b.catchment || a.id - b.id),
) {
  const order = new Int32Array(t.length),
    max = new Int32Array(t.length),
    equal = new Int32Array(t.length);
  for (const c of sorted) {
    if (c.x !== 0 && c.catchment < threshold) continue;
    order[c.id] = (max[c.id] as number) + ((equal[c.id] as number) > 1 ? 1 : 0) || 1;
    if (c.downstream === null) continue;
    const p = c.downstream,
      o = order[c.id] as number;
    if (o > (max[p] as number)) {
      max[p] = o;
      equal[p] = 1;
    } else if (o === (max[p] as number)) equal[p] = (equal[p] as number) + 1;
  }
  return order;
}
/** Greedy ranked point sampling with a circular spacing rule. */
export function spacedPoints(ids: number[], width: number, gap: number, limit: number): Set<number> {
  const selected: number[] = [];
  for (const id of ids) {
    if (
      selected.every((n) => {
        const dx = (n % width) - (id % width),
          dy = Math.floor(n / width) - Math.floor(id / width);
        return dx * dx + dy * dy >= gap * gap;
      })
    )
      selected.push(id);
    if (selected.length >= limit) break;
  }
  return new Set(selected);
}

/** Finite county boundaries censor the largest basins. Choose the closest channel
 * initiation area to 25 cells in a bounded 20..40-cell envelope (1.25..2.5 sq mi),
 * accepting only drainage trees whose count-weighted Horton ratio is 3..5.
 * This calibrates channel heads; it never edits flow directions or tributaries. */
export function calibratedChannels(t: import('./types.ts').TerrainCell[]) {
  const sorted = [...t].sort((a, b) => a.catchment - b.catchment || a.id - b.id);
  const thresholds = Array.from({ length: 21 }, (_, i) => 20 + i).sort(
    (a, b) => Math.abs(a - 25) - Math.abs(b - 25) || a - b,
  );
  for (const threshold of thresholds) {
    const order = streamOrders(t, threshold, sorted),
      counts = new Int32Array(10),
      hasSame = new Uint8Array(t.length);
    for (const c of t)
      if (c.x > 0 && order[c.id] && c.downstream !== null && order[c.downstream] === order[c.id])
        hasSame[c.downstream] = 1;
    for (const c of t)
      if (c.x > 0 && order[c.id] && !hasSame[c.id]) {
        const o = order[c.id] as number;
        counts[o] = (counts[o] as number) + 1;
      }
    const max = counts.findLastIndex((n) => n > 0);
    let numerator = 0,
      denominator = 0;
    for (let i = 1; i < max; i++) {
      numerator += counts[i] as number;
      denominator += counts[i + 1] as number;
    }
    if (numerator >= denominator * 3 && numerator <= denominator * 5 && denominator > 0) return { threshold, order };
  }
  return { threshold: CREEK_THRESHOLD, order: streamOrders(t, CREEK_THRESHOLD, sorted) };
}
