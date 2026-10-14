/** Foundation's scoped population hook. No whole-world reinitialization or stock seeding. */

import { initActivityState } from '../activity/state.ts';
import type { ActorCore } from '../actor.ts';
import { type ActorId, asActorId, asPlaceId, type HouseholdId, rowsOf } from '../ids.ts';
import { initNeedsState } from '../needs/state.ts';
import { emptyNutrition } from '../provisions/state.ts';
import { initPsycheState } from '../psyche/state.ts';
import { hashString32, mixKey, rng } from '../rng.ts';
import type { World } from '../world.ts';
import type { InitContext, SimContext } from './context.ts';

/** Identity key includes canonical birth time and parent, not materialization time/order.
 * A disjoint id band avoids consuming arrival-order-dependent ordinary entity counters.
 * A hash collision fails explicitly rather than renaming an already known person. */
export function installRegionalBirth(world: World, ctx: SimContext, motherId: ActorId, key: string): ActorId {
  const known = world.index.actorByKey[key];
  if (known !== undefined) return known;
  const mother = world.actors[motherId];
  if (!mother) throw new Error('Birth requires a persistent parent');
  const identity = mixKey(world.region?.worldSeed ?? ctx.seed, hashString32(key));
  const id = asActorId(1_000_000_000 + identity);
  if (world.actors[id]) throw new Error('Regional identity collision');
  const draw = rng(world.region?.worldSeed ?? ctx.seed, 'census', 0, identity);
  const sex = draw.int(0, 1) ? 'female' : 'male';
  const pools = Object.keys(ctx.content.namePools ?? {})
    .sort()
    .flatMap((key) => {
      const pool = ctx.content.namePools?.[key];
      return pool?.peoples.includes(mother.presentsAsId) ? [pool] : [];
    });
  const pool =
    pools.find((p) => p.given_female.includes(mother.name.given) || p.family.includes(mother.name.family)) ?? pools[0];
  const given = draw.pick(sex === 'female' ? (pool?.given_female ?? []) : (pool?.given_male ?? [])) ?? 'Child';
  const actor: ActorCore = {
    ...mother,
    id,
    key,
    name: { given, family: mother.name.family },
    born: ctx.now,
    sex,
    occupationId: 'child',
    traits: [],
    values: { ...mother.values },
    alive: true,
    controller: 'ai',
    placeId: world.households[mother.householdId]?.homePlaceId ?? mother.placeId,
    sheet: {
      abilities: { ...mother.sheet.abilities },
      skills: {},
      level: 1,
      feats: [],
      conditions: [],
      languages: [...mother.sheet.languages],
      literate: false,
    },
  };
  world.actors[id] = actor;
  world.index.actorByKey[key] = id;
  world.households[mother.householdId]?.memberIds.push(id);
  const scenario = ctx.content.scenarios[world.meta.scenarioId];
  if (!scenario) throw new Error('Population hook needs the pinned scenario');
  const init: InitContext = {
    ...ctx,
    scenario: { ...scenario, actors: [], households: [], relationships: [], figures: [], grudges: [], stocks: [] },
  };
  const local: World = {
    ...world,
    actors: { [id]: actor },
    activity: { ...world.activity, byActor: {}, occupancy: {} },
  };
  initNeedsState(local, init);
  initPsycheState(local, init);
  initActivityState(local, init);
  const activity = local.activity.byActor[id];
  if (activity) world.activity.byActor[id] = activity;
  world.provisions.nutrition[id] = emptyNutrition(ctx.cal.dayIndex);
  world.provisions.purses[id] = 0;
  if (world.region) {
    const placeId = asPlaceId(id);
    if (world.places[placeId]) throw new Error('Regional transit identity collision');
    world.places[placeId] = {
      id: placeId,
      defId: `transit_${id}`,
      siteId: `transit_${id}`,
      name: 'On the road',
      kind: 'road',
      tags: ['outdoor'],
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      rotation: 0,
      capacity: 1,
      model: null,
      faeIntensity: 0,
    };
    world.region.transit[id] = placeId;
  }
  world.social.relationships.push({ a: motherId, b: id, kind: 'parent', since: ctx.now, amountCents: null });
  return id;
}

export function changeRegionalHousehold(world: World, actorId: ActorId, householdId: HouseholdId): void {
  const actor = world.actors[actorId],
    next = world.households[householdId];
  if (!actor || !next || world.households[actor.householdId]?.headId === actorId) return;
  const previous = world.households[actor.householdId];
  if (previous) previous.memberIds = previous.memberIds.filter((id) => id !== actorId);
  actor.householdId = householdId;
  if (!next.memberIds.includes(actorId)) next.memberIds.push(actorId);
  const member = world.region?.census?.members[actorId];
  if (member) member.identity.householdId = householdId;
  for (const row of rowsOf(world.region?.census?.households ?? {})) {
    row.memberIds = row.memberIds.filter((id) => id !== actorId);
    if (row.householdId === householdId) row.memberIds.push(actorId);
  }
}
