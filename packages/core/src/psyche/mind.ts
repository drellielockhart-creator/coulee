/**
 * The situation a mind reads each hour: where the actor is, who is around, what the
 * schedule asks, and how they feel about the people they know. Plus the `when` and
 * `target` evaluators of the psyche's thought rules (10 §4.2 "situations as data").
 * OWNER: module:psyche. Reads other modules only through their api.ts.
 */
import type { TargetDef, WhenDef } from '@coulee/content/schema';
import { hourInBlock, isAsleep, occupants, scheduledRoutine } from '../activity/api.ts';
import { type ActorCore, shortName } from '../actor.ts';
import type { ContentBundle } from '../content.ts';
import type { ActorId } from '../ids.ts';
import { needValue } from '../needs/api.ts';
import type { SimContext } from '../sim/context.ts';
import { acquaintancesOf, areKin, memoriesOf, opinionOf, relationshipsOf } from '../social/api.ts';
import type { OpinionDims } from '../social/state.ts';
import type { CalendarInfo } from '../time.ts';
import type { World } from '../world.ts';
import type { ActorPsyche } from './state.ts';
import { buildTagIndex, intersects, type TagIndex } from './tags.ts';

export interface Mind {
  world: World;
  ctx: SimContext;
  content: ContentBundle;
  idx: TagIndex;
  cal: CalendarInfo;
  actorId: ActorId;
  actor: ActorCore;
  p: ActorPsyche;
  /** What the effective town calendar asks of the actor this hour (schedule, meals, Sabbath, observances). */
  block: { activity: string; duty: number } | null;
  asleep: boolean;
  /** Other living actors at the actor's place (ascending). */
  present: ActorId[];
  /** Present actors outside the household (the onlookers of 10 §4.2 #4). */
  audience: number;
  /** People the actor holds an opinion of, plus those present (ascending, no self, living). */
  known: ActorId[];
}

export function mindFor(world: World, ctx: SimContext, actorId: ActorId, idx?: TagIndex): Mind | null {
  const actor = world.actors[actorId];
  const p = world.psyche.byActor[actorId];
  if (!actor || !p) return null;
  const present = occupants(world, actor.placeId).filter((o) => o !== actorId && world.actors[o]?.alive === true);
  let audience = 0;
  for (const o of present) if (world.actors[o]?.householdId !== actor.householdId) audience++;
  const known = new Set<number>(present);
  // Acquaintances = the people this actor holds an opinion of (social's opinion table rows).
  for (const t of acquaintancesOf(world, actorId)) {
    if (t !== actorId && world.actors[t]?.alive === true) known.add(t);
  }
  return {
    world,
    ctx,
    content: ctx.content,
    idx: idx ?? buildTagIndex(ctx.content),
    cal: ctx.cal,
    actorId,
    actor,
    p,
    block: routineBlock(world, ctx, actorId),
    asleep: isAsleep(world, ctx, actorId),
    present,
    audience,
    known: [...known].sort((a, b) => a - b) as ActorId[],
  };
}

/** The effective calendar block (activity's routine), the same one activity falls back to. */
function routineBlock(world: World, ctx: SimContext, actorId: ActorId): { activity: string; duty: number } | null {
  const r = scheduledRoutine(world, ctx, actorId);
  return r ? { activity: r.activityId, duty: r.duty } : null;
}

export const isPresent = (m: Mind, other: ActorId): boolean => m.present.includes(other);

export function nameOf(m: Pick<Mind, 'world'>, id: ActorId | undefined | null): string {
  if (id === undefined || id === null) return 'someone';
  const a = m.world.actors[id];
  return a ? shortName(a) : 'someone';
}

/** Number of this actor's live debts: someone holds a `creditor` relationship over them. */
export function creditorsOf(m: Mind): Array<{ id: ActorId; cents: number }> {
  const out: Array<{ id: ActorId; cents: number }> = [];
  for (const r of relationshipsOf(m.world, m.actorId)) {
    // "a is creditor of b": a is owed by b.
    if (r.kind === 'creditor' && r.b === m.actorId && r.a !== m.actorId)
      out.push({ id: r.a, cents: r.amountCents ?? 0 });
  }
  return out.sort((x, y) => x.id - y.id);
}

/**
 * Power of `other` over this actor (10 §7.2): max(Respect, Fear, kin 50, creditor 60), 0..100.
 * The blocked objects of displacement are the powerful; the safer targets are the weak.
 */
export function powerOver(m: Mind, other: ActorId, op?: OpinionDims): number {
  const o = op ?? opinionOf(m.world, m.actorId, other);
  let pw = Math.max(0, o.respect, o.fear);
  if (areKin(m.world, m.actorId, other)) pw = Math.max(pw, 50);
  if (creditorsOf(m).some((c) => c.id === other)) pw = Math.max(pw, 60);
  const role = m.content.occupations[m.world.actors[other]?.occupationId ?? '']?.roles ?? [];
  if (role.length > 0) pw = Math.max(pw, 20 * Math.min(3, role.length));
  return Math.max(0, Math.min(100, pw));
}

/** The traits someone shows the world: their Persona's if they wear one, else their own (10 §8.1). */
export function presentedTraits(world: World, id: ActorId): readonly string[] {
  const p = world.psyche.byActor[id];
  if (p && p.personaTraits.length > 0) return p.personaTraits;
  return world.actors[id]?.traits ?? [];
}

// ---------------------------------------------------------------------------------------------
// `when` (10 §4.2)
// ---------------------------------------------------------------------------------------------

export interface WhenResult {
  ok: boolean;
  /** Set by need_below: floor((at − value) × 1000 / at). */
  needBase?: number;
  needLabel?: string;
}

