/**
 * module:social integration tests (MODULES.md module:social acceptance).
 */
import {
  type ActorId,
  asGameMinute,
  createSim,
  type Event,
  findNonIntegers,
  type MemoryId,
  makeContext,
  type PlaceId,
  restoreSim,
  rowsOf,
  runHours,
  type Sim,
  social,
  stateHash,
  toGameMinute,
  type World,
  yearsBetween,
} from '@coulee/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseContent, simFor } from './helpers.ts';

// Spy on belief.transmit (the ONLY gossip path) without changing its behavior, and allow a
// stub mode that answers told:false like the belief stub did.
const spy = vi.hoisted(() => ({ calls: [] as Array<number | null>, stub: false }));
vi.mock('../../core/src/belief/api.ts', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../core/src/belief/api.ts')>();
  return {
    ...orig,
    transmit: (...args: Parameters<typeof orig.transmit>) => {
      spy.calls.push(args[2].interactionEventId as number | null);
      if (spy.stub) return { told: false, rumorId: null, propId: null, mutation: null, listenerCredence: 0 };
      return orig.transmit(...args);
    },
  };
});

const content = baseContent();
const ctxOf = (sim: Sim) => makeContext(sim.world, sim.content, []);
const interactions = (w: World) =>
  w.log.events.filter((e): e is Extract<Event, { kind: 'social.interaction' }> => e.kind === 'social.interaction');

function adultsAtSamePlace(sim: Sim, n = 2): ActorId[] | null {
  const now = sim.world.time;
  const byPlace = new Map<number, ActorId[]>();
  for (const a of rowsOf(sim.world.actors)) {
    if (!a.alive || yearsBetween(a.born, now) < 18) continue;
    const list = byPlace.get(a.placeId) ?? [];
    list.push(a.id);
    byPlace.set(a.placeId, list);
  }
  for (const k of [...byPlace.keys()].sort((a, b) => a - b)) {
    const l = byPlace.get(k) ?? [];
    if (l.length >= n) return l.slice(0, n);
  }
  return null;
}

/** Put actors at one place for this hour (test setup only: activity owns placeId in play). */
function gather(world: World, ids: ActorId[], placeId: PlaceId) {
  for (const id of ids) {
    const a = world.actors[id];
    if (a) a.placeId = placeId;
    const act = world.activity.byActor[id];
    if (act) {
      act.placeId = placeId;
      act.activityId = 'drink_at_tavern';
      act.travel = null;
    }
  }
  const occ: Record<number, ActorId[]> = {};
  for (const a of rowsOf(world.actors)) {
    const list = occ[a.placeId] ?? [];
    list.push(a.id);
    occ[a.placeId] = list;
  }
  world.activity.occupancy = occ;
}

const tavernOf = (world: World): PlaceId => {
  const p = rowsOf(world.places).find((x) => x.tags.includes('tavern'));
  if (!p) throw new Error('scenario needs a tavern');
  return p.id;
};

