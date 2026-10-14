import {
  activity,
  asGameMinute,
  type Command,
  findNonIntegers,
  hashString32,
  makeContext,
  mixKey,
  rng,
  social,
} from '@coulee/core';
import { PlaySession, parseText, sessionSimOf } from '@coulee/play';
import { expect, it } from 'vitest';
import { shortMinutes } from '../../play/src/minutes.ts';
import { baseContent } from './helpers.ts';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing test fixture');
  return value;
}

function ask(s: PlaySession, text: string) {
  const command = parseText(text, s.observe());
  if (typeof command === 'string') throw new Error(command);
  const result = s.act(command);
  expect(result.ok, result.reason).toBe(true);
  return result;
}
let noonSave: string | undefined;
function noon() {
  if (noonSave) return PlaySession.load(baseContent(), noonSave);
  const s = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
  while (s.observe().time.t < 720) s.advance(60);
  noonSave = s.save();
  return s;
}
function order(s: PlaySession, activityId: string) {
  const result = s.act({ kind: 'core.urge', actorId: s.playerId, data: { urge: { kind: 'activity', activityId } } });
  expect(result.ok, result.reason).toBe(true);
  return result;
}
function values(s: PlaySession) {
  const n = sessionSimOf(s).world.needs.byActor[s.playerId];
  return { hunger: n?.values.hunger, rest: n?.values.rest };
}
function roundTrip(s: PlaySession) {
  const home = s.observe().place.id;
  ask(s, 'go Main Street');
  const result = s.act({
    kind: 'core.urge',
    actorId: s.playerId,
    data: { urge: { kind: 'activity', activityId: 'walk', placeId: home } },
  });
  expect(result.ok, result.reason).toBe(true);
}

it('noon chopping charges immediately; a subsequent short walk adds only its own minutes', () => {
  const reference = noon();
  const walked = reference.fork(),
    idle = reference.fork();
  order(reference, 'chop_wood');
  order(walked, 'chop_wood');
  order(idle, 'idle_at_home');
  ask(walked, 'go Main Street');
  ask(idle, 'go Main Street');
  reference.advance(60);
  walked.advance(60);
  idle.advance(60);
  expect(Math.abs(required(values(walked).rest) - required(values(reference).rest))).toBeLessThanOrEqual(2);
  expect(values(walked).hunger).toBeLessThan(required(values(idle).hunger));
  expect(values(walked).rest).toBeLessThan(required(values(idle).rest));
});

it('round trips replace a few minutes of work or sleep instead of preserving a lagged charge', () => {
  const reference = noon();
  const walked = reference.fork();
  const differences: number[] = [];
  for (const next of ['chop_wood', 'idle_at_home', 'chop_wood', 'sleep']) {
    roundTrip(walked);
    const beforeReference = required(values(reference).rest);
    const beforeWalked = required(values(walked).rest);
    order(reference, next);
    order(walked, next);
    const difference =
      required(values(walked).rest) - beforeWalked - (required(values(reference).rest) - beforeReference);
    differences.push(difference);
    expect(Math.abs(difference)).toBeLessThanOrEqual(15);
  }
  expect(differences[0]).toBeGreaterThan(0); // Walking replaces heavier chopping minutes.
  expect(differences[3]).toBeLessThan(0); // Walking replaces restorative sleeping minutes.
  expect(findNonIntegers(sessionSimOf(walked).world)).toEqual([]);
});

// Wave 10 D7 permits transactions during a market visit (economy-wave10.test.ts).
it.each(['cooking', 'travel', 'journey'])(
  'buy and sell preserve a %s lock and cannot unlock a work activity or spend any minutes',
  (kind) => {
    const s = noon();
    ask(s, 'go Pratt');
    ask(s, 'buy hardtack 1');
    s.advance(60);
    const sim = sessionSimOf(s),
      w = sim.world,
      pc = s.playerId;
    const state = required(w.activity.byActor[pc]);
    if (kind === 'cooking') activity.reservePreparation(w, makeContext(w, sim.content, []), pc, 120);
    if (kind === 'travel')
      state.travel = { from: state.placeId, to: state.placeId, arrive: asGameMinute(w.time + 120) };
    if (kind === 'journey')
      w.activity.journeys = {
        [pc]: {
          leader: pc,
          memberIds: [pc],
          transport: null,
          legs: [],
          segment: 0,
          feet: 0,
          remainder: 0,
          originNodeId: 'town',
          destinationNodeId: 'road',
          originEntrance: state.placeId,
          destinationEntrance: state.placeId,
          startedAt: w.time,
          dailyWalkingMinutes: 0,
          walkingDay: 0,
          campUntil: null,
          status: 'walking',
          campPolicy: 'ask',
          basis: { kind: 'command', issuer: { kind: 'player' } },
          pendingInterruption: null,
        },
      };
    const stack = required(
      Object.values(w.items.stacks).find(
        (i) => i.defId === 'hardtack' && i.location.kind === 'actor' && i.location.actorId === pc,
      ),
    );
    const commands: Command[] = [
      {
        kind: 'provisions.buy',
        actorId: pc,
        data: { placeId: state.placeId, defId: 'hardtack', qty: 1, onCredit: false },
      },
      { kind: 'provisions.sell', actorId: pc, data: { placeId: state.placeId, itemId: stack.id, qty: 1 } },
    ];
    const before = s.hash;
    for (const command of commands) {
      expect(shortMinutes(sim, command)).toBeNull();
      const result = s.act(command);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/still|journey/);
      expect(result.elapsedMinutes).toBe(0);
      expect(s.hash).toBe(before);
      activity.shortAct(w, makeContext(w, sim.content, [command]), pc, 5);
      expect(s.hash).toBe(before);
    }
    if (kind === 'cooking') {
      expect(
        s.act({ kind: 'core.urge', actorId: pc, data: { urge: { kind: 'activity', activityId: 'chop_wood' } } }).ok,
      ).toBe(false);
    }
  },
);

