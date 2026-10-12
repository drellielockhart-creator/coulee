/**
 * module:social, wave 5 (playtest triage 2026-10-11 r2): availability reads what people actually
 * do; short talk with the working; requests state their terms and are throttled; gifts are things;
 * courtship wants an acquaintance; a loan paid straight back earns no trust; loans keep one pocket;
 * a speaker varies their words; asked for the news, people tell what they have.
 */
import {
  type ActorId,
  asGameMinute,
  belief,
  type Command,
  type ContentBundle,
  eventsSince,
  items,
  makeContext,
  social,
  step,
} from '@coulee/core';
import { sessionSim } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { baseContent } from './helpers.ts';

function required<T>(v: T | undefined | null): T {
  if (v == null) throw new Error('Missing fixture');
  return v;
}

/** Monday 10:00, a working hour, with `key` beside the newcomer doing `activityId`. */
function scene(key: string, activityId: string, content: ContentBundle = baseContent()) {
  const sim = sessionSim(content, { source: 'iron_ford', seed: 42 });
  const w = sim.world;
  const pc = required(w.meta.playerId);
  w.time = asGameMinute(1440 + 10 * 60);
  const target = required(w.index.actorByKey[key]);
  const actor = required(w.actors[target]);
  actor.placeId = required(w.actors[pc]).placeId;
  const st = required(w.activity.byActor[target]);
  Object.assign(st, { activityId, placeId: actor.placeId, travel: null, lockedUntil: null });
  const own = required(w.activity.byActor[pc]);
  Object.assign(own, { activityId: 'idle_at_home', lockedUntil: null });
  return { sim, w, pc, target };
}

const urge = (pc: ActorId, interactionId: string, targetId: ActorId): Command => ({
  kind: 'core.urge',
  actorId: pc,
  data: { urge: { kind: 'interaction', interactionId, targetId } },
  issuer: { kind: 'player' },
});

describe('availability reads what people actually do (playtest r2)', () => {
  it('someone present but scheduled for work is available; the asleep and the working say so', () => {
    const c = baseContent();
    const meal = scene('johann_brenner', 'take_meal');
    expect(social.interactionAvailability(meal.w, c, meal.pc, meal.target, 'chat')).toEqual({ ok: true });
    expect(social.workStatus(meal.w, c, meal.target)).toMatchObject({ working: false, due: true });

    const asleep = scene('johann_brenner', 'sleep');
    expect(social.interactionAvailability(asleep.w, c, asleep.pc, asleep.target, 'chat').reason).toBe(
      'Johann Brenner is asleep',
    );

    const forge = scene('johann_brenner', 'forge_iron');
    expect(social.interactionAvailability(forge.w, c, forge.pc, forge.target, 'chat').ok).toBe(true);
    const long = social.interactionAvailability(forge.w, c, forge.pc, forge.target, 'deep_talk');
    expect(long.ok).toBe(false);
    expect(long.reason).toMatch(/^Johann Brenner is working the forge here.*a short word/);

    // Keeping the tavern is talking with the house: no work limit on the length of talk.
    const bar = scene('michael_dunleavy', 'tend_bar');
    const talk = social.interactionAvailability(bar.w, c, bar.pc, bar.target, 'deep_talk');
    expect(talk.reason ?? '').not.toMatch(/short word/);
  });

  it('a deliberate word with someone at work keeps them working and costs a little regard, as a Reason', () => {
    const { sim, w, pc, target } = scene('johann_brenner', 'forge_iron');
    const last = w.log.lastId;
    step(sim, [urge(pc, 'chat', target)]);
    const act = eventsSince(w.log, last).find((e) => e.kind === 'social.interaction' && e.data.initiatorId === pc);
    expect(act?.kind === 'social.interaction' && act.data.atWork).toBe(true);
    expect(w.activity.byActor[target]?.activityId).toBe('forge_iron');
    expect(social.reasonsOf(w, target, pc).map((r) => r.label)).toContain('Kept me from my work');
  });

  it('a cooldown names when it ends, and a standing tie comes before it', () => {
    const { w, pc, target } = scene('joel_pike', 'take_meal');
    const c = baseContent();
    for (let n = 0; n < 3; n++) social.bumpFamiliarity(w, c, pc, target);
    const rec = required(w.social.opinions[pc]?.[target]);
    rec.cooldowns.compliment = w.time + 3 * 1440 + 600;
    expect(social.interactionAvailability(w, c, pc, target, 'compliment').reason).toMatch(
      /^Not yet: .* again from Thursday 20:00$/,
    );
    w.social.relationships.push({ a: pc, b: target, kind: 'courting', since: w.time, amountCents: null });
    rec.cooldowns.court = w.time + 3 * 1440;
    expect(social.interactionAvailability(w, c, pc, target, 'court').reason).toBe(
      'You are already walking out with Joel Pike',
    );
  });
});

