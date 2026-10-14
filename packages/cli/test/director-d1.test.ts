import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DirectorMoveSchema } from '@coulee/content/schema';
import {
  type ActorId,
  belief,
  createSim,
  director,
  type Event,
  type Explain,
  eventsSince,
  fae,
  findNonIntegers,
  type PlaceId,
  restoreSim,
  runHours,
  type Sim,
  social,
  stateHash,
} from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { ensurePlan } from '../../core/src/director/plan.ts';
import type { Bias, Thread } from '../../core/src/director/state.ts';
import { directorSystem } from '../../core/src/director/system.ts';
import { packJson } from '../../core/src/serialization.ts';
import { makeContext } from '../../core/src/sim/sim.ts';
import { baseContent } from './helpers.ts';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing test fixture');
  return value;
}
function almanac(seed = 42, scenarioId = 'iron_ford', foresight: director.Foresight = 'tiltable'): Sim {
  return createSim(baseContent(), { scenarioId, seed, director: { personality: 'almanac', foresight } });
}
function directorTerms(e: Explain | undefined): number {
  if (!e) return 0;
  return (
    e.terms.filter((t) => t.source === 'director').length +
    (e.dc?.terms.filter((t) => t.source === 'director').length ?? 0) +
    (e.children ?? []).reduce((n, c) => n + directorTerms(c), 0)
  );
}
function stripped(world: Sim['world']) {
  const { director: _director, ...rest } = world;
  return rest;
}
let nextBias = 1000;
function bias(sim: Sim, partial: Partial<Bias> & Pick<Bias, 'hook' | 'process' | 'nudge'>): Bias {
  const plan = ensurePlan(required(sim.world.director));
  const b: Bias = {
    id: ++nextBias,
    subject: null,
    key: null,
    toward_pc: false,
    amount: 0,
    thread: 1,
    move: 'test',
    tau: 0,
    cost: 1,
    placed_at: sim.world.time,
    expires: sim.world.time + 1440,
    charged: false,
    effects: 0,
    ...partial,
  };
  plan.biases.push(b);
  return b;
}
/** Two NPCs at a place other than the PC's, and the PC's place. */
function apart(sim: Sim): { pc: ActorId; a: ActorId; b: ActorId; elsewhere: PlaceId; here: PlaceId } {
  const pc = required(director.directorFocus(sim.world));
  const here = required(sim.world.actors[pc]).placeId;
  const others = Object.values(sim.world.actors).filter((x) => x.alive && x.id !== pc);
  const a = required(others[0]),
    b = required(others[1]);
  const elsewhere = required(Object.values(sim.world.places).find((p) => p.id !== here)).id;
  a.placeId = elsewhere;
  b.placeId = elsewhere;
  return { pc, a: a.id, b: b.id, elsewhere, here };
}

