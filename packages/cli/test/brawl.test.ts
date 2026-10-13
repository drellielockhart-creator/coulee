import {
  activity,
  advanceUntil,
  asActorId,
  findNonIntegers,
  instantOf,
  makeContext,
  needs,
  psyche,
  restoreSim,
  social,
  stateHash,
  tactical,
} from '@coulee/core';
import { PlaySession, parseText, sessionSimOf } from '@coulee/play';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { activeBrawls, movementReactions } from '../../core/src/tactical/brawl.ts';
import { meleeCheck } from '../../core/src/tactical/rules.ts';
import { baseContent } from './helpers.ts';

const content = baseContent();
function fixture(seed = 42) {
  const session = PlaySession.create(content, { source: 'tavern_instant', seed });
  const sim = sessionSimOf(session),
    id = session.playerId;
  session.advance(60);
  advanceUntil(sim, 100);
  const target = session.observe().actions.find((a) => a.command.kind === 'tactical.attack')?.command;
  if (target?.kind !== 'tactical.attack') throw Error('no adjacent target');
  const other = target.data.targetId;
  const ctx = () => makeContext(sim.world, content, []);
  const finish = (actor = id) => {
    const a = sim.world.tactical?.participants[actor]?.action;
    if (a) advanceUntil(sim, a.recoverUntil);
  };
  const command = (actor: typeof id, kind: tactical.Action['kind'], targetId?: typeof id) =>
    tactical.startAction(
      sim.world,
      ctx(),
      actor,
      kind,
      { kind: 'command', issuer: { kind: 'player' } },
      undefined,
      targetId,
    );
  const controlled = () =>
    psyche.setAgency(sim.world, other, { ...psyche.agencyOf(sim.world, id), issuer: { kind: 'player' } });
  return { session, sim, id, other, ctx, finish, command, controlled };
}