describe('exploits closed (playtest r2)', () => {
  it('courting wants an acquaintance on both sides, and is refused outright below the target’s regard', () => {
    const { sim, w, pc, target } = scene('joel_pike', 'take_meal');
    const c = baseContent();
    social.bumpFamiliarity(w, c, pc, target);
    expect(social.interactionAvailability(w, c, pc, target, 'court').reason).toMatch(/hardly knows you/);
    for (let n = 0; n < 3; n++) social.bumpFamiliarity(w, c, pc, target);
    expect(social.interactionAvailability(w, c, pc, target, 'court').ok).toBe(true);
    const last = w.log.lastId;
    step(sim, [urge(pc, 'court', target)]);
    const act = eventsSince(w.log, last).find((e) => e.kind === 'social.interaction' && e.data.initiatorId === pc);
    expect(act?.kind === 'social.interaction' && act.data.interactionId).toBe('court');
    expect(act?.kind === 'social.interaction' && act.data.success).toBe(false);
    expect(act?.explain?.note).toContain('no encouragement');
    expect(
      act?.explain?.children?.some(
        (child) => child.knowledge === 'self' && child.subjects[0] === target && child.note?.includes('below 15'),
      ),
    ).toBe(true);
  });

  it('a gift hands over a real thing from the giver’s kit, and with nothing fit to give there is no gift', () => {
    const { sim, w, pc, target } = scene('joel_pike', 'take_meal');
    const c = baseContent();
    social.bumpFamiliarity(w, c, pc, target);
    const gift = required(social.giftStack(w, c, pc));
    const before = gift.qty;
    const defId = gift.defId;
    const last = w.log.lastId;
    step(sim, [urge(pc, 'gift', target)]);
    const act = eventsSince(w.log, last).find((e) => e.kind === 'social.interaction' && e.data.initiatorId === pc);
    expect(act?.kind === 'social.interaction' && act.data.itemDefId).toBe(defId);
    const mine = items.stacksDeep(w, items.carriedBy(pc)).filter((s) => s.stack.defId === defId);
    expect(mine.reduce((n, s) => n + s.stack.qty, 0)).toBe(before - 1);
    const theirs = items.stacksDeep(w, items.carriedBy(target)).filter((s) => s.stack.defId === defId);
    expect(theirs.reduce((n, s) => n + s.stack.qty, 0)).toBeGreaterThanOrEqual(1);

    const tuning = required(c.social_tuning.default);
    const bookish = { ...c, social_tuning: { default: { ...tuning, gift_sections: ['books'] } } };
    const none = scene('joel_pike', 'take_meal', bookish);
    social.bumpFamiliarity(none.w, bookish, none.pc, none.target);
    expect(social.interactionAvailability(none.w, bookish, none.pc, none.target, 'gift').reason).toMatch(
      /^You have nothing to give Joel Pike/,
    );
  });

  it('a loan goes purse to purse, and paid straight back earns the lender no trust', () => {
    const { sim, w, pc, target } = scene('joel_pike', 'take_meal');
    const c = baseContent();
    social.bumpFamiliarity(w, c, pc, target);
    const purse = w.provisions.purses[pc] ?? 0;
    const household = w.provisions.households[required(w.actors[pc]).householdId]?.cashCents ?? 0;
    const last = w.log.lastId;
    step(sim, [urge(pc, 'lend', target)]);
    const moved = eventsSince(w.log, last).filter((e) => e.kind === 'provisions.cash_transfer');
    expect(moved[0]?.kind === 'provisions.cash_transfer' && moved[0].data).toMatchObject({ fromId: pc, cents: 100 });
    // Joel may settle up within the very hour; if not, he does so now.
    if (social.debtOf(w, pc, target).cents > 0)
      social.resolveInteraction(w, makeContext(w, c, []), {
        def: required(c.interactions.repay),
        initiatorId: target,
        targetId: pc,
        placeId: required(w.actors[pc]).placeId,
        present: [],
        mode: 'urge',
        via: 'urge',
      });
    expect(social.debtOf(w, pc, target).cents).toBe(0);
    expect(w.provisions.purses[pc]).toBe(purse);
    expect(w.provisions.households[required(w.actors[pc]).householdId]?.cashCents ?? 0).toBe(household);
    expect(social.reasonsOf(w, pc, target).map((r) => r.label)).not.toContain('Paid back what was owed');
  });
});

