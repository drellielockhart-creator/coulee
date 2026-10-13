import { walkMinutes } from '../activity/api.ts';
import { tensionBelief } from '../belief/api.ts';
import { type Explain, normalizeExplain, term } from '../explain.ts';
import { effectiveFi } from '../fae/api.ts';
import type { ActorId } from '../ids.ts';
import { tensionNeeds } from '../needs/api.ts';
import { tensionProvisions } from '../provisions/api.ts';
import { anxietyOf } from '../psyche/api.ts';
import { pinnedPursuit } from '../region/api.ts';
import type { SimContext } from '../sim/context.ts';
import { obligationsCents } from '../social/api.ts';
import { combatDanger } from '../tactical/api.ts';
import type { World } from '../world.ts';
export const WEIGHTS = {
  physical_danger: 22,
  survival_pressure: 18,
  pursuit: 20,
  social_pressure: 15,
  uncanny: 8,
  economic_pressure: 7,
  inner_pressure: 10,
} as const;
export function measureTension(world: World, ctx: SimContext, pc: ActorId | null) {
  const a = pc === null ? undefined : world.actors[pc];
  let terms: Record<keyof typeof WEIGHTS, number> = {
    physical_danger: 0,
    survival_pressure: 0,
    pursuit: 0,
    social_pressure: 0,
    uncanny: 0,
    economic_pressure: 0,
    inner_pressure: 0,
  };
  if (pc !== null && a) {
    const needs = tensionNeeds(world, ctx.content, pc),
      belief = tensionBelief(world, pc);
    const supplies = tensionProvisions(world, ctx.content, pc, ctx.now, needs.survival),
      owed = obligationsCents(world, pc);
    const nearby = belief.hostileIds.some((id) => {
      const other = world.actors[id];
      return other?.alive && walkMinutes(world, ctx.content, a.placeId, other.placeId) <= 60;
    });
    const economic = owed > 0 ? Math.max(0, Math.floor(((owed - supplies.cash) * 1000) / owed)) : 0;
    terms = {
      physical_danger: Math.max(needs.physical, combatDanger(world, pc, belief.hostileIds), nearby ? 500 : 0),
      survival_pressure: Math.max(needs.survival, supplies.food, supplies.scurvy),
      pursuit: Math.max(belief.pursuit, pinnedPursuit(world, pc, belief.hostileIds)),
      social_pressure: Math.min(1000, belief.social + Math.min(500, owed)),
      uncanny: effectiveFi(world, a.placeId, ctx.now) * 200,
      economic_pressure: economic,
      inner_pressure: anxietyOf(world, pc),
    };
  }
  let sum = 0;
  const contributions = Object.entries(WEIGHTS).map(([key, weight]) => {
    const value = Math.max(0, Math.min(1000, terms[key as keyof typeof WEIGHTS]));
    terms[key as keyof typeof WEIGHTS] = value;
    sum += value * weight;
    return term('director', `${key}: ${value} per-mille × ${weight}%`, Math.floor((value * weight) / 100));
  });
  const tau = Math.floor(sum / 100);
  const rounding = tau - contributions.reduce((s, t) => s + t.value, 0);
  if (rounding) contributions.push(term('director', 'Combined weighted rounding', rounding));
  const explain: Explain = normalizeExplain({
    kind: 'formula',
    label: 'Observed tension',
    subjects: pc === null ? [] : [pc],
    knowledge: 'omniscient',
    terms: contributions,
    total: tau,
    outcome: 'measured',
    note: 'D0: observation only; no roll, no nudge.',
  });
  return { tau, terms, explain };
}
