import {
  asGameMinute,
  type Command,
  chronicle,
  eventsSince,
  findNonIntegers,
  items,
  makeContext,
  provisions,
  social,
} from '@coulee/core';
import { claimsOf, knownExplain, obligationsOf, sessionSim } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { pruneTalk } from '../../core/src/social/talk.ts';
import { baseContent } from './helpers.ts';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing fixture');
  return value;
}
function scene() {
  const c = baseContent();
  const sim = sessionSim(c, { source: 'iron_ford', seed: 42 });
  const w = sim.world;
  const pc = required(w.meta.playerId);
  const target = required(w.index.actorByKey.joel_pike);
  w.time = asGameMinute(2040);
  required(w.actors[target]).placeId = required(w.actors[pc]).placeId;
  for (const id of [pc, target])
    Object.assign(required(w.activity.byActor[id]), { activityId: 'idle_at_home', travel: null, lockedUntil: null });
  for (let n = 0; n < 4; n++) social.bumpFamiliarity(w, c, pc, target);
  return { c, sim, w, pc, target };
}
function act(s: ReturnType<typeof scene>, id: string) {
  const command: Command = {
    kind: 'core.urge',
    actorId: s.pc,
    issuer: { kind: 'player' },
    data: { urge: { kind: 'interaction', interactionId: id, targetId: s.target } },
  };
  const last = s.w.log.lastId;
  const result = social.resolveInteraction(s.w, makeContext(s.w, s.c, [command]), {
    def: required(s.c.interactions[id]),
    initiatorId: s.pc,
    targetId: s.target,
    placeId: required(s.w.actors[s.pc]).placeId,
    present: [],
    mode: 'urge',
    via: 'urge',
  });
  const events = eventsSince(s.w.log, last);
  const event = required(events.find((e) => e.kind === 'social.interaction'));
  if (event.kind !== 'social.interaction') throw new Error('Wrong event');
  return { result, event, events };
}
function debt(s: ReturnType<typeof scene>, cents: number) {
  social.extendCredit(s.w, makeContext(s.w, s.c, []), s.target, s.pc, cents);
  required(s.w.social.relationships.find((r) => r.kind === 'creditor' && r.a === s.target && r.b === s.pc)).since =
    asGameMinute(0);
}
function purse(s: ReturnType<typeof scene>, cents: number) {
  s.w.provisions.purses[s.pc] = cents;
  required(s.w.provisions.households[required(s.w.actors[s.pc]).householdId]).cashCents = 0;
}

