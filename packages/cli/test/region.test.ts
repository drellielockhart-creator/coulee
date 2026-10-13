import {
  type ActorId,
  asActorId,
  asGameMinute,
  belief,
  createSim,
  findNonIntegers,
  idsOf,
  items,
  makeContext,
  region,
  restoreSim,
  type Sim,
  social,
  stateHash,
  step,
} from '@coulee/core';
import { PlaySession, sessionSimOf } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { trimLog } from '../../core/src/events/index.ts';
import type { MemoryInput } from '../../core/src/social/state.ts';
import { actorByKey, baseContent } from './helpers.ts';

const content = baseContent();
function fresh(seed = 42) {
  return createSim(content, { scenarioId: 'iron_ford_neighbors', seed, withPlayer: true });
}
function boundary(sim: Sim) {
  region.regionSystem(sim.world, makeContext(sim.world, sim.content, [], sim.sink));
}
function hours(sim: Sim, count: number) {
  for (let h = 0; h < count; h++) {
    step(sim);
    boundary(sim);
  }
}
function identities(sim: Sim) {
  return Object.values(sim.world.region?.census?.members ?? {}).map((m) => [m.actorId, m.ref, m.identity]);
}
function longRoad(sim: Sim) {
  if (!sim.world.region) throw new Error('Missing region');
  sim.world.region.definition = structuredClone(sim.world.region.definition);
  for (const e of sim.world.region.definition.edges) e.cost_minutes = { ab: 600, ba: 700 };
}
function witnessMemory(sim: Sim): MemoryInput {
  const ownerId = actorByKey(sim, 'cedar_farm_martha');
  const actor = sim.world.actors[ownerId];
  if (!actor) throw new Error('Missing witness');
  const ctx = makeContext(sim.world, content, []);
  const stackId = items.createStack(sim.world, ctx, 'pemmican', 1, items.pantryOf(actor.householdId));
  const eventId = ctx.emit({
    kind: 'items.created',
    visibility: 'witnessed',
    roles: [{ actor: ownerId, role: 'witness' }],
    data: { itemId: stackId, defId: 'pemmican', qty: 1, location: items.pantryOf(actor.householdId) },
  });
  return {
    ownerId,
    eventId,
    kind: 'help',
    at: sim.world.time,
    placeId: actor.placeId,
    roles: [{ who: ownerId, role: 'witness', conf: 100 }],
    source: { kind: 'witnessed' },
    emotion: 'gratitude',
    intensity: 70,
    salience: 900,
    confidence: 1000,
    rehearsals: 0,
    pinned: false,
    summary: 'Martha saw a parcel added to the household pantry.',
  };
}

