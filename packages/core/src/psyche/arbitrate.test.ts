import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ContentBundle } from '../content.ts';
import { sumTerms } from '../explain.ts';
import { type ActorId, asThoughtId } from '../ids.ts';
import { hashString32, mixKey, rng } from '../rng.ts';
import type { GameMinute } from '../time.ts';
import type { Urge, UrgeProposal } from '../urge.ts';
import { arbitrate, arbitrationExplain, type OptionInput } from './arbitrate.ts';
import { blankPsyche, type Thought } from './state.ts';
import { urgeKey } from './tags.ts';
import { weighProposal } from './thoughts.ts';

const ACTOR = 1 as ActorId;
const act = (activityId: string): Urge => ({ kind: 'activity', activityId });
const OPTION_IDS = ['take_meal', 'work', 'sleep', 'drink_at_tavern', 'attend_church'];

function thought(
  i: number,
  voice: Thought['voice'],
  urge: Urge,
  intensity: number,
  stance: 'for' | 'against' = 'for',
): Thought {
  return {
    id: asThoughtId(i + 1),
    voice,
    urge,
    intensity,
    label: `t${i}`,
    source: 'psyche',
    bornAt: 0 as GameMinute,
    decayPerHour: 100,
    reasons: [{ source: 'base', label: 'base', value: intensity }],
    key: `k${i}`,
    stance,
  };
}

const noise = (seed: number) => (key: string, amp: number) =>
  rng(seed, 'psyche', 600, mixKey(ACTOR, hashString32(key))).int(-amp, amp);

const thoughtArb = fc.record({
  voice: fc.constantFrom<'id' | 'superego'>('id', 'superego'),
  option: fc.integer({ min: 0, max: OPTION_IDS.length - 1 }),
  intensity: fc.integer({ min: 0, max: 1000 }),
  against: fc.boolean(),
});

function build(raw: Array<{ voice: 'id' | 'superego'; option: number; intensity: number; against: boolean }>) {
  const thoughts = raw.map((r, i) =>
    thought(i, r.voice, act(OPTION_IDS[r.option] as string), r.intensity, r.against ? 'against' : 'for'),
  );
  const seen = new Set<string>();
  const options: OptionInput[] = [];
  for (const t of thoughts) {
    if (t.stance !== 'for' || seen.has(urgeKey(t.urge))) continue;
    seen.add(urgeKey(t.urge));
    options.push({ urge: t.urge, name: urgeKey(t.urge), tags: [], reality: [] });
  }
  return { thoughts, options };
}

