/**
 * Activity cross-module API. OWNER: module:needs-activities.
 */

import { grudgeTargetsOf } from '../belief/grudges.ts';
import type { ContentBundle, ScheduleBlock } from '../content.ts';
import { type ActorId, type HouseholdId, idsOf, type PlaceId } from '../ids.ts';
import { canAct } from '../needs/api.ts';
import { authorizeAct } from '../psyche/api.ts';
import { activeEmployment, employmentDayMinutes } from '../provisions/api.ts';
import { mixKey, rng } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { areKin, familiarityOf, isEstranged, opinionLabel, opinionOf } from '../social/api.ts';
import { type CalendarInfo, dayIndex, MINUTES_PER_DAY, yearsBetween } from '../time.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { blockActive, monthMatches, type Routine, routineFor } from './calendar.ts';
import { requiredRow } from './definitions.ts';
import { type ActorActivity, recomputeOccupancy } from './state.ts';
import { onJourney } from './travel.ts';

/** Employment owns terms; activity owns where ordinary work happens. */
export function setWorkplace(world: World, actorId: ActorId, placeId: PlaceId | null): void {
  const state = world.activity.byActor[actorId];
  if (state) state.workplaceId = placeId;
}

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

/** Walking pace on level ground: 3 mph, which is 264 feet a game-minute (05 §1.3). */
export const WALK_FT_PER_MINUTE = 264;
/** A trip between sites has no grid to measure; it is an hour on the road. */
const BETWEEN_SITES_MINUTES = 60;

/**
 * Minutes an unburdened walker needs from one place to another: the Manhattan distance between
 * the places' centres on the site grid, in feet, at walking pace (at least a minute). Encumbrance
 * slows it (`movementDelay`). Integers only.
 */
export function walkMinutes(world: World, content: Pick<ContentBundle, 'sites'>, from: PlaceId, to: PlaceId): number {
  const a = world.places[from];
  const b = world.places[to];
  if (!a || !b || from === to) return 0;
  if (a.siteId !== b.siteId) return world.region ? 1000000 : BETWEEN_SITES_MINUTES;
  const tileFt = content.sites?.[a.siteId]?.tile_ft ?? 10;
  // Centres in half tiles, so odd footprints keep exact integers.
  const halfTiles = Math.abs(2 * a.x + a.w - (2 * b.x + b.w)) + Math.abs(2 * a.y + a.h - (2 * b.y + b.h));
  const feet = Math.ceil((halfTiles * tileFt) / 2);
  return Math.max(1, Math.ceil(feet / WALK_FT_PER_MINUTE));
}