describe('wave 5 social review regressions', () => {
  it('keeps private courtship regard in a target-only Explain child', () => {
    const s = scene();
    // Exercise both the attitude DC and the minimum-regard gate.
    required(s.w.social.opinions[s.target]?.[s.pc]).volatile = { affection: -25, trust: -30, respect: 0, fear: 0 };
    const { event } = act(s, 'court');
    expect(event.data.success).toBe(false);
    const fair = required(knownExplain(event.explain, s.pc, 'fair'));
    expect(fair.note).toContain('no encouragement');
    expect(JSON.stringify(fair)).not.toMatch(/Affection|Trust|Minimum regard|below 15/);
    expect(fair.dc).toBeUndefined();
    for (const explain of [knownExplain(event.explain, s.target, 'fair'), knownExplain(event.explain, s.pc, 'god')]) {
      expect(JSON.stringify(explain)).toContain('Affection');
      expect(JSON.stringify(explain)).toContain('below 15');
    }
  });

  it.each([0, 40, 100])('repays actual cash (%i cents), with truthful dialogue, memories and rewards', (cash) => {
    const s = scene();
    debt(s, 100);
    purse(s, cash);
    const before = s.w.provisions.purses[s.target] ?? 0;
    const { result, event, events } = act(s, 'repay');
    expect(result.success).toBe(cash === 100);
    // Exercise the consumer too: a partial payment must not close the chronicle's debt story.
    expect(event.data.success).toBe(cash === 100);
    chronicle.chronicleSystem(s.w, makeContext(s.w, s.c, []));
    const closed = s.w.chronicle.threads.some((thread) =>
      thread.facts.some((fact) => fact.k === 'repay' && fact.a === s.target && fact.b === s.pc),
    );
    expect(closed).toBe(cash === 100);
    expect(social.debtOf(s.w, s.target, s.pc).cents).toBe(100 - cash);
    expect(s.w.provisions.purses[s.target]).toBe(before + cash);
    expect(events.filter((e) => e.kind === 'provisions.cash_transfer')).toHaveLength(cash ? 1 : 0);
    const text = social.talkWords(s.c, event.data)?.line ?? '';
    expect(text).toContain(cash === 100 ? "We're square" : `$${((100 - cash) / 100).toFixed(2)}`);
    if (cash > 0) expect(text).toContain(`$${(cash / 100).toFixed(2)}`);
    const rewarded = social.reasonsOf(s.w, s.target, s.pc).some((r) => r.delta.trust > 0);
    expect(rewarded).toBe(cash === 100);
    if (cash < 100) {
      expect(text).not.toContain('square');
      const memories = social.memoriesOf(s.w, s.target);
      expect(JSON.stringify(memories)).not.toContain('paid back what was owed');
      expect(JSON.stringify(memories)).toContain(`$${((100 - cash) / 100).toFixed(2)} still owed`);
    }
    expect(
      obligationsOf(s.w, s.c, s.pc)
        .filter((o) => o.kind === 'money')
        .map((o) => o.cents),
    ).toEqual(cash < 100 ? [100 - cash] : []);
    expect(findNonIntegers(s.w)).toEqual([]);
  });

  it.each([60, 100, 140])(
    'nets reverse loans against an existing %i-cent debt and keeps views/eligibility consistent',
    (original) => {
      const s = scene();
      debt(s, original);
      purse(s, 100);
      expect(act(s, 'lend').result.success).toBe(true);
      const balance = original - 100;
      const edges = s.w.social.relationships.filter((r) => r.kind === 'creditor' && (r.a === s.pc || r.b === s.pc));
      expect(edges).toHaveLength(balance === 0 ? 0 : 1);
      if (balance)
        expect(edges[0]).toMatchObject({
          a: balance > 0 ? s.target : s.pc,
          b: balance > 0 ? s.pc : s.target,
          amountCents: Math.abs(balance),
        });
      expect(
        obligationsOf(s.w, s.c, s.pc)
          .filter((o) => o.kind === 'money')
          .map((o) => o.cents),
      ).toEqual(balance > 0 ? [balance] : []);
      expect(
        claimsOf(s.w, s.pc)
          .filter((o) => o.cents > 0)
          .map((o) => o.cents),
      ).toEqual(balance < 0 ? [-balance] : []);
      expect(social.interactionAvailability(s.w, s.c, s.pc, s.target, 'repay').ok).toBe(balance > 0);
      if (balance > 0) {
        purse(s, balance);
        expect(act(s, 'repay').result.success).toBe(true);
        expect(obligationsOf(s.w, s.c, s.pc).filter((o) => o.kind === 'money')).toEqual([]);
      }
    },
  );

  it('gifts only accessible stacks, including food inside carried containers and pantries at home', () => {
    const s = scene();
    const { w, pc, c } = s;
    const ctx = makeContext(w, c, []);
    const actor = required(w.actors[pc]);
    const home = required(w.households[actor.householdId]).homePlaceId;
    for (const { stack } of items.stacksDeep(w, items.carriedBy(pc)))
      if (c.items[stack.defId]?.food) items.moveStack(w, ctx, stack.id, stack.qty, items.pantryOf(actor.householdId));
    actor.placeId = required(Object.values(w.places).find((p) => p.id !== home)).id;
    required(w.actors[s.target]).placeId = actor.placeId;
    expect(social.giftStack(w, c, pc)).toBeNull();
    expect(act(s, 'gift').result.success).toBe(false);
    actor.placeId = home;
    const pantryGift = required(social.giftStack(w, c, pc));
    expect(provisions.accessibleStack(w, pc, pantryGift)).toBe(true);
    const container = required(
      items.stacksDeep(w, items.carriedBy(pc)).find(({ stack }) => c.items[stack.defId]?.container),
    ).stack;
    const moved = items.moveStack(w, ctx, pantryGift.id, 1, { kind: 'container', itemId: container.id });
    actor.placeId = required(Object.values(w.places).find((p) => p.id !== home)).id;
    expect(social.giftStack(w, c, pc)?.id).toBe(moved);
    expect(act(s, 'gift').result.success).toBe(true);
  });

  it.each(['pair', 'speaker'] as const)(
    'retains more than 24 live %s cooldowns, then expires them by window',
    (scope) => {
      const s = scene();
      const ids: string[] = [];
      const listeners = Object.values(s.w.actors)
        .filter((a) => a.id !== s.pc && a.alive && s.w.time - a.born > 20 * 365 * 1440)
        .map((a) => a.id);
      const start = s.w.time;
      for (let n = 0; n < 60; n++) {
        s.w.time = asGameMinute(start + n * 60);
        const target = scope === 'pair' ? s.target : required(listeners[n % listeners.length]);
        const ex = required(
          social.composeExchange(s.w, makeContext(s.w, s.c, []), {
            def: required(s.c.interactions.chat),
            initiatorId: s.pc,
            targetId: target,
            placeId: null,
            success: true,
            part: 'act',
          }),
        );
        ids.push(...ex.ids);
      }
      expect(new Set(ids).size).toBe(60);
      const speakerHistory = required(s.w.social.talk?.[`s${s.pc}`]);
      expect(Object.keys(speakerHistory).length).toBe(60);
      pruneTalk(s.w, start + 3 * 1440);
      expect(speakerHistory[required(ids[0])]).toBeUndefined();
      if (scope === 'pair') {
        const key = s.pc < s.target ? `${s.pc}-${s.target}` : `${s.target}-${s.pc}`;
        expect(s.w.social.talk?.[key]?.[required(ids[0])]).toBe(start);
        pruneTalk(s.w, start + 7 * 1440);
        expect(s.w.social.talk?.[key]?.[required(ids[0])]).toBeUndefined();
      }
      expect(findNonIntegers(s.w)).toEqual([]);
    },
  );

  it('generic introductions do not assign housing, inventory, family or a birthplace', () => {
    const s = scene();
    const introductions = Object.values(s.c.talk_lines).filter((l) => l.on.includes('introduce'));
    expect(introductions.length).toBeGreaterThan(25);
    for (const line of introductions) {
      const text = line.lines.map((l) => l.text).join(' ');
      expect(text, line.id).not.toMatch(
        /Keller|taken the|#homeland#|from New England|From Baden|Out of Cornwall|my boy|I've a sack|cracked axle|I have a letter|seven and three-quarters|only passing through|I'm new here/,
      );
    }
    const line = required(s.c.talk_lines.id_neighbor_move);
    const content = { ...s.c, talk_lines: { [line.id]: line } };
    const ex = required(
      social.composeExchange(s.w, makeContext(s.w, content, []), {
        def: required(content.interactions.introduce),
        initiatorId: s.pc,
        targetId: s.target,
        placeId: required(s.w.actors[s.pc]).placeId,
        success: true,
        part: 'act',
      }),
    );
    expect(ex.line).toContain("know each other's names");
    expect(ex.line).not.toMatch(/chimney|well is good|Keller/);
  });
});
