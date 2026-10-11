import { describe, expect, it } from 'vitest';
import { MotionTracker } from './motion.ts';
import type { PlaceLike } from './terrain.ts';

const places: PlaceLike[] = [
  { id: 1, x: 0, y: 0, w: 3, h: 3, kind: 'outdoor', tags: [] },
  { id: 2, x: 40, y: 0, w: 3, h: 3, kind: 'outdoor', tags: [] },
];
const at = (placeId: number) => [{ id: 1, placeId, travelingTo: null, arriveAt: null, since: 0 }];
const clock = (nowMs: number, msPerGameMinute = 667) => ({ nowMs, msPerGameMinute, tileM: 3, t: 60 });

describe('snapshot interpolation', () => {
  it('preserves a walk across view-only snapshots and stops at the world destination', () => {
    const motion = new MotionTracker();
    motion.update(at(1), places, clock(0));
    motion.update(at(2), places, clock(10));
    const during = motion.sample(1, 300);
    expect(during?.walking).toBe(true);
    expect(motion.update(at(2), places, clock(300))).toBe(false);
    expect(motion.sample(1, 300)).toEqual(during);
    expect(motion.sample(1, 10_000)?.p).toEqual({ x: 41.5, y: 1.5 });
    expect(motion.sample(1, 10_000)?.walking).toBe(false);
  });
  it('cuts directly to the same destination when reduced motion is requested', () => {
    const motion = new MotionTracker();
    motion.update(at(1), places, clock(0, 0));
    motion.update(at(2), places, clock(10, 0));
    expect(motion.sample(1, 10)?.p).toEqual({ x: 41.5, y: 1.5 });
    expect(motion.sample(1, 10)?.walking).toBe(false);
  });
});
