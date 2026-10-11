import { ScenarioSchema } from '@coulee/content/schema';
import { createSim } from '@coulee/core';
import { checkTown, GEN_VERSION, townContent } from '@coulee/worldgen';
import { expect, it } from 'vitest';
import { baseBindings } from '../../core/src/chronicle/bindings.ts';
import { atPlace } from '../../core/src/chronicle/names.ts';
import { buildTemplateIndex, expand } from '../../core/src/chronicle/prose.ts';
import { rng } from '../../core/src/rng.ts';
import { settlement, terrain } from '../../worldgen/src/layout.ts';
import { populate } from '../../worldgen/src/population.ts';
import { seedTensions } from '../../worldgen/src/tensions.ts';
import { baseContent } from './helpers.ts';

function draft(seed: number) {
  const recipe = { genVersion: GEN_VERSION, seed };
  const t = terrain(recipe);
  const homes = settlement(recipe, t);
  const scenario = ScenarioSchema.parse({ id: t.site.id, site: t.site.id, name: t.site.name });
  populate(baseContent(), recipe, scenario, homes);
  seedTensions(baseContent(), recipe, scenario);
  return { site: t.site, places: t.places, scenario };
}

it.each([1, 7, 42])('pinning the generated name leaves seed %i geography unchanged', (seed) => {
  const recipe = { genVersion: GEN_VERSION, seed };
  const a = terrain(recipe);
  settlement(recipe, a);
  const b = terrain({ ...recipe, constraints: { townName: a.site.name } });
  settlement({ ...recipe, constraints: { townName: a.site.name } }, b);
  expect(b.site).toEqual(a.site);
  expect(b.places).toEqual(a.places);
  const c = terrain({ ...recipe, constraints: { townName: 'Pinned Ford' } });
  expect(c.places).toEqual(terrain(recipe).places);
});

it('a seed sweep varies layout, institutions, population and 3–4 tensions without reusing authored names', () => {
  const authored = new Set(
    Object.values(baseContent().scenarios).flatMap((s) => s.actors.map((a) => `${a.given} ${a.family}`)),
  );
  const layouts = new Set<string>();
  const churches = new Set<string>();
  const taverns = new Set<string>();
  const populations = new Set<string>();
  const institutions = new Set<string>();
  const cards = new Set<string>();
  const decks = new Set<string>();
  const foundings = new Set<string>();
  for (const seed of [...Array.from({ length: 50 }, (_, i) => i), 0xffffffff]) {
    const t = draft(seed);
    expect(
      checkTown(baseContent(), t).filter((q) => !q.pass),
      `seed ${seed}`,
    ).toEqual([]);
    for (const a of t.scenario.actors) expect(authored.has(`${a.given} ${a.family}`)).toBe(false);
    expect(t.scenario.tensions.length).toBeGreaterThanOrEqual(3);
    expect(t.scenario.tensions.length).toBeLessThanOrEqual(4);
    expect(new Set(t.scenario.tensions.map((x) => x.key)).size).toBe(t.scenario.tensions.length);
    layouts.add(JSON.stringify(t.places.map((p) => [p.tags, p.x, p.y])));
    churches.add(t.places.find((p) => p.tags.includes('church'))?.name ?? '');
    taverns.add(t.places.find((p) => p.tags.includes('tavern'))?.name ?? '');
    institutions.add(t.scenario.actors.find((a) => a.key === 'service_head')?.occupation ?? '');
    populations.add(JSON.stringify(t.scenario.actors.map((a) => [a.culture, a.ancestry, a.household])));
    decks.add(
      t.scenario.tensions
        .map((t) => t.key)
        .sort()
        .join(','),
    );
    for (const tension of t.scenario.tensions) cards.add(tension.key);
    for (const g of t.scenario.grudges) foundings.add(g.founding);
  }
  expect(layouts.size).toBeGreaterThan(40);
  expect(institutions.size).toBe(3);
  expect(populations.size).toBeGreaterThan(40);
  expect(churches.size).toBeGreaterThan(5);
  expect(taverns.size).toBeGreaterThan(20);
  expect(decks.size).toBeGreaterThan(20);
  expect(cards.size).toBe(10);
  expect(foundings.size).toBeGreaterThan(12);
});

it.each([3, 11, 29])('seed %i binds all local geography into templates and lexicon', (seed) => {
  const t = draft(seed);
  const content = townContent(baseContent(), t);
  const sim = createSim(content, { scenarioId: t.scenario.id, seed });
  const bind = baseBindings(sim.world, content, { t: 0, actors: [], place: 0, formal: false, authorId: null });
  expect(bind.town).toBe(t.site.name);
  expect(bind.creek).toBe(t.site.landmarks?.creek);
  const index = buildTemplateIndex(content);
  const prose = Object.values(content.chronicleTemplates)
    .flatMap((tpl) => tpl.text.map((text) => expand(text, bind, index, rng(seed, 'chronicle', 0, 1))))
    .join('\n');
  expect(prose).not.toMatch(/Iron Ford|Lantern|Main Street|\{(?:town|creek|main_street|back_road)\}/);
  if (t.site.landmarks?.back_road !== 'Ridge Road') expect(prose).not.toContain('Ridge Road');
  expect(prose).toContain(t.site.name);
  expect(prose).toContain(t.site.landmarks?.main_street);
  expect(prose).toContain(t.site.landmarks?.back_road);
  expect(prose).toContain(t.site.landmarks?.creek);
  const tavern = Object.values(sim.world.places).find((p) => p.tags.includes('tavern'));
  if (!tavern) throw new Error('no tavern');
  tavern.name = 'The Copper Bell';
  expect(atPlace(sim.world, tavern.id)).toBe('at the Copper Bell');
});