describe('M5 2a census and tier policy (retained hourly executors)', () => {
  it('preserves authored identities across 50 seeds and reversed, delayed promotion orders', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const a = fresh(seed),
        b = restoreSim(content, structuredClone(a.world));
      const expected = identities(a);
      const ids = idsOf<ActorId>(a.world.actors);
      for (const id of ids) region.promoteCensusActor(a.world, makeContext(a.world, content, []), id);
      b.world.time = asGameMinute((seed + 2) * 1440);
      for (const id of [...ids].reverse()) region.promoteCensusActor(b.world, makeContext(b.world, content, []), id);
      expect(identities(a), `seed ${seed}`).toEqual(expected);
      expect(identities(b), `seed ${seed}`).toEqual(expected);
      const first = ids[0];
      if (first !== undefined)
        expect((region.censusAgeDays(b.world, first) ?? 0) - (region.censusAgeDays(a.world, first) ?? 0)).toBe(
          seed + 2,
        );
      for (const hh of Object.values(a.world.households)) {
        expect(region.censusConsumers(a.world, hh.id)).toEqual([...hh.memberIds].sort((x, y) => x - y));
      }
      expect(findNonIntegers(b.world)).toEqual([]);
    }
  });

  it('keeps the four-hour neighbor T1 and uses directed costs and closures', () => {
    const sim = fresh(),
      world = sim.world;
    const martha = actorByKey(sim, 'cedar_farm_martha');
    expect(world.region?.lod?.actors[martha]?.selected).toBe('T1');
    expect(region.routeDistances(world, 'iron_ford').cedar_farm).toBe(250);
    expect(region.routeDistances(world, 'cedar_farm').iron_ford).toBe(240);
    longRoad(sim);
    const edge = world.region?.definition.edges[0];
    if (!edge) throw new Error('Missing edge');
    edge.available_months = [1];
    expect(region.routeDistances(world, 'iron_ford').cedar_farm).toBeUndefined();
    edge.available_months = [4];
    edge.capability = 'boat';
    expect(region.routeDistances(world, 'iron_ford').cedar_farm).toBeUndefined();
  });

  it('demotes after exactly 24 hours; pins, destination and obligations promote immediately', () => {
    const sim = fresh(),
      w = sim.world,
      martha = actorByKey(sim, 'cedar_farm_martha');
    longRoad(sim);
    boundary(sim);
    w.time = asGameMinute(1439);
    boundary(sim);
    expect(w.region?.lod?.actors[martha]?.selected).toBe('T1');
    w.time = asGameMinute(1440);
    boundary(sim);
    expect(w.region?.lod?.actors[martha]?.selected).toBe('T2');
    expect(w.region?.lod?.actors[martha]?.processing).toBe('T1');
    expect(region.hourlyActorIds(w)).toContain(martha);
    region.setRegionRelevance(w, martha, 0, true, 'companion');
    boundary(sim);
    expect(w.region?.lod?.actors[martha]?.selected).toBe('T1');
    region.setRegionRelevance(w, martha, 0, false, 'released');
    boundary(sim);
    w.time = asGameMinute(2880);
    boundary(sim);
    expect(w.region?.lod?.actors[martha]?.selected).toBe('T2');
    const pc = actorByKey(sim, 'lydia_pratt');
    social.extendCredit(w, makeContext(w, content, []), pc, martha, 125);
    boundary(sim);
    expect(w.region?.lod?.actors[martha]?.reasons).toContain('obligation');
    expect(w.region?.lod?.actors[martha]?.selected).toBe('T1');
    region.setRegionFocus(w, martha);
    boundary(sim);
    expect(w.region?.lod?.actors[martha]?.selected).toBe('T0');
    expect(w.region?.lod?.actors[pc]?.selected).not.toBe('T0');
  });

  it('ranks by relevance, distance and ID at the 400 soft cap; pins override it', () => {
    const sim = fresh(),
      w = sim.world;
    const original = w.actors[actorByKey(sim, 'cedar_farm_martha')];
    if (!original) throw new Error('Missing actor');
    for (let i = 0; i < 450; i++) {
      const id = asActorId(1000 + i);
      w.actors[id] = { ...original, id, key: `cap_${i}` };
    }
    region.selectRegionTiers(w);
    w.time = asGameMinute(1440);
    region.selectRegionTiers(w);
    const tiers = Object.values(w.region?.lod?.actors ?? {});
    expect(tiers.filter((r) => r.selected === 'T1')).toHaveLength(400);
    expect(w.region?.lod?.actors[1449]?.selected).toBe('T2');
    region.setRegionRelevance(w, asActorId(1449), 100, false, 'active scene');
    region.selectRegionTiers(w);
    expect(w.region?.lod?.actors[1449]?.selected).toBe('T1');
    for (let i = 0; i < 405; i++) region.setRegionRelevance(w, asActorId(1000 + i), 0, true, 'pursuer');
    region.selectRegionTiers(w);
    expect(Object.values(w.region?.lod?.actors ?? {}).filter((r) => r.pinned && r.processing === 'T1')).toHaveLength(
      405,
    );
  });

  it('keeps evidence after 16-day log eviction, hydrates once, and hides other witnesses', () => {
    const sim = fresh(),
      m = witnessMemory(sim);
    expect(region.recordCensusEvidence(sim.world, 'parcel:1', m)).toBe(true);
    expect(region.recordCensusEvidence(sim.world, 'parcel:1', m)).toBe(false);
    expect(() => region.recordCensusEvidence(sim.world, 'parcel:1', { ...m, summary: 'Different cause' })).toThrow();
    m.summary = 'Caller mutates its copy';
    sim.world.time = asGameMinute(16 * 1440);
    trimLog(sim.world.log, sim.world.time);
    expect(sim.world.log.events.some((e) => e.id === m.eventId)).toBe(false);
    const loaded = restoreSim(content, JSON.parse(JSON.stringify(sim.world)));
    const ctx = makeContext(loaded.world, content, []);
    region.promoteCensusActor(loaded.world, ctx, m.ownerId);
    region.promoteCensusActor(loaded.world, ctx, m.ownerId);
    const memories = social.memoriesOf(loaded.world, m.ownerId).filter((x) => x.eventId === m.eventId);
    expect(memories).toHaveLength(1);
    expect(memories[0]?.summary).toBe('Martha saw a parcel added to the household pantry.');
    expect(memories[0]?.at).toBe(0);
    expect(region.censusEvidenceView(loaded.world, m.ownerId, actorByKey(loaded, 'lydia_pratt'))).toEqual([]);
    expect(region.censusEvidenceView(loaded.world, m.ownerId, m.ownerId)).toHaveLength(1);
    expect(findNonIntegers(loaded.world)).toEqual([]);
  });

  it('flushes pending evidence by 48 hours even if the witness remains selected T2', () => {
    const sim = fresh();
    longRoad(sim);
    boundary(sim);
    sim.world.time = asGameMinute(1440);
    boundary(sim);
    const memory = witnessMemory(sim);
    region.recordCensusEvidence(sim.world, 'parcel:deadline', memory);
    sim.world.time = asGameMinute(4319);
    boundary(sim);
    expect(sim.world.region?.census?.evidence[0]?.hydratedMemoryId).toBeNull();
    sim.world.time = asGameMinute(4320);
    boundary(sim);
    expect(sim.world.region?.census?.evidence[0]?.hydratedMemoryId).not.toBeNull();
    expect(sim.world.region?.lod?.actors[memory.ownerId]?.selected).toBe('T2');
  });

  it('promotion preserves inventory, debt, grudges and death facts without reviving anyone', () => {
    const sim = fresh(),
      w = sim.world,
      martha = actorByKey(sim, 'cedar_farm_martha');
    const pc = actorByKey(sim, 'lydia_pratt'),
      ctx = makeContext(w, content, []);
    social.extendCredit(w, ctx, pc, martha, 175);
    belief.formGrudge(w, ctx, {
      holderId: martha,
      target: { kind: 'actor', id: pc },
      aim: 'apology',
      intensity: 70,
      label: 'Remembered slight',
    });
    const dead = actorByKey(sim, 'cedar_farm_jonas');
    const actor = w.actors[dead];
    if (!actor) throw new Error('Missing dead actor fixture');
    actor.alive = false;
    const n = w.needs.byActor[dead];
    if (!n) throw new Error('Missing needs');
    n.survival = {
      vigor: 0,
      wounds: 0,
      hours: {},
      recovering: 0,
      collapsed: true,
      stasis: false,
      death: {
        at: 0,
        cause: 'fixture death',
        placeId: actor.placeId,
        eventId: mEvent(w),
        discovered: false,
        funeralAt: 1440,
        buried: false,
        mourners: [],
      },
    };
    boundary(sim);
    const before = structuredClone({
      items: w.items,
      social: w.social,
      belief: w.belief,
      needs: w.needs,
      provisions: w.provisions,
    });
    for (const id of [martha, dead]) region.promoteCensusActor(w, ctx, id);
    expect({ items: w.items, social: w.social, belief: w.belief, needs: w.needs, provisions: w.provisions }).toEqual(
      before,
    );
    expect(w.region?.census?.members[dead]?.death?.cause).toBe('fixture death');
    expect(region.censusConsumers(w, actor.householdId)).not.toContain(dead);
    expect(w.actors[dead]?.alive).toBe(false);
    expect(social.debtOf(w, pc, martha).cents).toBe(175);
  });

  it('retained T1 accounting matches the existing executor exactly over a 5-day absence and a saved continuation', () => {
    const sim = fresh(),
      control = restoreSim(content, structuredClone(sim.world));
    const pantryBefore = structuredClone(sim.world.items.stacks);
    hours(sim, 48);
    const loaded = restoreSim(content, JSON.parse(JSON.stringify(sim.world)));
    hours(sim, 72);
    hours(loaded, 72);
    for (let h = 0; h < 120; h++) step(control);
    expect(stateHash(loaded.world)).toBe(stateHash(sim.world));
    for (const slice of ['needs', 'social', 'belief', 'provisions', 'items'] as const)
      expect(sim.world[slice], slice).toEqual(control.world[slice]);
    expect(sim.world.items.stacks).not.toEqual(pantryBefore);
    expect(sim.world.social.totals.interactions).toBeGreaterThan(0);
    expect(findNonIntegers(sim.world)).toEqual([]);
  });

  it('upgrades old region saves idempotently and leaves legacy standalone state unchanged', () => {
    const sim = fresh();
    if (!sim.world.region) throw new Error('Missing region');
    delete sim.world.region.census;
    delete sim.world.region.lod;
    boundary(sim);
    const hash = stateHash(sim.world);
    boundary(sim);
    expect(stateHash(sim.world)).toBe(hash);
    const legacy = createSim(content, { scenarioId: 'iron_ford', seed: 42 });
    const legacyHash = stateHash(legacy.world);
    boundary(legacy);
    expect(stateHash(legacy.world)).toBe(legacyHash);
  });

  it('headless travel, return and replay still share the same Commands and identities', () => {
    const session = PlaySession.create(content, { source: 'iron_ford_neighbors', seed: 42 });
    const sim = sessionSimOf(session),
      id = session.playerId,
      original = identities(sim);
    const travel = (destinationNodeId: string) =>
      session.act({
        kind: 'activity.travel',
        actorId: id,
        data: { destinationNodeId, edgeIds: ['cedar_road'], pace: 'walk', campPolicy: 'ask' },
      });
    expect(travel('cedar_farm').ok).toBe(true);
    for (let n = 0; n < 24 && sim.world.activity.journeys?.[id]?.status !== 'arrived'; n++)
      session.act({ kind: 'activity.wait', actorId: id, data: { minutes: 60 } });
    expect(region.nodeAt(sim.world, id)).toBe('cedar_farm');
    const field = sim.world.index.placeByDef.cedar_farm_field;
    const go = session.observe().actions.find((a) => a.id === `go:${field}`);
    if (!go) throw new Error('No field route');
    expect(session.act(go.command).ok).toBe(true);
    const sleep = session.observe().actions.find((a) => a.id === 'activity:sleep');
    if (!sleep) throw new Error('No field camp');
    expect(session.act(sleep.command).ok).toBe(true);
    for (let n = 0; n < 8; n++) session.act({ kind: 'activity.wait', actorId: id, data: { minutes: 60 } });
    expect(travel('iron_ford').ok).toBe(true);
    for (let n = 0; n < 24 && sim.world.activity.journeys?.[id]?.status !== 'arrived'; n++)
      session.act({ kind: 'activity.wait', actorId: id, data: { minutes: 60 } });
    expect(region.nodeAt(sim.world, id)).toBe('iron_ford');
    expect(identities(sim)).toEqual(original);
    expect(PlaySession.replay(content, session.commandLog).hash).toBe(session.hash);
  });
});
function mEvent(world: Sim['world']) {
  const event = world.log.events[0];
  if (!event) throw new Error('Missing source event');
  return event.id;
}
