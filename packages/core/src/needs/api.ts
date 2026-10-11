/**
 * Needs cross-module API. OWNER: module:needs-activities.
 * Other modules change needs ONLY through these functions.
 */
import type { NeedId } from '../content.ts';
import type { ActorId, EventId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';

export const NEED_MIN = 0;
export const NEED_MAX = 1000;

export function needValue(world: World, actorId: ActorId, needId: NeedId): number {
  return world.needs.byActor[actorId]?.values[needId] ?? NEED_MAX;
}

export interface NeedCause {
  /** Short reason for logs/Explain: "Chat with Lydia Pratt". */
  label: string;
  eventId?: EventId;
}

/**
 * Add `delta` (may be negative) to a need, clamped to 0..1000. Returns the new value.
 * Used by social (company), activity effects, belief/psyche (security), etc.
 */
export function satisfyNeed(
  world: World,
  _ctx: SimContext,
  actorId: ActorId,
  needId: NeedId,
  delta: number,
  _cause: NeedCause,
): number {
  const n = world.needs.byActor[actorId];
  if (!n) return NEED_MAX;
  const cur = n.values[needId] ?? NEED_MAX;
  const next = Math.max(NEED_MIN, Math.min(NEED_MAX, cur + Math.round(delta)));
  n.values[needId] = next;
  return next;
}

/**
 * Food energy -> hunger. Called by provisions for every meal. The kcal -> points conversion
 * (and labor multipliers) is owned by needs. STUB returns without effect.
 */
export function feed(_world: World, _ctx: SimContext, _actorId: ActorId, _kcal: number, _cause: NeedCause): void {
  // STUB: implemented by module:needs-activities (emit 'needs.fed').
}

/** Water -> thirst, if/when a thirst need exists. STUB. */
export function drink(_world: World, _ctx: SimContext, _actorId: ActorId, _ml: number, _cause: NeedCause): void {
  // STUB
}

/**
 * Id-voiced urges from need deficits: hungry -> eat (activity 'take_meal' or provisions
 * eating), tired -> sleep, lonely -> company venues. Called by psyche each hour.
 */
export function proposeNeedUrges(_world: World, _ctx: SimContext, _actorId: ActorId): UrgeProposal[] {
  return []; // STUB
}
