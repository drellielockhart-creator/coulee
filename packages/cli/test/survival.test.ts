import {
  type ActorId,
  asGameMinute,
  findNonIntegers,
  idsOf,
  makeContext,
  needs,
  provisions,
  restoreSim,
  type Sim,
  stateHash,
  step,
  toGameMinute,
} from '@coulee/core';
import { PlaySession, parseText, renderObservation, sessionContent } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { survivalHour } from '../../core/src/needs/survival.ts';
import { aftermathHour, die, helpHour } from '../../core/src/needs/survival-social.ts';
import { actorByKey, baseContent, simFor } from './helpers.ts';

function required<T>(x: T | undefined | null): T {
  if (x == null) throw new Error('Missing fixture');
  return x;
}
function alone(sim: Sim, id: ActorId) {
  const a = required(sim.world.actors[id]);
  const place = required(sim.world.index.placeByDef.lantern_coulee_upper);
  a.placeId = place;
  for (const other of idsOf<ActorId>(sim.world.actors)) {
    const actor = required(sim.world.actors[other]);
    if (other !== id && actor.placeId === place)
      actor.placeId = required(sim.world.households[actor.householdId]).homePlaceId;
  }
  return place;
}
function hour(sim: Sim) {
  survivalHour(sim.world, makeContext(sim.world, sim.content, []));
  sim.world.time = asGameMinute(sim.world.time + 60);
}

