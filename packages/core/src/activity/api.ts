/**
 * Activity cross-module API. OWNER: module:needs-activities.
 */

import { grudgeTargetsOf } from '../belief/grudges.ts';
import type { ActivityDef, ContentBundle, ScheduleBlock } from '../content.ts';
import { hasLiveBias, noteNudge, optionTiltFor, type Tilt } from '../director/api.ts';
import { type ActorId, type HouseholdId, idsOf, type PlaceId } from '../ids.ts';
import { canAct } from '../needs/api.ts';
import { activeEmployment, employmentDayMinutes, workAvailability } from '../provisions/api.ts';
import { authorizeAct, standingOrders } from '../psyche/api.ts';
import { mixKey, rng } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import {
  acquaintanceIds,
  areKin,
  familiarityOf,
  isAcquainted,
  isEstranged,
  kinOf,
  knownOutsideHousehold,
  opinionLabel,
  opinionOf,
  settleVenueNudge,
} from '../social/api.ts';
import { type CalendarInfo, dayIndex, latestBirthDay, MINUTES_PER_DAY, yearsBetween } from '../time.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { blockActive, monthMatches, type Routine, routineFor } from './calendar.ts';

export { withRoutineMemo } from './calendar.ts';
export { placesInSite, venueCandidates } from './venues.ts';

import { requiredRow } from './definitions.ts';
import { type ActorActivity, recomputeOccupancy } from './state.ts';
import { onJourney } from './travel.ts';
import { venueCandidates } from './venues.ts';

/** Employment owns terms; activity owns where ordinary work happens. */
export function setWorkplace(world: World, actorId: ActorId, placeId: PlaceId | null): void {
  const state = world.activity.byActor[actorId];
  if (state) state.workplaceId = placeId;
}

/** Cancel a paid shift and its labor posture when the employment ends. */
export function endWorkShift(world: World, actorId: ActorId): void {
  const state = world.activity.byActor[actorId];
  if (!state) return;
  delete state.workShift;
  if (state.activityId === 'work') {
    state.activityId = 'idle_at_home';
    state.lockedUntil = null;
  }
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
  return laborDoing(world, ctx, actorId, world.activity.byActor[actorId]?.activityId);
}

/** `laborOf` as if the actor were doing `activityId` (the needs ledger's per-minute split). */
export function laborDoing(
  world: World,
  ctx: Pick<SimContext, 'content'>,
  actorId: ActorId,
  activityId: string | null | undefined,
): 'rest' | 'light' | 'heavy' {
  if (!canAct(world, actorId)) return 'rest';
  return (activityId ? ctx.content.activities[activityId]?.labor : undefined) ?? 'light';
}

export function isAsleep(world: World, ctx: Pick<SimContext, 'content'>, actorId: ActorId): boolean {
  return asleepDoing(ctx, world.activity.byActor[actorId]?.activityId);
}

/** `isAsleep` for an actor doing `activityId`. */
export function asleepDoing(ctx: Pick<SimContext, 'content'>, activityId: string | null | undefined): boolean {
  return activityId ? (ctx.content.activities[activityId]?.asleep ?? false) : false;
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
    if (b.activity === 'work' && workAvailability(world, ctx.content, actorId)) continue;
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
    if (def.at === 'home' && world.places[home ?? 0]?.siteId !== site) return actor.placeId;
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
  if (def.at === 'home') return def.asleep && !standingOrders(world, actorId).lodging ? actor.placeId : home;
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
  // Hot path (every actor-hour, every place at county scale): rows directly, no id strings.
  // The sort below is a total order (ties by id), so table iteration order is irrelevant.
  const candidates =
    def.at === 'venue'
      ? venueCandidates(world, world.region ? world.places[actor.placeId]?.siteId : '', def.venue_tags)
      : [];
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
 * other households whom the caller knows or is kin to, plus strangers in the nearest three
 * households of the caller's site and in up to three households there that are isolated or new
 * (whose grown members have each met fewer than four outsiders). Weight = max(0, Affection + 20)
 * + 30 if kin + familiarity/20 + 20 for an isolated or new household, halved per call on that
 * household in the last 14 days and for another site. In a region, only people whose home is on
 * the caller's current site are candidates (a call cannot be paid elsewhere; see
 * resolveActivityPlace), so the day's roll is never spent on an unreachable door. Enemies, the Cowed, the
 * estranged and the targets of the caller's grudges are never called on. The pick is a
 * weighted roll on the 'activity' stream keyed by (caller, day), so it is stable all day and
 * calls rotate across days. Null when there is nobody to call on.
 */
