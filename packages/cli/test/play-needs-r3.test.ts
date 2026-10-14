/** Wave 10 A: sequences from the r3 QA, Greenhorn and Explorer command logs. */
import { activity, asGameMinute, findNonIntegers, makeContext, needs, step } from '@coulee/core';
import { PlaySession, parseText, sessionSimOf } from '@coulee/play';
import { expect, it } from 'vitest';
import { hourlyLedger } from '../../core/src/needs/system.ts';
import { baseContent, simFor } from './helpers.ts';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing repro fixture');
  return value;
}
function create(source = 'iron_ford') {
  return PlaySession.create(baseContent(), { source, seed: 42, pc: { kit: 'greenhorn' } });
}
function ask(s: PlaySession, text: string) {
  const cmd = parseText(text, s.observe());
  if (typeof cmd === 'string') throw new Error(`${text}: ${cmd}`);
  const result = s.act(cmd);
  expect(result.ok, `${text}: ${result.reason}`).toBe(true);
  return result;
}
function value(s: PlaySession, key = 'rest') {
  return needs.needValue(sessionSimOf(s).world, s.playerId, key);
}
/**
 * Wave 10 D refuses generic work without an employer or trade workplace. These physiology
 * repros give the PC a trade workplace where she stands (as A1 M6 does), not a hired shift:
 * a hired term would add Sunday, shift-hour and daily-hour limits the repros do not test.
 */
function tradeHere(s: PlaySession) {
  const w = sessionSimOf(s).world;
  activity.setWorkplace(w, s.playerId, required(w.actors[s.playerId]).placeId);
}
/** Replay a command log, re-applying the trade-workplace premise before the same command. */
function replayWithTrade(log: PlaySession['commandLog'], tradeAt: number) {
  const [, ...steps] = log;
  const r = create();
  steps.forEach((entry, i) => {
    if (i === tradeAt) tradeHere(r);
    if (entry.type !== 'command') throw new Error('Unexpected replay entry');
    expect(r.hash, `before replay step ${i}`).toBe(entry.before);
    expect(r.act(entry.command).ok).toBe(true);
    expect(r.hash, `after replay step ${i}`).toBe(entry.after);
  });
  return r;
}
function prepare(s: PlaySession, hour = 10) {
  const sim = sessionSimOf(s),
    w = sim.world,
    pc = s.playerId;
  w.time = asGameMinute(hour * 60);
  for (const key of ['hunger', 'thirst', 'warmth', 'security'])
    needs.satisfyNeed(w, makeContext(w, sim.content, []), pc, key, 1000, { label: 'Repro setup' });
  ask(s, 'standing eat off');
  ask(s, 'standing sleep off');
  return sim;
}

it('A1 H1: idle, work, work, idle charges the activity just performed; sleep and wake have no lag', () => {
  const s = create();
  const sim = prepare(s);
  tradeHere(s);
  const deltas = [];
  // Wave 10 E: waking is a one-minute short act, so the waking hour is wake + idle for the rest.
  for (const commands of [
    ['activity:idle_at_home'],
    ['work'],
    ['work'],
    ['activity:idle_at_home'],
    ['sleep'],
    ['wake', 'activity:idle_at_home'],
  ]) {
    const before = value(s);
    for (const command of commands) ask(s, command);
    deltas.push(value(s) - before);
  }
  expect(deltas[0]).toBe(-21);
  expect(deltas[1]).toBeLessThan(-21);
  expect(deltas[2]).toBe(deltas[1]);
  expect(deltas[3]).toBe(-21);
  expect(deltas[4]).toBeGreaterThan(0);
  expect(deltas[5]).toBe(-21);
  expect(findNonIntegers(sim.world)).toEqual([]);
});

it('A1 M6: eleven buys then work charges 55 leisure minutes and five work minutes', () => {
  const s = create();
  const sim = prepare(s),
    w = sim.world,
    pc = s.playerId;
  ask(s, 'go Pratt');
  ask(s, 'activity:idle_at_home');
  activity.setWorkplace(w, pc, required(w.actors[pc]).placeId);
  const before = value(s);
  for (let i = 0; i < 11; i++) ask(s, 'buy:beans_dry');
  expect(s.observe().minuteBudget.spent).toBe(55);
  const state = required(w.activity.byActor[pc]);
  const rate = (activityId: string) =>
    hourlyLedger(
      {
        ...w,
        activity: {
          ...w.activity,
          minuteBudgets: undefined,
          byActor: { ...w.activity.byActor, [pc]: { ...state, activityId } },
        },
      },
      sim.content,
      pc,
      'rest',
      55,
      65,
      required(w.needs.byActor[pc]).values,
    ).delta;
  const expected = Math.round((55 * rate('idle_at_home') + 5 * rate('work')) / 60);
  ask(s, 'work');
  expect(value(s) - before).toBe(expected);
  expect(value(s) - before).toBeGreaterThan(rate('work'));
});

it('A1 H1 meal: bought supper feeds within its own elapsed hour', () => {
  const s = create();
  const sim = prepare(s, 17);
  needs.satisfyNeed(sim.world, makeContext(sim.world, sim.content, []), s.playerId, 'hunger', -600, {
    label: 'Missed dinner',
  });
  const before = value(s, 'hunger');
  ask(s, 'meal');
  expect(value(s, 'hunger')).toBeGreaterThan(before);
  expect(sim.world.log.events.some((e) => e.kind === 'provisions.meal' && e.data.actorId === s.playerId)).toBe(true);
});