/** Labor level of the actor's current activity ('light' when none). */
export function laborOf(world: World, ctx: Pick<SimContext, 'content'>, actorId: ActorId): 'rest' | 'light' | 'heavy' {
  if (!canAct(world, actorId)) return 'rest';
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
  const contract = activeEmployment(world, actorId);
  if (
    contract &&
    cal.weekday !== 'sun' &&
    cal.hour >= contract.fromHour &&
    cal.hour < contract.toHour &&
    cal.hour !== 12
  )
    return {
      from: contract.fromHour,
      to: contract.toHour,
      activity: employmentDayMinutes(world, actorId, cal.dayIndex) >= contract.hours * 60 ? 'idle_at_home' : 'work',
      duty: 550,
    };
  for (const b of occ.schedule) {
    if (b.days && !b.days.includes(cal.weekday)) continue;
    if (b.seasons && !b.seasons.includes(cal.season)) continue;
    if (!monthMatches(cal.month, b.months)) continue;
    if (!blockActive(b, cal)) continue;
    const activity = ctx.content.activities[b.activity];
    if (contract && activity?.tags.includes('labor')) continue;
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
  if (world.region) {
    const site = world.places[actor.placeId]?.siteId;
    if (requested !== undefined && world.places[requested]?.siteId !== site) return null;
    if (
      onJourney(world, actorId) &&
      (def.at !== 'anywhere' || (requested !== undefined && requested !== actor.placeId))
    )
      return null;
    const home = world.households[actor.householdId]?.homePlaceId;
    if (def.at === 'home' && world.places[home ?? 0]?.siteId !== site) return def.asleep ? null : actor.placeId;
    if (
      def.at === 'workplace' &&
      world.places[world.activity.byActor[actorId]?.workplaceId ?? home ?? 0]?.siteId !== site
    )
      return null;
  }
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
  if (def.at === 'kin') {
    // A call is paid to a person, not to the nearest door (04 §11.2): see callTarget.
    const current = world.activity.byActor[actorId];
    if (current?.activityId === activityId && homeOwner(world, current.placeId, actor.householdId) !== null) {
      return current.placeId;
    }
    const target = callTarget(world, actorId);
    const targetHome =
      target !== null ? world.households[requiredRow(world.actors, target).householdId]?.homePlaceId : undefined;
    if (world.region && world.places[targetHome ?? home]?.siteId !== world.places[actor.placeId]?.siteId) return null;
    return targetHome ?? home;
  }
  const origin = world.places[home];
  const candidates = idsOf<PlaceId>(world.places).filter((id) => {
    const p = requiredRow(world.places, id);
    if (world.region && p.siteId !== world.places[actor.placeId]?.siteId) return false;
    return def.at === 'venue' && def.venue_tags.some((t) => p.tags.includes(t));
  });
  candidates.sort((a, b) => {
    const pa = requiredRow(world.places, a);
    const pb = requiredRow(world.places, b);
    const siteA = pa.siteId === origin?.siteId ? 0 : 1;
    const siteB = pb.siteId === origin?.siteId ? 0 : 1;
    const da = Math.abs(pa.x - (origin?.x ?? 0)) + Math.abs(pa.y - (origin?.y ?? 0));
    const db = Math.abs(pb.x - (origin?.x ?? 0)) + Math.abs(pb.y - (origin?.y ?? 0));
    return siteA - siteB || da - db || a - b;
  });
  return candidates[0] ?? null;
}

/** The household (other than `own`) whose home this place is, or null. */
function homeOwner(world: World, placeId: PlaceId, own: HouseholdId): HouseholdId | null {
  for (const hid of idsOf<HouseholdId>(world.households)) {
    if (hid !== own && world.households[hid]?.homePlaceId === placeId) return hid;
  }
  return null;
}

const SALT_CALL = 0xca11;
/** Calls remembered per actor, and the window and ×percent of the per-household repeat penalty. */
const CALL_LOG_MAX = 8;
const CALL_REPEAT_DAYS = 14;
const CALL_REPEAT_PCT = 50;
/** Labels that keep a caller away: nobody pays a social call on an Enemy or on someone they fear. */
const NO_CALL_LABELS: readonly string[] = ['Enemy', 'Cowed'];

export interface CallChoice {
  targetId: ActorId;
  weight: number;
}

/**
 * Whom a 'kin' activity (Pay a call) goes to see today. Candidates are people of 14 or more in
 * other households: weight = max(0, Affection + 20) + 30 if kin + familiarity/20, halved per
 * call on that household in the last 14 days and for another site. Enemies, the Cowed, the
 * estranged and the targets of the caller's grudges are never called on. The pick is a
 * weighted roll on the 'activity' stream keyed by (caller, day), so it is stable all day and
 * calls rotate across days. Null when there is nobody to call on.
 */
export function callTarget(world: World, actorId: ActorId): ActorId | null {
  const cands = callCandidates(world, actorId);
  if (cands.length === 0) return null;
  const day = dayIndex(world.time);
  const r = rng(world.meta.seed, 'activity', day * MINUTES_PER_DAY, mixKey(actorId, day, SALT_CALL));
  return r.weighted(cands, (c) => c.weight)?.targetId ?? null;
}

/** Call candidates with their weights (ascending ids); exported for the dossier and tests. */
export function callCandidates(world: World, actorId: ActorId): CallChoice[] {
  const actor = world.actors[actorId];
  if (!actor) return [];
  const origin = world.places[world.households[actor.householdId]?.homePlaceId ?? actor.placeId];
  const grudges = grudgeTargetsOf(world, actorId);
  const today = dayIndex(world.time);
  const log = world.activity.calls?.[actorId] ?? [];
  const out: CallChoice[] = [];
  for (const id of idsOf<ActorId>(world.actors)) {
    const other = requiredRow(world.actors, id);
    if (!other.alive || other.householdId === actor.householdId) continue;
    if (yearsBetween(other.born, world.time) < 14) continue;
    const home = world.households[other.householdId]?.homePlaceId;
    if (home === undefined || !world.places[home]) continue;
    if (grudges.actors.includes(id) || grudges.households.includes(other.householdId)) continue;
    const op = opinionOf(world, actorId, id);
    if (NO_CALL_LABELS.includes(opinionLabel(op))) continue;
    if (isEstranged(world, actorId, id)) continue;
    const kin = areKin(world, actorId, id);
    if (op.affection + 20 <= 0 && !kin) continue;
    let w = Math.max(0, op.affection + 20) + (kin ? 30 : 0) + Math.floor(familiarityOf(world, actorId, id) / 20);
    for (const c of log) {
      if (c.householdId === other.householdId && today - c.day < CALL_REPEAT_DAYS)
        w = Math.floor((w * CALL_REPEAT_PCT) / 100);
    }
    if (origin && world.places[home]?.siteId !== origin.siteId) w = Math.floor(w / 2);
    if (w > 0) out.push({ targetId: id, weight: w });
  }
  return out;
}

/** Note a call begun at `placeId` (activity system), for the repeat penalty. */
export function noteCall(world: World, actorId: ActorId, placeId: PlaceId): void {
  const actor = world.actors[actorId];
  if (!actor) return;
  const hid = homeOwner(world, placeId, actor.householdId);
  if (hid === null) return;
  world.activity.calls ??= {};
  const log = world.activity.calls[actorId] ?? [];
  log.push({ day: dayIndex(world.time), householdId: hid });
  world.activity.calls[actorId] = log.length > CALL_LOG_MAX ? log.slice(log.length - CALL_LOG_MAX) : log;
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

/** A helper carries a patient, or neighbors gather for a funeral; reserves this hour. */
export function relocateForCare(
  world: World,
  ctx: SimContext,
  id: ActorId,
  place: PlaceId,
  activityId = 'idle_at_home',
): void {
  const actor = world.actors[id],
    state = world.activity.byActor[id];
  if (!actor || !state || !world.places[place]) return;
  if (world.region && (onJourney(world, id) || world.places[actor.placeId]?.siteId !== world.places[place]?.siteId))
    return;
  const from = actor.placeId;
  actor.placeId = place;
  state.placeId = place;
  state.travel = null;
  state.activityId = activityId;
  state.lockedUntil = (ctx.now + 60) as import('../time.ts').GameMinute;
  if (from !== place)
    ctx.emit({
      kind: 'activity.moved',
      data: { actorId: id, from, to: place },
      place,
      roles: [{ actor: id, role: 'subject' }],
      visibility: 'witnessed',
      explain: {
        kind: 'formula',
        label: 'Care and community gathering',
        subjects: [id],
        knowledge: 'public',
        terms: [],
        total: place,
        outcome: 'moved',
      },
    });
}

export * from './tactical.ts';
export * from './travel.ts';
export * from './travel-rules.ts';

/** Immediate local movement/transaction posture. This is actor-generic, never controller-gated. */
export function shortAct(world: World, ctx: SimContext, actorId: ActorId, minutes: number, to?: PlaceId): void {
  const actor = world.actors[actorId],
    state = world.activity.byActor[actorId];
  if (!actor || !state || !canAct(world, actorId)) return;
  const command = ctx.commands.find((c) => c.actorId === actorId);
  if (
    !command ||
    !authorizeAct(
      world,
      actorId,
      { kind: command.kind },
      { kind: 'command', issuer: command.issuer ?? { kind: 'player' } },
    ).ok
  )
    return;
  const from = actor.placeId;
  if (to !== undefined) {
    actor.placeId = to;
    state.placeId = to;
  }
  state.activityId = 'idle_at_home';
  state.source = 'command';
  state.since = ctx.now;
  state.lockedUntil = null;
  if (to !== undefined && to !== from)
    ctx.emit({
      kind: 'activity.moved',
      data: { actorId, from, to, minutes },
      place: to,
      roles: [{ actor: actorId, role: 'agent' }],
      visibility: 'witnessed',
      explain: {
        kind: 'formula',
        label: 'Local walk',
        subjects: [actorId],
        knowledge: 'public',
        terms: [{ source: 'distance', label: 'Walking minutes, including load', value: minutes }],
        total: minutes,
        outcome: 'arrived',
      },
    });
  recomputeOccupancy(world);
}

export function minuteBudget(world: World, actorId: ActorId): { spent: number; remaining: number } {
  const spent = world.activity.minuteBudgets?.[actorId]?.spent ?? 0;
  return { spent, remaining: 60 - spent };
}
export function spendMinutes(world: World, actorId: ActorId, minutes: number, activityId: string): void {
  world.activity.minuteBudgets ??= {};
  world.activity.minuteBudgets[actorId] ??= { spent: 0, activities: {} };
  const b = world.activity.minuteBudgets[actorId];
  if (!b) return;
  b.spent += minutes;
  b.activities[activityId] = (b.activities[activityId] ?? 0) + minutes;
}
/** Charge one whole hour to its dominant activity; the remaining activity wins ties. */
export function settleMinuteActivity(world: World, actorId: ActorId, remainingActivity?: string): void {
  const b = world.activity.minuteBudgets?.[actorId],
    state = world.activity.byActor[actorId];
  if (!b || !state) return;
  const remaining = remainingActivity ?? state.activityId ?? 'idle_at_home';
  const totals = { ...b.activities, [remaining]: (b.activities[remaining] ?? 0) + 60 - b.spent };
  let dominant = remaining;
  for (const id of Object.keys(totals).sort()) if ((totals[id] ?? 0) > (totals[dominant] ?? 0)) dominant = id;
  b.accountedActivity = dominant;
}
export function clearMinuteBudget(world: World, actorId: ActorId): void {
  if (!world.activity.minuteBudgets) return;
  delete world.activity.minuteBudgets[actorId];
  if (Object.keys(world.activity.minuteBudgets).length === 0) delete world.activity.minuteBudgets;
}
