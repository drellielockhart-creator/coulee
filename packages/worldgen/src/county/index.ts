import { canonicalStringify } from '@coulee/core';
import { sha256 } from '../hash.ts';
import { resolveRecipe } from './common.ts';
import { countyMetrics } from './metrics.ts';
import { countyNamedFeatures } from './names.ts';
import { countyEcology, countyFae, countyHydrology } from './nature.ts';
import { checkCounty } from './qa.ts';
import { countyRoutes } from './routes.ts';
import { countySettlements } from './settlements.ts';
import { countyTerrain } from './terrain.ts';
import {
  COUNTY_LAYERS,
  type CountyLayer,
  type CountyRecipe,
  type CountyRegionContext,
  type GeneratedCounty,
} from './types.ts';

export { countyMetrics } from './metrics.ts';
export { checkCounty, countyStatsDistribution } from './qa.ts';
export { renderCountySvg } from './svg.ts';
export * from './types.ts';
export function* generateCountyStages(input: CountyRecipe): Generator<CountyLayer, GeneratedCounty> {
  const recipe = resolveRecipe(input);
  const terrain = countyTerrain(recipe);
  yield 'terrain';
  const hydrology = countyHydrology(recipe, terrain);
  yield 'hydrology';
  const ecology = countyEcology(recipe, terrain, hydrology);
  yield 'ecology';
  const fae = countyFae(recipe, terrain, hydrology, ecology);
  yield 'fae';
  const namedFeatures = countyNamedFeatures(recipe, terrain, hydrology, ecology);
  const settlements = countySettlements(recipe, terrain, hydrology, ecology, fae, namedFeatures);
  yield 'settlements';
  const graph = countyRoutes(recipe, terrain, hydrology, fae, settlements);
  yield 'routes';
  const layers = { terrain, hydrology, ecology, fae, settlements, routes: graph };
  // Raster rows have a fixed schema/insertion order. Store column names once in the
  // hash payload instead of hashing the same field names 12,800 times. This is lossless
  // for these homogeneous generated records and leaves the exported JSON readable.
  const rasterPayload = (rows: object[]) => ({ columns: Object.keys(rows[0] ?? {}), rows: rows.map(Object.values) });
  const hashPayloads = {
    ...layers,
    settlements: { settlements, namedFeatures },
    terrain: rasterPayload(terrain),
    hydrology: rasterPayload(hydrology),
    ecology: rasterPayload(ecology),
  };
  const hashes = Object.fromEntries(COUNTY_LAYERS.map((l) => [l, sha256(JSON.stringify(hashPayloads[l]))])) as Record<
    CountyLayer,
    string
  >;
  const county: GeneratedCounty = {
    recipe,
    terrain,
    hydrology,
    ecology,
    fae,
    settlements,
    namedFeatures,
    graph,
    report: {
      qa: [],
      hashes,
      hash: sha256(canonicalStringify({ recipe, hashes })),
      stats: {
        ...countyMetrics({ recipe, terrain, hydrology, graph }),
        cells: terrain.length,
        towns: settlements.filter((s) => s.kind === 'ford_town').length,
        fords: hydrology.filter((w) => w.ford).length,
        mills: hydrology.filter((w) => w.millSeat).length,
        springs: hydrology.filter((w) => w.spring).length,
        caves: terrain.filter((t) => t.cave).length,
        anchors: fae.anchors.length,
        roadFt: graph.edges.filter((e) => e.kind.endsWith('_road')).reduce((sum, e) => sum + e.lengthFt, 0),
      },
      deferred: [
        'Q07: no Native-nations settlements or geography; future consulted polities attach to graph nodes.',
        'Q08: no history pre-roll or county census.',
        'Non-town site layouts, playable travel/food acceptance, and the fae reservoir remain later slices.',
      ],
    },
  };
  county.report.qa = checkCounty(county, county.report.stats);
  const failures = county.report.qa.filter((q) => !q.pass);
  if (failures.length)
    throw new Error(`County seed ${recipe.seed}: ${failures.map((f) => `${f.check}: ${f.detail}`).join('; ')}`);
  return county;
}
export function generateCounty(recipe: CountyRecipe): GeneratedCounty {
  const stages = generateCountyStages(recipe);
  let next = stages.next();
  while (!next.done) next = stages.next();
  return next.value;
}
export function countyTownContext(c: GeneratedCounty, settlementId?: string): CountyRegionContext {
  const s = settlementId
    ? c.settlements.find((s) => s.id === settlementId)
    : c.settlements.find((s) => s.kind === 'ford_town');
  if (s?.kind !== 'ford_town') throw new Error('County town context requires a ford town');
  const t = c.terrain[s.cell];
  if (!t) throw new Error('Missing town terrain');
  const nearby = c.terrain.filter((n) => Math.abs(n.x - t.x) <= 5 && Math.abs(n.y - t.y) <= 5);
  return {
    countyHash: c.report.hash,
    settlementId: s.id,
    townName: s.name,
    cell: s.cell,
    creekName:
      c.namedFeatures?.find((f) => f.kind === 'creek' && f.cells.includes(s.cell))?.name ??
      c.hydrology[s.cell]?.stream ??
      'Creek',
    riverName: 'Big River',
    onRiver: t.x <= 2,
    elevationFt: t.elevationFt,
    geology: t.geology,
    aspect: t.aspect,
    soil: t.soil,
    vegetation: c.ecology[s.cell]?.vegetation ?? 'oak_woodland',
    faeIntensity: c.fae.intensity[s.cell] ?? 0,
    protected: t.protected,
    springs: nearby.filter((n) => c.hydrology[n.id]?.spring).map((n) => n.id),
    bluffs: nearby.filter((n) => n.bluff).map((n) => n.id),
    neighbors: c.settlements.filter((n) => n.id !== s.id).map((n) => ({ id: n.id, name: n.name, cell: n.cell })),
    entrances: c.graph.edges
      .filter((e) => e.a === s.id || e.b === s.id)
      .map((e) => {
        const cell = e.a === s.id ? e.cells[1] : e.cells[e.cells.length - 2];
        const n = c.terrain[cell ?? s.cell] ?? t;
        return { edge: e.id, side: n.x > t.x ? 'E' : n.x < t.x ? 'W' : n.y > t.y ? 'S' : 'N' };
      }),
  };
}
