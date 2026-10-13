import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { CONTENT_ROOT, loadContent, REPO_ROOT } from '@coulee/content';
import { PlaceSchema, ScenarioSchema, SiteSchema } from '@coulee/content/schema';
import { createSim, findNonIntegers, runHours, stateHash, toViewModel } from '@coulee/core';
import { checkTown, GEN_VERSION, type GeneratedTown, generateTown, townContent } from '@coulee/worldgen';
import { afterAll, describe, expect, it } from 'vitest';
import { sha256 } from '../../worldgen/src/hash.ts';
import { generateTimedTown, writeGeneratedTown } from '../src/generation.ts';
import { runScenario, writeRunOutputs } from '../src/harness.ts';
import layoutHashes from './fixtures/town-v2-layout-hashes.json';
import { baseContent } from './helpers.ts';

const towns = new Map<number, GeneratedTown>();
const town = (seed: number) => {
  let t = towns.get(seed);
  if (!t) {
    t = generateTown(baseContent(), { genVersion: GEN_VERSION, seed });
    towns.set(seed, t);
  }
  return t;
};

afterAll(() => {
  const results = Array.from({ length: 50 }, (_, i) => {
    const t = towns.get(i + 1);
    return {
      seed: i + 1,
      pass: t?.report.qa.every((q) => q.pass) ?? false,
      qa: t?.report.qa ?? [],
      playtest: t?.report.playtest ?? null,
    };
  });
  const dir = join(REPO_ROOT, 'runs');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'worldgen-qa.json'), `${JSON.stringify(results, null, 2)}\n`);
});

