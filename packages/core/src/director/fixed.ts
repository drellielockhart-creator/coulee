/** Offline table: round(65536 * (1 - exp(-60 / tauMinutes))).
 * The proposed general decayQ16 table is not present in this checkout. These are its
 * two required hourly samples (6h and 7d), kept as literals; no runtime transcendental math.
 * Retaining Q16 state avoids the slow EMA's ~168-point integer dead band.
 */
export const EMA_ALPHA_Q16 = { fast: 10061, slow: 389 } as const;
export function emaQ16(previous: number, sample: number, alpha: number): number {
  return previous + Math.floor(((sample * 65536 - previous) * alpha) / 65536);
}
