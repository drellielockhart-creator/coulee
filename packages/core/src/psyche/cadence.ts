/**
 * Psyche cadence for idle minds (perf wave 13, proposal 2 of docs/impl/perf/2026-10-13-wave4-
 * hourly.md; 10 §4.2: generators run "on change events" at T0). OWNER: module:psyche.
 *
 * A sleeper whose situation has not changed since the last hour does not re-gather proposals or
 * re-scan thought rules: with unchanged inputs the gathering would renew the same thoughts and
 * the same arbitration would keep the same sleep. Its hour (system.ts `idleHour`) renews the
 * thoughts the last pass renewed, books the same frustration, persona strain and discharge,
 * fires a defense if one comes due, and ages every thought. `chosen` keeps its own `at` and
 * Explain: it is the arbitration that actually happened.
 *
 * The hour is idle only when ALL of these hold; otherwise the full pass runs that hour.
 *   1. Hourly processing (never a daily batch); the actor is asleep; the standing choice is that
 *      very activity (`chosen` is an activity urge equal to the current activity), voiced by a
 *      plain or standing (held) arbitration, never a command, compromise, sublimation or impulse.
 *   2. The last pass ran exactly one hour ago, fired no defense, and no defense is due now.
 *   3. Nothing happened to the actor since the last pass (`touchedSinceLastPass`): no Command
 *      names them (as the commanded actor or its target); no event names them in a role other
 *      than its agent (in a private event only a role something is done to: target, patient,
 *      victim, listener, beneficiary; a secret is unperceived); no public or witnessed event
 *      happened at their place (spoken to, struck, a hearth, an omen, a scene), routine
 *      `activity.started`/`activity.moved` aside (presence is in the signature). Inner never.
 *   4. The situation signature equals the last pass's (`paceSignature`): place; activity; whether
 *      the activity lock still runs (a lock ending is a full pass); held or free (authorization);
 *      the people present; the calendar routine (activity, duty: a scheduled block change); every
 *      need's band over all content thresholds (need bands and urges, drive `at`s, `need_below`s,
 *      500); the anxiety band; the night (the small-hours sleep pressure ends at NIGHT_END_HOUR);
 *      Sabbath; and the weekday when some `when` names weekdays.
 *   5. No content hour window that can apply to the sleeper opens or closes (`hourWindowEdge`).
 *   6. The choice is not close: at the last full pass no compromise or sublimation check was
 *      rolled, and the choice's base score led every rival by the hour's noise reach plus the
 *      compromise window plus SLACK_PER_HOUR for every hour since (needs drift within their
 *      bands: thirst deepens all night). No drive streak is old enough to roll for sublimation.
 *      (Shadow runs: ~0.3% of idle hours would have chosen otherwise in a full pass, almost all
 *      a sleeper getting up to drink an hour later than they would have.)
 * Psyche API writes from other modules (addThought, addAnxiety, a displaced act landing, a duty
 * discarded, agency or standing orders changed) drop the pace record: the next hour is full.
 *
 * Bookkeeping is integers in World and saved (`ActorPsyche.pace`, `PsycheState.seenEventId`); the
 * signature is a 32-bit mix of integers in a fixed order; nothing depends on query order, and a
 * restored save continues exactly as the uninterrupted run. The PC follows the same rule (P2):
 * a Command for an actor always forces the full pass, so command handling is never delayed.
 */
import { isAsleep, occupants, scheduledRoutine } from '../activity/api.ts';
import type { ContentBundle } from '../content.ts';
import type { ActorId } from '../ids.ts';
import { sortedKeys } from '../ids.ts';
import { needValue } from '../needs/api.ts';
import { isDailyProcessing } from '../region/processing.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { authorizeAct } from './agency.ts';
import { anxietyBand, defenseThreshold } from './anxiety.ts';
import type { ActorPsyche } from './state.ts';

/** Midnight to this hour, sleep pressure applies to a calendar bedtime (system.ts realityOf). */
export const NIGHT_END_HOUR = 5;
/** A discharged mind waits this long before another defense (system.ts maybeDefend). */
export const DEFENSE_REFRACTORY_MINUTES = 8 * 60;

/** Score drift allowed per idle hour since the last full pass (system.ts decisionSlack). */
export const SLACK_PER_HOUR = 60;

/** Routine comings and goings: who is present is in the signature; these are not scenes. */
const ROUTINE_MOVES: ReadonlySet<string> = new Set(['activity.started', 'activity.moved']);

/** Roles that something is done to (private events touch only these). */
const DONE_TO: ReadonlySet<string> = new Set(['target', 'patient', 'victim', 'listener', 'beneficiary']);

/**
 * Off by default (wave 13 measurement: ~6% of Iron Ford actor-hours qualify once every wake-up
 * condition is honoured, and the net gain was within run-to-run noise; see
 * docs/impl/perf/2026-10-14-psyche.md). Off, the cadence is inert: no pace records, no event
 * watermark, hash-identical to the code before it. On, it is deterministic and save-safe, but it
 * is a process-wide switch, not world state: a run (and its replays) must set it the same way.
 */