function conversation() {
  const s = noon(),
    sim = sessionSimOf(s),
    w = sim.world;
  const target = required(Object.values(w.actors).find((a) => a.id !== s.playerId && a.alive));
  // Keep this real Iron Ford pair in one venue so availability, not schedule movement, is tested.
  target.placeId = required(w.actors[s.playerId]).placeId;
  Object.assign(required(w.activity.byActor[target.id]), {
    placeId: target.placeId,
    activityId: 'idle_at_home',
    travel: null,
    lockedUntil: null,
  });
  activity.recomputeOccupancy(w);
  const command = (interactionId: string): Command => ({
    kind: 'core.urge',
    actorId: s.playerId,
    data: { urge: { kind: 'interaction', interactionId, targetId: target.id } },
  });
  return { s, sim, w, target, command };
}

it.each(['chat', 'ask_about'])(
  'repeated %s cannot multiply company, familiarity or rumor transfer within an hour',
  (interaction) => {
    const { s, w, target, command } = conversation();
    if (interaction === 'ask_about') expect(s.act(command('chat')).ok).toBe(true);
    const first = s.act(command(interaction));
    expect(first.ok, first.reason).toBe(true);
    const before = s.hash;
    for (let n = 0; n < 5; n++) {
      const result = s.act(command(interaction));
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('this hour');
      expect(result.elapsedMinutes).toBe(0);
      expect(s.hash).toBe(before);
    }
    const saved = PlaySession.load(baseContent(), s.save());
    expect(saved.act(command(interaction)).ok).toBe(false);
    expect(social.interactionAvailability(w, sessionSimOf(s).content, target.id, s.playerId, interaction).ok).toBe(
      false,
    );
    s.advance(60);
    expect(
      social.interactionAvailability(w, sessionSimOf(s).content, s.playerId, target.id, interaction).reason ?? '',
    ).not.toContain('this hour');
  },
);

it('a working neighbor shares one talk allowance across different chats and speakers', () => {
  const { s, sim, w, target, command } = conversation();
  required(w.activity.byActor[target.id]).activityId = 'chop_wood';
  expect(s.act(command('chat')).ok).toBe(true);
  const before = s.hash;
  const result = s.act(command('ask_about'));
  expect(result.ok).toBe(false);
  expect(result.reason).toContain('no more time for talk');
  expect(s.hash).toBe(before);
  const other = required(Object.values(w.actors).find((a) => a.id !== target.id && a.id !== s.playerId));
  other.placeId = target.placeId;
  expect(social.interactionAvailability(w, sim.content, other.id, target.id, 'chat').reason).toContain(
    'no more time for talk',
  );
});

it('the first short social check draws at minute one, separate from the hourly boundary', () => {
  const { s, sim, w, target, command } = conversation();
  sim.content = structuredClone(sim.content);
  required(sim.content.interactions.chat).check = { kind: 'dc', skill: 'perform_preaching', dc: 10, attitude: false };
  const at = w.time,
    key = mixKey(s.playerId, target.id, hashString32('chat'), 0x50c1a1);
  expect(s.observe().minuteBudget.spent).toBe(0);
  expect(s.act(command('chat')).ok).toBe(true);
  const event = w.log.events.findLast((e) => e.kind === 'social.interaction' && e.data.initiatorId === s.playerId);
  expect(event?.explain?.roll?.natural).toBe(rng(42, 'social', asGameMinute(at + 1), key).int(1, 20));
  expect(event?.explain?.roll?.natural).not.toBe(rng(42, 'social', asGameMinute(at), key).int(1, 20));
});

it.each(['steal_goods', 'take', 'threaten', 'lend', 'borrow', 'demand_return', 'fight'])(
  '%s retains hourly resolution unless content explicitly opts in',
  (interactionId) => {
    const { sim, command } = conversation();
    expect(sim.content.interactions[interactionId]).toBeDefined();
    expect(shortMinutes(sim, command(interactionId))).toBeNull();
  },
);

it('a threat at noon takes the hourly path instead of the default ten-minute chat path', () => {
  const { s, command } = conversation();
  const result = s.act(command('threaten'));
  expect(result.ok, result.reason).toBe(true);
  expect(result.elapsedMinutes).toBe(60);
  expect(result.observation.time.t).toBe(780);
});

it('NPC boundary resolution cannot repeat a short exchange with the same pair', () => {
  const { s, sim, w, target, command } = conversation();
  expect(s.act(command('chat')).ok).toBe(true);
  const needsBefore = structuredClone(w.needs);
  const familiarity = social.familiarityOf(w, target.id, s.playerId);
  const result = social.resolveInteraction(w, makeContext(w, sim.content, []), {
    def: required(sim.content.interactions.chat),
    initiatorId: target.id,
    targetId: s.playerId,
    placeId: target.placeId,
    present: [],
    mode: 'spontaneous',
    via: 'encounter',
  });
  expect(result.success).toBe(false);
  expect(w.log.events.find((e) => e.id === result.eventId)?.kind).toBe('social.act_refused');
  expect(w.needs).toEqual(needsBefore);
  expect(social.familiarityOf(w, target.id, s.playerId)).toBe(familiarity);
});
