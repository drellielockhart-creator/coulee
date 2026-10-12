import type { GeneratedCounty } from './types.ts';

export const segmentFt = (a: number, b: number, width: number) =>
  a % width !== b % width && Math.floor(a / width) !== Math.floor(b / width) ? 1867 : 1320;

/** Stream counts are maximal same-order runs, not cells. Parallel detector excludes
 * the same run and connected tributaries (nearby cells in one meander aren't parallel creeks). */
export function countyMetrics(c: Pick<GeneratedCounty, 'recipe' | 'terrain' | 'hydrology' | 'graph'>) {
  const { width: w, height: h } = c.recipe.size;
  const water = c.hydrology,
    terrain = c.terrain;
  const creeks = water.filter((v) => v.kind === 'creek');
  const dirs = new Array<number>(9).fill(0);
  const run = new Int32Array(water.length).fill(-1);
  const counts = new Array<number>(10).fill(0),
    lengths = new Array<number>(10).fill(0);
  const upstream = new Int32Array(water.length);
  for (const v of creeks)
    if (v.downstream !== null && water[v.downstream]?.order === v.order)
      upstream[v.downstream] = (upstream[v.downstream] as number) + 1;
  let nextRun = 0,
    length = 0,
    axis = 0,
    parallel = 0;
  const direction = (id: number) => {
    const v = water[id];
    if (v?.downstream == null) return -1;
    return (Math.floor(v.downstream / w) - Math.floor(id / w) + 1) * 3 + ((v.downstream % w) - (id % w) + 1);
  };
  for (const v of creeks)
    if (!(upstream[v.cell] as number)) {
      counts[v.order] = (counts[v.order] as number) + 1;
      let id: number | null = v.cell;
      while (id !== null && water[id]?.kind === 'creek' && water[id]?.order === v.order && run[id] === -1) {
        run[id] = nextRun;
        id = water[id]?.downstream ?? null;
      }
      nextRun++;
    }
  for (const v of creeks) {
    if (v.downstream === null) continue;
    const d = direction(v.cell),
      ft = segmentFt(v.cell, v.downstream, w);
    dirs[d] = (dirs[d] as number) + 1;
    length += ft;
    lengths[v.order] = (lengths[v.order] as number) + ft;
    if ([1, 3, 5, 7].includes(d)) axis++;
    const x = v.cell % w,
      y = Math.floor(v.cell / w);
    let found = false;
    for (let dy = -2; dy <= 2 && !found; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        if (x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h) continue;
        const id = (y + dy) * w + x + dx,
          other = water[id];
        if (other?.kind !== 'creek' || other.order !== v.order || run[id] === run[v.cell] || direction(id) !== d)
          continue;
        // Separate branches whose downstream reaches are still distinct at this scale.
        let a = v.cell,
          b = id;
        const aa = new Set<number>([a]),
          bb = new Set<number>([b]);
        for (let i = 0; i < 4; i++) {
          a = water[a]?.downstream ?? a;
          b = water[b]?.downstream ?? b;
          aa.add(a);
          bb.add(b);
        }
        if (![...aa].some((n) => bb.has(n))) found = true;
      }
    if (found) parallel++;
  }
  // Count-weighted mean N(u)/N(u+1), weighting each pair by receiving runs.
  // Include sparse terminal orders; report the counts so boundary effects are visible.
  const maxOrder = counts.findLastIndex((n) => n > 0);
  let numerator = 0,
    denominator = 0;
  for (let i = 1; i < maxOrder; i++) {
    numerator += counts[i] as number;
    denominator += counts[i + 1] as number;
  }
  let road = 0,
    boundary = 0,
    corridor = 0;
  for (const edge of c.graph.edges.filter((e) => e.kind.endsWith('_road')))
    for (let i = 1; i < edge.cells.length; i++) {
      const a = edge.cells[i - 1] as number,
        b = edge.cells[i] as number,
        ft = segmentFt(a, b, w);
      road += ft;
      const t = terrain[b];
      if (!t) continue;
      if (t.x <= 1 || t.x >= w - 2 || t.y <= 1 || t.y >= h - 2) boundary += ft;
      if (t.soil === 'loess' || water[b]?.floodplain) corridor += ft;
    }
  const pm = (a: number, b: number) => Math.round((1000 * a) / Math.max(1, b));
  const roadSinuosities = c.graph.edges
    .filter((e) => e.kind.endsWith('_road'))
    .map((e) => {
      const a = e.cells[0] as number,
        b = e.cells[e.cells.length - 1] as number;
      const dx = (a % w) - (b % w),
        dy = Math.floor(a / w) - Math.floor(b / w);
      return e.lengthFt / Math.max(1, 1320 * Math.sqrt(dx * dx + dy * dy));
    });
  return {
    roadSinuosityMeanPm: Math.round(
      (1000 * roadSinuosities.reduce((a, b) => a + b, 0)) / Math.max(1, roadSinuosities.length),
    ),
    roadSinuosityMaxPm: Math.round(1000 * Math.max(1, ...roadSinuosities)),
    axisSharePm: pm(axis, creeks.length),
    maxDirectionSharePm: pm(Math.max(...dirs), creeks.length),
    bifurcationRatioX1000: pm(numerator, denominator),
    drainageKmPerSqMiX1000: Math.round((length * 0.3048) / ((w * h) / 16)),
    parallelSharePm: pm(parallel, creeks.length),
    roadBoundarySharePm: pm(boundary, road),
    roadCorridorSharePm: pm(corridor, road),
    runMeanFtOrder1: Math.round((lengths[1] as number) / Math.max(1, counts[1] as number)),
    runMeanFtOrder2: Math.round((lengths[2] as number) / Math.max(1, counts[2] as number)),
    runMeanFtOrder3: Math.round((lengths[3] as number) / Math.max(1, counts[3] as number)),
    runMeanFtOrder4: Math.round((lengths[4] as number) / Math.max(1, counts[4] as number)),
    runMeanFtOrder5: Math.round((lengths[5] as number) / Math.max(1, counts[5] as number)),
    runsOrder1: counts[1] as number,
    runsOrder2: counts[2] as number,
    runsOrder3: counts[3] as number,
    runsOrder4: counts[4] as number,
    runsOrder5: counts[5] as number,
    sinkholes: terrain.filter((t) => t.sinkhole).length,
  };
}
