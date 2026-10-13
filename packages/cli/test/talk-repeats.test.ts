/** Thirty-day listener repeats in both authored and generated populations (wave 6 target). */
import type { Event } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { runScenario } from '../src/harness.ts';
import { baseContent } from './helpers.ts';

describe('30-day listener repetition budget', () => {
  it.each([
    { scenarioId: 'iron_ford', seed: 42 },
    { scenarioId: 'gen:town', seed: 7 },
  ])(
    '$scenarioId seed $seed stays below 15% repeated exchanges',
    (spec) => {
      const seen = new Map<number, Map<string, number>>();
      let exchanges = 0;
      let repeated = 0;
      const sink = (e: Event) => {
        if (e.kind !== 'social.interaction' && e.kind !== 'belief.transmitted') return;
        const d = e.data;
        if (!d.lines?.length) return;
        const parties =
          e.kind === 'social.interaction'
            ? [e.data.initiatorId, e.data.targetId]
            : [e.data.speakerId, e.data.listenerId];
        let again = false;
        for (const turn of d.lines) {
          const listener = parties.find((id) => id !== turn.speakerId);
          if (listener === undefined) throw new Error('missing listener');
          const heard = seen.get(listener) ?? new Map<string, number>();
          const at = heard.get(turn.text);
          if (at !== undefined && e.t - at < 30 * 1440) again = true;
          heard.set(turn.text, e.t);
          seen.set(listener, heard);
        }
        exchanges++;
        repeated += Number(again);
      };
      runScenario(baseContent(), { ...spec, hours: 30 * 24 }, { sink });
      expect(exchanges).toBeGreaterThan(3000);
      expect(repeated / exchanges).toBeLessThanOrEqual(0.15);
    },
    120_000,
  );
});
