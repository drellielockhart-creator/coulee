import {
  activity,
  advanceUntil,
  findNonIntegers,
  instantOf,
  makeContext,
  needs,
  psyche,
  restoreSim,
  social,
  stateHash,
  step,
  tactical,
  visibleExplain,
} from '@coulee/core';
import { PlaySession, parseText, renderDetail, renderObservation, sessionSimOf } from '@coulee/play';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { activeBrawls, decideBrawl, movementReactions } from '../../core/src/tactical/brawl.ts';
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
      expect(activeBrawls(sim.world)).toHaveLength(1); // The joining windup is still cancellable.
      const due = sim.world.tactical?.participants[session.playerId]?.action?.due;
      if (due === undefined) throw Error('No joining windup');
      advanceUntil(sim, due);
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
  it('fair headless melee saves/replays exactly and never exposes enemy modifiers or initiative', () => {
    const session = PlaySession.create(content, { source: 'tavern_instant', seed: 7 });
    session.advance(60);
    const attack = session.observe().actions.find((a) => a.command.kind === 'tactical.attack');
    if (!attack) throw Error('no target');
    expect(session.act(attack.command).ok).toBe(true);
    for (let n = 0; n < 4; n++) session.act(parseText('resume', session.observe()));
    const oldLog = session.commandLog;
    expect(oldLog[0].rulesVersion).toBe(5);
    for (const version of [1, 2, 3, 4]) {
      oldLog[0].rulesVersion = version;
      expect(() => PlaySession.replay(content, oldLog)).toThrow('Unsupported replay rules version');
    }
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

describe('M6 cross-model review regressions (rv-a through rv-g)', () => {
  it.each(['idle', 'flee'] as const)('every tavern brawl ends and the player can leave: %s, seeds 1–300', (policy) => {
    // rv-a/rv-c; includes mutual-yield seeds 65/145/165, blocked route 209 and idle 39.
    for (let seed = 1; seed <= 300; seed++) {
      const session = PlaySession.create(content, { source: 'tavern_brawl', seed });
      session.advance(60);
      const sim = sessionSimOf(session),
        pc = session.playerId,
        scene = sim.world.tactical;
      if (!scene) throw Error('no scene');
      for (let n = 0; n < 600; n++) {
        const p = scene.participants[pc];
        if (policy === 'flee' && p && !p.fled && !p.action)
          advanceUntil(sim, instantOf(sim.world), [{ kind: 'tactical.flee', actorId: pc, data: {} }]);
        const next = scene.heap[0]?.instant;
        if (next === undefined) break;
        advanceUntil(sim, next);
      }
      expect(activeBrawls(sim.world), `seed ${seed}, ${policy}`).toHaveLength(0);
      expect(instantOf(sim.world)).toBeLessThan(6000);
      advanceUntil(sim, instantOf(sim.world) + 60);
      expect(session.act({ kind: 'tactical.breathe', actorId: pc, data: {} }).ok, `seed ${seed}`).toBe(true);
      expect(sim.world.tactical).toBeUndefined();
      expect(session.observe().tactical).toBeNull();
    }
  });
  it('mutual submission ends in peace even when both yields are already winding up', () => {
    const x = fixture(65);
    x.controlled();
    x.command(x.id, 'attack', x.other);
    x.finish();
    expect(x.command(x.id, 'yield')).toBe(true);
    expect(x.command(x.other, 'yield')).toBe(true);
    advanceUntil(x.sim, instantOf(x.sim.world) + 30);
    expect(x.sim.world.tactical?.brawls?.[0]?.outcome).toBe('peace');
  });
  it('a fled player can breathe while remote fighters continue, and background saves resume exactly', () => {
    const session = PlaySession.create(content, { source: 'tavern_brawl', seed: 3 });
    session.advance(60);
    const sim = sessionSimOf(session),
      pc = session.playerId;
    advanceUntil(sim, 0, [{ kind: 'tactical.flee', actorId: pc, data: {} }]);
    const scene = sim.world.tactical;
    if (!scene) throw Error('no scene');
    for (let n = 0; n < 100 && !scene.participants[pc]?.fled; n++) {
      const next = scene.heap[0]?.instant;
      if (next === undefined) throw Error('route stopped');
      advanceUntil(sim, next);
    }
    const p = scene.participants[pc];
    if (!p?.fled) throw Error('did not flee');
    advanceUntil(sim, (p.action?.recoverUntil ?? p.readyAt) + 60);
    expect(activeBrawls(sim.world)).toHaveLength(1);
    expect(scene.heap.length).toBeGreaterThan(0);
    expect(session.act({ kind: 'tactical.breathe', actorId: pc, data: {} }).ok).toBe(true);
    expect(sim.world.tactical).toBeUndefined();
    expect(sim.world.activity.byActor[pc]?.activityId).toBeNull();
    const copy = restoreSim(sim.content, JSON.parse(JSON.stringify(sim.world)));
    advanceUntil(sim, instantOf(sim.world) + 600);
    advanceUntil(copy, instantOf(copy.world) + 600);
    expect(stateHash(copy.world)).toBe(stateHash(sim.world));
    expect(sim.world.backgroundTactical?.brawls?.every((b) => b.endedAt !== undefined)).toBe(true);
    expect(session.act({ kind: 'activity.wait', actorId: pc, data: { minutes: 60 } }).ok).toBe(true);
    expect(sim.world.tactical).toBeUndefined();
  });
  it('attack then parley is an offer: a healthy NPC refuses even a successful Persuade check', () => {
    const x = fixture(12);
    x.controlled();
    const other = x.sim.world.actors[x.other],
      pc = x.sim.world.actors[x.id];
    if (!other || !pc) throw Error('missing actor');
    other.sheet.abilities.con = 30;
    pc.sheet.skills.persuade = 100;
    x.command(x.id, 'attack', x.other);
    x.finish();
    psyche.setAgency(x.sim.world, x.other, { ...psyche.agencyOf(x.sim.world, x.other), mode: 'psyche' });
    expect(x.command(x.id, 'parley')).toBe(true);
    x.finish();
    expect(activeBrawls(x.sim.world)).toHaveLength(1);
    expect(
      x.sim.world.log.events.some((e) => e.explain?.label === 'Offer peace' && e.explain.outcome === 'success'),
    ).toBe(true);
    expect(
      x.sim.world.log.events.some(
        (e) => e.kind === 'tactical.morale' && e.data.actorId === x.other && e.explain?.outcome === 'attack',
      ),
    ).toBe(true);
  });
  it('parley respects a willing NPC and never speaks for a commanded opponent', () => {
    const x = fixture(12);
    x.controlled();
    const pc = x.sim.world.actors[x.id];
    if (!pc) throw Error('no pc');
    pc.sheet.skills.persuade = 100;
    x.command(x.id, 'attack', x.other);
    x.finish();
    needs.applyHit(
      x.sim.world,
      x.ctx(),
      x.other,
      Math.max(0, 4 - (needs.healthOf(x.sim.world, x.other)?.nonlethal ?? 0)),
    );
    expect(x.command(x.id, 'parley')).toBe(true);
    x.finish();
    expect(activeBrawls(x.sim.world)).toHaveLength(1);
    psyche.setAgency(x.sim.world, x.other, { ...psyche.agencyOf(x.sim.world, x.other), mode: 'psyche' });
    expect(x.command(x.id, 'parley')).toBe(true);
    x.finish();
    expect(activeBrawls(x.sim.world)).toHaveLength(0);
  });
  it('repeat episodes stamp strife once per pair per scene, with directional opinions and bounded archives', () => {
    const x = fixture(12);
    x.controlled();
    const scene = x.sim.world.tactical;
    if (!scene) throw Error('no scene');
    const patient = x.sim.world.actors[x.other],
      health = needs.survivalOf(x.sim.world, content, x.other);
    if (!patient || !health) throw Error('no patient');
    patient.sheet.abilities.con = 60;
    health.vigor = needs.maxVigor(x.sim.world, content, x.other);
    // rv-f's repeated episodes; explicit mutual yielding avoids relying on the fixed parley bug.
    for (let n = 0; n < 4; n++) {
      for (const id of [x.id, x.other]) {
        const p = scene.participants[id];
        if (p) p.submitted = false;
      }
      expect(x.command(x.id, 'attack', x.other)).toBe(true);
      x.finish();
      x.command(x.id, 'yield');
      x.command(x.other, 'yield');
      advanceUntil(x.sim, instantOf(x.sim.world) + 30);
    }
    expect(social.strifeCount(x.sim.world, content, x.id, x.other, x.sim.world.time)).toBe(1);
    expect(Object.keys(x.sim.world.social.combatIncidents ?? {})).toHaveLength(1);
    expect(social.opinionOf(x.sim.world, x.id, x.other).fear).toBe(0);
    expect(social.opinionOf(x.sim.world, x.other, x.id).fear).toBeGreaterThan(0);
    const incident = Object.values(x.sim.world.social.combatIncidents ?? {})[0];
    if (!incident) throw Error('no incident');
    for (let n = 0; n < 300; n++)
      social.recordCombatOutcome(x.sim.world, x.ctx(), { ...incident, key: `older:${n}`, witnesses: [] });
    expect(Object.keys(x.sim.world.social.combatIncidents ?? {})).toHaveLength(256);
    expect(x.sim.world.psyche.byActor[x.other]?.combatFear?.triggers ?? []).toEqual([]);
  });
  it('stepping away makes a healthy NPC close in rather than yield (rv-e)', () => {
    const x = fixture(12);
    x.controlled();
    const target = x.sim.world.actors[x.other];
    if (!target) throw Error('no target');
    target.sheet.abilities.con = 30;
    x.command(x.id, 'attack', x.other);
    x.finish();
    const move = x.session.observe().actions.find((a) => a.command.kind === 'tactical.move');
    if (!move) throw Error('no step');
    advanceUntil(x.sim, instantOf(x.sim.world), [move.command]);
    x.finish();
    psyche.setAgency(x.sim.world, x.other, { ...psyche.agencyOf(x.sim.world, x.other), mode: 'psyche' });
    decideBrawl(x.sim.world, x.ctx(), x.other);
    expect(x.sim.world.tactical?.participants[x.other]?.action?.kind).toBe('move');
    expect(x.sim.world.tactical?.participants[x.other]?.submitted).not.toBe(true);
  });
  it('one hit rolls at most one Composure save even across both thresholds; fear is released after the fight', () => {
    const x = fixture();
    x.controlled();
    const actor = x.sim.world.actors[x.id];
    if (!actor) throw Error('no actor');
    actor.sheet.abilities.str = 20;
    actor.sheet.combat = { attack: 100, grappleSize: 0 };
    x.command(x.id, 'attack', x.other);
    x.finish();
    const saves = x.sim.world.log.events.filter(
      (e) => e.kind === 'tactical.morale' && e.explain?.label.startsWith('Composure'),
    );
    expect(saves).toHaveLength(1);
    psyche.endBrawlFear(x.sim.world, x.other);
    expect(x.sim.world.psyche.byActor[x.other]?.combatFear?.triggers).toEqual([]);
  });
  it('Stable wakes on its deadline; nonlethal and Dying advance in ordinary hours without a tactical clock (rv-g)', () => {
    const x = fixture();
    x.controlled();
    const actor = x.sim.world.actors[x.id];
    if (!actor) throw Error('no actor');
    actor.sheet.skills.medicine = 100;
    for (let n = 0; n < 4; n++) needs.applyHit(x.sim.world, x.ctx(), x.other, 20, { nonlethal: false });
    needs.stabilize(x.sim.world, x.ctx(), x.id, x.other, 1);
    const h = needs.healthOf(x.sim.world, x.other);
    expect(h?.stable).toBe(true);
    const wake = h?.wakeAt;
    if (!wake) throw Error('no wake deadline');
    advanceUntil(x.sim, wake - 1);
    expect(needs.canAct(x.sim.world, x.other)).toBe(false);
    advanceUntil(x.sim, wake);
    expect(h?.stable).toBe(false);
    expect(needs.combatUnconscious(x.sim.world, x.other)).toBe(false);
    delete x.sim.world.tactical;
    delete x.sim.world.backgroundTactical;
    needs.applyHit(x.sim.world, x.ctx(), x.id, 3);
    for (let n = 0; n < 3; n++) step(x.sim);
    expect(needs.healthOf(x.sim.world, x.id)?.nonlethal).toBe(0);
    for (let n = 0; n < 4; n++) needs.applyHit(x.sim.world, x.ctx(), x.other, 20, { nonlethal: false });
    step(x.sim);
    expect(x.sim.world.actors[x.other]?.alive).toBe(false);
    expect(findNonIntegers(x.sim.world)).toEqual([]);
  });
  it('blow details render visible rolls, modifiers, DC and damage children; the status shows bruising', () => {
    const x = fixture();
    let result = meleeCheck(x.sim.world, x.ctx(), x.id, x.other, 1);
    for (let token = 2; !result.hit && token < 30; token++)
      result = meleeCheck(x.sim.world, x.ctx(), x.id, x.other, token);
    const full = renderDetail(visibleExplain(result.explain, x.id, true));
    expect(full).toMatch(/d20 \d+/);
    expect(full).toMatch(/Strength [+-]\d+/);
    expect(full).toContain('vs DC');
    expect(full).toContain('Nonlethal damage');
    const fair = renderDetail(visibleExplain(result.explain, x.id));
    expect(fair).toContain('Nonlethal damage');
    expect(fair).not.toContain('vs DC');
    needs.applyHit(x.sim.world, x.ctx(), x.id, 3);
    expect(renderObservation(x.session.observe())).toMatch(/Vigor \d+\/\d+, bruised 3/);
  });
});
