/**
 * Activity events. OWNER: module:needs-activities. Add kinds here ('activity.<snake_case>').
 */
import type { EventOf } from '../events/base.ts';
import type { ActorId, PlaceId } from '../ids.ts';
import type { ActivitySource } from './state.ts';

export type ActivityEvent =
  | EventOf<
      'activity.journey',
      { actorId: ActorId; kind: 'departed' | 'stopped' | 'camp' | 'resumed' | 'turned_back'; reason: string }
    >
  /** An actor began a new activity block. Routine: give it no importance. */
  | EventOf<'activity.started', { actorId: ActorId; activityId: string; placeId: PlaceId; source: ActivitySource }>
  /** An actor moved between places; `minutes` is how long the walk took (additive). */
  | EventOf<'activity.moved', { actorId: ActorId; from: PlaceId; to: PlaceId; minutes?: number }>
  | EventOf<
      'activity.attendance',
      { actorId: ActorId; observanceId: string; block: number; chance: number; roll: number; attends: boolean }
    >
  | EventOf<
      'activity.rota',
      { householdId: import('../ids.ts').HouseholdId; observanceId: string; block: number; actorId: ActorId }
    >
  | EventOf<'activity.observance', { observanceId: string; name: string }>
  | EventOf<'activity.gathering', { observanceId: string; activityId: string; actorIds: ActorId[]; placeId: PlaceId }>;
