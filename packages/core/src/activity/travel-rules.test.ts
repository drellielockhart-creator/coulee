import { describe, expect, it } from 'vitest';
import { type JourneyLeg, travelInterval } from './travel-rules.ts';

const leg: JourneyLeg = { edgeId: 'ridge', direction: 'ab', from: 'a', to: 'b', distanceFt: 100003, costMinutes: 333 };
describe('integer road intervals', () => {
  it('carries sub-foot fractions instead of losing them every hour', () => {
    let p = { segment: 0, feet: 0, remainder: 0 };
    for (let hour = 1; hour <= 4; hour++) {
      p = travelInterval([leg], p, 95);
      expect(p.feet).toBe(Math.floor((leg.distanceFt * 95 * 60 * hour) / (333 * 100)));
      expect(p.remainder).toBe((leg.distanceFt * 95 * 60 * hour) % (333 * 100));
    }
  });
  it('crosses junctions within the same hour and charges the final remainder as waiting', () => {
    const p = travelInterval(
      [
        { ...leg, costMinutes: 20 },
        { ...leg, costMinutes: 15 },
      ],
      { segment: 0, feet: 0, remainder: 0 },
      100,
    );
    expect(p.arrived).toBe(true);
    expect(p.movingMinutes).toBe(35);
    expect(p.waitingMinutes).toBe(25);
  });
  it('does not advance a stopped or overloaded actor', () => {
    const p = travelInterval([leg], { segment: 0, feet: 100, remainder: 12 }, 0);
    expect(p.feet).toBe(100);
    expect(p.remainder).toBe(12);
    expect(p.movingMinutes).toBe(0);
  });
});
