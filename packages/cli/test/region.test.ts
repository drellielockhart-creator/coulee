import {
  type ActorId,
  advanceUntil,
  asActorId,
  asGameMinute,
  belief,
  createSim,
  findNonIntegers,
  idsOf,
  instantOf,
  items,
  makeContext,
  needs,
  provisions,
  region,
  restoreSim,
  type Sim,
  social,
  stateHash,
  step,
  TICKS_PER_HOUR,
  tactical,
} from '@coulee/core';
import { PlaySession, sessionSimOf } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { trimLog } from '../../core/src/events/index.ts';
import { decayMemoriesDaily } from '../../core/src/social/memory.ts';
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
  for (let h = 0; h < count; h++) step(sim);
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

describe('M5 census and tier policy', () => {
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
    expect(w.region?.lod?.actors[martha]?.processing).toBe('T2');
    expect(region.hourlyActorIds(w)).not.toContain(martha);
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

  it('coarse accounting consumes real supplies over a 5-day absence and resumes a saved continuation', () => {
    const sim = fresh(),
      control = restoreSim(content, structuredClone(sim.world));
    longRoad(sim);
    longRoad(control);
    for (const id of idsOf<ActorId>(control.world.actors))
      region.setRegionRelevance(control.world, id, 0, true, 'comparison hourly pin');
    const pantryBefore = structuredClone(sim.world.items.stacks);
    hours(sim, 48);
    const loaded = restoreSim(content, JSON.parse(JSON.stringify(sim.world)));
    hours(sim, 72);
    hours(loaded, 72);
    for (let h = 0; h < 120; h++) step(control);
    expect(Object.values(sim.world.region?.lod?.actors ?? {}).some((r) => r.selected === 'T2')).toBe(true);
    expect(Object.values(control.world.region?.lod?.actors ?? {}).some((r) => r.selected === 'T2')).toBe(false);
    expect(stateHash(loaded.world)).toBe(stateHash(sim.world));
    expect(region.processingBuckets(sim.world).daily.actors).toHaveLength(2);
    expect(region.processingBuckets(control.world).daily.actors).toHaveLength(0);
    expect(sim.world.region?.processing?.sites?.cedar_farm?.through).toBe(7200);
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
    expect(sim.world.region?.lod?.focusActorId).toBe(id);
    expect(sim.world.region?.lod?.actors[actorByKey(sim, 'cedar_farm_martha')]?.selected).toBe('T0');
    expect(sim.world.region?.lod?.evaluatedAt).toBe(sim.world.time);
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

describe('M5 2b lifecycle and household ownership', () => {
  it('automatically settles the completed hour, hydrates with boundary time, and preserves receipts', () => {
    const sim = fresh();
    const memory = witnessMemory(sim);
    region.recordCensusEvidence(sim.world, 'automatic boundary', memory);
    const seen: number[] = [];
    sim.sink = (event) => seen.push(event.t);
    step(sim);
    expect(sim.world.region?.lod?.evaluatedAt).toBe(60);
    const evidence = sim.world.region?.census?.evidence[0];
    expect(evidence?.hydratedMemoryId).not.toBeNull();
    expect(seen.at(-1)).toBe(60);
    const before = stateHash(sim.world);
    boundary(sim);
    expect(stateHash(sim.world)).toBe(before);
    hours(sim, 24);
    expect(sim.world.region?.census?.evidence[0]?.hydratedMemoryId).toBe(evidence?.hydratedMemoryId);
    expect(sim.world.region?.census?.members[memory.ownerId]?.observedThrough).toBe(1500);
  });

  it('flushes at the 48-hour deadline through the ordinary clock with no explicit boundary call', () => {
    const sim = fresh();
    longRoad(sim);
    boundary(sim);
    sim.world.time = asGameMinute(1440);
    boundary(sim);
    region.recordCensusEvidence(sim.world, 'automatic deadline', witnessMemory(sim));
    sim.world.time = asGameMinute(4260);
    step(sim);
    expect(sim.world.region?.census?.evidence[0]?.hydratedMemoryId).not.toBeNull();
    expect(sim.world.region?.lod?.evaluatedAt).toBe(4320);
  });

  it('tactical partial frames defer the boundary, and mid-frame restores settle it once', () => {
    const sim = fresh();
    const group = Object.values(sim.world.places)
      .map((place) => ({ place, actors: Object.values(sim.world.actors).filter((a) => a.placeId === place.id) }))
      .find((g) => g.actors.length >= 2);
    if (!group) throw new Error('Missing encounter fixture');
    expect(
      tactical.requestEncounter(
        sim.world,
        makeContext(sim.world, content, []),
        'region-boundary',
        group.place.id,
        group.actors.map((a) => a.id),
        'A pause on the road.',
      ),
    ).toBe(true);
    const memory = witnessMemory(sim);
    region.recordCoarseCensusEvidence(sim.world, makeContext(sim.world, content, []), 'tactical boundary', memory);
    advanceUntil(sim, TICKS_PER_HOUR - 1);
    expect(sim.world.region?.lod?.evaluatedAt).toBe(0);
    expect(sim.world.region?.census?.evidence[0]?.hydratedMemoryId).toBeNull();
    expect(region.hydrateCensusEvidence(sim.world, makeContext(sim.world, content, []), memory.ownerId)).toEqual([]);
    const pendingHash = stateHash(sim.world);
    region.promoteCensusActor(sim.world, makeContext(sim.world, content, []), memory.ownerId);
    expect(stateHash(sim.world)).toBe(pendingHash);
    const loaded = restoreSim(content, JSON.parse(JSON.stringify(sim.world)));
    advanceUntil(sim, TICKS_PER_HOUR);
    advanceUntil(loaded, TICKS_PER_HOUR);
    expect(sim.world.region?.lod?.evaluatedAt).toBe(60);
    expect(sim.world.region?.census?.evidence[0]?.hydratedMemoryId).not.toBeNull();
    expect(stateHash(sim.world)).toBe(stateHash(loaded.world));
    const hash = stateHash(sim.world);
    advanceUntil(sim, instantOf(sim.world));
    expect(stateHash(sim.world)).toBe(hash);
  });

  it('partitions every actor and household exactly once even when selected T2', () => {
    const sim = fresh();
    longRoad(sim);
    boundary(sim);
    sim.world.time = asGameMinute(1440);
    boundary(sim);
    const buckets = region.processingBuckets(sim.world);
    expect([...buckets.hourly.actors, ...buckets.daily.actors].sort((a, b) => a - b)).toEqual(idsOf(sim.world.actors));
    expect([...buckets.hourly.households, ...buckets.daily.households].sort((a, b) => a - b)).toEqual(
      idsOf(sim.world.households),
    );
    expect(buckets.daily.actors).toHaveLength(2);
    expect(buckets.daily.households).toHaveLength(1);
    expect(buckets.hourly.actors.some((id) => buckets.daily.actors.includes(id))).toBe(false);
    expect(Object.values(sim.world.region?.lod?.actors ?? {}).some((r) => r.selected === 'T2')).toBe(true);
  });

  it('uses real daily household supplies once across repeated calls, save/load and promotion', () => {
    const sim = fresh(),
      actor = actorByKey(sim, 'cedar_farm_martha'),
      householdId = sim.world.actors[actor]?.householdId;
    if (!householdId) throw new Error('Missing household');
    const before = stateHash(sim.world);
    provisions.householdEconomyDay(sim.world, makeContext(sim.world, content, []), householdId);
    expect(stateHash(sim.world)).not.toBe(before);
    const after = stateHash(sim.world);
    provisions.householdEconomyDay(sim.world, makeContext(sim.world, content, []), householdId);
    expect(stateHash(sim.world)).toBe(after);
    const loaded = restoreSim(content, JSON.parse(JSON.stringify(sim.world)));
    region.promoteCensusActor(loaded.world, makeContext(loaded.world, content, []), actor);
    const promoted = stateHash(loaded.world);
    provisions.householdEconomyDay(loaded.world, makeContext(loaded.world, content, []), householdId);
    expect(stateHash(loaded.world)).toBe(promoted);
    expect(loaded.world.items).toEqual(sim.world.items);
    expect(loaded.world.provisions).toEqual(sim.world.provisions);
    expect(() =>
      provisions.householdEconomyDay(loaded.world, makeContext(loaded.world, content, []), householdId, 'daily'),
    ).toThrow('Household processing owner mismatch');
    expect(stateHash(loaded.world)).toBe(promoted);
    loaded.world.time = asGameMinute(1440);
    provisions.householdEconomyDay(loaded.world, makeContext(loaded.world, content, []), householdId);
    expect(loaded.world.region?.processing?.householdEconomy[householdId]?.day).toBe(1);
    expect(Object.keys(loaded.world.region?.processing?.householdEconomy ?? {})).toHaveLength(1);
    expect(() => region.claimHouseholdEconomyDay(loaded.world, householdId, 0, 'hourly')).toThrow('earlier interval');
    expect(() => region.claimHouseholdEconomyDay(loaded.world, householdId, 1441, 'hourly')).toThrow('canonical');
    expect(findNonIntegers(loaded.world)).toEqual([]);
  });

  it('validates regional save versions without mutating supported old saves', () => {
    const sim = fresh();
    for (const key of ['census', 'lod', 'processing'] as const) {
      const saved = JSON.parse(JSON.stringify(sim.world));
      saved.region[key] = { ...saved.region[key], version: 999 };
      expect(() => restoreSim(content, saved)).toThrow('Unsupported regional');
    }
    const saved = JSON.parse(JSON.stringify(sim.world));
    delete saved.region.census;
    delete saved.region.lod;
    const before = stateHash(saved);
    const restored = restoreSim(content, saved);
    expect(stateHash(restored.world)).toBe(before);
    step(restored);
    expect(restored.world.region?.census?.version).toBe(1);
    expect(restored.world.region?.lod?.evaluatedAt).toBe(60);
  });
});
function mEvent(world: Sim['world']) {
  const event = world.log.events[0];
  if (!event) throw new Error('Missing source event');
  return event.id;
}

describe('M5 2c delayed named evidence', () => {
  it('matches ordinary integer memory decay across a 14-day absence and mid-absence load', () => {
    const delayed = fresh();
    const memory = witnessMemory(delayed);
    const ordinary = restoreSim(content, structuredClone(delayed.world));
    const id = social.addMemory(ordinary.world, makeContext(ordinary.world, content, []), memory);
    expect(
      region.recordCoarseCensusEvidence(delayed.world, makeContext(delayed.world, content, []), 'decay', memory),
    ).toBe(true);
    for (let day = 1; day <= 14; day++) {
      delayed.world.time = asGameMinute(day * 1440 + 60);
      decayMemoriesDaily(ordinary.world, content);
      region.decayCensusEvidence(delayed.world);
      if (day === 7) delayed.world = restoreSim(content, JSON.parse(JSON.stringify(delayed.world))).world;
    }
    region.promoteCensusActor(delayed.world, makeContext(delayed.world, content, []), memory.ownerId);
    const actual = social.memoriesOf(delayed.world, memory.ownerId).find((m) => m.eventId === memory.eventId);
    expect(actual?.salience).toBe(id === null ? undefined : ordinary.world.social.memories[id]?.salience);
    const before = stateHash(delayed.world);
    region.promoteCensusActor(delayed.world, makeContext(delayed.world, content, []), memory.ownerId);
    expect(stateHash(delayed.world)).toBe(before);
    expect(findNonIntegers(delayed.world)).toEqual([]);
  });

  it('hands midnight decay to exactly one owner before and after promotion', () => {
    for (const minute of [1440, 1500]) {
      const sim = fresh();
      const memory = witnessMemory(sim);
      region.recordCoarseCensusEvidence(sim.world, makeContext(sim.world, content, []), 'midnight', memory);
      const policy = social.memoryDecayPolicy(sim.world, content, memory);
      sim.world.time = asGameMinute(minute);
      region.promoteCensusActor(sim.world, makeContext(sim.world, content, []), memory.ownerId);
      if (minute === 1440) decayMemoriesDaily(sim.world, content);
      region.decayCensusEvidence(sim.world, asGameMinute(1500));
      const actual = social.memoriesOf(sim.world, memory.ownerId).find((m) => m.eventId === memory.eventId);
      expect(actual?.salience).toBe(social.decayMemorySnapshot(memory.salience, false, policy));
    }
  });

  it('retains forgotten receipts without allocating or repeatedly resurrecting a memory', () => {
    const sim = fresh();
    const memory = { ...witnessMemory(sim), intensity: 0, salience: 0 };
    region.recordCoarseCensusEvidence(sim.world, makeContext(sim.world, content, []), 'forgotten', memory);
    sim.world.time = asGameMinute(1500);
    region.promoteCensusActor(sim.world, makeContext(sim.world, content, []), memory.ownerId);
    expect(sim.world.region?.census?.evidence[0]?.decay?.forgottenAt).toBe(1440);
    expect(social.memoriesOf(sim.world, memory.ownerId).filter((m) => m.eventId === memory.eventId)).toHaveLength(0);
    const before = stateHash(sim.world);
    expect(region.recordCoarseCensusEvidence(sim.world, makeContext(sim.world, content, []), 'forgotten', memory)).toBe(
      false,
    );
    region.promoteCensusActor(sim.world, makeContext(sim.world, content, []), memory.ownerId);
    expect(stateHash(sim.world)).toBe(before);
  });

  it('captures the producer policy once, independent of later disposition or hydration order', () => {
    const sim = fresh();
    const memory = witnessMemory(sim);
    region.recordCoarseCensusEvidence(sim.world, makeContext(sim.world, content, []), 'cause-policy', memory);
    const policy = structuredClone(sim.world.region?.census?.evidence[0]?.decay?.policy);
    const actor = sim.world.actors[memory.ownerId];
    if (!actor) throw new Error('Missing actor');
    actor.values.neighborliness = -3;
    sim.world.time = asGameMinute(1500);
    region.decayCensusEvidence(sim.world);
    expect(sim.world.region?.census?.evidence[0]?.decay?.policy).toEqual(policy);
    const before = stateHash(sim.world);
    expect(() =>
      region.recordCoarseCensusEvidence(sim.world, makeContext(sim.world, content, []), 'cause-policy', {
        ...memory,
        salience: 1,
      }),
    ).toThrow('Conflicting');
    expect(stateHash(sim.world)).toBe(before);
  });
});

describe('M5 2d daily physical ownership', () => {
  it('skips hourly physiology, minds, fuel, storage and pending plates, then settles only the outstanding interval', () => {
    const sim = fresh();
    longRoad(sim);
    boundary(sim);
    hours(sim, 25);
    const ids = region.processingBuckets(sim.world).daily.actors;
    expect(ids).toHaveLength(2);
    const id = ids[0];
    if (!id) throw new Error('No daily actor');
    const hid = sim.world.actors[id]?.householdId;
    if (!hid) throw new Error('No daily household');
    const snapshot = () =>
      structuredClone({
        actors: ids.map((id) => sim.world.actors[id]),
        needs: ids.map((id) => sim.world.needs.byActor[id]),
        psyche: ids.map((id) => sim.world.psyche.byActor[id]),
        nutrition: ids.map((id) => sim.world.provisions.nutrition[id]),
        pantry: items.stacksAt(sim.world, items.pantryOf(hid)),
        provisions: sim.world.provisions.households[hid],
        plates: sim.world.provisions.pendingMeals?.filter((m) => m.householdId === hid),
      });
    const before = snapshot();
    expect(sim.world.region?.census?.members[id]?.observedThrough).toBe(1440);
    hours(sim, 10);
    expect(snapshot()).toEqual(before);
    expect(sim.world.region?.processing?.sites?.cedar_farm?.through).toBe(1440);
    const loaded = restoreSim(content, JSON.parse(JSON.stringify(sim.world)));
    const ctx = makeContext(sim.world, content, []);
    region.promoteCensusActor(sim.world, ctx, id);
    expect(snapshot()).not.toEqual(before);
    expect(region.processingBuckets(sim.world).daily.actors).toHaveLength(0);
    const after = snapshot();
    region.promoteCensusActor(sim.world, ctx, id);
    expect(snapshot()).toEqual(after);
    region.promoteCensusActor(loaded.world, makeContext(loaded.world, content, []), id);
    expect(stateHash(loaded.world)).toBe(stateHash(sim.world));
    expect(sim.world.region?.processing?.householdEconomy[hid]).toEqual({ day: 1, owner: 'daily' });
    hours(sim, 1);
    expect(sim.world.region?.processing?.householdEconomy[hid]).toEqual({ day: 1, owner: 'daily' });
    expect(findNonIntegers(sim.world)).toEqual([]);
  });

  it('keeps identities and physical settlement independent of contact order', () => {
    const a = fresh();
    longRoad(a);
    boundary(a);
    hours(a, 35);
    const b = restoreSim(content, JSON.parse(JSON.stringify(a.world)));
    const ids = region.processingBuckets(a.world).daily.actors;
    for (const id of ids) region.promoteCensusActor(a.world, makeContext(a.world, content, []), id);
    for (const id of [...ids].reverse()) region.promoteCensusActor(b.world, makeContext(b.world, content, []), id);
    expect(identities(a)).toEqual(identities(b));
    expect(stateHash(a.world)).toBe(stateHash(b.world));
  });

  it('replays headless coarse absence from the same authored content and command log', () => {
    const distant = structuredClone(content);
    const def = distant.regions.iron_ford_neighbors;
    if (!def) throw new Error('No region');
    for (const edge of def.edges) edge.cost_minutes = { ab: 600, ba: 700 };
    const session = PlaySession.create(distant, { source: 'iron_ford_neighbors', seed: 42 });
    for (let h = 0; h < 72; h++)
      session.act({ kind: 'activity.wait', actorId: session.playerId, data: { minutes: 60 } });
    expect(region.processingBuckets(sessionSimOf(session).world).daily.actors).toHaveLength(2);
    expect(PlaySession.replay(distant, session.commandLog).hash).toBe(session.hash);
  });

  it('retains the authored six-hour radius and pins a mixed household as one owner', () => {
    const sim = fresh();
    hours(sim, 25);
    expect(region.processingBuckets(sim.world).daily.actors).toHaveLength(0);
    longRoad(sim);
    boundary(sim);
    hours(sim, 25);
    const id = actorByKey(sim, 'cedar_farm_martha');
    expect(region.processingBuckets(sim.world).daily.actors).toHaveLength(2);
    region.setRegionRelevance(sim.world, id, 1, true, 'active local scene');
    boundary(sim);
    expect(region.processingBuckets(sim.world).daily.actors).toHaveLength(0);
  });
});

describe('M5 coarse consequences', () => {
  it('commits a coarse collapse/death fact once and never revives it on contact', () => {
    const sim = fresh();
    longRoad(sim);
    boundary(sim);
    sim.world.time = asGameMinute(1440);
    boundary(sim);
    const id = actorByKey(sim, 'cedar_farm_martha');
    const n = sim.world.needs.byActor[id],
      actor = sim.world.actors[id];
    const health = needs.survivalOf(sim.world, content, id);
    if (!n || !actor || !health) throw new Error('Missing survival fixture');
    n.values.thirst = 0;
    Object.assign(health, {
      vigor: 0,
      wounds: actor.sheet.abilities.con,
      collapsed: false,
      hours: { dehydration: 11 },
    });
    step(sim);
    expect(actor.alive).toBe(true); // The daily owner has not committed this interval yet.
    const ctx = makeContext(sim.world, content, []);
    region.promoteCensusActor(sim.world, ctx, id);
    expect(actor.alive).toBe(false);
    expect(sim.world.region?.census?.members[id]?.death?.at).toBe(1440);
    expect(sim.world.region?.census?.members[id]?.death?.cause).toBe('thirst');
    expect(sim.world.log.events.some((e) => e.kind === 'needs.collapsed' && e.data.actorId === id)).toBe(true);
    const hash = stateHash(sim.world);
    region.promoteCensusActor(sim.world, ctx, id);
    expect(stateHash(sim.world)).toBe(hash);
    expect(region.censusConsumers(sim.world, actor.householdId)).not.toContain(id);
    expect(findNonIntegers(sim.world)).toEqual([]);
  });

  it('decays a named materialized memory only in its owning daily interval', () => {
    const sim = fresh();
    longRoad(sim);
    boundary(sim);
    sim.world.time = asGameMinute(1440);
    boundary(sim);
    const memory = witnessMemory(sim);
    const id = social.addMemory(sim.world, makeContext(sim.world, content, []), memory);
    if (id === null) throw new Error('No memory');
    const policy = social.memoryDecayPolicy(sim.world, content, memory);
    step(sim);
    expect(sim.world.social.memories[id]?.salience).toBe(memory.salience);
    region.promoteCensusActor(sim.world, makeContext(sim.world, content, []), memory.ownerId);
    expect(sim.world.social.memories[id]?.salience).toBe(social.decayMemorySnapshot(memory.salience, false, policy));
  });
});
