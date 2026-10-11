import { describe, expect, it } from 'vitest';
import { normalizeExplain, term } from './explain.ts';

describe('explain terms', () => {
  it('never carry negative zero', () => {
    expect(Object.is(term('psyche', 'Nerves', -0).value, 0)).toBe(true);
    expect(Object.is(term('psyche', 'Nerves', -0.2).value, 0)).toBe(true);
    const e = normalizeExplain({
      kind: 'check',
      label: 'x',
      subjects: [],
      knowledge: 'self',
      terms: [{ source: 'psyche', label: 'Nerves', value: -0 }],
      total: -0,
      margin: -0,
      dc: { total: 10, terms: [{ source: 'base', label: 'b', value: -0 }] },
      outcome: 'success',
      children: [{ kind: 'formula', label: 'c', subjects: [], knowledge: 'self', terms: [], total: -0, outcome: 'x' }],
    });
    expect(JSON.stringify(e)).not.toContain('-0');
    expect(
      [e.total, e.margin, e.terms[0]?.value, e.dc?.terms[0]?.value, e.children?.[0]?.total].every((v) =>
        Object.is(v, 0),
      ),
    ).toBe(true);
  });
});
