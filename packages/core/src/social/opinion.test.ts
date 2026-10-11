import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ActorCore } from '../actor.ts';
import type { ContentBundle } from '../content.ts';
import {
  type ActorId,
  asActorId,
  asHouseholdId,
  asPlaceId,
  type BeliefId,
  type MemoryId,
  type PropId,
} from '../ids.ts';
import { rng } from '../rng.ts';
import { asGameMinute } from '../time.ts';
import type { World } from '../world.ts';
import { sampleCandidates } from './encounter.ts';
import { decayMemoriesDaily, decayOneDay, insertMemory } from './memory.ts';
import { emptyOpinion, floorDiv } from './model.ts';
import {
  addReason,
  addVolatile,
  computeBase,
  dailyOpinionUpkeep,
  ensureOpinion,
  opinionLabel,
  opinionOf,
  opinionSum,
  reasonContribution,
} from './opinion.ts';
import { createSocialState, type OpinionDims, type OpinionReason } from './state.ts';
import { DEFAULT_TUNING } from './tuning.ts';

const NOW = asGameMinute(0);

function actor(id: number, household = 1, values: Partial<ActorCore['values']> = {}): ActorCore {
  return {
    id: asActorId(id),
    key: `a${id}`,
    name: { given: `A${id}`, family: 'Test' },
    sex: id % 2 === 0 ? 'female' : 'male',
    born: asGameMinute(-30 * 525600),
    ancestryId: 'human',
    presentsAsId: 'human',
    occupationId: 'farmer',
    householdId: asHouseholdId(household),
    placeId: asPlaceId(1),
    values: {
      piety: 0,
      thrift: 0,
      neighborliness: 0,
      parochialism: 0,
      superstition: 0,
      ambition: 0,
      temper: 0,
      rancor: 0,
      discretion: 0,
      ...values,
    },
    traits: [],
    sheet: {
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      skills: {},
      level: 1,
      feats: [],
      conditions: [],
      languages: [],
      literate: false,
    },
    controller: 'ai',
    alive: true,
  };
}

function fixture(n = 3) {
  const content = {
    social_tuning: {
      default: {
        ...DEFAULT_TUNING,
        relationship_priors: [
          {
            kind: 'spouse',
            a_to_b: { affection: 30, respect: 0, trust: 20, fear: 0 },
            b_to_a: { affection: 30, respect: 0, trust: 20, fear: 0 },
          },
        ],
      },
    },
    memory_kinds: {
      insult: {
        id: 'insult',
        name: 'Insult',
        valence: 'negative',
        tau_days: 20,
        floor: 0,
        consolidate: true,
        summary: '',
      },
      help: { id: 'help', name: 'Help', valence: 'positive', tau_days: 25, floor: 0, consolidate: true, summary: '' },
      misfortune: {
        id: 'misfortune',
        name: 'Grief',
        valence: 'negative',
        tau_days: 200,
        floor: 300,
        consolidate: false,
        summary: '',
      },
    },
  } as unknown as ContentBundle;
  const actors: Record<number, ActorCore> = {};
  for (let i = 1; i <= n; i++) actors[i] = actor(i, i <= 2 ? 1 : 2, { piety: i === 3 ? 3 : 0 });
  const world = {
    actors,
    social: createSocialState(),
    belief: { beliefs: {}, beliefsByHolder: {} },
    log: { lastId: 0, events: [] },
  } as unknown as World;
  const ctx = { content, emit: () => 0 as never, now: NOW } as never;
  return { world, content, ctx };
}

const A = asActorId(1);
const B = asActorId(2);
const C = asActorId(3);

function mem(world: World, ctx: never, owner: ActorId, about: ActorId, kind: string, salience: number): MemoryId {
  return insertMemory(world, ctx, {
    ownerId: owner,
    eventId: null,
    kind,
    at: NOW,
    placeId: null,
    roles: [
      { who: about, role: 'agent', conf: 100 },
      { who: owner, role: 'victim', conf: 100 },
    ],
    source: { kind: 'witnessed' },
    emotion: 'anger',
    intensity: 50,
    salience,
    confidence: 1000,
    rehearsals: 0,
    pinned: false,
    summary: 'test',
  });
}

const dims = fc.record({
  affection: fc.integer({ min: -100, max: 100 }),
  respect: fc.integer({ min: -100, max: 100 }),
  trust: fc.integer({ min: -100, max: 100 }),
  fear: fc.integer({ min: -100, max: 100 }),
});

