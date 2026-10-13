import {
  activity,
  asGameMinute,
  type Command,
  createSim,
  findNonIntegers,
  installSite,
  items,
  makeContext,
  provisions,
  psyche,
  restoreSim,
  type Sim,
  stateHash,
  step,
  toViewModel,
} from '@coulee/core';
import { PlaySession, parseText, renderDetail, renderObservation, sessionSimOf } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { baseContent } from './helpers.ts';

const content = baseContent();
const order: activity.TravelOrder = {
  destinationNodeId: 'cedar_farm',
  edgeIds: ['cedar_road'],
  pace: 'walk',
  campPolicy: 'ask',
};
function ready() {
  const session = PlaySession.create(content, { source: 'iron_ford_neighbors', seed: 42 });
  const sim = sessionSimOf(session),
    id = session.playerId;
  sim.world.time = asGameMinute(360);
  const needs = sim.world.needs.byActor[id];
  if (needs) {
    needs.values.rest = 1000;
    needs.values.hunger = 400;
    needs.values.thirst = 550;
  }
  return { session, sim, id };
}
function arrive(sim: Sim, id: PlaySession['playerId']) {
  for (let hour = 0; hour < 24 && activity.onJourney(sim.world, id); hour++) step(sim);
  expect(sim.world.activity.journeys?.[id]?.status).toBe('arrived');
}
function carriedWater(sim: Sim, id: PlaySession['playerId']) {
  return Object.values(sim.world.items.stacks)
    .filter((s) => {
      const r = items.rootOf(sim.world, s);
      return r.kind === 'actor' && r.actorId === id;
    })
    .reduce((n, s) => n + (s.waterMl ?? 0), 0);
}
describe('M5 walk to the neighbor', () => {
  it('CLI midnight route forecasts arrival and supplies, labels unrolled checks and suggests dawn', () => {
    const session = PlaySession.create(content, { source: 'iron_ford_neighbors', seed: 42 });
    const sim = sessionSimOf(session);
    const before = session.hash;
    const command = parseText('route Cedar Farm', session.observe());
    if (typeof command === 'string') throw new Error(command);
    const result = session.act(command);
    const forecast = result.detail as provisions.TripReadiness;
    const text = renderDetail(forecast);
    expect(result.ok).toBe(true);
    expect(result.elapsedMinutes).toBe(0);
    expect(session.hash).toBe(before);
    expect(forecast.arrived).toBe(true);
    expect(forecast.elapsedMinutes).toBe(360);
    expect(forecast.walkingMinutes).toBe(313);
    expect(text).toContain('arrival 1855-04-01 06:00');
    expect(forecast.waterUsedMl).toBeGreaterThan(0);
    expect(text).toContain('crossings: none recorded');
    expect(text).toContain('Weather: 55°F, dry');
    expect(text).toContain('Night/dark travel');
    expect(text).toContain('Uncertain vermin check at 00:00, day 1, on Cedar Ridge Road');
    expect(text).toContain('assumes no loss');
    expect(text).toContain('resupply delay');
    expect(text).toContain('leaving at dawn');
    expect(text).not.toContain('forecast stops');
    expect(renderDetail(session.act(command).detail)).toBe(text);
    expect(findNonIntegers(sim.world)).toEqual([]);
    // This seed incurs no loss: the conditional forecast agrees with the real midnight journey.
    const water = carriedWater(sim, session.playerId);
    session.act({ kind: 'activity.travel', actorId: session.playerId, data: order });
    arrive(sim, session.playerId);
    expect(sim.world.time).toBe(forecast.arrivalTime);
    expect(water - carriedWater(sim, session.playerId)).toBe(forecast.waterUsedMl);
  });
  it('CLI route names crossings and hazards even when travel requires an unsupported decision', () => {
    const { session, sim } = ready();
    if (!sim.world.region) throw new Error('Missing region');
    sim.world.region.definition = structuredClone(sim.world.region.definition);
    const edge = sim.world.region.definition.edges[0];
    if (!edge) throw new Error('Missing road');
    edge.crossings = ['Cedar Creek ford'];
    edge.hazards = ['flooded approach'];
    sim.world.region.definition.fixed_weather = { temperature_f: 45, raining: true };
    const before = session.hash;
    const command = parseText('route Cedar Farm', session.observe());
    if (typeof command === 'string') throw new Error(command);
    const text = renderDetail(session.act(command).detail);
    expect(text).toContain('crossings: Cedar Creek ford; hazards: flooded approach');
    expect(text).toContain('assumes passage without delay');
    expect(text).toContain('45°F, rain');
    expect(text).toContain('arrival 1855-04-01');
    expect(session.hash).toBe(before);
    expect(activity.travelCheck(sim.world, sim.content, session.playerId, order)).toContain('not supported yet');
  });
  it('CLI preview labels exhausted water while still showing the whole conditional itinerary', () => {
    const { session, sim, id } = ready();
    for (const stack of Object.values(sim.world.items.stacks)) {
      const root = items.rootOf(sim.world, stack);
      if (root.kind === 'actor' && root.actorId === id) stack.waterMl = 0;
    }
    const before = session.hash;
    const command = parseText('route Cedar Farm', session.observe());
    if (typeof command === 'string') throw new Error(command);
    const forecast = session.act(command).detail as provisions.TripReadiness;
    expect(forecast.arrived).toBe(true);
    expect(forecast.elapsedMinutes).toBeGreaterThan(60);
    expect(renderDetail(forecast)).toContain('Carried water is exhausted');
    expect(renderDetail(forecast)).toContain('arrival 1855-04-01');
    expect(session.hash).toBe(before);
    // Live travel still stops at the shortage, despite the conditional forecast continuing.
    session.act({ kind: 'activity.travel', actorId: id, data: order });
    expect(sim.world.activity.journeys?.[id]?.status).toBe('stopped');
  });
  it('CLI transit prose names the road and terrain, and respects night and daylight visibility', () => {
    for (const [departure, visibility] of [
      [0, 'In the dark'],
      [360, 'In daylight'],
    ] as const) {
      const { session, sim, id } = ready();
      sim.world.time = asGameMinute(departure);
      const command = parseText('travel Cedar Farm', session.observe());
      if (typeof command === 'string') throw new Error(command);
      const observation = session.act(command).observation;
      const text = renderObservation(observation);
      expect(observation.place.description).toContain('Cedar Ridge Road, toward Cedar Farm');
      expect(observation.place.description).toContain('wooded slopes');
      expect(observation.place.description).toContain('farm clearings');
      expect(observation.place.description).toContain(visibility);
      expect(text).not.toContain('Spring at On the road');
      expect(text).not.toContain('paths about On the road');
      session.act({ kind: 'activity.stop', actorId: id, data: {} });
      expect(session.observe().place.description).toContain('Cedar Ridge Road');
    }
  });
  it('CLI road Appetite offers the carried-water drink command when there is no nearby source', () => {
    const session = PlaySession.create(content, { source: 'iron_ford_neighbors', seed: 42 });
    for (const line of ['travel Cedar Farm', 'wait 3h']) {
      const command = parseText(line, session.observe());
      if (typeof command === 'string') throw new Error(command);
      expect(session.act(command).ok).toBe(true);
    }
    const sim = sessionSimOf(session),
      observation = session.observe();
    expect(provisions.nearestWaterSource(sim.world, sim.content, session.playerId)).toBe(null);
    const text = renderObservation(observation);
    expect(text).toContain('Appetite: Drink from carried water');
    expect(text).toContain('you may: drink)');
    expect(text).not.toContain('you may: fetch water');
    const command = parseText('drink', observation);
    if (typeof command === 'string') throw new Error(command);
    expect(command.kind).toBe('provisions.drink');
    expect(session.act(command).ok).toBe(true);
  });
  it('installs scoped geometry idempotently, initializes both populations once, and leaves absent regions absent', () => {
    const { sim } = ready();
    const before = stateHash(sim.world);
    installSite(sim.world, content, 'cedar_farm');
    expect(stateHash(sim.world)).toBe(before);
    expect(sim.world.index.actorByKey.cedar_farm_martha).toBeDefined();
    const legacy = createSim(content, { scenarioId: 'iron_ford', seed: 42 });
    expect(legacy.world.region).toBeUndefined();
    expect(legacy.world.activity.journeys).toBeUndefined();
  });
  it('goes outbound and returns without reseeding identities or stores', () => {
    const { sim, id } = ready();
    const actors = Object.keys(sim.world.actors);
    step(sim, [{ kind: 'activity.travel', actorId: id, data: order }]);
    arrive(sim, id);
    expect(sim.world.actors[id]?.placeId).toBe(sim.world.index.placeByDef.cedar_farm_gate);
    const rest = sim.world.needs.byActor[id];
    if (rest) rest.values.rest = 1000;
    step(sim, [{ kind: 'activity.travel', actorId: id, data: { ...order, destinationNodeId: 'iron_ford' } }]);
    arrive(sim, id);
    expect(sim.world.actors[id]?.placeId).toBe(sim.world.index.placeByDef.dunleavys_tavern);
    expect(Object.keys(sim.world.actors)).toEqual(actors);
    expect(findNonIntegers(sim.world)).toEqual([]);
  });
  it('save/load and fork are bit-identical mid-edge, including the integer carry', () => {
    const { session, sim, id } = ready();
    // Replayable session: start from canonical time for this test.
    sim.world.time = asGameMinute(0);
    const result = session.act({ kind: 'activity.travel', actorId: id, data: order });
    expect(result.ok).toBe(true);
    const loaded = PlaySession.load(content, session.save()),
      fork = session.fork();
    expect(session.hash).toBe(loaded.hash);
    expect(session.hash).toBe(fork.hash);
    for (let n = 0; n < 3; n++) {
      for (const s of [session, loaded, fork]) s.act({ kind: 'activity.wait', actorId: id, data: { minutes: 60 } });
      expect(session.hash).toBe(loaded.hash);
      expect(session.hash).toBe(fork.hash);
    }
    expect(findNonIntegers(sessionSimOf(session).world)).toEqual([]);
    const restored = restoreSim(sim.content, JSON.parse(JSON.stringify(sim.world)));
    step(restored);
    step(sim);
    expect(stateHash(restored.world)).toBe(stateHash(sim.world));
  });
  it('a fair preview is a zero-time query and its food, water, rest and nutrition match execution in fixed weather', () => {
    const { session, sim, id } = ready();
    const before = stateHash(sim.world);
    const command = parseText('route Cedar Farm', session.observe());
    expect(typeof command).not.toBe('string');
    const result = session.act(command as Command);
    expect(result.elapsedMinutes).toBe(0);
    expect(stateHash(sim.world)).toBe(before);
    const forecast = result.detail as provisions.TripReadiness;
    expect(forecast.arrived).toBe(true);
    expect(forecast.kcal).toBeGreaterThan(0);
    const startWater = carriedWater(sim, id),
      start = sim.world.time;
    const nutrition = structuredClone(sim.world.provisions.nutrition[id]?.today);
    step(sim, [{ kind: 'activity.travel', actorId: id, data: order }]);
    arrive(sim, id);
    expect(sim.world.time - start).toBe(forecast.elapsedMinutes);
    expect(startWater - carriedWater(sim, id)).toBe(forecast.waterUsedMl);
    for (const key of ['hunger', 'rest', 'thirst', 'warmth'])
      expect(sim.world.needs.byActor[id]?.values[key], key).toBe(forecast.needs[key]);
    for (const key of ['kcal', 'proteinG', 'fatG', 'freshPoints'] as const)
      expect((sim.world.provisions.nutrition[id]?.today[key] ?? 0) - (nutrition?.[key] ?? 0), key).toBe(forecast[key]);
  });
  it('cannot access a remote pantry, workplace, shop, hearth, or care relocation; road occupants and views are private', () => {
    const { sim, id, session } = ready();
    const origin = sim.world.actors[id]?.placeId;
    step(sim, [{ kind: 'activity.travel', actorId: id, data: order }]);
    expect(sim.world.actors[id]?.placeId).not.toBe(origin);
    expect(provisions.holderOfActor(sim.world, id)).toEqual({ actorId: id });
    expect(activity.resolveActivityPlace(sim.world, sim, id, 'work')).toBe(null);
    expect(activity.resolveActivityPlace(sim.world, sim, id, 'walk', origin)).toBe(null);
    expect(provisions.bestStore(sim.world, sim, id)).toBeUndefined();
    expect(activity.occupants(sim.world, sim.world.actors[id]?.placeId as never)).toEqual([]);
    const observation = session.observe();
    expect(observation.present).toEqual([]);
    expect(items.campContext(sim.world, sim.content, id).afield).toBe(true);
    expect(observation.places).toHaveLength(1);
    expect(observation.actions.some((a) => a.id.startsWith('go:'))).toBe(false);
    const vm = toViewModel(sim.world, sim.content, { perspective: id });
    expect(vm.places).toHaveLength(1);
    expect(vm.households).toHaveLength(0);
    activity.relocateForCare(sim.world, makeContext(sim.world, sim.content, []), id, origin as never);
    expect(sim.world.actors[id]?.placeId).not.toBe(origin);
  });
  it('a commanded actor needs a Command; NPC intention uses the same API and respects authorization', () => {
    const { sim, id } = ready();
    step(sim);
    expect(activity.onJourney(sim.world, id)).toBe(false);
    const ctx = makeContext(sim.world, sim.content, []);
    expect(activity.startJourney(sim.world, ctx, id, order, { kind: 'own' })).not.toBe(null);
    expect(activity.onJourney(sim.world, id)).toBe(false);
    const npc = sim.world.index.actorByKey.cedar_farm_martha;
    if (npc === undefined) throw new Error('Missing authored neighbor');
    expect(
      activity.startJourney(sim.world, ctx, npc, { ...order, destinationNodeId: 'iron_ford' }, { kind: 'own' }),
    ).toBe(null);
    expect(activity.onJourney(sim.world, npc)).toBe(true);
    psyche.setAgency(sim.world, npc, {
      ...psyche.agencyOf(sim.world, npc),
      mode: 'commanded',
      issuer: { kind: 'player' },
    });
    const before = sim.world.activity.journeys?.[npc]?.feet;
    step(sim);
    expect(sim.world.activity.journeys?.[npc]?.feet).toBe(before);
  });
  it('stops, resumes, turns back and rejects stale orders without charging time', () => {
    const { session, sim, id } = ready();
    session.act({ kind: 'activity.travel', actorId: id, data: order });
    const feet = sim.world.activity.journeys?.[id]?.feet;
    expect(session.act({ kind: 'activity.stop', actorId: id, data: {} }).ok).toBe(true);
    expect(sim.world.activity.journeys?.[id]?.feet).toBe(feet);
    expect(session.act({ kind: 'activity.resume', actorId: id, data: {} }).ok).toBe(true);
    expect(session.act({ kind: 'activity.turn_back', actorId: id, data: {} }).ok).toBe(true);
    arrive(sim, id);
    const before = session.hash;
    expect(session.act({ kind: 'activity.resume', actorId: id, data: {} }).elapsedMinutes).toBe(0);
    expect(session.hash).toBe(before);
  });
  it('wait interrupts at arrival and camp decisions; a camp uses real rest hours', () => {
    const { session, sim, id } = ready();
    session.act({ kind: 'activity.travel', actorId: id, data: order });
    const j = sim.world.activity.journeys?.[id];
    if (j) j.dailyWalkingMinutes = 480;
    const result = session.act({ kind: 'activity.wait', actorId: id, data: { minutes: 600 } });
    expect(result.elapsedMinutes).toBe(60);
    expect(result.interrupts.some((i) => i.reason.includes('camp'))).toBe(true);
    const rest = sim.world.needs.byActor[id]?.values.rest ?? 0;
    session.act({ kind: 'activity.camp', actorId: id, data: {} });
    expect(sim.world.needs.byActor[id]?.values.rest).toBeGreaterThan(rest);
  });
});

