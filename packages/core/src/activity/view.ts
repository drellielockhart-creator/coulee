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
  /** 0 when this activity is outside the viewer’s observation. */
  placeId: PlaceId;
  observed?: boolean;
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
  opts: ViewOptions,
): ActivityActorView {
  const a = world.activity.byActor[actorId];
  const own = opts.omniscient || opts.perspective === null || opts.perspective === actorId;
  const viewer = opts.perspective === null ? undefined : world.actors[opts.perspective];
  const observed = own || (viewer !== undefined && viewer.placeId === world.actors[actorId]?.placeId && !a?.travel);
  if (!observed)
    return {
      activityId: null,
      name: 'Unknown',
      verb: 'unobserved',
      placeId: 0 as PlaceId,
      since: 0,
      source: 'unknown',
      travelingTo: null,
      arriveAt: null,
      observed: false,
    };
  const def = a?.activityId ? content.activities[a.activityId] : undefined;
  return {
    activityId: a?.activityId ?? null,
    name: def?.name ?? 'Idle',
    verb: def?.verb ?? 'idling',
    placeId: a?.placeId ?? (world.actors[actorId]?.placeId as PlaceId),
    since: a?.since ?? 0,
    source: own ? (a?.source ?? 'init') : 'observed',
    observed: true,
    travelingTo: a?.travel?.to ?? null,
    arriveAt: a?.travel?.arrive ?? null,
  };
}

export function viewActivityPlace(
  world: World,
  _content: ContentBundle,
  placeId: PlaceId,
  opts: ViewOptions,
): ActivityPlaceView {
  if (!opts.omniscient && opts.perspective !== null && world.actors[opts.perspective]?.placeId !== placeId)
    return { occupantIds: [] };
  return { occupantIds: world.activity.occupancy[placeId] ?? [] };
}

export function activityDailyStats(_world: World, _content: ContentBundle): Record<string, number> {
  return {};
}