function blockTags(m: Mind): readonly string[] {
  if (!m.block) return [];
  return m.idx.activity.get(m.block.activity) ?? [];
}

export function evalWhen(m: Mind, w: WhenDef | undefined): WhenResult {
  if (!w) return { ok: true };
  const r: WhenResult = { ok: true };
  if (w.need_below) {
    const v = needValue(m.world, m.actorId, w.need_below.need);
    if (v >= w.need_below.at) return { ok: false };
    r.needBase = Math.floor(((w.need_below.at - v) * 1000) / w.need_below.at);
    r.needLabel = `${m.content.needs[w.need_below.need]?.name ?? w.need_below.need} ${v}/${w.need_below.at}`;
  }
  if (w.hours && !hourInBlock(m.cal.hour, w.hours.from, w.hours.to)) return { ok: false };
  if (w.weekdays && !w.weekdays.includes(m.cal.weekday)) return { ok: false };
  if (w.sabbath !== undefined && m.cal.isSabbath !== w.sabbath) return { ok: false };
  if (w.asleep !== undefined && m.asleep !== w.asleep) return { ok: false };
  if (w.scheduled_tags && !intersects(blockTags(m), w.scheduled_tags)) return { ok: false };
  if (w.unscheduled !== undefined && (m.block === null) !== w.unscheduled) return { ok: false };
  for (const [v, min] of Object.entries(w.value_min ?? {})) {
    if ((m.actor.values[v as keyof typeof m.actor.values] ?? 0) < (min ?? -3)) return { ok: false };
  }
  for (const [v, max] of Object.entries(w.value_max ?? {})) {
    if ((m.actor.values[v as keyof typeof m.actor.values] ?? 0) > (max ?? 3)) return { ok: false };
  }
  for (const [d, min] of Object.entries(w.drive_min ?? {})) if ((m.p.drives[d] ?? 50) < min) return { ok: false };
  for (const [n, min] of Object.entries(w.norm_min ?? {})) if ((m.p.norms[n] ?? 50) < min) return { ok: false };
  for (const [n, max] of Object.entries(w.norm_max ?? {})) if ((m.p.norms[n] ?? 50) > max) return { ok: false };
  if (w.anxiety_min !== undefined && m.p.anxiety < w.anxiety_min) return { ok: false };
  if (w.audience_min !== undefined && m.audience < w.audience_min) return { ok: false };
  if (w.place_tags && !intersects(m.world.places[m.actor.placeId]?.tags ?? [], w.place_tags)) return { ok: false };
  if (w.debtor !== undefined && creditorsOf(m).length > 0 !== w.debtor) return { ok: false };
  if (w.traits_any && !w.traits_any.some((t) => m.actor.traits.includes(t) || m.p.acquired.includes(t)))
    return { ok: false };
  return r;
}

// ---------------------------------------------------------------------------------------------
// `target` (10 §4.2 #2–#3, 04 §3.6)
// ---------------------------------------------------------------------------------------------

export interface TargetPick {
  targetId: ActorId;
  /** Intensity added by how far past the threshold the feeling runs. */
  add: number;
  present: boolean;
  /** Absent-target multiplier, percent (100 when present). */
  pct: number;
  label: string;
}

/** Best-scoring target for a rule (ties by id); null when nobody qualifies. */
export function pickTarget(m: Mind, t: TargetDef): TargetPick | null {
  let best: TargetPick | null = null;
  const consider = (id: ActorId, points: number, label: string) => {
    if (points <= 0) return;
    const here = isPresent(m, id);
    if (t.present === 'yes' && !here) return;
    if (t.present === 'no' && here) return;
    if (t.not_kin && areKin(m.world, m.actorId, id)) return;
    const pct = here ? 100 : t.absent_pct;
    const add = Math.floor((t.per_point * points * pct) / 100);
    const cand: TargetPick = { targetId: id, add, present: here, pct, label };
    if (!best || cand.add > best.add || (cand.add === best.add && cand.targetId < best.targetId)) best = cand;
  };
  switch (t.pick) {
    case 'creditor': {
      for (const c of creditorsOf(m)) {
        consider(c.id, Math.max(1, Math.min(50, Math.floor(c.cents / 1000))), `owes ${nameOf(m, c.id)}`);
      }
      break;
    }
    case 'memory': {
      for (const mem of memoriesOf(m.world, m.actorId)) {
        if (!t.emotions.includes(mem.emotion) || mem.salience < t.salience_min) continue;
        const other = mem.roles.find((r) => r.who !== m.actorId && m.world.actors[r.who]?.alive === true);
        if (!other) continue;
        consider(other.who, Math.floor((mem.salience - t.salience_min) / 10) + 1, mem.summary);
      }
      break;
    }
    default: {
      const temper = m.actor.values.temper ?? 0;
      for (const id of m.known) {
        const o = opinionOf(m.world, m.actorId, id);
        if (t.pick === 'hostile') {
          const max = (t.affection_max ?? -30) + t.temper_slack * temper;
          if (o.affection <= max) consider(id, max - o.affection + 1, `Affection ${o.affection}`);
        } else if (t.pick === 'fond') {
          const min = t.affection_min ?? 50;
          if (o.affection >= min) consider(id, o.affection - min + 1, `Affection ${o.affection}`);
        } else if (t.pick === 'envied') {
          const min = t.respect_min ?? 20;
          if (o.respect >= min && o.affection <= (t.affection_max ?? 0)) {
            consider(id, o.respect - min + 1, `Respect ${o.respect}, Affection ${o.affection}`);
          }
        } else if (t.pick === 'feared') {
          const min = t.fear_min ?? 40;
          if (o.fear >= min) consider(id, o.fear - min + 1, `Fear ${o.fear}`);
        }
      }
    }
  }
  return best;
}
