import { notableObservedEvents } from '../chronicle/api.ts';
import { rowsOf } from '../ids.ts';
/** D0 observes after chronicle; only director state is writable. No RNG, hooks or nudges. */

import { eventsSince } from '../events/index.ts';
import { asEventId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import { perceivedEvents } from '../social/api.ts';
import type { World } from '../world.ts';
import { EMA_ALPHA_Q16, emaQ16 } from './fixed.ts';
import { assess } from './ledger.ts';
import { createDirectorState, type DirectorState, type MonthlyMetrics } from './state.ts';
import { measureTension } from './tension.ts';
import { rankThreads, updateThreads } from './threads.ts';

const DAY = 1440;
export function focusDirector(world: World, ctx: Pick<SimContext, 'content'>): void {
  const st = world.director;
  if (!st) return;
  const key = ctx.content.scenarios[world.meta.scenarioId]?.player;
  const focus = world.meta.playerId ?? (key ? (world.index.actorByKey[key] ?? null) : null);
  if (focus !== st.focus || st.prior_place === null) {
    st.focus = focus;
    st.prior_place = focus === null ? null : (world.actors[focus]?.placeId ?? null);
  }
}
export function pacingStep(
  st: DirectorState,
  now: number,
  curve: { relax_days: number; peak_threshold: number; peak_hours: number },
  threatResolved = false,
): void {
  st.low_hours = st.tau_fast < 300 ? st.low_hours + 1 : 0;
  const elapsed = now - st.pacing_since;
  const next =
    st.pacing === 'RELAX' && elapsed >= curve.relax_days * DAY
      ? 'BUILD'
      : st.pacing === 'BUILD' && st.tau_fast >= curve.peak_threshold
        ? 'PEAK'
        : st.pacing === 'PEAK' && (elapsed >= curve.peak_hours * 60 || st.tau_fast < 300 || threatResolved)
          ? 'FADE'
          : st.pacing === 'FADE' && st.low_hours >= 12
            ? 'RELAX'
            : st.pacing;
  if (next !== st.pacing) {
    st.pacing = next;
    st.pacing_since = now;
    st.low_hours = 0;
  }
}
function newMonth(): MonthlyMetrics {
  return {
    hours: 0,
    fast_sum: 0,
    slow_sum: 0,
    fast_max: 0,
    slow_max: 0,
    pacing: { RELAX: 0, BUILD: 0, PEAK: 0, FADE: 0 },
    dead_air_hours: 0,
    dead_air_days: 0,
    terms_sum: {},
  };
}
export function directorSystem(world: World, ctx: SimContext): void {
  world.director ??= createDirectorState();
  const st = world.director;
  // Tactical frame closing uses its original hour calendar, even when ctx.now is the boundary.
  const hour = ctx.cal.dayIndex * 24 + ctx.cal.hour;
  if (st.last_hour === hour) return;
  focusDirector(world, ctx);
  const first = st.last_hour < 0;
  if (first) st.pacing_since = ctx.now;
  st.last_hour = hour;
  const events = eventsSince(world.log, st.cursor);
  const seen = st.focus === null ? [] : perceivedEvents(events, st.focus, st.prior_place ?? undefined);
  st.cursor = world.log.lastId;
  st.prior_place = st.focus === null ? null : (world.actors[st.focus]?.placeId ?? null);
  const measure = measureTension(world, ctx, st.focus);
  st.tau = measure.tau;
  st.fast_q16 = first ? st.tau * 65536 : emaQ16(st.fast_q16, st.tau, EMA_ALPHA_Q16.fast);
  st.slow_q16 = first ? st.tau * 65536 : emaQ16(st.slow_q16, st.tau, EMA_ALPHA_Q16.slow);
  st.tau_fast = Math.floor(st.fast_q16 / 65536);
  st.tau_slow = Math.floor(st.slow_q16 / 65536);
  const before = st.pacing;
  const curve = ctx.content.directorPersonalities?.[st.settings.personality] ?? {
    relax_days: 7,
    peak_threshold: 700,
    peak_hours: 12,
  };
  const threatResolved = rowsOf(st.threads).some(
    (t) =>
      t.state === 'Resolved' &&
      t.closed_at === ctx.now &&
      t.stakes_pm >= 600 &&
      st.focus !== null &&
      Object.values(t.actors).includes(st.focus),
  );
  pacingStep(st, ctx.now, curve, threatResolved);
  st.events.push({
    id: asEventId(++st.event_seq),
    t: ctx.now,
    kind: 'director.tension',
    visibility: 'inner',
    roles: [],
    explain: measure.explain,
    data: { tau: st.tau, tau_fast: st.tau_fast, tau_slow: st.tau_slow, pacing: st.pacing, terms: measure.terms },
  });
  if (st.events.length > 168) st.events.splice(0, st.events.length - 168);
  updateThreads(world, ctx.now, new Set(seen.map((e) => e.id as number)), ctx.isNewDay || first);
  const key = `${ctx.cal.year}-${String(ctx.cal.month).padStart(2, '0')}`;
  st.months[key] ??= newMonth();
  const month = st.months[key];
  month.hours++;
  month.fast_sum += st.tau_fast;
  month.slow_sum += st.tau_slow;
  month.fast_max = Math.max(month.fast_max, st.tau_fast);
  month.slow_max = Math.max(month.slow_max, st.tau_slow);
  month.pacing[st.pacing]++;
  for (const [name, value] of Object.entries(measure.terms))
    month.terms_sum[name] = (month.terms_sum[name] ?? 0) + value;
  // Event importance uses the existing 0..100 scale; 30 is the Journal's notability floor.
  const notable = notableObservedEvents(world, ctx, st.focus, seen);
  const dead = st.dead_air;
  dead.day_hours++;
  dead.day_notable ||= notable;
  if (notable) dead.current_hours = 0;
  else {
    dead.hours++;
    dead.current_hours++;
    month.dead_air_hours++;
    dead.longest_hours = Math.max(dead.longest_hours, dead.current_hours);
  }
  if (dead.day_hours === 24) {
    if (!dead.day_notable) {
      dead.days++;
      month.dead_air_days++;
    }
    dead.day_hours = 0;
    dead.day_notable = false;
  }
  if (ctx.isNewDay || first) {
    const top = rowsOf(st.threads)
      .filter((t) => t.closed_at === null)
      .sort(rankThreads)[0];
    assess(st, {
      t: ctx.now,
      nudge: 'assessment',
      target: st.focus,
      before,
      after: st.pacing,
      rationale: { threadId: top?.id ?? null, tension: st.tau },
      cost: 0,
      foresaw: false,
      foresight: st.settings.foresight,
      knowledge: 'omniscient',
      explain: measure.explain,
    });
  }
}
