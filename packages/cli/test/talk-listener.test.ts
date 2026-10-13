/** Listener memory uses spoken text across tellers, survives saves, and expires at 30 days. */
import { createSim, findNonIntegers, packJson, restoreSim } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import type { ContentBundle } from '../../core/src/content.ts';
import { hashString32 } from '../../core/src/rng.ts';
import { makeContext } from '../../core/src/sim/sim.ts';
import { composeExchange, pruneTalk } from '../../core/src/social/talk.ts';
import { asGameMinute } from '../../core/src/time.ts';
import { baseContent } from './helpers.ts';

type Line = ContentBundle['talk_lines'][string];
function line(id: string, text: string, over: Partial<Line> = {}): Line {
  return {
    id,
    on: ['chat'],
    on_tags: [],
    part: 'act',
    outcome: 'any',
    when: {},
    weight: 10,
    lines: [{ by: 'initiator', text }],
    ...over,
  };
}
function fixture(lines: Line[]) {
  const content = { ...baseContent(), talk_lines: Object.fromEntries(lines.map((l) => [l.id, l])) };
  const sim = createSim(content, { scenarioId: 'iron_ford', seed: 42 });
  const ids = ['amos_whitcomb', 'gussie_pratt', 'lemuel_hatch'].map((key) => {
    const id = sim.world.index.actorByKey[key];
    if (id === undefined) throw new Error(`missing ${key}`);
    return id;
  });
  const [i, t, other] = ids;
  if (i === undefined || t === undefined || other === undefined) throw new Error('missing actor');
  const say = (speaker = i, listener = t) => {
    const def = content.interactions.chat;
    if (!def) throw new Error('missing chat');
    return composeExchange(sim.world, makeContext(sim.world, content, []), {
      def,
      initiatorId: speaker,
      targetId: listener,
      placeId: null,
      success: true,
      part: 'act',
    });
  };
  return { sim, content, i, t, other, say };
}
const hash = (text: string) => String(hashString32(text));