describe('requests state their terms and are not repeated soon (playtest r2)', () => {
  it('a favor offered says what is asked and what a yes would owe; the asker waits before asking again', () => {
    const { sim, w, pc } = scene('joel_pike', 'take_meal');
    const c = baseContent();
    const michael = required(w.index.actorByKey.michael_dunleavy);
    const m = required(w.actors[michael]);
    m.placeId = required(w.actors[pc]).placeId;
    social.bumpFamiliarity(w, c, michael, pc);
    social.resolveInteraction(w, makeContext(w, c, []), {
      def: required(c.interactions.help),
      initiatorId: michael,
      targetId: pc,
      placeId: m.placeId,
      present: [],
      mode: 'urge',
      via: 'urge',
    });
    const [request] = social.pendingRequests(w, pc);
    expect(request?.text).toMatch(/^Michael Dunleavy offers to lend a hand for an hour .*you will owe him a favor/);
    expect(request?.favors).toBe(1);
    const asked = required(w.social.opinions[michael]?.[pc]).cooldowns.help ?? 0;
    expect(asked).toBeGreaterThanOrEqual(w.time + 72 * 60);
    w.time = asGameMinute(w.time + 120);
    step(sim);
    expect(social.pendingRequests(w, pc)).toHaveLength(0);
    expect(required(w.social.opinions[michael]?.[pc]).cooldowns.help ?? 0).toBeGreaterThanOrEqual(w.time + 160 * 60);
  });

  it('a loan offered names the sum and the date it falls due', () => {
    const c = baseContent();
    const terms = social.requestTerms(
      sessionSim(c, { source: 'iron_ford', seed: 42 }).world,
      c,
      required(c.interactions.lend),
      required(sessionSim(c, { source: 'iron_ford', seed: 42 }).world.index.actorByKey.amos_whitcomb),
      'borrow',
      0,
    );
    expect(terms.text).toMatch(
      /offers you the loan of \$1\.00.*you will owe him \$1\.00, due by Tuesday the 1st of May/,
    );
    expect(terms.dueT).toBe(30 * 1440);
  });
});

describe('talk: a speaker varies their words; asked, people tell what they have (playtest r2)', () => {
  it('one speaker does not say the same line to one listener after another while others fit', () => {
    const sim = sessionSim(baseContent(), { source: 'iron_ford', seed: 42 });
    const w = sim.world;
    const c = baseContent();
    const chat = required(c.interactions.chat);
    const people = Object.values(w.actors)
      .filter((a) => a.alive && a.key !== 'play_newcomer' && w.time - a.born > 20 * 365 * 1440)
      .map((a) => a.id);
    const [speaker, ...listeners] = people;
    const ctx = makeContext(w, c, []);
    const ids: string[] = [];
    for (const t of listeners.slice(0, 8)) {
      const ex = social.composeExchange(w, ctx, {
        def: chat,
        initiatorId: required(speaker),
        targetId: t,
        placeId: null,
        success: true,
        part: 'act',
      });
      ids.push(...(ex?.ids ?? []));
    }
    expect(ids.length).toBe(8);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('asked for the news, anyone holding tellable news tells some of it', () => {
    const sim = sessionSim(baseContent(), { source: 'iron_ford', seed: 42 });
    const w = sim.world;
    for (let h = 0; h < 72; h++) step(sim);
    const ctx = makeContext(w, sim.content, []);
    const pc = required(w.meta.playerId);
    const holders = Object.values(w.actors).filter((a) => a.id !== pc && belief.holdsNews(w, a.id));
    expect(holders.length).toBeGreaterThan(0);
    for (const a of holders.slice(0, 10)) {
      const plan = belief.planTransmit(w, ctx, {
        speakerId: a.id,
        listenerId: pc,
        placeId: null,
        channel: 'street',
        interactionEventId: null,
        deliberate: true,
        asked: true,
      });
      expect(plan, a.name.given).not.toBeNull();
    }
  });
});
