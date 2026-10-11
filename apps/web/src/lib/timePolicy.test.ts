import { describe, expect, it } from 'vitest';
import { SPEEDS } from '../protocol.ts';
import { effectiveSpeed } from './timePolicy.ts';

describe('time controls', () => {
  it('uses a finite increasing ladder including 2× and 3×', () => {
    expect(Object.values(SPEEDS)).toEqual([0, 1 / 40, 2 / 40, 3 / 40, 2]);
  });
  it('pauses hidden windows and full pocket sheets, clamps half sheets, preserves desktop speed', () => {
    const policy = { chosen: 'ultra' as const, sheet: 'half' as const, pinned: false, hidden: false, desk: false };
    expect(effectiveSpeed(policy)).toBe('x1');
    expect(effectiveSpeed({ ...policy, sheet: 'peek' })).toBe('ultra');
    expect(effectiveSpeed({ ...policy, sheet: 'full' })).toBe('paused');
    expect(effectiveSpeed({ ...policy, sheet: 'full', pinned: true })).toBe('ultra');
    expect(effectiveSpeed({ ...policy, desk: true })).toBe('ultra');
    expect(effectiveSpeed({ ...policy, hidden: true, desk: true })).toBe('paused');
    expect(effectiveSpeed({ ...policy, chosen: 'paused', desk: true })).toBe('paused');
  });
});
