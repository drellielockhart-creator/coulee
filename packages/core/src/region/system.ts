import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { ensureCensus } from './census.ts';
import { hydrateCensusEvidence } from './evidence.ts';
import { selectRegionTiers } from './lod.ts';

/** Region boundary hook. Metadata and already-resolved evidence only: never duplicates an hourly executor.
 * Runs after journey settlement at each completed boundary, including tactical frames. */
export function regionSystem(world: World, ctx: SimContext): void {
  if (!world.region) return;
  ensureCensus(world);
  selectRegionTiers(world);
  const pending = new Set(
    (world.region.census?.evidence ?? [])
      .filter(
        (e) =>
          e.hydratedMemoryId === null &&
          (world.region?.lod?.actors[e.memory.ownerId]?.selected !== 'T2' || world.time - e.memory.at >= 2880),
      )
      .map((e) => e.memory.ownerId),
  );
  for (const id of [...pending].sort((a, b) => a - b)) hydrateCensusEvidence(world, ctx, id);
}
