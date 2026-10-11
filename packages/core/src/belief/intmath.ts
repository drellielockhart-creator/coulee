/**
 * Integer tables and fixed-point helpers for belief (04 §5.3, §8.3, §13.5; C49).
 * OWNER: module:belief.
 *
 * No exp/log/pow in core: the logit and sigmoid are committed tables generated offline with
 *   LOGIT_Q8[c]    = round(256 · ln(c / (100 − c))),           c = 1..99   (index 0 unused)
 *   SIG_PERMILLE[i] = round(1000 / (1 + e^(−x))), x = (i − 32)/4,  i = 0..64  (x = −8..8)
 * `intmath.test.ts` re-derives both with Math.log/Math.exp (tests are exempt from the bans)
 * and checks every entry.
 */

/** Q8 log-odds of each whole credence point. LOGIT_Q8[50] = 0; symmetric. */
export const LOGIT_Q8: readonly number[] = [
  0, -1176, -996, -890, -814, -754, -704, -662, -625, -592, -562, -535, -510, -487, -465, -444, -425, -406, -388, -371,
  -355, -339, -324, -309, -295, -281, -268, -255, -242, -229, -217, -205, -193, -181, -170, -158, -147, -136, -125,
  -115, -104, -93, -83, -72, -62, -51, -41, -31, -20, -10, 0, 10, 20, 31, 41, 51, 62, 72, 83, 93, 104, 115, 125, 136,
  147, 158, 170, 181, 193, 205, 217, 229, 242, 255, 268, 281, 295, 309, 324, 339, 355, 371, 388, 406, 425, 444, 465,
  487, 510, 535, 562, 592, 625, 662, 704, 754, 814, 890, 996, 1176,
];

/** σ(x) per mille at x = −8, −7.75, ..., 8 (65 entries, step 64 in Q8). */
export const SIG_PERMILLE: readonly number[] = [
  0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 4, 5, 7, 9, 11, 14, 18, 23, 29, 37, 47, 60, 76, 95, 119, 148, 182, 223, 269, 321, 378,
  438, 500, 562, 622, 679, 731, 777, 818, 852, 881, 905, 924, 940, 953, 963, 971, 977, 982, 986, 989, 991, 993, 995,
  996, 997, 998, 998, 998, 999, 999, 999, 999, 1000, 1000,
];

export const Q8 = 256;

export const floorDiv = (a: number, b: number): number => Math.floor(a / b);
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
/** Q8 × Q8 -> Q8, floored. */
export const mulQ8 = (a: number, b: number): number => floorDiv(a * b, Q8);
/** Scale by an integer percent, floored. */
export const pctOf = (v: number, pct: number): number => floorDiv(v * pct, 100);

/** Q8 logit of a credence (clamped into 1..99). */
export function logitQ8(credence: number): number {
  return LOGIT_Q8[clamp(Math.round(credence), 1, 99)] as number;
}

/**
 * Nearest credence point for a Q8 logit (binary search; ties -> lower). Result is 1..99:
 * 0 and 100 are certainty states the logit path never produces (04 §5.3).
 */
export function credenceFromLogit(l: number): number {
  const lo0 = LOGIT_Q8[1] as number;
  const hi0 = LOGIT_Q8[99] as number;
  const x = clamp(l, lo0, hi0);
  let lo = 1;
  let hi = 99;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((LOGIT_Q8[mid] as number) <= x) lo = mid;
    else hi = mid;
  }
  const dl = x - (LOGIT_Q8[lo] as number);
  const dh = (LOGIT_Q8[hi] as number) - x;
  return dh < dl ? hi : lo;
}

/**
 * One log-odds step (04 §5.3 integer form): L = LOGIT[c] + carry + Δ; c' = nearest; the
 * residual carry keeps sub-point evidence so weak echoes still accumulate.
 */
export function logitStep(credence: number, carry: number, deltaQ8: number): { credence: number; carry: number } {
  const l = logitQ8(credence) + carry + deltaQ8;
  const c = credenceFromLogit(l);
  const lc = clamp(l, LOGIT_Q8[1] as number, LOGIT_Q8[99] as number);
  return { credence: c, carry: clamp(lc - (LOGIT_Q8[c] as number), -127, 127) };
}

/** σ(x) per mille for x in Q8, linearly interpolated (error < 0.2‰ vs. the true curve's table). */
export function sigmoidPermille(xQ8: number): number {
  const x = clamp(xQ8, -2048, 2048);
  const off = x + 2048;
  const i = floorDiv(off, 64);
  const f = off - i * 64;
  const a = SIG_PERMILLE[i] as number;
  const b = SIG_PERMILLE[Math.min(64, i + 1)] as number;
  return a + floorDiv((b - a) * f, 64);
}

/** Exponential-ish decay by an integer time constant, on an integer with a milli residue. */
export function decayStep(
  value: number,
  residue: number,
  tauDays: number,
  floorValue = 0,
): { value: number; residue: number } {
  if (tauDays <= 0) return { value, residue };
  let q = value * 1000 + residue;
  const floorQ = floorValue * 1000;
  if (q <= floorQ) return { value, residue };
  q -= Math.max(1, floorDiv(q - floorQ, tauDays));
  if (q < floorQ) q = floorQ;
  return { value: floorDiv(q, 1000), residue: q % 1000 };
}

/** −3..+3 value view helper. */
export const view3 = (v: number | undefined): number => clamp(Math.round(v ?? 0), -3, 3);
