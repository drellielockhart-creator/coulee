import { countyRandom, distance } from './common.ts';
import type {
  CountyNamedFeature,
  CountySettlement,
  EcologyCell,
  ResolvedCountyRecipe,
  TerrainCell,
  WaterCell,
} from './types.ts';

// Hollin's settler families (design-docs/01 §8.3), templates rather than fixed NPCs.
const FAMILIES = [
  'Pratt',
  'Brenner',
  'Tveit',
  'Kvale',
  'Trevenna',
  'Whitcomb',
  'Bell',
  'Dunleavy',
  'Hurd',
  'Stoughton',
  'Glover',
  'Haugen',
  'Penhallow',
];
const dealtFamilies = (r: ResolvedCountyRecipe, key: string) =>
  countyRandom(r, 'settlements', key).shuffleByKey(FAMILIES, (n) => FAMILIES.indexOf(n));
const direction = (cell: number, r: ResolvedCountyRecipe) => {
  const x = cell % r.size.width,
    y = Math.floor(cell / r.size.width);
  return Math.abs(x * 2 - r.size.width) > Math.abs(y * 2 - r.size.height)
    ? x * 2 < r.size.width
      ? 'West'
      : 'East'
    : y * 2 < r.size.height
      ? 'North'
      : 'South';
};
const localStock = (cell: number, t: TerrainCell[], water: WaterCell[], e: EcologyCell[]) => {
  const c = t[cell] as TerrainCell,
    v = e[cell]?.vegetation;
  return [
    ...(water[cell]?.spring ? ['Spring'] : []),
    ...(c.bluff ? ['Bluff'] : []),
    ...(c.cave ? ['Cave'] : []),
    ...(c.leadPm >= 400 ? ['Lead'] : []),
    ...(v === 'maple_basswood' ? ['Basswood', 'Maple'] : v === 'floodplain_forest' ? ['Willow', 'Alder'] : ['Oak']),
    c.geology === 'dolomite' ? 'Limestone' : 'Sandstone',
  ];
};
const QUALIFIER = /^(North|South|East|West|Upper|Lower|Little|Big|Great|New|Old) /;
// Full founder names distinguish holdings in larger windows without piling on
// geographic adjectives. These are naming templates, not materialized actors.
const FOUNDERS = [
  'John',
  'William',
  'James',
  'Thomas',
  'George',
  'Henry',
  'Charles',
  'Joseph',
  'Samuel',
  'Edward',
  'David',
  'Robert',
  'Andrew',
  'Peter',
  'Michael',
  'Patrick',
  'Daniel',
  'Isaac',
  'Jacob',
  'Benjamin',
  'Elias',
  'Nathan',
  'Walter',
  'Silas',
];

/** Keep an inherited creek qualifier, but never add a second one. After single
 * qualifiers run out, change the base to a family's holding or local landmark. */
function uniqueName(bases: string[], suffix: string, compass: string, used: Set<string>, families: string[]): string {
  const claim = (base: string) => {
    const name = `${base} ${suffix}`;
    if (used.has(name)) return undefined;
    used.add(name);
    return name;
  };
  for (const qualifier of ['', `${compass} `, 'Little ', 'Upper ', 'Lower '])
    for (const base of bases) {
      if (qualifier && QUALIFIER.test(base)) continue;
      const name = claim(`${qualifier}${base}`);
      if (name) return name;
    }
  for (const family of families) {
    const name = claim(`${family}'s`);
    if (name) return name;
  }
  const landmarks = [...new Set(bases.map((base) => base.replace(QUALIFIER, '')))].filter(
    (base) => !families.includes(base) && !base.includes("'s"),
  );
  for (const family of families)
    for (const landmark of landmarks) {
      const name = claim(`${family}'s ${landmark}`);
      if (name) return name;
    }
  for (const founder of FOUNDERS)
    for (const family of families)
      for (const landmark of ['', ...landmarks]) {
        const name = claim(`${founder} ${family}'s${landmark ? ` ${landmark}` : ''}`);
        if (name) return name;
      }
  throw new Error(`County names exhausted for ${suffix}`);
}

/** Continue each creek through its largest contributing tributary. Lesser branches
 * receive their own names; every wet creek cell belongs to exactly one named reach.
 * This is settlement-stage cartography and never mutates the hydrology raster. */