describe('Director D1: fair dice', () => {
  it('30 days at maximum budget: no Explain the PC could perceive carries a director term', () => {
    const sim = almanac(42);
    runHours(sim, 1);
    const st = required(sim.world.director);
    const pc = required(st.focus);
    let cursor = sim.world.log.lastId;
    let place: PlaceId | undefined = sim.world.actors[pc]?.placeId;
    let perceived = 0,
      offscreen = 0;
    const tilted = new Set<number>();
    for (let h = 1; h < 30 * 24; h++) {
      ensurePlan(st).budget = director.BUDGET_CAP;
      runHours(sim, 1);
      const events: Event[] = eventsSince(sim.world.log, cursor);
      cursor = sim.world.log.lastId;
      const seen = new Set(social.perceivedEvents(events, pc, place).map((e) => e.id));
      place = sim.world.actors[pc]?.placeId;
      for (const e of events) {
        const n = directorTerms(e.explain);
        if (seen.has(e.id)) {
          perceived++;
          expect(n, `${e.kind} #${e.id} is perceivable by the PC`).toBe(0);
        } else offscreen += n;
        if (n > 0) tilted.add(e.id);
      }
    }
    // No tilted outcome writes into the PC's mind: no memory or belief evidence cites it, and
    // nothing the Ledger changed concerns the PC or the PC's household.
    for (const m of social.memoriesOf(sim.world, pc)) expect(tilted.has(m.eventId as number)).toBe(false);
    const pcHousehold = sim.world.actors[pc]?.householdId;
    for (const row of required(st.plan).nudges) {
      if (row.process === 'fae.shortfall') {
        const bias = required(st.plan).biases.find((x) => x.id === row.bias);
        if (bias) expect(bias.key).not.toBe(pcHousehold);
      }
      if (row.nudge === 'N4') {
        const prop = sim.world.belief.props[sim.world.belief.beliefs[row.after as never]?.propId as never];
        expect(prop?.args.some((a) => a.kind === 'actor' && a.id === pc)).toBe(false);
      }
    }
    const totals = required(st.plan).totals;
    const effects = Object.values(totals).reduce((n, t) => n + t.effects, 0);
    expect(perceived).toBeGreaterThan(0);
    expect(effects).toBeGreaterThan(0);
    expect(offscreen).toBeGreaterThanOrEqual(0);
    for (const row of required(st.plan).nudges) {
      expect(row.knowledge).toBe('omniscient');
      expect(row.target).not.toBe(pc);
    }
    expect(findNonIntegers(sim.world)).toEqual([]);
  }, 600_000);

  it('every hook returns no bias for a decision the PC takes part in or is present at', () => {
    const sim = almanac(42);
    runHours(sim, 1);
    const { pc, a, b, elsewhere, here } = apart(sim);
    bias(sim, { hook: 'option', process: 'company_venue', nudge: 'N8', subject: a, toward_pc: true, amount: 900 });
    bias(sim, { hook: 'threshold', process: 'fae.notice', nudge: 'N9', key: elsewhere, amount: 9 });
    bias(sim, { hook: 'window', process: 'loan_breach', nudge: 'N6', subject: a, amount: 5000 });
    const venue = required(director.optionTiltFor(sim.world, 'company_venue', a, 'place', [elsewhere]));
    expect(venue(here)?.amount).toBe(director.OPTION_TILT_MAX_PM); // capped at 15%
    expect(director.thresholdTiltFor(sim.world, 'fae.notice', elsewhere, 'place', [a], [elsewhere])?.amount).toBe(
      director.THRESHOLD_TILT_MAX,
    );
    expect(social.windowPick(sim.world, 'loan_breach', a, [a, b], [], [100, 200], 150).at).toBe(200); // own window
    // The PC present (T0), or a party: nothing.
    expect(director.optionTiltFor(sim.world, 'company_venue', a, 'place', [here])).toBeNull();
    expect(fae.thresholdTilt(sim.world, 'fae.notice', elsewhere, [a, pc], [elsewhere])).toBeNull();
    required(sim.world.actors[b]).placeId = here;
    expect(social.windowPick(sim.world, 'loan_breach', a, [a, b], [], [100, 200], 150)).toEqual({
      at: 150,
      bias: null,
    });
  }, 60_000);
});

describe('Director D1: hard prohibitions (05 §8.3)', () => {
  it('N4 never weights a kind (faekin) or charge claim, and only facts the carrier holds', () => {
    const sim = almanac(42);
    runHours(sim, 1);
    const { a, b, elsewhere } = apart(sim);
    const ctx = makeContext(sim.world, sim.content, []);
    const faekin = belief.internProp(sim.world, 'faekin', [{ kind: 'actor', id: b }]);
    const witch = belief.internProp(sim.world, 'witch', [{ kind: 'actor', id: b }]);
    const drinks = belief.internProp(sim.world, 'drinks', [{ kind: 'actor', id: b }]);
    for (const key of [faekin, witch, drinks])
      bias(sim, { hook: 'carrier', process: 'gossip', nudge: 'N4', key, amount: 500 });
    const weigh = required(belief.carrierWeight(sim.world, ctx.content, a, b, elsewhere));
    expect(weigh(faekin)).toBeNull();
    expect(weigh(witch)).toBeNull();
    expect(weigh(drinks)?.pm).toBe(belief.CARRIER_WEIGHT_MAX_PM);
  }, 60_000);

  it('the schema and planner refuse faekin, scapegoat and mind threads; no target reads people or culture', () => {
    for (const pattern of director.FORBIDDEN_PATTERNS)
      expect(
        DirectorMoveSchema.safeParse({
          id: 'x',
          pattern,
          nudge: 'N4',
          category: 'threat',
          process: 'gossip',
          amount: 500,
          cost: 2,
        }).success,
      ).toBe(false);
    const sim = almanac(42);
    runHours(sim, 48);
    const st = required(sim.world.director);
    const pc = required(st.focus);
    const npcs = Object.values(sim.world.actors)
      .filter((x) => x.alive && x.id !== pc)
      .slice(0, 2);
    const forged: Thread = {
      ...required(Object.values(st.threads)[0]),
      id: 999_999,
      pattern: 'faekin_suspicion',
      actors: { subject: required(npcs[0]).id, other: required(npcs[1]).id },
      interest: 1_000_000,
      closed_at: null,
      state: 'Active',
    };
    st.threads[forged.id] = forged;
    ensurePlan(st).budget = director.BUDGET_CAP;
    director.planDay(sim.world, makeContext(sim.world, sim.content, []));
    expect(required(st.plan).biases.some((b) => b.thread === forged.id)).toBe(false);
    const dir = join(import.meta.dirname, '../../core/src/director');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const src = readFileSync(join(dir, file), 'utf8');
      expect(src, file).not.toMatch(/ancestryId|cultureId|\.peoples|\.cultures/);
      for (const m of src.matchAll(/import \{([^}]*)\} from '\.\.\/psyche\/api\.ts'/g))
        expect(m[1]?.trim(), `${file} may only read psyche`).toBe('anxietyOf');
    }
  }, 120_000);

  it('the planner and the Director system write nothing outside world.director (no psyche writes)', () => {
    const sim = almanac(42);
    runHours(sim, 7 * 24);
    const st = required(sim.world.director);
    ensurePlan(st).budget = director.BUDGET_CAP;
    const before = stateHash(stripped(sim.world));
    director.planDay(sim.world, makeContext(sim.world, sim.content, []));
    directorSystem(sim.world, makeContext(sim.world, sim.content, []));
    expect(stateHash(stripped(sim.world))).toBe(before);
    const pc = st.focus;
    for (const b of required(st.plan).biases) {
      expect(b.subject).not.toBe(pc);
      if (b.nudge !== 'N4') continue;
      // No fabricated rumor: some living non-PC carrier holds the fact.
      const holders = Object.values(sim.world.belief.beliefs).filter(
        (x) => x.propId === b.key && x.holderId !== pc && !x.conceal,
      );
      expect(holders.length).toBeGreaterThan(0);
      const prop = required(sim.world.belief.props[b.key as never]);
      expect(sim.content.predicates[prop.pred]?.kind_of).toBeUndefined();
    }
  }, 120_000);
});