type Op =
  | { k: 'memory'; d: OpinionDims; s: number }
  | { k: 'seed'; d: OpinionDims }
  | { k: 'belief'; d: OpinionDims; c: number }
  | { k: 'volatile'; d: OpinionDims }
  | { k: 'day' };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ k: fc.constant('memory' as const), d: dims, s: fc.integer({ min: 0, max: 1000 }) }),
  fc.record({ k: fc.constant('seed' as const), d: dims }),
  fc.record({ k: fc.constant('belief' as const), d: dims, c: fc.integer({ min: 0, max: 100 }) }),
  fc.record({ k: fc.constant('volatile' as const), d: dims }),
  fc.record({ k: fc.constant('day' as const) }),
);

/** Independent re-statement of 04 §6.2 for the property. */
function expected(world: World, from: ActorId, to: ActorId): OpinionDims {
  const op = world.social.opinions[from]?.[to];
  if (!op) return { affection: 0, respect: 0, trust: 0, fear: 0 };
  const sum = { ...op.base };
  for (const r of op.reasons) {
    let strength = 1000;
    if (r.cites.kind === 'memory') strength = world.social.memories[r.cites.id]?.salience ?? 0;
    if (r.cites.kind === 'other') strength = r.cites.strength;
    if (r.cites.kind === 'belief') {
      const propId = r.cites.propId;
      const b = Object.values(world.belief.beliefs).find((x) => x.holderId === from && x.propId === propId);
      strength = 10 * (b?.credence ?? 0);
    }
    sum.affection += floorDiv(r.delta.affection * strength, 1000);
    sum.respect += floorDiv(r.delta.respect * strength, 1000);
    sum.trust += floorDiv(r.delta.trust * strength, 1000);
    sum.fear += floorDiv(r.delta.fear * strength, 1000);
  }
  sum.affection += op.volatile.affection;
  sum.respect += op.volatile.respect;
  sum.trust += op.volatile.trust;
  sum.fear += op.volatile.fear;
  const cl = (v: number, lo: number) => Math.max(lo, Math.min(100, v));
  return {
    affection: cl(sum.affection, -100),
    respect: cl(sum.respect, -100),
    trust: cl(sum.trust, -100),
    fear: cl(sum.fear, 0),
  };
}

