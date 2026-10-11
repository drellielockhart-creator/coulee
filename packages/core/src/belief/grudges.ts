/**
 * Read-only grudge queries with no runtime imports (a leaf: activity reads it without closing an
 * import cycle through belief/api). OWNER: module:belief.
 */
import { type ActorId, type GrudgeId, type HouseholdId, idsOf } from '../ids.ts';
import type { World } from '../world.ts';

/**
 * Whom `holderId` bears a live grudge against (04 §5.4): actor ids and household ids, ascending.
 * For callers that keep the holder away from (or send them toward) the grudge's target.
 */
export function grudgeTargetsOf(world: World, holderId: ActorId): { actors: ActorId[]; households: HouseholdId[] } {
  const actors: ActorId[] = [];
  const households: HouseholdId[] = [];
  for (const id of idsOf<GrudgeId>(world.belief.grudges)) {
    const g = world.belief.grudges[id];
    if (!g || g.holderId !== holderId || g.intensity <= 0) continue;
    if (g.target.kind === 'actor' && !actors.includes(g.target.id)) actors.push(g.target.id);
    if (g.target.kind === 'household' && !households.includes(g.target.id)) households.push(g.target.id);
  }
  return { actors: actors.sort((a, b) => a - b), households: households.sort((a, b) => a - b) };
}