export function callTarget(world: World, actorId: ActorId): ActorId | null {
  const cands = callCandidates(world, actorId);
  if (cands.length === 0) return null;
  const day = dayIndex(world.time);
  const r = rng(world.meta.seed, 'activity', day * MINUTES_PER_DAY, mixKey(actorId, day, SALT_CALL));
  const plain = r.weighted(cands, (c) => c.weight)?.targetId ?? null;
  return tiltCall(world, actorId, cands, day, plain)?.pick ?? plain;
}

/**
 * N8 (Director route crossing, `optionTilt`): a favoured household's candidates (only those
 * already willing to be called on, weight > 0) gain at most 15% of the best weight, and the
 * same day's roll is read again. Pure: only with a live bias for this caller, out of the PC's
 * sight, and only ever moving the call onto a favoured household. `settleCallNudge` records it.
 */
function tiltCall(
  world: World,
  actorId: ActorId,
  cands: CallChoice[],
  day: number,
  plain: ActorId | null,
): { pick: ActorId; plain: ActorId | null; bias: Tilt['bias'] } | null {
  const here = world.actors[actorId]?.placeId;
  const tilt = optionTiltFor(world, 'call_target', actorId, 'household', here === undefined ? [] : [here]);
  if (!tilt) return null;
  const top = Math.max(0, ...cands.map((c) => c.weight));
  const found: Tilt['bias'][] = [];
  const tilted = cands.map((c) => {
    const t = c.weight > 0 ? tilt(world.actors[c.targetId]?.householdId ?? -1) : null;
    if (!t) return c;
    found.push(t.bias);
    return { targetId: c.targetId, weight: c.weight + Math.floor((top * t.amount) / 1000) };
  });
  const bias = found[0];
  if (bias === undefined) return null;
  const r = rng(world.meta.seed, 'activity', day * MINUTES_PER_DAY, mixKey(actorId, day, SALT_CALL));
  const pick = r.weighted(tilted, (c) => c.weight)?.targetId ?? null;
  // The tilt may only move the call onto a favoured household, never reshuffle the others.
  const favoured = (id: ActorId | null) => id !== null && tilt(world.actors[id]?.householdId ?? -1) !== null;
  if (pick === null || pick === plain || !favoured(pick) || favoured(plain)) return null;
  return { pick, plain, bias };
}

/**
 * The activity system committed a change of activity: record any Director choice it carries
 * (an N8 call or company venue). Called once at commitment, never from a query.
 */
export function settleDirectorChoices(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  activityId: string,
  placeId: PlaceId,
  urged: boolean,
): void {
  if (!world.director?.plan?.biases.length) return;
  const def = ctx.content.activities[activityId];
  if (def?.at === 'kin' && hasLiveBias(world, 'option', 'call_target', actorId)) {
    const cands = callCandidates(world, actorId);
    const day = dayIndex(world.time);
    const r = rng(world.meta.seed, 'activity', day * MINUTES_PER_DAY, mixKey(actorId, day, SALT_CALL));
    const plain = r.weighted(cands, (c) => c.weight)?.targetId ?? null;
    const t = tiltCall(world, actorId, cands, day, plain);
    const home = t ? world.households[world.actors[t.pick]?.householdId ?? -1]?.homePlaceId : undefined;
    if (t && home === placeId) noteNudge(world, t.bias, actorId, t.plain ?? 'nobody', t.pick);
  }
  // A venue counts only when the lonely actor's own urge won arbitration.
  if (urged) settleVenueNudge(world, ctx, actorId, activityId, placeId);
}

