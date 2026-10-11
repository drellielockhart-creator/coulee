/**
 * Defenses (10 §7): selection by trigger fit × style, and the targets of projection and
 * displacement. OWNER: module:psyche.
 *
 * When anxiety ≥ Θ = 250 + 3E at the end of an arbitration, and no defense fired in the last
 * hour, every defense in content is scored:
 *   fit 0..3 = pool fit (the charge of the pools it answers: ≥50 → 1, ≥150 → 2, ≥300 → 3)
 *              + its own trigger bonus, gated by its own trigger and by ego (maturity tier);
 *   weight   = style × fit, picked with rng.weighted on stream 'psyche' (SALT_DEFENSE).
 *
 * The trigger rules per defense (DEFENSE_IDS is the closed M1 set of 7):
 *   repression          any charge in its pools; +1 when moral anxiety is the largest pool
 *   denial              realistic anxiety; +1 while a fear thought is live
 *   projection          a disowned (Shadow) trait with charge ≥ needs_shadow and a target whose
 *                       projection fit PF ≥ 30; +1 when that trait's drive is frustrated or the
 *                       Persona hides it
 *   displacement        a displaceable drive (rage, fear) frustrated, anger stored, or a choleric
 *                       temper (rage weight ≥ 60) with neurotic anxiety; a safer target present;
 *                       +1 when the true object is blocked (power ≥ 50), +1 for a choleric temper
 *   rationalization     an act against conscience in the last day
 *   reaction_formation  strictness ≥ 60 and a forbidden drive frustrated 3+ hours or a forbidden
 *                       wish toward one person 3+ times; +1 with such a person
 *   sublimation         a drive frustrated with a sublimation template that fits the hour
 */
import type { DefenseDef } from '@coulee/content/schema';
import type { ContentBundle, DefenseId } from '../content.ts';
import type { Explain } from '../explain.ts';
import type { ActorId } from '../ids.ts';
import type { Rng } from '../rng.ts';
import type { GameMinute } from '../time.ts';
import { largestPool, type Pool } from './anxiety.ts';
import type { ActorPsyche } from './state.ts';

export const TIER_RANK: Record<string, number> = { immature: 1, neurotic: 2, mature: 3 };

/** What the system found around the actor that defenses can use. */
export interface DefenseSituation {
  now: GameMinute;
  projection: { targetId: ActorId; trait: string; drive: string | null; pf: number; hidden: boolean } | null;
  displacement: { targetId: ActorId; blockedId: ActorId | null; df: number; choleric?: boolean } | null;
  /** Forbidden wish target for reaction formation (count ≥ 3), with its drive. */
  wish: { targetId: ActorId; drive: string; count: number } | null;
  /** A frustrated forbidden drive (streak ≥ 3) for untargeted reaction formation. */
  forbiddenStreak: string | null;
  /** A drive with a fitting sublimation template. */
  sublimation: { drive: string; templateId: string } | null;
  /** A displaceable drive is frustrated (streak ≥ 1) or anger is stored. */
  displaceable: boolean;
  /** A fear thought is live. */
  fearLive: boolean;
}

export interface DefenseCandidate {
  def: DefenseDef;
  id: DefenseId;
  poolFit: number;
  fit: number;
  style: number;
  weight: number;
  pool: Pool;
  why: string;
  /** Uses of the same defense in the last 48 h (10 §7.3 damping: ×70% each). */
  recentUses: number;
}

/** 10 §7.3: a defense used again within this window scores ×DAMP_PCT per use. */
export const DAMP_WINDOW_MIN = 48 * 60;
export const DAMP_PCT = 70;

const poolFitOf = (charge: number): number => (charge >= 300 ? 3 : charge >= 150 ? 2 : charge >= 50 ? 1 : 0);

/** The pool a defense answers that holds the most charge (ties in the def's own order). */
export function triggerPool(p: Pick<ActorPsyche, 'anxSrc'>, def: DefenseDef): Pool {
  let best = def.pools[0] as Pool;
  for (const k of def.pools) if (p.anxSrc[k] > p.anxSrc[best]) best = k;
  return best;
}

/** Ego needed for a defense: its min_ego; mature defenses drop 10 per Insight tier (10 §8.5). */
export function egoGate(def: DefenseDef, insight: number): number {
  return def.tier === 'mature' ? Math.max(0, def.min_ego - 10 * insight) : def.min_ego;
}

