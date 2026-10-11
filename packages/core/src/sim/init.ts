/**
 * World creation from a scenario. FOUNDATION-OWNED (module inits are called in order).
 */

import { createActivityState, initActivityState } from '../activity/state.ts';
import type { ActorCore, Values } from '../actor.ts';
import { createBeliefState, initBeliefState } from '../belief/state.ts';
import { createChronicleState, initChronicleState } from '../chronicle/state.ts';
import { type ContentBundle, VALUES } from '../content.ts';
import { appendEvent, type EventInput, emptyLog } from '../events/index.ts';
import { asActorId, asHouseholdId, asPlaceId, type HouseholdId, mustGet, nextId, type PlaceId } from '../ids.ts';
import { createItemsState, initItemsState } from '../items/state.ts';
import { createNeedsState, initNeedsState } from '../needs/state.ts';
import { createProvisionsState, initProvisionsState } from '../provisions/state.ts';
import { createPsycheState, initPsycheState } from '../psyche/state.ts';
import { mixKey, rng, type Stream } from '../rng.ts';
import { createSocialState, initSocialState } from '../social/state.ts';
import { addDays, parseGameDate } from '../time.ts';
import type { World } from '../world.ts';
import type { InitContext } from './context.ts';

export interface CreateWorldOptions {
  scenarioId: string;
  /** Any integer; folded to uint32. */
  seed: number;
  /** Give the scenario's `player` actor controller 'player' (web). CLI runs all-AI. */
  withPlayer?: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Module init order (state creation happens first for all slices, then these run in order). */
const MODULE_INITS = [
  initNeedsState,
  initActivityState,
  initPsycheState,
  initSocialState,
  initBeliefState,
  initItemsState,
  initProvisionsState,
  initChronicleState,
] as const;

export function createWorld(content: ContentBundle, opts: CreateWorldOptions): World {
  const scenario = content.scenarios[opts.scenarioId];
  if (!scenario) {
    throw new Error(`unknown scenario '${opts.scenarioId}' (have: ${Object.keys(content.scenarios).join(', ')})`);
  }
  const seed = opts.seed >>> 0;
  const start = parseGameDate(scenario.start);

  const world: World = {
    meta: { format: 1, seed, scenarioId: scenario.id, contentHash: content.meta.hash, playerId: null },
    time: start,
    counters: { actor: 0, household: 0, place: 0 },
    actors: {},
    households: {},
    places: {},
    index: { actorByKey: {}, householdByKey: {}, placeByDef: {} },
    log: emptyLog(),
    needs: createNeedsState(),
    activity: createActivityState(),
    psyche: createPsycheState(),
    social: createSocialState(),
    belief: createBeliefState(),
    items: createItemsState(),
    provisions: createProvisionsState(),
    chronicle: createChronicleState(),
  };

  // Places of the scenario's site, in content order.
  for (const def of Object.values(content.places)) {
    if (def.site !== scenario.site) continue;
    const id = asPlaceId(nextId(world.counters, 'place'));
    const site = content.sites[def.site];
    world.places[id] = {
      id,
      defId: def.id,
      siteId: def.site,
      name: def.name,
      kind: def.kind,
      tags: [...def.tags],
      x: def.x,
      y: def.y,
      w: def.w,
      h: def.h,
      rotation: def.rotation,
      capacity: def.capacity,
      model: def.model ?? null,
      faeIntensity: def.fae_intensity ?? site?.fae_intensity ?? 0,
    };
    world.index.placeByDef[def.id] = id;
  }
  const placeOf = (defId: string): PlaceId => {
    const id = world.index.placeByDef[defId];
    if (id === undefined)
      throw new Error(`scenario ${scenario.id}: place '${defId}' is not on site '${scenario.site}'`);
    return id;
  };

  for (const h of scenario.households) {
    const id = asHouseholdId(nextId(world.counters, 'household'));
    world.households[id] = {
      id,
      key: h.key,
      name: h.name,
      headId: asActorId(0),
      memberIds: [],
      homePlaceId: placeOf(h.home),
    };
    world.index.householdByKey[h.key] = id;
  }

  scenario.actors.forEach((s, i) => {
    const id = asActorId(nextId(world.counters, 'actor'));
    const householdId = world.index.householdByKey[s.household] as HouseholdId;
    const household = mustGet(world.households, householdId, 'household');
    const people = content.peoples[s.ancestry];
    const presentsAs = s.presents_as ?? (people?.concealed ? (people.passes_as[0] ?? s.ancestry) : s.ancestry);
    const values = {} as Values;
    for (const v of VALUES) values[v] = s.values[v] ?? 0;
    for (const t of s.traits) {
      const def = content.traits[t];
      if (!def) continue;
      for (const v of VALUES) values[v] = clamp(values[v] + (def.values[v] ?? 0), -3, 3);
    }
    // Birthday: deterministic day within the birth year (worldgen stream, keyed by actor index).
    const dayOffset = rng(seed, 'worldgen', 0, mixKey(i, 0xb1)).int(0, 364);
    const born = addDays(start, -(s.age * 365 + dayOffset));
    const actor: ActorCore = {
      id,
      key: s.key,
      name: { given: s.given, family: s.family, ...(s.nickname ? { nickname: s.nickname } : {}) },
      sex: s.sex,
      born,
      ancestryId: s.ancestry,
      presentsAsId: presentsAs,
      occupationId: s.occupation,
      householdId,
      placeId: s.place ? placeOf(s.place) : household.homePlaceId,
      values,
      traits: [...s.traits],
      sheet: {
        abilities: { ...s.abilities },
        skills: { ...s.skills },
        level: 1,
        feats: [],
        conditions: [],
        languages: [...s.languages],
        literate: s.literate,
      },
      controller: opts.withPlayer === true && scenario.player === s.key ? 'player' : 'ai',
      alive: true,
    };
    world.actors[id] = actor;
    world.index.actorByKey[s.key] = id;
    household.memberIds.push(id);
    if (actor.controller === 'player') world.meta.playerId = id;
  });
  for (const h of scenario.households) {
    const hh = mustGet(world.households, world.index.householdByKey[h.key] as HouseholdId, 'household');
    hh.headId = world.index.actorByKey[h.head] ?? hh.memberIds[0] ?? asActorId(0);
  }

  const now = world.time;
  const ctx: InitContext = {
    content,
    scenario,
    seed,
    now,
    rng: (stream: Stream, key: number) => rng(seed, stream, now, key),
    emit: (e: EventInput) => appendEvent(world.log, e, now),
  };
  for (const init of MODULE_INITS) init(world, ctx);

  ctx.emit({
    kind: 'core.world_created',
    data: { scenarioId: scenario.id, seed, actorCount: scenario.actors.length },
  });
  return world;
}
