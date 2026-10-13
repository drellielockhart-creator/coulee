import {
  activity,
  advanceUntil,
  asGameMinute,
  findNonIntegers,
  instantOf,
  makeContext,
  psyche,
  restoreSim,
  stateHash,
  TICKS_PER_HOUR,
  tactical,
} from '@coulee/core';
import { PlaySession, parseText, renderObservation, sessionSimOf } from '@coulee/play';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { baseContent } from './helpers.ts';

const content = baseContent();
function fixture() {
  const session = PlaySession.create(content, { source: 'tavern_instant', seed: 42 });
  const sim = sessionSimOf(session),
    id = session.playerId;
  return { session, sim, id };
}
function enter() {
  const x = fixture();
  const result = x.session.advance(60);
  expect(result.interrupts.some((i) => i.kind === 'tactical.danger')).toBe(true);
  return { ...x, result };
}
describe('M6 pause at a real instant', () => {
  it('fair content danger pauses before any action; queries do not change clock or roll', () => {
    const { session, sim, id, result } = enter();
    expect(result.elapsedTicks).toBe(0);
    expect(instantOf(sim.world)).toBe(0);
    expect(sim.world.tactical?.participants[id]?.action).toBeNull();
    expect(result.observation.tactical?.timeline).toContain('00:00:00.0');
    const hash = session.hash;
    session.observe();
    session.observe('god');
    expect(session.hash).toBe(hash);
    expect(renderObservation(session.observe())).toContain('awaiting your order');
    const text = JSON.stringify(result.observation.tactical);
    expect(text).not.toContain('readyAt');
    expect(text).not.toContain('participants');
    const npcs = Object.entries(sim.world.tactical?.participants ?? {}).filter(([actor]) => Number(actor) !== id);
    expect(npcs.some(([, p]) => p.action?.basis.kind === 'own')).toBe(true);
  });
  it('commanded PC guards only on Command; completion interrupts at recovery end and replay is exact', () => {
    const { session, sim, id } = enter();
    const command = parseText('guard', session.observe());
    expect(typeof command).not.toBe('string');
    const ordered = session.act(command);
    expect(ordered.ok).toBe(true);
    expect(ordered.elapsedTicks).toBe(0);
    const action = sim.world.tactical?.participants[id]?.action;
    expect(action?.basis.kind).toBe('command');
    const due = action?.recoverUntil;
    const completed = session.act({ kind: 'tactical.advance', actorId: id, data: { ticks: 100 } });
    expect(completed.ok).toBe(true);
    expect(instantOf(sim.world)).toBe(due);
    expect(sim.world.tactical?.participants[id]?.guarding).toBe(true);
    expect(completed.interrupts.some((i) => i.category === 'action')).toBe(true);
    const loaded = PlaySession.load(content, session.save());
    expect(loaded.hash).toBe(session.hash);
    expect(PlaySession.replay(content, session.commandLog).hash).toBe(session.hash);
  });
  it('saves at :59.9, midnight, and mid-recovery continue identically', () => {
    for (const cut of [599, 24 * TICKS_PER_HOUR, 24 * TICKS_PER_HOUR - 1]) {
      const { sim } = enter();
      advanceUntil(sim, cut);
      const restored = restoreSim(sim.content, JSON.parse(JSON.stringify(sim.world)));
      advanceUntil(sim, cut + 100);
      advanceUntil(restored, cut + 100);
      expect(stateHash(restored.world)).toBe(stateHash(sim.world));
      expect(findNonIntegers(sim.world)).toEqual([]);
    }
    const { session, sim, id } = enter();
    session.act({ kind: 'tactical.guard', actorId: id, data: {} });
    const action = sim.world.tactical?.participants[id]?.action;
    if (!action) throw Error('no action');
    advanceUntil(sim, action.due + 1);
    expect(sim.world.tactical?.participants[id]?.action?.phase).toBe('recovery');
    const restored = restoreSim(sim.content, JSON.parse(JSON.stringify(sim.world)));
    advanceUntil(sim, 100);
    advanceUntil(restored, 100);
    expect(stateHash(restored.world)).toBe(stateHash(sim.world));
  }, 30000);
  it(
    'partitioning elapsed intervals preserves needs, carries, boundary settlements and all state',
    () =>
      fc.assert(
        fc.property(fc.array(fc.integer({ min: 1, max: 600 }), { minLength: 1, maxLength: 10 }), (chunks) => {
          const { sim } = enter(),
            copy = restoreSim(sim.content, JSON.parse(JSON.stringify(sim.world)));
          const target = chunks.reduce((a, b) => a + b, 0);
          advanceUntil(sim, target);
          let at = 0;
          for (const part of chunks) {
            at += part;
            advanceUntil(copy, at);
          }
          expect(stateHash(copy.world)).toBe(stateHash(sim.world));
        }),
        { numRuns: 12 },
      ),
    30000,
  );
  it('near-threshold vital interrupts have query-independent event instants', () => {
    const { sim, id } = enter();
    const n = sim.world.needs.byActor[id];
    if (!n) throw Error('no needs');
    n.values.hunger = 600;
    const copy = restoreSim(sim.content, JSON.parse(JSON.stringify(sim.world)));
    advanceUntil(sim, 6000);
    for (let at = 100; at <= 6000; at += 100) advanceUntil(copy, at);
    expect(stateHash(copy.world)).toBe(stateHash(sim.world));
    const event = sim.world.log.events.find(
      (e) => e.kind === 'needs.band_changed' && e.data.actorId === id && e.data.needId === 'hunger',
    );
    expect(event?.tenth).toBeDefined();
  });
  it('background hourly work settles once at the boundary and never doubles live actors', () => {
    const { sim, id } = enter();
    const before = sim.world.log.lastId;
    advanceUntil(sim, TICKS_PER_HOUR - 1);
    expect(sim.world.log.events.filter((e) => e.id > before && e.kind === 'activity.moved')).toHaveLength(0);
    advanceUntil(sim, TICKS_PER_HOUR);
    const live = Object.keys(sim.world.tactical?.participants ?? {}).map(Number);
    expect(
      sim.world.log.events.filter((e) => e.id > before && e.kind === 'activity.moved' && live.includes(e.data.actorId)),
    ).toHaveLength(0);
    expect(
      sim.world.log.events.filter(
        (e) => e.id > before && e.kind === 'provisions.meal' && live.includes(e.data.actorId),
      ),
    ).toHaveLength(0);
    expect(sim.world.tactical?.frame?.elapsed[id]).toBe(TICKS_PER_HOUR);
    const count = sim.world.log.lastId;
    advanceUntil(sim, TICKS_PER_HOUR);
    expect(sim.world.log.lastId).toBe(count);
  });
  it('movement reserves before commitment, forbids collisions and cancellation retains recovery', () => {
    const { session, sim, id } = enter();
    const cmd = session.observe().actions.find((a) => a.command.kind === 'tactical.move')?.command;
    if (cmd?.kind !== 'tactical.move') throw Error('no move');
    const before = { ...activity.tacticalPosition(sim.world, id) };
    session.act(cmd);
    const a = sim.world.tactical?.participants[id]?.action;
    if (!a) throw Error('no move action');
    expect(activity.tacticalPosition(sim.world, id)).toEqual(before);
    expect(Object.keys(sim.world.tactical?.reservations ?? {})).toHaveLength(1);
    session.act({ kind: 'tactical.cancel', actorId: id, data: {} });
    expect(Object.keys(sim.world.tactical?.reservations ?? {})).toHaveLength(0);
    expect(sim.world.tactical?.participants[id]?.action?.recoverUntil).toBe(a.recoverUntil);
    expect(session.act({ kind: 'tactical.guard', actorId: id, data: {} }).ok).toBe(false);
    advanceUntil(sim, a.recoverUntil);
    expect(activity.tacticalPosition(sim.world, id)).toEqual(before);
    session.act(cmd);
    const next = sim.world.tactical?.participants[id]?.action;
    if (!next) throw Error('no second move');
    advanceUntil(sim, next.due);
    expect(activity.tacticalPosition(sim.world, id)).toMatchObject(cmd.data);
  });
  it('reservation contention never creates two owners, for either admission order', () =>
    fc.assert(
      fc.property(fc.boolean(), (reverse) => {
        const { sim, id } = enter();
        advanceUntil(sim, 100);
        const ids = Object.keys(sim.world.tactical?.participants ?? {}).map(Number) as (typeof id)[];
        const other = ids.find((x) => x !== id);
        if (!other) throw Error('no participant');
        const pos = activity.tacticalPosition(sim.world, id);
        if (!pos) throw Error('no cell');
        const y = pos.y + 2,
          x = pos.x;
        activity.moveTactical(sim.world, id, { x, y });
        activity.moveTactical(sim.world, other, { x: x + 2, y });
        const order = reverse ? [other, id] : [id, other],
          ctx = makeContext(sim.world, sim.content, []);
        const results = order.map((actor) =>
          tactical.startAction(
            sim.world,
            ctx,
            actor,
            'move',
            { kind: 'command', issuer: { kind: 'player' } },
            { x: x + 1, y },
          ),
        );
        expect(results).toEqual([true, false]);
        expect(Object.values(sim.world.tactical?.reservations ?? {})).toHaveLength(1);
        advanceUntil(sim, 200);
        const positions = ids.map((actor) => activity.tacticalPosition(sim.world, actor)).filter(Boolean);
        expect(new Set(positions.map((p) => `${p?.x},${p?.y}`)).size).toBe(positions.length);
      }),
      { numRuns: 4 },
    ));
  it('session save/replay in recovery retains exact command instants', () => {
    const { session, sim, id } = enter();
    session.act({ kind: 'tactical.guard', actorId: id, data: {} });
    const due = sim.world.tactical?.participants[id]?.action?.due;
    if (due === undefined) throw Error('no action');
    session.act({ kind: 'tactical.advance', actorId: id, data: { ticks: due + 1 } });
    expect(sim.world.tactical?.participants[id]?.action?.phase).toBe('recovery');
    const copy = PlaySession.load(content, session.save());
    const command = { kind: 'tactical.advance' as const, actorId: id, data: { ticks: 100 } };
    session.act(command);
    copy.act(command);
    expect(copy.hash).toBe(session.hash);
    expect(PlaySession.replay(content, session.commandLog).hash).toBe(session.hash);
  });
  it('revoked authorization cancels a queued physical commitment', () => {
    const { session, sim, id } = enter();
    const cmd = session.observe().actions.find((a) => a.command.kind === 'tactical.move')?.command;
    if (!cmd) throw Error('no move');
    session.act(cmd);
    const before = activity.tacticalPosition(sim.world, id),
      action = sim.world.tactical?.participants[id]?.action;
    if (!action) throw Error('no action');
    psyche.setAgency(sim.world, id, { ...psyche.agencyOf(sim.world, id), issuer: { kind: 'actor', id: 1 as never } });
    advanceUntil(sim, action.due);
    expect(activity.tacticalPosition(sim.world, id)).toEqual(before);
    expect(sim.world.tactical?.participants[id]?.action?.phase).toBe('recovery');
  });
  it('breathe preserves the open hour and forbids rounding a short scene to an hour', () => {
    const { session, sim, id } = enter();
    session.act({ kind: 'tactical.advance', actorId: id, data: { ticks: 60 } });
    expect(session.act({ kind: 'tactical.breathe', actorId: id, data: {} }).ok).toBe(true);
    expect(instantOf(sim.world)).toBe(60);
    advanceUntil(sim, TICKS_PER_HOUR);
    expect(sim.world.tactical?.frame?.elapsed[id]).toBe(TICKS_PER_HOUR);
    expect(sim.world.tactical?.frame?.phase).toBe('settled');
    expect(sim.world.log.events.filter((e) => e.kind === 'core.day_started')).toHaveLength(1);
  });
  it('only boundary admission and living colocated IDs; no own-action authorization for commanded sheets', () => {
    const { sim, id } = enter();
    expect(tactical.startAction(sim.world, makeContext(sim.world, sim.content, []), id, 'guard', { kind: 'own' })).toBe(
      false,
    );
    sim.world.time = asGameMinute(1);
    expect(
      tactical.requestEncounter(
        sim.world,
        makeContext(sim.world, sim.content, []),
        'other',
        sim.world.actors[id]?.placeId ?? (0 as never),
        [id],
        'danger',
      ),
    ).toBe(false);
  });
});
