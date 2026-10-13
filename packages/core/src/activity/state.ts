/**
 * Activity state: what each actor is doing, where, and venue occupancy.
 * OWNER: module:needs-activities.
 */
import type { ActivityId } from '../content.ts';
import { type ActorId, type HouseholdId, idsOf, mustGet, type PlaceId, type Table } from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import type { GameMinute } from '../time.ts';
import type { World } from '../world.ts';

export type ActivitySource = 'init' | 'schedule' | 'urge' | 'command';

export interface ActorActivity {
  /** Current activity, or null before the first hour. */
  activityId: ActivityId | null;
  /** Where the activity happens (== ActorCore.placeId unless traveling). */
  placeId: PlaceId;
  since: GameMinute;
  /** Earliest time re-arbitration may switch away (min_hours), or null. */
  lockedUntil: GameMinute | null;
  source: ActivitySource;
  /** In transit between places (T1 movement), else null. */
  travel: { from: PlaceId; to: PlaceId; arrive: GameMinute } | null;
  /** Walking actually performed inside the last hourly interval (including a commute). */
  hourlyWalk?: { at: GameMinute; minutes: number };
  /** Resolved workplace for `at = 'workplace'` activities. */
  workplaceId: PlaceId | null;
}

export interface MinuteBudget {
  /** Legacy saved posture fields; current settlement uses activities and spent. */
  startActivity?: string | null;
  accountedActivity?: string | null;
  spent: number;
  activities: Record<string, number>;
}

export interface ActivityState {
  /** Created only by short orders; integer minutes within the current hourly tick. */
  minuteBudgets?: Record<number, MinuteBudget>;

  tacticalPositions?: Record<number, import('../tactical/state.ts').Position>;
  journeys?: import('./travel.ts').Journeys;
  byActor: Table<ActorId, ActorActivity>;
  /** Place -> actor ids present, ascending. Recomputed every hour after movement. */
  occupancy: Table<PlaceId, ActorId[]>;
  /** Stable attendance and household rota draws, regenerated once per day. */
  calendar?: { dayIndex: number; rolls: Record<string, number>; rotas: Record<string, ActorId> };
  /** Recent social calls per actor (Pay a call): day index and the household called on. */
  calls?: Table<ActorId, Array<{ day: number; householdId: HouseholdId }>>;
}

export function createActivityState(): ActivityState {
  return { byActor: {}, occupancy: {} };
}

/** Resolve a workplace: scenario `workplace`, else the first place (id order) with all occupation tags. */
function resolveWorkplace(world: World, ctx: InitContext, actorKey: string, occupationId: string): PlaceId | null {
  const seed = ctx.scenario.actors.find((a) => a.key === actorKey);
  if (seed?.workplace) return world.index.placeByDef[seed.workplace] ?? null;
  const occ = ctx.content.occupations[occupationId];
  if (!occ || occ.workplace_tags.length === 0) return null;
  for (const pid of idsOf<PlaceId>(world.places)) {
    const p = mustGet(world.places, pid, 'place');
    if (occ.workplace_tags.every((t) => p.tags.includes(t))) return pid;
  }
  return null;
}

export function initActivityState(world: World, ctx: InitContext): void {
  for (const id of idsOf<ActorId>(world.actors)) {
    const a = mustGet(world.actors, id, 'actor');
    world.activity.byActor[id] = {
      activityId: null,
      placeId: a.placeId,
      since: ctx.now,
      lockedUntil: null,
      source: 'init',
      travel: null,
      workplaceId: resolveWorkplace(world, ctx, a.key, a.occupationId),
    };
  }
  recomputeOccupancy(world);
}

/** Rebuild `occupancy` from ActorCore.placeId (living actors not in transit). */
export function recomputeOccupancy(world: World): void {
  const occ: Table<PlaceId, ActorId[]> = {};
  for (const id of idsOf<ActorId>(world.actors)) {
    const a = mustGet(world.actors, id, 'actor');
    if (
      !a.alive ||
      (world.activity.journeys?.[id] && world.activity.journeys[id]?.status !== 'arrived') ||
      world.activity.byActor[id]?.travel
    )
      continue;
    const list = occ[a.placeId] ?? [];
    list.push(id);
    occ[a.placeId] = list;
  }
  world.activity.occupancy = occ;
}
