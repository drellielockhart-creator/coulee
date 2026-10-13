/** Processing ownership is independent of presentation/relevance. Never infer it from selected T2. */
import { type ActorId, type HouseholdId, idsOf } from '../ids.ts';
import type { World } from '../world.ts';

export type ProcessingOwner = 'hourly' | 'daily';
export interface ProcessingState {
  version: 1;
  /** One bounded receipt per household, not an append-only history of routine work. */
  householdEconomy: Record<number, { day: number; owner: ProcessingOwner }>;
}

/** A household cannot split ownership while its members share meals, fuel and money.
 * Daily remains empty until all physical AND named-mind executors can honor the partition. */
export function processingBuckets(world: World): {
  hourly: { actors: ActorId[]; households: HouseholdId[] };
  daily: { actors: ActorId[]; households: HouseholdId[] };
} {
  return {
    hourly: { actors: idsOf<ActorId>(world.actors), households: idsOf<HouseholdId>(world.households) },
    daily: { actors: [], households: [] },
  };
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
  // Fail closed: no caller can run a second coarse executor alongside retained hourly work.
  if (owner !== 'hourly') throw new Error('Daily processing is not enabled; hourly executors own this interval');
  const region = world.region;
  if (!region) return true;
  validateRegionState(world);
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
}
