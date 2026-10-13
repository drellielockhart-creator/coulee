import { officeOf } from './relief.ts';
import { theftPreflight } from './theft.ts';
/**
 * Read-only command/menu preflight; shares structural eligibility with social resolution.
 *
 * Playtest r2: availability reads what the target is actually doing, never the schedule they are
 * skipping. Someone present and awake can be talked with; someone at work can spare a short word
 * (or anything at sociable work: the bar, the counter); only the actually asleep, the actually
 * away and the long talk with a busy worker are refused, and each refusal says where they are and
 * until when. The activity system holds an invited target in place for the hour (still working,
 * if they were at work here), so nothing the schedule wanted can carry them off mid-sentence.
 */

import { currentActivity, isAsleep, scheduledBlock } from '../activity/api.ts';
import type { ContentBundle, InteractionDef } from '../content.ts';
import type { ActorId } from '../ids.ts';
import { canAct } from '../needs/api.ts';
import { autonomous } from '../psyche/api.ts';
import { makeContext } from '../sim/sim.ts';
import { calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { opinionRecord } from './opinion.ts';
import { ageYears, tuningOf } from './tuning.ts';
import { makePair, requiresFail } from './volition.ts';

/** What someone's working hours look like right now (null: not working, not due at work). */
export interface WorkStatus {
  /** Actually at a 'labor' activity this hour (not merely scheduled for one). */
  working: boolean;
  /** Not working now, but their schedule has them at labor this hour (talk keeps them from it). */
  due: boolean;
  activityId: string;
  /** Work this sociable is done while talking (keeping the tavern, the shop counter). */
  sociable: boolean;
  /** The hour (0..24) the work block ends, when known. */
  untilHour: number | null;
}

const WEEKDAY: Record<string, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

/** "20:00" today, "Wednesday 20:00" within the week, else the date ("the 12th, 08:00"). */
export function whenText(now: number, t: number): string {
  const c = calendarAt(t as never);
  const hh = `${String(c.hour).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const day = Math.floor(t / 1440) - Math.floor(now / 1440);
  if (day <= 0) return hh;
  if (day === 1) return `tomorrow ${hh}`;
  if (day < 7) return `${WEEKDAY[c.weekday] ?? c.weekday} ${hh}`;
  return `${dayText(t)}, ${hh}`;
}

/** "Friday the 4th of May". */
export function dayText(t: number): string {
  const c = calendarAt(t as never);
  return `${WEEKDAY[c.weekday] ?? c.weekday} the ${c.day}${ordinal(c.day)} of ${c.monthName}`;
}

function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return 'th';
  return n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
}

/**
 * The target's working hours as they stand: at work (a 'labor' activity, where they are), or due
 * at work by their schedule this hour though doing something else. Null when neither.
 */
export function workStatus(world: World, content: ContentBundle, targetId: ActorId): WorkStatus | null {
  const t = tuningOf(content);
  const state = currentActivity(world, targetId);
  if (!state || state.travel) return null;
  const ctx = makeContext(world, content, []);
  const block = scheduledBlock(world, ctx, targetId, calendarAt(world.time));
  const def = state.activityId ? content.activities[state.activityId] : undefined;
  if (def?.tags.includes('labor')) {
    const untilHour =
      block && block.activity === state.activityId
        ? block.to
        : state.lockedUntil !== null && state.lockedUntil > world.time
          ? Math.floor((state.lockedUntil % 1440) / 60)
          : null;
    return {
      working: true,
      due: false,
      activityId: def.id,
      sociable: def.sociability >= t.work_talk_sociability,
      untilHour,
    };
  }
  // Due at work only for someone who keeps their own schedule: a commanded actor's hours are
  // their orders, not a duty they could be kept from.
  const scheduled = block && autonomous(world, targetId) ? content.activities[block.activity] : undefined;
  if (scheduled?.tags.includes('labor') && !ctx.cal.isSabbath)
    return {
      working: false,
      due: true,
      activityId: scheduled.id,
      sociable: scheduled.sociability >= t.work_talk_sociability,
      untilHour: block?.to ?? null,
    };
  return null;
}

/** May a deliberate exchange of this length be had with someone at this work? */
export function workAllows(content: ContentBundle, work: WorkStatus | null, def: InteractionDef): boolean {
  if (!work?.working || work.sociable) return true;
  return def.minutes <= tuningOf(content).work_talk_minutes;
}

/** Open the shared allowance only when sub-hour social execution is used. */
export function beginMinuteTalk(world: World): void {
  if (world.social.minuteTalk?.at !== Math.floor(world.time / 60) * 60)
    world.social.minuteTalk = { at: Math.floor(world.time / 60) * 60, pairs: {}, workMinutes: {} };
}

const talkKey = (a: ActorId, b: ActorId, interaction: string) => `${Math.min(a, b)}:${Math.max(a, b)}:${interaction}`;

/** Shared by preflight, NPC selection and resolution; no controller-specific rules. */
export function minuteTalkBlock(
  world: World,
  content: ContentBundle,
  a: ActorId,
  b: ActorId,
  def: InteractionDef,
): string | null {
  const budget = world.social.minuteTalk;
  if (budget?.at !== Math.floor(world.time / 60) * 60) return null;
  if (budget.pairs[talkKey(a, b, def.id)])
    return 'You have already had this exchange together this hour; try next hour';
  for (const id of [a, b]) {
    const used = budget.workMinutes[id] ?? 0;
    if (used > 0 && !workAllows(content, workStatus(world, content, id), { ...def, minutes: used + def.minutes }))
      return `${world.actors[id]?.name.given ?? 'That person'} has no more time for talk at work this hour; try next hour`;
  }
  return null;
}

export function noteMinuteTalk(
  world: World,
  content: ContentBundle,
  a: ActorId,
  b: ActorId,
  def: InteractionDef,
): void {
  const budget = world.social.minuteTalk;
  if (budget?.at !== Math.floor(world.time / 60) * 60) return;
  budget.pairs[talkKey(a, b, def.id)] = true;
  for (const id of [a, b]) {
    const work = workStatus(world, content, id);
    if (work?.working && !work.sociable) budget.workMinutes[id] = (budget.workMinutes[id] ?? 0) + def.minutes;
  }
}

/**
 * Does a deliberate exchange keep the target from their work (at work, or due there, at work
 * that is not done while talking)? Social books a little regard for it (`kept_from_work`).
 */
export function keepsFromWork(work: WorkStatus | null): boolean {
  return work !== null && !work.sociable && (work.working || work.due);
}

const pad = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

/** A structural `requiresFail` code as a sentence about this pair. */
function sentence(code: string, def: InteractionDef, name: string): string {
  const fixed: Record<string, string> = {
    self: 'You cannot do that with yourself',
    'not acquainted': `You have not met ${name} yet; introduce yourself first`,
    'already acquainted': `You have already met ${name}; there is no need to introduce yourself again`,
    'too young': 'You are too young for that',
    'target too young': `${name} is too young for that`,
    'wrong venue': `${def.name} is not done here`,
    'not here': `${def.name} is not done here, of all places`,
    'no office': `${def.name} wants an office you do not hold`,
    'not kin': `${name} is not your kin`,
    kin: `${name} is your kin`,
    'too soon': `You and ${name} have not been walking out long enough for that`,
    'not eligible': `${name} is not free to court, or you are not`,
    'owed nothing': `${name} owes you nothing`,
    'owes nothing': `You owe ${name} nothing`,
    'nothing to answer': `${name} has done nothing to you that wants an answer`,
    'nothing to atone for': `You have done ${name} no wrong to make amends for`,
    'target at ease': `${name} seems at ease; there is nothing to comfort`,
    'not enough cash': 'You have not enough cash for that',
    'target has not enough cash': `${name} has not enough cash for that`,
    'hardly knows you': `${name} hardly knows you yet; ask again when you are better acquainted`,
    'nothing to give': `You have nothing to give ${name}: a twist of tobacco, some sweets or a little food would do`,
    'not speaking': `You and ${name} are not on speaking terms`,
    unavailable: `${name} cannot be approached now`,
  };
  if (fixed[code]) return fixed[code];
  if (code.startsWith('already ')) {
    const kind = code.slice('already '.length);
    return kind === 'courting'
      ? `You are already walking out with ${name}`
      : `You and ${name} are already ${kind.replaceAll('_', ' ')}`;
  }
  if (code.startsWith('no ')) {
    const kind = code.slice('no '.length);
    return kind === 'courting'
      ? `You are not walking out with ${name}`
      : `You and ${name} have no ${kind.replaceAll('_', ' ')} between you`;
  }
  if (code.endsWith(' too low')) return `${def.name} is not in your nature (${code})`;
  return `${def.name} with ${name}: ${code}`;
}

export function interactionAvailability(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  targetId: ActorId,
  interactionId: string,
  itemId?: import('../ids.ts').ItemId,
): { ok: boolean; reason?: string } {
  const actor = world.actors[actorId],
    target = world.actors[targetId],
    def = content.interactions[interactionId];
  const no = (reason: string) => ({ ok: false, reason });
  if (!actor || !target || !def) return no('Unknown person or interaction');
  const hourlyBlock = minuteTalkBlock(world, content, actorId, targetId, def);
  if (hourlyBlock) return no(hourlyBlock);
  if (def.theft) {
    const reason = theftPreflight(world, content, actorId, targetId, itemId);
    return reason ? no(reason) : { ok: true };
  }
  if (def.relief === 'collect' && !officeOf(world, targetId)) return no('That person keeps no relief pantry');
  if (!canAct(world, actorId) || !canAct(world, targetId)) return no('An incapacitated person cannot converse');
  const name = `${target.name.given} ${target.name.family}`.trim();
  if (!target.alive || target.placeId !== actor.placeId) return no(`${name} is not here`);
  const ctx = makeContext(world, content, []);
  // An infant is carried about, not talked with: social never puts one in a conversation.
  if (ageYears(target, world.time) < tuningOf(content).min_social_age) return no(`${name} is too young to talk with`);
  const state = currentActivity(world, targetId);
  if (state?.travel)
    return no(`${name} is leaving for ${world.places[state.travel.to]?.name ?? 'another place'} (already on the road)`);
  // What they are doing, not what their schedule says they ought to be doing (before anyone's
  // first hour, when nobody is doing anything yet, the schedule is all there is to go on).
  const scheduled = state?.activityId == null ? scheduledBlock(world, ctx, targetId, calendarAt(world.time)) : null;
  if (isAsleep(world, ctx, targetId) || (scheduled && content.activities[scheduled.activity]?.asleep))
    return no(`${name} is asleep`);
  const work = workStatus(world, content, targetId);
  if (!workAllows(content, work, def)) {
    const doing = content.activities[work?.activityId ?? '']?.verb ?? 'at work';
    const until = work?.untilHour != null ? ` until ${pad(work.untilHour)}` : '';
    return no(
      `${name} is ${doing} here${until}; a short word (a greeting, a chat, settling up, the news) is all that can be had now`,
    );
  }
  const own = currentActivity(world, actorId);
  if (own?.lockedUntil != null && own.lockedUntil > world.time) {
    const doing = content.activities[own.activityId ?? '']?.verb ?? 'busy';
    return no(`You are still ${doing} until ${whenText(world.time, own.lockedUntil)}`);
  }
  const pair = makePair(world, ctx, actorId, targetId, actor.placeId, 0);
  if (!pair) return no(sentence('unavailable', def, name));
  // Structural reasons first (already walking out beats "not yet"), then the cooldown.
  const structural = requiresFail(pair, def, 'forced');
  if (structural) return no(sentence(structural, def, name));
  const reason = requiresFail(pair, def, 'urge');
  if (reason === 'cooldown') {
    const until = opinionRecord(world, actorId, targetId)?.cooldowns[def.id] ?? world.time;
    return no(`Not yet: you had “${def.name}” with ${name} too lately; again from ${whenText(world.time, until)}`);
  }
  return reason ? no(sentence(reason, def, name)) : { ok: true };
}
