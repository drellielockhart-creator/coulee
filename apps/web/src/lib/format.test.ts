import { describe, expect, it } from 'vitest';
import { arbitrationSummary, psycheBand, tieWords, weight } from './format.ts';

describe('display formatting', () => {
  it('prints weights in pounds and ounces, never kilograms (03 §3.1)', () => {
    expect(weight(590)).toBe('1.3 lb');
    expect(weight(450)).toBe('16 oz');
    expect(weight(85)).toBe('3 oz');
    expect(weight(27_216)).toBe('60 lb');
  });
  it('gives every psyche number a band word on screen (11 §1.5 rung 2)', () => {
    expect(psycheBand('ego', 45)).toBe('steady');
    expect(psycheBand('superego', 40)).toBe('ordinary');
    expect(psycheBand('id', 60)).toBe('keen');
    expect(psycheBand('anxiety', 69)).toBe('calm');
    expect(psycheBand('anxiety', 1000)).toBe('at breaking');
    expect(psycheBand('ego', 100)).toBe('iron');
  });
  it('reads a tie as a phrase about the dossier owner', () => {
    expect(tieWords('child of')).toEqual({ before: 'child of ', after: '' });
    expect(tieWords('courting')).toEqual({ before: 'courting ', after: '' });
    expect(tieWords('friend')).toEqual({ before: '', after: ' · friend' });
  });
  it('sums up an arbitration in plain words', () => {
    const e = {
      label: 'Sleep',
      total: 483,
      children: [
        {
          label: 'Sleep',
          total: 483,
          outcome: 'chosen',
          note: '+267 It is late; the day starts early; R +100 The hour for it; R +154 The dead of night: bed',
        },
        { label: 'Fetch water', total: 45, outcome: 'rejected', note: '+126 Parched' },
      ],
    };
    expect(arbitrationSummary(e)).toBe(
      'Sleep won over fetch water by 438. Mostly: It is late; the day starts early (+267).',
    );
    expect(arbitrationSummary({ label: 'Attend church', total: 10 })).toBe(
      'Attend church was the only course considered.',
    );
  });
});
