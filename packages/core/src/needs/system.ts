/**
 * Needs system: runs FIRST each hour. OWNER: module:needs-activities.
 *
 * Contract (MODULES.md module:needs-activities):
 *   - Decay every living actor's needs by NeedDef.decay_per_hour, scaled by the labor of the
 *     actor's CURRENT activity (activity/api.ts currentActivity -> ActivityDef.labor ->
 *     NeedDef.labor_pct) and by NeedDef.asleep_pct while the activity is `asleep`.
 *   - Apply ActivityDef.needs deltas for the current activity (e.g. sleep restores rest).
 *   - Clamp to 0..1000, update bands, emit 'needs.band_changed', and toggle the band's
 *     condition id on the actor sheet (setCondition) — needs owns band condition ids.
 *   - Integers only. Deterministic iteration (idsOf).
 */
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';

export function needsSystem(_world: World, _ctx: SimContext): void {
  // STUB: implemented by module:needs-activities.
}