/**
 * The neighbourly allowance (perf wave 13: callers no longer weigh every adult in the county):
 * besides the people they know and their kin, a caller may call on strangers in the nearest few
 * households of their own site, and on the nearest few households there that are isolated or new
 * (newly arrived, or cut off long enough to have met almost nobody; people check on them).
 * Bounded: a caller adds at most 3 + 3 stranger households, and the rule only chooses whom an
 * already-made call goes to, so an isolated hamlet draws no more calls than its callers make.
 */
const NEIGHBOUR_HOUSEHOLDS = 3;
const ISOLATED_HOUSEHOLDS = 3;
/** A household whose grown members have each met fewer people outside it than this is isolated or new. */
const ISOLATED_MET = 4;
/** The welcome an isolated or new household draws from its neighbours, on top of a stranger's 20. */
const ISOLATED_WELCOME = 20;

interface SiteHome {
  hid: HouseholdId;
  x: number;
  y: number;
}
/**
 * Derived (never saved): household homes by site, and per-household memos of the nearest
 * neighbours and of being new here. Rebuilt whenever the game minute changes, so it reads only
 * the current state (homes never move; households are made only when a site is installed).
 */
interface HomeIndex {
  time: number;
  bySite: Map<string, SiteHome[]>;
  near: Map<HouseholdId, HouseholdId[]>;
  isolated: Map<string, SiteHome[]>;
}
const homeIndexes = new Map<object, HomeIndex>();
function homeIndex(world: World): HomeIndex {
  let index = homeIndexes.get(world.households);
  if (!index || index.time !== world.time) {
    const bySite = new Map<string, SiteHome[]>();
    const grownBy = latestBirthDay(14, world.time);
    for (const h of rowsOfHouseholds(world)) {
      const home = world.places[h.homePlaceId];
      // A house with nobody grown and living in it is nobody's call (and no one's neighbour).
      if (!home || !h.memberIds.some((m) => grownAlive(world, m, grownBy))) continue;
      const list = bySite.get(home.siteId);
      const row = { hid: h.id, x: home.x, y: home.y };
      if (list) list.push(row);
      else bySite.set(home.siteId, [row]);
    }
    if (!index && homeIndexes.size >= 16) homeIndexes.clear();
    index = { time: world.time, bySite, near: new Map(), isolated: new Map() };
    homeIndexes.set(world.households, index);
  }
  return index;
}
function rowsOfHouseholds(world: World) {
  return idsOf<HouseholdId>(world.households).map((id) => requiredRow(world.households, id));
}
/** The `n` homes of `homes` nearest (x, y), other than `own`: by distance, then household id. */
function nearest(homes: readonly SiteHome[], x: number, y: number, own: HouseholdId, n: number): HouseholdId[] {
  const best: Array<{ hid: HouseholdId; d: number }> = [];
  for (const h of homes) {
    if (h.hid === own) continue;
    const d = Math.abs(h.x - x) + Math.abs(h.y - y);
    if (best.length === n && (d > (best[n - 1]?.d ?? 0) || (d === best[n - 1]?.d && h.hid > (best[n - 1]?.hid ?? 0))))
      continue;
    best.push({ hid: h.hid, d });
    best.sort((a, b) => a.d - b.d || a.hid - b.hid);
    if (best.length > n) best.pop();
  }
  return best.map((b) => b.hid);
}
function grownAlive(world: World, id: ActorId, grownBy: number): boolean {
  const a = world.actors[id];
  return a?.alive === true && dayIndex(a.born) <= grownBy;
}
/** Isolated or new: every grown member has met fewer than ISOLATED_MET people outside it. */
function isIsolatedOrNew(world: World, hid: HouseholdId, grownBy: number): boolean {
  let grown = 0;
  for (const m of world.households[hid]?.memberIds ?? []) {
    if (!grownAlive(world, m, grownBy)) continue;
    grown++;
    if (knownOutsideHousehold(world, m, ISOLATED_MET) >= ISOLATED_MET) return false;
  }
  return grown > 0;
}

