/**
 * Social system: runs FOURTH each hour (after activity). OWNER: module:social.
 *
 * Contract (MODULES.md module:social):
 *   - Encounter pools = activity/api.ts venues(world) (actors sharing a place this hour).
 *   - Actors whose psyche chosen urge is { kind: 'interaction' | 'defense' } with a target
 *     present get that interaction first; others draw k partners (04 §11.2 sampling: top
 *     ties present + 1 stranger slot; no all-pairs scan), choose one interaction by volition.
 *   - Resolve checks with core checks.ts; emit 'social.interaction' with the Explain and
 *     sampled witnesses in roles; encode memories; add opinion reasons; apply need effects
 *     via needs/api.ts satisfyNeed.
 *   - Interactions with transmits_rumor call belief/api.ts transmit() (the ONLY gossip path).
 */
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';

export function socialSystem(_world: World, _ctx: SimContext): void {
  // STUB: implemented by module:social.
}