export function defenseCandidates(
  content: ContentBundle,
  p: Pick<ActorPsyche, 'anxSrc' | 'ego' | 'superego' | 'defenseStyle' | 'insight' | 'lastTransgression'> &
    Partial<Pick<ActorPsyche, 'recentDefenses'>>,
  sit: DefenseSituation,
): DefenseCandidate[] {
  const out: DefenseCandidate[] = [];
  for (const id of Object.keys(content.defenses ?? {}).sort() as DefenseId[]) {
    const def = content.defenses[id];
    if (!def) continue;
    if (p.ego < egoGate(def, p.insight)) continue;
    const pool = triggerPool(p, def);
    const poolFit = poolFitOf(p.anxSrc[pool]);
    if (poolFit === 0) continue;
    let bonus = 0;
    let why = `${pool} ${p.anxSrc[pool]}`;
    let ok = true;
    switch (id) {
      case 'repression':
        if (largestPool(p.anxSrc) === 'moral') {
          bonus = 1;
          why += '; guilt uppermost';
        }
        break;
      case 'denial':
        if (sit.fearLive) {
          bonus = 1;
          why += '; a fear won’t lie down';
        }
        break;
      case 'projection':
        if (!sit.projection) ok = false;
        else {
          why += `; disowned ${sit.projection.trait}, PF ${sit.projection.pf}`;
          if (sit.projection.drive !== null || sit.projection.hidden) bonus = 1;
        }
        break;
      case 'displacement':
        if (!sit.displaceable || !sit.displacement) ok = false;
        else {
          why += `; a safer target (DF ${sit.displacement.df})`;
          if (sit.displacement.blockedId !== null) {
            bonus += 1;
            why += '; the true object is out of reach';
          }
          if (sit.displacement.choleric) {
            bonus += 1;
            why += '; a choleric temper';
          }
        }
        break;
      case 'rationalization': {
        const tr = p.lastTransgression;
        if (!tr || sit.now - tr.at > 24 * 60) ok = false;
        else why += `; acted against ${tr.norm}`;
        break;
      }
      case 'reaction_formation':
        if (p.superego < 60 || (!sit.wish && sit.forbiddenStreak === null)) ok = false;
        else if (sit.wish) {
          bonus = 1;
          why += `; a forbidden ${sit.wish.drive} ×${sit.wish.count}`;
        } else why += `; forbidden ${sit.forbiddenStreak}`;
        break;
      case 'sublimation':
        if (!sit.sublimation) ok = false;
        else why += `; ${sit.sublimation.drive} could go into work`;
        break;
    }
    if (!ok) continue;
    const fit = Math.min(3, poolFit + bonus);
    const style = Math.max(0, p.defenseStyle[id] ?? 10);
    let weight = style * fit;
    // 10 §7.3: the same defense again within 48 h works less well (pushes toward the others,
    // projection and rationalization among them, the ones that write beliefs and reasons).
    let recentUses = 0;
    for (const r of p.recentDefenses ?? []) if (r.defense === id && sit.now - r.at < DAMP_WINDOW_MIN) recentUses++;
    for (let k = 0; k < recentUses; k++) weight = Math.floor((weight * DAMP_PCT) / 100);
    if (weight <= 0) continue;
    out.push({ def, id, poolFit, fit, style, weight, pool, why, recentUses });
  }
  return out;
}

export function pickDefense(cands: readonly DefenseCandidate[], rng: Rng): DefenseCandidate | undefined {
  return rng.weighted(cands, (c) => c.weight);
}

/** The Explain children for a defense pick: each candidate's style × fit. */
export function candidateExplains(actorId: ActorId, cands: readonly DefenseCandidate[], pickedId: string): Explain[] {
  return cands.map((c) => ({
    kind: 'formula',
    label: c.def.period_label,
    subjects: [actorId],
    knowledge: 'omniscient',
    terms: [
      { source: 'psyche', label: `Style ${c.style}`, value: c.style },
      { source: 'psyche', label: `× fit ${c.fit} (${c.why})`, value: c.style * c.fit - c.style },
      ...(c.recentUses > 0
        ? [
            {
              source: 'psyche',
              label: `Used ${c.recentUses}× in 48 h (×${DAMP_PCT}% each)`,
              value: c.weight - c.style * c.fit,
            },
          ]
        : []),
    ],
    total: c.weight,
    outcome: c.id === pickedId ? 'chosen' : 'rejected',
  }));
}

// ---------------------------------------------------------------------------------------------
// Target fit (10 §7.2)
// ---------------------------------------------------------------------------------------------

export interface ProjectionInputs {
  /** b's prior that c has τ: c presents τ 100; presents a trait that excludes τ 0; else 30. */
  H: number;
  /** Oddness: suspicion/strangeness 0..100 (belief.suspicionOf). */
  Odd: number;
  /** Outsiderness 0..100: another presented people 100; not kin, other household 30; kin 0. */
  Out: number;
  /** Dislike: 100 if Affection(b→c) < 0. */
  Dis: number;
  /** Weakness: 100 − power(b, c). */
  Weak: number;
}

/** PF = 30·H + 20·Odd + 20·Out + 15·Dis + 15·Weak, all /100 (0..100). */
export function projectionFit(x: ProjectionInputs): number {
  return Math.floor((30 * x.H + 20 * x.Odd + 20 * x.Out + 15 * x.Dis + 15 * x.Weak) / 100);
}

export interface DisplacementInputs {
  /** Resemblance to the blocked object: same household or occupation 100; none blocked 50; else 0. */
  Sim: number;
  Weak: number;
  /** Co-present now 100. */
  Avail: number;
  Dis: number;
}

/** DF = 30·Sim + 30·Weak + 20·Avail + 20·Dis, all /100 (0..100). */
export function displacementFit(x: DisplacementInputs): number {
  return Math.floor((30 * x.Sim + 30 * x.Weak + 20 * x.Avail + 20 * x.Dis) / 100);
}
