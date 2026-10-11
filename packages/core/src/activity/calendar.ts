/** Content calendar: day-stable attendance, sun hours, seasonal fallback, household rotas. */
import type { ObservanceBlock, ObservanceDef, SunAnchor, Who } from '@coulee/content/schema';
import { type ScheduleBlock, VALUES } from '../content.ts';
import type { Explain } from '../explain.ts';
import { type ActorId, type HouseholdId, idsOf } from '../ids.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { type CalendarInfo, daysFromCivil, yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import { hourInBlock, resolveActivityPlace, scheduledBlock } from './api.ts';
import { requiredRow } from './definitions.ts';

export function monthMatches(month: number, range?: readonly [number, number]): boolean {
  return (
    !range || (range[0] <= range[1] ? month >= range[0] && month <= range[1] : month >= range[0] || month <= range[1])
  );
}
export function anchoredHour(hour: number, anchor: SunAnchor | undefined, cal: CalendarInfo): number {
  if (!anchor) return hour;
  const minutes = anchor.anchor === 'sunrise' ? cal.sunriseMinute : cal.sunsetMinute;
  return Math.max(anchor.min_hour, Math.min(anchor.max_hour, Math.round(minutes / 60) + anchor.offset_h));
}
export function blockActive(
  block: Pick<ScheduleBlock, 'from' | 'to' | 'from_sun' | 'to_sun'>,
  cal: CalendarInfo,
): boolean {
  return hourInBlock(
    cal.hour,
    anchoredHour(block.from, block.from_sun, cal),
    anchoredHour(block.to, block.to_sun, cal),
  );
}
/** Gregorian computus uses only integer arithmetic; 1855 Easter falls on April 8. */
function easterDay(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return daysFromCivil(year, Math.floor(n / 31), (n % 31) + 1);
}
export function observanceActive(def: ObservanceDef, cal: CalendarInfo): boolean {
  const w = def.when;
  return (
    (!w.weekdays || w.weekdays.includes(cal.weekday)) &&
    (!w.months || w.months.includes(cal.month)) &&
    (!w.day_range || (cal.day >= w.day_range[0] && cal.day <= w.day_range[1])) &&
    (!w.date || (cal.month === w.date.month && cal.day === w.date.day)) &&
    (w.easter_offset === undefined ||
      daysFromCivil(cal.year, cal.month, cal.day) - easterDay(cal.year) === w.easter_offset)
  );
}
function eligible(world: World, ctx: SimContext, id: ActorId, who: Who): boolean {
  const a = world.actors[id];
  if (!a?.alive) return false;
  const roles = ctx.content.occupations[a.occupationId]?.roles ?? [];
  const home = world.households[a.householdId]?.homePlaceId;
  const kind = home !== undefined ? world.places[home]?.kind : undefined;
  const workplace = world.activity.byActor[id]?.workplaceId;
  const tags = workplace !== null && workplace !== undefined ? (world.places[workplace]?.tags ?? []) : [];
  const age = yearsBetween(a.born, ctx.now);
  return (
    (!who.roles || who.roles.some((r) => roles.includes(r))) &&
    !who.not_roles?.some((r) => roles.includes(r)) &&
    (!who.home_kinds || (kind !== undefined && who.home_kinds.includes(kind))) &&
    (!who.not_home_kinds || kind === undefined || !who.not_home_kinds.includes(kind)) &&
    !who.not_workplace_tags?.some((t) => tags.includes(t)) &&
    (!who.sexes || who.sexes.includes(a.sex)) &&
    (who.min_age === undefined || age >= who.min_age) &&
    (who.max_age === undefined || age <= who.max_age)
  );
}
/** Precompute the whole day's choices, so proposal order cannot change attendance. */
export function ensureCalendar(world: World, ctx: SimContext): void {
  if (world.activity.calendar?.dayIndex === ctx.cal.dayIndex) return;
  const calendar = {
    dayIndex: ctx.cal.dayIndex,
    rolls: {} as Record<string, number>,
    rotas: {} as Record<string, ActorId>,
  };
  world.activity.calendar = calendar;
  for (const key of Object.keys(ctx.content.observances).sort()) {
    const def = requiredRow(ctx.content.observances, key);
    if (!observanceActive(def, ctx.cal)) continue;
    if (def.announce)
      ctx.emit({ kind: 'activity.observance', data: { observanceId: key, name: def.name }, importance: 10 });
    for (let index = 0; index < def.blocks.length; index++) {
      const b = requiredRow(def.blocks, index);
      const candidates = idsOf<ActorId>(world.actors).filter((id) => eligible(world, ctx, id, b.who));
      if (b.who.rota)
        for (const hid of idsOf<HouseholdId>(world.households)) {
          const members = candidates.filter((id) => world.actors[id]?.householdId === hid);
          const selected = ctx
            .rng('activity', mixKey(hid, ctx.cal.dayIndex, hashString32(key), index, 0x726f7461))
            .pick(members);
          if (selected !== undefined) {
            calendar.rotas[`${key}:${index}:${hid}`] = selected;
            ctx.emit({
              kind: 'activity.rota',
              data: { householdId: hid, observanceId: key, block: index, actorId: selected },
              roles: [{ actor: selected, role: 'agent' }],
              visibility: 'private',
              explain: {
                kind: 'choice',
                label: 'Household chore rota',
                subjects: [selected],
                knowledge: 'participants',
                terms: [{ source: 'base', label: 'Eligible household members', value: members.length }],
                total: selected,
                outcome: 'chosen',
              },
            });
          }
        }
      for (const id of candidates) {
        if (b.who.rota && calendar.rotas[`${key}:${index}:${requiredRow(world.actors, id).householdId}`] !== id)
          continue;
        if (!b.attend) continue;
        const actor = requiredRow(world.actors, id);
        const terms = [{ source: 'base', label: 'Customary attendance', value: b.attend.base_pct }];
        for (const value of VALUES)
          if (b.attend.value_pct[value])
            terms.push({
              source: 'value',
              label: value,
              value: actor.values[value] * (b.attend.value_pct[value] ?? 0) || 0,
            });
        for (const trait of actor.traits)
          if (b.attend.trait_pct[trait])
            terms.push({ source: 'trait', label: trait, value: requiredRow(b.attend.trait_pct, trait) });
        const sum = terms.reduce((total, t) => total + t.value, 0);
        const chance = Math.max(0, Math.min(100, sum));
        terms.push({ source: 'base', label: 'Probability bounds', value: chance - sum });
        const roll = ctx
          .rng('activity', mixKey(id, ctx.cal.dayIndex, hashString32(key), index, 0x61747464))
          .int(1, 100);
        calendar.rolls[`${key}:${index}:${id}`] = roll;
        ctx.emit({
          kind: 'activity.attendance',
          data: { actorId: id, observanceId: key, block: index, chance, roll, attends: roll <= chance },
          roles: [{ actor: id, role: 'subject' }],
          visibility: 'inner',
          explain: {
            kind: 'check',
            label: `${def.name}: attendance`,
            subjects: [id],
            knowledge: 'self',
            terms,
            roll: { die: 100, natural: roll },
            total: chance,
            dc: { total: roll, terms: [] },
            outcome: roll <= chance ? 'attends' : 'stays',
            margin: chance - roll,
          },
        });
      }
    }
  }
}
export interface Routine {
  activityId: string;
  duty: number;
  norm?: string;
  speaker?: string;
  observanceId?: string;
  explain: Explain;
}
function validActivity(
  world: World,
  ctx: SimContext,
  id: ActorId,
  activityId: string,
  fallback?: string,
): string | null {
  const def = ctx.content.activities[activityId];
  if (def && monthMatches(ctx.cal.month, def.months) && resolveActivityPlace(world, ctx, id, activityId) !== null)
    return activityId;
  const alt = fallback ? ctx.content.activities[fallback] : undefined;
  return alt && monthMatches(ctx.cal.month, alt.months) && resolveActivityPlace(world, ctx, id, alt.id) !== null
    ? alt.id
    : null;
}
export function routineFor(world: World, ctx: SimContext, id: ActorId): Routine | null {
  ensureCalendar(world, ctx);
  const actor = world.actors[id];
  if (!actor?.alive) return null;
  const occ = ctx.content.occupations[actor.occupationId];
  const schedule = scheduledBlock(world, ctx, id, ctx.cal);
  let activityId = schedule ? validActivity(world, ctx, id, schedule.activity, schedule.fallback) : null;
  let duty = schedule?.duty ?? 0;
  let priority = activityId ? (ctx.content.activities[activityId]?.asleep ? 100 : 20) : 0;
  let norm: string | undefined;
  let speaker: string | undefined;
  let observanceId: string | undefined;
  for (const key of Object.keys(ctx.content.observances).sort()) {
    const def = requiredRow(ctx.content.observances, key);
    if (!observanceActive(def, ctx.cal)) continue;
    const workplace = world.activity.byActor[id]?.workplaceId;
    const tags = workplace !== null && workplace !== undefined ? (world.places[workplace]?.tags ?? []) : [];
    const exempt = def.exempt_roles.some((r) => occ?.roles.includes(r));
    const activity = activityId ? ctx.content.activities[activityId] : undefined;
    if (
      !exempt &&
      activity &&
      !activity.asleep &&
      !activity.tags.includes('essential') &&
      ((def.rest_labor && activity.tags.includes('labor')) ||
        (activity.at === 'workplace' && def.closes.some((t) => tags.includes(t))))
    ) {
      activityId = validActivity(world, ctx, id, def.rest_activity ?? 'idle_at_home');
      duty = 350;
      norm = 'piety';
      observanceId = key;
    }
    for (let index = 0; index < def.blocks.length; index++) {
      const b: ObservanceBlock = requiredRow(def.blocks, index);
      if (!blockActive(b, ctx.cal) || !eligible(world, ctx, id, b.who)) continue;
      if (priority >= 100 && !b.override_sleep) continue;
      if (b.who.rota && world.activity.calendar?.rotas[`${key}:${index}:${actor.householdId}`] !== id) continue;
      if (b.priority <= priority && !(priority === 100 && b.override_sleep)) continue;
      let attends = true;
      if (b.attend) {
        let chance = b.attend.base_pct;
        for (const v of VALUES) chance += actor.values[v] * (b.attend.value_pct[v] ?? 0);
        for (const t of actor.traits) chance += b.attend.trait_pct[t] ?? 0;
        attends =
          (world.activity.calendar?.rolls[`${key}:${index}:${id}`] ?? 101) <= Math.max(0, Math.min(100, chance));
      }
      // Declining an optional visit preserves work. Worship fallbacks explicitly keep the Sabbath.
      const selected = attends
        ? validActivity(world, ctx, id, b.activity, b.fallback)
        : ctx.content.activities[b.activity]?.tags.includes('worship') && b.fallback
          ? validActivity(world, ctx, id, b.fallback)
          : null;
      if (!selected) continue;
      activityId = selected;
      priority = ctx.content.activities[selected]?.asleep ? 100 : b.priority;
      duty = b.duty;
      for (const v of VALUES) duty += actor.values[v] * (b.duty_values[v] ?? 0);
      duty = Math.max(0, Math.min(1000, duty));
      norm = b.norm;
      speaker = b.speaker;
      observanceId = key;
    }
  }
  activityId ??= ctx.content.activities.idle_at_home ? 'idle_at_home' : null;
  if (!activityId) return null;
  const def = requiredRow(ctx.content.activities, activityId);
  return {
    activityId,
    duty,
    norm: norm ?? def.norm ?? 'duty',
    ...(speaker ? { speaker } : {}),
    ...(observanceId ? { observanceId } : {}),
    explain: {
      kind: 'choice',
      label: def.duty_label ?? `Daily round: ${def.name}`,
      subjects: [id],
      knowledge: 'self',
      terms: [{ source: 'base', label: observanceId ?? occ?.name ?? 'Home', value: duty }],
      total: duty,
      outcome: 'scheduled',
      note: `Calendar priority ${priority}`,
    },
  };
}
