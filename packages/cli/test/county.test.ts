import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { CONTENT_ROOT, loadContent, REPO_ROOT } from '@coulee/content';
import { findNonIntegers } from '@coulee/core';
import {
  COUNTY_GEN_VERSION,
  COUNTY_LAYERS,
  checkCounty,
  countyMetrics,
  countyStatsDistribution,
  countyTownContext,
  GEN_VERSION,
  type GeneratedCounty,
  generateCounty,
  generateTown,
  renderCountySvg,
  type TerrainCell,
} from '@coulee/worldgen';
import { describe, expect, it } from 'vitest';
import { streamOrders } from '../../worldgen/src/county/common.ts';
import { nameCountySettlements } from '../../worldgen/src/county/names.ts';
import { randomFor } from '../../worldgen/src/layout.ts';
import { generateTimedCounty, writeGeneratedCounty } from '../src/county-generation.ts';
import { writeGeneratedTown } from '../src/generation.ts';
import earlierHashes from './fixtures/county-v2-earlier-hashes.json';
import { baseContent } from './helpers.ts';

const recipe = { genVersion: COUNTY_GEN_VERSION, seed: 42 };
let cached: GeneratedCounty | undefined;
const county = () => (cached ??= generateCounty(recipe));

describe('county layers', () => {
  it('seeds 1–64, both presets: topology, context, excursion and distributions', () => {
    const rows: Array<
      Pick<GeneratedCounty['report'], 'stats' | 'hash' | 'qa'> & {
        seed: number;
        preset: string;
        timing: ReturnType<typeof generateTimedCounty>['timing'];
      }
    > = [];
    for (const preset of ['coulee', 'river'] as const)
      for (let seed = 1; seed <= 64; seed++) {
        const { county: c, timing } = generateTimedCounty({ ...recipe, seed, preset });
        expect(
          c.report.qa.filter((q) => !q.pass),
          `${preset}/${seed}`,
        ).toEqual([]);
        expect(findNonIntegers(c)).toEqual([]);
        expect(new Set(c.settlements.map((s) => s.name)).size).toBe(c.settlements.length);
        const names = [...c.settlements, ...(c.namedFeatures ?? [])].map((v) => v.name);
        expect(new Set(names).size, `${preset}/${seed}`).toBe(names.length);
        for (const name of names)
          expect(
            (name.match(/\b(North|South|East|West|Upper|Lower|Little|Big|Great|New|Old)\b/g) ?? []).length,
          ).toBeLessThanOrEqual(1);
        if (preset === 'coulee') {
          const baseline = earlierHashes[String(seed) as keyof typeof earlierHashes];
          for (const layer of ['terrain', 'hydrology', 'ecology', 'fae'] as const)
            expect(c.report.hashes[layer]).toBe(baseline[layer]);
        }
        expect(c.graph.edges.some((e) => e.kind === 'river')).toBe(true);
        rows.push({ seed, preset, stats: c.report.stats, timing, hash: c.report.hash, qa: c.report.qa });
      }
    mkdirSync(join(REPO_ROOT, 'runs'), { recursive: true });
    writeFileSync(join(REPO_ROOT, 'runs/county-qa.json'), JSON.stringify(rows, null, 2));
    writeFileSync(
      join(REPO_ROOT, 'runs/county-qa-summary.json'),
      JSON.stringify(
        Object.fromEntries(
          ['coulee', 'river'].map((preset) => [
            preset,
            countyStatsDistribution(rows.filter((r) => r.preset === preset).map((r) => r.stats)),
          ]),
        ),
        null,
        2,
      ),
    );
  }, 180_000);
  it('names every creek reach, major valleys and settlements from their surroundings or families', () => {
    const c = county(),
      features = c.namedFeatures ?? [];
    expect(new Set(features.map((f) => f.name)).size).toBe(features.length);
    const namedCreekCells = features.filter((f) => f.kind === 'creek').flatMap((f) => f.cells);
    expect(new Set(namedCreekCells).size).toBe(namedCreekCells.length);
    expect([...namedCreekCells].sort((a, b) => a - b)).toEqual(
      c.hydrology.filter((v) => v.kind === 'creek').map((v) => v.cell),
    );
    expect(features.some((f) => f.kind === 'valley' && f.major)).toBe(true);
    const svg = renderCountySvg(c);
    expect(svg).toContain('id="geography"');
    expect(svg).toMatch(/>[^<]+ Creek<\/text>/);
    expect(svg).toMatch(/>[^<]+ Valley<\/text>/);
    expect(
      new Set(c.settlements.filter((s) => s.kind === 'farm').map((s) => s.name.split(' ').at(-1))).size,
    ).toBeGreaterThan(1);
    for (const s of c.settlements) {
      expect(s.foundingFamily).toBeTruthy();
      expect(features.some((f) => f.id === s.namedFeatureId)).toBe(true);
      expect(/\d|Farmsteads/.test(s.name)).toBe(false);
    }
    const bad = structuredClone(c);
    const first = bad.settlements[0],
      second = bad.settlements[1];
    if (!first || !second) throw new Error('missing settlements');
    second.name = first.name;
    expect(checkCounty(bad).find((q) => q.check === 'settlement names')?.pass).toBe(false);
  });
  it('changes the base after single qualifiers exhaust, including inherited creek qualifiers', () => {
    const c = structuredClone(county()),
      original = c.settlements[0];
    if (!original) throw new Error('missing settlement');
    const cell = original.cell;
    Object.assign(c.terrain[cell] as TerrainCell, { bluff: true, cave: true, leadPm: 500 });
    Object.assign(c.hydrology[cell] ?? {}, { spring: true });
    Object.assign(c.ecology[cell] ?? {}, { vegetation: 'maple_basswood' });
    const features = [
      {
        id: 'test_creek',
        kind: 'creek' as const,
        name: 'Upper Silver Creek',
        cells: [cell],
        labelCell: cell,
        major: true,
      },
    ];
    const settlements = Array.from({ length: 500 }, (_, i) => ({
      ...original,
      id: `mill_${i}`,
      kind: 'mill' as const,
    }));
    const rename = () => nameCountySettlements(c.recipe, c.terrain, c.hydrology, c.ecology, settlements, features);
    rename();
    const names = settlements.map((s) => s.name);
    expect(names).toContain('Upper Silver Mills');
    expect(names.some((name) => name.includes("'s "))).toBe(true);
    expect(names.some((name) => /^\w+ \w+'s /.test(name))).toBe(true);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names)
      expect((name.match(/\b(North|South|East|West|Upper|Lower|Little)\b/g) ?? []).length).toBeLessThanOrEqual(1);
    rename();
    expect(settlements.map((s) => s.name)).toEqual(names);
    const feature = features[0];
    if (!feature) throw new Error('missing feature');
    feature.name = "Pratt's Creek";
    rename();
    for (const s of settlements) expect((s.name.match(/'s/g) ?? []).length).toBeLessThanOrEqual(1);
    c.settlements[0] = { ...original, name: 'West Upper Silver Mills' };
    expect(checkCounty(c).find((q) => q.check === 'settlement names')?.pass).toBe(false);
  });
  it('reports road sinuosity and bends the reviewed seeds with terrain', () => {
    for (const seed of [7, 42, 63]) {
      const c = seed === 42 ? county() : generateCounty({ ...recipe, seed });
      const roads = c.graph.edges.filter((e) => e.kind.endsWith('_road'));
      let longestStraight = 0;
      for (const e of roads) {
        let previousStep = 0,
          run = 0;
        for (let i = 1; i < e.cells.length; i++) {
          const step = (e.cells[i] as number) - (e.cells[i - 1] as number);
          run = step === previousStep ? run + 1 : 1;
          previousStep = step;
          longestStraight = Math.max(longestStraight, run);
        }
        const a = c.terrain[e.cells[0] as number],
          b = c.terrain[e.cells.at(-1) as number];
        if (!a || !b) throw new Error('missing road endpoints');
        expect(e.sinuosityPm).toBe(Math.round((1000 * e.lengthFt) / (1320 * Math.hypot(a.x - b.x, a.y - b.y))));
      }
      expect(c.report.stats.roadSinuosityMeanPm).toBeGreaterThan(1160);
      expect(longestStraight).toBeLessThanOrEqual(13);
    }
  });
  it('counts channel Strahler order from confluences, excluding dry feeder cells', () => {
    const base = county().terrain[0] as TerrainCell;
    const downstream = [2, 2, 6, 5, 5, 6, null];
    const catchments = [25, 25, 51, 25, 25, 51, 103];
    const cells = downstream.map((next, id) => ({
      ...base,
      id,
      x: id + 1,
      downstream: next,
      catchment: catchments[id] as number,
    }));
    expect([...streamOrders(cells)]).toEqual([1, 1, 2, 1, 1, 2, 3]);
    cells[0] = { ...(cells[0] as TerrainCell), catchment: 1 };
    expect([...streamOrders(cells)]).toEqual([0, 1, 1, 1, 1, 2, 2]);
  });
  it('rejects comb drainage and boundary roads even when water remains connected', () => {
    const c = structuredClone(county()),
      { width: w, height: h } = c.recipe.size;
    for (const v of c.hydrology) {
      const x = v.cell % w,
        y = Math.floor(v.cell / w);
      v.kind = x > 0 && y % 2 === 0 ? 'creek' : 'dry';
      v.order = v.kind === 'creek' ? 1 : 0;
      v.downstream = v.kind === 'creek' ? v.cell - 1 : null;
    }
    const edge = c.graph.edges.find((e) => e.kind.endsWith('_road'));
    if (!edge) throw new Error('missing road');
    edge.cells = Array.from({ length: h }, (_, y) => y * w + w - 1);
    c.graph.edges = [edge];
    const m = countyMetrics(c);
    expect(m.axisSharePm).toBe(1000);
    expect(m.maxDirectionSharePm).toBe(1000);
    expect(m.parallelSharePm).toBeGreaterThan(900);
    expect(m.roadBoundarySharePm).toBe(1000);
    expect(
      checkCounty(c)
        .filter((q) => !q.pass)
        .map((q) => q.check),
    ).toEqual(
      expect.arrayContaining([
        'flow axis share (per mille)',
        'parallel creeks (per mille)',
        'road boundary share (per mille)',
      ]),
    );
  });
  it('keeps point features spaced and ford trails transverse to their channels', () => {
    const c = county(),
      w = c.recipe.size.width;
    const groups: [number[], number][] = [
      [c.terrain.filter((v) => v.cave).map((v) => v.id), 8],
      [c.terrain.filter((v) => v.sinkhole).map((v) => v.id), 10],
      [c.hydrology.filter((v) => v.spring).map((v) => v.cell), 5],
      [c.hydrology.filter((v) => v.ford).map((v) => v.cell), 6],
      [c.hydrology.filter((v) => v.millSeat).map((v) => v.cell), 7],
    ];
    for (const [ids, gap] of groups)
      for (let i = 0; i < ids.length; i++)
        for (const b of ids.slice(i + 1)) {
          const a = ids[i] as number;
          expect(((a % w) - (b % w)) ** 2 + (Math.floor(a / w) - Math.floor(b / w)) ** 2).toBeGreaterThanOrEqual(
            gap * gap,
          );
        }
    for (const v of c.hydrology.filter((v) => v.ford)) {
      const t = c.terrain[v.cell] as TerrainCell,
        p = c.terrain[v.downstream as number] as TerrainCell;
      const banks = (v.trailCells ?? []).filter((id) => id !== v.cell).map((id) => c.terrain[id] as TerrainCell);
      expect(banks).toHaveLength(2);
      for (const bank of banks) expect(Math.abs((bank.x - t.x) * (p.x - t.x) + (bank.y - t.y) * (p.y - t.y))).toBe(0);
    }
    expect(Buffer.byteLength(renderCountySvg(c))).toBeLessThan(1_500_000);
  });
  it('repeats bytes and keeps all earlier layer hashes stable across each later version change', () => {
    const a = county();
    expect(generateCounty(recipe)).toEqual(a);
    for (let i = 1; i < COUNTY_LAYERS.length; i++) {
      const layer = COUNTY_LAYERS[i] as (typeof COUNTY_LAYERS)[number];
      const b = generateCounty({ ...recipe, layerVersions: { [layer]: a.recipe.layerVersions[layer] + 1 } });
      for (const earlier of COUNTY_LAYERS.slice(0, i)) expect(b.report.hashes[earlier]).toBe(a.report.hashes[earlier]);
      expect(b.report.hashes[layer]).not.toBe(a.report.hashes[layer]);
    }
  });
  it('excludes protected former anchor cells before field, anchors, siting and paths', () => {
    const protectedCells = county().fae.anchors.map((a) => a.cell);
    const c = generateCounty({ ...recipe, constraints: { protectedCells } });
    for (const id of protectedCells) {
      expect(c.fae.intensity[id]).toBe(0);
      expect(c.fae.anchors.some((a) => a.cell === id)).toBe(false);
      expect(c.settlements.some((s) => s.cell === id)).toBe(false);
    }
    expect(checkCounty(c).every((q) => q.pass)).toBe(true);
  });
  it('rejects corrupt topology, disconnected required sites, desert and protected output', () => {
    const c = structuredClone(county());
    const creek = c.terrain.find((t) => t.x > 0 && c.hydrology[t.id]?.kind === 'creek');
    if (!creek) throw new Error('missing creek');
    creek.elevationFt = -1;
    creek.slopePm = 999;
    c.settlements = [];
    c.graph.edges = [];
    for (const w of c.hydrology) w.spring = false;
    const anchor = c.fae.anchors[0];
    if (!anchor) throw new Error('missing anchor');
    const cell = c.terrain[anchor.cell];
    if (cell) cell.protected = true;
    c.fae.anchors = [anchor];
    expect(
      checkCounty(c)
        .filter((q) => !q.pass)
        .map((q) => q.check),
    ).toEqual(
      expect.arrayContaining([
        'ford town',
        'water topology',
        'springs',
        'slopes',
        'fae field',
        'protected sites',
        'required connectivity',
        'starting excursion',
      ]),
    );
  });
  it('supports recipe size, rejects impossible constraints and malformed recipes', () => {
    expect(generateCounty({ ...recipe, size: { width: 64, height: 64 } }).terrain).toHaveLength(4096);
    expect(() => generateCounty({ ...recipe, seed: -1 })).toThrow('uint32');
    expect(() => generateCounty({ ...recipe, genVersion: 999 })).toThrow('genVersion');
    expect(() => generateCounty({ ...recipe, size: { width: 1, height: 1 } })).toThrow('dimensions');
    expect(() => generateCounty({ ...recipe, constraints: { fordTownMaxAnchorMinutes: 1 } })).toThrow('no suitable');
  });
  it('exports county map groups and a region-derived town through the existing TOML route', () => {
    const c = county(),
      context = countyTownContext(c);
    const otherFord = c.settlements.find((s) => s.kind === 'ford_town' && s.id !== context.settlementId);
    if (!otherFord) throw new Error('missing second ford town');
    const otherContext = countyTownContext(c, otherFord.id);
    expect(
      randomFor({ genVersion: GEN_VERSION, seed: 42, regionContext: context }, 'population', 'actor').int(
        0,
        0x7fffffff,
      ),
    ).not.toBe(
      randomFor({ genVersion: GEN_VERSION, seed: 42, regionContext: otherContext }, 'population', 'actor').int(
        0,
        0x7fffffff,
      ),
    );
    const town = generateTown(baseContent(), { genVersion: GEN_VERSION, seed: 42, regionContext: context });
    expect(town.site.name).toBe(context.townName);
    expect(town.site.landmarks?.creek).toBe(context.creekName);
    expect(town.site.description.toLowerCase()).toContain(context.geology);
    expect(town.report.qa.every((q) => q.pass)).toBe(true);
    const dir = mkdtempSync(join(tmpdir(), 'coulee-county-'));
    try {
      writeGeneratedCounty(dir, c);
      writeGeneratedTown(join(dir, 'town'), town);
      expect(JSON.parse(readFileSync(join(dir, 'county.json'), 'utf8'))).toEqual(c);
      for (const name of ['elevation', 'water', 'vegetation', 'bluffs', 'fae', 'roads', 'settlements'])
        expect(renderCountySvg(c)).toContain(`id="${name}"`);
      const loaded = loadContent(CONTENT_ROOT, ['base', relative(CONTENT_ROOT, join(dir, 'town'))]);
      expect(loaded.issues).toEqual([]);
      expect(loaded.bundle?.sites[town.site.id]).toEqual(town.site);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
