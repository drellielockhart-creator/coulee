import { calibratedChannels, countyRandom, Heap, neighbors8, spacedPoints } from './common.ts';
import type { Aspect, ResolvedCountyRecipe, TerrainCell } from './types.ts';

/** Integer fractal value noise, priority flood, steepest D8 descent, accumulation,
 * then order-dependent incision. No drainage paths or basin strips are stamped. */
export function countyTerrain(r: ResolvedCountyRecipe): TerrainCell[] {
  const { width: w, height: h } = r.size,
    n = w * h;
  const noise = new Int32Array(n);
  for (const [period, amplitude] of [
    [64, 100],
    [32, 70],
    [16, 50],
    [8, 35],
    [4, 20],
    [2, 8],
  ] as const) {
    const gw = Math.ceil(w / period) + 1,
      gh = Math.ceil(h / period) + 1;
    const lattice = Array.from({ length: gw * gh }, (_, id) =>
      countyRandom(r, 'terrain', `noise:${period}:${id}`).int(-amplitude, amplitude),
    );
    const smooth = (v: number) => Math.round((v * v * (3 * 1024 - 2 * v)) / (1024 * 1024));
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const gx = Math.floor(x / period),
          gy = Math.floor(y / period),
          sx = smooth(Math.floor(((x % period) * 1024) / period)),
          sy = smooth(Math.floor(((y % period) * 1024) / period));
        const a = lattice[gy * gw + gx] as number,
          b = lattice[gy * gw + gx + 1] as number,
          c = lattice[(gy + 1) * gw + gx] as number,
          d = lattice[(gy + 1) * gw + gx + 1] as number;
        noise[y * w + x] =
          (noise[y * w + x] as number) +
          Math.round(
            (a * (1024 - sx) * (1024 - sy) + b * sx * (1024 - sy) + c * (1024 - sx) * sy + d * sx * sy) / (1024 * 1024),
          );
      }
  }
  const protectedIds = new Set(r.constraints.protectedCells);
  const cells: TerrainCell[] = Array.from({ length: n }, (_, id) => ({
    id,
    x: id % w,
    y: Math.floor(id / w),
    downstream: null,
    catchment: 1,
    elevationFt: 0,
    slopePm: 0,
    aspect: 'flat',
    soil: 'loess',
    geology: 'dolomite',
    contactFt: 0,
    bluff: false,
    cave: false,
    sinkhole: false,
    algific: false,
    erratic: false,
    leadPm: 0,
    protected: protectedIds.has(id),
  }));
  const surface = cells.map(
    (c) => (800 + (noise[c.id] as number) + Math.floor(c.x / 2) - Math.max(0, 12 - c.x) * 22) * 1024,
  );
  const filled = new Float64Array(n),
    visited = new Uint8Array(n),
    rank = new Int32Array(n),
    parent = new Int32Array(n).fill(-1);
  const tie = cells.map((c) => countyRandom(r, 'terrain', `tie:${c.id}`).int(0, 0x7fffffff));
  const heap = new Heap(),
    flood: number[] = [];
  for (let y = 0; y < h; y++) {
    const id = y * w;
    filled[id] = (400 + Math.floor((h - 1 - y) / 12)) * 1024;
    visited[id] = 1;
    heap.push([filled[id] as number, id]);
  }
  while (heap.data.length) {
    const [, id] = heap.pop();
    rank[id] = flood.length;
    flood.push(id);
    // Seed-keyed ordering resolves flats without a compass-axis preference.
    const ns = neighbors8(id, w, h).sort((a, b) => (tie[a] as number) - (tie[b] as number) || a - b);
    for (const next of ns)
      if (!visited[next]) {
        visited[next] = 1;
        parent[next] = id;
        filled[next] = Math.max(surface[next] as number, (filled[id] as number) + 100 + ((tie[next] as number) % 1400));
        heap.push([filled[next] as number, next]);
      }
  }
  for (const c of cells) {
    if (c.x === 0) {
      c.downstream = c.y === h - 1 ? null : c.id + w;
      continue;
    }
    let best = parent[c.id] as number,
      bestDrop = -1,
      bestLength = 1;
    for (const id of neighbors8(c.id, w, h)) {
      if ((rank[id] as number) >= (rank[c.id] as number)) continue;
      const drop = (filled[c.id] as number) - (filled[id] as number),
        length = c.x !== id % w && c.y !== Math.floor(id / w) ? 1414 : 1000;
      if (
        drop * bestLength > bestDrop * length ||
        (drop * bestLength === bestDrop * length && (tie[id] as number) < (tie[best] as number))
      ) {
        best = id;
        bestDrop = drop;
        bestLength = length;
      }
    }
    c.downstream = best;
  }
  for (let i = flood.length - 1; i >= 0; i--) {
    const c = cells[flood[i] as number] as TerrainCell;
    if (c.x > 0) (cells[c.downstream as number] as TerrainCell).catchment += c.catchment;
  }
  for (let y = 0; y < h - 1; y++)
    (cells[(y + 1) * w] as TerrainCell).catchment += (cells[y * w] as TerrainCell).catchment;
  const { threshold, order: orders } = calibratedChannels(cells);
  for (const c of cells) c.channelOrder = orders[c.id] as number;
  const beds = new Int32Array(n),
    carve = new Heap();
  for (const c of cells) {
    const plateau = 1000 + Math.floor(c.x / 2) + Math.round((noise[c.id] as number) / 7);
    c.contactFt = plateau - 90;
    c.elevationFt = plateau;
    beds[c.id] = c.x === 0 ? 600 + Math.floor((h - 1 - c.y) / 12) : plateau - 40 - (orders[c.id] as number) * 48;
  }
  // Channels incise downstream, so confluences cannot introduce uphill water.
  for (let i = flood.length - 1; i >= 0; i--) {
    const c = cells[flood[i] as number] as TerrainCell;
    if (c.x > 0 && c.catchment >= threshold) {
      const p = c.downstream as number;
      if (p % w !== 0) beds[p] = Math.min(beds[p] as number, (beds[c.id] as number) - 1);
    }
  }
  for (const c of cells)
    if (c.x === 0 || c.catchment >= threshold) {
      c.elevationFt = beds[c.id] as number;
      carve.push([c.elevationFt, c.id]);
    }
  // Valley walls widen with incision, leaving broad continuous uncut interfluves.
  while (carve.data.length) {
    const [z, id] = carve.pop();
    if (cells[id]?.elevationFt !== z) continue;
    for (const next of neighbors8(id, w, h)) {
      const c = cells[next] as TerrainCell,
        rise = id % w !== next % w && Math.floor(id / w) !== Math.floor(next / w) ? 78 : 55;
      if (z + rise < c.elevationFt) {
        c.elevationFt = z + rise;
        carve.push([c.elevationFt, next]);
      }
    }
  }
  for (const id of flood) {
    const c = cells[id] as TerrainCell;
    if (c.x > 0) c.elevationFt = Math.max(c.elevationFt, (cells[c.downstream as number] as TerrainCell).elevationFt);
  }
  const aspects: Aspect[] = ['NW', 'N', 'NE', 'W', 'flat', 'E', 'SW', 'S', 'SE'];
  for (const c of cells) {
    c.geology = c.elevationFt < c.contactFt ? 'sandstone' : 'dolomite';
    c.soil = c.catchment >= threshold ? 'alluvium' : c.elevationFt >= c.contactFt + 65 ? 'loess' : 'thin';
    for (const id of neighbors8(c.id, w, h)) {
      const other = cells[id] as TerrainCell,
        dx = other.x - c.x,
        dy = other.y - c.y;
      const slope = Math.round(((c.elevationFt - other.elevationFt) * 1000) / (dx && dy ? 1867 : 1320));
      if (slope > c.slopePm) {
        c.slopePm = slope;
        c.aspect = aspects[(dy + 1) * 3 + dx + 1] as Aspect;
      }
    }
    c.leadPm =
      c.geology === 'dolomite'
        ? Math.max(
            0,
            600 -
              Math.abs(c.y - Math.floor((h * 3) / 4)) * 20 +
              countyRandom(r, 'terrain', `lead:${c.id}`).int(-100, 100),
          )
        : 0;
    c.erratic = countyRandom(r, 'terrain', `erratic:${c.id}`).int(0, 999) < 2;
  }
  const contacts = cells.filter(
    (c) => c.x > 1 && neighbors8(c.id, w, h).some((id) => cells[id]?.geology !== c.geology),
  );
  for (const c of contacts) {
    c.bluff = c.slopePm >= 30;
    c.algific =
      c.bluff && ['N', 'NE', 'NW'].includes(c.aspect) && countyRandom(r, 'terrain', `ice:${c.id}`).int(0, 99) < 8;
  }
  const ranked = (cs: TerrainCell[], key: string) =>
    cs
      .map((c) => ({ id: c.id, score: countyRandom(r, 'terrain', `${key}:${c.id}`).int(0, 100000) }))
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .map((c) => c.id);
  for (const id of spacedPoints(
    ranked(
      contacts.filter((c) => c.bluff),
      'cave',
    ),
    w,
    8,
    Math.round(n / 320),
  ))
    (cells[id] as TerrainCell).cave = true;
  for (const id of spacedPoints(
    ranked(
      cells.filter((c) => c.geology === 'dolomite' && c.soil === 'loess'),
      'sink',
    ),
    w,
    10,
    Math.round(n / 420),
  ))
    (cells[id] as TerrainCell).sinkhole = true;
  return cells;
}
