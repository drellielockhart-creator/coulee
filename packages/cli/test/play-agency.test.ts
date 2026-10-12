import {
  asGameMinute,
  createSim,
  type Event,
  eventsSince,
  findNonIntegers,
  makeContext,
  psyche,
  runHours,
  social,
  step,
  type World,
} from '@coulee/core';
import { alertForEvent, PlaySession, parseText, renderDetail, sessionSim } from '@coulee/play';
import { expect, it } from 'vitest';
import { baseContent } from './helpers.ts';

function required<T>(value: T | undefined | null): T {
  if (value == null) throw new Error('Missing fixture');
  return value;
}

it('agency fields leave an all-NPC world unchanged: explicit psyche mode hashes the same as the default', () => {
  // Was a pinned literal hash from the agency wave's base; later waves legitimately change NPC behavior,
  // so assert the property instead: writing agencyMode 'psyche' everywhere must not alter the run.
  const plain = createSim(baseContent(), { scenarioId: 'iron_ford', seed: 42 });
  const explicit = createSim(baseContent(), { scenarioId: 'iron_ford', seed: 42 });
  for (const id of Object.keys(explicit.world.psyche.byActor)) {
    const p = explicit.world.psyche.byActor[Number(id) as keyof typeof explicit.world.psyche.byActor];
    if (p && p.agencyMode === undefined) p.agencyMode = 'psyche';
  }
  runHours(plain, 7 * 24);
  runHours(explicit, 7 * 24);
  // The state hash covers the new field itself, so compare behavior: event count, money and social totals.
  expect(explicit.world.log.lastId).toBe(plain.world.log.lastId);
  expect(JSON.stringify(explicit.world.provisions.purses)).toBe(JSON.stringify(plain.world.provisions.purses));
  expect(JSON.stringify(explicit.world.social.totals)).toBe(JSON.stringify(plain.world.social.totals));
}, 120000);

it('holds every consequential initiation and purse expense for 14 commanded days, including at a shop', () => {
  const sim = sessionSim(baseContent(), { source: 'iron_ford', seed: 42 });
  const pc = required(sim.world.meta.playerId);
  const forbidden: string[] = [];
  // The one standing expense (wave 5): the lodging order pays for the bed at her own lodgings,
  // only while she sleeps in it, bounded per day by the pay_lodging capability.
  const beds: number[] = [];
  sim.sink = (e) => {
    if (e.kind === 'social.interaction' && e.data.initiatorId === pc) forbidden.push(e.data.interactionId);
    if (e.kind === 'provisions.purchase' && e.data.buyerId === pc) forbidden.push('shopping');
    if (e.kind === 'provisions.cash_transfer' && e.data.fromId === pc)
      if (e.data.reason === 'Tavern bed') beds.push(e.data.cents);
      else forbidden.push(e.data.reason);
  };
  const shop = required(Object.values(sim.world.places).find((p) => sim.world.provisions.stores[p.id]));
  required(sim.world.actors[pc]).placeId = shop.id;
  runHours(sim, 14 * 24);
  expect(forbidden).toEqual([]);
  expect(beds.length).toBeGreaterThan(10);
  // At most one bed a night: 14 days span 15 nights (the first is paid at 01:00 on day 0).
  expect(beds.length).toBeLessThanOrEqual(15);
  expect(sim.world.provisions.purses[pc]).toBe(5000 - beds.reduce((n, c) => n + c, 0));
  expect(psyche.psycheOf(sim.world, pc)?.anxiety).toBeGreaterThan(0);
  expect(findNonIntegers(sim.world)).toEqual([]);
}, 120000);