describe('opinion = base + Σ weighted reasons + volatile (04 §6.2)', () => {
  it('holds and stays clamped under random reason / volatile / decay sequences', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 40 }), (ops) => {
        const { world, content, ctx } = fixture();
        let beliefN = 0;
        for (const o of ops) {
          if (o.k === 'day') {
            decayMemoriesDaily(world, content);
            dailyOpinionUpkeep(world, content);
          } else if (o.k === 'volatile') {
            addVolatile(world, content, A, B, o.d);
          } else {
            let cites: OpinionReason['cites'] = { kind: 'seed' };
            if (o.k === 'memory') cites = { kind: 'memory', id: mem(world, ctx, A, B, 'insult', o.s) };
            if (o.k === 'belief') {
              beliefN++;
              const id = beliefN as BeliefId;
              const propId = (1000 + beliefN) as PropId;
              (world.belief.beliefs as Record<number, unknown>)[id] = { id, holderId: A, propId, credence: o.c };
              const list = (world.belief.beliefsByHolder[A] ?? []) as BeliefId[];
              list.push(id);
              world.belief.beliefsByHolder[A] = list;
              cites = { kind: 'belief', id, propId };
            }
            addReason(world, content, A, B, { label: 'x', cites, delta: o.d, since: NOW }, NOW);
          }
          const v = opinionOf(world, A, B);
          expect(v).toEqual(expected(world, A, B));
          for (const k of ['affection', 'respect', 'trust'] as const) {
            expect(v[k]).toBeGreaterThanOrEqual(-100);
            expect(v[k]).toBeLessThanOrEqual(100);
          }
          expect(v.fear).toBeGreaterThanOrEqual(0);
          expect(v.fear).toBeLessThanOrEqual(100);
          const op = world.social.opinions[A]?.[B];
          const regular = op?.reasons.filter((r) => r.cites.kind !== 'other').length ?? 0;
          expect(regular).toBeLessThanOrEqual(DEFAULT_TUNING.max_reasons);
        }
      }),
      { numRuns: 150 },
    );
  });

  it('folding into the "other" bucket preserves the sum (unless a bucket dimension clamps)', () => {
    fc.assert(
      fc.property(fc.array(dims, { minLength: 9, maxLength: 20 }), (ds) => {
        const { world, content } = fixture();
        ensureOpinion(world, content, A, B);
        for (const d of ds) {
          const before = opinionSum(world, A, B);
          const small = {
            affection: d.affection >> 3,
            respect: d.respect >> 3,
            trust: d.trust >> 3,
            fear: d.fear >> 3,
          };
          const r: OpinionReason = { label: 'x', cites: { kind: 'seed' }, delta: small, since: NOW };
          const contrib = reasonContribution(world, A, B, r);
          addReason(world, content, A, B, r, NOW);
          const after = opinionSum(world, A, B);
          expect(after.affection - before.affection).toBe(contrib.affection);
          expect(after.trust - before.trust).toBe(contrib.trust);
        }
        const op = world.social.opinions[A]?.[B];
        expect(op?.reasons.some((r) => r.cites.kind === 'other')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('a reason fades with the memory it cites, and drops out when the memory is forgotten', () => {
    const { world, content, ctx } = fixture();
    const m = mem(world, ctx, A, B, 'insult', 650);
    addReason(
      world,
      content,
      A,
      B,
      {
        label: 'insult',
        cites: { kind: 'memory', id: m },
        delta: { affection: -20, respect: 0, trust: 0, fear: 0 },
        since: NOW,
      },
      NOW,
    );
    const base = world.social.opinions[A]?.[B]?.base.affection ?? 0;
    const first = opinionOf(world, A, B).affection;
    expect(first).toBe(base + floorDiv(-20 * 650, 1000));
    let prev = first;
    for (let d = 0; d < 400; d++) {
      decayMemoriesDaily(world, content);
      dailyOpinionUpkeep(world, content);
      const now = opinionOf(world, A, B).affection;
      expect(now).toBeGreaterThanOrEqual(prev);
      prev = now;
    }
    expect(world.social.memories[m]).toBeUndefined();
    expect(world.social.opinions[A]?.[B]?.reasons.length).toBe(0);
    expect(prev).toBe(base);
  });

  it('opinions are never written directly: a record without reasons equals its base', () => {
    const { world, content } = fixture();
    const op = ensureOpinion(world, content, A, C);
    expect(opinionOf(world, A, C)).toEqual(op.base);
    expect(op.base).toEqual(computeBase(world, content, A, C));
  });
});

describe('base priors (04 §3.1, §7.1)', () => {
  it('compatibility lowers affection for unlike minds; household and spouse priors add', () => {
    const { world, content } = fixture();
    // 1 and 2 share a household; 3 is devout (piety +3) in another.
    expect(computeBase(world, content, A, B).affection).toBe(5 + 10);
    expect(computeBase(world, content, A, C).affection).toBe(5 - 6);
    world.social.relationships.push({ a: A, b: B, kind: 'spouse', since: NOW, amountCents: null });
    // Kin edge replaces the household prior.
    expect(computeBase(world, content, A, B)).toEqual({ affection: 35, respect: 0, trust: 20, fear: 0 });
  });
});

describe('memory decay (04 §4.3)', () => {
  it('is monotone, respects the floor, and never rises', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 0, max: 300 }),
        (s, tau, floor) => {
          const start = Math.max(s, floor);
          const next = decayOneDay(start, tau, floor);
          expect(next).toBeLessThanOrEqual(start);
          expect(next).toBeGreaterThanOrEqual(floor);
          if (start > floor + 1) expect(next).toBeLessThan(start);
        },
      ),
    );
  });

  it('a floored memory (grief) is never forgotten', () => {
    const { world, content, ctx } = fixture();
    const id = insertMemory(world, ctx, {
      ownerId: A,
      eventId: null,
      kind: 'misfortune',
      at: NOW,
      placeId: null,
      roles: [{ who: A, role: 'victim', conf: 100 }],
      source: { kind: 'witnessed' },
      emotion: 'grief',
      intensity: 100,
      salience: 1000,
      confidence: 1000,
      rehearsals: 0,
      pinned: false,
      summary: 'grief',
    });
    for (let d = 0; d < 2000; d++) decayMemoriesDaily(world, content);
    expect(world.social.memories[id]?.salience).toBe(300);
  });
});

