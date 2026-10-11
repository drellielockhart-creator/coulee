import { describe, expect, it } from 'vitest';
import { canonicalStringify, findNonIntegers, hashValue } from './hash.ts';

describe('hash', () => {
  it('is independent of key insertion order', () => {
    expect(hashValue({ a: 1, b: [1, 2, { c: 'x', d: null }] })).toBe(
      hashValue({ b: [1, 2, { d: null, c: 'x' }], a: 1 }),
    );
    expect(canonicalStringify({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('distinguishes values and structure', () => {
    expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 2 }));
    expect(hashValue([1, 2])).not.toBe(hashValue([2, 1]));
    expect(hashValue({ a: '1' })).not.toBe(hashValue({ a: 1 }));
    expect(hashValue({ a: undefined, b: 1 })).toBe(hashValue({ b: 1 }));
  });

  it('rejects non-plain data', () => {
    expect(() => hashValue({ f: () => 1 })).toThrow();
    expect(() => hashValue({ n: Number.NaN })).toThrow();
  });

  it('finds non-integers', () => {
    expect(findNonIntegers({ a: 1, b: [2, 3.5], c: { d: 0.1 } })).toEqual(['$.b[1]=3.5', '$.c.d=0.1']);
  });
});
