/** Authored census bridge. Identity is captured once; owning modules retain every live sheet and balance. */
import type { ActorId, HouseholdId } from '../ids.ts';
import { rowsOf } from '../ids.ts';
import type { World } from '../world.ts';
import { actorSite, processingBuckets } from './processing.ts';
import type { CensusState } from './state.ts';

/** Idempotent on old region saves too. Never runs population, stock or mind initialization. */
export function ensureCensus(world: World): CensusState | undefined {
  const region = world.region;
  if (!region) return undefined;
  if (region.census && region.census.version !== 1) throw new Error('Unsupported regional census version');
  const census: CensusState = region.census ?? {
    version: 1,
    source: 'authored-sheets',
    members: {},
    households: {},
    evidence: [],
  };
  for (const household of rowsOf(world.households)) {
    if (census.households[household.id]) continue;
    const siteId = world.places[household.homePlaceId]?.siteId ?? '';
    census.households[household.id] = {
      householdId: household.id,
      ref: `${siteId}/${household.key}`,
      siteId,
      memberIds: [...household.memberIds].sort((a, b) => a - b),
    };
  }
  for (const actor of rowsOf(world.actors)) {
    if (census.members[actor.id]) continue;
    const household = census.households[actor.householdId];
    if (!household) throw new Error(`Missing census household for ${actor.id}`);
    if (!household.memberIds.includes(actor.id)) {
      household.memberIds.push(actor.id);
      household.memberIds.sort((a, b) => a - b);
    }
    census.members[actor.id] = {
      actorId: actor.id,
      ref: `${household.siteId}/${actor.key}`,
      identity: {
        name: { ...actor.name },
        sex: actor.sex,
        born: actor.born,
        ancestryId: actor.ancestryId,
        presentsAsId: actor.presentsAsId,
        occupationId: actor.occupationId,
        languages: [...actor.sheet.languages],
        householdId: actor.householdId,
      },
      alive: actor.alive,
      observedThrough: world.time,
    };
  }
  region.census = census;
  refreshCensus(world);
  return census;
}

/** Copy durable death facts from survival, never from the rolling log. No inferred deaths or rerolls. */
export function refreshCensus(world: World): void {
  const census = world.region?.census;
  if (!census) return;
  for (const member of rowsOf(census.members)) {
    const actor = world.actors[member.actorId];
    if (!actor) continue;
    member.alive = member.alive && actor.alive && !member.death;
    member.observedThrough = Math.max(
      member.observedThrough,
      world.region?.dormant?.sites[actorSite(world, actor.id)]?.through ??
        world.region?.processing?.sites?.[actorSite(world, actor.id)]?.through ??
        world.time,
    );
    const death = world.needs.byActor[member.actorId]?.survival?.death;
    if (death) {
      member.alive = false;
      member.death ??= { at: death.at, cause: death.cause, placeId: death.placeId, eventId: death.eventId };
    }
  }
}

/** One ID per living consumer; materialized census members are never counted a second time. */
export function censusConsumers(world: World, householdId: HouseholdId): ActorId[] {
  const household = world.region?.census?.households[householdId];
  const members = household?.memberIds ?? world.households[householdId]?.memberIds ?? [];
  return [...new Set(members)]
    .filter((id) => world.actors[id]?.alive && world.region?.census?.members[id]?.alive !== false)
    .sort((a, b) => a - b);
}

/** Birth is authoritative: age advances with objective time, without accumulated rounding. */
export function censusAgeDays(world: World, actorId: ActorId): number | null {
  const born = world.region?.census?.members[actorId]?.identity.born;
  return born === undefined ? null : Math.max(0, Math.floor((world.time - born) / 1440));
}

/** Hourly sheets exclude absent sites whose saved intervals belong to the daily kernel. */
export function hourlyActorIds(world: World): ActorId[] {
  return processingBuckets(world).hourly.actors;
}