describe('M6 a brawl with an ending', () => {
  it('authored fair fixture exposes joining and peacemaking before NPC windups, with no agency or condition leaks', () => {
    for (const seed of [1, 7, 42, 117, 811]) {
      const session = PlaySession.create(content, { source: 'tavern_brawl', seed });
      const result = session.advance(60),
        sim = sessionSimOf(session);
      expect(result.elapsedTicks).toBe(0);
      expect(session.observe().actions.some((a) => a.id === 'tactical:parley')).toBe(true);
      const attack = parseText('attack Joel', session.observe());
      expect(typeof attack).not.toBe('string');
      expect(session.act(attack).ok).toBe(true);
      expect(activeBrawls(sim.world)).toHaveLength(2);
      advanceUntil(sim, 3000);
      const conditions = Object.values(sim.world.actors).flatMap((a) => a.sheet.conditions.map((c) => `${a.id}:${c}`));
      expect(new Set(conditions).size).toBe(conditions.length);
      expect(Object.values(sim.world.actors).every((a) => a.alive)).toBe(true);
      expect(findNonIntegers(sim.world)).toEqual([]);
    }
  });
  it('a granted movement reaction commits before the departing step and cannot repeat inside its cooldown', () => {
    const x = fixture();
    x.controlled();
    x.command(x.other, 'attack', x.id);
    x.finish(x.other);
    x.command(x.id, 'reaction');
    x.finish();
    expect(x.command(x.other, 'flee')).toBe(true);
    const scene = x.sim.world.tactical;
    const reaction = scene?.participants[x.id]?.action,
      move = scene?.participants[x.other]?.action;
    if (!reaction || !move) throw Error('missing reaction or departure');
    expect(reaction.fromReaction).toBe(true);
    expect(reaction.due).toBeLessThan(move.due);
    const before = x.sim.world.log.lastId;
    advanceUntil(x.sim, reaction.due);
    expect(
      x.sim.world.log.events.some((e) => e.id > before && e.kind === 'tactical.blow' && e.data.actorId === x.id),
    ).toBe(true);
    expect(scene?.participants[x.id]?.reaction?.remaining).toBe(0);
  });

  it('idle commanded actors never retaliate, surrender or flee by themselves', () => {
    const x = fixture();
    expect(tactical.startAction(x.sim.world, x.ctx(), x.other, 'attack', { kind: 'own' }, undefined, x.id)).toBe(true);
    advanceUntil(x.sim, 1000);
    expect(x.sim.world.log.events.filter((e) => e.kind === 'tactical.blow' && e.data.actorId === x.id)).toEqual([]);
    expect(x.sim.world.tactical?.participants[x.id]?.submitted).not.toBe(true);
    expect(x.sim.world.tactical?.participants[x.id]?.fled).not.toBe(true);
    expect(x.sim.world.tactical?.participants[x.id]?.action).toBeNull();
  });
  it('revoked issuers cannot land queued attacks', () => {
    const x = fixture();
    x.controlled();
    expect(x.command(x.id, 'attack', x.other)).toBe(true);
    psyche.setAgency(x.sim.world, x.id, {
      ...psyche.agencyOf(x.sim.world, x.id),
      issuer: { kind: 'actor', id: x.other },
    });
    x.finish();
    expect(x.sim.world.log.events.some((e) => e.kind === 'tactical.blow')).toBe(false);
    expect(needs.healthOf(x.sim.world, x.other)).toBeUndefined();
  });
  it('submission stops queued blows and acceptance stamps one lasting pair outcome', () => {
    const x = fixture();
    x.controlled();
    expect(x.command(x.id, 'attack', x.other)).toBe(true);
    x.finish();
    expect(x.command(x.id, 'attack', x.other)).toBe(true);
    expect(x.command(x.other, 'yield')).toBe(true);
    x.finish(x.other);
    x.finish();
    const before = x.sim.world.log.events.filter((e) => e.kind === 'tactical.blow').length;
    expect(before).toBe(1);
    expect(x.command(x.id, 'attack', x.other)).toBe(false);
    expect(x.command(x.id, 'accept', x.other)).toBe(true);
    x.finish();
    expect(activeBrawls(x.sim.world)).toHaveLength(0);
    expect(social.strifeCount(x.sim.world, content, x.id, x.other, x.sim.world.time)).toBe(1);
    expect(Object.keys(x.sim.world.social.combatIncidents ?? {})).toHaveLength(1);
    expect(
      x.sim.world.chronicle.entries.filter((e) =>
        e.sourceEventIds.some((id) => id === x.sim.world.log.events.find((ev) => ev.kind === 'tactical.outcome')?.id),
      ),
    ).toHaveLength(1);
    const opinion = social.opinionOf(x.sim.world, x.other, x.id);
    expect(opinion.fear).toBeGreaterThan(0);
    const count = x.sim.world.log.lastId;
    advanceUntil(x.sim, instantOf(x.sim.world) + 1000);
    expect(x.sim.world.log.events.filter((e) => e.id > count && e.kind === 'tactical.blow')).toHaveLength(0);
    expect(social.strifeCount(x.sim.world, content, x.id, x.other, x.sim.world.time)).toBe(1);
  });
  it('grapple advances Grabbed → Held → Pinned, never duplicates conditions, and permits escape', () => {
    const x = fixture();
    x.controlled();
    const actor = x.sim.world.actors[x.id];
    if (!actor) throw Error('no actor');
    actor.sheet.combat = { attack: 100, grappleSize: 0 };
    for (const condition of ['grabbed', 'held', 'pinned']) {
      expect(x.command(x.id, 'grapple', x.other)).toBe(true);
      x.finish();
      const conditions = x.sim.world.actors[x.other]?.sheet.conditions ?? [];
      expect(conditions.filter((c) => ['grabbed', 'held', 'pinned'].includes(c))).toEqual([condition]);
      expect(new Set(conditions).size).toBe(conditions.length);
    }
    expect(x.command(x.other, 'attack', x.id)).toBe(false);
    expect(x.command(x.other, 'flee')).toBe(false);
    expect(x.command(x.id, 'escape')).toBe(true);
    x.finish();
    expect(x.sim.world.tactical?.grapples).toEqual([]);
    expect(x.sim.world.actors[x.other]?.sheet.conditions).not.toContain('pinned');
  });
  it('fear transitions are idempotent and cannot commandeer an actor', () => {
    const x = fixture();
    const before = psyche.anxietyOf(x.sim.world, x.id);
    for (let n = 0; n < 20; n++) psyche.brawlFear(x.sim.world, x.ctx(), x.id, 1, 'first blow');
    expect(x.sim.world.psyche.byActor[x.id]?.combatFear?.triggers).toHaveLength(1);
    expect(psyche.anxietyOf(x.sim.world, x.id) - before).toBeLessThanOrEqual(200);
    expect(x.sim.world.tactical?.participants[x.id]?.action).toBeNull();
    expect(findNonIntegers(x.sim.world)).toEqual([]);
  });
  it('cancel never refunds recovery or allows a zero-time action loop (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 16 }), (ticks) => {
        const x = fixture();
        x.controlled();
        x.command(x.id, 'attack', x.other);
        const action = x.sim.world.tactical?.participants[x.id]?.action;
        if (!action) throw Error('missing action');
        advanceUntil(x.sim, instantOf(x.sim.world) + ticks);
        tactical.cancelAction(x.sim.world, x.ctx(), x.id);
        for (let n = 0; n < 10; n++) expect(x.command(x.id, 'attack', x.other)).toBe(false);
        expect(x.sim.world.tactical?.participants[x.id]?.action?.recoverUntil).toBe(action.recoverUntil);
        x.finish();
        expect(x.sim.world.log.events.some((e) => e.kind === 'tactical.blow')).toBe(false);
      }),
      { numRuns: 8 },
    );
  });
  it('explicit bounded reactions consume their grant at declaration, retain cooldown through cancellation/regrant, and honor revocation', () => {
    const x = fixture();
    x.controlled();
    x.command(x.other, 'attack', x.id);
    x.finish(x.other);
    expect(x.command(x.id, 'reaction')).toBe(true);
    x.finish();
    const p = x.sim.world.tactical?.participants[x.id];
    if (!p) throw Error('no participant');
    movementReactions(x.sim.world, x.ctx(), x.other);
    expect(p.reaction?.remaining).toBe(0);
    expect(p.action?.fromReaction).toBe(true);
    const cooldown = p.reactionAt;
    tactical.commandTactical(x.sim.world, x.ctx(), { kind: 'tactical.reaction', actorId: x.id, data: { count: 0 } });
    expect(p.action?.cancelled).toBe(true);
    expect(
      tactical.tacticalCommandCheck(x.sim.world, content, {
        kind: 'tactical.reaction',
        actorId: x.id,
        data: { count: 0 },
      }),
    ).toBe('No defensive reaction to revoke');
    x.finish();
    x.command(x.id, 'reaction');
    x.finish();
    expect(p.reactionAt).toBe(cooldown);
    movementReactions(x.sim.world, x.ctx(), x.other);
    expect(p.action).toBeNull();
  });
  it('flight pays for each reachable cell, crosses a real door, and survives mid-route saves', () => {
    const x = fixture();
    expect(x.command(x.id, 'flee')).toBe(true);
    const initial = { ...activity.tacticalPosition(x.sim.world, x.id) };
    const copy = restoreSim(x.sim.content, JSON.parse(JSON.stringify(x.sim.world)));
    expect(activity.tacticalPosition(x.sim.world, x.id)).toEqual(initial);
    advanceUntil(x.sim, 1000);
    advanceUntil(copy, 1000);
    expect(stateHash(copy.world)).toBe(stateHash(x.sim.world));
    expect(x.sim.world.tactical?.participants[x.id]?.fled).toBe(true);
    expect(x.sim.world.places[x.sim.world.actors[x.id]?.placeId ?? 0]?.defId).toBe('main_street');
  });
  it('an NPC can be joined or a brawl broken up without commanding its participants', () => {
    const x = fixture();
    const s = x.sim.world.tactical;
    if (!s) throw Error('no scene');
    const actors = Object.keys(s.participants)
      .map((id) => asActorId(Number(id)))
      .filter((id) => id !== x.id);
    const a = actors[0],
      b = actors[1];
    if (!a || !b) throw Error('no actors');
    tactical.startAction(x.sim.world, x.ctx(), a, 'attack', { kind: 'own' }, undefined, b);
    expect(activeBrawls(x.sim.world)).toHaveLength(1);
    // Joining is an ordinary adjacent attack; its identity remains a separate pair.
    expect(x.command(x.id, 'attack', x.other)).toBe(true);
    x.finish();
    const pc = x.sim.world.actors[x.id];
    if (!pc) throw Error('no pc');
    pc.sheet.skills.persuade = 100;
    expect(x.command(x.id, 'parley')).toBe(true);
    x.finish();
    expect(activeBrawls(x.sim.world)).toHaveLength(0);
  });
  it('fair headless melee saves/replays exactly and never exposes enemy modifiers or initiative', () => {
    const session = PlaySession.create(content, { source: 'tavern_instant', seed: 7 });
    session.advance(60);
    const attack = session.observe().actions.find((a) => a.command.kind === 'tactical.attack');
    if (!attack) throw Error('no target');
    expect(session.act(attack.command).ok).toBe(true);
    for (let n = 0; n < 4; n++) session.act(parseText('resume', session.observe()));
    const oldLog = session.commandLog;
    oldLog[0].rulesVersion = 1;
    expect(() => PlaySession.replay(content, oldLog)).toThrow('Unsupported replay rules version');
    const copy = PlaySession.load(content, session.save());
    expect(copy.hash).toBe(session.hash);
    expect(PlaySession.replay(content, session.commandLog).hash).toBe(session.hash);
    const fair = session.observe();
    expect(JSON.stringify(fair.tactical)).not.toMatch(/readyAt|participants|issuer/);
    const sim = sessionSimOf(session);
    const event = sim.world.log.events.find((e) => e.kind === 'tactical.blow');
    expect(event?.explain?.knowledge).toBe('public');
    expect(event?.explain?.dc).toBeUndefined();
    expect(event?.explain?.children?.[0]?.knowledge).toBe('omniscient');
  });
  it('all unarmed hits remain nonlethal across a table of seeds; criticals produce only light nonbleeding bruises', () => {
    const x = fixture();
    x.controlled();
    let hits = 0,
      misses = 0,
      criticals = 0;
    for (let token = 1; token <= 300; token++) {
      const result = meleeCheck(x.sim.world, x.ctx(), x.id, x.other, token);
      if (result.hit) hits++;
      else misses++;
      if (result.critical) criticals++;
      expect(Number.isInteger(result.damage)).toBe(true);
      expect(result.damage).toBeGreaterThanOrEqual(0);
      expect(result.hit).toBe(result.damage > 0);
      const natural = result.explain.children?.[0]?.roll?.natural;
      if (natural === 1) expect(result.hit).toBe(false);
      if (natural === 20) expect(result.hit).toBe(true);
    }
    expect(hits).toBeGreaterThan(0);
    expect(misses).toBeGreaterThan(0);
    expect(criticals).toBeGreaterThan(0);
  });
  it('Dying saves start one minute from injury, stabilize costs a minute, and neither hunger relief nor reload clears incapacity', () => {
    const x = fixture();
    x.controlled();
    for (let n = 0; n < 4; n++) needs.applyHit(x.sim.world, x.ctx(), x.other, 20, { nonlethal: false });
    const h = needs.healthOf(x.sim.world, x.other);
    if (!h) throw Error('no health');
    expect(h.dying).toBe(true);
    expect(h.nextDying).toBe(700);
    expect(needs.canAct(x.sim.world, x.other)).toBe(false);
    const a = x.sim.world.actors[x.id];
    if (!a) throw Error('no actor');
    a.sheet.skills.medicine = 100;
    expect(x.command(x.id, 'stabilize', x.other)).toBe(true);
    advanceUntil(x.sim, 699);
    expect(h.dying).toBe(true);
    expect(h.failures).toBe(0);
    const copy = restoreSim(x.sim.content, JSON.parse(JSON.stringify(x.sim.world)));
    advanceUntil(x.sim, 1000);
    advanceUntil(copy, 1000);
    expect(h.stable).toBe(true);
    expect(h.dying).toBe(false);
    expect(h.nextDying).toBeNull();
    expect(needs.canAct(x.sim.world, x.other)).toBe(false);
    expect(stateHash(copy.world)).toBe(stateHash(x.sim.world));
    expect(findNonIntegers(x.sim.world)).toEqual([]);
  });
  it('three accumulated failed Dying saves use the ordinary death path with a combat cause', () => {
    const x = fixture();
    x.controlled();
    for (let n = 0; n < 4; n++) needs.applyHit(x.sim.world, x.ctx(), x.id, 20, { nonlethal: false });
    advanceUntil(x.sim, 20000);
    expect(x.sim.world.actors[x.id]?.alive).toBe(false);
    expect(x.sim.world.needs.byActor[x.id]?.survival?.death?.cause).toBe('combat injuries');
    expect(needs.healthOf(x.sim.world, x.id)?.dying).toBe(false);
    expect(needs.nextCombatHealthInstant(x.sim.world)).toBeUndefined();
    expect(x.sim.world.log.events.filter((e) => e.kind === 'needs.died' && e.data.actorId === x.id)).toHaveLength(1);
    expect(findNonIntegers(x.sim.world)).toEqual([]);
  });
});