describe('procedural ford towns', () => {
  it.each(Array.from({ length: 50 }, (_, i) => i + 1))(
    'seed %i: schemas, structural QA and 30 days without collapse',
    (seed) => {
      const t = town(seed);
      // Pre-county cc3307c layouts: optional region context must not move existing towns. The fae
      // reservoir and relief policy seeds are not layout: leave them out of the pin.
      const { fae_reservoir: _reservoir, relief_offices: offices, ...layout } = t.scenario;
      expect(offices).toEqual([]); // generated offices are inferred from ordinary occupations/ties
      expect(sha256(JSON.stringify({ scenario: layout, site: t.site, places: t.places }))).toBe(layoutHashes[seed - 1]);
      expect(ScenarioSchema.parse(t.scenario)).toEqual(t.scenario);
      expect(SiteSchema.parse(t.site)).toEqual(t.site);
      for (const p of t.places) expect(PlaceSchema.parse(p)).toEqual(p);
      expect(
        t.report.qa.filter((q) => !q.pass),
        `seed ${seed}`,
      ).toEqual([]);
      expect(t.report.playtest?.days).toBe(30);
      expect(t.report.playtest?.alive).toBeGreaterThan(0);
      expect(findNonIntegers(t.scenario)).toEqual([]);
      expect(new Set(t.scenario.actors.map((a) => a.ancestry)).size).toBe(4);
    },
  );

  it('QA shortage telemetry counts the full stream after retained events have expired', () => {
    const t = town(42);
    const sim = createSim(townContent(baseContent(), t), { scenarioId: t.scenario.id, seed: 42 });
    let shortages = 0;
    sim.sink = (e) => {
      if (e.kind === 'provisions.shortage') shortages++;
    };
    runHours(sim, 30 * 24);
    expect(shortages).toBeGreaterThan(0);
    expect(sim.world.log.events.filter((e) => e.kind === 'provisions.shortage').length).toBeLessThan(shortages);
    expect(t.report.playtest?.shortages).toBe(shortages);
  });

  it('repeats scenario bytes, place bytes and 30-day run hash; different seeds differ', () => {
    const a = town(7);
    const b = generateTown(baseContent(), { genVersion: GEN_VERSION, seed: 7 });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(b.report.playtest?.hash).toBe(a.report.playtest?.hash);
    expect(JSON.stringify(town(1).scenario)).not.toBe(JSON.stringify(a.scenario));
    expect(town(1).report.playtest?.hash).not.toBe(a.report.playtest?.hash);
  });

  it('authored Iron Ford and generated town initialize through the same API and run seven days', () => {
    const t = town(42);
    for (const [content, scenarioId] of [
      [baseContent(), 'iron_ford'],
      [townContent(baseContent(), t), t.scenario.id],
    ] as const) {
      const sim = createSim(content, { scenarioId, seed: 42 });
      runHours(sim, 7 * 24);
      expect(sim.world.time).toBe(7 * 1440);
      expect(findNonIntegers(sim.world)).toEqual([]);
      const vm = toViewModel(sim.world, content, { perspective: null });
      expect(vm.places.length).toBeGreaterThan(0);
      const again = createSim(content, { scenarioId, seed: 42 });
      runHours(again, 7 * 24);
      expect(stateHash(again.world)).toBe(stateHash(sim.world));
    }
  });

  it('exports the authored directory layout and reloads it with the normal TOML loader', () => {
    const dir = mkdtempSync(join(tmpdir(), 'coulee-worldgen-'));
    try {
      const t = town(42);
      writeGeneratedTown(dir, t);
      const result = loadContent(CONTENT_ROOT, ['base', relative(CONTENT_ROOT, dir)]);
      expect(result.issues).toEqual([]);
      const b = result.bundle;
      expect(b?.scenarios[t.scenario.id]).toEqual(t.scenario);
      expect(b?.sites[t.site.id]).toEqual(t.site);
      expect(b?.meta.hash).toBe(townContent(baseContent(), t).meta.hash);
      for (const p of t.places) expect(b?.places[p.id]).toEqual(p);
      expect(readFileSync(join(dir, 'report.md'), 'utf8')).toContain('30-day survival');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records independent world/sim seeds and reproduces a manifest run', () => {
    const spec = { scenarioId: 'gen:town', seed: 11, worldSeed: 7, hours: 24 };
    const a = runScenario(baseContent(), spec);
    const dir = mkdtempSync(join(tmpdir(), 'coulee-manifest-'));
    try {
      writeRunOutputs(dir, spec, a, 'Test town');
      const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
      expect(manifest.worldSource.recipe.seed).toBe(7);
      expect(manifest.seed).toBe(11);
      expect(manifest.commandLog).toEqual([]);
      const b = runScenario(baseContent(), {
        scenarioId: manifest.scenario,
        seed: manifest.seed,
        hours: manifest.hours,
        worldSource: manifest.worldSource,
      });
      expect(b.hash).toBe(a.hash);
      const c = runScenario(baseContent(), { ...spec, seed: 12 });
      expect(c.sim.content.scenarios[c.sim.world.meta.scenarioId]).toEqual(
        a.sim.content.scenarios[a.sim.world.meta.scenarioId],
      );
      expect(c.hash).not.toBe(a.hash);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('supports constrained river towns without changing the earlier terrain layer', () => {
    const a = generateTimedTown(baseContent(), {
      genVersion: GEN_VERSION,
      seed: 7,
      preset: 'river',
      constraints: { townName: 'Pinned Ford', farmsteads: 3 },
    });
    const b = generateTown(baseContent(), {
      genVersion: GEN_VERSION,
      seed: 7,
      preset: 'river',
      constraints: { townName: 'Pinned Ford', farmsteads: 5 },
    });
    expect(a.site).toEqual(b.site);
    expect(a.places.filter((p) => p.tags.includes('creek'))).toEqual(b.places.filter((p) => p.tags.includes('creek')));
    expect(a.places.some((p) => p.kind === 'landing')).toBe(true);
    expect(a.report.layers.every((l) => Number.isInteger(l.elapsedMs))).toBe(true);
    expect(b.report.layers.every((l) => l.elapsedMs === null)).toBe(true);
    expect(a.report.qa.every((q) => q.pass)).toBe(true);
  });

  it('rejects malformed recipes explicitly', () => {
    expect(() => generateTown(baseContent(), { genVersion: 999, seed: 1 })).toThrow('genVersion');
    expect(() => generateTown(baseContent(), { genVersion: GEN_VERSION, seed: -1 })).toThrow('uint32');
    expect(() =>
      generateTown(baseContent(), { genVersion: GEN_VERSION, seed: 1, constraints: { farmsteads: 2 } }),
    ).toThrow('farmsteads');
  });

  it('detectors identify corrupt layouts, missing work/food, concealment and tensions', () => {
    const t = structuredClone(town(1));
    const first = t.places[0];
    if (!first) throw new Error('missing creek');
    t.places.push({ ...first, id: 'overlap_probe' });
    for (const p of t.places) p.tags = p.tags.filter((t) => t !== 'ford');
    for (const h of t.scenario.households) h.pantry = [];
    for (const a of t.scenario.actors) {
      a.workplace = 'nowhere';
      a.presents_as = a.ancestry;
    }
    t.scenario.tensions = [];
    expect(
      checkTown(baseContent(), t)
        .filter((q) => !q.pass)
        .map((q) => q.check),
    ).toEqual(
      expect.arrayContaining([
        'footprints',
        'households housed and fed',
        'workplaces',
        'ford',
        'concealed faekin',
        'tensions',
      ]),
    );
    const isolated = structuredClone(town(1));
    for (const p of isolated.places) if (p.kind === 'road') p.kind = 'outdoor';
    expect(checkTown(baseContent(), isolated).find((q) => q.check === 'reachability')?.pass).toBe(false);
  });
});
