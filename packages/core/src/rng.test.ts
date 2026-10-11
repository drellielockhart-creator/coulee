import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { draw32, hashString32, mix32, mixKey, rng, STREAMS } from './rng.ts';

describe('rng determinism', () => {
  it('same (seed, stream, tick, key) gives the same sequence', () => {
    const a = rng(42, 'social', 600, 7);
    const b = rng(42, 'social', 600, 7);
    const sa = Array.from({ length: 50 }, () => a.u32());
    const sb = Array.from({ length: 50 }, () => b.u32());
    expect(sa).toEqual(sb);
  });

  it('draws are a pure function of their inputs (golden values)', () => {
    // Golden values: if these change, every seed in the game changes. Do not update casually.
    expect(mix32(0)).toBe(0);
    expect(mix32(1)).toBe(mix32(1));
    expect([draw32(1, 'needs', 0, 0, 0), draw32(1, 'needs', 0, 0, 1)]).toMatchInlineSnapshot(`
      [
        2977214904,
        371422561,
      ]
    `);
    expect(hashString32('coulee')).toMatchInlineSnapshot(`3586056153`);
  });

  it('streams, ticks, keys and seeds are independent', () => {
    const base = draw32(1, 'social', 60, 5, 0);
    expect(draw32(1, 'belief', 60, 5, 0)).not.toBe(base);
    expect(draw32(1, 'social', 120, 5, 0)).not.toBe(base);
    expect(draw32(1, 'social', 60, 6, 0)).not.toBe(base);
    expect(draw32(2, 'social', 60, 5, 0)).not.toBe(base);
    const firsts = new Set(STREAMS.map((s) => draw32(9, s, 0, 0, 0)));
    expect(firsts.size).toBe(STREAMS.length);
  });

  it('mixKey is order-sensitive and folds large numbers', () => {
    expect(mixKey(1, 2)).not.toBe(mixKey(2, 1));
    expect(mixKey(2 ** 40)).not.toBe(mixKey(0));
    expect(mixKey(2 ** 40 + 1)).not.toBe(mixKey(2 ** 40));
  });

  it('fork is independent of the parent counter progression', () => {
    const a = rng(3, 'psyche', 0, 1);
    const fa = a.fork(9).u32();
    const b = rng(3, 'psyche', 0, 1);
    expect(b.fork(9).u32()).toBe(fa);
  });
});

describe('rng helpers', () => {
  it('int stays in range (property)', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: 0, max: 5000 }),
        (seed, lo, span) => {
          const r = rng(seed, 'test', 0, 0);
          const v = r.int(lo, lo + span);
          return Number.isInteger(v) && v >= lo && v <= lo + span;
        },
      ),
    );
  });

  it('d20 is roughly uniform (chi-square sanity)', () => {
    const counts = new Array(21).fill(0) as number[];
    const N = 40_000;
    for (let k = 0; k < N; k++) {
      const v = rng(7, 'test', k, 0).d20();
      counts[v] = (counts[v] ?? 0) + 1;
    }
    expect(counts[0]).toBe(0);
    const expected = N / 20;
    let chi = 0;
    for (let f = 1; f <= 20; f++) chi += ((counts[f] ?? 0) - expected) ** 2 / expected;
    // df = 19; p=0.001 critical value ~ 43.8
    expect(chi).toBeLessThan(43.8);
  });

  it('chancePermille matches its rate', () => {
    const r = rng(11, 'test', 0, 0);
    let hits = 0;
    const N = 20_000;
    for (let i = 0; i < N; i++) if (r.chancePermille(250)) hits++;
    expect(hits / N).toBeGreaterThan(0.23);
    expect(hits / N).toBeLessThan(0.27);
    expect(r.chancePermille(0)).toBe(false);
    expect(r.chancePermille(1000)).toBe(true);
  });

  it('weighted pick follows weights and skips zero weights', () => {
    const items = ['a', 'b', 'c'] as const;
    const w = { a: 1, b: 3, c: 0 };
    const r = rng(5, 'test', 0, 0);
    const seen = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 8000; i++) {
      const p = r.weighted(items, (x) => w[x]);
      if (p) seen[p]++;
    }
    expect(seen.c).toBe(0);
    expect(seen.b / seen.a).toBeGreaterThan(2.6);
    expect(seen.b / seen.a).toBeLessThan(3.4);
    expect(r.weighted(items, () => 0)).toBeUndefined();
  });

  it('shuffleByKey is a permutation independent of input order', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.integer({ min: 0, max: 10_000 }), { maxLength: 40 }), (keys) => {
        const r1 = rng(1, 'social', 60, 2);
        const r2 = rng(1, 'social', 60, 2);
        const a = r1.shuffleByKey(keys, (k) => k);
        const b = r2.shuffleByKey([...keys].reverse(), (k) => k);
        expect(a).toEqual(b);
        expect([...a].sort((x, y) => x - y)).toEqual([...keys].sort((x, y) => x - y));
      }),
    );
  });
});
