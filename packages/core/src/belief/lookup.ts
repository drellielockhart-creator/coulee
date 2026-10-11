/** Derived lookup, outside World so saves and hashes retain their existing shape.
 * Ordered holder lists are append-only. A new/restored world rebuilds lazily; switching
 * worlds discards the cache (bounded to one world, no lifetime leak).
 */
import type { ActorId, BeliefId, PropId } from '../ids.ts';
import type { World } from '../world.ts';
import type { Belief, BeliefState } from './state.ts';

let cache:
  | {
      state: BeliefState;
      holders: Record<number, { ids: BeliefId[]; length: number; byProp: Record<number, BeliefId> }>;
    }
  | undefined;

export function indexedBelief(world: World, holder: ActorId, prop: PropId): Belief | undefined {
  const state = world.belief;
  if (cache?.state !== state) cache = { state, holders: {} };
  const ids = state.beliefsByHolder[holder];
  if (!ids) return undefined;
  let h = cache.holders[holder];
  if (!h || h.ids !== ids || h.length > ids.length) {
    h = { ids, length: 0, byProp: {} };
    cache.holders[holder] = h;
  }
  // ensureBelief appends; ingest only new IDs and preserve first-match semantics.
  for (; h.length < ids.length; h.length++) {
    const id = ids[h.length];
    const b = id === undefined ? undefined : state.beliefs[id];
    if (b && h.byProp[b.propId] === undefined) h.byProp[b.propId] = b.id;
  }
  const id = h.byProp[prop];
  return id === undefined ? undefined : state.beliefs[id];
}