describe('Director D1: personalities and settings', () => {
  it('the Land Itself stays budget 0 with no plan slice; the Almanac plans, saves and replays', () => {
    const land = createSim(baseContent(), { scenarioId: 'iron_ford', seed: 42 });
    runHours(land, 49);
    expect(land.world.director?.settings.personality).toBe('land_itself');
    expect(land.world.director?.plan).toBeUndefined();
    const a = almanac(42);
    runHours(a, 49);
    const plan = required(a.world.director?.plan);
    expect(plan.budget + plan.reserved).toBeGreaterThan(0);
    expect(director.directorReport(a.world)?.nudges?.totals).toBeDefined();
    const b = restoreSim(a.content, packJson(a.world));
    runHours(a, 30);
    runHours(b, 30);
    expect(stateHash(a.world)).toBe(stateHash(b.world));
    expect(() => director.directorSettings({ personality: 'hearthside' as 'land_itself' })).toThrow('almanac');
  }, 120_000);

  it('foresight off pays at placement; tiltable reserves until a tilt changes something', () => {
    const off = almanac(42, 'iron_ford', 'off');
    const tilt = almanac(42, 'iron_ford', 'tiltable');
    runHours(off, 97);
    runHours(tilt, 97);
    const p0 = required(off.world.director?.plan),
      p1 = required(tilt.world.director?.plan);
    const placed = (p: typeof p0) => Object.values(p.totals).reduce((n, t) => n + t.placed, 0);
    expect(placed(p0)).toBeGreaterThan(0);
    expect(p0.reserved).toBe(0);
    expect(Object.values(p0.totals).reduce((n, t) => n + t.charged, 0)).toBe(placed(p0));
    // Tiltable: whatever is placed and not yet charged is held in reserve.
    const live = p1.biases.filter((b) => !b.charged && (b.group ?? b.id) === b.id);
    expect(p1.reserved).toBe(live.reduce((n, b) => n + b.cost, 0));
    expect(placed(p1)).toBeGreaterThan(0);
  }, 120_000);
});

