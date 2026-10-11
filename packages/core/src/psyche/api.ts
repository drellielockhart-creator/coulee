/**
 * Psyche cross-module API. OWNER: module:psyche.
 */
import type { ActorId, ThoughtId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { ChosenUrge, UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import type { ActorPsyche } from './state.ts';

/** This hour's arbitration result for an actor (read by activity and social). */
export function chosenUrge(world: World, actorId: ActorId): ChosenUrge | null {
  return world.psyche.byActor[actorId]?.chosen ?? null;
}

export function psycheOf(world: World, actorId: ActorId): ActorPsyche | undefined {
  return world.psyche.byActor[actorId];
}

/**
 * Inject a thought from outside the hourly proposal pass (e.g. social: after an insult the
 * Id voices "hit him"; belief: dread after hearing a witch rumor). Returns its id. STUB.
 */
export function addThought(
  _world: World,
  _ctx: SimContext,
  _actorId: ActorId,
  _proposal: UrgeProposal,
): ThoughtId | null {
  return null; // STUB
}

/** Add (or relieve, if negative) anxiety 0..1000, e.g. from a frightening event. */
export function addAnxiety(world: World, _ctx: SimContext, actorId: ActorId, delta: number): number {
  const p = world.psyche.byActor[actorId];
  if (!p) return 0;
  p.anxiety = Math.max(0, Math.min(1000, p.anxiety + Math.round(delta)));
  return p.anxiety;
}