describe('listener text memory', () => {
  it('avoids duplicate text under another id or from another teller, even if fresh cooldowns favor it', () => {
    const f = fixture([
      line('same', 'The bridge is muddy.'),
      line('duplicate', 'The bridge is muddy.'),
      line('fresh', 'The hens got out.'),
    ]);
    f.sim.world.social.talk = {
      [`h${f.t}`]: { [hash('The bridge is muddy.')]: 0 },
      [`s${f.other}`]: { fresh: 0 },
    };
    expect(f.say(f.other)?.lines[0]?.text).toBe('The hens got out.');
    expect(f.sim.world.social.talk[`h${f.t}`]?.[hash('The hens got out.')]).toBe(0);
  });

  it('records listening, not the speaker’s own words', () => {
    const f = fixture([line('only', 'The bridge is muddy.')]);
    f.say();
    expect(f.sim.world.social.talk?.[`h${f.t}`]?.[hash('The bridge is muddy.')]).toBe(0);
    expect(f.sim.world.social.talk?.[`h${f.i}`]).toBeUndefined();
  });

  it('checks replies too, across templates with different opening lines', () => {
    const f = fixture([
      line('stale_reply', 'The bridge is muddy.', {
        lines: [
          { by: 'initiator', text: 'The bridge is muddy.' },
          { by: 'target', text: 'So it is.' },
        ],
      }),
      line('fresh_reply', 'The hens got out.', {
        lines: [
          { by: 'initiator', text: 'The hens got out.' },
          { by: 'target', text: 'I will fetch them.' },
        ],
      }),
    ]);
    f.sim.world.social.talk = { [`h${f.i}`]: { [hash('So it is.')]: 0 } };
    expect(f.say()?.ids).toEqual(['fresh_reply']);
  });

  it('tries suitable general lines when the child’s small pool is exhausted', () => {
    const f = fixture([
      line('child', 'Mind the step.', { when: { target_child: true } }),
      line('general', 'The hens got out.'),
    ]);
    const child = f.sim.world.actors[f.t];
    if (!child) throw new Error('missing child');
    child.born = asGameMinute(-10 * 365 * 1440);
    f.sim.world.social.talk = { [`h${f.t}`]: { [hash('Mind the step.')]: 0 } };
    expect(f.say()?.ids).toEqual(['general']);
  });

  it('uses the least recently heard fallback and only then permits repeat-aware replies', () => {
    const f = fixture([
      line('old', 'The bridge is muddy.'),
      line('new', 'The hens got out.'),
      line('response', 'I have heard that before.', {
        tags: ['repeat_aware'],
        lines: [{ by: 'target', text: 'I have heard that before.' }],
      }),
    ]);
    f.sim.world.time = asGameMinute(1440);
    f.sim.world.social.talk = { [`h${f.t}`]: { [hash('The bridge is muddy.')]: 0, [hash('The hens got out.')]: 60 } };
    expect(f.say()?.ids).toEqual(['old', 'response']);
    const fresh = fixture([
      line('old', 'The bridge is muddy.'),
      line('response', 'I have heard that before.', {
        tags: ['repeat_aware'],
        lines: [{ by: 'target', text: 'I have heard that before.' }],
      }),
    ]);
    expect(fresh.say()?.ids).toEqual(['old']);
  });

  it('retains hashes before the window boundary and drops them exactly at it', () => {
    const f = fixture([line('only', 'The bridge is muddy.')]);
    f.say();
    pruneTalk(f.sim.world, 30 * 1440 - 1);
    expect(f.sim.world.social.talk?.[`h${f.t}`]?.[hash('The bridge is muddy.')]).toBe(0);
    pruneTalk(f.sim.world, 30 * 1440);
    expect(f.sim.world.social.talk?.[`h${f.t}`]).toBeUndefined();
  });

  it('answers a repeated target turn after it, in the initiator’s mouth', () => {
    const f = fixture([
      line('only', 'The bridge is muddy.', {
        lines: [
          { by: 'initiator', text: 'The bridge is muddy.' },
          { by: 'target', text: 'So it is.' },
        ],
      }),
      line('response', 'I have heard that before.', {
        tags: ['repeat_aware'],
        lines: [{ by: 'target', text: 'I have heard that before.' }],
      }),
    ]);
    f.sim.world.social.talk = { [`h${f.i}`]: { [hash('So it is.')]: 0 } };
    expect(f.say()?.lines.map((turn) => [turn.speakerId, turn.text])).toEqual([
      [f.i, 'The bridge is muddy.'],
      [f.t, 'So it is.'],
      [f.i, 'I have heard that before.'],
    ]);
  });

  it('bounds pathological active histories without retaining strings or fractional state', () => {
    const f = fixture([line('only', 'The bridge is muddy.')]);
    f.sim.world.time = asGameMinute(2000);
    f.sim.world.social.talk = {
      [`h${f.t}`]: Object.fromEntries(Array.from({ length: 1024 }, (_, n) => [String(n), n])),
    };
    f.say();
    const rec = f.sim.world.social.talk[`h${f.t}`];
    expect(Object.keys(rec ?? {})).toHaveLength(1024);
    expect(rec?.['0']).toBeUndefined();
    expect(findNonIntegers(f.sim.world)).toEqual([]);
  });

  it('makes identical choices after a packed save reload; legacy absent memory initializes lazily', () => {
    const f = fixture([line('a', 'The bridge is muddy.'), line('b', 'The hens got out.')]);
    expect(f.sim.world.social.talk).toBeUndefined();
    f.say();
    const restored = restoreSim(f.content, JSON.parse(JSON.stringify(packJson(f.sim.world))));
    const def = f.content.interactions.chat;
    if (!def) throw new Error('missing chat');
    const req = {
      def,
      initiatorId: f.i,
      targetId: f.t,
      placeId: null,
      success: true,
      part: 'act' as const,
    };
    const a = composeExchange(f.sim.world, makeContext(f.sim.world, f.content, []), req);
    const b = composeExchange(restored.world, makeContext(restored.world, f.content, []), req);
    expect(b).toEqual(a);
    expect(restored.world.social.talk).toEqual(f.sim.world.social.talk);
  });
});
