/** Processing ownership is independent of presentation/relevance. Never infer it from selected T2. */
import { type ActorId, type HouseholdId, idsOf, type PlaceId, rowsOf } from '../ids.ts';
import { rootLocation } from '../items/containers.ts';
import type { ItemStack } from '../items/state.ts';
import type { World } from '../world.ts';

export type ProcessingOwner = 'hourly' | 'daily';
export interface ProcessingState {
  version: 1;
  /** The next unresolved physical hour, grouped by independent site. */
  sites?: Record<string, { through: number; since: number }>;
  beliefCompartments?: Record<string, { at: number; adults: number; holders: Record<number, number> }>;
  /** One bounded receipt per household, retained across promotion. */
  householdEconomy: Record<number, { day: number; owner: ProcessingOwner }>;
}

/** Execution scopes are synchronous, never saved, and never shared between worlds. */
/** Membership is stable during one physical substep; lists are rebuilt at the next hour.
 * Actor liveness, position and mutable inventory are always read live by executors. */
interface ProcessingScope {
  sites: ReadonlySet<string>;
  actors?: ActorId[];
  households?: World['households'][number][];
  places?: World['places'][number][];
}
const scopes = new Map<World, ProcessingScope>();
export function withDailySites<T>(world: World, sites: ReadonlySet<string>, run: () => T): T {
  const previous = scopes.get(world);
  scopes.set(world, { sites });
  try {
    return run();
  } finally {
    if (previous) scopes.set(world, previous);
    else scopes.delete(world);
  }
}
export function isDailyProcessing(world: World): boolean {
  return scopes.has(world);
}
export function processesSite(world: World, site: string): boolean {
  if (!world.region) return true;
  const scope = scopes.get(world);
  return scope ? scope.sites.has(site) : !world.region.processing?.sites?.[site];
}
export function actorSite(world: World, id: number): string {
  const actor = world.actors[id];
  return world.places[world.households[actor?.householdId ?? 0]?.homePlaceId ?? 0]?.siteId ?? '';
}
export function processesActor(world: World, id: number): boolean {
  return !world.region || processesSite(world, actorSite(world, id));
}
export function processesHousehold(world: World, id: number): boolean {
  return !world.region || processesSite(world, world.places[world.households[id]?.homePlaceId ?? 0]?.siteId ?? '');
}
export function processesPlace(world: World, id: number): boolean {
  return !world.region || processesSite(world, world.places[id]?.siteId ?? '');
}
export function processingActorIds(world: World): ActorId[] {
  const scope = scopes.get(world);
  if (scope?.actors) return [...scope.actors];
  const actors = idsOf<ActorId>(world.actors).filter((id) => processesActor(world, id));
  if (scope) scope.actors = [...actors];
  return actors;
}
export function processingActors(world: World) {
  return processingActorIds(world)
    .map((id) => world.actors[id])
    .filter((a) => a !== undefined);
}
export function processingHouseholds(world: World) {
  const scope = scopes.get(world);
  if (scope?.households) return scope.households;
  const households = rowsOf(world.households).filter((h) => processesHousehold(world, h.id));
  if (scope) scope.households = households;
  return households;
}
export function processingPlaces(world: World) {
  const scope = scopes.get(world);
  if (scope?.places) return scope.places;
  const places = rowsOf<PlaceId, World['places'][number]>(world.places).filter((p) => processesPlace(world, p.id));
  if (scope) scope.places = places;
  return places;
}
/** One owner per entire site: shared pantries, venues and local transfers cannot split. */
export function processingBuckets(world: World): {
  hourly: { actors: ActorId[]; households: HouseholdId[] };
  daily: { actors: ActorId[]; households: HouseholdId[] };
} {
  const hourly = { actors: [] as ActorId[], households: [] as HouseholdId[] };
  const daily = { actors: [] as ActorId[], households: [] as HouseholdId[] };
  for (const id of idsOf<ActorId>(world.actors))
    (world.region?.processing?.sites?.[actorSite(world, id)] ? daily : hourly).actors.push(id);
  for (const h of rowsOf(world.households))
    (world.region?.processing?.sites?.[world.places[h.homePlaceId]?.siteId ?? ''] ? daily : hourly).households.push(
      h.id,
    );
  return { hourly, daily };
}

/** Shared daily economy entry point calls this BEFORE drawing any stock or changing rations.
 * Promotion never deletes receipts. Legacy non-region worlds retain their exact execution path. */
export function claimHouseholdEconomyDay(
  world: World,
  householdId: HouseholdId,
  at: number,
  owner: ProcessingOwner,
): boolean {
  if (!Number.isSafeInteger(at) || Object.is(at, -0) || at < 0 || at % 1440 !== 0 || !world.households[householdId])
    throw new Error('Household economy requires a household and canonical day boundary');
  const daily =
    !!world.region?.processing?.sites?.[world.places[world.households[householdId]?.homePlaceId ?? 0]?.siteId ?? ''];
  if ((owner === 'daily') !== daily || !processesHousehold(world, householdId))
    throw new Error('Household processing owner mismatch');
  const region = world.region;
  if (!region) return true;
  if (!isDailyProcessing(world)) validateRegionState(world);
  region.processing ??= { version: 1, householdEconomy: {} };
  const processing = region.processing;
  const day = at / 1440;
  const previous = processing.householdEconomy[householdId];
  if (previous) {
    if (day < previous.day) throw new Error('Household economy cannot replay an earlier interval');
    if (day === previous.day) return false;
  }
  processing.householdEconomy[householdId] = { day, owner };
  return true;
}

/** Restore validates supported formats without upgrading or mutating a save during a read. */
export function validateRegionState(world: World): void {
  const region = world.region;
  if (!region) return;
  if (region.version !== 1) throw new Error('Unsupported regional version');
  if (region.census && region.census.version !== 1) throw new Error('Unsupported regional census version');
  if (region.lod && region.lod.version !== 1) throw new Error('Unsupported regional LOD version');
  if (region.processing && region.processing.version !== 1) throw new Error('Unsupported regional processing version');
  for (const cursor of Object.values(region.processing?.sites ?? {}))
    if (
      !Number.isSafeInteger(cursor.through) ||
      !Number.isSafeInteger(cursor.since) ||
      cursor.since < 0 ||
      cursor.through < cursor.since ||
      cursor.through > world.time ||
      cursor.through % 60 !== 0
    )
      throw new Error('Invalid regional processing cursor');
}

/** Storage and devices belong to the root holder, including nested containers. */
export function processesStack(world: World, stack: ItemStack): boolean {
  if (!world.region) return true;
  const root = rootLocation(world, stack);
  return root.kind === 'actor'
    ? processesActor(world, root.actorId)
    : root.kind === 'household'
      ? processesHousehold(world, root.householdId)
      : processesPlace(world, root.placeId);
}

/** Belief owns the calculation; region retains its site-addressed summary with the cursor. */
export function recordBeliefCompartment(
  world: World,
  site: string,
  at: number,
  adults: number,
  holders: Record<number, number>,
): void {
  const processing = world.region?.processing;
  if (!processing) return;
  processing.beliefCompartments ??= {};
  processing.beliefCompartments[site] = { at, adults, holders };
}
