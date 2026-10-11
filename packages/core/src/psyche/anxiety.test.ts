import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { asThoughtId } from '../ids.ts';
import type { GameMinute } from '../time.ts';
import {
  ACCRUAL_CAP,
  accrueAnxiety,
  addToPools,
  anxietyBand,
  defenseThreshold,
  dischargeAmount,
  drainPools,
  type Frustration,
} from './anxiety.ts';
import { blankPsyche, splitAnxiety, type Thought } from './state.ts';

const t = (voice: 'id' | 'superego', intensity: number, drive?: string, frustrated = 0): Thought => ({
  id: asThoughtId(1),
  voice,
  urge: { kind: 'activity', activityId: 'x' },
  intensity,
  label: 'x',
  source: 'psyche',
  bornAt: 0 as GameMinute,
  decayPerHour: 100,
  reasons: [],
  frustrated,
  ...(drive !== undefined ? { drive } : {}),
});

const op = fc.oneof(
  fc.record({
    k: fc.constant('add' as const),
    real: fc.integer({ min: -50, max: 900 }),
    neur: fc.integer({ min: 0, max: 900 }),
    moral: fc.integer({ min: 0, max: 900 }),
  }),
  fc.record({
    k: fc.constant('drain' as const),
    n: fc.integer({ min: -100, max: 2000 }),
    first: fc.constantFrom(undefined, 'real' as const, 'neur' as const, 'moral' as const),
  }),
  fc.record({
    k: fc.constant('accrue' as const),
    ts: fc.array(
      fc.record({
        v: fc.constantFrom('id' as const, 'superego' as const),
        i: fc.integer({ min: 0, max: 1000 }),
        f: fc.integer({ min: -20, max: 120 }),
        fear: fc.boolean(),
        fr: fc.integer({ min: 0, max: 3 }),
      }),
      { maxLength: 12 },
    ),
  }),
  fc.record({ k: fc.constant('discharge' as const), r: fc.integer({ min: 0, max: 1000 }) }),
);

describe('anxiety economics (10 §6)', () => {
  it('anxiety stays in 0..1000, integer, and equals the sum of the three pools', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.array(op, { maxLength: 40 }),
        (ego, superego, start, ops) => {
          const p = { ...blankPsyche(), ego, superego, anxSrc: splitAnxiety(start, 50, superego) };
          p.anxiety = p.anxSrc.real + p.anxSrc.neur + p.anxSrc.moral;
          expect(p.anxiety).toBe(start);
          for (const o of ops) {
            if (o.k === 'add') addToPools(p, { real: o.real, neur: o.neur, moral: o.moral });
            else if (o.k === 'drain') drainPools(p, o.n, o.first);
            else if (o.k === 'discharge') drainPools(p, dischargeAmount(p.anxiety, p.ego, o.r));
            else {
              const fr: Frustration[] = o.ts.map((x) => ({
                thought: t(x.v, x.i, x.fear ? 'fear' : 'rage', x.fr),
                f: x.f,
              }));
              const live = fr.filter((x) => x.thought.drive === 'fear').map((x) => x.thought);
              const acc = accrueAnxiety(p, fr, new Set(['fear']), live);
              const gain = acc.add.real + acc.add.neur + acc.add.moral;
              expect(gain).toBeGreaterThanOrEqual(0);
              expect(gain).toBeLessThanOrEqual(ACCRUAL_CAP);
              addToPools(p, acc.add);
            }
            const s = p.anxSrc;
            for (const v of [s.real, s.neur, s.moral, p.anxiety]) {
              expect(Number.isInteger(v)).toBe(true);
              expect(v).toBeGreaterThanOrEqual(0);
            }
            expect(p.anxiety).toBeLessThanOrEqual(1000);
            expect(p.anxiety).toBe(s.real + s.neur + s.moral);
          }
        },
      ),
      { numRuns: 400 },
    );
  });

  it('accrual follows the pool formulas with habituation', () => {
    const p = { ...blankPsyche(), ego: 40, superego: 80 };
    // Id 500 frustrated, first time: neur += 500/10 × 100% × 60% = 30.
    expect(accrueAnxiety(p, [{ thought: t('id', 500, 'rage'), f: 0 }], new Set(), []).add.neur).toBe(30);
    // Habituated (lost last hour too): 25%.
    expect(accrueAnxiety(p, [{ thought: t('id', 500, 'rage', 1), f: 0 }], new Set(), []).add.neur).toBe(7);
    // Superego 500 defied, compromise satisfied 50%: moral += 50 × 50% × 80% = 20.
    expect(accrueAnxiety(p, [{ thought: t('superego', 500), f: 50 }], new Set(), []).add.moral).toBe(20);
    // Fear books realistic anxiety whatever was chosen: 500/10 × 60% = 30.
    const fear = t('id', 500, 'fear');
    expect(accrueAnxiety(p, [], new Set(['fear']), [fear]).add).toEqual({ real: 30, neur: 0, moral: 0 });
    // Quiet thoughts (< 150) book nothing.
    expect(accrueAnxiety(p, [{ thought: t('id', 140, 'rage'), f: 0 }], new Set(), []).add.neur).toBe(0);
  });

  it('discharge, bands and the defense threshold', () => {
    expect(dischargeAmount(400, 50, 40)).toBe(16 + 5);
    expect(dischargeAmount(3, 90, 10)).toBe(3);
    expect(defenseThreshold(20)).toBe(310);
    expect(defenseThreshold(50)).toBe(400);
    expect(defenseThreshold(90)).toBe(520);
    expect([0, 199, 200, 599, 600, 800, 1000].map(anxietyBand)).toEqual([0, 0, 1, 2, 3, 4, 4]);
  });

  it('relief comes from the triggering pool first', () => {
    const p = { ...blankPsyche(), anxSrc: { real: 100, neur: 200, moral: 300 }, anxiety: 600 };
    drainPools(p, 250, 'moral');
    expect(p.anxSrc).toEqual({ real: 100, neur: 200, moral: 50 });
    drainPools(p, 100, 'moral');
    expect(p.anxSrc.moral).toBe(0);
    expect(p.anxiety).toBe(250);
  });
});
