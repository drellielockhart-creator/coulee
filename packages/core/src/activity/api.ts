/**
 * Activity cross-module API. OWNER: module:needs-activities.
 */
import type { ScheduleBlock } from '../content.ts';
import { type ActorId, idsOf, type PlaceId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import { areKin } from '../social/api.ts';
import { type CalendarInfo, yearsBetween } from '../time.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { blockActive, monthMatches, type Routine, routineFor } from './calendar.ts';
import { requiredRow } from './definitions.ts';
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
  const keys = idsOf<PlaceId>(world.activity.occupancy);
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
    if (b.seasons && !b.seasons.includes(cal.season)) continue;
    if (!monthMatches(cal.month, b.months)) continue;
    if (!blockActive(b, cal)) continue;
    const activity = ctx.content.activities[b.activity];
    if (
      activity &&
      monthMatches(cal.month, activity.months) &&
      resolveActivityPlace(world, ctx, actorId, b.activity) !== null
    )
      return b;
    if (
      b.fallback &&
      ctx.content.activities[b.fallback] &&
      monthMatches(cal.month, requiredRow(ctx.content.activities, b.fallback).months) &&
      resolveActivityPlace(world, ctx, actorId, b.fallback) !== null
    )
      return { ...b, activity: b.fallback };
  }
  return null;
}

/**
 * Superego-voiced duty urges from the schedule ("the forge won't tend itself"), with
 * intensity from ScheduleBlock.duty. Called by psyche each hour.
 */
export function proposeActivityUrges(world: World, ctx: SimContext, actorId: ActorId): UrgeProposal[] {
  const routine = routineFor(world, ctx, actorId);
  if (!routine || routine.duty <= 0) return [];
  return [
    {
      urge: { kind: 'activity', activityId: routine.activityId },
      voice: 'superego',
      intensity: routine.duty,
      label: routine.explain.label,
      source: 'activity',
      reasons: routine.explain.terms,
      ...(routine.norm ? { norm: routine.norm } : {}),
      ...(routine.speaker ? { speaker: routine.speaker } : {}),
    },
  ];
}

/** Any matching venue tag qualifies; nearest same-site place, with id as the final tie breaker. */
export function resolveActivityPlace(
  world: World,
  ctx: Pick<SimContext, 'content'>,
  actorId: ActorId,
  activityId: string,
  requested?: PlaceId,
): PlaceId | null {
  const actor = world.actors[actorId];
  const def = ctx.content.activities[activityId];
  if (!actor || !def) return null;
  const age = yearsBetween(actor.born, world.time);
  if (
    (def.min_age !== undefined && age < def.min_age) ||
    (def.max_age !== undefined && age > def.max_age) ||
    (def.sexes && !def.sexes.includes(actor.sex))
  )
    return null;
  // A confined actor (occupation `confined`) does everything where they are held.
  const held = ctx.content.occupations[actor.occupationId]?.confined
    ? (world.activity.byActor[actorId]?.workplaceId ?? null)
    : null;
  if (held !== null) return held;
  if (requested !== undefined) return world.places[requested] ? requested : null;
  const home = world.households[actor.householdId]?.homePlaceId ?? actor.placeId;
  if (def.at === 'home') return home;
  if (def.at === 'anywhere') return actor.placeId;
  if (def.at === 'workplace') return world.activity.byActor[actorId]?.workplaceId ?? home;
  const origin = world.places[home];
  let candidates = idsOf<PlaceId>(world.places).filter((id) => {
    const p = requiredRow(world.places, id);
    return def.at === 'venue' && def.venue_tags.some((t) => p.tags.includes(t));
  });
  if (def.at === 'kin') {
    const kinHomes = new Set<PlaceId>();
    const otherHomes = new Set<PlaceId>();
    for (const id of idsOf<ActorId>(world.actors)) {
      const other = requiredRow(world.actors, id);
      const otherHome = world.households[other.householdId]?.homePlaceId;
      if (!other.alive || other.householdId === actor.householdId || otherHome === undefined) continue;
      otherHomes.add(otherHome);
      if (areKin(world, actorId, id)) kinHomes.add(otherHome);
    }
    const homes = kinHomes.size > 0 ? kinHomes : otherHomes;
    candidates = idsOf<PlaceId>(world.places).filter((id) => homes.has(id));
  }
  candidates.sort((a, b) => {
    const pa = requiredRow(world.places, a);
    const pb = requiredRow(world.places, b);
    const siteA = pa.siteId === origin?.siteId ? 0 : 1;
    const siteB = pb.siteId === origin?.siteId ? 0 : 1;
    const da = Math.abs(pa.x - (origin?.x ?? 0)) + Math.abs(pa.y - (origin?.y ?? 0));
    const db = Math.abs(pb.x - (origin?.x ?? 0)) + Math.abs(pb.y - (origin?.y ?? 0));
    return siteA - siteB || da - db || a - b;
  });
  return candidates[0] ?? (def.at === 'kin' ? home : null);
}

/** Effective town schedule, including meals, observances and attendance decisions. */
export function scheduledRoutine(world: World, ctx: SimContext, actorId: ActorId): Routine | null {
  return routineFor(world, ctx, actorId);
}

/** Provisions reserves only hands-on cooking time; unattended soaking and simmering are
 * pending output in provisions, and do not prevent other activities. */
export function reservePreparation(world: World, ctx: SimContext, actorId: ActorId, minutes: number): void {
  const state = world.activity.byActor[actorId];
  if (!state || minutes <= 0) return;
  state.lockedUntil = Math.max(state.lockedUntil ?? ctx.now, ctx.now + minutes) as import('../time.ts').GameMinute;
  const cooking = Object.values(ctx.content.activities).find((a) => a.tags.includes('cook'));
  if (cooking && state.activityId !== cooking.id) {
    state.activityId = cooking.id;
    state.since = ctx.now;
    state.source = 'urge';
    ctx.emit({
      kind: 'activity.started',
      data: { actorId, activityId: cooking.id, placeId: state.placeId, source: 'urge' },
      roles: [{ actor: actorId, role: 'agent' }],
      place: state.placeId,
      visibility: 'witnessed',
      explain: {
        kind: 'formula',
        label: 'Hands-on meal preparation',
        subjects: [actorId],
        knowledge: 'participants',
        terms: [{ source: 'time', label: 'Active cooking minutes', value: minutes }],
        total: state.lockedUntil,
        outcome: 'working',
      },
    });
  }
}
