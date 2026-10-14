/**
 * Lazy talk (perf wave 13): an act's words are chosen without being built and rendered only when
 * read. Rendering a stored reference later, from content alone, gives exactly the words an eager
 * composition gave at the moment of speaking, whatever has changed in the world since.
 */
import { type ActorId, createSim, makeContext, packJson, restoreSim, runHours, social } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import type { TalkFacts } from '../../core/src/social/talk.ts';
import { baseContent } from './helpers.ts';

describe('talk rendered on demand', () => {
  it('renders a sample of exchanges later exactly as eager composition said them', () => {
    const content = baseContent();
    const live = createSim(content, { scenarioId: 'iron_ford', seed: 42 });
    runHours(live, 3 * 24 + 15);
    const clone = () => restoreSim(content, JSON.parse(JSON.stringify(packJson(live.world))));
    const eager = clone();
    const lazy = clone();
    const people = Object.values(live.world.actors)
      .filter((a) => a.alive)
      .map((a) => a.id as ActorId)
      .sort((a, b) => a - b);
    const asks: Array<{ id: string; part: 'act' | 'said'; facts?: TalkFacts }> = [
      { id: 'chat', part: 'act' },
      { id: 'help', part: 'act' },
      { id: 'compliment', part: 'act' },
      { id: 'comfort', part: 'act' },
      { id: 'introduce', part: 'act' },
      { id: 'gift', part: 'act', facts: { slots: { gift: 'a loaf of bread' } } },
      {
        id: 'repay',
        part: 'act',
        facts: { slots: { cents: '$1.20', remaining: '$0.30', settlement: '$0.30 still owed.' } },
      },
      { id: 'gossip', part: 'act', facts: { told: false, stale: true } },
      {
        id: 'gossip',
        part: 'said',
        facts: {
          told: true,
          rumor: 'scandal',
          heard: 'credits',
          secondhand: true,
          about: 'other',
          slots: { rumor: 'the miller waters his flour', hedge: '#hedge_sure#', source: 'Mrs. Fenn', subject: '' },
        },
      },
    ];
    const refs: Array<{ talk: social.TalkRef; said: { line: string; lines: social.TalkTurn[] } }> = [];
    let n = 0;
    for (let round = 0; round < 6; round++) {
      for (const ask of asks) {
        const def = content.interactions[ask.id];
        if (!def) throw new Error(`missing ${ask.id}`);
        const i = people[(n * 7 + round) % people.length] as ActorId;
        const t = people[(n * 13 + 5) % people.length] as ActorId;
        n++;
        if (i === t) continue;
        const req = {
          def,
          initiatorId: i,
          targetId: t,
          placeId: live.world.actors[i]?.placeId ?? null,
          success: true,
          part: ask.part,
          ...(ask.facts ? { facts: ask.facts } : {}),
        };
        const said = social.composeExchange(eager.world, makeContext(eager.world, content, []), req);
        const chosen = social.chooseExchange(lazy.world, makeContext(lazy.world, content, []), req);
        expect(chosen?.ids).toEqual(said?.ids);
        if (!said || !chosen) continue;
        refs.push({ talk: JSON.parse(JSON.stringify(chosen.talk)), said: { line: said.line, lines: said.lines } });
      }
    }
    // Choosing is the same decision either way: the same dialogue memory, integer and JSON-able.
    expect(lazy.world.social.talk).toEqual(eager.world.social.talk);
    expect(refs.length).toBeGreaterThan(40);
    // A rumor's words, idiom slots and replies are all covered by the sample.
    expect(refs.some((r) => r.talk.scopes.some((s) => s.facts?.rumor))).toBe(true);
    expect(refs.some((r) => r.talk.turns.length > 1)).toBe(true);
    // Days later (names, opinions, prices and weather moved on), the words are unchanged.
    runHours(lazy, 4 * 24);
    for (const r of refs) expect(social.renderTalk(content, r.talk)).toEqual(r.said);
  });

  it('views render the act’s words from the event (the play feed)', () => {
    const content = baseContent();
    const sim = createSim(content, { scenarioId: 'iron_ford', seed: 42, logRetention: null });
    runHours(sim, 2 * 24);
    const acts = sim.world.log.events.filter((e) => e.kind === 'social.interaction' && e.data.talk);
    expect(acts.length).toBeGreaterThan(50);
    for (const e of acts) {
      if (e.kind !== 'social.interaction') continue;
      expect(e.data.lines).toBeUndefined();
      const words = social.talkWords(content, e.data);
      expect(words?.lines.length ?? 0).toBeGreaterThan(0);
      for (const l of words?.lines ?? []) {
        expect(l.text).not.toMatch(/[{}#]|undefined|NaN/);
        expect([e.data.initiatorId, e.data.targetId]).toContain(l.speakerId);
      }
    }
  });
});
