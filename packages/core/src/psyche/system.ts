/**
 * Psyche system: runs SECOND each hour (after needs). OWNER: module:psyche.
 *
 * Contract (MODULES.md module:psyche):
 *   1. For each living actor (id order) gather proposals:
 *        needs/api.ts proposeNeedUrges, activity/api.ts proposeActivityUrges,
 *        social/api.ts proposeSocialUrges, belief/api.ts proposeBeliefUrges,
 *        provisions/api.ts proposeProvisionUrges, plus 'core.urge' commands for this actor
 *        (voice 'command').
 *   2. Turn them into Thoughts (voice weights from traits; decay old thoughts).
 *   3. Ego arbitration -> world.psyche.byActor[id].chosen (ChosenUrge with an Explain whose
 *      children are the candidates and scores; knowledge 'self').
 *   4. Unresolved Id/Superego conflict adds anxiety; above a threshold a defense fires:
 *      emit 'psyche.defense' and (for displacement/projection) set `chosen` to a
 *      { kind: 'defense' } urge that social executes, or call belief/api.ts to form a
 *      projected belief.
 */
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';

export function psycheSystem(_world: World, _ctx: SimContext): void {
  // STUB: implemented by module:psyche.
}
