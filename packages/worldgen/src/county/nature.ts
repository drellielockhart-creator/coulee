import { countyRandom, distance, neighbors, neighbors8, spacedPoints } from './common.ts';
import type { EcologyCell, FaeAnchor, FaeLayer, ResolvedCountyRecipe, TerrainCell, WaterCell } from './types.ts';

// Setting candidates, not geographic pins. Q07 real-river geography remains undecided.
const CREEKS = ['Hasp', 'Lantern', 'Rush', 'Coldwater', 'Plum', 'Otter', 'Kettle', 'Silver'];
export function countyHydrology(r: ResolvedCountyRecipe, t: TerrainCell[]): WaterCell[] {
  const w = r.size.width,
    h = r.size.height;
  const order = t.map((c) => c.channelOrder ?? 0);
  const upstreamFirst = [...t].sort((a, b) => a.catchment - b.catchment || a.id - b.id);
  const streamNames = new Array<string>(t.length).fill('Big River');
  const outlets = t
    .filter((c) => c.x > 0 && c.downstream !== null && t[c.downstream]?.x === 0)
    .sort((a, b) => a.y - b.y || a.id - b.id);
  const outletNames = new Map(
    outlets.map((c, i) => [c.id, `${i >= CREEKS.length ? 'Upper ' : ''}${CREEKS[i % CREEKS.length]} Creek`]),
  );
  for (let i = upstreamFirst.length - 1; i >= 0; i--) {
    const c = upstreamFirst[i] as TerrainCell;
    if (c.x > 0) streamNames[c.id] = outletNames.get(c.id) ?? (streamNames[c.downstream as number] as string);
  }
  const result: WaterCell[] = t.map((c) => {
    const random = countyRandom(r, 'hydrology', c.id),
      kind = c.x === 0 ? 'river' : (c.channelOrder ?? 0) > 0 ? 'creek' : 'dry';
    const fall = c.downstream === null ? 0 : c.elevationFt - (t[c.downstream] as TerrainCell).elevationFt;
    const ford = false;
    return {
      cell: c.id,
      kind,
      downstream: kind === 'dry' ? null : c.downstream,
      order: kind === 'dry' ? 0 : (order[c.id] as number as number),
      stream: kind === 'river' ? 'Big River' : kind === 'creek' ? (streamNames[c.id] as string) : null,
      spring: false,
      floodplain:
        kind !== 'dry' ||
        neighbors8(c.id, w, h).some(
          (id) =>
            ((t[id] as TerrainCell).channelOrder ?? 0) > 0 &&
            Math.abs((t[id] as TerrainCell).elevationFt - c.elevationFt) <= 15,
        ),
      ford,
      gravelBar: ford,
      depthIn: kind === 'dry' ? 0 : ford ? random.int(8, 20) : kind === 'river' ? 120 : random.int(24, 48),
      millSeat: false,
      fallFt: fall,
    };
  });
  const ranked = (ids: number[], key: string, score: (id: number) => number = () => 0) =>
    ids
      .map((id) => ({ id, score: score(id) + countyRandom(r, 'hydrology', `${key}:${id}`).int(0, 100) }))
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .map((c) => c.id);
  const contacts = t.filter(
    (c) =>
      c.x > 1 &&
      neighbors8(c.id, w, h).some((id) => t[id]?.geology !== c.geology) &&
      neighbors8(c.id, w, h).some((id) => ((t[id] as TerrainCell).channelOrder ?? 0) > 0 && (order[id] as number) <= 2),
  );
  for (const id of spacedPoints(
    ranked(
      contacts.map((c) => c.id),
      'spring',
    ),
    w,
    5,
    Math.round((t.length * countyRandom(r, 'hydrology', 'spring-count').int(75, 125)) / 12800),
  ))
    (result[id] as WaterCell).spring = true;
  // A plausible cross-valley trail needs two opposite accessible banks. Points
  // exist before settlement/roads so later-layer changes never mutate hydrology.
  const crossings = result
    .filter(
      (v) =>
        v.kind === 'creek' &&
        v.order >= 2 &&
        v.order <= 4 &&
        v.fallFt <= 8 &&
        (t[v.cell] as TerrainCell).x > 2 &&
        (t[v.cell] as TerrainCell).x < w - 3 &&
        (t[v.cell] as TerrainCell).y > 2 &&
        (t[v.cell] as TerrainCell).y < h - 3,
    )
    .filter((v) => {
      const c = t[v.cell] as TerrainCell,
        p = t[c.downstream as number] as TerrainCell,
        dx = Math.sign(p.x - c.x),
        dy = Math.sign(p.y - c.y);
      const a = t[(c.y + dx) * w + c.x - dy] as TerrainCell,
        b = t[(c.y - dx) * w + c.x + dy] as TerrainCell;
      return a && b && Math.abs(a.elevationFt - c.elevationFt) <= 60 && Math.abs(b.elevationFt - c.elevationFt) <= 60;
    });
  for (const id of spacedPoints(
    ranked(
      crossings.map((v) => v.cell),
      'ford',
    ),
    w,
    6,
    Math.round((t.length * countyRandom(r, 'hydrology', 'ford-count').int(35, 55)) / 12800),
  )) {
    const v = result[id] as WaterCell;
    v.ford = true;
    v.gravelBar = true;
    v.trailCrossing = true;
    const c = t[id] as TerrainCell,
      p = t[c.downstream as number] as TerrainCell,
      dx = Math.sign(p.x - c.x),
      dy = Math.sign(p.y - c.y);
    v.trailCells = [(c.y + dx) * w + c.x - dy, id, (c.y - dx) * w + c.x + dy];
    v.depthIn = 12;
  }
  const fords = result.filter((v) => v.ford);
  const mills = result.filter(
    (v) =>
      v.kind === 'creek' &&
      v.order >= 2 &&
      v.order <= 4 &&
      v.fallFt >= 2 &&
      v.fallFt <= 40 &&
      fords.some((f) => distance(f.cell, v.cell, w) <= 12),
  );
  for (const id of spacedPoints(
    ranked(
      mills.map((v) => v.cell),
      'mill',
      (id) => (result[id] as WaterCell).fallFt * 8,
    ),
    w,
    7,
    Math.round(t.length / 420),
  ))
    (result[id] as WaterCell).millSeat = true;
  return result;
}
export function countyEcology(r: ResolvedCountyRecipe, t: TerrainCell[], water: WaterCell[]): EcologyCell[] {
  return t.map((c) => {
    const random = countyRandom(r, 'ecology', c.id),
      wet = water[c.id] as WaterCell;
    const vegetation = wet.floodplain
      ? 'floodplain_forest'
      : c.slopePm >= 60 && ['S', 'SW'].includes(c.aspect)
        ? 'goat_prairie'
        : ['N', 'NE', 'NW'].includes(c.aspect) && c.slopePm >= 30
          ? 'maple_basswood'
          : c.soil === 'loess' && c.slopePm < 40
            ? 'oak_savanna'
            : 'oak_woodland';
    return {
      vegetation,
      oldGrowth: ['maple_basswood', 'oak_woodland'].includes(vegetation) && random.int(0, 99) < 30,
      fogPocket: wet.floodplain && random.int(0, 99) < 25,
      wildlifePm: random.int(350, 800),
      foragePm: random.int(200, 650) + (vegetation === 'oak_savanna' ? 150 : 0),
    };
  });
}
/** This gate precedes every positive hook, including anchors and route endpoints. */
export const permitsFae = (c: TerrainCell) => !c.protected;
export function countyFae(r: ResolvedCountyRecipe, t: TerrainCell[], water: WaterCell[], e: EcologyCell[]): FaeLayer {
  const raw = t.map((c) => {
    if (!permitsFae(c)) return 0;
    const eco = e[c.id] as EcologyCell,
      wet = water[c.id] as WaterCell;
    return Math.max(
      0,
      Math.min(
        5000,
        350 +
          (wet.spring ? 2200 : 0) +
          (c.cave ? 2800 : 0) +
          (c.sinkhole ? 1600 : 0) +
          (eco.fogPocket ? 1300 : 0) +
          (eco.oldGrowth ? 1800 : 0) -
          (c.algific ? 3000 : 0) -
          (c.erratic ? 3000 : 0),
      ),
    );
  });
  let field = raw;
  for (let pass = 0; pass < 3; pass++)
    field = t.map((c) => {
      if (!permitsFae(c)) return 0;
      const ns = neighbors(c.id, r.size.width, r.size.height);
      return Math.floor(
        ((raw[c.id] as number) * 3 + ns.reduce((s, id) => s + (field[id] as number), 0)) / (3 + ns.length),
      );
    });
  // Keep Ice sources negative after smoothing, so nearby positive hooks cannot erase them.
  const intensity = t.map((c) =>
    !permitsFae(c) ? 0 : c.algific || c.erratic ? 0 : Math.min(5, Math.floor(((field[c.id] as number) + 400) / 700)),
  );
  const candidates = t
    .filter(
      (c) =>
        permitsFae(c) &&
        !c.algific &&
        !c.erratic &&
        ((water[c.id] as WaterCell).spring ||
          c.cave ||
          c.sinkhole ||
          (e[c.id] as EcologyCell).oldGrowth ||
          (e[c.id] as EcologyCell).fogPocket),
    )
    .map((c) => ({ c, score: (field[c.id] as number) + countyRandom(r, 'fae', c.id).int(0, 1800) }))
    .sort((a, b) => b.score - a.score || a.c.id - b.c.id);
  const anchors: FaeAnchor[] = [],
    target = countyRandom(r, 'fae', 'count').int(6, 10);
  for (const { c } of candidates) {
    if (!permitsFae(c) || anchors.some((a) => distance(a.cell, c.id, r.size.width) < 8)) continue;
    const family = c.cave
      ? 'cave'
      : (water[c.id] as WaterCell).spring
        ? 'spring'
        : c.sinkhole
          ? 'sinkhole'
          : (e[c.id] as EcologyCell).fogPocket
            ? 'fog'
            : 'old_growth';
    if (anchors.length === 1 && anchors[0]?.family === family) continue;
    intensity[c.id] = 3;
    anchors.push({
      id: `anchor_${c.id}`,
      cell: c.id,
      family,
      court: family === 'cave' ? 'Under' : family === 'spring' ? 'River' : family === 'fog' ? 'Alder' : 'Thorn',
      intensity: 3,
    });
    if (anchors.length === target) break;
  }
  return { intensity, anchors };
}
