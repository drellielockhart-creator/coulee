import { activity, type Command, findNonIntegers, makeContext, stateHash, step } from '@coulee/core';
import { PlaySession, parseText, sessionSimOf } from '@coulee/play';
import { expect, it } from 'vitest';
import { productionHour } from '../../core/src/activity/production.ts';
import { employmentHour } from '../../core/src/provisions/employment.ts';
import { baseContent, simFor } from './helpers.ts';

const create = () => PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
function ask(s: PlaySession, text: string) {
  const c = parseText(text, s.observe());
  if (typeof c === 'string') throw new Error(c);
  const result = s.act(c);
  expect(result.ok, result.reason).toBe(true);
  return result;
}
function hop(s: PlaySession) {
  const action = s.observe().actions.find((a) => a.id.startsWith('go:'));
  if (!action) throw new Error('No local destination');
  return s.act(action.command);
}

it('four local acts chain in one hour; queries and settings spend nothing', () => {
  const s = create(),
    sim = sessionSimOf(s);
  const needs = structuredClone(sim.world.needs);
  const npc = Object.values(sim.world.actors).find((a) => a.id !== s.playerId);
  if (!npc) throw new Error('No NPC');
  const mind = structuredClone(sim.world.psyche.byActor[npc.id]);
  let spent = 0;
  for (let i = 0; i < 4; i++) {
    const r = hop(s);
    expect(r.ok).toBe(true);
    expect(r.elapsedMinutes).toBeGreaterThan(0);
    expect(r.elapsedMinutes).toBeLessThanOrEqual(15);
    spent += r.elapsedMinutes;
    expect(r.observation.time.t).toBe(0);
  }
  expect(s.observe().minuteBudget).toEqual({ spent, remaining: 60 - spent });
  for (const text of ['look', 'inspect me', 'plan', 'standing sleep off', 'rations 75'])
    expect(ask(s, text).elapsedMinutes).toBe(0);
  expect(s.observe().minuteBudget.spent).toBe(spent);
  expect(sim.world.needs).toEqual(needs);
  expect(sim.world.psyche.byActor[npc.id]).toEqual(mind);
  expect(findNonIntegers(sim.world)).toEqual([]);
});

it('overflow advances exactly one hourly tick and carries the spare minutes', () => {
  const s = create();
  // Fourteen-minute purchase lines force a non-divisible boundary using real orders.
  const sim = sessionSimOf(s);
  sim.content = structuredClone(sim.content);
  const timing = sim.content.playTiming.town;
  if (!timing) throw new Error('No timing');
  timing.purchase_minutes = 14;
  while (s.observe().time.t < 8 * 60) s.advance(60);
  ask(s, 'go Pratt');
  const at = s.observe().time.t;
  let spent = s.observe().minuteBudget.spent;
  while (spent + 14 < 60) {
    ask(s, 'buy hardtack 1');
    spent += 14;
    expect(s.observe().time.t).toBe(at);
  }
  const r = ask(s, 'buy hardtack 1');
  expect(r.elapsedMinutes).toBe(14);
  expect(r.observation.time.t).toBe(at + 60);
  expect(r.observation.minuteBudget.spent).toBe(spent + 14 - 60);
  expect(findNonIntegers(sim.world)).toEqual([]);
});

it('sub-hour save, fork, independent determinism and replay preserve the cursor', () => {
  const a = create(),
    b = create();
  for (let i = 0; i < 4; i++) {
    const command = a.observe().actions.find((x) => x.id.startsWith('go:'))?.command;
    if (!command) throw new Error('No walk');
    expect(a.act(command).ok).toBe(true);
    expect(b.act(command).ok).toBe(true);
    expect(a.hash).toBe(b.hash);
  }
  const loaded = PlaySession.load(baseContent(), a.save()),
    fork = a.fork();
  for (const s of [a, loaded, fork]) ask(s, 'rest');
  expect(a.hash).toBe(loaded.hash);
  expect(a.hash).toBe(fork.hash);
  expect(PlaySession.replay(baseContent(), a.commandLog).hash).toBe(a.hash);
  expect(a.observe().minuteBudget.spent).toBe(0);
});

it('a partly spent hour charges physiology once and starts a long sleep normally', () => {
  const s = create(),
    sim = sessionSimOf(s);
  hop(s);
  const spent = s.observe().minuteBudget.spent;
  const r = ask(s, 'sleep');
  expect(r.elapsedMinutes).toBe(60 - spent);
  expect(r.observation.time.t).toBe(60);
  expect(r.observation.minuteBudget.spent).toBe(0);
  expect(sim.world.activity.byActor[s.playerId]?.lockedUntil).toBeGreaterThan(60);
  expect(s.telemetry.filter((m) => m.kcalBurned > 0)).toHaveLength(1);
});