describe('encounter sampler is O(n·k) (04 §11.2, §13.2)', () => {
  it('bounds work by ties + stranger attempts per initiator, for a 300-actor pool', () => {
    const n = 300;
    const pool = Array.from({ length: n }, (_, i) => asActorId(i + 1));
    const present = new Set<number>(pool);
    for (const tiesPer of [0, 20, 150]) {
      let work = 0;
      for (const id of pool) {
        const ties: Record<number, ReturnType<typeof emptyOpinion>> = {};
        for (let k = 1; k <= tiesPer; k++) {
          const other = asActorId(((id + k * 7) % n) + 1);
          if (other === id) continue;
          const op = emptyOpinion(other);
          op.familiarity = (k * 37) % 1000;
          ties[other] = op;
        }
        const r = rng(1, 'test', 0, id);
        const res = sampleCandidates(id, ties, pool, present, () => true, r, 4, 3);
        expect(res.candidates.filter((c) => !c.stranger).length).toBeLessThanOrEqual(4);
        expect(res.candidates.filter((c) => c.stranger).length).toBeLessThanOrEqual(1);
        expect(res.work).toBeLessThanOrEqual(Object.keys(ties).length + 3);
        work += res.work;
      }
      expect(work).toBeLessThanOrEqual(n * (tiesPer + 3));
      expect(work).toBeLessThan(n * n);
    }
  });

  it('picks the most familiar ties present, ties broken by id', () => {
    const ties: Record<number, ReturnType<typeof emptyOpinion>> = {};
    for (const [id, fam] of [
      [2, 100],
      [3, 900],
      [4, 900],
      [5, 50],
      [6, 999],
      [7, 500],
    ] as const) {
      const op = emptyOpinion(asActorId(id));
      op.familiarity = fam;
      ties[id] = op;
    }
    const pool = [1, 2, 3, 4, 5, 7].map(asActorId); // 6 is elsewhere
    const res = sampleCandidates(A, ties, pool, new Set<number>(pool), () => true, rng(1, 'test', 0, 1), 3, 0);
    expect(res.candidates.map((c) => c.id)).toEqual([3, 4, 7]);
  });
});

describe('reasons keep their history; labels do not flicker (review)', () => {
  it('the same wrong again folds into one counted Reason before anything is evicted', () => {
    const { world, content, ctx } = fixture();
    for (let i = 0; i < DEFAULT_TUNING.max_reasons + 3; i++) {
      const id = mem(world, ctx, A, B, 'insult', 800);
      const label = 'Came at me with fists at Hurd House';
      addReason(
        world,
        content,
        A,
        B,
        { label, cites: { kind: 'memory', id }, delta: { affection: -10, respect: 0, trust: 0, fear: 0 }, since: NOW },
        NOW,
      );
    }
    const op = world.social.opinions[A]?.[B];
    const counted = op?.reasons.filter((r) => /\(\d+ times since April 1\)$/.test(r.label)) ?? [];
    expect(counted.length).toBeGreaterThan(0);
    expect(op?.reasons.some((r) => r.cites.kind === 'other')).toBe(false);
    // The pile's weight survives the merge, up to what one Reason can carry (a delta of −100).
    expect(opinionSum(world, A, B).affection).toBeLessThanOrEqual(-70);
  });

  it('evicted reasons fold by kind: "Old quarrels" and "Old kindnesses", never an anonymous bucket', () => {
    const { world, content } = fixture();
    for (let i = 0; i < DEFAULT_TUNING.max_reasons + 4; i++) {
      const delta = { affection: i % 2 === 0 ? -(5 + i) : 5 + i, respect: 0, trust: 0, fear: 0 };
      addReason(world, content, A, B, { label: `r${i}`, cites: { kind: 'seed' }, delta, since: NOW }, NOW);
    }
    const labels = (world.social.opinions[A]?.[B]?.reasons ?? [])
      .filter((r) => r.cites.kind === 'other')
      .map((r) => r.label);
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) expect(['Old quarrels', 'Old kindnesses']).toContain(l);
  });

  it('Friend and Enemy hold with hysteresis', () => {
    const d = (affection: number, trust: number) => ({ affection, respect: 0, trust, fear: 0 });
    expect(opinionLabel(d(35, 15))).toBe('');
    expect(opinionLabel(d(35, 15), 'Friend')).toBe('Friend');
    expect(opinionLabel(d(24, 15), 'Friend')).toBe('');
    expect(opinionLabel(d(-30, 0))).toBe('');
    expect(opinionLabel(d(-30, 0), 'Enemy')).toBe('Enemy');
    expect(opinionLabel(d(-20, 0), 'Enemy')).toBe('');
  });
});