it('an NPC can switch agency by Command and follows a command, while standing orders can be narrowed', () => {
  const sim = createSim(baseContent(), { scenarioId: 'iron_ford', seed: 42 });
  const id = required(Object.values(sim.world.actors)[0]).id;
  const place = required(sim.world.actors[id]).placeId;
  step(sim, [
    {
      kind: 'core.standing_orders',
      actorId: id,
      data: {
        agencyMode: 'commanded',
        orders: { sleep: false, eat: false, drink: false, warmth: false, lodging: false, activities: [] },
      },
    },
  ]);
  expect(psyche.agencyMode(sim.world, id)).toBe('commanded');
  step(sim, [
    {
      kind: 'core.urge',
      actorId: id,
      data: { urge: { kind: 'activity', activityId: 'idle_at_home', placeId: place } },
    },
  ]);
  expect(psyche.chosenUrge(sim.world, id)?.voice).toBe('command');
  expect(psyche.chosenUrge(sim.world, id)?.urge).toEqual({
    kind: 'activity',
    activityId: 'idle_at_home',
    placeId: place,
  });
  step(sim);
  expect(psyche.chosenUrge(sim.world, id)?.explain.label).toContain('Held for your order');
});

it('wait grammar, unavailable social commands and quantity failures consume no time', () => {
  const s = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
  for (const line of [
    '-1',
    '0',
    '999999',
    'wait until nonsense',
    'wait until 7:30',
    'wait until 24:00',
    'buy flour -1',
    'sell hardtack 0',
  ])
    expect(typeof parseText(line, s.observe()), line).toBe('string');
  for (const target of ['dawn', 'morning', 'noon', 'dusk', 'night', 'tomorrow', '07:00'])
    expect(typeof parseText(`wait until ${target}`, s.observe())).toBe('object');
  const before = s.hash;
  const command = parseText('court Nora Dunleavy', s.observe());
  expect(typeof command).toBe('object');
  if (typeof command === 'string') throw new Error(command);
  const result = s.act(command);
  expect(result.ok).toBe(false);
  expect(result.elapsedMinutes).toBe(0);
  expect(result.reason).toContain('asleep');
  expect(s.hash).toBe(before);
});

it('social menu and validation use the same feasibility query; Court cannot become Mock', () => {
  const s = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
  const saved = JSON.parse(s.save());
  const w = saved.world as World;
  w.time = asGameMinute(20 * 60);
  const pc = s.playerId;
  const target = required(Object.values(w.actors).find((a) => a.key === 'lucius_vance'));
  target.placeId = required(w.actors[pc]).placeId;
  required(w.activity.byActor[target.id]).activityId = 'idle_at_home';
  required(w.activity.byActor[target.id]).lockedUntil = null;
  const loaded = PlaySession.load(baseContent(), JSON.stringify(saved));
  const sim = sessionSim(baseContent(), { source: 'iron_ford', seed: 42 });
  sim.world = w;
  for (const a of loaded.observe().actions)
    if (a.command.kind === 'core.urge' && a.command.data.urge.kind === 'interaction') {
      const u = a.command.data.urge;
      expect(social.interactionAvailability(w, sim.content, pc, required(u.targetId), u.interactionId).ok).toBe(true);
    }
  // Walking out wants an acquaintance on both sides (playtest r2): three meetings' familiarity.
  for (let n = 0; n < 3; n++) social.bumpFamiliarity(sim.world, sim.content, pc, target.id);
  required(sim.world.activity.byActor[target.id]).lockedUntil = asGameMinute(sim.world.time + 60);
  const last = sim.world.log.lastId;
  step(sim, [
    {
      kind: 'core.urge',
      actorId: pc,
      data: { urge: { kind: 'interaction', interactionId: 'court', targetId: target.id } },
    },
  ]);
  const acts = eventsSince(sim.world.log, last).filter(
    (e) => e.kind === 'social.interaction' && e.data.initiatorId === pc,
  );
  expect(acts).toHaveLength(1);
  expect(acts.every((e) => e.kind === 'social.interaction' && e.data.interactionId === 'court')).toBe(true);
  expect(psyche.chosenUrge(sim.world, pc)?.urge).toMatchObject({ kind: 'interaction', interactionId: 'court' });
});