it('idling uses the unchanged hourly path, including every NPC', () => {
  const s = create(),
    reference = create();
  for (let i = 0; i < 12; i++) {
    s.advance(60);
    step(sessionSimOf(reference));
    expect(s.hash).toBe(stateHash(sessionSimOf(reference).world));
  }
  expect(activity.minuteBudget(sessionSimOf(s).world, s.playerId).spent).toBe(0);
});

it('chat and purchase resolve immediately with their configured costs and visible events', () => {
  const s = create();
  while (s.observe().time.t < 8 * 60) s.advance(60);
  ask(s, 'go Pratt');
  const at = s.observe().time.t;
  const buy = ask(s, 'buy hardtack 1');
  expect(buy.elapsedMinutes).toBe(5);
  expect(buy.observation.changes.money.some((m) => m.purse < 0)).toBe(true);
  const talk = s.observe().actions.find((a) => a.id.startsWith('talk:'));
  if (!talk) throw new Error('No conversation');
  const r = s.act(talk.command as Command);
  expect(r.ok, r.reason).toBe(true);
  expect(r.elapsedMinutes).toBe(10);
  expect(r.detail).toBeDefined();
  expect(r.observation.time.t).toBe(at);
  expect(PlaySession.replay(baseContent(), s.commandLog).hash).toBe(s.hash);
});

it('exact exhaustion returns 60 fresh minutes and an arrival interrupts immediately', () => {
  const s = create();
  const first = hop(s);
  expect(first.observation.time.t).toBe(0);
  expect(first.interrupts.some((i) => i.category === 'arrival')).toBe(true);
  const sim = sessionSimOf(s);
  const spent = s.observe().minuteBudget.spent;
  const command = s.observe().actions.find((a) => a.id.startsWith('go:'))?.command;
  if (command?.kind !== 'core.urge' || command.data.urge.kind !== 'activity') throw new Error('No walk');
  const to = command.data.urge.placeId;
  if (to === undefined) throw new Error('No destination');
  const copy = s.fork();
  const cost = copy.act(command).elapsedMinutes;
  activity.spendMinutes(sim.world, s.playerId, 60 - spent - cost, 'idle_at_home');
  const r = s.act(command);
  expect(r.observation.time.t).toBe(60);
  expect(r.observation.minuteBudget).toEqual({ spent: 0, remaining: 60 });
  expect(r.elapsedMinutes).toBe(cost);
  expect(r.observation.place.id).toBe(to);
});

it('a refused conversation preserves a partially spent cursor and world hash', () => {
  const s = create();
  hop(s);
  const before = s.hash;
  const r = s.act({
    kind: 'core.urge',
    actorId: s.playerId,
    data: { urge: { kind: 'interaction', interactionId: 'chat', targetId: s.playerId } },
  });
  expect(r.ok).toBe(false);
  expect(r.elapsedMinutes).toBe(0);
  expect(s.hash).toBe(before);
});

it('shopping minutes cannot also earn wages or gathered goods', () => {
  const sim = simFor(),
    w = sim.world;
  const job = w.social.relationships.find((r) => r.kind === 'employer');
  if (!job) throw new Error('No employment fixture');
  const worker = w.actors[job.b],
    state = w.activity.byActor[job.b];
  if (!worker || !state) throw new Error('No worker');
  state.workplaceId = worker.placeId;
  state.activityId = 'work';
  activity.spendMinutes(w, worker.id, 55, 'idle_at_home');
  employmentHour(w, makeContext(w, sim.content, []));
  expect(w.provisions.employment?.[worker.id]?.minutes).toBe(5);
  activity.spendMinutes(w, worker.id, 5, 'idle_at_home');
  state.activityId = 'gather_wood';
  const wood = Object.values(w.items.stacks)
    .filter((i) => i.defId === 'firewood_armload')
    .reduce((n, i) => n + i.qty, 0);
  productionHour(w, makeContext(w, sim.content, []));
  expect(w.provisions.productionCarry?.[`${worker.id}:gather_wood:firewood_armload`]).toBeUndefined();
  expect(
    Object.values(w.items.stacks)
      .filter((i) => i.defId === 'firewood_armload')
      .reduce((n, i) => n + i.qty, 0),
  ).toBe(wood);
});
