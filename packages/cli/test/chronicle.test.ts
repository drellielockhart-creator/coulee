/**
 * module:chronicle integration tests (MODULES.md acceptance):
 *  - templates render from synthetic events (insult, shortage, escalation, defense);
 *  - each pattern detector has positive and negative cases on synthetic logs;
 *  - privacy: entries never reference events above the viewer's knowledge;
 *  - determinism and save/load;
 *  - a seed-42 golden chronicle (a chronicle diff is a design review: update it deliberately).
 */
import {
  appendEvent,
  asGameMinute,
  belief,
  chronicle,
  createSim,
  type EventInput,
  findNonIntegers,
  makeContext,
  provisions,
  restoreSim,
  runHours,
  type Sim,
  shortName,
  social,
  stateHash,
  toViewModel,
  type World,
} from '@coulee/core';
import { sessionSim } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { PATTERNS } from '../../core/src/chronicle/patterns/index.ts';
import { runScenario } from '../src/harness.ts';
import { baseContent } from './helpers.ts';

const content = baseContent();
const DAY = 1440;

// ---- synthetic-event harness -----------------------------------------------------------------

function newSim(opts: { player?: boolean } = {}): Sim {
  const sim = createSim(content, { scenarioId: 'iron_ford', seed: 1, withPlayer: opts.player === true });
  // Skip the scenario's seeded events: each test builds the log it wants.
  sim.world.chronicle.cursor = sim.world.log.lastId;
  return sim;
}

function who(sim: Sim, key: string): number {
  const id = sim.world.index.actorByKey[key];
  if (id === undefined) throw new Error(`no actor ${key}`);
  return id;
}

function place(sim: Sim, def = 'dunleavys_tavern'): number {
  return sim.world.index.placeByDef[def] ?? 0;
}

function emit(sim: Sim, input: EventInput, t: number): number {
  return appendEvent(sim.world.log, input, asGameMinute(t));
}

/** Run the chronicle system at game minute `t`. */
function sift(sim: Sim, t: number): void {
  sim.world.time = asGameMinute(t);
  chronicle.chronicleSystem(sim.world, makeContext(sim.world, sim.content, []));
}

type Vis = 'public' | 'witnessed' | 'private' | 'secret' | 'inner';

function interaction(
  sim: Sim,
  id: string,
  a: number,
  b: number,
  t: number,
  o: { vis?: Vis; success?: boolean; importance?: number; witnesses?: number[] } = {},
): number {
  const placeId = place(sim);
  return emit(
    sim,
    {
      kind: 'social.interaction',
      visibility: o.vis ?? 'public',
      place: placeId as never,
      ...(o.importance !== undefined ? { importance: o.importance } : { importance: 45 }),
      roles: [
        { actor: a as never, role: 'agent' },
        { actor: b as never, role: 'target' },
        ...(o.witnesses ?? []).map((w) => ({ actor: w as never, role: 'witness' as const })),
      ],
      data: {
        interactionId: id,
        initiatorId: a as never,
        targetId: b as never,
        placeId: placeId as never,
        success: o.success ?? true,
        label: id,
      },
    },
    t,
  );
}

function shortage(
  sim: Sim,
  householdKey: string,
  t: number,
  o: { vis?: Vis; days?: number; ration?: number } = {},
): number {
  const hid = sim.world.index.householdByKey[householdKey];
  if (hid === undefined) throw new Error(`no household ${householdKey}`);
  const members = sim.world.households[hid]?.memberIds ?? [];
  return emit(
    sim,
    {
      kind: 'provisions.shortage',
      visibility: o.vis ?? 'public',
      roles: members.map((m) => ({ actor: m, role: 'participant' as const })),
      data: { householdId: hid, daysOfFoodTenths: o.days ?? 120, rationPct: o.ration ?? 90 },
    },
    t,
  );
}

function entriesOf(sim: Sim, pattern: string) {
  return chronicle.chronicleEntries(sim.world, { pattern });
}

function nonHeading(world: World) {
  return world.chronicle.entries.filter((e) => !(e.voice === 'almanac' && e.importance === 0));
}

/** P1: no entry may cite an event above its own knowledge basis. */
function assertNoLeak(sim: Sim): void {
  const byId = new Map(sim.world.log.events.map((e) => [e.id as number, e]));
  for (const e of sim.world.chronicle.entries) {
    if (e.knowledge === 'omniscient') continue;
    for (const src of e.sourceEventIds) {
      const ev = byId.get(src as number);
      expect(ev, `entry ${e.id} cites unknown event ${src}`).toBeDefined();
      if (!ev) continue;
      if (e.knowledge === 'public') {
        expect(ev.visibility, `public entry ${e.id} (${e.pattern ?? e.templateId}) cites a non-public event`).toBe(
          'public',
        );
      } else {
        const known = ev.visibility === 'public' || ev.roles.some((r) => (e.knownBy ?? []).includes(r.actor));
        expect(known, `${e.knowledge} entry ${e.id} cites an event its readers could not know`).toBe(true);
      }
    }
    if (e.knowledge !== 'public') expect((e.knownBy ?? []).length).toBeGreaterThan(0);
  }
}

