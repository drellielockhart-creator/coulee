/**
 * Anxiety economics (10 §6). OWNER: module:psyche. Pure integer functions.
 *
 * anxiety (0..1000) = real + neur + moral at all times. Accrual comes from frustrated
 * thoughts at each arbitration (capped +200 an hour); discharge is an hourly fixed-point
 * decay whose rate depends on what the actor is doing; defenses take relief from the
 * triggering pool first.
 */
import type { ExplainTerm } from '../explain.ts';
import type { ActorPsyche, AnxietyPools, Thought } from './state.ts';

export const ANXIETY_MAX = 1000;
/** Accrual cap per arbitration (shocks bypass it via addAnxiety). */
export const ACCRUAL_CAP = 200;
/** Thoughts quieter than this book no anxiety (10 §6 `I ≥ 15`, ×10). */
export const ACCRUAL_MIN_I = 150;

export const POOLS = ['real', 'neur', 'moral'] as const;
export type Pool = (typeof POOLS)[number];

export const BAND_LABELS = ['Easy', 'Uneasy', 'Nervous', 'Harrowed', 'Breaking'] as const;

/** 0 Easy, 1 Uneasy, 2 Nervous, 3 Harrowed, 4 Breaking (10 §6). */
export function anxietyBand(anxiety: number): number {
  return Math.max(0, Math.min(4, Math.floor(anxiety / 200)));
}

/** 10 §5.3 egoMod table. */
export function egoMod(ego: number): number {
  if (ego < 20) return -2;
  if (ego < 40) return -1;
  if (ego < 60) return 0;
  if (ego < 80) return 1;
  return 2;
}

/** Composure = egoMod − band (10 §5.3). */
export function composure(p: Pick<ActorPsyche, 'ego' | 'anxiety'>): number {
  return egoMod(p.ego) - anxietyBand(p.anxiety);
}

/** Defense threshold Θ = 250 + 3E (10 §6). */
export function defenseThreshold(ego: number): number {
  return 250 + 3 * ego;
}

/** Keep `anxiety` equal to the pool sum, every pool ≥ 0, the sum ≤ 1000. */
export function normalizePools(p: Pick<ActorPsyche, 'anxiety' | 'anxSrc'>): void {
  const s = p.anxSrc;
  s.real = Math.max(0, Math.round(s.real));
  s.neur = Math.max(0, Math.round(s.neur));
  s.moral = Math.max(0, Math.round(s.moral));
  let total = s.real + s.neur + s.moral;
  while (total > ANXIETY_MAX) {
    const over = total - ANXIETY_MAX;
    const k = largestPool(s);
    const take = Math.min(over, s[k]);
    s[k] -= take;
    total -= take;
  }
  p.anxiety = total;
}

/** Largest pool; ties resolve real, neur, moral (total order). */
export function largestPool(s: AnxietyPools): Pool {
  let best: Pool = 'real';
  for (const k of POOLS) if (s[k] > s[best]) best = k;
  return best;
}

/** Add to pools (non-negative amounts), clamped so the total stays ≤ 1000. */
export function addToPools(p: Pick<ActorPsyche, 'anxiety' | 'anxSrc'>, add: Partial<AnxietyPools>): number {
  const before = p.anxiety;
  let room = ANXIETY_MAX - p.anxiety;
  for (const k of POOLS) {
    const a = Math.max(0, Math.round(add[k] ?? 0));
    const take = Math.min(room, a);
    p.anxSrc[k] += take;
    room -= take;
  }
  normalizePools(p);
  return p.anxiety - before;
}

/**
 * Remove `amount` from the pools: from `first` (if given) up to its charge, then pro rata
 * over the rest, with the rounding remainder taken from the largest. Returns the amount removed.
 */