describe('Director D1: review regressions', () => {
  it('N9 never steers a shortfall in the PC household, nor one a household member could show the PC', () => {
    const sim = almanac(42);
    runHours(sim, 1);
    const { pc, a, elsewhere, here } = apart(sim);
    const pcHh = required(sim.world.actors[pc]).householdId;
    const npcHh = required(sim.world.actors[a]).householdId;
    expect(npcHh).not.toBe(pcHh);
    bias(sim, { hook: 'threshold', process: 'fae.shortfall', nudge: 'N9', key: pcHh, amount: 2 });
    bias(sim, { hook: 'threshold', process: 'fae.shortfall', nudge: 'N9', key: npcHh, amount: 2 });
    expect(fae.thresholdTilt(sim.world, 'fae.shortfall', pcHh, [a], [elsewhere])).toBeNull();
    for (const m of required(sim.world.households[npcHh]).memberIds) required(sim.world.actors[m]).placeId = elsewhere;
    expect(fae.thresholdTilt(sim.world, 'fae.shortfall', npcHh, [a], [elsewhere])?.amount).toBe(2);
    // A member of the searched household standing with the PC: refused.
    const member = required(required(sim.world.households[npcHh]).memberIds.find((m) => m !== a) ?? a);
    required(sim.world.actors[member]).placeId = here;
    expect(fae.thresholdTilt(sim.world, 'fae.shortfall', npcHh, [a], [elsewhere])).toBeNull();
    // The planner never keys the PC household, even for a thread that names a household member.
    const st = required(sim.world.director);
    const plan = ensurePlan(st);
    plan.biases = [];
    plan.budget = director.BUDGET_CAP;
    st.pacing = 'BUILD';
    const mate = required(sim.world.households[pcHh]).memberIds.find((m) => m !== pc) ?? pc;
    sim.world.fae.drawCases = {
      x: { accepted: false, undiscovered: 3, householdId: pcHh } as never,
      y: { accepted: false, undiscovered: 3, householdId: npcHh } as never,
    };
    st.threads[999_998] = {
      ...required(Object.values(st.threads)[0] ?? forgedThread()),
      id: 999_998,
      pattern: 'charm',
      actors: { keeper: mate, neighbor: a },
      interest: 1_000_000,
      closed_at: null,
      state: 'Active',
    };
    plan.cycle.target = 999_998;
    director.planDay(sim.world, makeContext(sim.world, sim.content, []));
    const shortfall = plan.biases.filter((b) => b.process === 'fae.shortfall');
    expect(shortfall.map((b) => b.key)).toEqual([npcHh]);
  }, 60_000);

  it('N4 refuses a claim that can mutate into a charge, and any fact about the PC', () => {
    const sim = almanac(42);
    runHours(sim, 1);
    const { pc, a, b, elsewhere } = apart(sim);
    expect(belief.nudgeablePredicate(sim.content, 'keeps_charms')).toBe(false); // → deals_with_fae → witch
    expect(belief.nudgeablePredicate(sim.content, 'drinks')).toBe(true);
    const charms = belief.internProp(sim.world, 'keeps_charms', [{ kind: 'actor', id: b }]);
    const aboutPc = belief.internProp(sim.world, 'drinks', [{ kind: 'actor', id: pc }]);
    for (const key of [charms, aboutPc])
      bias(sim, { hook: 'carrier', process: 'gossip', nudge: 'N4', key, amount: 500 });
    const weigh = required(belief.carrierWeight(sim.world, sim.content, a, b, elsewhere));
    expect(weigh(charms)).toBeNull();
    expect(weigh(aboutPc)).toBeNull();
    for (const m of Object.values(sim.content.directorMoves ?? {}))
      if (m.nudge === 'N4') expect(m.pattern, m.id).not.toBe('charm');
  }, 60_000);

  it('N8 company venue: a biased actor already keeping company there stays, without a fresh nudge', () => {
    const sim = almanac(42);
    runHours(sim, 1);
    const { pc, a, here } = apart(sim);
    const tavern = required(Object.values(sim.world.places).find((p) => p.tags.includes('tavern')));
    const ctx = makeContext(sim.world, sim.content, []);
    required(sim.world.actors[pc]).placeId = tavern.id;
    required(sim.world.actors[a]).placeId = tavern.id;
    const state = required(sim.world.activity.byActor[a]);
    state.activityId = 'drink_at_tavern';
    state.placeId = tavern.id;
    state.travel = null;
    // No live bias: the undirected choice stands (unchanged runs).
    const plain = required(social.seekCompanyVenue(sim.world, ctx, a)).plain;
    expect(required(social.seekCompanyVenue(sim.world, ctx, a)).venue).toEqual(plain);
    bias(sim, { hook: 'option', process: 'company_venue', nudge: 'N8', subject: a, toward_pc: true, amount: 150 });
    // The PC now shares the venue, so the gate hides the bias; the actor still does not leave.
    const r = required(social.seekCompanyVenue(sim.world, ctx, a));
    expect(r.venue.placeId).toBe(tavern.id);
    expect(r.bias).toBeNull();
    void here;
  }, 60_000);
});

function forgedThread(): Thread {
  return {
    id: 0,
    pattern: 'charm',
    actors: {},
    places: [],
    opened_at: 0,
    last_advanced: 0,
    stakes_pm: 0,
    player_involvement_pm: 0,
    open_questions: [],
    state: 'Active',
    guns: [],
    callbacks: [],
    interest: 0,
    interest_explain: null,
    closed_at: null,
    last_fact: 0,
    level: 0,
  };
}