describe('social: Iron Ford, 60 days, seed 42', () => {
  const sim = simFor({ seed: 42 });
  const start = new Map<string, number>();
  let evs: ReturnType<typeof interactions> = [];
  let actors = 0;
  beforeAll(() => {
    for (const from of Object.keys(sim.world.social.opinions).map(Number)) {
      const table = sim.world.social.opinions[from] ?? {};
      for (const to of Object.keys(table).map(Number)) {
        start.set(`${from}>${to}`, social.opinionOf(sim.world, from as ActorId, to as ActorId).affection);
      }
    }
    spy.calls.length = 0;
    runHours(sim, 60 * 24);
    evs = interactions(sim.world);
    actors = rowsOf(sim.world.actors).filter((a) => a.alive).length;
  }, 600_000);

  it('meets the 04 §11.2 budget: >= 3 interactions per actor-day', () => {
    expect(evs.length / (actors * 60)).toBeGreaterThanOrEqual(3);
    expect(sim.world.social.totals.interactions).toBe(evs.length);
  });

  it('attaches an Explain to every interaction; checked ones carry the roll and DC', () => {
    let checked = 0;
    for (const e of evs) {
      expect(e.explain).toBeDefined();
      const def = content.interactions[e.data.interactionId];
      if (!def || def.check.kind === 'none') continue;
      checked++;
      expect(['check', 'opposed']).toContain(e.explain?.kind);
      expect(e.explain?.dc).toBeDefined();
      expect(['success', 'failure', 'tie_defender']).toContain(e.explain?.outcome);
      expect(e.data.success).toBe(e.explain?.outcome === 'success');
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('drifts at least one opinion pair by >= 20 Affection', () => {
    let maxDrift = 0;
    for (const from of Object.keys(sim.world.social.opinions).map(Number)) {
      const table = sim.world.social.opinions[from] ?? {};
      for (const to of Object.keys(table).map(Number)) {
        const now = social.opinionOf(sim.world, from as ActorId, to as ActorId).affection;
        const was = start.get(`${from}>${to}`) ?? table[to]?.base.affection ?? 0;
        maxDrift = Math.max(maxDrift, Math.abs(now - was));
      }
    }
    expect(maxDrift).toBeGreaterThanOrEqual(20);
  });

  it('every gossip act called belief.transmit exactly once, with its event id', () => {
    const gossip = evs.filter((e) => e.data.success && content.interactions[e.data.interactionId]?.transmits_rumor);
    const counts = new Map<number | null, number>();
    for (const id of spy.calls) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const e of gossip) expect(counts.get(e.id as number)).toBe(1);
    const fromSocial = spy.calls.filter((id) => id !== null && gossip.some((g) => g.id === id)).length;
    expect(fromSocial).toBe(gossip.length);
  });

  it('keeps the social slice integer, memories capped, reasons capped', () => {
    expect(findNonIntegers(sim.world.social as unknown as World)).toEqual([]);
    const t = social.tuningOf(content);
    for (const owner of Object.keys(sim.world.social.memoriesByOwner).map(Number)) {
      expect((sim.world.social.memoriesByOwner[owner] ?? []).length).toBeLessThanOrEqual(t.max_memories);
    }
    for (const from of Object.keys(sim.world.social.opinions).map(Number)) {
      const table = sim.world.social.opinions[from] ?? {};
      for (const op of Object.values(table)) {
        expect(op.reasons.filter((r) => r.cites.kind !== 'other').length).toBeLessThanOrEqual(t.max_reasons);
        expect(op.reasons.filter((r) => r.cites.kind === 'other').length).toBeLessThanOrEqual(1);
        const sum = social.opinionSum(sim.world, from as ActorId, op.targetId);
        const v = social.opinionOf(sim.world, from as ActorId, op.targetId);
        expect(v.affection).toBe(Math.max(-100, Math.min(100, sum.affection)));
        expect(v.fear).toBe(Math.max(0, Math.min(100, sum.fear)));
      }
    }
  });

  it('writes memories from interactions, including overheard witness memories', () => {
    const mems = Object.values(sim.world.social.memories);
    expect(mems.some((m) => m.source.kind === 'overheard')).toBe(true);
    expect(mems.some((m) => m.eventId !== null)).toBe(true);
  });
});

describe('social: gossip goes through belief.transmit', () => {
  it('a chosen gossip urge calls transmit exactly once, and resolves as told:false under the stub', () => {
    const sim = simFor({ seed: 5 });
    const pair = adultsAtSamePlace(sim);
    if (!pair) throw new Error('need two adults together');
    const [a, b] = pair as [ActorId, ActorId];
    const ctx = ctxOf(sim);
    social.bumpFamiliarity(sim.world, content, a, b);
    const gossip = content.interactions.gossip;
    if (!gossip) throw new Error('content needs gossip');
    for (const stub of [false, true]) {
      spy.stub = stub;
      spy.calls.length = 0;
      const before = sim.world.social.daily.told;
      const pr = social.makePair(sim.world, ctx, a, b, sim.world.actors[a]?.placeId ?? null, 0);
      if (!pr) throw new Error('pair');
      const cd = sim.world.social.opinions[a]?.[b];
      if (cd) cd.cooldowns = {};
      expect(social.requiresFail(pr, gossip, 'urge')).toBeNull();
      const out = social.resolveInteraction(sim.world, ctx, {
        def: gossip,
        initiatorId: a,
        targetId: b,
        placeId: sim.world.actors[a]?.placeId ?? null,
        present: [],
        mode: 'urge',
        via: 'urge',
      });
      expect(spy.calls).toEqual([out.eventId]);
      expect(out.success).toBe(true);
      if (stub) {
        expect(out.told).toBe(false);
        expect(sim.world.social.daily.told).toBe(before);
      }
      const ev = sim.world.log.events.find((e) => e.id === out.eventId);
      expect(ev?.kind).toBe('social.interaction');
    }
    spy.stub = false;
  });
});

describe('social: encounter selection is O(n·k)', () => {
  it('a 300-actor venue costs at most k candidate evaluations per initiation', () => {
    const sim = simFor({ seed: 9 });
    const w = sim.world;
    const tavern = tavernOf(w);
    const template = rowsOf(w.actors).find((a) => yearsBetween(a.born, w.time) >= 21);
    if (!template) throw new Error('need an adult');
    const ids: ActorId[] = rowsOf(w.actors).map((a) => a.id);
    let next = w.counters.actor;
    while (ids.length < 300) {
      next += 1;
      const id = next as ActorId;
      w.actors[id] = { ...structuredClone(template), id, key: `clone_${id}` };
      const needs = w.needs.byActor[template.id];
      if (needs) w.needs.byActor[id] = structuredClone(needs);
      const psy = w.psyche.byActor[template.id];
      if (psy) w.psyche.byActor[id] = structuredClone(psy);
      const act = w.activity.byActor[template.id];
      if (act) w.activity.byActor[id] = structuredClone(act);
      w.social.opinions[id] = {};
      w.social.memoriesByOwner[id] = [];
      ids.push(id);
    }
    w.counters.actor = next;
    gather(w, ids, tavern);
    w.time = toGameMinute(1855, 4, 3, 20);
    const t = social.tuningOf(content);
    let maxTies = 0;
    for (const id of ids) maxTies = Math.max(maxTies, Object.keys(w.social.opinions[id] ?? {}).length);
    const workBefore = w.social.totals.encounterWork;
    const interactionsBefore = w.social.totals.interactions;
    social.socialSystem(w, makeContext(w, content, []));
    const work = w.social.totals.encounterWork - workBefore;
    const made = w.social.totals.interactions - interactionsBefore;
    const n = ids.length;
    expect(made).toBeGreaterThan(0);
    // Per initiation: one pass over the initiator's ties (capped) + the stranger attempts.
    const perDraw = Math.min(maxTies, t.max_opinions) + t.stranger_attempts;
    expect(work).toBeLessThanOrEqual(n * t.max_initiations_per_hour * perDraw);
    expect(work).toBeLessThan((n * n) / 10);
    // Participation caps hold for everyone.
    const counts = new Map<number, number>();
    for (const e of interactions(w).filter((e) => e.t === w.time)) {
      for (const id of [e.data.initiatorId, e.data.targetId]) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const c of counts.values()) expect(c).toBeLessThanOrEqual(t.max_participations_per_hour + 1);
  });
});

describe('social: urges and defenses', () => {
  it('proposes company seeking when lonely and a targeted urge against a hated neighbor', () => {
    const sim = simFor({ seed: 11 });
    const w = sim.world;
    // A neighbor, not a housemate: hard words under one roof are damped (insult volition).
    const adults = rowsOf(w.actors).filter((x) => yearsBetween(x.born, w.time) >= 18);
    const a = adults[0]?.id;
    const b = adults.find((x) => x.householdId !== adults[0]?.householdId)?.id;
    if (a === undefined || b === undefined) throw new Error('need two adults of different households');
    gather(w, [a, b], tavernOf(w));
    w.time = toGameMinute(1855, 4, 3, 19);
    const ctx = ctxOf(sim);
    const need = w.needs.byActor[a];
    if (need) need.values.company = 100;
    // A grudge built only from Reasons citing memories (opinions are never written directly).
    for (let k = 0; k < 4; k++) {
      const mem = social.addMemory(w, ctx, {
        ownerId: a,
        eventId: null,
        kind: 'insult',
        at: w.time,
        placeId: null,
        roles: [
          { who: b, role: 'agent', conf: 100 },
          { who: a, role: 'victim', conf: 100 },
        ],
        source: { kind: 'witnessed' },
        emotion: 'anger',
        intensity: 80,
        salience: 900,
        confidence: 1000,
        rehearsals: 0,
        pinned: false,
        summary: 'Called me a liar before the whole store',
      });
      expect(mem).not.toBeNull();
      social.addOpinionReason(w, ctx, a, b, {
        label: 'Called me a liar',
        cites: { kind: 'memory', id: mem as MemoryId },
        delta: { affection: -40, respect: -10, trust: -20, fear: 0 },
        since: w.time,
      });
    }
    expect(social.opinionOf(w, a, b).affection).toBeLessThan(-40);
    const urges = social.proposeSocialUrges(w, ctx, a);
    expect(urges.some((u) => u.urge.kind === 'activity' && u.drive === 'longing')).toBe(true);
    const targeted = urges.filter((u) => u.urge.kind === 'interaction');
    expect(targeted.length).toBeGreaterThan(0);
    for (const u of targeted) {
      expect(u.urge.kind === 'interaction' && u.urge.targetId).toBe(b);
      expect(u.intensity).toBeGreaterThan(0);
      expect(u.intensity).toBeLessThanOrEqual(1000);
      expect(u.reasons.length).toBeGreaterThan(0);
    }
  });

  it('executes a displacement defense as a hostile interaction with a viaDefense reason', () => {
    const sim = simFor({ seed: 13 });
    const w = sim.world;
    const adults = rowsOf(w.actors)
      .filter((x) => yearsBetween(x.born, w.time) >= 21)
      .map((x) => x.id);
    const [a, b, c] = adults as [ActorId, ActorId, ActorId];
    gather(w, [a, b, c], tavernOf(w));
    w.time = toGameMinute(1855, 4, 3, 20);
    for (const o of [b, c]) social.bumpFamiliarity(w, content, a, o);
    const psy = w.psyche.byActor[a];
    if (!psy) throw new Error('psyche slice');
    psy.chosen = {
      urge: { kind: 'defense', defense: 'displacement', targetId: b },
      voice: 'ego',
      compromise: false,
      at: w.time,
      explain: {
        kind: 'arbitration',
        label: 'test',
        subjects: [a],
        knowledge: 'self',
        terms: [],
        total: 0,
        outcome: 'chosen',
      },
    };
    const before = w.log.events.length;
    social.socialSystem(w, makeContext(w, content, []));
    const mine = w.log.events
      .slice(before)
      .filter((e): e is Extract<Event, { kind: 'social.interaction' }> => e.kind === 'social.interaction')
      .find((e) => e.data.initiatorId === a && e.data.targetId === b);
    expect(mine).toBeDefined();
    const acts = content.defenses.displacement?.acts ?? [];
    const tuned = social.tuningOf(content).defense_interactions.find((d) => d.defense === 'displacement');
    const allowed = acts.length > 0 ? acts : (tuned?.interactions ?? []);
    expect(allowed).toContain(mine?.data.interactionId);
    if (tuned?.reason) {
      const reasons = w.social.opinions[a]?.[b]?.reasons ?? [];
      expect(reasons.some((r) => r.viaDefense === 'displacement')).toBe(true);
    }
    expect(w.social.daily.defenses).toBeGreaterThan(0);
  });
});

describe('social: views honor perspective (P1)', () => {
  it('self and god see memories and numbers; others see only a label toward themselves', () => {
    const sim = simFor({ seed: 42, hours: 72 });
    const w = sim.world;
    const holder = rowsOf(w.actors).find(
      (a) => (w.social.memoriesByOwner[a.id] ?? []).length > 0 && Object.keys(w.social.opinions[a.id] ?? {}).length > 1,
    );
    if (!holder) throw new Error('need an actor with memories');
    const viewer = Number(Object.keys(w.social.opinions[holder.id] ?? {})[0]) as ActorId;
    const opts = (perspective: ActorId | null) => ({
      perspective,
      omniscient: false,
      includeExplain: false,
      recentChronicle: 0,
    });
    const own = social.viewSocialActor(w, content, holder.id, opts(holder.id));
    const god = social.viewSocialActor(w, content, holder.id, opts(null));
    const other = social.viewSocialActor(w, content, holder.id, opts(viewer));
    expect(own.memories.length).toBeGreaterThan(0);
    expect(god.memories.length).toBe(own.memories.length);
    expect(other.memories).toEqual([]);
    expect(other.opinions.every((o) => o.targetId === viewer)).toBe(true);
    for (const o of other.opinions) {
      expect(o.numbersKnown).toBe(false);
      expect([o.affection, o.respect, o.trust, o.fear]).toEqual([0, 0, 0, 0]);
      for (const r of o.reasons) expect([r.affection, r.respect, r.trust, r.fear]).toEqual([0, 0, 0, 0]);
    }
    expect(own.opinions.length).toBeGreaterThan(other.opinions.length);
    expect(other.relationships).toEqual(own.relationships.filter((r) => r.otherId === viewer));
  });
});

describe('social: scenario seeds', () => {
  it('seeds bases from compatibility and structural priors, and creditor ledgers', () => {
    const sim = simFor({ seed: 1 });
    const w = sim.world;
    for (const r of w.social.relationships) {
      expect(w.social.opinions[r.a]?.[r.b]).toBeDefined();
      expect(w.social.opinions[r.b]?.[r.a]).toBeDefined();
      const base = w.social.opinions[r.a]?.[r.b]?.base;
      expect(base).toEqual(social.baseOpinion(w, content, r.a, r.b));
    }
    const spouses = w.social.relationships.find((r) => r.kind === 'spouse');
    if (spouses) expect(w.social.opinions[spouses.a]?.[spouses.b]?.base.affection).toBeGreaterThanOrEqual(20);
    const credit = w.social.relationships.find((r) => r.kind === 'creditor' && (r.amountCents ?? 0) > 0);
    if (credit) {
      expect(social.debtOf(w, credit.a, credit.b).cents).toBe(credit.amountCents);
    }
  });

  it('is deterministic across a JSON save/load', () => {
    const a = createSim(content, { scenarioId: 'iron_ford', seed: 21 });
    runHours(a, 24 * 4);
    const b = createSim(content, { scenarioId: 'iron_ford', seed: 21 });
    runHours(b, 24 * 2);
    const resumed = restoreSim(content, JSON.parse(JSON.stringify(b.world)) as World);
    runHours(resumed, 24 * 2);
    expect(stateHash(resumed.world)).toBe(stateHash(a.world));
    expect(asGameMinute(a.world.time)).toBe(resumed.world.time);
  });
});
