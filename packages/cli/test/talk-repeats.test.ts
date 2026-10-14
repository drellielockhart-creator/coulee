/** Thirty-day listener repeats in both authored and generated populations (wave 6 target). */
import { type Event, social } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { runScenario } from '../src/harness.ts';
import { baseContent } from './helpers.ts';

describe('30-day listener repetition budget', () => {
  it.each([
    { scenarioId: 'iron_ford', seed: 42 },
    { scenarioId: 'gen:town', seed: 7 },
  ])(
    '$scenarioId seed $seed stays below 17% repeated exchanges (noise guard)',
    (spec) => {
      const seen = new Map<number, Map<string, number>>();
      let exchanges = 0;
      let repeated = 0;
      const content = baseContent();
      const sink = (e: Event) => {
        if (e.kind !== 'social.interaction' && e.kind !== 'belief.transmitted') return;
        // An act's words are stored by reference: render them as a listener hears them.
        const d = social.talkWords(content, e.data);
        if (!d?.lines.length) return;
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
      runScenario(content, { ...spec, hours: 30 * 24 }, { sink });
      expect(exchanges).toBeGreaterThan(3000);
      // A per-seed noise guard, not the target: one seed's rate moves with any change to the run
      // (13.6–16.3% on Iron Ford seeds 42–45 in every wave-13 build). The wave-6 15% target is
      // tracked as a mean over seeds in the perf/balance reports.
      expect(repeated / exchanges).toBeLessThanOrEqual(0.17);
    },
    120_000,
  );
});
