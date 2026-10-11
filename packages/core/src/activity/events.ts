/**
 * Activity events. OWNER: module:needs-activities. Add kinds here ('activity.<snake_case>').
 */
import type { EventOf } from '../events/base.ts';
import type { ActorId, PlaceId } from '../ids.ts';
import type { ActivitySource } from './state.ts';

export type ActivityEvent =
  /** An actor began a new activity block. Routine: give it no importance. */
  | EventOf<'activity.started', { actorId: ActorId; activityId: string; placeId: PlaceId; source: ActivitySource }>
  /** An actor moved between places. */
  | EventOf<'activity.moved', { actorId: ActorId; from: PlaceId; to: PlaceId }>;
