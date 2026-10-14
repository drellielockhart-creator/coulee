/**
 * Director bias hooks (DIRECTOR-PLAN §2; 05 §8.3). The Director publishes biases as data in
 * `world.director.plan`; owning modules consult them through their own api.ts hooks at the
 * moment they decide. Every lookup defaults to "no bias": no plan, no live bias, or a decision
 * the PC could perceive (fair dice) all return nothing. Leaf module: no sim imports.
 */
import type { ActorId, PlaceId } from '../ids.ts';
import type { World } from '../world.ts';
import type { Bias, HookKind, NudgeId, NudgeRecord, NudgeTotals, PlanState } from './state.ts';

export const NUDGE_RETENTION = 128;
const NONE: readonly Bias[] = [];

/** Whom fairness protects: the observed PC (CLI) or the playing PC. */
export function directorFocus(world: World): ActorId | null {
  return world.director?.focus ?? world.meta.playerId ?? null;
}

/**
 * The fair-dice gate. A decision is perceivable when the PC takes part in it, or any party
 * or the place of the decision shares the PC's place at this moment (T0 presence; the same
 * place test social's `perceivedEvents` uses for public and witnessed events). Conservative:
 * secret and private acts of others at the PC's place also count as perceivable.
 */
export function pcPerceives(world: World, actors: readonly number[], places: readonly number[]): boolean {
  const pc = directorFocus(world);
  if (pc === null) return false;
  if (actors.includes(pc)) return true;
  const here = world.actors[pc]?.placeId;
  if (here === undefined) return false;
  if (places.includes(here)) return true;
  for (const id of actors) if (world.actors[id as ActorId]?.placeId === here) return true;
  return false;
}

export interface Consult {
  hook: HookKind;
  process: string;
  /** Whose decision this is (the carrier, the chooser); matched against `Bias.subject`. */
  subject: number | null;
  /** Everyone taking part, and where: the fair-dice gate. */
  actors: readonly number[];
  places: readonly number[];
}

/** Live biases for one decision, after the fair-dice gate. Cheap when nothing is published. */
export function liveBiases(world: World, c: Consult): readonly Bias[] {
  const plan = world.director?.plan;
  if (!plan || plan.biases.length === 0) return NONE;
  let out: Bias[] | null = null;
  for (const b of plan.biases) {
    if (b.hook !== c.hook || b.process !== c.process || b.expires <= world.time) continue;
    if (b.subject !== null && b.subject !== c.subject) continue;
    out ??= [];
    out.push(b);
  }
  if (out === null || pcPerceives(world, c.actors, c.places)) return NONE;
  return out;
}

/** Is any bias live for this chooser, regardless of the fair gate? (Continuity checks only.) */
export function hasLiveBias(world: World, hook: HookKind, proc: string, subject: number): boolean {
  const plan = world.director?.plan;
  if (!plan || plan.biases.length === 0) return false;
  return plan.biases.some(
    (b) =>
      b.hook === hook && b.process === proc && b.expires > world.time && (b.subject === null || b.subject === subject),
  );
}

export function pcPlace(world: World): PlaceId | null {
  const pc = directorFocus(world);
  return pc === null ? null : (world.actors[pc]?.placeId ?? null);
}
export function pcHousehold(world: World): number | null {
  const pc = directorFocus(world);
  return pc === null ? null : (world.actors[pc]?.householdId ?? null);
}

/** Does this bias favour `key` (a prop, place or household id)? `toward_pc` resolves now. */
export function favours(world: World, b: Bias, key: number, kind: 'place' | 'household' | 'key'): boolean {
  if (!b.toward_pc) return b.key === key;
  return kind === 'place' ? pcPlace(world) === key : kind === 'household' ? pcHousehold(world) === key : false;
}

/** N8's envelope: an option within 15% of the chooser's best score (05 §8.3). */
export const OPTION_TILT_MAX_PM = 150;
/** N9's envelope: a detect DC at most 2 easier (05 §8.3). */
export const THRESHOLD_TILT_MAX = 2;

export interface Tilt {
  amount: number;
  bias: Bias;
}