describe('survival consequences', () => {
  it('deprivation progresses identically for PC and NPC: Vigor, collapse, Wounds, death; resumable and integer', () => {
    const a = simFor({ seed: 42 }),
      id = actorByKey(a, 'joel_pike');
    alone(a, id);
    required(a.world.needs.byActor[id]).values = { hunger: 1000, thirst: 0, warmth: 1000, rest: 1000 };
    const b = restoreSim(a.content, JSON.parse(JSON.stringify(a.world)));
    required(b.world.actors[id]).controller = 'player';
    for (let h = 0; h < 30; h++) {
      hour(a);
      hour(b);
    }
    expect(a.world.needs.byActor[id]?.survival).toEqual(b.world.needs.byActor[id]?.survival);
    expect(needs.canAct(a.world, id)).toBe(false);
    expect(a.world.log.events.some((e) => e.kind === 'needs.collapsed' && e.data.actorId === id)).toBe(true);
    const restored = restoreSim(a.content, JSON.parse(JSON.stringify(a.world)));
    for (let h = 0; h < 45; h++) {
      hour(a);
      hour(restored);
    }
    expect(stateHash(a.world)).toBe(stateHash(restored.world));
    expect(a.world.actors[id]?.alive).toBe(false);
    expect(a.world.needs.byActor[id]?.survival?.death?.cause).toBe('thirst');
    expect(a.world.needs.byActor[id]?.survival?.death?.discovered).toBe(false);
    expect(findNonIntegers(a.world)).toEqual([]);
    expect(
      a.world.log.events
        .filter((e) => e.kind === 'needs.survival_check')
        .every((e) => e.explain?.knowledge === 'self' && e.explain.roll),
    ).toBe(true);
  });

  it('all five content hazards harm; recovery removes incapacity and conditions when needs are met', () => {
    for (const rule of Object.values(baseContent().survival_rules)) {
      const sim = simFor({ seed: 42 }),
        id = actorByKey(sim, 'joel_pike');
      const place = alone(sim, id),
        n = required(sim.world.needs.byActor[id]);
      n.values = { hunger: 1000, thirst: 1000, warmth: 1000, rest: 1000, [rule.need]: 0 };
      sim.world.needs.placeTempF = { [place]: rule.heat_above_f ?? 60 };
      const s = required(needs.survivalOf(sim.world, sim.content, id));
      s.hours[rule.id] = rule.grace_hours - 1;
      for (let h = 0; h < rule.check_hours * 5; h++) hour(sim);
      expect(
        sim.world.log.events.some(
          (e) =>
            e.kind === 'needs.survival_check' &&
            e.data.actorId === id &&
            e.data.cause === rule.name &&
            e.data.damage > 0,
        ),
        rule.id,
      ).toBe(true);
    }
    const sim = simFor(),
      id = actorByKey(sim, 'joel_pike');
    const s = required(needs.survivalOf(sim.world, sim.content, id));
    Object.assign(s, { vigor: 0, collapsed: true, wounds: 3, hours: { dehydration: 24 } });
    required(sim.world.actors[id]).sheet.conditions.push('incapacitated', 'dehydrated');
    required(sim.world.needs.byActor[id]).values = { hunger: 1000, thirst: 1000, warmth: 1000, rest: 1000 };
    for (let h = 0; h < 24; h++) hour(sim);
    expect(s.collapsed).toBe(false);
    expect(s.wounds).toBe(2);
    expect(sim.world.actors[id]?.sheet.conditions).not.toContain('dehydrated');
  });

  it('sleep restores exhaustion Vigor even when hungry, and triage serves a collapsed patient first', () => {
    const sim = simFor({ seed: 42 }),
      patient = actorByKey(sim, 'joel_pike');
    const n = required(sim.world.needs.byActor[patient]);
    n.values = { hunger: 0, thirst: 1000, rest: 1000, warmth: 1000 };
    const health = required(needs.survivalOf(sim.world, sim.content, patient));
    Object.assign(health, { vigor: 0, collapsed: true, vigorHarm: { exhaustion: 7 } });
    hour(sim);
    expect(health.vigor).toBe(1);
    expect(health.collapsed).toBe(false);
    const hungry = actorByKey(sim, 'amos_whitcomb'),
      helper = actorByKey(sim, 'gussie_pratt');
    const place = alone(sim, patient);
    required(sim.world.actors[hungry]).placeId = place;
    required(sim.world.actors[helper]).placeId = place;
    for (const p of Object.values(sim.world.psyche.byActor)) p.agencyMode = 'commanded';
    required(sim.world.psyche.byActor[helper]).agencyMode = 'psyche';
    Object.assign(health, { vigor: 0, collapsed: true });
    n.values.thirst = 0;
    required(sim.world.needs.byActor[hungry]).values.hunger = 0;
    required(needs.survivalOf(sim.world, sim.content, hungry)).hours.starvation = 30;
    const before = sim.world.log.lastId;
    helpHour(sim.world, makeContext(sim.world, sim.content, []));
    const aid = sim.world.log.events.find((e) => e.id > before && e.kind === 'needs.aid');
    expect(aid?.kind === 'needs.aid' && aid.data.targetId).toBe(patient);
  });

  it('an unprotected winter night in the hills can kill within three days through the actual thermal ledger', () => {
    const sim = simFor({ seed: 42 }),
      id = actorByKey(sim, 'joel_pike');
    alone(sim, id);
    sim.world.time = toGameMinute(1856, 1, 15, 0, 0);
    const start = sim.world.time;
    // Isolate exposure from rescue: the healthier town can otherwise carry him indoors.
    for (const other of Object.values(sim.world.psyche.byActor)) other.agencyMode = 'commanded';
    const mind = required(sim.world.psyche.byActor[id]);
    mind.agencyMode = 'commanded';
    // Eat off too (wave 5): a standing eat order now walks him home to his larder when it is
    // within an hour, which would bring him in from the cold. This test is about the cold.
    mind.standingOrders = { sleep: true, eat: false, drink: true, warmth: false, lodging: false, activities: [] };
    for (let h = 0; h < 72 && sim.world.actors[id]?.alive; h++) step(sim);
    expect(sim.world.needs.byActor[id]?.survival?.death?.cause).toBe('cold');
    expect(sim.world.time - start).toBeLessThanOrEqual(72 * 60);
  });

  it('freezes both confined chainmen, but a free visitor at the same site still has needs', () => {
    const sim = simFor({ seed: 42 });
    for (const key of ['tobias_vik', 'ezra_sloat']) {
      const id = actorByKey(sim, key),
        before = structuredClone(sim.world.needs.byActor[id]);
      needs.needsSystem(sim.world, makeContext(sim.world, sim.content, []));
      expect(sim.world.needs.byActor[id]?.values).toEqual(before?.values);
      expect(sim.world.needs.byActor[id]?.survival?.stasis).toBe(true);
    }
    const id = actorByKey(sim, 'joel_pike');
    required(sim.world.actors[id]).placeId = required(sim.world.index.placeByDef.lantern_spring);
    expect(needs.needsFrozen(sim.world, sim.content, id)).toBe(false);
    expect(
      sim.world.log.events.some(
        (e) => e.kind === 'needs.stasis' && e.explain?.label === 'Time runs otherwise under the hill',
      ),
    ).toBe(true);
  });

  it('aid is a Command, consumes actual water, carries home, and collapses block actions in core', () => {
    const sim = simFor({ seed: 42 }),
      helper = actorByKey(sim, 'amos_whitcomb'),
      patient = actorByKey(sim, 'joel_pike');
    const place = alone(sim, patient);
    required(sim.world.actors[helper]).placeId = place;
    const s = required(needs.survivalOf(sim.world, sim.content, patient));
    Object.assign(s, { vigor: 0, collapsed: true });
    required(sim.world.needs.byActor[patient]).values.thirst = 0;
    const home = required(sim.world.households[required(sim.world.actors[patient]).householdId]);
    const water = required(sim.world.provisions.households[home.id]);
    water.waterMl = 2000;
    const homePlace = required(sim.world.places[home.homePlaceId]);
    homePlace.tags = homePlace.tags.filter((t) => t !== 'water');
    const patientActor = required(sim.world.actors[patient]);
    patientActor.placeId = home.homePlaceId;
    const availableWater = provisions.drinkingWater(sim.world, sim.content, patient);
    patientActor.placeId = place;
    helpHour(
      sim.world,
      makeContext(sim.world, sim.content, [{ kind: 'needs.aid', actorId: helper, data: { targetId: patient } }]),
    );
    expect(sim.world.actors[patient]?.placeId).toBe(home.homePlaceId);
    expect(provisions.drinkingWater(sim.world, sim.content, patient)).toBe(availableWater - 1000);
    expect(sim.world.needs.byActor[patient]?.values.thirst).toBeGreaterThan(0);
    expect(sim.world.log.events.some((e) => e.kind === 'needs.aid' && e.data.success && e.data.waterMl === 1000)).toBe(
      true,
    );
    required(sim.world.needs.byActor[patient]).values.thirst = 0;
    const prior = sim.world.actors[patient]?.placeId;
    step(sim, [
      { kind: 'core.urge', actorId: patient, data: { urge: { kind: 'activity', activityId: 'walk', placeId: place } } },
    ]);
    expect(sim.world.actors[patient]?.placeId).toBe(prior);
  });

  it('discovery reforms a household, records widowhood, estate and grief, and holds a church funeral', () => {
    const sim = simFor({ seed: 42 }),
      id = actorByKey(sim, 'johann_brenner');
    const actor = required(sim.world.actors[id]),
      household = required(sim.world.households[actor.householdId]);
    const survivor = required(household.memberIds.find((x) => x !== id));
    required(sim.world.actors[survivor]).placeId = actor.placeId;
    sim.world.provisions.purses[id] = 137;
    const cash = required(sim.world.provisions.households[household.id]).cashCents;
    die(sim.world, makeContext(sim.world, sim.content, []), id, 'cold');
    aftermathHour(sim.world, makeContext(sim.world, sim.content, []));
    expect(sim.world.needs.byActor[id]?.survival?.death?.discovered).toBe(true);
    expect(household.headId).not.toBe(id);
    expect(sim.world.provisions.purses[id]).toBe(0);
    expect(sim.world.provisions.households[household.id]?.cashCents).toBe(cash + 137);
    expect(Object.values(sim.world.social.memories).some((m) => m.emotion === 'grief' && m.ownerId === survivor)).toBe(
      true,
    );
    expect(sim.world.social.relationships.some((r) => r.endedByDeath === id)).toBe(true);
    sim.world.time = asGameMinute(1440 + 600);
    aftermathHour(sim.world, makeContext(sim.world, sim.content, []));
    const funeral = sim.world.log.events.find((e) => e.kind === 'needs.funeral');
    expect(funeral?.kind === 'needs.funeral' && funeral.data.attendees.length).toBeGreaterThan(0);
    expect(findNonIntegers(sim.world)).toEqual([]);
  });

  it('takes an orphan into an adult kin household and transfers an empty household estate', () => {
    const sim = simFor({ seed: 42 }),
      parent = actorByKey(sim, 'amos_whitcomb'),
      child = actorByKey(sim, 'joel_pike'),
      kin = actorByKey(sim, 'gussie_pratt');
    const household = required(sim.world.households[required(sim.world.actors[parent]).householdId]);
    const destination = required(sim.world.households[required(sim.world.actors[kin]).householdId]);
    required(sim.world.actors[child]).born = asGameMinute(-5 * 365 * 1440);
    for (const id of household.memberIds.filter((id) => id !== parent && id !== child)) {
      required(sim.world.actors[id]).householdId = destination.id;
      destination.memberIds.push(id);
    }
    household.memberIds = [parent, child];
    required(sim.world.actors[kin]).placeId = required(sim.world.actors[parent]).placeId;
    sim.world.social.relationships.push({
      a: parent,
      b: kin,
      kind: 'cousin',
      since: sim.world.time,
      amountCents: null,
    });
    const old = required(sim.world.provisions.households[household.id]),
      next = required(sim.world.provisions.households[destination.id]);
    const total = old.cashCents + next.cashCents + (sim.world.provisions.purses[parent] ?? 0);
    die(sim.world, makeContext(sim.world, sim.content, []), parent, 'cold');
    aftermathHour(sim.world, makeContext(sim.world, sim.content, []));
    expect(sim.world.actors[child]?.householdId).toBe(destination.id);
    expect(destination.memberIds).toContain(child);
    expect(household.memberIds).not.toContain(child);
    expect(old.cashCents).toBe(0);
    expect(next.cashCents).toBe(total);
    expect(sim.world.log.events.some((e) => e.kind === 'needs.estate' && e.data.adopted.includes(child))).toBe(true);
  });

  it('death/retire/depart persist terminal endings, reveal the epilogue only then, and refuse further time', () => {
    for (const ending of ['retire', 'depart'] as const) {
      const session = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
      expect(session.observe().epilogue).toBeNull();
      expect(session.act(ending).ok).toBe(true);
      expect(session.observe().ending?.type).toBe(ending);
      expect(renderObservation(session.observe())).toContain('Only reading remains');
      const loaded = PlaySession.load(baseContent(), session.save());
      expect(loaded.advance(60).ok).toBe(false);
      expect(loaded.act('journal').ok).toBe(true);
    }
    const session = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
    const save = JSON.parse(session.save());
    const sim = restoreSim(sessionContent(baseContent(), session.spec).content, save.world);
    die(sim.world, makeContext(sim.world, sim.content, []), session.playerId, 'thirst');
    save.world = sim.world;
    const dead = PlaySession.load(baseContent(), JSON.stringify(save));
    expect(dead.observe().ending?.type).toBe('death');
    expect(dead.advance(60).ok).toBe(false);
    const query = parseText('plan', dead.observe());
    expect(typeof query !== 'string' && dead.act(query).ok).toBe(true);
  });
});
