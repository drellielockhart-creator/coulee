/**
 * module:content-world acceptance: peoples, cultures, name pools, occupations, the Iron Ford
 * site and the Iron Ford scenario (01 §8, 12 §10/§13).
 */
import { createSim, runHours, toViewModel } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { actorByKey, baseContent } from './helpers.ts';

const content = baseContent();
const scenario = content.scenarios.iron_ford;
if (!scenario) throw new Error('iron_ford scenario missing');

const STRUCTURE_KINDS = new Set(['building', 'house', 'farmstead', 'landing']);
const actorByKeyDef = (k: string) => scenario.actors.find((a) => a.key === k);

describe('peoples (12 §10, §13)', () => {
  it('has the four peoples, with shadow_faekin concealed', () => {
    expect(Object.keys(content.peoples).sort()).toEqual(['elf', 'goblin', 'human', 'shadow_faekin']);
    const f = content.peoples.shadow_faekin;
    expect(f?.concealed).toBe(true);
    expect(f?.passes_as).toEqual(['human', 'elf']);
    expect(content.peoples.human?.concealed).toBe(false);
  });

  it('applies the 12 §13 divergences', () => {
    const { elf, goblin, human, shadow_faekin: faekin } = content.peoples;
    expect(elf?.maturity_age).toBe(25);
    expect(elf?.lifespan).toMatchObject({ middle: 70, old: 110, venerable: 150, max_roll: '3d20' });
    expect(elf?.fae_notice_mod).toBe(-2);
    expect(elf?.fae.pull_from_fi).toBe(3);
    expect(elf?.fae.drift_gain_pct).toEqual([
      [0, 50],
      [40, 200],
    ]);
    expect(elf?.fae.weakness_drift_offset).toBe(-10);
    expect(goblin?.maturity_age).toBe(14);
    expect(goblin?.lifespan).toMatchObject({ middle: 40, old: 60, venerable: 80 });
    expect(goblin?.senses).toContain('darkvision');
    expect(goblin?.darkvision_ft).toBe(60);
    expect(goblin?.kcal_pct).toBe(70);
    expect(goblin?.fae.comfort_underground).toEqual({ min: 0, max: 4 });
    expect(faekin?.fae.weakness_drift_offset).toBe(30);
    expect(faekin?.fae.drift_floor).toBe(10);
    expect(faekin?.fae.bound_rate_pct).toBe(50);
    expect(human?.kcal_pct).toBe(100);
  });

  it('keeps literacy off the peoples and on the cultures', () => {
    for (const p of Object.values(content.peoples)) expect(p.literacy_pct).toBeUndefined();
    for (const c of Object.values(content.cultures)) expect(c.literacy_pct).toBeGreaterThan(0);
  });

  it('keeps ability mods to STR/DEX/CON +-1', () => {
    for (const p of Object.values(content.peoples)) {
      for (const k of ['int', 'wis', 'cha'] as const) expect(p.ability_mods[k] ?? 0).toBe(0);
      for (const k of ['str', 'dex', 'con'] as const) expect(Math.abs(p.ability_mods[k] ?? 0)).toBeLessThanOrEqual(1);
    }
  });
});

describe('cultures and name pools', () => {
  it('covers the settler cultures plus Hall elves and goblin pares', () => {
    for (const id of [
      'yankee',
      'norwegian',
      'german',
      'cornish',
      'irish',
      'black_ohio',
      'elf_hall',
      'goblin_pare',
    ] as const) {
      expect(content.cultures[id], id).toBeDefined();
    }
  });

  it('has pools for Yankee, German, Norwegian, Cornish, Irish, Swiss, Black Ohio, elves and goblins', () => {
    for (const id of [
      'yankee',
      'german',
      'norwegian',
      'cornish',
      'irish',
      'swiss',
      'black_ohio',
      'elf_hall',
      'goblin_pare',
    ]) {
      expect(content.namePools[id], id).toBeDefined();
    }
    expect(content.namePools.elf_hall?.private_names.length).toBeGreaterThan(0);
    expect(content.namePools.goblin_pare?.private_names.length).toBeGreaterThan(0);
    expect(content.namePools.faekin_dusk?.private_names.length).toBeGreaterThan(0);
    // goblins share the Cornish and German pools (12 §8.4); faekin draw from presenting communities.
    expect(content.namePools.cornish?.peoples).toContain('goblin');
    expect(content.namePools.german?.peoples).toContain('goblin');
    expect(content.namePools.yankee?.peoples).toContain('shadow_faekin');
  });
});