export function drainPools(p: Pick<ActorPsyche, 'anxiety' | 'anxSrc'>, amount: number, first?: Pool): number {
  let left = Math.max(0, Math.min(Math.round(amount), p.anxiety));
  const removed = left;
  if (first !== undefined) {
    const t = Math.min(left, p.anxSrc[first]);
    p.anxSrc[first] -= t;
    left -= t;
  }
  if (left > 0) {
    const total = p.anxSrc.real + p.anxSrc.neur + p.anxSrc.moral;
    if (total > 0) {
      let taken = 0;
      for (const k of POOLS) {
        const t = Math.floor((left * p.anxSrc[k]) / total);
        p.anxSrc[k] -= t;
        taken += t;
      }
      let rest = left - taken;
      while (rest > 0) {
        const k = largestPool(p.anxSrc);
        if (p.anxSrc[k] <= 0) break;
        const t = Math.min(rest, p.anxSrc[k]);
        p.anxSrc[k] -= t;
        rest -= t;
      }
    }
  }
  normalizePools(p);
  return removed;
}

export interface Frustration {
  thought: Thought;
  /** Satisfaction 0..100 granted by a compromise (0 for a plain loss). */
  f: number;
}

export interface Accrual {
  add: AnxietyPools;
  terms: ExplainTerm[];
}

/**
 * Anxiety booked by one arbitration (10 §6):
 *   Id thought:        neur  += I/10 × (100 − f)% × (100 − E)%
 *   Superego thought:  moral += I/10 × (100 − f)% × S%
 *   fear thought:      real  += I/10 × (100 − E)%   (whatever was chosen: the threat persists)
 * A thought that already lost last hour counts 25% (habituation). Total capped at +200.
 * `fear` is the set of drives whose frustration is realistic anxiety (DriveDef.anxiety_pool).
 */
export function accrueAnxiety(
  p: Pick<ActorPsyche, 'ego' | 'superego'>,
  frustrated: readonly Frustration[],
  realDrives: ReadonlySet<string>,
  liveFear: readonly Thought[],
): Accrual {
  const add: AnxietyPools = { real: 0, neur: 0, moral: 0 };
  const terms: ExplainTerm[] = [];
  const E = p.ego;
  const S = p.superego;
  const habit = (t: Thought) => ((t.frustrated ?? 0) >= 1 ? 25 : 100);
  for (const { thought: t, f } of frustrated) {
    if (t.voice === 'command' || t.intensity < ACCRUAL_MIN_I) continue;
    if (t.voice === 'id' && t.drive !== undefined && realDrives.has(t.drive)) continue; // booked below
    const ff = Math.max(0, Math.min(100, f));
    if (t.voice === 'id') {
      const v = Math.floor((t.intensity * (100 - ff) * (100 - E) * habit(t)) / 10_000_000);
      if (v > 0) {
        add.neur += v;
        terms.push({ source: 'psyche', label: `${t.label} unheeded`, value: v });
      }
    } else {
      const v = Math.floor((t.intensity * (100 - ff) * S * habit(t)) / 10_000_000);
      if (v > 0) {
        add.moral += v;
        terms.push({ source: 'psyche', label: `${t.label} defied`, value: v });
      }
    }
  }
  for (const t of liveFear) {
    if (t.intensity < ACCRUAL_MIN_I) continue;
    const v = Math.floor((t.intensity * (100 - E) * habit(t)) / 100_000);
    if (v > 0) {
      add.real += v;
      terms.push({ source: 'psyche', label: `${t.label} (the threat remains)`, value: v });
    }
  }
  const total = add.real + add.neur + add.moral;
  if (total > ACCRUAL_CAP) {
    const scale = (x: number) => Math.floor((x * ACCRUAL_CAP) / total);
    const capped = { real: scale(add.real), neur: scale(add.neur), moral: scale(add.moral) };
    terms.push({
      source: 'psyche',
      label: 'An hour can hold only so much',
      value: capped.real + capped.neur + capped.moral - total,
    });
    return { add: capped, terms };
  }
  return { add, terms };
}

/** Hourly discharge (10 §6): floor(anxiety × r / 1000) + floor(E / 10). */
export function dischargeAmount(anxiety: number, ego: number, ratePermille: number): number {
  if (anxiety <= 0) return 0;
  return Math.min(anxiety, Math.floor((anxiety * ratePermille) / 1000) + Math.floor(ego / 10));
}