/** Call candidates with their weights (ascending ids); exported for the dossier and tests. */
export function callCandidates(world: World, actorId: ActorId): CallChoice[] {
  const actor = world.actors[actorId];
  if (!actor) return [];
  const origin = world.places[world.households[actor.householdId]?.homePlaceId ?? actor.placeId];
  const grudges = grudgeTargetsOf(world, actorId);
  const today = dayIndex(world.time);
  const log = world.activity.calls?.[actorId] ?? [];
  const grownBy = latestBirthDay(14, world.time);
  // Whom the caller could call on: the people they know (an opinion record), their kin, and
  // the neighbourly allowance on their own site (nearest households, isolated or new ones).
  const ids = new Set<ActorId>(acquaintanceIds(world, actorId));
  for (const id of kinOf(world, actorId)) ids.add(id);
  const welcome = new Set<HouseholdId>();
  // In a region a call is paid only on the caller's current site (resolveActivityPlace).
  const here = world.region ? world.places[actor.placeId]?.siteId : undefined;
  if (origin && (here === undefined || origin.siteId === here)) {
    const index = homeIndex(world);
    const homes = index.bySite.get(origin.siteId) ?? [];
    let near = index.near.get(actor.householdId);
    if (!near) {
      near = nearest(homes, origin.x, origin.y, actor.householdId, NEIGHBOUR_HOUSEHOLDS);
      index.near.set(actor.householdId, near);
    }
    let lonely = index.isolated.get(origin.siteId);
    if (!lonely) {
      lonely = homes.filter((h) => isIsolatedOrNew(world, h.hid, grownBy));
      index.isolated.set(origin.siteId, lonely);
    }
    for (const hid of nearest(lonely, origin.x, origin.y, actor.householdId, ISOLATED_HOUSEHOLDS)) welcome.add(hid);
    for (const hid of [...near, ...welcome]) for (const id of world.households[hid]?.memberIds ?? []) ids.add(id);
  }
  const out: CallChoice[] = [];
  // Someone the caller holds no opinion record of reads as all-zero dimensions with no label
  // (opinionOf), so only acquaintances need the opinion sum; strangers' familiarity is 0.
  for (const id of [...ids].sort((a, b) => a - b)) {
    const other = world.actors[id];
    if (!other?.alive || other.householdId === actor.householdId) continue;
    if (dayIndex(other.born) > grownBy) continue; // yearsBetween(other.born, now) < 14
    const home = world.households[other.householdId]?.homePlaceId;
    if (home === undefined || !world.places[home]) continue;
    if (here !== undefined && world.places[home]?.siteId !== here) continue;
    if (grudges.actors.includes(id) || grudges.households.includes(other.householdId)) continue;
    const known = isAcquainted(world, actorId, id);
    const affection = known ? opinionOf(world, actorId, id) : null;
    if (affection && NO_CALL_LABELS.includes(opinionLabel(affection))) continue;
    if (isEstranged(world, actorId, id)) continue;
    const kin = areKin(world, actorId, id);
    const aff = affection?.affection ?? 0;
    if (aff + 20 <= 0 && !kin) continue;
    let w =
      Math.max(0, aff + 20) +
      (kin ? 30 : 0) +
      (known ? Math.floor(familiarityOf(world, actorId, id) / 20) : 0) +
      (welcome.has(other.householdId) ? ISOLATED_WELCOME : 0);
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
/** The first `cook` activity in content order; cached per table and revalidated against its
 * current keys (content-only, bounded, not world state). */
let cookingCache: { table: object; raw: string[]; def: ActivityDef | undefined } | null = null;
function cookingActivity(table: SimContext['content']['activities']): ActivityDef | undefined {
  const raw = Object.keys(table);
  const hit = cookingCache;
  if (hit?.table === table && hit.raw.length === raw.length && hit.raw.every((k, i) => k === raw[i])) return hit.def;
  const def = Object.values(table).find((a) => a.tags.includes('cook'));
  cookingCache = { table, raw, def };
  return def;
}
export function reservePreparation(world: World, ctx: SimContext, actorId: ActorId, minutes: number): void {
  const state = world.activity.byActor[actorId];
  if (!state || minutes <= 0) return;
  state.lockedUntil = Math.max(state.lockedUntil ?? ctx.now, ctx.now + minutes) as import('../time.ts').GameMinute;
  const cooking = cookingActivity(ctx.content.activities);
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

export { type ActorActivity, recomputeOccupancy } from './state.ts';
export * from './tactical.ts';
export * from './travel.ts';
export * from './travel-rules.ts';

/** A short order may wake a sleeper, but cannot cancel work or any travel. */
export function shortActBlock(world: World, content: ContentBundle, actorId: ActorId): string | null {
  const state = currentActivity(world, actorId);
  if (state?.travel || onJourney(world, actorId)) return 'Finish or stop your journey before doing that';
  if (
    state?.lockedUntil != null &&
    state.lockedUntil > world.time &&
    !content.activities[state.activityId ?? '']?.asleep &&
    !content.activities[state.activityId ?? '']?.tags.includes('commerce')
  )
    return `You are still ${content.activities[state.activityId ?? '']?.verb ?? 'busy'}; wait until this activity finishes`;
  return null;
}

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
  if (shortActBlock(world, ctx.content, actorId)) return;
  // Open the minute ledger before changing posture.
  spendMinutes(world, actorId, 0, 'idle_at_home');
  const from = actor.placeId;
  if (to !== undefined) {
    actor.placeId = to;
    state.placeId = to;
    delete state.workShift;
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
  const spent = world.backgroundTactical ? world.time % 60 : (world.activity.minuteBudgets?.[actorId]?.spent ?? 0);
  return { spent, remaining: 60 - spent };
}
export function spendMinutes(world: World, actorId: ActorId, minutes: number, activityId: string): void {
  world.activity.minuteBudgets ??= {};
  world.activity.minuteBudgets[actorId] ??= {
    spent: 0,
    activities: {},
    startActivity: world.activity.byActor[actorId]?.activityId ?? null,
  };
  const b = world.activity.minuteBudgets[actorId];
  if (!b) return;
  b.spent += minutes;
  b.activities[activityId] = (b.activities[activityId] ?? 0) + minutes;
}
/** Compatibility hook: settlement now reads the selected activity after arbitration. */
export function settleMinuteActivity(_world: World, _actorId: ActorId, _remainingActivity?: string): void {}
/** Current posture for callers displaying a single activity; settlement uses the full minute ledger. */
export function minutePhysiologyActivity(world: World, actorId: ActorId): string | null | undefined {
  return world.activity.byActor[actorId]?.activityId;
}
export function clearMinuteBudget(world: World, actorId: ActorId): void {
  if (!world.activity.minuteBudgets) return;
  delete world.activity.minuteBudgets[actorId];
  if (Object.keys(world.activity.minuteBudgets).length === 0) delete world.activity.minuteBudgets;
}

export { activitySystem as regionActivityHour } from './system.ts';

/** Resume a settled local routine after dormancy; no travel/short-act time is fabricated. */
export function resumeDormantActor(world: World, actorId: ActorId, now: import('../time.ts').GameMinute): void {
  const actor = world.actors[actorId];
  const state = world.activity.byActor[actorId];
  const home = actor && world.households[actor.householdId]?.homePlaceId;
  if (!actor || !state || home === undefined) return;
  actor.placeId = home;
  state.placeId = home;
  state.activityId = 'idle_at_home';
  state.since = now;
  state.lockedUntil = null;
  state.travel = null;
  if (world.activity.minuteBudgets) delete world.activity.minuteBudgets[actorId];
}
export { dormantProduction } from './dormant.ts';