function noArtifacts(text: string): void {
  expect(text).not.toMatch(/[{}]|#[a-z_]+#/);
  expect(text).not.toMatch(/ {2}| [,.;:!?]|\bundefined\b|\bnull\b|\[object/);
  expect(text.trim()).toBe(text);
}

// ---- the almanac (stub fallback) ---------------------------------------------------------------

describe('almanac fallback', () => {
  it('renders one clean line per day when nothing else happens (acceptance 1, stubs)', () => {
    const sim = newSim();
    for (let d = 0; d < 60; d++) {
      const t = d * DAY;
      emit(
        sim,
        {
          kind: 'core.day_started',
          data: {
            dayIndex: d,
            year: 1855,
            month: 4,
            day: 1,
            weekday: 'sun',
            season: 'spring',
            moon: 'new',
            isSabbath: d % 7 === 0,
          },
        },
        t,
      );
      sift(sim, t);
    }
    const lines = sim.world.chronicle.entries.filter((e) => e.voice === 'almanac' && e.importance === 0);
    expect(lines.length).toBe(60);
    for (const l of lines) noArtifacts(l.text);
    const md = chronicle.renderChronicleMarkdown(sim.world, content, 'Quiet');
    expect(md).toContain('## Week 1');
    expect(md).not.toContain('## Epilogue');
    expect(findNonIntegers(sim.world)).toEqual([]);
  });

  it('varies the almanac line and marks the Sabbath', () => {
    const sim = newSim();
    const texts = new Set<string>();
    for (let d = 0; d < 28; d++) {
      const t = d * DAY;
      const cal = { weekday: (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[d % 7] ?? 'sun' };
      emit(
        sim,
        {
          kind: 'core.day_started',
          data: {
            dayIndex: d,
            year: 1855,
            month: 4,
            day: 1 + d,
            weekday: cal.weekday,
            season: 'spring',
            moon: 'full',
            isSabbath: d % 7 === 0,
          },
        },
        t,
      );
      sift(sim, t);
    }
    for (const e of sim.world.chronicle.entries) texts.add(e.text);
    expect(texts.size).toBeGreaterThan(5);
    const sabbaths = sim.world.chronicle.entries.filter((e) => /Sabbath|Lord's day/.test(e.text));
    expect(sabbaths.length).toBe(4);
  });
});

// ---- single-event templates (acceptance 1) ---------------------------------------------------------

describe('templates on synthetic events', () => {
  it('renders a public insult in the Paper, with formal names and the place', () => {
    const sim = newSim();
    const gussie = who(sim, 'gussie_pratt');
    const johann = who(sim, 'johann_brenner');
    interaction(sim, 'insult', gussie, johann, 600);
    sift(sim, 600);
    const [e] = sim.world.chronicle.entries.filter((x) => x.voice === 'paper');
    expect(e).toBeDefined();
    expect(e?.knowledge).toBe('public');
    expect(e?.text).toMatch(/Mrs\. A\. Pratt/);
    expect(e?.text).toMatch(/Mr\. J\. Brenner/);
    expect(e?.text).toMatch(/Dunleavy/);
    expect(e?.sourceEventIds.length).toBe(1);
    noArtifacts(e?.text ?? '');
    assertNoLeak(sim);
  });

  it('renders a public shortage (the household named, no private figures)', () => {
    const sim = newSim();
    shortage(sim, 'brenner', 600, { days: 20, ration: 70 });
    sift(sim, 600);
    const e = sim.world.chronicle.entries.find((x) => x.voice === 'paper');
    expect(e).toBeDefined();
    expect(e?.text).toMatch(/Brenner/);
    noArtifacts(e?.text ?? '');
    assertNoLeak(sim);
  });

  it('renders a belief escalation in the Paper, naming the person', () => {
    const sim = newSim();
    const loveday = who(sim, 'loveday_trevenna');
    emit(
      sim,
      {
        kind: 'belief.escalation',
        visibility: 'public',
        data: { target: `actor:${loveday}`, from: 1, to: 2, heat: 200, consensus: 400 },
      },
      900,
    );
    sift(sim, 900);
    const e = sim.world.chronicle.entries.find((x) => x.voice === 'paper');
    expect(e?.text).toMatch(/Trevenna/);
    expect(e?.text).toMatch(/accus|named|openly/i);
    noArtifacts(e?.text ?? '');
  });

  it('reports a misfortune the whole village knows of, and the Sabbath services in the weekly Almanac', () => {
    const sim = newSim();
    const victim = who(sim, 'clara_stoughton');
    emit(
      sim,
      {
        kind: 'belief.misfortune',
        visibility: 'public',
        importance: 55,
        roles: [{ actor: victim as never, role: 'victim' }],
        data: { misfortuneId: 99, kindId: 'butter_wont_come', text: "the butter won't come in the Stoughtons' churn" },
      },
      900,
    );
    const church = Object.values(sim.world.places).find((p) => p.tags.includes('church'));
    expect(church).toBeDefined();
    const members = Object.values(sim.world.actors)
      .slice(0, 19)
      .map((a) => a.id);
    emit(
      sim,
      {
        kind: 'activity.gathering',
        visibility: 'public',
        roles: [],
        data: {
          observanceId: 'palm_sunday',
          activityId: 'attend_church',
          actorIds: members,
          placeId: church?.id as never,
        },
      },
      1000,
    );
    emit(
      sim,
      {
        kind: 'activity.observance',
        visibility: 'public',
        importance: 10,
        roles: [],
        data: { observanceId: 'market_day', name: 'Market day' },
      },
      1100,
    );
    sift(sim, 1100);
    const paper = sim.world.chronicle.entries.find((e) => e.voice === 'paper');
    expect(paper?.text).toMatch(/butter won't come/);
    noArtifacts(paper?.text ?? '');
    emit(
      sim,
      {
        kind: 'core.day_started',
        data: {
          dayIndex: 7,
          year: 1855,
          month: 4,
          day: 8,
          weekday: 'sun',
          season: 'spring',
          moon: 'full',
          isSabbath: true,
        },
      },
      7 * DAY,
    );
    sift(sim, 7 * DAY);
    const almanac = sim.world.chronicle.entries.find((e) => e.kind === 'digest' && e.voice === 'almanac');
    expect(almanac?.text).toMatch(/Divine service drew nineteen to /);
    expect(almanac?.text).toMatch(/Market day was kept/);
    noArtifacts(almanac?.text ?? '');
  });

  it('resolves a belief target given by display name, as the belief module labels it', () => {
    const sim = newSim();
    const loveday = who(sim, 'loveday_trevenna');
    emit(
      sim,
      {
        kind: 'belief.escalation',
        visibility: 'public',
        importance: 70,
        roles: [{ actor: loveday as never, role: 'target' }],
        data: { target: 'Loveday Trevenna', from: 2, to: 3, heat: 300, consensus: 500 },
      },
      900,
    );
    sift(sim, 900);
    const e = sim.world.chronicle.entries.find((x) => x.voice === 'paper');
    expect(e?.actorIds[0]).toBe(loveday);
    expect(e?.text).toMatch(/Mrs\. L\. Trevenna/);
    expect(e?.text).toMatch(/shunn|credit|gate|made up its mind/i);
  });

  it('renders an inner defense only in the epilogue, never in the Paper', () => {
    const sim = newSim();
    const a = who(sim, 'gussie_pratt');
    const b = who(sim, 'lydia_pratt');
    emit(
      sim,
      {
        kind: 'psyche.defense',
        visibility: 'inner',
        importance: 60,
        roles: [{ actor: a as never, role: 'agent' }],
        data: {
          actorId: a as never,
          defense: 'projection',
          targetId: b as never,
          label: 'x',
          anxietyBefore: 600,
          anxietyAfter: 400,
        },
      },
      700,
    );
    sift(sim, 700);
    const entries = nonHeading(sim.world);
    expect(entries.length).toBe(1);
    expect(entries[0]?.voice).toBe('epilogue');
    expect(entries[0]?.knowledge).toBe('omniscient');
    noArtifacts(entries[0]?.text ?? '');
    expect(
      chronicle
        .chronicleEntries(sim.world, { viewer: { perspective: null, omniscient: false } })
        .some((x) => x.voice === 'epilogue'),
    ).toBe(false);
  });

  it('every non-heading entry from a mixed batch is free of template artifacts', () => {
    const sim = newSim();
    const g = who(sim, 'gussie_pratt');
    const j = who(sim, 'johann_brenner');
    const m = who(sim, 'michael_dunleavy');
    let t = 600;
    for (const id of [
      'insult',
      'mock',
      'fight',
      'threaten',
      'forgive',
      'apologize',
      'court',
      'propose',
      'dun',
      'repay',
      'lend',
      'gift',
      'help',
      'comfort',
    ]) {
      t += 400;
      interaction(sim, id, g, j, t, { importance: 60 });
      t += 400;
      interaction(sim, id, m, g, t, { importance: 60, success: false });
      sift(sim, t);
    }
    for (const e of nonHeading(sim.world)) noArtifacts(e.text);
    expect(nonHeading(sim.world).length).toBeGreaterThan(8);
  });
});

// ---- pattern detectors: positive and negative -------------------------------------------------------

describe('pattern: feud', () => {
  it('fires when harm alternates between two households', () => {
    const sim = newSim();
    const g = who(sim, 'gussie_pratt');
    const j = who(sim, 'johann_brenner');
    interaction(sim, 'insult', g, j, 1000);
    interaction(sim, 'insult', j, g, 1000 + DAY);
    interaction(sim, 'insult', g, j, 1000 + 2 * DAY);
    sift(sim, 1000 + 2 * DAY);
    const feud = entriesOf(sim, 'feud');
    expect(feud.length).toBeGreaterThan(0);
    expect(feud.some((e) => e.voice === 'paper' && /Pratt/.test(e.text) && /Brenner/.test(e.text))).toBe(true);
    for (const e of feud) noArtifacts(e.text);
    assertNoLeak(sim);
  });

  it('does not fire on one-sided harm, or on a quarrel inside one household', () => {
    const sim = newSim();
    const g = who(sim, 'gussie_pratt');
    const l = who(sim, 'lydia_pratt');
    const j = who(sim, 'johann_brenner');
    for (let i = 0; i < 4; i++) interaction(sim, 'insult', g, j, 1000 + i * DAY);
    for (let i = 0; i < 4; i++)
      interaction(sim, i % 2 ? 'insult' : 'mock', i % 2 ? g : l, i % 2 ? l : g, 6000 + i * DAY);
    sift(sim, 6000 + 4 * DAY);
    expect(entriesOf(sim, 'feud')).toEqual([]);
  });

  it('closes after a long quiet, with a closing entry', () => {
    const sim = newSim();
    const g = who(sim, 'gussie_pratt');
    const j = who(sim, 'johann_brenner');
    for (let i = 0; i < 4; i++) interaction(sim, 'insult', i % 2 ? j : g, i % 2 ? g : j, 1000 + i * DAY);
    sift(sim, 1000 + 4 * DAY);
    expect(entriesOf(sim, 'feud').length).toBeGreaterThan(0);
    const later = 1000 + 60 * DAY;
    emit(
      sim,
      {
        kind: 'core.day_started',
        data: {
          dayIndex: 60,
          year: 1855,
          month: 5,
          day: 31,
          weekday: 'wed',
          season: 'spring',
          moon: 'full',
          isSabbath: false,
        },
      },
      later,
    );
    sift(sim, later);
    expect(sim.world.chronicle.threads.some((t) => t.pattern === 'feud')).toBe(false);
    expect(entriesOf(sim, 'feud').some((e) => e.kind === 'closing')).toBe(true);
  });
});

describe('pattern: betrayal', () => {
  /** The helper holds the helped in regard (04 §9.2: opinion above the floor). */
  function regard(sim: Sim, from: number, to: number, affection: number): void {
    const table = sim.world.social.opinions[from as never] as Record<number, ReturnType<typeof social.emptyOpinion>>;
    const op = table[to] ?? social.emptyOpinion(to as never);
    op.base.affection = affection;
    table[to] = op;
  }

  it('fires when someone helped later harms the helper', () => {
    const sim = newSim();
    const h = who(sim, 'horace_bell');
    const e = who(sim, 'elias_hurd');
    regard(sim, h, e, 45);
    interaction(sim, 'help', h, e, 1000);
    interaction(sim, 'insult', e, h, 1000 + 5 * DAY);
    sift(sim, 1000 + 5 * DAY);
    const b = entriesOf(sim, 'betrayal');
    expect(b.length).toBeGreaterThan(0);
    expect(b[0]?.voice).toBe('paper');
    expect(b[0]?.actorIds[0]).toBe(e); // the betrayer is {actor}
    noArtifacts(b[0]?.text ?? '');
  });

  it('does not fire when the harm came first, with no help, or from a third party', () => {
    const sim = newSim();
    const h = who(sim, 'horace_bell');
    const e = who(sim, 'elias_hurd');
    const m = who(sim, 'michael_dunleavy');
    regard(sim, h, e, 45);
    interaction(sim, 'insult', e, h, 1000); // harm first
    interaction(sim, 'help', h, e, 1000 + DAY);
    interaction(sim, 'insult', m, h, 1000 + 2 * DAY); // harm from someone never helped
    interaction(sim, 'help', m, e, 1000 + 3 * DAY); // help for a different pair
    sift(sim, 1000 + 3 * DAY);
    expect(entriesOf(sim, 'betrayal')).toEqual([]);
  });

  it('ignores help between people of one house: a spat between spouses is no betrayal', () => {
    const sim = newSim();
    const h = who(sim, 'horace_bell');
    const m = who(sim, 'mercy_bell');
    regard(sim, h, m, 60);
    interaction(sim, 'help', h, m, 1000);
    interaction(sim, 'fight', m, h, 1000 + 5 * DAY);
    sift(sim, 1000 + 5 * DAY);
    expect(entriesOf(sim, 'betrayal')).toEqual([]);
  });

  it('needs a grave harm between kin in other houses, and words the betrayal in the right tense', () => {
    const sim = newSim();
    const h = who(sim, 'horace_bell');
    const e = who(sim, 'elias_hurd');
    regard(sim, h, e, 45);
    interaction(sim, 'help', h, e, 1000);
    interaction(sim, 'fight', e, h, 1000 + 5 * DAY);
    sift(sim, 1000 + 5 * DAY);
    const b = entriesOf(sim, 'betrayal');
    expect(b.length).toBeGreaterThan(0);
    for (const x of b) expect(x.text).not.toMatch(/has (since |lately )?came/);
  });

  it('does not fire when the helper never held the helped in regard', () => {
    const sim = newSim();
    const h = who(sim, 'horace_bell');
    const e = who(sim, 'elias_hurd');
    regard(sim, h, e, -10);
    interaction(sim, 'help', h, e, 1000);
    interaction(sim, 'insult', e, h, 1000 + 5 * DAY);
    sift(sim, 1000 + 5 * DAY);
    expect(entriesOf(sim, 'betrayal')).toEqual([]);
  });
});

describe('pattern: friendship', () => {
  const label = (sim: Sim, holder: number, target: number, from: string, to: string, t: number) =>
    emit(
      sim,
      {
        kind: 'social.label_changed',
        visibility: 'public',
        importance: 40,
        roles: [
          { actor: holder as never, role: 'agent' },
          { actor: target as never, role: 'target' },
        ],
        data: { holderId: holder as never, targetId: target as never, from, to },
      },
      t,
    );

  it('names an unlikely friendship when the pair were at odds first', () => {
    const sim = newSim();
    const a = who(sim, 'gussie_pratt');
    const b = who(sim, 'johann_brenner');
    label(sim, a, b, '', 'Enemy', 1000);
    interaction(sim, 'insult', a, b, 1500);
    interaction(sim, 'apologize', a, b, 1000 + 10 * DAY);
    label(sim, a, b, 'Enemy', 'Friend', 1000 + 20 * DAY);
    sift(sim, 1000 + 20 * DAY);
    const f = entriesOf(sim, 'friendship').filter((e) => e.voice === 'paper');
    expect(f.length).toBeGreaterThan(0);
    expect(f[0]?.text).toMatch(/unlikely|at odds|surpris|enemies/i);
  });

  it('does not call it unlikely when there was no quarrel, or when friendship came first', () => {
    const sim = newSim();
    const a = who(sim, 'gussie_pratt');
    const b = who(sim, 'johann_brenner');
    const c = who(sim, 'horace_bell');
    label(sim, a, b, '', 'Friend', 1000);
    label(sim, b, c, '', 'Friend', 2000);
    label(sim, b, c, 'Friend', 'Enemy', 2000 + 5 * DAY);
    sift(sim, 2000 + 5 * DAY);
    expect(entriesOf(sim, 'friendship').filter((e) => (e.level ?? 0) >= 2)).toEqual([]);
  });
});

describe('pattern: courtship', () => {
  it('fires on a sustained courtship', () => {
    const sim = newSim();
    const a = who(sim, 'johann_brenner');
    const b = who(sim, 'ingrid_tveit');
    interaction(sim, 'flirt', a, b, 1000);
    interaction(sim, 'court', a, b, 1000 + 2 * DAY);
    interaction(sim, 'court', a, b, 1000 + 4 * DAY);
    sift(sim, 1000 + 4 * DAY);
    const c = entriesOf(sim, 'courtship');
    expect(c.length).toBeGreaterThan(0);
    noArtifacts(c[0]?.text ?? '');
  });

  it('does not fire on a single flirtation or a failed overture', () => {
    const sim = newSim();
    const a = who(sim, 'johann_brenner');
    const b = who(sim, 'ingrid_tveit');
    interaction(sim, 'flirt', a, b, 1000);
    interaction(sim, 'court', a, b, 1000 + DAY, { success: false });
    sift(sim, 1000 + DAY);
    expect(entriesOf(sim, 'courtship')).toEqual([]);
  });

  it('is the better story across the lines of a feud', () => {
    const sim = newSim();
    const g = who(sim, 'gussie_pratt');
    const j = who(sim, 'johann_brenner');
    interaction(sim, 'insult', g, j, 1000);
    interaction(sim, 'insult', j, g, 1000 + DAY);
    interaction(sim, 'insult', g, j, 1000 + 2 * DAY);
    const l = who(sim, 'lydia_pratt');
    const k = who(sim, 'karl_brenner');
    interaction(sim, 'court', l, k, 1000 + 3 * DAY);
    interaction(sim, 'court', l, k, 1000 + 4 * DAY);
    interaction(sim, 'flirt', k, l, 1000 + 5 * DAY);
    sift(sim, 1000 + 5 * DAY);
    const c = entriesOf(sim, 'courtship').filter((e) => e.voice === 'paper');
    expect(c.some((e) => /variance|line|houses/i.test(e.text))).toBe(true);
  });
});

describe('pattern: debt', () => {
  it('follows a debt through dunning to repayment', () => {
    const sim = newSim();
    const g = who(sim, 'gussie_pratt');
    const j = who(sim, 'johann_brenner');
    interaction(sim, 'lend', g, j, 1000);
    interaction(sim, 'dun', g, j, 1000 + 10 * DAY);
    interaction(sim, 'dun', g, j, 1000 + 20 * DAY);
    sift(sim, 1000 + 20 * DAY);
    const levels = entriesOf(sim, 'debt').map((e) => e.level);
    expect(levels.some((l) => (l ?? 0) >= 3)).toBe(true);
    interaction(sim, 'repay', j, g, 1000 + 25 * DAY);
    sift(sim, 1000 + 25 * DAY);
    expect(entriesOf(sim, 'debt').some((e) => e.level === 4)).toBe(true);
    for (const e of entriesOf(sim, 'debt')) noArtifacts(e.text);
  });

  it('ignores a plain loan, and money inside one household', () => {
    const sim = newSim();
    const g = who(sim, 'gussie_pratt');
    const l = who(sim, 'lydia_pratt');
    const j = who(sim, 'johann_brenner');
    interaction(sim, 'lend', g, j, 1000);
    interaction(sim, 'lend', g, l, 1200);
    interaction(sim, 'dun', g, l, 1000 + 10 * DAY);
    interaction(sim, 'dun', g, l, 1000 + 20 * DAY);
    sift(sim, 1000 + 20 * DAY);
    expect(entriesOf(sim, 'debt')).toEqual([]);
  });

  it('lets an unpressed debt lapse into "unpaid" once it is overdue', () => {
    const sim = newSim();
    const g = who(sim, 'gussie_pratt');
    const j = who(sim, 'johann_brenner');
    interaction(sim, 'lend', g, j, 1000);
    interaction(sim, 'dun', g, j, 1000 + DAY);
    sift(sim, 1000 + DAY);
    emit(
      sim,
      {
        kind: 'core.day_started',
        data: {
          dayIndex: 40,
          year: 1855,
          month: 5,
          day: 11,
          weekday: 'fri',
          season: 'spring',
          moon: 'full',
          isSabbath: false,
        },
      },
      1000 + 40 * DAY,
    );
    sift(sim, 1000 + 40 * DAY);
    expect(entriesOf(sim, 'debt').some((e) => e.level === 3)).toBe(true);
  });
});

describe('pattern: reversal of fortune', () => {
  function week(sim: Sim, w: number, cash: number): void {
    const hid = sim.world.index.householdByKey.brenner as number;
    const h = sim.world.provisions.households[hid as never] as { cashCents: number };
    h.cashCents = cash;
    for (const m of sim.world.households[hid as never]?.memberIds ?? []) sim.world.provisions.purses[m] = 0;
    const t = w * 7 * DAY;
    emit(
      sim,
      {
        kind: 'core.day_started',
        data: {
          dayIndex: w * 7,
          year: 1855,
          month: 4,
          day: 1,
          weekday: 'sun',
          season: 'spring',
          moon: 'new',
          isSabbath: true,
        },
      },
      t,
    );
    sift(sim, t);
  }

  it('fires on a sustained windfall or ruin', () => {
    const sim = newSim();
    for (const [w, c] of [500, 500, 500, 6000, 6000].entries()) week(sim, w, c);
    const r = entriesOf(sim, 'reversal');
    expect(r.length).toBe(1);
    expect(r[0]?.voice).toBe('paper');
    expect(r[0]?.text).toMatch(/Brenner/);
    // P1: the town sees the turn, not the ledger.
    expect(r[0]?.text).not.toMatch(/\$/);
    expect(r[0]?.sourceEventIds).toEqual([]);

    const ruin = newSim();
    for (const [w, c] of [9000, 9000, 9000, 400, 400].entries()) week(ruin, w, c);
    expect(entriesOf(ruin, 'reversal').some((e) => /revers|fallen|hard times/i.test(e.text))).toBe(true);
  });

  it('does not fire on a steady purse or a one-week pay-day spike', () => {
    const steady = newSim();
    for (const [w, c] of [800, 900, 850, 800, 900, 880].entries()) week(steady, w, c);
    expect(entriesOf(steady, 'reversal')).toEqual([]);
    const spike = newSim();
    for (const [w, c] of [500, 500, 500, 6000, 500, 500].entries()) week(spike, w, c);
    expect(entriesOf(spike, 'reversal')).toEqual([]);
  });
});

describe('pattern: shortage (the thin spring)', () => {
  it('follows a household through rationing and out the other side', () => {
    const sim = newSim();
    shortage(sim, 'brenner', 1000, { days: 120, ration: 90 });
    shortage(sim, 'brenner', 1000 + DAY, { days: 90, ration: 80 });
    shortage(sim, 'brenner', 1000 + 2 * DAY, { days: 60, ration: 60 });
    sift(sim, 1000 + 2 * DAY);
    const s = entriesOf(sim, 'shortage');
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((e) => e.knowledge === 'public' || e.knowledge === 'omniscient')).toBe(true);
    for (const e of s) noArtifacts(e.text);
    const later = 1000 + 14 * DAY;
    emit(
      sim,
      {
        kind: 'core.day_started',
        data: {
          dayIndex: 14,
          year: 1855,
          month: 4,
          day: 15,
          weekday: 'sun',
          season: 'spring',
          moon: 'full',
          isSabbath: true,
        },
      },
      later,
    );
    sift(sim, later);
    expect(entriesOf(sim, 'shortage').some((e) => e.kind === 'closing')).toBe(true);
  });

  it('does not make a story of one count, and keeps private shortages out of the Paper', () => {
    const sim = newSim();
    shortage(sim, 'brenner', 1000, { days: 150, ration: 95, vis: 'private' });
    sift(sim, 1000);
    expect(entriesOf(sim, 'shortage')).toEqual([]);
    for (let i = 1; i <= 3; i++) shortage(sim, 'tveit', 1000 + i * 300, { days: 100, ration: 55, vis: 'private' });
    sift(sim, 2000);
    const s = entriesOf(sim, 'shortage');
    // common knowledge from level 2, but rendered with no private source and no private figure
    for (const e of s.filter((x) => x.knowledge === 'public')) {
      expect(e.sourceEventIds).toEqual([]);
      expect(e.text).not.toMatch(/\d+ in the hundred|days? of food/);
    }
    assertNoLeak(sim);
  });
});

describe('pattern: scapegoat', () => {
  const defense = (sim: Sim, actor: number, target: number, t: number, defenseId = 'projection') =>
    emit(
      sim,
      {
        kind: 'psyche.defense',
        visibility: 'inner',
        roles: [
          { actor: actor as never, role: 'agent' },
          { actor: target as never, role: 'target' },
        ],
        data: {
          actorId: actor as never,
          defense: defenseId,
          targetId: target as never,
          label: 'x',
          anxietyBefore: 600,
          anxietyAfter: 400,
        },
      },
      t,
    );
  const rung = (sim: Sim, target: number, to: number, t: number) =>
    emit(
      sim,
      {
        kind: 'belief.escalation',
        visibility: 'public',
        data: { target: `actor:${target}`, from: to - 1, to, heat: 100 * to, consensus: 300 },
      },
      t,
    );

  it('is told from the omniscient view when a projection precedes the town turning on its target', () => {
    const sim = newSim();
    const a = who(sim, 'gussie_pratt');
    const t = who(sim, 'loveday_trevenna');
    defense(sim, a, t, 1000);
    rung(sim, t, 1, 1000 + 2 * DAY);
    sift(sim, 1000 + 2 * DAY);
    const s = entriesOf(sim, 'scapegoat');
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((e) => e.voice === 'epilogue' && e.knowledge === 'omniscient')).toBe(true);
    for (const e of s) noArtifacts(e.text);
    // the town's own story of the same climb never names the defense
    expect(
      sim.world.chronicle.entries
        .filter((e) => e.knowledge === 'public')
        .some((e) => /projection|laying it/i.test(e.text)),
    ).toBe(false);
  });

  it('does not fire on suspicion with no defense behind it, or a defense nobody acted on', () => {
    const sim = newSim();
    const a = who(sim, 'gussie_pratt');
    const t = who(sim, 'loveday_trevenna');
    const u = who(sim, 'horace_bell');
    rung(sim, t, 2, 1000);
    defense(sim, a, u, 1000 + DAY);
    sift(sim, 1000 + DAY);
    expect(entriesOf(sim, 'scapegoat')).toEqual([]);
  });
});

describe('pattern: rumor through town and faekin suspicion', () => {
  function rumor(
    sim: Sim,
    pred: string,
    subjectKey: string,
    listeners: string[],
    t0: number,
    speaker = 'gussie_pratt',
  ): void {
    const subject = who(sim, subjectKey);
    const propId = belief.internProp(sim.world, pred, [{ kind: 'actor', id: subject as never }]);
    listeners.forEach((k, i) => {
      emit(
        sim,
        {
          kind: 'belief.transmitted',
          visibility: 'private',
          roles: [
            { actor: who(sim, speaker) as never, role: 'agent' },
            { actor: who(sim, k) as never, role: 'listener' },
          ],
          data: {
            speakerId: who(sim, speaker) as never,
            listenerId: who(sim, k) as never,
            rumorId: 1 as never,
            propId,
            mutation: null,
            accepted: true,
          },
        },
        t0 + i * 60,
      );
    });
  }
  const crowd = [
    'johann_brenner',
    'anders_tveit',
    'michael_dunleavy',
    'horace_bell',
    'elias_hurd',
    'clara_stoughton',
    'mercy_bell',
    'karl_brenner',
  ];

  // Seven outsiders: neither Horace Bell nor his wife (a rumor's subject and household are not the town).
  const outsiders = [...crowd.filter((k) => !k.endsWith('_bell')), 'thomas_glover', 'lydia_pratt'].slice(0, 7);

  it('tells a mundane rumor once it is all over town, from nothing but the claim', () => {
    const sim = newSim();
    rumor(sim, 'drinks', 'horace_bell', outsiders, 1000);
    sift(sim, 2000);
    const w = entriesOf(sim, 'whispers');
    expect(w.some((e) => e.knowledge === 'public')).toBe(true);
    const pub = w.filter((e) => e.knowledge === 'public');
    expect(pub[0]?.sourceEventIds).toEqual([]);
    expect(pub[0]?.text).toMatch(/drinks/);
    expect(w.some((e) => e.voice === 'epilogue')).toBe(false); // the town already has the whole of it
    assertNoLeak(sim);
  });

  it('does not count the subject or their household as the town holding the claim', () => {
    const sim = newSim();
    // Five tellings, but two land on Horace Bell himself and his wife: three outsiders is talk, not the town.
    rumor(sim, 'drinks', 'horace_bell', ['horace_bell', 'mercy_bell', ...outsiders.slice(0, 3)], 1000);
    sift(sim, 2000);
    expect(entriesOf(sim, 'whispers').some((e) => e.knowledge === 'public')).toBe(false);
  });

  it('does not tell a rumor only two people have heard', () => {
    const sim = newSim();
    rumor(sim, 'drinks', 'horace_bell', crowd.slice(0, 2), 1000);
    sift(sim, 2000);
    expect(entriesOf(sim, 'whispers')).toEqual([]);
  });

  it('keeps supernatural claims to the faekin-suspicion pattern', () => {
    const sim = newSim();
    rumor(sim, 'faekin', 'loveday_trevenna', crowd.slice(0, 5), 1000);
    sift(sim, 2000);
    expect(entriesOf(sim, 'whispers')).toEqual([]);
    const f = entriesOf(sim, 'faekin_suspicion');
    expect(f.length).toBeGreaterThan(0);
    expect(f.some((e) => e.knowledge === 'public' && /Trevenna/.test(e.text))).toBe(true);
    for (const e of f) noArtifacts(e.text);
  });

  it('does not treat an ordinary rumor as faekin suspicion', () => {
    const sim = newSim();
    rumor(sim, 'drinks', 'horace_bell', crowd.slice(0, 7), 1000);
    sift(sim, 2000);
    expect(entriesOf(sim, 'faekin_suspicion')).toEqual([]);
  });

  it('does not call an ordinary shunning faekin suspicion', () => {
    const sim = newSim();
    const target = who(sim, 'horace_bell');
    for (const [from, to] of [
      [0, 1],
      [1, 2],
    ] as const) {
      emit(
        sim,
        {
          kind: 'belief.escalation',
          visibility: 'public',
          importance: 60,
          roles: [{ actor: target as never, role: 'target' }],
          data: { target: `actor:${target}`, from, to, heat: 100 * to, consensus: 300 },
        },
        1000 + to * 100,
      );
    }
    sift(sim, 2000);
    expect(entriesOf(sim, 'faekin_suspicion')).toEqual([]);
    expect(sim.world.chronicle.entries.some((e) => e.voice === 'paper' && /Bell/.test(e.text))).toBe(true);
  });

  it('reveals the truth about the suspected only in the epilogue', () => {
    const sim = newSim();
    rumor(sim, 'faekin', 'loveday_trevenna', crowd.slice(0, 5), 1000);
    emit(
      sim,
      {
        kind: 'belief.escalation',
        visibility: 'public',
        data: { target: `actor:${who(sim, 'loveday_trevenna')}`, from: 0, to: 1, heat: 100, consensus: 300 },
      },
      2500,
    );
    sift(sim, 3000);
    const pubText = sim.world.chronicle.entries
      .filter((e) => e.knowledge === 'public')
      .map((e) => e.text)
      .join(' ');
    expect(pubText).not.toMatch(/was of the hidden folk|exactly what/);
    assertNoLeak(sim);
  });
});

describe('pattern: defense fired', () => {
  const fire = (sim: Sim, actor: number, t: number, id = 'denial') =>
    emit(
      sim,
      {
        kind: 'psyche.defense',
        visibility: 'inner',
        importance: 20,
        roles: [{ actor: actor as never, role: 'agent' }],
        data: {
          actorId: actor as never,
          defense: id,
          targetId: null,
          label: 'x',
          anxietyBefore: 600,
          anxietyAfter: 400,
        },
      },
      t,
    );

  it('tells the epilogue when one mind comes apart at the seams', () => {
    const sim = newSim();
    const a = who(sim, 'gussie_pratt');
    for (let i = 0; i < 7; i++) fire(sim, a, 1000 + i * 600, i % 2 ? 'denial' : 'repression');
    sift(sim, 1000 + 7 * 600);
    const d = entriesOf(sim, 'defense_fired');
    expect(d.length).toBe(1);
    expect(d[0]?.voice).toBe('epilogue');
    expect(d[0]?.knowledge).toBe('omniscient');
    noArtifacts(d[0]?.text ?? '');
  });

  it('gives the player character a journal line for a habit of their own', () => {
    const sim = newSim({ player: true });
    const pc = sim.world.meta.playerId as number;
    for (let i = 0; i < 3; i++) fire(sim, pc, 1000 + i * DAY);
    sift(sim, 1000 + 3 * DAY);
    const d = entriesOf(sim, 'defense_fired');
    expect(d.some((e) => e.voice === 'journal' && e.knownBy?.[0] === pc)).toBe(true);
    // somebody else's habit is not the PC's to read
    const other = who(sim, 'horace_bell');
    for (let i = 0; i < 3; i++) fire(sim, other, 5000 + i * DAY);
    sift(sim, 5000 + 3 * DAY);
    expect(entriesOf(sim, 'defense_fired').filter((e) => e.voice === 'journal').length).toBe(1);
    assertNoLeak(sim);
  });

  it('does not fire on two firings, or on firings spread over months', () => {
    const sim = newSim();
    const a = who(sim, 'gussie_pratt');
    const b = who(sim, 'horace_bell');
    fire(sim, a, 1000);
    fire(sim, a, 1000 + DAY);
    for (let i = 0; i < 3; i++) fire(sim, b, 1000 + i * 40 * DAY);
    sift(sim, 1000 + 100 * DAY);
    expect(entriesOf(sim, 'defense_fired')).toEqual([]);
  });
});

describe('pattern: kindness', () => {
  it('requires actual assisted intake for a food relief story', () => {
    const sim = newSim();
    const helper = who(sim, 'horace_bell');
    const needy = who(sim, 'johann_brenner');
    shortage(sim, 'brenner', 1000, { days: 40, ration: 70 });
    interaction(sim, 'help', helper, needy, 1000 + DAY);
    sift(sim, 1000 + DAY);
    expect(entriesOf(sim, 'kindness')).toEqual([]);
    emit(
      sim,
      {
        kind: 'provisions.meal',
        data: {
          actorId: needy as never,
          assistedBy: helper as never,
          householdId: null,
          items: [],
          kcal: 500,
          hot: true,
          morale: 0,
        },
        roles: [
          { actor: helper as never, role: 'agent' },
          { actor: needy as never, role: 'beneficiary' },
        ],
        visibility: 'public',
      },
      1000 + 2 * DAY,
    );
    sift(sim, 1000 + 2 * DAY);
    const k = entriesOf(sim, 'kindness');
    expect(k.length).toBeGreaterThan(0);
    expect(k[0]?.text).toMatch(/Bell/);
    noArtifacts(k[0]?.text ?? '');
  });

  it('aggregates ordinary favors with generic prose and caps kindness across helpers to weekly', () => {
    const sim = newSim();
    const helper = who(sim, 'horace_bell');
    const targets = ['johann_brenner', 'gussie_pratt', 'amos_whitcomb'].map((k) => who(sim, k));
    for (let i = 0; i < 4; i++) interaction(sim, 'help', helper, targets[i % 3] ?? 0, 1000 + i);
    sift(sim, 1004);
    const ordinary = entriesOf(sim, 'kindness').filter((e) => e.voice === 'paper');
    expect(ordinary.length).toBe(1);
    expect(ordinary[0]?.text).not.toMatch(/pantry|pot|meal|hungry|table|relief/);
    const patient = who(sim, 'joel_pike');
    for (let day = 1; day < 10; day++) {
      const giver = targets[day % 3] ?? 0;
      emit(
        sim,
        {
          kind: 'provisions.meal',
          data: {
            actorId: patient as never,
            assistedBy: giver as never,
            householdId: null,
            items: [],
            kcal: 500,
            hot: true,
            morale: 0,
          },
          roles: [
            { actor: giver as never, role: 'agent' },
            { actor: patient as never, role: 'beneficiary' },
          ],
          visibility: 'public',
        },
        1000 + day * DAY,
      );
      sift(sim, 1000 + day * DAY);
    }
    const paper = entriesOf(sim, 'kindness').filter((e) => e.voice === 'paper');
    expect(paper.length).toBeGreaterThan(1);
    expect(nonHeading(sim.world).filter((entry) => entry.voice === 'paper' && entry.topics?.includes('help'))).toEqual(
      [],
    );
    for (let i = 1; i < paper.length; i++)
      expect((paper[i]?.t ?? 0) - (paper[i - 1]?.t ?? 0)).toBeGreaterThanOrEqual(7 * DAY);
  });

  it('is quiet about a favor to someone who is fine, or to one’s own family', () => {
    const sim = newSim();
    interaction(sim, 'gift', who(sim, 'horace_bell'), who(sim, 'johann_brenner'), 1000);
    shortage(sim, 'pratt', 1000, { days: 40 });
    interaction(sim, 'gift', who(sim, 'gussie_pratt'), who(sim, 'lydia_pratt'), 1000 + DAY);
    sift(sim, 1000 + DAY);
    expect(entriesOf(sim, 'kindness')).toEqual([]);
  });
});

describe('voices', () => {
  it('sings a ballad when a story is big and its people are famous', () => {
    const sim = newSim();
    const g = who(sim, 'gussie_pratt');
    const j = who(sim, 'johann_brenner');
    sim.world.chronicle.notoriety[g] = 100;
    sim.world.chronicle.notoriety[j] = 100;
    for (let i = 0; i < 6; i++) interaction(sim, 'fight', i % 2 ? j : g, i % 2 ? g : j, 1000 + i * 600);
    sift(sim, 1000 + 6 * 600);
    const ballads = sim.world.chronicle.entries.filter((e) => e.voice === 'ballad');
    expect(ballads.length).toBeGreaterThan(0);
    expect(ballads[0]?.knowledge).toBe('public');
    expect(ballads[0]?.text.split('\n').length).toBeGreaterThanOrEqual(4);
    noArtifacts(ballads[0]?.text.replace(/\n/g, ' ') ?? '');
    const md = chronicle.renderChronicleMarkdown(sim.world, content, 'T');
    expect(md).toContain('> ♪ ');
  });

  it('writes the journal in the temperament of the writer', () => {
    const textFor = (value: 'superstition' | 'temper' | 'piety') => {
      const sim = newSim({ player: true });
      const pc = sim.world.meta.playerId as number;
      const actor = sim.world.actors[pc as never];
      if (!actor) throw new Error('no pc');
      for (const k of Object.keys(actor.values)) (actor.values as Record<string, number>)[k] = 0;
      (actor.values as Record<string, number>)[value] = 3;
      interaction(sim, 'insult', who(sim, 'gussie_pratt'), pc, 1000, { vis: 'witnessed', importance: 60 });
      sift(sim, 1100);
      return sim.world.chronicle.entries.find((e) => e.voice === 'journal')?.text ?? '';
    };
    const superstitious = textFor('superstition');
    const hot = textFor('temper');
    const pious = textFor('piety');
    expect(superstitious).toMatch(/iron|salt|pocket|air/i);
    expect(hot).toMatch(/fist|wall|hands|Walked/i);
    expect(pious).toMatch(/pray|Lord|cheek/i);
    expect(new Set([superstitious, hot, pious]).size).toBe(3);
  });

  it('keeps a weekly almanac, the household ledger, an annual reckoning, and a behind-the-doors epilogue', () => {
    const sim = newSim({ player: true });
    const pc = sim.world.meta.playerId as number;
    const hid = sim.world.actors[pc as never]?.householdId as number;
    for (let d = 0; d < 6; d++) {
      for (let m = 0; m < 3; m++) {
        emit(
          sim,
          {
            kind: 'provisions.meal',
            visibility: 'private',
            roles: [{ actor: pc as never, role: 'agent' }],
            data: {
              actorId: pc as never,
              householdId: hid as never,
              items: [
                { defId: 'bread_heel', qty: 1, method: 'raw' },
                { defId: 'eggs', qty: 2, method: 'fry' },
              ],
              kcal: 600,
              hot: m !== 1,
              morale: 0,
            },
          },
          d * DAY + m * 300,
        );
      }
    }
    emit(
      sim,
      {
        kind: 'provisions.purchase',
        visibility: 'private',
        roles: [],
        data: {
          buyerId: pc as never,
          placeId: place(sim) as never,
          defId: 'eggs',
          qty: 12,
          priceCents: 24,
          onCredit: false,
        },
      },
      3 * DAY,
    );
    emit(
      sim,
      {
        kind: 'provisions.purchase',
        visibility: 'private',
        roles: [],
        data: {
          buyerId: pc as never,
          placeId: place(sim) as never,
          defId: 'eggs',
          qty: 12,
          priceCents: 24,
          onCredit: false,
        },
      },
      4 * DAY,
    );
    emit(
      sim,
      {
        kind: 'core.day_started',
        data: {
          dayIndex: 7,
          year: 1855,
          month: 4,
          day: 8,
          weekday: 'sun',
          season: 'spring',
          moon: 'full',
          isSabbath: true,
        },
      },
      7 * DAY,
    );
    sift(sim, 7 * DAY);
    const digest = sim.world.chronicle.entries.filter((e) => e.kind === 'digest');
    const almanac = digest.find((e) => e.voice === 'almanac');
    const ledger = digest.find((e) => e.voice === 'ledger');
    const behind = digest.find((e) => e.voice === 'epilogue');
    expect(almanac?.knowledge).toBe('public');
    expect(almanac?.text).toMatch(/eggs/);
    expect(ledger?.knowledge).toBe('witnessed');
    expect(ledger?.knownBy?.length).toBeGreaterThan(0);
    expect(ledger?.text).toMatch(/18 meals|six cold|6 of them cold|cold/);
    expect(behind?.knowledge).toBe('omniscient');
    for (const e of digest) noArtifacts(e.text);
    // the ledger is the family's: another household's view does not include it
    const stranger = who(sim, 'horace_bell');
    expect(
      chronicle
        .chronicleEntries(sim.world, { viewer: { perspective: stranger, omniscient: false } })
        .some((e) => e.voice === 'ledger'),
    ).toBe(false);
    // the year turns
    emit(
      sim,
      {
        kind: 'core.day_started',
        data: {
          dayIndex: 275,
          year: 1856,
          month: 1,
          day: 1,
          weekday: 'tue',
          season: 'winter',
          moon: 'new',
          isSabbath: false,
        },
      },
      275 * DAY,
    );
    sift(sim, 275 * DAY);
    expect(
      sim.world.chronicle.entries.some((e) => e.kind === 'almanac' && e.importance > 0 && /1855/.test(e.text)),
    ).toBe(true);
  });
});

describe('content coverage', () => {
  it('every template answers an event kind, a pattern (or its closing/truth), or a digest', () => {
    const kinds = new Set([
      'fae.omen',
      'core.day_started',
      'social.interaction',
      'social.label_changed',
      'social.rupture',
      'social.reconciled',
      'belief.formed',
      'belief.grudge_formed',
      'belief.escalation',
      'belief.misfortune',
      'belief.figure_attached',
      'belief.revealed',
      'psyche.defense',
      'provisions.shortage',
      'provisions.nutrition',
      'needs.band_changed',
      'needs.died',
      'needs.death_discovered',
      'needs.funeral',
      'digest.week',
      'digest.ledger',
      'digest.year',
    ]);
    for (const p of PATTERNS) {
      kinds.add(p.id);
      kinds.add(`${p.id}.closed`);
    }
    for (const t of Object.values(content.chronicleTemplates)) {
      expect(kinds.has(t.on), `template ${t.id} answers unknown '${t.on}'`).toBe(true);
    }
  });
});

describe('notability', () => {
  const pair = (sim: Sim) => [who(sim, 'gussie_pratt'), who(sim, 'johann_brenner')] as const;
  const papers = (sim: Sim) => sim.world.chronicle.entries.filter((e) => e.voice === 'paper');

  it('keeps a story when importance plus notoriety clears the Paper’s bar, and says why', () => {
    const sim = newSim();
    const [g, j] = pair(sim);
    interaction(sim, 'insult', g, j, 1000, { importance: 32 });
    sift(sim, 1000);
    expect(papers(sim)).toEqual([]); // small beer from nobody in particular
    sim.world.chronicle.notoriety[g] = 40;
    interaction(sim, 'insult', g, j, 1000 + 5 * DAY, { importance: 32 });
    sift(sim, 1000 + 5 * DAY);
    const [e] = papers(sim);
    expect(e).toBeDefined();
    expect(e?.importance).toBe(42);
    expect(e?.explain?.knowledge).toBe('omniscient');
    expect(e?.explain?.terms.map((t) => t.label)).toContain('Names the county is talking of');
    expect(e?.explain?.terms.reduce((acc, t) => acc + t.value, 0)).toBe(e?.importance);
  });

  it('tires of the same thing told twice within the repeat window, and of a crowded week', () => {
    const sim = newSim();
    const [g, j] = pair(sim);
    interaction(sim, 'insult', g, j, 1000, { importance: 55 });
    sift(sim, 1000);
    expect(papers(sim).length).toBe(1);
    interaction(sim, 'insult', g, j, 1000 + 5 * DAY, { importance: 55 });
    sift(sim, 1000 + 5 * DAY);
    expect(papers(sim).length).toBe(1); // 55 - 35 for "told already" (repeat window: 10 days)
    interaction(sim, 'insult', g, j, 1000 + 11 * DAY, { importance: 55 });
    sift(sim, 1000 + 11 * DAY);
    expect(papers(sim).length).toBe(2);
    // a crowded week: a different pair, fresh news, but thirty items already this week
    const week = Math.floor((1000 + 12 * DAY) / (7 * DAY)) + 1;
    sim.world.chronicle.weekLoad = { week, entries: 30, epilogue: 0 };
    interaction(sim, 'insult', who(sim, 'horace_bell'), g, 1000 + 12 * DAY, { importance: 55 });
    sift(sim, 1000 + 12 * DAY);
    expect(papers(sim).length).toBe(2);
    sim.world.chronicle.weekLoad = { week, entries: 0, epilogue: 0 };
    interaction(sim, 'insult', who(sim, 'elias_hurd'), g, 1000 + 12 * DAY + 60, { importance: 55 });
    sift(sim, 1000 + 12 * DAY + 60);
    expect(papers(sim).length).toBe(3);
  });

  it('announces a told pattern on the event log, with the entry it became', () => {
    const sim = newSim();
    const g = who(sim, 'gussie_pratt');
    const j = who(sim, 'johann_brenner');
    for (let i = 0; i < 3; i++) interaction(sim, 'insult', i % 2 ? j : g, i % 2 ? g : j, 1000 + i * DAY);
    sift(sim, 1000 + 3 * DAY);
    const matched = sim.world.log.events.filter((e) => e.kind === 'chronicle.pattern_matched');
    expect(matched.length).toBeGreaterThan(0);
    for (const ev of matched) {
      if (ev.kind !== 'chronicle.pattern_matched') continue;
      const entry = sim.world.chronicle.entries.find((e) => e.id === ev.data.entryId);
      expect(entry?.pattern).toBe(ev.data.pattern);
      expect(ev.visibility).toBe('inner');
      expect(ev.explain).toBeDefined();
    }
  });
});

describe('registry', () => {
  it('registers at least the twelve detectors the module promises, with unique ids', () => {
    const ids = PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const want of [
      'feud',
      'betrayal',
      'friendship',
      'courtship',
      'debt',
      'reversal',
      'shortage',
      'scapegoat',
      'whispers',
      'faekin_suspicion',
      'defense_fired',
      'kindness',
    ]) {
      expect(ids).toContain(want);
    }
  });

  it('has a pattern record, a Paper-or-epilogue template, and a topic for every detector', () => {
    for (const p of PATTERNS) {
      expect(content.chroniclePatterns[p.id], `pattern record ${p.id}`).toBeDefined();
      const voices = Object.values(content.chronicleTemplates)
        .filter((t) => t.on === p.id)
        .map((t) => t.voice);
      expect(voices.includes('paper') || voices.includes('epilogue'), `templates for ${p.id}`).toBe(true);
      expect(p.topic.length).toBeGreaterThan(0);
    }
  });
});

// ---- privacy (P1) -----------------------------------------------------------------------------------------

describe('knowledge: entries never go above what the viewer could know', () => {
  it('writes private events to the epilogue only, and never to the Paper', () => {
    const sim = newSim();
    const g = who(sim, 'gussie_pratt');
    const j = who(sim, 'johann_brenner');
    for (let i = 0; i < 6; i++) {
      interaction(sim, 'insult', i % 2 ? j : g, i % 2 ? g : j, 1000 + i * DAY, { vis: 'witnessed', importance: 80 });
    }
    sift(sim, 1000 + 6 * DAY);
    const entries = nonHeading(sim.world);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.knowledge === 'omniscient')).toBe(true);
    expect(
      chronicle
        .chronicleEntries(sim.world, { viewer: { perspective: null, omniscient: false } })
        .filter((e) => !(e.voice === 'almanac')),
    ).toEqual([]);
    assertNoLeak(sim);
  });

  it('gives the player character a journal of what they saw, and hides it from others', () => {
    const sim = newSim({ player: true });
    const pc = sim.world.meta.playerId as number;
    expect(pc).toBe(who(sim, 'lydia_pratt'));
    const g = who(sim, 'gussie_pratt');
    const j = who(sim, 'johann_brenner');
    interaction(sim, 'insult', g, pc, 1000, { vis: 'witnessed', importance: 60 }); // done to the PC
    interaction(sim, 'fight', g, j, 1500, { vis: 'witnessed', importance: 80 }); // PC did not see
    sift(sim, 1600);
    const journal = sim.world.chronicle.entries.filter((e) => e.voice === 'journal');
    expect(journal.length).toBe(1);
    expect(journal[0]?.knownBy).toEqual([pc]);
    expect(journal[0]?.authorId).toBe(pc);
    expect(journal[0]?.text).toMatch(/\bme\b/);
    noArtifacts(journal[0]?.text ?? '');
    const epi = sim.world.chronicle.entries.filter((e) => e.voice === 'epilogue');
    expect(epi.length).toBeGreaterThan(0);
    // the PC's view
    const mine = chronicle.chronicleEntries(sim.world, { viewer: { perspective: pc, omniscient: false } });
    expect(mine.some((e) => e.voice === 'journal')).toBe(true);
    expect(mine.some((e) => e.voice === 'epilogue')).toBe(false);
    // somebody else's view of the same chronicle
    const theirs = chronicle.chronicleEntries(sim.world, { viewer: { perspective: j, omniscient: false } });
    expect(theirs.some((e) => e.voice === 'journal')).toBe(false);
    assertNoLeak(sim);
  });

  it('does not tell the player what was whispered about them behind their back', () => {
    const sim = newSim({ player: true });
    const pc = sim.world.meta.playerId as number;
    const propId = belief.internProp(sim.world, 'drinks', [{ kind: 'actor', id: pc as never }]);
    const talkers = [
      'gussie_pratt',
      'johann_brenner',
      'anders_tveit',
      'michael_dunleavy',
      'horace_bell',
      'elias_hurd',
      'karl_brenner',
    ];
    talkers.slice(1).forEach((k, i) => {
      emit(
        sim,
        {
          kind: 'belief.transmitted',
          visibility: 'private',
          roles: [
            { actor: who(sim, talkers[0] as string) as never, role: 'agent' },
            { actor: who(sim, k) as never, role: 'listener' },
          ],
          data: {
            speakerId: who(sim, talkers[0] as string) as never,
            listenerId: who(sim, k) as never,
            rumorId: 1 as never,
            propId,
            mutation: null,
            accepted: true,
          },
        },
        1000 + i * 60,
      );
    });
    sift(sim, 2000);
    expect(sim.world.chronicle.entries.some((e) => e.voice === 'journal')).toBe(false);
    for (const t of sim.world.chronicle.threads) {
      for (const f of t.facts) expect(f.by.includes(pc)).toBe(false);
    }
    // the town's version of it carries no private source
    assertNoLeak(sim);
  });

  it('honors perspective in the feed view (viewChronicleGlobal)', () => {
    const sim = newSim({ player: true });
    const pc = sim.world.meta.playerId as number;
    const g = who(sim, 'gussie_pratt');
    interaction(sim, 'insult', g, pc, 1000, { vis: 'witnessed', importance: 60 });
    interaction(sim, 'insult', g, who(sim, 'karl_brenner'), 1100, { vis: 'witnessed', importance: 90 });
    sift(sim, 1200);
    const feed = (perspective: number | null, omniscient = false) =>
      toViewModel(sim.world, content, {
        perspective: perspective as never,
        omniscient,
        includeExplain: false,
        recentChronicle: 100,
      }).chronicle.recent;
    expect(feed(pc).some((e) => e.voice === 'journal')).toBe(true);
    expect(feed(pc).some((e) => e.voice === 'epilogue')).toBe(false);
    const stranger = who(sim, 'horace_bell');
    expect(feed(stranger).some((e) => e.voice === 'journal' || e.voice === 'epilogue')).toBe(false);
    expect(feed(null).some((e) => e.voice === 'epilogue')).toBe(false);
    expect(feed(pc, true).some((e) => e.voice === 'epilogue')).toBe(true);
  });

  it('puts omniscient knowledge in its own section at the end of chronicle.md', () => {
    const sim = newSim();
    const g = who(sim, 'gussie_pratt');
    const j = who(sim, 'johann_brenner');
    interaction(sim, 'insult', g, j, 1000, { importance: 60 }); // public
    interaction(sim, 'fight', g, j, 1500, { vis: 'witnessed', importance: 90 }); // private
    sift(sim, 1600);
    const md = chronicle.renderChronicleMarkdown(sim.world, content, 'Test');
    const at = md.indexOf('## Epilogue');
    expect(at).toBeGreaterThan(0);
    const body = md.slice(0, at);
    const epilogue = md.slice(at);
    expect(body).toMatch(/Hard Words|insult|Mrs\. A\. Pratt/);
    for (const e of sim.world.chronicle.entries.filter((x) => x.knowledge === 'omniscient')) {
      expect(body).not.toContain(e.text);
      expect(epilogue).toContain(e.text);
    }
    // with a perspective and no omniscience there is no epilogue at all
    const mid = chronicle.renderChronicleMarkdown(sim.world, content, 'Test', { perspective: 0 });
    expect(mid).not.toContain('## Epilogue');
  });

  it('groups chronicle.md by week', () => {
    const sim = newSim();
    const g = who(sim, 'gussie_pratt');
    const j = who(sim, 'johann_brenner');
    interaction(sim, 'insult', g, j, 2 * DAY, { importance: 60 });
    interaction(sim, 'insult', j, who(sim, 'horace_bell'), 9 * DAY, { importance: 60 });
    sift(sim, 10 * DAY);
    const md = chronicle.renderChronicleMarkdown(sim.world, content, 'Test');
    const weeks = md.match(/^## Week \d+/gm) ?? [];
    expect(weeks).toEqual(['## Week 1', '## Week 2']);
  });
});

// ---- determinism --------------------------------------------------------------------------------------------

function storyOf(seedShift: number): World {
  const sim = newSim();
  const g = who(sim, 'gussie_pratt');
  const j = who(sim, 'johann_brenner');
  for (let i = 0; i < 6; i++) {
    interaction(sim, 'insult', i % 2 ? j : g, i % 2 ? g : j, 1000 + i * DAY + seedShift);
    shortage(sim, 'brenner', 1000 + i * DAY + seedShift + 5);
    emit(
      sim,
      {
        kind: 'core.day_started',
        data: {
          dayIndex: i,
          year: 1855,
          month: 4,
          day: 1 + i,
          weekday: 'sun',
          season: 'spring',
          moon: 'new',
          isSabbath: false,
        },
      },
      1000 + i * DAY + seedShift,
    );
    sift(sim, 1000 + i * DAY + seedShift + 10);
  }
  return sim.world;
}

describe('determinism', () => {
  it('the same events write the same chronicle', () => {
    const a = storyOf(0);
    const b = storyOf(0);
    expect(JSON.stringify(a.chronicle)).toBe(JSON.stringify(b.chronicle));
    expect(a.chronicle.entries.length).toBeGreaterThan(8);
    expect(findNonIntegers(a)).toEqual([]);
  });

  it('survives a JSON save/load mid-story', () => {
    const straight = newSim();
    const resumed = newSim();
    const g = who(straight, 'gussie_pratt');
    const j = who(straight, 'johann_brenner');
    const play = (sim: Sim, from: number, to: number) => {
      for (let i = from; i < to; i++) {
        interaction(sim, 'insult', i % 2 ? j : g, i % 2 ? g : j, 1000 + i * DAY);
        shortage(sim, 'brenner', 1000 + i * DAY + 5);
        sift(sim, 1000 + i * DAY + 10);
      }
    };
    play(straight, 0, 6);
    play(resumed, 0, 3);
    const reloaded = restoreSim(content, JSON.parse(JSON.stringify(resumed.world)) as World);
    play(reloaded, 3, 6);
    expect(JSON.stringify(reloaded.world.chronicle)).toBe(JSON.stringify(straight.world.chronicle));
    expect(stateHash(reloaded.world)).toBe(stateHash(straight.world));
  });

  it('a real run is reproducible, and tolerates older saves lacking newer fields', () => {
    const a = runScenario(content, { scenarioId: 'iron_ford', seed: 11, hours: 24 * 4 });
    const b = runScenario(content, { scenarioId: 'iron_ford', seed: 11, hours: 24 * 4 });
    expect(a.sim.world.chronicle.entries.map((e) => e.text)).toEqual(b.sim.world.chronicle.entries.map((e) => e.text));
    const old = JSON.parse(JSON.stringify(a.sim.world)) as World;
    // an older save: none of the optional state exists yet
    delete (old.chronicle.tallies as { pubWeek?: unknown }).pubWeek;
    old.chronicle.threads = [];
    runHours(restoreSim(content, old), 24);
    expect(findNonIntegers(old)).toEqual([]);
  });
});

// ---- the real thing: seed 42 --------------------------------------------------------------------------------------

describe('iron_ford seed 42', () => {
  it('tells a readable 30-day chronicle (golden) and ≥ 20 stories by day 60', async () => {
    const sim = createSim(content, { scenarioId: 'iron_ford', seed: 42, logRetention: null });
    runHours(sim, 24 * 30);
    const md30 = chronicle.renderChronicleMarkdown(sim.world, content, 'Iron Ford, Spring 1855: seed 42, 30 days');
    // Reconciled play: posted shop hours and real tavern board change meals, errands and resulting stories.
    // Survival wave: both captives now live in fae time; their missing deprivation events change the chronicle.
    // Wave 4: timed caregiver meals and evidence-based, weekly kindness replace false food-relief stories.
    await expect(md30).toMatchFileSnapshot('./__snapshots__/chronicle-iron_ford-42-30d.md');
    assertNoLeak(sim);
    for (const e of nonHeading(sim.world)) noArtifacts(e.text);
    runHours(sim, 24 * 30);
    expect(nonHeading(sim.world).length).toBeGreaterThanOrEqual(20);
    assertNoLeak(sim);
    expect(findNonIntegers(sim.world)).toEqual([]);
  }, 240_000);
});

describe('review fixes: names, titles and households in print', () => {
  it('a nickname that carries the family name stands alone everywhere (no "Captain Hurd Hurd")', () => {
    const sim = newSim();
    const hurd = sim.world.actors[who(sim, 'elias_hurd') as never];
    if (!hurd) throw new Error('hurd');
    expect(shortName(hurd)).toBe('Captain Hurd');
  });

  it('"Rev." only for the ordained; "Mrs." for wives, widows and mothers, never by age', () => {
    const sim = newSim();
    const f = (k: string) => chronicle.formalName(sim.world, content, who(sim, k));
    expect(f('anders_tveit')).toMatch(/^Rev\./);
    expect(f('siri_kvale')).toMatch(/^Mrs\./); // a lay preacher, and a mother
    expect(f('hester_fenn')).toMatch(/^Miss /); // twenty-nine and unmarried
    expect(f('gussie_pratt')).toMatch(/^Mrs\./);
    expect(f('clara_stoughton')).toMatch(/^Miss /);
  });

  it('a household of one is not a family: "Captain Hurd\'s household", "the Kvales\'" possessive', () => {
    const sim = newSim();
    const hh = (k: string) => sim.world.actors[who(sim, k) as never]?.householdId as number;
    expect(chronicle.familiesOf(sim.world, hh('elias_hurd'))).toBe("Captain Hurd's household");
    expect(chronicle.householdForms(sim.world, hh('siri_kvale')).poss).toBe("the Kvales'");
    expect(chronicle.householdForms(sim.world, hh('elias_hurd')).poss).toBe("Captain Hurd's");
    expect(chronicle.householdForms(sim.world, hh('amos_whitcomb')).family).not.toMatch(/\(/);
  });

  it('rumors read in English: pronouns by sex, money as money, a trait as a description', () => {
    const sim = newSim();
    const bp = (pred: string, args: Parameters<typeof belief.internProp>[2]) =>
      belief.propText(sim.world, content, belief.internProp(sim.world, pred as never, args));
    expect(bp('loose', [{ kind: 'actor', id: who(sim, 'elias_hurd') as never }])).toMatch(/in his conduct$/);
    expect(
      bp('owes', [
        { kind: 'actor', id: who(sim, 'josiah_trevenna') as never },
        { kind: 'actor', id: who(sim, 'lucius_vance') as never },
        { kind: 'number', value: 31000 },
      ]),
    ).toMatch(/\$310\.00$/);
    expect(
      bp('has_trait', [
        { kind: 'actor', id: who(sim, 'lydia_pratt') as never },
        { kind: 'text', value: 'gossip' },
      ]),
    ).toMatch(/is of a talkative disposition$/);
    const hurdHouse = sim.world.actors[who(sim, 'elias_hurd') as never]?.householdId as never;
    expect(bp('hard_luck', [{ kind: 'household', id: hurdHouse }])).toBe('Captain Hurd has had hard luck');
  });
});

describe('review fixes: the epilogue says only what the record supports', () => {
  it('the faekin subject and their household are not "holders": no thread from the family alone', () => {
    const sim = newSim();
    const hester = who(sim, 'hester_fenn');
    const propId = belief.internProp(sim.world, 'faekin', [{ kind: 'actor', id: hester as never }]);
    for (const [i, k] of ['edwin_fenn', 'minnie_fenn', 'hester_fenn'].entries()) {
      emit(
        sim,
        {
          kind: 'belief.formed',
          visibility: 'inner',
          roles: [{ actor: who(sim, k) as never, role: 'agent' }],
          data: { holderId: who(sim, k) as never, beliefId: (i + 1) as never, propId, credence: 100, text: '' },
        },
        1000 + i,
      );
    }
    sift(sim, 1000 + DAY);
    expect(entriesOf(sim, 'faekin_suspicion')).toEqual([]);
  });

  it('a displacement that acted on no one is told as inner, not as words that were said', () => {
    const tpl = content.chronicleTemplates.epi_defense_displacement;
    for (const line of tpl?.text ?? []) expect(line).not.toMatch(/was short with/);
    expect(content.chronicleTemplates.epi_displaced_act?.when.via_defense).toBe('displacement');
  });
});

describe('the journal speaks as I (playtest 2026-10-11)', () => {
  /** Render a journal line with the diarist as actor or target, by hand (the binding forms). */
  function asMe(text: string, me: 'actor' | 'target'): string {
    const other = 'Joel Pike';
    const forms: Record<string, string> =
      me === 'actor'
        ? { actor: 'I', actor_short: 'I', actor_given: 'I', he: 'I', his: 'my', him: 'me', himself: 'myself' }
        : { target: 'me', target_short: 'me', target_given: 'me', target_he: 'I', target_his: 'my', target_him: 'me' };
    const others: Record<string, string> =
      me === 'actor'
        ? { target: other, target_short: other, target_he: 'he', target_his: 'his', target_him: 'him' }
        : { actor: other, actor_short: other, he: 'he', his: 'his', him: 'him', himself: 'himself' };
    return text.replace(/\{(\^?)([a-z_]+)\}/g, (m, cap: string, name: string) => {
      const v = forms[name] ?? others[name];
      if (v === undefined) return m;
      return cap ? v.charAt(0).toUpperCase() + v.slice(1) : v;
    });
  }

  it('never writes "Me paid", "I and X", or the narrator in the third person', () => {
    const bad = [
      /(^|[.!?] )Me\b/,
      /\bI and\b/,
      /\bI (is|has|was in close talk)\b/,
      /(^|[.!?;] )me (paid|is|was|has)\b/,
      /their peace/,
    ];
    const problems: string[] = [];
    for (const t of Object.values(content.chronicleTemplates)) {
      if (t.voice !== 'journal') continue;
      for (const me of ['actor', 'target'] as const) {
        const self = me === 'actor' ? 'actor_me' : 'target_me';
        const other = me === 'actor' ? 'target_me' : 'actor_me';
        if (t.when[self] === false || t.when[other] === true) continue;
        for (const text of t.text) {
          const line = asMe(text, me);
          if (bad.some((re) => re.test(line))) problems.push(`${t.id} [${me}]: ${line}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('a newcomer with days of food in the pack is not written up as starving: the journal counts the pack', () => {
    const sim = sessionSim(content, { source: 'iron_ford', seed: 42 });
    const pc = sim.world.meta.playerId;
    if (pc === null) throw new Error('player');
    const hid = sim.world.actors[pc]?.householdId;
    if (hid === undefined) throw new Error('household');
    const readiness = provisionsReadiness(sim, pc);
    expect(readiness).toBeGreaterThanOrEqual(40);
    // The household pantry is bare; the provisions module reports a shortage.
    const id = appendEvent(
      sim.world.log,
      {
        kind: 'provisions.shortage',
        data: { householdId: hid, daysOfFoodTenths: 0, rationPct: 50 },
        roles: [{ actor: pc, role: 'participant' }],
        visibility: 'private',
      } as EventInput,
      sim.world.time,
    );
    sim.world.chronicle.cursor = id - 1;
    chronicle.chronicleSystem(sim.world, makeContext(sim.world, sim.content, []));
    const texts = sim.world.chronicle.entries.filter((e) => e.sourceEventIds.includes(id)).map((e) => e.text);
    for (const t of texts) {
      expect(t).not.toMatch(/less than a day|under a day|no food/i);
      expect(t).not.toMatch(/children/);
    }
    const tally = sim.world.chronicle.tallies.households[hid];
    expect(tally?.lowestDaysTenths ?? readiness).toBeGreaterThanOrEqual(readiness);
  });
});

function provisionsReadiness(sim: Sim, pc: NonNullable<World['meta']['playerId']>): number {
  return provisions.readinessOf(sim.world, sim.content, { actorId: pc }, sim.world.time, 5).daysOfFoodTenths;
}