it('A2: rest recovers immediately after work without sending the actor home', () => {
  const s = create();
  prepare(s);
  ask(s, "go Haugen's Grist Mill");
  tradeHere(s);
  ask(s, 'work');
  const before = value(s),
    place = s.observe().place.id;
  ask(s, 'rest');
  expect(value(s)).toBeGreaterThan(before);
  expect(s.observe().place.id).toBe(place);
});

it.each(["Haugen's Grist Mill", 'Ferry Landing', "Dunleavy's Tavern"])(
  'A3 lodging off: sleep at %s camps in place and charges no bed',
  (place) => {
    const s = create();
    prepare(s, 17);
    ask(s, 'standing lodging off');
    if (!s.observe().place.name.includes(place)) ask(s, `go ${place}`);
    const at = s.observe().place.id;
    const r = ask(s, 'sleep');
    expect(r.observation.place.id).toBe(at);
    expect(r.observation.self.activity.asleep).toBe(true);
    expect(sessionSimOf(s).world.activity.byActor[s.playerId]?.activityId).toBe('sleep_rough');
    expect(r.observation.changes.money.filter((m) => /bed/i.test(m.reason))).toEqual([]);
  },
);

it('A3: standing eat cannot replace commanded sleep with cooking or drink carried whiskey asleep', () => {
  const s = create();
  const sim = prepare(s, 17),
    w = sim.world,
    pc = s.playerId;
  // QA session-k: go 4, buy whiskey, sleep; Greenhorn: sleep over the 18:00 meal.
  ask(s, 'buy whiskey');
  ask(s, 'standing eat on');
  needs.satisfyNeed(w, makeContext(w, sim.content, []), pc, 'hunger', -600, { label: 'Hungry bedtime' });
  const whiskey = Object.values(w.items.stacks).filter(
    (i) => i.defId === 'whiskey' && i.location.kind === 'actor' && i.location.actorId === pc,
  );
  const before = structuredClone(whiskey);
  ask(s, 'sleep');
  for (let i = 0; i < 3; i++) s.advance(60);
  expect(s.observe().self.activity.asleep).toBe(true);
  expect(whiskey).toEqual(before);
  expect(w.log.events.filter((e) => e.kind === 'provisions.meal' && e.data.actorId === pc)).toEqual([]);
});

it('A3 Explorer: sleep inside Hale farmhouse stays at Cedar Farm even with home at another site', () => {
  const s = create('iron_ford_neighbors');
  const sim = prepare(s, 18),
    w = sim.world,
    pc = s.playerId;
  const house = required(Object.values(w.places).find((p) => /Hale.*farmhouse/i.test(p.name)));
  expect(house).toBeDefined();
  // Isolate the reported destination state; travel itself is covered by the itinerary suite.
  required(w.actors[pc]).placeId = house.id;
  required(w.activity.byActor[pc]).placeId = house.id;
  activity.recomputeOccupancy(w);
  ask(s, 'standing lodging off');
  ask(s, 'sleep');
  expect(s.observe().place.id).toBe(house.id);
  expect(s.observe().self.activity.asleep).toBe(true);
});

it('A1/P2: NPC commanded work, sleep and waking use the same current-hour ledger', () => {
  const sim = simFor({ seed: 42 }),
    w = sim.world;
  const id = required(
    Object.values(w.actors).find((a) => a.alive && sim.content.occupations[a.occupationId]?.roles.includes('smith')),
  ).id;
  const ctx = makeContext(w, sim.content, []);
  needs.satisfyNeed(w, ctx, id, 'rest', -400, { label: 'Setup' });
  for (const activityId of ['work', 'sleep', 'idle_at_home']) {
    const before = needs.needValue(w, id, 'rest');
    step(sim, [{ kind: 'core.urge', actorId: id, data: { urge: { kind: 'activity', activityId } } }]);
    const after = needs.needValue(w, id, 'rest');
    if (activityId === 'sleep') expect(after).toBeGreaterThan(before);
    else expect(after).toBeLessThan(before);
  }
  expect(findNonIntegers(w)).toEqual([]);
});

it.each([7, 8])(
  'A2 Greenhorn: ten work hours, six evening hours and %i camp hours sustain Rest at starting load',
  (sleepHours) => {
    const s = create();
    ask(s, 'standing lodging off');
    ask(s, 'sleep');
    while (s.observe().time.t < 360) ask(s, 'wait 1h');
    ask(s, 'wake');
    const tradeAt = s.commandLog.length - 1;
    tradeHere(s);
    for (let i = 0; i < 10; i++) ask(s, 'work');
    expect(value(s)).toBeGreaterThanOrEqual(300);
    for (let i = 0; i < 6; i++) ask(s, 'activity:idle_at_home');
    expect(value(s)).toBeGreaterThanOrEqual(120);
    const sim = sessionSimOf(s),
      w = sim.world;
    expect(w.needs.byActor[s.playerId]?.debt?.rest ?? 0).toBe(0);
    ask(s, 'sleep');
    for (let i = 1; i < sleepHours; i++) ask(s, 'wait 1h');
    expect(value(s)).toBe(1000);
    expect(value(s, 'hunger')).toBeGreaterThan(300);
    expect(w.needs.byActor[s.playerId]?.survival?.collapsed).not.toBe(true);
    expect(replayWithTrade(s.commandLog, tradeAt).hash).toBe(s.hash);
  },
);
