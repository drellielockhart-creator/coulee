import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  credenceFromLogit,
  decayStep,
  LOGIT_Q8,
  logitQ8,
  logitStep,
  SIG_PERMILLE,
  sigmoidPermille,
} from './intmath.ts';

describe('integer belief math', () => {
  it('matches the committed logit and sigmoid tables', () => {
    for (let c = 1; c < 100; c++) {
      expect(LOGIT_Q8[c]).toBe(Math.round(256 * Math.log(c / (100 - c))));
      expect(credenceFromLogit(logitQ8(c))).toBe(c);
    }
    for (let i = 0; i < 65; i++) expect(SIG_PERMILLE[i]).toBe(Math.round(1000 / (1 + Math.exp(-(i - 32) / 4))));
  });
  it('keeps arbitrary evidence sequences bounded and integer, preserving weak evidence', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.array(fc.integer({ min: -2048, max: 2048 }), { maxLength: 500 }),
        (start, evidence) => {
          let state = { credence: start, carry: 0 };
          for (const delta of evidence) {
            const before = logitQ8(state.credence) + state.carry;
            state = logitStep(state.credence, state.carry, delta);
            expect(state.credence).toBeGreaterThanOrEqual(1);
            expect(state.credence).toBeLessThanOrEqual(99);
            expect(Number.isInteger(state.carry)).toBe(true);
            expect(Math.abs(state.carry)).toBeLessThanOrEqual(127);
            const after = logitQ8(state.credence) + state.carry;
            if (delta > 0) expect(after).toBeGreaterThanOrEqual(before);
            if (delta < 0) expect(after).toBeLessThanOrEqual(before);
          }
        },
      ),
    );
    let state = { credence: 50, carry: 0 };
    for (let i = 0; i < 10; i++) state = logitStep(state.credence, state.carry, 1);
    expect(state.credence).toBe(51);
  });
  it('sigmoid is monotone and fixed-point decay respects floors', () => {
    fc.assert(
      fc.property(fc.integer({ min: -5000, max: 5000 }), (x) => {
        expect(sigmoidPermille(x + 1)).toBeGreaterThanOrEqual(sigmoidPermille(x));
        expect(sigmoidPermille(x)).toBeGreaterThanOrEqual(0);
        expect(sigmoidPermille(x)).toBeLessThanOrEqual(1000);
      }),
    );
    let state = { value: 100, residue: 0 };
    for (let i = 0; i < 1000; i++) state = decayStep(state.value, state.residue, 30, 20);
    expect(state.value).toBe(20);
  });
});
