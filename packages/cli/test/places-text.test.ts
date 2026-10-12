/**
 * Place names and descriptions (wave 5 group D; playtest r2): generated towns give every place a
 * name and a description of its own, with no coordinates; authored places carry no placeholder or
 * meta text, and base text shows a newcomer only what a newcomer would see.
 */
import { ScenarioSchema } from '@coulee/content/schema';
import { GEN_VERSION } from '@coulee/worldgen';
import { describe, expect, it } from 'vitest';
import { settlement, terrain } from '../../worldgen/src/layout.ts';
import { populate } from '../../worldgen/src/population.ts';
import { seedTensions } from '../../worldgen/src/tensions.ts';
import { nameAndDescribe, placeTextProblems } from '../../worldgen/src/text.ts';
import { baseContent } from './helpers.ts';

function town(seed: number, preset?: 'river') {
  const recipe = { genVersion: GEN_VERSION, seed, ...(preset ? { preset } : {}) };
  const t = terrain(recipe);
  const homes = settlement(recipe, t);
  const scenario = ScenarioSchema.parse({ id: t.site.id, site: t.site.id, name: t.site.name });
  const { means } = populate(baseContent(), recipe, scenario, homes);
  seedTensions(baseContent(), recipe, scenario);
  nameAndDescribe({
    content: baseContent(),
    recipe,
    site: t.site,
    places: t.places,
    scenario,
    creek: t.creek,
    ford: t.ford,
    means,
  });
  return { site: t.site, places: t.places, scenario };
}

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

describe('generated towns: every place reads as itself', () => {
  it.each(SEEDS)('seed %i: distinct names, distinct descriptions, no coordinates, nothing unfinished', (seed) => {
    const t = town(seed);
    expect(placeTextProblems(t.places), `seed ${seed}`).toEqual([]);
    for (const p of t.places) {
      expect(p.description.length, p.id).toBeGreaterThan(40);
      expect(`${p.name} ${p.description}`, p.id).not.toMatch(/\(\d+,\s*\d+\)/);
    }
  });

  it('never reuses a sentence between two places of one town (seeds 1-60, both presets)', () => {
    for (const seed of Array.from({ length: 60 }, (_, i) => i + 1)) {
      for (const preset of [undefined, 'river'] as const) {
        const t = town(seed, preset);
        const seen = new Map<string, string>();
        for (const p of t.places)
          for (const sentence of p.description.replace(/\b(Mr|Mrs|Rev)\./g, '$1').split(/(?<=\.)\s+/)) {
            const other = seen.get(sentence);
            expect(other === undefined || other === p.id, `seed ${seed}: "${sentence}" in ${p.id} and ${other}`).toBe(
              true,
            );
            seen.set(sentence, p.id);
          }
      }
    }
  });

  it('river towns too (the landing has its own text)', () => {
    for (const seed of [3, 12, 29]) {
      const t = town(seed, 'river');
      expect(placeTextProblems(t.places), `seed ${seed}`).toEqual([]);
      expect(t.places.find((p) => p.tags.includes('landing'))?.description).toMatch(/flatboat/);
    }
  });

  it('names follow the owners: farms and their fields carry the family, the street reaches are told apart', () => {
    const t = town(7);
    const families = new Set(t.scenario.actors.map((a) => a.family));
    const farms = t.places.filter((p) => p.kind === 'farmstead');
    expect(farms.length).toBeGreaterThanOrEqual(3);
    for (const f of farms) {
      expect(f.name).toMatch(/ Farm$/);
      expect(families.has(f.name.replace(/ Farm$/, ''))).toBe(true);
    }
    const streets = t.places.filter((p) => p.name.startsWith(t.site.landmarks?.main_street ?? '###'));
    expect(streets.map((p) => p.name).sort()).toEqual([
      `${t.site.landmarks?.main_street}, north of the ford`,
      `${t.site.landmarks?.main_street}, south of the ford`,
    ]);
    const smithy = t.places.find((p) => p.tags.includes('smithy'));
    expect(smithy?.name).toMatch(/'s? Smithy$/);
    // The smithy's description is built from the smithy, not from a template with its name cut off.
    expect(smithy?.description).not.toMatch(/stands at|on the village map/);
  });

  it('is deterministic and uses its own RNG keys (the same seed gives the same text twice)', () => {
    const a = town(11);
    const b = town(11);
    expect(JSON.stringify(a.places)).toBe(JSON.stringify(b.places));
    // And towns differ from each other.
    expect(
      town(12)
        .places.map((p) => p.description)
        .join('|'),
    ).not.toBe(a.places.map((p) => p.description).join('|'));
  });

  it('tells farms apart by position: the head of the coulee is not the bottom land', () => {
    const t = town(5);
    const farms = t.places.filter((p) => p.kind === 'farmstead').map((p) => p.description);
    expect(new Set(farms).size).toBe(farms.length);
    const first = t.places.find((p) => p.id.endsWith('_farm0'));
    expect(first?.description).toMatch(/frost/);
  });
});

describe('authored places', () => {
  const places = Object.values(baseContent().places);

  it('carry no placeholder, consultation or unfinished text', () => {
    for (const p of places)
      expect(`${p.name} ${p.description}`, p.id).not.toMatch(
        /placeholder|awaiting|consultation|\bTODO\b|\bTBD\b|lorem|\(\d+,\s*\d+\)/i,
      );
  });

  it('give a newcomer what a newcomer sees: no fae lore in base text', () => {
    for (const p of places)
      expect(p.description, p.id).not.toMatch(/\bfae\b|faerie|knocker-held|refuge from|between town and/i);
  });

  it('describe every place (houses, fields and barns too)', () => {
    for (const p of places) expect(p.description.length, p.id).toBeGreaterThan(30);
  });

  it('Pratt keeps a real description of its ginseng and fur trade', () => {
    const pratt = places.find((p) => p.id === 'pratt_daughter_outfitters');
    expect(pratt?.description).toMatch(/ginseng/);
    expect(pratt?.description).not.toMatch(/placeholder/);
  });

  it("the Cold Stair describes cold air and rime, and says nothing about what it's a refuge from", () => {
    const stair = places.find((p) => p.id === 'cold_stair');
    expect(stair?.description).toMatch(/cold air/i);
    expect(stair?.description).not.toMatch(/fae|refuge/i);
  });
});
