/**
 * Activity system: runs THIRD each hour (after psyche). OWNER: module:needs-activities.
 *
 * Contract (MODULES.md module:needs-activities):
 *   - For each living actor (id order): if psyche chose an 'activity' urge
 *     (psyche/api.ts chosenUrge) and the current block is not locked (min_hours), start it;
 *     otherwise follow the occupation schedule (api.scheduledBlock); otherwise idle at home.
 *   - Resolve the activity's place: home (household home), workplace, a venue whose tags
 *     match venue_tags (nearest/most familiar, deterministic), or stay ('anywhere').
 *   - Move the actor (write ActorCore.placeId), emit 'activity.moved' / 'activity.started'.
 *   - Recompute occupancy (state.recomputeOccupancy) at the end — social reads it.
 */
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';

export function activitySystem(_world: World, _ctx: SimContext): void {
  // STUB: implemented by module:needs-activities.
}
