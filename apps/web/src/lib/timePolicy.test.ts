import { describe, expect, it } from 'vitest';
import { SPEEDS } from '../protocol.ts';
import { clockGlyph, displayMinute, effectiveSpeed, secondsToNextHour } from './timePolicy.ts';
import { layoutFor } from './useLayout.ts';

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
  it('shows minutes passing and when the next order lands (display only)', () => {
    expect(displayMinute(0, 0.5)).toBe(30);
    expect(displayMinute(0, 0.9999)).toBe(59);
    expect(secondsToNextHour('x1', 0.375)).toBe(25);
    expect(secondsToNextHour('paused', 0.375)).toBeNull();
    expect(clockGlyph('paused', 'paused', true)).toBe('❚❚!');
  });
  it('sends a phone on its side to Folio, where panels sit beside the map (11 §3.4, §4.2)', () => {
    expect(layoutFor(390, 844)).toBe('pocket');
    expect(layoutFor(360, 780)).toBe('pocket');
    expect(layoutFor(844, 390)).toBe('folio');
    expect(layoutFor(768, 1024)).toBe('folio');
    expect(layoutFor(1440, 900)).toBe('desk');
    expect(layoutFor(1280, 480)).toBe('folio');
  });
});
