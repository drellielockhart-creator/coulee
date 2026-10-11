import { describe, expect, it } from 'vitest';
import { opposedCheck, resolveCheck } from './checks.ts';
import { term } from './explain.ts';
import { rng } from './rng.ts';

const r = () => rng(1, 'checks', 0, 0);

describe('checks', () => {
  it('steady (take 10) is deterministic and ties succeed', () => {
    const res = resolveCheck(
      { label: 't', kind: 'skill', terms: [term('ranks', 'r', 5)], dc: 15, policy: 'steady' },
      r(),
    );
    expect(res.natural).toBe(10);
    expect(res.total).toBe(15);
    expect(res.success).toBe(true);
    expect(res.explain.dc?.total).toBe(15);
    expect(res.explain.outcome).toBe('success');
  });

  it('work it through (take 20) costs 20x time', () => {
    const res = resolveCheck({ label: 't', kind: 'skill', terms: [], dc: 20, policy: 'work_it_through' }, r());
    expect(res.success).toBe(true);
    expect(res.timePct).toBe(2000);
  });

  it('rush applies -5 as a named term', () => {
    const res = resolveCheck({ label: 't', kind: 'skill', terms: [], dc: 0, policy: 'rush' }, r());
    expect(res.explain.terms.some((t) => t.source === 'policy' && t.value === -5)).toBe(true);
  });

  it('dc terms add up and are explained', () => {
    const res = resolveCheck(
      {
        label: 'Ford the creek',
        kind: 'skill',
        terms: [],
        dc: 15,
        dcTerms: [term('weather', 'Rain +2', 2)],
        policy: 'steady',
      },
      r(),
    );
    expect(res.explain.dc?.total).toBe(17);
    expect(res.success).toBe(false);
    expect(res.margin).toBe(-7);
    expect(res.badFailure).toBe(true);
  });

  it('saves: natural 1 always fails, natural 20 always succeeds', () => {
    for (let k = 0; k < 400; k++) {
      const res = resolveCheck(
        { label: 's', kind: 'save', terms: [term('ability', 'x', 30)], dc: 5 },
        rng(1, 'checks', k, 0),
      );
      if (res.natural === 1) expect(res.success).toBe(false);
      const res2 = resolveCheck({ label: 's', kind: 'save', terms: [], dc: 99 }, rng(1, 'checks', k, 0));
      if (res2.natural === 20) expect(res2.success).toBe(true);
    }
  });

  it('opposed: defender wins ties; passive uses 10 + mod', () => {
    const res = opposedCheck(
      'Deceive vs Read People',
      { label: 'a', terms: [], passive: true },
      { label: 'd', terms: [], passive: true },
      r(),
    );
    expect(res.initiatorTotal).toBe(10);
    expect(res.defenderTotal).toBe(10);
    expect(res.initiatorWins).toBe(false);
    expect(res.explain.children).toHaveLength(2);
  });
});
