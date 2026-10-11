/**
 * Activity cross-module API. OWNER: module:needs-activities.
 */
import type { ScheduleBlock } from '../content.ts';
import type { ActorId, PlaceId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { CalendarInfo } from '../time.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import type { ActorActivity } from './state.ts';

export function currentActivity(world: World, actorId: ActorId): ActorActivity | undefined {
  return world.activity.byActor[actorId];
}

/** Actors at a place this hour (ascending ids). */
export function occupants(world: World, placeId: PlaceId): ActorId[] {
  return world.activity.occupancy[placeId] ?? [];
}

/** Non-empty venues this hour, in place-id order: the pools social draws encounters from. */
export function venues(world: World): Array<{ placeId: PlaceId; actorIds: ActorId[] }> {
  const out: Array<{ placeId: PlaceId; actorIds: ActorId[] }> = [];
  const keys = Object.keys(world.activity.occupancy)
    .map(Number)
    .sort((a, b) => a - b);
  for (const k of keys) {
    const ids = world.activity.occupancy[k];
    if (ids && ids.length > 0) out.push({ placeId: k as PlaceId, actorIds: ids });
  }
  return out;
}

/** Labor level of the actor's current activity ('light' when none). */
export function laborOf(world: World, ctx: Pick<SimContext, 'content'>, actorId: ActorId): 'rest' | 'light' | 'heavy' {
  const id = world.activity.byActor[actorId]?.activityId;
  return (id ? ctx.content.activities[id]?.labor : undefined) ?? 'light';
}

export function isAsleep(world: World, ctx: Pick<SimContext, 'content'>, actorId: ActorId): boolean {
  const id = world.activity.byActor[actorId]?.activityId;
  return id ? (ctx.content.activities[id]?.asleep ?? false) : false;
}

/** True if hour h is inside a [from, to) block, handling wrap past midnight. */
export function hourInBlock(hour: number, from: number, to: number): boolean {
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** The occupation schedule block that applies to an actor at `cal`, or null. First match wins. */
export function scheduledBlock(
  world: World,
  ctx: Pick<SimContext, 'content'>,
  actorId: ActorId,
  cal: CalendarInfo,
): ScheduleBlock | null {
  const actor = world.actors[actorId];
  if (!actor) return null;
  const occ = ctx.content.occupations[actor.occupationId];
  if (!occ) return null;
  for (const b of occ.schedule) {
    if (b.days && !b.days.includes(cal.weekday)) continue;
    if (hourInBlock(cal.hour, b.from, b.to)) return b;
  }
  return null;
}

/**
 * Superego-voiced duty urges from the schedule ("the forge won't tend itself"), with
 * intensity from ScheduleBlock.duty. Called by psyche each hour.
 */
export function proposeActivityUrges(_world: World, _ctx: SimContext, _actorId: ActorId): UrgeProposal[] {
  return []; // STUB
}