it('reports paid lodging and reconciles every purse/household delta across save/load', () => {
  const s = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
  const cmd = parseText('sleep', s.observe());
  if (typeof cmd === 'string') throw new Error(cmd);
  const r = s.act(cmd);
  expect(r.ok).toBe(true);
  expect(r.observation.changes.money).toEqual(
    expect.arrayContaining([expect.objectContaining({ purse: -25, household: 0, reason: 'Tavern bed: $0.25' })]),
  );
  expect(r.observation.self.provisions.purseCents).toBe(4975);
  expect(PlaySession.load(baseContent(), s.save()).observe().changes).toEqual(r.observation.changes);
  expect(PlaySession.replay(baseContent(), s.commandLog).observe()).toEqual(s.observe());
  const item = parseText('inspect hardtack', s.observe());
  if (typeof item === 'string') throw new Error(item);
  expect(renderDetail(s.act(item).detail)).toContain('protein');
});

it('cannot borrow from a commanded lender without their order', () => {
  const sim = sessionSim(baseContent(), { source: 'iron_ford', seed: 42 });
  const pc = required(sim.world.meta.playerId);
  const other = required(Object.values(sim.world.actors).find((a) => a.id !== pc));
  const loan = required(Object.values(sim.content.interactions).find((d) => d.success.ledger.cents < 0));
  const pair = required(
    social.makePair(sim.world, makeContext(sim.world, sim.content, []), other.id, pc, other.placeId, 0),
  );
  const before = JSON.stringify(sim.world.provisions.purses);
  const ctx = makeContext(sim.world, sim.content, []);
  social.resolveInteraction(sim.world, ctx, {
    def: loan,
    initiatorId: other.id,
    targetId: pc,
    placeId: other.placeId,
    present: [],
    mode: 'forced',
    via: 'urge',
  });
  expect(social.pendingRequests(sim.world, pc)).toHaveLength(1);
  expect(JSON.stringify(sim.world.provisions.purses)).toBe(before);
  expect(social.requiresFail(pair, loan, 'urge')).toBe('not acquainted');
  sim.world.time = asGameMinute(sim.world.time + 120);
  step(sim);
  expect(social.pendingRequests(sim.world, pc)).toHaveLength(0);
  expect(sim.world.log.events.some((e) => e.kind === 'social.request_answered' && e.data.status === 'no answer')).toBe(
    true,
  );
});

it('only related social events interrupt and compact output coalesces minor conversations', () => {
  const sim = sessionSim(baseContent(), { source: 'iron_ford', seed: 42 });
  const pc = required(sim.world.meta.playerId);
  const others = Object.values(sim.world.actors)
    .filter((a) => a.id !== pc)
    .slice(0, 2);
  const a = required(others[0]).id,
    b = required(others[1]).id;
  const event = {
    id: 1,
    t: sim.world.time,
    kind: 'social.interaction',
    data: { initiatorId: a, targetId: b, interactionId: 'chat' },
    roles: [
      { actor: a, role: 'agent' },
      { actor: b, role: 'subject' },
    ],
    visibility: 'public',
    place: required(sim.world.actors[pc]).placeId,
    importance: 100,
  } as Event;
  expect(alertForEvent(sim.world, sim.content, pc, event).pause).toBe(false);
  if (event.kind !== 'social.interaction') throw new Error('fixture');
  // Playtest r2: what is said to her that asks nothing of her goes to the digest, not a stop;
  // a blow stops the clock, and so does a request that wants her answer.
  event.data.targetId = pc;
  expect(alertForEvent(sim.world, sim.content, pc, event).pause).toBe(false);
  event.data.interactionId = 'fight';
  expect(alertForEvent(sim.world, sim.content, pc, event).pause).toBe(true);
  const asked = {
    ...event,
    kind: 'social.requested',
    data: { requestId: 'x', actorId: pc, from: a, text: 'A request.' },
  } as Event;
  expect(alertForEvent(sim.world, sim.content, pc, asked).pause).toBe(true);
});
