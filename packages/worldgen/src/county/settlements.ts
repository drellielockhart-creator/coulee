import { countyRandom, distance } from './common.ts';
import { nameCountySettlements } from './names.ts';
import type {
  CountyNamedFeature,
  CountySettlement,
  EcologyCell,
  FaeLayer,
  ResolvedCountyRecipe,
  TerrainCell,
  WaterCell,
} from './types.ts';

export function countySettlements(
  r: ResolvedCountyRecipe,
  t: TerrainCell[],
  water: WaterCell[],
  e: EcologyCell[],
  fae: FaeLayer,
  features: CountyNamedFeature[] = [],
): CountySettlement[] {
  const result: CountySettlement[] = [];
  const count = Math.max(6, Math.round(t.length / 1800)) + (r.preset === 'river' ? 1 : 0);
  const kinds: CountySettlement['kind'][] = ['ford_town', 'landing', 'mill', 'diggings', 'farm', 'landing'];
  for (let i = 6; i < count; i++) kinds.push(i % 3 === 0 ? 'ford_town' : i % 3 === 1 ? 'farm' : 'landing');
  // Siting has not changed: retain its v2/version-1 draws independently of text.
  const sitingRecipe = { ...r, layerVersions: { ...r.layerVersions, settlements: 1 } };
  for (const kind of kinds) {
    const candidates = t
      .filter((c) => {
        if (
          c.protected ||
          fae.anchors.some((a) => a.cell === c.id) ||
          result.some((s) => distance(s.cell, c.id, r.size.width) < 6)
        )
          return false;
        const w = water[c.id] as WaterCell;
        if (kind === 'ford_town')
          return (
            w.ford &&
            w.order >= 2 &&
            w.order <= 5 &&
            fae.anchors.some(
              (a) => distance(a.cell, c.id, r.size.width) * 5 <= Math.floor(r.constraints.fordTownMaxAnchorMinutes / 2),
            )
          );
        if (kind === 'landing') return c.x === 0 && c.y > 2 && c.y < r.size.height - 3;
        if (kind === 'mill') return w.millSeat;
        if (kind === 'diggings') return c.leadPm >= 400;
        return (e[c.id] as EcologyCell).vegetation === 'oak_savanna';
      })
      .map((c) => {
        const anchorDistance = Math.min(...fae.anchors.map((a) => distance(a.cell, c.id, r.size.width)));
        const score =
          countyRandom(sitingRecipe, 'settlements', `${kind}:${c.id}`).int(0, 100) +
          (kind === 'ford_town'
            ? 600 - anchorDistance * 15 + (water[c.id] as WaterCell).order * 30
            : kind === 'mill'
              ? (water[c.id] as WaterCell).fallFt * 10
              : kind === 'diggings'
                ? c.leadPm
                : kind === 'farm'
                  ? 500 - c.slopePm * 5
                  : 500);
        return { c, score };
      })
      .sort((a, b) => b.score - a.score || a.c.id - b.c.id);
    const best = candidates[0];
    if (!best) throw new Error(`County seed ${r.seed}: no suitable ${kind} for constraints`);
    result.push({
      id: `${kind}_${best.c.id}`,
      cell: best.c.id,
      name: '',
      kind,
      suitability: best.score,
      required: true,
    });
  }
  // Mill prospects need a nearby farming population. Add dispersed farmstead
  // clusters where the main villages leave a seat more than three miles away.
  for (const seat of water.filter((v) => v.millSeat)) {
    if (result.some((s) => distance(s.cell, seat.cell, r.size.width) <= 12)) continue;
    const nearby = t
      .filter(
        (c) =>
          !c.protected &&
          (c.soil === 'loess' || (water[c.id]?.floodplain && water[c.id]?.kind === 'dry' && c.slopePm < 60)) &&
          !fae.anchors.some((a) => a.cell === c.id) &&
          distance(c.id, seat.cell, r.size.width) <= 12,
      )
      .sort((a, b) => distance(a.id, seat.cell, r.size.width) - distance(b.id, seat.cell, r.size.width) || a.id - b.id);
    const cell = nearby[0];
    if (!cell) continue;
    result.push({
      id: `farm_${cell.id}`,
      cell: cell.id,
      name: '',
      kind: 'farm',
      suitability: 500 - cell.slopePm * 5,
      required: true,
    });
  }
  nameCountySettlements(r, t, water, e, result, features);
  return result;
}
