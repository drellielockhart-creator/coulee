/**
 * Activity view parts. OWNER: module:needs-activities. Contract with module:web (see needs/view.ts note).
 */
import type { ContentBundle } from '../content.ts';
import type { ActorId, PlaceId } from '../ids.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';

export interface ActivityActorView {
  activityId: string | null;
  /** "Work", "Sleep" ... */
  name: string;
  /** "working the forge" */
  verb: string;
  placeId: PlaceId;
  since: number;
  source: string;
  travelingTo: PlaceId | null;
  /** Arrival minute when traveling (the renderer interpolates). */
  arriveAt: number | null;
}

export interface ActivityPlaceView {
  occupantIds: ActorId[];
}

export function viewActivityActor(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  _opts: ViewOptions,
): ActivityActorView {
  const a = world.activity.byActor[actorId];
  const def = a?.activityId ? content.activities[a.activityId] : undefined;
  return {
    activityId: a?.activityId ?? null,
    name: def?.name ?? 'Idle',
    verb: def?.verb ?? 'idling',
    placeId: a?.placeId ?? (world.actors[actorId]?.placeId as PlaceId),
    since: a?.since ?? 0,
    source: a?.source ?? 'init',
    travelingTo: a?.travel?.to ?? null,
    arriveAt: a?.travel?.arrive ?? null,
  };
}

export function viewActivityPlace(
  world: World,
  _content: ContentBundle,
  placeId: PlaceId,
  _opts: ViewOptions,
): ActivityPlaceView {
  return { occupantIds: world.activity.occupancy[placeId] ?? [] };
}

export function activityDailyStats(_world: World, _content: ContentBundle): Record<string, number> {
  return {};
}
