/**
 * Psyche cross-module API. OWNER: module:psyche.
 */
import type { ActorId, ThoughtId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { ChosenUrge, UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { addToPools, anxietyBand, BAND_LABELS, composure, drainPools, type Pool } from './anxiety.ts';
import { presentedTraits as presented } from './mind.ts';
import type { ActorPsyche } from './state.ts';
import { psycheHour } from './system.ts';
import { fillLine, mergeCandidate, proposalCandidate } from './thoughts.ts';

/** Forget the cadence pace record (cadence.ts): any outside write makes the next hour a full pass. */
function unpace(world: World, id: ActorId): void {
  const p = world.psyche.byActor[id];
  if (p?.pace) delete p.pace;
}

/** This hour's arbitration result for an actor (read by activity and social). */
export function chosenUrge(world: World, actorId: ActorId): ChosenUrge | null {
  return world.psyche.byActor[actorId]?.chosen ?? null;
}

export function psycheOf(world: World, actorId: ActorId): ActorPsyche | undefined {
  return world.psyche.byActor[actorId];
}

/**
 * Inject a thought from outside the hourly proposal pass (e.g. social: after an insult the
 * Id voices "hit him"; belief: dread after hearing a witch rumor). It is weighted like any
 * proposal (traits, appetite/strictness, drive/norm), merges with a same-source thought for
 * the same urge, takes part in the next arbitration, and decays. Returns its id, or null
 * when the actor has no psyche or the weighted intensity is 0. Notable ones (≥ 500) log a
 * 'psyche.thought' event.
 */
export function addThought(world: World, ctx: SimContext, actorId: ActorId, proposal: UrgeProposal): ThoughtId | null {
  const p = world.psyche.byActor[actorId];
  const actor = world.actors[actorId];
  if (!p || !actor?.alive) return null;
  unpace(world, actorId);
  const cand = proposalCandidate(proposal, 'added');
  if (proposal.voice !== 'command') cand.decayPerHour = 150;
  cand.line = fillLine(proposal.label, {});
  const r = mergeCandidate(world, { content: ctx.content, actor, p, audience: 0 }, cand, ctx.now);
  if (!r) return null;
  if (r.thought.intensity >= 500) {
    ctx.emit({
      kind: 'psyche.thought',
      data: {
        actorId,
        thoughtId: r.thought.id,
        voice: r.thought.voice,
        label: r.thought.label,
        intensity: r.thought.intensity,
        ...(r.thought.targetId !== undefined ? { targetId: r.thought.targetId } : {}),
      },
      roles: [{ actor: actorId, role: 'agent' }],
      visibility: 'inner',
      explain: {
        kind: 'formula',
        label: r.thought.label,
        subjects: [actorId],
        knowledge: 'self',
        terms: r.thought.reasons.map((term) => ({ ...term })),
        total: r.thought.intensity,
        outcome: 'surfaced',
      },
    });
  }
  return r.thought.id;
}

/**
 * Add (or relieve, if negative) anxiety 0..1000, e.g. from a frightening event. Positive
 * shocks bypass the hourly accrual cap and book to `pool` (default 'real': a threat in the
 * world); relief comes off the pools pro rata (or `pool` first). Returns the new anxiety.
 */
export function addAnxiety(world: World, _ctx: SimContext, actorId: ActorId, delta: number, pool?: Pool): number {
  const p = world.psyche.byActor[actorId];
  if (!p) return 0;
  unpace(world, actorId);
  const d = Math.round(delta);
  if (d > 0) addToPools(p, { [pool ?? 'real']: d });
  else if (d < 0) drainPools(p, -d, pool);
  return p.anxiety;
}

/**
 * A defense's act landed on someone (social calls this after resolving a `via: 'defense'`
 * interaction). Displacement pays its stored relief only now (10 §7.2: the dog must be
 * kicked for the anger to go). Returns the relief drained.
 */
export function defenseActLanded(world: World, ctx: SimContext, actorId: ActorId, defense: string): number {
  const p = world.psyche.byActor[actorId];
  if (!p || defense !== 'displacement' || !p.displaced) return 0;
  unpace(world, actorId);
  const d = p.displaced;
  p.displaced = null;
  if (d.until !== undefined && d.until < ctx.now) return 0;
  return drainPools(p, d.amount);
}

/** Displaced anger stored for someone (10 §7.2) and still owed, or null. */
export function storedDisplacement(
  world: World,
  actorId: ActorId,
  now: number,
): { targetId: ActorId; amount: number; line: string } | null {
  const d = world.psyche.byActor[actorId]?.displaced;
  if (!d || d.targetId === undefined || d.amount <= 0) return null;
  if (d.until !== undefined && d.until < now) return null;
  if (world.actors[d.targetId]?.alive !== true) return null;
  return { targetId: d.targetId, amount: d.amount, line: d.line ?? '' };
}

/** Anxiety 0..1000 (0 when the actor has no psyche). */
export function anxietyOf(world: World, actorId: ActorId): number {
  return world.psyche.byActor[actorId]?.anxiety ?? 0;
}

/** The anxiety band (10 §6): 0 Easy … 4 Breaking, with its period label. */
export function anxietyBandOf(world: World, actorId: ActorId): { band: number; label: string } {
  const band = anxietyBand(anxietyOf(world, actorId));
  return { band, label: BAND_LABELS[band] ?? 'Easy' };
}

/** Composure = egoMod − anxiety band (10 §5.3): a modifier for Will-like checks (02 C3). */
export function composureOf(world: World, actorId: ActorId): number {
  const p = world.psyche.byActor[actorId];
  return p ? composure(p) : 0;
}

/** Norm strength 0..100 (10 §3.3), e.g. for social volition or belief plausibility. */
export function normStrength(world: World, actorId: ActorId, normId: string): number {
  return world.psyche.byActor[actorId]?.norms[normId] ?? 50;
}

/** Drive weight 0..100 (10 §3.2). */
export function driveWeight(world: World, actorId: ActorId, driveId: string): number {
  return world.psyche.byActor[actorId]?.drives[driveId] ?? 50;
}

/** Traits the actor shows in public: the Persona's if one is worn (10 §8.1), else their own. */
export function presentedTraits(world: World, actorId: ActorId): readonly string[] {
  return presented(world, actorId);
}

/** Shadow charge 0..100 on a trait (10 §8.2). Unconscious: never show this to the actor's own view. */
export function shadowCharge(world: World, actorId: ActorId, traitId: string): number {
  return world.psyche.byActor[actorId]?.shadowCharge[traitId] ?? 0;
}

/** Traits acquired from habitual defenses (Suspicious, Zealot; 10 §7.1). */
export function acquiredTraits(world: World, actorId: ActorId): readonly string[] {
  return world.psyche.byActor[actorId]?.acquired ?? [];
}

/**
 * The traits that act on behavior now: the sheet's innate traits (ActorCore.traits, read-only
 * after init) plus those acquired from habitual defenses (psyche state). Decision (MODULES.md
 * §1.4): psyche never writes ActorCore.traits; modules that weigh traits read this.
 */
export function effectiveTraits(world: World, actorId: ActorId): readonly string[] {
  const innate = world.actors[actorId]?.traits ?? [];
  const acquired = world.psyche.byActor[actorId]?.acquired ?? [];
  if (acquired.length === 0) return innate;
  return [...innate, ...acquired.filter((t) => !innate.includes(t))];
}

export type { Act, AgencyState, Basis, Issuer, StandingId } from './agency.ts';
export {
  agencyMode,
  agencyOf,
  applyStandingOrders,
  authorizationExplain,
  authorizeAct,
  autonomous,
  commandBasis,
  DEFAULT_STANDING_ORDERS,
  recordStandingSpend,
  setAgency,
  standingOrders,
} from './agency.ts';
export * from './tactical.ts';

/** Score a short explicit order with the ordinary Ego arbitration, without an hourly pass. */
export function arbitrateShortCommand(world: World, ctx: SimContext, actorId: ActorId, minutes: number): void {
  if (!ctx.commands.some((c) => c.actorId === actorId && c.kind === 'core.urge')) return;
  psycheHour(world, ctx, actorId, undefined, minutes);
}

export { dormantThoughtDecay } from './dormant.ts';
export { psycheSystem as regionPsycheHour } from './system.ts';

/** Forget an activity duty that has been completed or withdrawn. */
export function discardActivityThoughts(world: World, actorId: ActorId, activityId: string): void {
  const state = world.psyche.byActor[actorId];
  if (!state) return;
  unpace(world, actorId);
  state.thoughts = state.thoughts.filter((t) => t.urge.kind !== 'activity' || t.urge.activityId !== activityId);
  if (state.chosen?.urge.kind === 'activity' && state.chosen.urge.activityId === activityId) state.chosen = null;
}
