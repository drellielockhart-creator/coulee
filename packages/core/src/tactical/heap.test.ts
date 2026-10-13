import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { instantOf, setInstant, TICKS_PER_HOUR } from '../sim/clock.ts';
import { compareEntries, heapPop, heapPush, type TimedEntry } from '../sim/heap.ts';
import type { World } from '../world.ts';

describe('sparse clock properties', () => {
  it('totally orders same-tenth ties independent of insertion order', () =>
    fc.assert(
      fc.property(
        fc.array(fc.record({ instant: fc.integer({ min: 0, max: 5 }), actorId: fc.integer({ min: 1, max: 5 }) }), {
          maxLength: 200,
        }),
        (rows) => {
          const entries = rows.map((r, seq) => ({ ...r, seq }));
          const heap: TimedEntry[] = [];
          for (const e of [...entries].reverse()) heapPush(heap, e);
          const out = [];
          while (heap.length) out.push(heapPop(heap));
          expect(out).toEqual([...entries].sort(compareEntries));
        },
      ),
    ));
  it('round trips minute/hour/midnight and large instants without bitwise truncation', () =>
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000000000 }), (instant) => {
        const w = { time: 0 } as World;
        setInstant(w, instant);
        expect(instantOf(w)).toBe(instant);
        expect(w.tenth).toBeGreaterThanOrEqual(0);
        expect(w.tenth).toBeLessThan(600);
        const end = (Math.floor(instant / TICKS_PER_HOUR) + 1) * TICKS_PER_HOUR;
        expect(end - instant).toBeGreaterThan(0);
      }),
    ));
});