export function countyNamedFeatures(
  r: ResolvedCountyRecipe,
  t: TerrainCell[],
  water: WaterCell[],
  e: EcologyCell[],
): CountyNamedFeature[] {
  const main = new Int32Array(t.length).fill(-1);
  for (const v of water) {
    if (v.kind !== 'creek' || v.downstream === null || water[v.downstream]?.kind !== 'creek') continue;
    const current = main[v.downstream] as number;
    if (
      current < 0 ||
      (t[v.cell] as TerrainCell).catchment > (t[current] as TerrainCell).catchment ||
      ((t[v.cell] as TerrainCell).catchment === (t[current] as TerrainCell).catchment && v.cell < current)
    )
      main[v.downstream] = v.cell;
  }
  const mouths = water
    .filter((v) => v.kind === 'creek' && (v.downstream === null || main[v.downstream] !== v.cell))
    .sort((a, b) => (t[b.cell] as TerrainCell).catchment - (t[a.cell] as TerrainCell).catchment || a.cell - b.cell);
  const features: CountyNamedFeature[] = [],
    used = new Set<string>();
  const creekFamilies = dealtFamilies(r, 'creek-families');
  for (const mouth of mouths) {
    const cells: number[] = [];
    let id = mouth.cell;
    while (id >= 0) {
      cells.push(id);
      id = main[id] as number;
    }
    cells.reverse();
    const labelCell = cells[Math.floor(cells.length / 2)] as number;
    const offset = countyRandom(r, 'settlements', `creek:${mouth.cell}`).int(0, creekFamilies.length - 1);
    const families = [...creekFamilies.slice(offset), ...creekFamilies.slice(0, offset)];
    const outletName =
      mouth.downstream !== null && water[mouth.downstream]?.kind === 'river'
        ? mouth.stream?.replace(/ Creek$/, '')
        : undefined;
    const bases = [
      ...new Set([...(outletName ? [outletName] : []), ...localStock(labelCell, t, water, e), ...families]),
    ];
    const name = uniqueName(bases, 'Creek', direction(labelCell, r), used, families);
    const major = cells.length >= 12 && mouth.order >= 2;
    features.push({ id: `creek_${mouth.cell}`, kind: 'creek', name, cells, labelCell, major });
    if (major && mouth.order >= 3)
      features.push({
        id: `valley_${mouth.cell}`,
        kind: 'valley',
        name: name.replace(/ Creek$/, ' Valley'),
        cells: [...cells],
        labelCell: cells[Math.floor(cells.length / 3)] as number,
        major: true,
      });
  }
  return features;
}

export function nameCountySettlements(
  r: ResolvedCountyRecipe,
  t: TerrainCell[],
  water: WaterCell[],
  e: EcologyCell[],
  settlements: CountySettlement[],
  features: CountyNamedFeature[],
) {
  const families = dealtFamilies(r, 'founding-families'),
    used = new Set(features.map((f) => f.name));
  const creeks = features.filter((f) => f.kind === 'creek');
  for (const [i, s] of settlements.entries()) {
    const family = families[i % families.length] as string;
    s.foundingFamily = family;
    let nearest: CountyNamedFeature | undefined,
      nearestDistance = Number.MAX_SAFE_INTEGER;
    for (const f of creeks) {
      const d = Math.min(...f.cells.map((cell) => distance(cell, s.cell, r.size.width)));
      if (d < nearestDistance || (d === nearestDistance && f.id < (nearest?.id ?? ''))) {
        nearest = f;
        nearestDistance = d;
      }
    }
    if (nearest) s.namedFeatureId = nearest.id;
    const c = t[s.cell] as TerrainCell;
    const suffix =
      s.kind === 'ford_town'
        ? 'Ford'
        : s.kind === 'landing'
          ? 'Landing'
          : s.kind === 'mill'
            ? 'Mills'
            : s.kind === 'diggings'
              ? 'Diggings'
              : water[s.cell]?.floodplain
                ? 'Valley'
                : c.soil === 'loess' && c.slopePm < 25
                  ? 'Prairie'
                  : c.geology === 'dolomite'
                    ? 'Ridge'
                    : c.slopePm >= 40
                      ? 'Hollow'
                      : 'Settlement';
    const creek = nearest?.name.replace(/ Creek$/, '');
    const bases = [
      ...new Set([
        ...(creek && nearestDistance <= 3 && i % 3 !== 0 ? [creek] : []),
        family,
        ...localStock(s.cell, t, water, e),
        ...families,
      ]),
    ];
    s.name = uniqueName(bases, suffix, direction(s.cell, r), used, families);
  }
}