/** Generic `optionTilt(actor, decision, option)`: per-mille of the best score for a favoured option. */
export function optionTiltFor(
  world: World,
  proc: string,
  chooser: ActorId,
  kind: 'place' | 'household',
  places: readonly number[],
): ((option: number) => Tilt | null) | null {
  const live = liveBiases(world, { hook: 'option', process: proc, subject: chooser, actors: [chooser], places });
  if (live.length === 0) return null;
  return (option) => {
    const b = live.find((x) => favours(world, x, option, kind));
    return b ? { amount: Math.min(OPTION_TILT_MAX_PM, Math.max(0, b.amount)), bias: b } : null;
  };
}

/** Generic `windowPick(eventKind, key, window)`: a time inside the event's own window. */
export function windowPickFor(
  world: World,
  proc: string,
  subject: number,
  actors: readonly number[],
  places: readonly number[],
  span: readonly [number, number],
  fallback: number,
): { at: number; bias: Bias | null } {
  const b = liveBiases(world, { hook: 'window', process: proc, subject, actors, places })[0];
  if (!b) return { at: fallback, bias: null };
  return { at: Math.max(span[0], Math.min(span[1], fallback + b.amount)), bias: b };
}

/** Generic `thresholdTilt(process, key)`: DC points off an unseen detect check. */
export function thresholdTiltFor(
  world: World,
  proc: string,
  key: number,
  kind: 'place' | 'household' | 'key',
  actors: readonly number[],
  places: readonly number[],
): Tilt | null {
  const live = liveBiases(world, { hook: 'threshold', process: proc, subject: null, actors, places });
  const b = live.find((x) => favours(world, x, key, kind));
  return b ? { amount: Math.min(THRESHOLD_TILT_MAX, Math.max(0, b.amount)), bias: b } : null;
}

export function totalsOf(plan: PlanState, nudge: NudgeId | 'mercy_wanted'): NudgeTotals {
  plan.totals[nudge] ??= { placed: 0, effects: 0, charged: 0, cost: 0, expired_unused: 0 };
  return plan.totals[nudge];
}

export function pushRecord(world: World, row: NudgeRecord): void {
  const plan = world.director?.plan;
  if (!plan) return;
  plan.nudges.push(row);
  if (plan.nudges.length > NUDGE_RETENTION) {
    plan.nudges_compacted += plan.nudges.length - NUDGE_RETENTION;
    plan.nudges.splice(0, plan.nudges.length - NUDGE_RETENTION);
  }
}

/**
 * The owner reports a consult that changed its outcome. The first change charges the bias's
 * reserved cost (foresight `tiltable`/`full`: spend only when the tilt flips something; with
 * `off` it was charged at placement). Writes the Ledger record.
 */
export function noteNudge(
  world: World,
  b: Bias,
  target: number | null,
  before: number | string,
  after: number | string,
  foresaw = false,
  stamp = `${target}:${after}:${Math.floor(world.time / 1440)}`,
): void {
  const st = world.director;
  const plan = st?.plan;
  if (!st || !plan) return;
  // A re-decision of the same outcome is one effect (by default one per target, outcome and day).
  if (b.last_effect === stamp) return;
  b.last_effect = stamp;
  b.effects++;
  const totals = totalsOf(plan, b.nudge);
  totals.effects++;
  let cost = 0;
  if (!b.charged) {
    const group = b.group ?? b.id;
    for (const x of plan.biases) if ((x.group ?? x.id) === group) x.charged = true;
    b.charged = true;
    cost = b.cost;
    plan.budget -= cost;
    plan.reserved = Math.max(0, plan.reserved - cost);
    totals.charged++;
    totals.cost += cost;
  }
  pushRecord(world, {
    t: world.time,
    nudge: b.nudge,
    bias: b.id,
    process: b.process,
    target,
    before,
    after,
    rationale: { threadId: b.thread, tension: b.tau, move: b.move, pacing: st.pacing },
    cost,
    foresaw: foresaw && st.settings.foresight !== 'off',
    knowledge: 'omniscient',
  });
}