describe('ego arbitration (10 §5.2)', () => {
  it('is deterministic and its Explain children sum correctly', () => {
    fc.assert(
      fc.property(
        fc.array(thoughtArb, { minLength: 1, maxLength: 12 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 0xffff }),
        fc.array(fc.integer({ min: -400, max: 400 }), { minLength: 5, maxLength: 5 }),
        (raw, ego, seed, rs) => {
          const { thoughts, options } = build(raw);
          for (const o of options) {
            const i = OPTION_IDS.indexOf(o.urge.kind === 'activity' ? o.urge.activityId : '');
            o.reality = [{ source: 'need', label: 'R', value: rs[i] ?? 0 }];
          }
          const a = arbitrate(ACTOR, ego, thoughts, options, noise(seed));
          const b = arbitrate(ACTOR, ego, thoughts, options, noise(seed));
          if (options.length === 0) {
            expect(a).toBeNull();
            return;
          }
          expect(a).not.toBeNull();
          expect(JSON.stringify(a?.ranked.map((o) => [o.key, o.score]))).toBe(
            JSON.stringify(b?.ranked.map((o) => [o.key, o.score])),
          );
          if (!a) return;
          // The winner is the top score (ties by key).
          expect(a.winner.key).toBe(a.ranked[0]?.key);
          const ex = arbitrationExplain(ACTOR, 'x', a, a.winner.key, 'chosen');
          expect(ex.kind).toBe('arbitration');
          expect(ex.knowledge).toBe('self');
          expect(ex.total).toBe(sumTerms(ex.terms));
          expect(ex.total).toBe(a.winner.score);
          expect(ex.children?.length).toBe(options.length);
          for (const c of ex.children ?? []) {
            expect(c.total).toBe(sumTerms(c.terms));
            expect(Number.isInteger(c.total)).toBe(true);
            // Plain JSON: no negative zeros (they do not survive a save/load round trip).
            for (const x of c.terms) expect(Object.is(x.value, -0)).toBe(false);
          }
          expect(ex.children?.filter((c) => c.outcome === 'chosen').length).toBe(1);
          // Scores: S = floor(R·E/100) + floor(V·(150−E)/100) + noise, V = support − opposition.
          for (const o of a.options) {
            const sup = thoughts.filter((t) => t.stance === 'for' && urgeKey(t.urge) === o.key);
            const opp = thoughts.filter((t) => t.stance === 'against' && urgeKey(t.urge) === o.key);
            const V = sup.reduce((s, t) => s + t.intensity, 0) - opp.reduce((s, t) => s + t.intensity, 0);
            expect(o.V).toBe(V);
            expect(o.score).toBe(Math.floor((o.R * ego) / 100) + Math.floor((V * (150 - ego)) / 100) + o.noise);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("a 'command' proposal wins against any Id/Superego mix", () => {
    fc.assert(
      fc.property(
        fc.array(thoughtArb, { minLength: 0, maxLength: 12 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 0xffff }),
        fc.integer({ min: 0, max: OPTION_IDS.length - 1 }),
        fc.boolean(),
        (raw, ego, seed, cmdOpt, opposeIt) => {
          const { thoughts } = build(raw);
          const cmdUrge = act(OPTION_IDS[cmdOpt] as string);
          thoughts.push(thought(99, 'command', cmdUrge, 1000));
          // Conscience may thunder against the command; it still wins.
          if (opposeIt) thoughts.push(thought(100, 'superego', cmdUrge, 1000, 'against'));
          const seen = new Set<string>();
          const options: OptionInput[] = [];
          for (const t of thoughts) {
            if (t.stance !== 'for' || seen.has(urgeKey(t.urge))) continue;
            seen.add(urgeKey(t.urge));
            // Reality is stacked against the command.
            const R = urgeKey(t.urge) === urgeKey(cmdUrge) ? -1000 : 1000;
            options.push({
              urge: t.urge,
              name: urgeKey(t.urge),
              tags: [],
              reality: [{ source: 'x', label: 'R', value: R }],
            });
          }
          const res = arbitrate(ACTOR, ego, thoughts, options, noise(seed), urgeKey(cmdUrge));
          expect(res?.command).toBe(true);
          expect(res?.winner.key).toBe(urgeKey(cmdUrge));
        },
      ),
      { numRuns: 300 },
    );
  });
});

// A minimal content bundle: just the records the weighting reads.
const content = {
  drives: {
    hunger: { id: 'hunger', period_label: 'Appetite', anxiety_pool: 'neur', relief_tags: ['eat'], needs: [] },
  },
  norms: { duty: { id: 'duty', name: 'Duty', period_label: 'Diligence', base: 55, public: false, forbids: [] } },
  traits: {},
} as unknown as ContentBundle;

function weighed(
  voice: 'id' | 'superego',
  urge: Urge,
  intensity: number,
  psy: Partial<ReturnType<typeof blankPsyche>>,
) {
  const p = { ...blankPsyche(), ...psy };
  const prop: UrgeProposal = {
    urge,
    voice,
    intensity,
    label: voice === 'id' ? 'Appetite: eat something' : 'Duty: keep house',
    source: 'psyche',
    reasons: [],
    ...(voice === 'id' ? { drive: 'hunger' } : { norm: 'duty' }),
  };
  const w = weighProposal({ content, actor: { traits: [] } as never, p, audience: 0 }, prop);
  expect(sumTerms(w.reasons)).toBe(w.intensity);
  return w.intensity;
}

describe('hunger against duty (MODULES acceptance 3)', () => {
  // Hunger 250 against the 600 threshold: base = floor((600 − 250) × 1000 / 600) = 583.
  const hungerBase = Math.floor(((600 - 250) * 1000) / 600);
  const eat = act('take_meal');
  const chore = act('keep_house');
  /** A mild duty: the schedule's call at 300 (a chore, not the forge). */
  const MILD = 300;

  function decide(psy: Partial<ReturnType<typeof blankPsyche>>, dutyBase: number, seed: number) {
    const p = { ...blankPsyche(), ...psy };
    const thoughts = [
      thought(0, 'id', eat, weighed('id', eat, hungerBase, p)),
      thought(1, 'superego', chore, weighed('superego', chore, dutyBase, p)),
    ];
    const options: OptionInput[] = [
      { urge: eat, name: 'eat', tags: ['eat'], reality: [{ source: 'need', label: 'Relieves Hunger', value: 175 }] },
      {
        urge: chore,
        name: 'chore',
        tags: ['labor'],
        reality: [{ source: 'policy', label: 'The hour for it', value: 100 }],
      },
    ];
    return arbitrate(ACTOR, p.ego, thoughts, options, noise(seed));
  }

  it('the Id thought to eat beats a mild duty for an ordinary conscience', () => {
    const psy = { ego: 50, superego: 50, idAppetite: 50, drives: { hunger: 50 }, norms: { duty: 55 } };
    for (let seed = 1; seed <= 50; seed++) expect(decide(psy, MILD, seed)?.winner.key).toBe(urgeKey(eat));
  });

  it('a very strict superego holds the hungry actor to the duty', () => {
    const psy = { ego: 50, superego: 100, idAppetite: 50, drives: { hunger: 50 }, norms: { duty: 100 } };
    for (let seed = 1; seed <= 50; seed++) expect(decide(psy, MILD, seed)?.winner.key).toBe(urgeKey(chore));
  });
});
