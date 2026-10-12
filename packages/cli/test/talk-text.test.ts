/**
 * Talk content (wave 5 group D; playtest r2: the wolf story came 8+ times from six speakers, fish
 * and the Queen of England 4+, "a roof that doesn't leak" from two couples, the same refusal to
 * every rumor). Stories belong to their tellers; the pools that repeated are at least doubled; and
 * a fortnight of Iron Ford does not say one line over and over.
 */
import { crossCheck } from '@coulee/content/schema';
import { createSim, runHours } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { collectingSink } from '../src/harness.ts';
import { baseContent } from './helpers.ts';

const content = baseContent();
const lines = Object.values(content.talk_lines);

/** Pool sizes at wave 4 (talk.toml before wave 5), by interaction; wave 5 must at least double them. */
const WAVE4: Record<string, number> = {
  chat: 80,
  tell_tale: 8,
  help: 17,
  pray_with: 12,
  deep_talk: 10,
  comfort: 7,
  compliment: 8,
  introduce: 10,
  gossip: 17,
  ask_about: 16,
  warn: 10,
  preach_at: 5,
};

describe('talk pools', () => {
  it.each(Object.entries(WAVE4))('%s has at least twice its wave-4 pool', (interaction, before) => {
    const n = lines.filter((l) => l.on.includes(interaction)).length;
    expect(n).toBeGreaterThanOrEqual(before * 2);
  });

  it('gives the hearer of a rumor several ways to answer each situation, not one', () => {
    const said = lines.filter((l) => l.part === 'said' && l.on.includes('gossip'));
    for (const heard of ['credits', 'doubts', 'already'] as const) {
      const n = said.filter((l) => l.when.heard === heard && l.when.about === 'other').length;
      expect(n, `heard = ${heard}`).toBeGreaterThanOrEqual(6);
    }
    expect(said.filter((l) => l.when.about === 'you').length).toBeGreaterThanOrEqual(5);
    // The flat refusal is one reply among many now.
    const flat = lines.filter((l) => l.lines.some((t) => /more than talk before I'd credit/.test(t.text)));
    expect(flat.length).toBe(1);
  });

  it('every story is told by someone in particular or by a trade, and its ribs are aimed at the teller', () => {
    const tales = lines.filter((l) => l.on.includes('tell_tale') && l.part === 'act');
    const owned = tales.filter((l) => l.when.initiator?.actor || l.when.initiator?.occupation);
    expect(owned.length).toBeGreaterThanOrEqual(60);
    // The stories that repeated in r2 are tied to one person now.
    const tied = (marker: RegExp) =>
      tales
        .filter((l) => l.lines.some((t) => marker.test(t.text)))
        .every((l) => (l.when.initiator?.actor ?? []).length === 1);
    expect(tied(/wolves all round/)).toBe(true);
    expect(tied(/longer than the (boat)/)).toBe(true);
    expect(tied(/raft of pine down to Galena/)).toBe(true);
    expect(tied(/panther on the Kickapoo/)).toBe(true);
    const ribs = lines.filter((l) => l.on.includes('chat') && l.when.target?.actor);
    expect(ribs.length).toBeGreaterThanOrEqual(5);
  });

  it('rejects a talk line that names a teller who is not in any scenario', () => {
    const bad = structuredClone(content);
    const first = Object.values(bad.talk_lines)[0];
    if (!first) throw new Error('no talk lines');
    first.when = { ...first.when, initiator: { actor: ['nobody_at_all'] } };
    const issues = crossCheck(bad).filter((i) => i.message.includes('nobody_at_all'));
    expect(issues.length).toBe(1);
  });
});

describe('a fortnight of Iron Ford (seed 42)', () => {
  const sim = createSim(content, { scenarioId: 'iron_ford', seed: 42 });
  const { sink, events } = collectingSink();
  sim.sink = sink;
  runHours(sim, 10 * 24);

  type Turn = { speakerId: number; text: string };
  const exchanges = events.flatMap((e) => {
    const d = (e as unknown as { data?: Record<string, unknown> }).data;
    const ls = d?.lines as Turn[] | undefined;
    return ls?.length ? [{ kind: e.kind, d: d as Record<string, unknown>, lines: ls }] : [];
  });

  it('tells each owned story only in its teller’s mouth', () => {
    const idOf = (key: string) => sim.world.index.actorByKey[key];
    const owner = new Map<string, number[]>();
    for (const l of lines) {
      const keys = l.when.initiator?.actor;
      const first = l.lines[0]?.text ?? '';
      if (!keys || !l.on.includes('tell_tale') || /[{#]/.test(first)) continue;
      owner.set(first, [...(owner.get(first) ?? []), ...keys.map((k) => idOf(k) as number)]);
    }
    let told = 0;
    for (const x of exchanges) {
      if (x.d.interactionId !== 'tell_tale') continue;
      const mine = owner.get(x.lines[0]?.text ?? '');
      if (!mine) continue;
      told += 1;
      expect(mine, x.lines[0]?.text).toContain(x.d.initiatorId as number);
    }
    expect(told).toBeGreaterThan(0);
  });

  it('does not say any one line more than a few times in ten days', () => {
    const uses = new Map<string, number>();
    for (const x of exchanges) for (const t of x.lines) uses.set(t.text, (uses.get(t.text) ?? 0) + 1);
    const worst = [...uses.entries()].sort((a, b) => b[1] - a[1])[0];
    // Wave 4 said its commonest line 83 times in 14 days.
    expect(worst?.[1], worst?.[0]).toBeLessThanOrEqual(40);
  });

  it('rarely makes someone hear a line they have already heard', () => {
    const seen = new Map<number, Set<string>>();
    let heard = 0;
    let again = 0;
    for (const x of exchanges) {
      const parties = [x.d.initiatorId, x.d.targetId, x.d.speakerId, x.d.listenerId].filter(
        (v): v is number => typeof v === 'number',
      );
      for (const t of x.lines)
        for (const a of new Set(parties)) {
          const s = seen.get(a) ?? new Set<string>();
          heard += 1;
          if (s.has(t.text)) again += 1;
          s.add(t.text);
          seen.set(a, s);
        }
    }
    // Wave 4: about half of all lines a person heard were ones they had heard before.
    expect(again / heard).toBeLessThan(0.3);
  });
});
