import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { ensureCensus } from './census.ts';
import { updateProcessingOwners } from './coarse.ts';
import { decayCensusEvidence, hydrateCensusEvidence } from './evidence.ts';
import { selectRegionTiers } from './lod.ts';

/** Region boundary hook: select owners, settle due physical intervals, and hydrate resolved evidence.
 * Runs after journey settlement at each completed boundary, including tactical frames. */
export function regionSystem(world: World, ctx: SimContext): void {
  if (!world.region) return;
  ensureCensus(world);
  selectRegionTiers(world);
  updateProcessingOwners(world, ctx);
  ensureCensus(world);
  decayCensusEvidence(world);
  const pending = new Set(
    (world.region.census?.evidence ?? [])
      .filter(
        (e) =>
          e.hydratedMemoryId === null &&
          e.decay?.forgottenAt == null &&
          (world.region?.lod?.actors[e.memory.ownerId]?.selected !== 'T2' || world.time - e.memory.at >= 2880),
      )
      .map((e) => e.memory.ownerId),
  );
  for (const id of [...pending].sort((a, b) => a - b)) hydrateCensusEvidence(world, ctx, id);
}
