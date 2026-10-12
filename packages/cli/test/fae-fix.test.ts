import { asGameMinute, fae, makeContext, psyche, restoreSim, rowsOf, step } from '@coulee/core';
import { sessionSim } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { omenEntries } from '../../core/src/chronicle/omens.ts';
import { makeDetectCtx } from '../../core/src/chronicle/system.ts';
import { ironByPlace } from '../../core/src/fae/conditions.ts';
import { resolveEpisode, snapshotWindow, windows } from '../../core/src/fae/episodes.ts';
import { noticeEpisode, omenCheck, readEpisode } from '../../core/src/fae/omens.ts';
import { createStack } from '../../core/src/items/api.ts';
import { purchase } from '../../core/src/provisions/economy.ts';
import { resolveInteraction } from '../../core/src/social/interact.ts';
import { requestsHour } from '../../core/src/social/requests.ts';
import { perceivedEvents } from '../../play/src/interrupts.ts';
import { eventView } from '../../play/src/observation.ts';
import { baseContent, simFor } from './helpers.ts';

function required<T>(x: T | undefined | null): T {
  if (x === undefined || x === null) throw new Error('fixture');
  return x;
}
function fixture() {
  const sim = sessionSim(baseContent(), { source: 'iron_ford', seed: 42 });
  const id = required(sim.world.meta.playerId);
  const actor = required(sim.world.actors[id]);
  const place = required(rowsOf(sim.world.places).find((p) => p.defId === 'lower_coulee'));
  actor.placeId = place.id;
  actor.sheet.skills.perception = 40;
  sim.world.time = asGameMinute(1000);
  const ctx = makeContext(sim.world, sim.content, []);
  const snap = snapshotWindow(sim.world, ctx, place, 'dusk', 1000);
  const e = required(resolveEpisode(sim.world, ctx, { ...snap, trueRate: 1000, lookRate: 0 }));
  sim.world.fae.episodes[e.id] = e;
  return { sim, id, actor, place, ctx, e };
}
describe('fae review regressions', () => {
  it.each(['lend', 'borrow', 'court', 'propose', 'gift', 'ask_about'])(
    '%s waits for recipient consent before any response consequences',
    (interaction) => {
      const { sim, id, actor, ctx } = fixture();
      const npc = required(rowsOf(sim.world.actors)[0]);
      npc.placeId = actor.placeId;
      const def = structuredClone(required(sim.content.interactions[interaction]));
      expect(def).toBeDefined();
      def.check = { kind: 'none' };
      const before = JSON.stringify({
        provisions: sim.world.provisions,
        relationships: sim.world.social.relationships,
        opinions: sim.world.social.opinions,
      });
      resolveInteraction(sim.world, ctx, {
        def,
        initiatorId: npc.id,
        targetId: id,
        placeId: actor.placeId,
        present: [],
        mode: 'forced',
        via: 'urge',
      });
      const request = sim.world.social.pendingRequests?.[0];
      expect(request?.status).toBe('pending');
      expect(
        JSON.stringify({
          provisions: sim.world.provisions,
          relationships: sim.world.social.relationships,
          opinions: sim.world.social.opinions,
        }),
      ).toBe(before);
      expect(sim.world.log.events.some((e) => e.kind === 'social.interaction')).toBe(false);
      requestsHour(
        sim.world,
        makeContext(sim.world, sim.content, [
          { kind: 'social.answer_request', actorId: id, data: { requestId: required(request).id, accept: false } },
        ]),
      );
      expect(request?.status).toBe('refused');
      expect(
        JSON.stringify({
          provisions: sim.world.provisions,
          relationships: sim.world.social.relationships,
          opinions: sim.world.social.opinions,
        }),
      ).toBe(before);
    },
  );
  it('an accepted incoming loan transfers once and creates debt only after the answer Command', () => {
    const { sim, id, actor, ctx } = fixture();
    const npc = required(rowsOf(sim.world.actors)[0]);
    npc.placeId = actor.placeId;
    const def = required(sim.content.interactions.lend);
    sim.world.provisions.purses[npc.id] = 1000;
    resolveInteraction(sim.world, ctx, {
      def,
      initiatorId: npc.id,
      targetId: id,
      placeId: actor.placeId,
      present: [],
      mode: 'forced',
      via: 'urge',
    });
    const request = required(required(sim.world.social.pendingRequests)[0]);
    const answer = makeContext(sim.world, sim.content, [
      { kind: 'social.answer_request', actorId: id, data: { requestId: request.id, accept: true } },
    ]);
    requestsHour(sim.world, answer);
    expect(request.status).toBe('accepted');
    expect(sim.world.log.events.filter((e) => e.kind === 'provisions.cash_transfer')).toHaveLength(1);
    const after = JSON.stringify(sim.world.provisions);
    requestsHour(sim.world, answer);
    expect(JSON.stringify(sim.world.provisions)).toBe(after);
  });
  it('a co-located non-witness never receives an omen; a later noticer gets a Journal entry', () => {
    const { sim, id, actor, ctx, e } = fixture();
    const npc = required(rowsOf(sim.world.actors)[0]);
    npc.placeId = actor.placeId;
    npc.sheet.skills.perception = 40;
    actor.placeId = required(rowsOf(sim.world.places)[0]).id;
    noticeEpisode(sim.world, ctx, e);
    const first = required(sim.world.log.events.find((ev) => ev.kind === 'fae.omen'));
    expect(perceivedEvents([first], id, e.snapshot.placeId)).toEqual([]);
    actor.placeId = e.snapshot.placeId;
    noticeEpisode(sim.world, ctx, e);
    const own = required(sim.world.log.events.filter((ev) => ev.kind === 'fae.omen').at(-1));
    expect(perceivedEvents([own], id, e.snapshot.placeId)).toEqual([own]);
    if (own.kind !== 'fae.omen') throw Error('fixture');
    omenEntries(makeDetectCtx(sim.world, ctx), own);
    expect(sim.world.chronicle.entries.some((entry) => entry.voice === 'journal' && entry.text.includes(e.text))).toBe(
      true,
    );
  });
  it('failed read fair output is identical across hidden truth, with counterfactuals only in god mode', () => {
    const { sim, id, actor, ctx, e } = fixture();
    noticeEpisode(sim.world, ctx, e);
    actor.sheet.skills.lore_fae = -100;
    actor.sheet.skills.lore_nature = -100;
    actor.sheet.skills.woodcraft = -100;
    for (const skill of Object.keys(actor.sheet.skills))
      if (skill.startsWith('trade_')) actor.sheet.skills[skill] = -100;
    const second = restoreSim(sim.content, structuredClone(sim.world));
    required(second.world.fae.episodes[e.id]).truth = 'mundane';
    e.truth = 'fae';
    readEpisode(sim.world, ctx, e, id);
    readEpisode(
      second.world,
      makeContext(second.world, second.content, []),
      required(second.world.fae.episodes[e.id]),
      id,
    );
    const one = required(sim.world.log.events.at(-1));
    const two = required(second.world.log.events.at(-1));
    const view = { world: sim.world, content: sim.content };
    expect(eventView(one, id, 'fair', view)).toEqual(eventView(two, id, 'fair', view));
    expect(eventView(one, id, 'god', view).explain?.children).toHaveLength(3);
  });
  it('discovery and dusk follow-up persist separately and never reroll', () => {
    const { sim, id, actor, ctx, e } = fixture();
    const target = required(rowsOf(sim.world.places).find((p) => p.defId === 'huldras_shelf'));
    e.lead = { kind: 'place', placeId: target.id };
    noticeEpisode(sim.world, ctx, e);
    expect(fae.investigate(sim.world, ctx, id, e.id, { kind: 'command', issuer: { kind: 'player' } })).toBe(true);
    const attempt = structuredClone(e.attempts[id]);
    actor.placeId = target.id;
    sim.world.time = asGameMinute(1440 + 720);
    const before = JSON.stringify(sim.world.fae);
    const time = sim.world.time;
    expect(
      fae.investigate(sim.world, makeContext(sim.world, sim.content, []), id, e.id, {
        kind: 'command',
        issuer: { kind: 'player' },
      }),
    ).toBe(false);
    expect(JSON.stringify(sim.world.fae)).toBe(before);
    expect(sim.world.time).toBe(time);
    expect(sim.world.log.events.at(-1)?.kind).toBe('fae.refused');
    const dusk = required(windows(target, 1).find((w) => w.window === 'dusk')).at;
    sim.world.time = asGameMinute(Math.ceil(dusk / 60) * 60);
    expect(
      fae.investigate(sim.world, makeContext(sim.world, sim.content, []), id, e.id, {
        kind: 'command',
        issuer: { kind: 'player' },
      }),
    ).toBe(true);
    expect(e.attempts[id]).toEqual(attempt);
    expect(e.followups?.[id]?.text).toContain('dusk');
    const restored = restoreSim(sim.content, structuredClone(sim.world));
    expect(fae.investigationEligibility(restored.world, id, e.id)).toContain('already tested');
  });
  it('pairs every text with its mundane reading and suppresses repeated surfaces for seven days', () => {
    const { sim, e, ctx } = fixture();
    const d = required(sim.content.omens[e.defId]);
    expect(e.plain).toBe(d.plain[e.variant]);
    for (const omen of Object.values(sim.content.omens)) expect(omen.text.length).toBeGreaterThanOrEqual(8);
    for (const text of d.text) sim.world.fae.cooldowns[`text:place:${e.snapshot.placeId}:${text}`] = 1000 + 10080;
    expect(
      resolveEpisode(sim.world, ctx, {
        ...e.snapshot,
        families: [e.defId],
        familyWeights: [100],
        trueRate: 1000,
        lookRate: 0,
      }),
    ).toBeNull();
  });
  it('published omen surfaces cannot recur within 30 days even across cleanup', () => {
    const { sim, id, ctx, e } = fixture();
    const actors = rowsOf(sim.world.actors).slice(0, 3);
    for (const a of actors) {
      a.placeId = e.snapshot.placeId;
      a.sheet.skills.perception = 40;
    }
    noticeEpisode(sim.world, ctx, e);
    const ev = required(sim.world.log.events.find((x) => x.kind === 'fae.omen'));
    if (ev.kind !== 'fae.omen') throw Error('fixture');
    for (let day = 0; day < 35; day++) {
      sim.world.time = asGameMinute(day * 1440);
      omenEntries(makeDetectCtx(sim.world, makeContext(sim.world, sim.content, [])), { ...ev, t: sim.world.time });
    }
    expect(
      sim.world.chronicle.entries.filter(
        (x) => ['paper', 'almanac'].includes(x.voice) && x.templateId?.startsWith('omen_'),
      ),
    ).toHaveLength(2);
    expect(id).toBeGreaterThan(0);
  });
  it('content standing limits constrain repeated purchases and persist across save/load', () => {
    const { sim, id, actor } = fixture();
    step(sim, [
      {
        kind: 'core.standing_orders',
        actorId: id,
        data: { orders: { ...psyche.standingOrders(sim.world, id), capabilities: ['buy_staples'] } },
      },
    ]);
    const store = rowsOf(sim.world.places).find((p) => sim.world.provisions.stores[p.id]);
    actor.placeId = required(store).id;
    sim.world.time = asGameMinute(600);
    const food = Object.values(sim.content.items).find((d) => d.food && d.value_cents > 0 && d.value_cents < 25);
    createStack(sim.world, makeContext(sim.world, sim.content, []), required(food).id, 100, {
      kind: 'place',
      placeId: actor.placeId,
    });
    expect(food).toBeDefined();
    const ctx = makeContext(sim.world, sim.content, []);
    for (let n = 0; n < 20; n++) purchase(sim.world, ctx, id, actor.placeId, required(food).id, 1, false);
    const spent = psyche.agencyOf(sim.world, id).standingUsage?.buy_staples?.cents ?? 0;
    expect(spent).toBeGreaterThan(0);
    expect(spent).toBeLessThanOrEqual(50);
    const restored = restoreSim(sim.content, structuredClone(sim.world));
    expect(
      psyche.authorizeAct(
        restored.world,
        id,
        { kind: 'purchase', cents: 51 - spent, itemTags: ['food'] },
        { kind: 'standing', capability: 'buy_staples' },
      ).ok,
    ).toBe(false);
    restored.world.time = asGameMinute(10080);
    expect(
      psyche.authorizeAct(
        restored.world,
        id,
        { kind: 'purchase', cents: 50, itemTags: ['food'] },
        { kind: 'standing', capability: 'buy_staples' },
      ).ok,
    ).toBe(true);
    expect(
      psyche.authorizeAct(
        restored.world,
        id,
        { kind: 'purchase', cents: 1, itemTags: ['weapon'] },
        { kind: 'standing', capability: 'buy_staples' },
      ).ok,
    ).toBe(false);
  });
  it('notice explains Drift, Second Sight, Seam, Deep Sense and weather from data', () => {
    const { sim, id, actor, e } = fixture();
    const content = structuredClone(sim.content);
    const d = required(content.omens[e.defId]);
    d.glamour = true;
    d.deep_sense = true;
    actor.traits.push('see_the_seam', 'deep_sense');
    actor.sheet.feats.push('second_sight');
    sim.world.fae.drift = { [id]: 60 };
    e.snapshot.thunder = true;
    const result = omenCheck(sim.world, makeContext(sim.world, content, []), e, id, 'perception', 12, 0xfae2);
    const terms = Object.fromEntries(result.explain.terms.map((t) => [t.label, t.value]));
    expect(terms).toMatchObject({ Drift: 3, 'Second Sight': 5, 'See the Seam': 4, 'Deep Sense': 2 });
    expect(result.explain.dc?.terms.some((t) => t.label === 'Heavy rain' && t.value === 5)).toBe(true);
  });
  it('physical carried and stored iron affects subtle families independently of tags', () => {
    const sim = simFor();
    const grams = ironByPlace(sim.world, sim.content);
    expect(Object.values(grams).some((n) => n >= 2270)).toBe(true);
    const p = required(rowsOf(sim.world.places).find((p) => p.defId === 'lower_coulee'));
    const ctx = makeContext(sim.world, sim.content, []);
    const noIron = snapshotWindow(sim.world, ctx, p, 'dusk', 2500, {});
    const iron = snapshotWindow(sim.world, ctx, p, 'dusk', 2500, { [p.id]: 2270 });
    expect(iron.trueRate + iron.lookRate).toBeLessThan(noIron.trueRate + noIron.lookRate);
  });
});