describe('occupations', () => {
  it('has every occupation the brief names, each with a schedule', () => {
    const need = [
      'storekeeper',
      'blacksmith',
      'miller',
      'tavern_keeper_jp',
      'pastor',
      'lay_preacher',
      'mine_captain',
      'miner',
      'surveyor',
      'chainman',
      'editor_printer',
      'schoolteacher',
      'farmer',
      'farm_wife',
      'hired_hand',
      'child',
      'militia_captain',
      'pellar',
      'woodyard_cutter',
      'ferryman',
    ];
    for (const id of need) {
      const o = content.occupations[id];
      expect(o, id).toBeDefined();
      expect(o?.schedule.length, id).toBeGreaterThan(0);
    }
  });

  it('every weekday schedule has a sleep block', () => {
    for (const o of Object.values(content.occupations)) {
      if (o.id === 'missing') continue; // held by the court: no sleep block, by design
      const wed = o.schedule.filter((b) => !b.days || b.days.includes('wed'));
      expect(wed.length, o.id).toBeGreaterThan(0);
      expect(
        wed.some((b) => content.activities[b.activity]?.asleep),
        `${o.id} sleeps`,
      ).toBe(true);
    }
  });
});

describe('the Iron Ford site', () => {
  const site = content.sites.iron_ford;
  const places = Object.values(content.places).filter((p) => p.site === 'iron_ford');

  it('is a 64x48 grid with the places 01 §8.2 names', () => {
    expect(site?.grid).toEqual({ w: 64, h: 48 });
    for (const id of [
      'haugen_mill',
      'mill_dam',
      'brenner_smithy',
      'iron_ford',
      'pratt_daughter_outfitters',
      'dunleavys_tavern',
      'sentinel_print_shop',
      'schoolhouse',
      'lutheran_church',
      'trevenna_house',
      'ferry_landing',
      'hasp_creek',
    ]) {
      expect(content.places[id], id).toBeDefined();
    }
    expect(places.some((p) => p.kind === 'farmstead')).toBe(true);
    expect(content.places.trevenna_house?.tags).toContain('meeting');
  });

  it('gives every structure a footprint that overlaps no other structure', () => {
    const structs = places.filter((p) => STRUCTURE_KINDS.has(p.kind));
    expect(structs.length).toBeGreaterThanOrEqual(20);
    for (let i = 0; i < structs.length; i++) {
      for (let j = i + 1; j < structs.length; j++) {
        const a = structs[i];
        const b = structs[j];
        if (!a || !b) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('keeps every place on the grid', () => {
    for (const p of places) {
      expect(p.x + p.w).toBeLessThanOrEqual(64);
      expect(p.y + p.h).toBeLessThanOrEqual(48);
    }
  });
});

describe('the Iron Ford scenario (01 §8.3)', () => {
  it('has 30-40 actors in at least 8 households', () => {
    expect(scenario.actors.length).toBeGreaterThanOrEqual(30);
    expect(scenario.actors.length).toBeLessThanOrEqual(40);
    expect(scenario.households.length).toBeGreaterThanOrEqual(8);
  });

  it('gives every household a home place, distinct homes never overlapping', () => {
    const homes = [...new Set(scenario.households.map((h) => h.home))];
    for (const h of scenario.households) expect(content.places[h.home], h.key).toBeDefined();
    for (let i = 0; i < homes.length; i++) {
      for (let j = i + 1; j < homes.length; j++) {
        const a = content.places[homes[i] ?? ''];
        const b = content.places[homes[j] ?? ''];
        if (!a || !b) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('gives every actor an occupation with a schedule and a household', () => {
    const hhKeys = new Set(scenario.households.map((h) => h.key));
    for (const a of scenario.actors) {
      expect(hhKeys.has(a.household), `${a.key} household`).toBe(true);
      const occ = content.occupations[a.occupation];
      expect(occ?.schedule.length, `${a.key} schedule`).toBeGreaterThan(0);
      expect(a.culture, `${a.key} culture`).toBeDefined();
    }
    for (const h of scenario.households) {
      expect(
        scenario.actors.some((a) => a.key === h.head && a.household === h.key),
        `${h.key} head`,
      ).toBe(true);
    }
  });

  it('contains every named NPC from 01 §8.3', () => {
    const named = [
      'gussie_pratt',
      'lydia_pratt',
      'johann_brenner',
      'anders_tveit',
      'siri_kvale',
      'josiah_trevenna',
      'loveday_trevenna',
      'amos_whitcomb',
      'horace_bell',
      'michael_dunleavy',
      'nora_dunleavy',
      'elias_hurd',
      'clara_stoughton',
      'thomas_glover',
      'harriet_glover',
      'tollef_haugen',
    ];
    const keys = new Set(scenario.actors.map((a) => a.key));
    for (const k of named) expect(keys.has(k), k).toBe(true);
  });

  it('lists at least 8 tensions, each naming real actors', () => {
    expect(scenario.tensions.length).toBeGreaterThanOrEqual(8);
    const keys = new Set(scenario.actors.map((a) => a.key));
    const tkeys = scenario.tensions.map((t) => t.key);
    for (const k of [
      'pratt_debt',
      'brenner_vs_tveit',
      'tveit_vs_kvale',
      'glovers_vs_speculator',
      'lydia_and_the_chainman',
      'trevenna_between',
      'nora_changeling_fear',
      'hurd_needs_an_enemy',
    ]) {
      expect(tkeys, k).toContain(k);
    }
    for (const t of scenario.tensions) {
      expect(t.actors.length, t.key).toBeGreaterThan(0);
      for (const a of t.actors) expect(keys.has(a), `${t.key}: ${a}`).toBe(true);
    }
  });

  it('includes a concealed shadow-faekin, elves and goblins; authors no Ho-Chunk actor', () => {
    const by = (p: string) => scenario.actors.filter((a) => a.ancestry === p);
    const faekin = by('shadow_faekin');
    expect(faekin.length).toBeGreaterThanOrEqual(1);
    expect(by('elf').length).toBeGreaterThanOrEqual(2);
    expect(by('goblin').length).toBeGreaterThanOrEqual(1);
    for (const f of faekin) {
      const peopleDef = content.peoples[f.ancestry];
      expect(peopleDef?.concealed).toBe(true);
      expect(peopleDef?.passes_as).toContain(f.presents_as);
      expect(
        scenario.secrets.some((s) => s.holder === f.key && s.prop.pred === 'faekin' && s.prop.args[0] === f.key),
        `${f.key} secret faekin(self)`,
      ).toBe(true);
    }
    // The Glovers are never faekin or special-gifted (01 §8.3, 12 §6.3).
    for (const k of ['thomas_glover', 'harriet_glover', 'isaiah_glover']) {
      expect(actorByKeyDef(k)?.ancestry).toBe('human');
    }
    expect(JSON.stringify(scenario.actors).toLowerCase()).not.toContain('ho-chunk');
  });

  it('honors presents_as in the view model for non-omniscient viewers', () => {
    const sim = createSim(content, { scenarioId: 'iron_ford', seed: 42 });
    const hester = actorByKey(sim, 'hester_fenn');
    const edwin = actorByKey(sim, 'edwin_fenn');
    const outside = toViewModel(sim.world, content, {
      perspective: actorByKey(sim, 'gussie_pratt'),
      omniscient: false,
    });
    expect(outside.actors.find((a) => a.id === hester)?.people).toBe('Human');
    const self = toViewModel(sim.world, content, { perspective: hester, omniscient: false });
    expect(self.actors.find((a) => a.id === hester)?.people).toBe('Shadow-faekin');
    const god = toViewModel(sim.world, content, { perspective: null, omniscient: true });
    expect(god.actors.find((a) => a.id === edwin)?.people).toBe('Shadow-faekin');
  });

  it('references only authored final ability scores (no ancestry mods baked in or double-applied)', () => {
    for (const a of scenario.actors) {
      for (const v of Object.values(a.abilities)) {
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThanOrEqual(18);
      }
    }
    // Infant carries only baby scores: the only actor under 3 in any ability.
    expect(scenario.actors.filter((a) => a.age === 0).map((a) => a.key)).toEqual(['brigid_dunleavy']);
  });

  it('seeds opinions with reasons, relationships, figures, beliefs, secrets and grudges', () => {
    expect(scenario.opinions.length).toBeGreaterThanOrEqual(30);
    for (const o of scenario.opinions) expect(o.reason.length, `${o.from}->${o.to}`).toBeGreaterThan(5);
    expect(scenario.relationships.length).toBeGreaterThanOrEqual(40);
    expect(scenario.figures.length).toBeGreaterThanOrEqual(1);
    expect(scenario.beliefs.length).toBeGreaterThanOrEqual(3);
    expect(scenario.secrets.length).toBeGreaterThanOrEqual(6);
    expect(scenario.grudges.length).toBeGreaterThanOrEqual(8);
    expect(scenario.relationships.some((r) => r.kind === 'creditor' && (r.amount_cents ?? 0) > 0)).toBe(true);
  });
});

describe('larders (P8): April 1855 is the lean season, and larders differ', () => {
  const KCAL_PER_ADULT_DAY = 2400;
  function foodDays(householdKey: string): number {
    const members = scenario.actors.filter((a) => a.household === householdKey);
    const hh = scenario.households.find((h) => h.key === householdKey);
    if (!hh) throw new Error(householdKey);
    let kcal = 0;
    for (const s of hh.pantry) kcal += (content.items[s.item]?.food?.kcal ?? 0) * s.qty;
    const eaters = members.filter((m) => m.occupation !== 'missing');
    const need = eaters.reduce(
      (n, m) => n + (m.age === 0 ? 400 : (KCAL_PER_ADULT_DAY * (content.peoples[m.ancestry]?.kcal_pct ?? 100)) / 100),
      0,
    );
    return need === 0 ? 0 : Math.round(kcal / need);
  }

  it('the Fenns of the lower coulee are days from empty; the Glovers upslope are not', () => {
    const fenn = foodDays('fenn');
    const glover = foodDays('glover');
    expect(fenn).toBeLessThanOrEqual(14);
    expect(glover).toBeGreaterThanOrEqual(3 * fenn);
    expect(glover).toBeGreaterThanOrEqual(30);
  });

  it('prosperous households (Pratt, Haugen) hold more food-days than the failing one', () => {
    const fenn = foodDays('fenn');
    expect(foodDays('pratt')).toBeGreaterThan(fenn * 2);
    expect(foodDays('haugen')).toBeGreaterThan(fenn * 2);
  });

  it('no two households have identical pantries, and mixed foods (not just flour) appear', () => {
    const sigs = scenario.households.map((h) =>
      JSON.stringify([...h.pantry].sort((a, b) => a.item.localeCompare(b.item))),
    );
    expect(new Set(sigs).size).toBe(sigs.length);
    const foods = new Set<string>();
    for (const h of scenario.households) for (const s of h.pantry) if (content.items[s.item]?.food) foods.add(s.item);
    expect(foods.size).toBeGreaterThanOrEqual(20);
  });

  it('almost no one has fresh greens or fruit in April (scurvy line: dried apples, sauerkraut, potatoes)', () => {
    for (const h of scenario.households) {
      for (const s of h.pantry) {
        expect(['ramps_fresh', 'morels_fresh', 'wild_greens'].includes(s.item), `${h.key} ${s.item}`).toBe(false);
      }
    }
  });

  it('the Outfitter stocks the groceries and gear the planner needs', () => {
    const store = scenario.stocks.find((s) => s.place === 'pratt_daughter_outfitters');
    const ids = new Set(store?.items.map((i) => i.item));
    for (const id of [
      'flour',
      'hardtack',
      'salt_pork',
      'coffee_green',
      'dried_apples',
      'camp_kettle_pair',
      'lucifers_box',
    ])
      expect(ids.has(id), id).toBe(true);
  });

  it('keeps nested pantry stacks inside container capacity', () => {
    for (const h of scenario.households) {
      const loads: Record<string, number> = {};
      for (const s of h.pantry) {
        if (!s.in) continue;
        loads[s.in] = (loads[s.in] ?? 0) + (content.items[s.item]?.weight_g ?? 0) * s.qty;
      }
      for (const [cid, g] of Object.entries(loads)) {
        const cap = content.items[cid]?.container?.capacity_g ?? 0;
        expect(g, `${h.key}: ${cid}`).toBeLessThanOrEqual(cap);
      }
    }
  });
});

describe('the run', () => {
  it('Iron Ford runs for a week and the survey party keeps its missing chainmen at the court and the Cold Stair', () => {
    const sim = createSim(content, { scenarioId: 'iron_ford', seed: 42 });
    runHours(sim, 24 * 7);
    const placeOf = (k: string) => sim.world.places[sim.world.actors[actorByKey(sim, k)]?.placeId ?? -1]?.defId;
    expect(placeOf('tobias_vik')).toBe('lantern_spring');
    expect(placeOf('ezra_sloat')).toBe('cold_stair');
  });
});