describe('road boundaries and fair knowledge', () => {
  it('rejects a disconnected, closed, unknown or boat route without spending time', () => {
    const { session, sim, id } = ready();
    for (const data of [
      { ...order, edgeIds: ['missing'] },
      { ...order, destinationNodeId: 'iron_ford' },
    ]) {
      const before = session.hash;
      const result = session.act({ kind: 'activity.travel', actorId: id, data });
      expect(result.ok).toBe(false);
      expect(result.elapsedMinutes).toBe(0);
      expect(session.hash).toBe(before);
    }
    if (sim.world.region) sim.world.region.definition = structuredClone(sim.world.region.definition);
    const edge = sim.world.region?.definition.edges[0];
    if (!edge) throw new Error('Missing road');
    edge.capability = 'boat';
    expect(activity.travelCheck(sim.world, sim.content, id, order)).toContain('unsupported transport');
  });
  it('turns back twice toward the correct entrance and does not teleport to an old destination', () => {
    const { sim, id } = ready();
    step(sim, [{ kind: 'activity.travel', actorId: id, data: order }]);
    step(sim);
    step(sim, [{ kind: 'activity.turn_back', actorId: id, data: {} }]);
    step(sim, [{ kind: 'activity.turn_back', actorId: id, data: {} }]);
    arrive(sim, id);
    expect(sim.world.actors[id]?.placeId).toBe(sim.world.index.placeByDef.cedar_farm_gate);
  });
  it('stops for exhausted water and cannot eat from a rich remote pantry', () => {
    const { sim, id } = ready();
    for (const s of Object.values(sim.world.items.stacks)) {
      const root = items.rootOf(sim.world, s);
      if (root.kind === 'actor' && root.actorId === id) {
        if (sim.content.items[s.defId]?.food) delete sim.world.items.stacks[s.id];
        else s.waterMl = 0;
      }
    }
    const actor = sim.world.actors[id];
    if (!actor) throw new Error('Missing actor');
    items.createStack(
      sim.world,
      makeContext(sim.world, sim.content, []),
      'pemmican',
      30,
      items.pantryOf(actor.householdId),
    );
    const pantry = items
      .stacksDeep(sim.world, items.pantryOf(actor.householdId))
      .map(({ stack: s }) => ({ id: s.id, qty: s.qty, partial: s.partial }));
    step(sim, [{ kind: 'activity.travel', actorId: id, data: order }]);
    expect(sim.world.activity.journeys?.[id]?.pendingInterruption).toContain('water is exhausted');
    expect(sim.world.provisions.nutrition[id]?.today.kcal).toBe(0);
    expect(
      items
        .stacksDeep(sim.world, items.pantryOf(actor.householdId))
        .map(({ stack: s }) => ({ id: s.id, qty: s.qty, partial: s.partial })),
    ).toEqual(pantry);
  });
  it('extinguishes a stopped roadside fire before walking so heat cannot follow the traveler', () => {
    const { sim, id, session } = ready();
    step(sim, [{ kind: 'activity.travel', actorId: id, data: order }]);
    step(sim, [{ kind: 'activity.stop', actorId: id, data: {} }]);
    const place = sim.world.actors[id]?.placeId;
    if (place === undefined) throw new Error('Missing traveler');
    sim.world.provisions.fires[place] = { placeId: place, lit: true, fuelMinutes: 240, until: sim.world.time + 240 };
    const feet = sim.world.activity.journeys?.[id]?.feet;
    expect(session.act({ kind: 'activity.resume', actorId: id, data: {} }).ok).toBe(true);
    expect(sim.world.activity.journeys?.[id]?.feet).toBeGreaterThan(feet ?? 0);
    expect(sim.world.provisions.fires[place]?.lit).toBe(false);
    step(sim, [{ kind: 'activity.stop', actorId: id, data: {} }]);
    expect(sim.world.provisions.fires[place]?.fuelMinutes).toBe(0);
  });
  it('replays fair Commands from a canonical new session, including a mid-edge camp', () => {
    const session = PlaySession.create(content, { source: 'iron_ford_neighbors', seed: 43 });
    const id = session.playerId;
    for (const command of [
      { kind: 'activity.observe', actorId: id, data: { query: 'route', target: 'cedar_farm' } },
      { kind: 'activity.travel', actorId: id, data: order },
      { kind: 'activity.stop', actorId: id, data: {} },
      { kind: 'activity.camp', actorId: id, data: {} },
      { kind: 'activity.wait', actorId: id, data: { minutes: 480 } },
    ] as Command[])
      expect(session.act(command).ok).toBe(true);
    expect(PlaySession.replay(content, session.commandLog).hash).toBe(session.hash);
  });
});
