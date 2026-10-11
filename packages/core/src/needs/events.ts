/**
 * Needs events. OWNER: module:needs-activities. Add kinds here ('needs.<snake_case>').
 */
import type { EventOf } from '../events/base.ts';
import type { ActorId } from '../ids.ts';

export type NeedsEvent =
  /** A need crossed into a different legible band (e.g. Peckish -> Hungry). */
  | EventOf<'needs.band_changed', { actorId: ActorId; needId: string; from: string; to: string; value: number }>
  /** Hunger satisfied by food (called from provisions via api.feed). */
  | EventOf<'needs.fed', { actorId: ActorId; kcal: number; before: number; after: number }>;