let cadenceOn = false;
export function setIdleCadence(on: boolean): void {
  cadenceOn = on;
}
export function idleCadenceEnabled(): boolean {
  return cadenceOn;
}

interface Thresholds {
  content: ContentBundle;
  needs: Array<{ id: string; at: number[] }>;
  windows: HourWindow[];
  /** Some `when` names weekdays (then the weekday is part of the signature). */
  weekdays: boolean;
}
/** A `when.hours` window and the static part of its condition (who it can apply to). */
interface HourWindow {
  from: number;
  to: number;
  /** `traits_any`, when the condition names one. */
  traits: readonly string[] | null;
  /** `asleep = false`: never applies to a sleeper. */
  awakeOnly: boolean;
  /** A sublimation template's window. */
  sublimation: boolean;
  /** The thought key a thought rule's window gates (`rule:<id>`), else null. */
  ruleKey: string | null;
}
let thresholdsCache: Thresholds | null = null;

/** Content thresholds the signature bands needs by, and the hour windows `when` can name. */
function thresholds(content: ContentBundle): Thresholds {
  if (thresholdsCache?.content === content) return thresholdsCache;
  const byNeed = new Map<string, Set<number>>();
  const add = (need: string, at: number) => {
    const s = byNeed.get(need) ?? new Set<number>();
    s.add(at);
    byNeed.set(need, s);
  };
  for (const id of sortedKeys(content.needs)) {
    const def = content.needs[id];
    if (!def) continue;
    add(id, 500);
    for (const b of def.bands) add(id, b.below);
    for (const u of def.urges) add(id, u.below);
  }
  for (const id of sortedKeys(content.drives)) for (const n of content.drives[id]?.needs ?? []) add(n.need, n.at);
  const windows: HourWindow[] = [];
  type When =
    | {
        need_below?: { need: string; at: number };
        hours?: { from: number; to: number };
        traits_any?: readonly string[];
        asleep?: boolean;
        weekdays?: readonly string[];
      }
    | undefined;
  let weekdays = false;
  const when = (w: When, sublimation = false, ruleKey: string | null = null) => {
    if (w?.need_below) add(w.need_below.need, w.need_below.at);
    if (w?.weekdays) weekdays = true;
    if (w?.hours)
      windows.push({
        from: w.hours.from,
        to: w.hours.to,
        traits: w.traits_any ?? null,
        awakeOnly: w.asleep === false,
        sublimation,
        ruleKey,
      });
  };
  for (const id of sortedKeys(content.thoughts)) when(content.thoughts[id]?.when, false, `rule:${id}`);
  for (const id of sortedKeys(content.norms)) for (const f of content.norms[id]?.forbids ?? []) when(f.when);
  for (const id of sortedKeys(content.sublimations)) when(content.sublimations[id]?.when, true);
  thresholdsCache = {
    content,
    needs: [...byNeed.keys()].sort().map((id) => ({ id, at: [...(byNeed.get(id) ?? [])].sort((a, b) => a - b) })),
    windows,
    weekdays,
  };
  return thresholdsCache;
}

const inWindow = (hour: number, from: number, to: number): boolean =>
  from < to ? hour >= from && hour < to : hour >= from || hour < to;

/** The situation signature (see the header for what it covers). */
export function paceSignature(world: World, ctx: SimContext, id: ActorId, p: ActorPsyche): number {
  const actor = world.actors[id];
  const act = world.activity.byActor[id];
  if (!actor || !act) return 0;
  const th = thresholds(ctx.content);
  const routine = scheduledRoutine(world, ctx, id);
  let h = mixKey(
    actor.placeId,
    hashString32(act.activityId ?? ''),
    act.lockedUntil !== null && ctx.now < act.lockedUntil ? 1 : 0,
    authorizeAct(world, id, { kind: 'consequential' }, { kind: 'own' }).ok ? 1 : 0,
    hashString32(routine?.activityId ?? ''),
    routine?.duty ?? -1,
    anxietyBand(p.anxiety),
    // The small-hours pressure starts at midnight (it only strengthens a standing sleep) and
    // ends at NIGHT_END_HOUR (when a sleeper may rise): count nights from that end.
    Math.floor((ctx.now - NIGHT_END_HOUR * 60) / 1440),
    ctx.cal.isSabbath ? 1 : 0,
    th.weekdays ? hashString32(ctx.cal.weekday) : 0,
  );
  for (const n of th.needs) {
    const v = needValue(world, id, n.id);
    let band = 0;
    for (const at of n.at) if (v < at) band++;
    h = mixKey(h, band);
  }
  for (const o of occupants(world, actor.placeId)) {
    if (o !== id && world.actors[o]?.alive === true) h = mixKey(h, o);
  }
  return h;
}

/**
 * Actors something happened to since the last pass (see the header), and moves the watermark.
 * `null` when there is no watermark yet (first pass, an old save): every mind runs in full.
 */
export function touchedSinceLastPass(world: World, ctx: SimContext): Set<ActorId> | null {
  const seen = world.psyche.seenEventId;
  world.psyche.seenEventId = world.log.lastId;
  if (seen === undefined) return null;
  const out = new Set<ActorId>();
  const ev = world.log.events;
  let i = ev.length;
  while (i > 0 && (ev[i - 1]?.id as number) > seen) i--;
  for (; i < ev.length; i++) {
    const e = ev[i];
    if (!e || e.visibility === 'inner') continue;
    const scene = e.visibility === 'public' || e.visibility === 'witnessed';
    for (const r of e.roles) {
      // One's own act was one's own choice. Out of sight, only what is done to one counts (a
      // private tally of one's day or household is bookkeeping); a secret is not perceived.
      if (r.role === 'agent' || e.visibility === 'secret' || (!scene && !DONE_TO.has(r.role))) continue;
      out.add(r.actor);
    }
    // Comings, goings and starting a chore are company, which the signature already covers.
    if (e.place !== undefined && scene && !ROUTINE_MOVES.has(e.kind))
      for (const o of occupants(world, e.place)) out.add(o);
  }
  for (const c of ctx.commands) {
    out.add(c.actorId);
    const d = c.data as Record<string, unknown> | undefined;
    for (const k of ['targetId', 'employerId'] as const) if (typeof d?.[k] === 'number') out.add(d[k] as ActorId);
    const u = (d as { urge?: { targetId?: unknown } } | undefined)?.urge;
    if (typeof u?.targetId === 'number') out.add(u.targetId as ActorId);
  }
  return out;
}

/**
 * Does a content hour window that can apply to this sleeper open or close this hour? Windows
 * of `asleep = false` conditions never apply; `traits_any` must be met (innate or acquired);
 * sublimation templates matter only once a drive streak could sublimate (system.ts decide needs
 * 3+ hours; a due defense is a full pass anyway). A thought rule's window closing matters only
 * while its thought is live (otherwise there is nothing left to stop renewing).
 */
export function hourWindowEdge(world: World, ctx: SimContext, id: ActorId, p: ActorPsyche): boolean {
  const actor = world.actors[id];
  if (!actor) return true;
  const hour = ctx.cal.hour;
  const prev = (hour + 23) % 24;
  let streak = -1;
  for (const w of thresholds(ctx.content).windows) {
    const now = inWindow(hour, w.from, w.to);
    const before = inWindow(prev, w.from, w.to);
    if (now === before || w.awakeOnly) continue;
    if (w.traits && !w.traits.some((t) => actor.traits.includes(t) || p.acquired.includes(t))) continue;
    if (w.sublimation) {
      if (streak < 0) for (const d of Object.keys(p.frustration)) streak = Math.max(streak, p.frustration[d] ?? 0);
      if (streak < 2) continue;
    }
    if (!now && w.ruleKey !== null && !p.thoughts.some((t) => t.key === w.ruleKey)) continue;
    return true;
  }
  return false;
}

/** Is this hour idle for the actor (everything but the signature, which the caller compares)? */
export function idleCandidate(
  world: World,
  ctx: SimContext,
  id: ActorId,
  p: ActorPsyche,
  touched: ReadonlySet<ActorId> | null,
  sig: number,
): boolean {
  if (!cadenceOn || touched === null || isDailyProcessing(world) || !isAsleep(world, ctx, id)) return false;
  const pace = p.pace;
  if (!pace || pace.at !== ctx.now - 60 || pace.sig !== sig) return false;
  const chosen = p.chosen;
  if (!chosen || chosen.voice === 'command' || (p.lastMode !== 'plain' && p.lastMode !== 'standing')) return false;
  if (chosen.urge.kind !== 'activity' || chosen.urge.activityId !== world.activity.byActor[id]?.activityId)
    return false;
  if (touched.has(id)) return false;
  // Needs keep drifting inside their bands (thirst deepens all night): the choice must lead its
  // rivals by more than the drift since the last full pass could close.
  if (pace.slack < SLACK_PER_HOUR * Math.floor((ctx.now - pace.full) / 60)) return false;
  // A drive frustrated 3+ hours rolls for sublimation every hour (system.ts decide).
  if (p.ego >= 55 || (p.defenseStyle.sublimation ?? 0) >= 15)
    for (const d of Object.keys(p.frustration)) if ((p.frustration[d] ?? 0) >= 2) return false;
  if (p.lastDefenseAt !== null && p.lastDefenseAt >= pace.at) return false;
  if (defenseDue(p, ctx.now)) return false;
  return !hourWindowEdge(world, ctx, id, p);
}

export function defenseDue(p: ActorPsyche, now: number): boolean {
  return (
    p.anxiety >= defenseThreshold(p.ego) &&
    (p.lastDefenseAt === null || now - p.lastDefenseAt >= DEFENSE_REFRACTORY_MINUTES)
  );
}
