/**
 * Encumbrance (03 §4.1): weight against a Strength-derived capacity, in legible bands. OWNER: module:provisions.
 * The bands are labels over continuous penalties; the numbers below are the plain-language consequences the
 * Kit Sheet shows (the UI formats, never computes).
 */
import type { ContentBundle } from '../content.ts';
import type { ActorId } from '../ids.ts';
import type { World } from '../world.ts';
import { carriedBy, weightG } from './api.ts';

/** Capacity in pounds at a few anchor Strength scores; linear in between, steeper above 20. */
const CAPACITY_LB: ReadonlyArray<readonly [number, number]> = [
  [1, 25],
  [4, 50],
  [8, 80],
  [10, 100],
  [12, 130],
  [14, 170],
  [16, 220],
  [18, 290],
  [20, 380],
  [24, 600],
  [30, 1000],
];

/** Maximum comfortable carrying capacity in pounds for a Strength score (100 lb at an average 10). */
export function capacityLb(str: number): number {
  const s = Math.max(1, Math.min(30, Math.round(str)));
  for (let i = 0; i < CAPACITY_LB.length - 1; i++) {
    const a = CAPACITY_LB[i] as readonly [number, number];
    const b = CAPACITY_LB[i + 1] as readonly [number, number];
    if (s >= a[0] && s <= b[0]) return a[1] + Math.floor(((s - a[0]) * (b[1] - a[1])) / (b[0] - a[0]));
  }
  return 100;
}

const GRAMS_PER_LB = 454;

export interface LoadBand {
  id: 'unburdened' | 'light' | 'medium' | 'heavy' | 'staggering';
  label: string;
  /** Load / capacity upper bound, percent. */
  upToPct: number;
  /** Overland speed, percent of normal. */
  speedPct: number;
  /** Fatigue rate in tenths (10 = x1.0). */
  fatigueTenths: number;
  stealth: number;
  /** Climb and swim modifier. */
  climb: number;
}

export const LOAD_BANDS: readonly LoadBand[] = [
  { id: 'unburdened', label: 'Unburdened', upToPct: 25, speedPct: 100, fatigueTenths: 10, stealth: 0, climb: 0 },
  { id: 'light', label: 'Light', upToPct: 40, speedPct: 95, fatigueTenths: 11, stealth: -1, climb: -1 },
  { id: 'medium', label: 'Medium', upToPct: 66, speedPct: 80, fatigueTenths: 14, stealth: -2, climb: -3 },
  { id: 'heavy', label: 'Heavy', upToPct: 100, speedPct: 60, fatigueTenths: 20, stealth: -5, climb: -6 },
  { id: 'staggering', label: 'Staggering', upToPct: 1_000_000, speedPct: 30, fatigueTenths: 30, stealth: -10, climb: -10 },
];

export function bandForPct(pct: number): LoadBand {
  for (const b of LOAD_BANDS) if (pct <= b.upToPct) return b;
  return LOAD_BANDS[LOAD_BANDS.length - 1] as LoadBand;
}

export interface LoadReport {
  weightG: number;
  capacityG: number;
  /** Load as a percent of capacity (integer). */
  loadPct: number;
  band: LoadBand;
  /** Plain-language consequences, each with its numbers. */
  lines: string[];
}

/** Everything the Kit Sheet's consequence lines say about the actor's current load (03 §2.3). */
export function loadReport(world: World, content: ContentBundle, actorId: ActorId): LoadReport {
  const actor = world.actors[actorId];
  const str = actor?.sheet.abilities.str ?? 10;
  const cap = capacityLb(str) * GRAMS_PER_LB;
  const w = weightG(world, content, carriedBy(actorId));
  const pct = cap > 0 ? Math.floor((w * 100) / cap) : 0;
  const band = bandForPct(pct);
  const lines: string[] = [`${band.label}: ${pct}% of the ${Math.round(cap / GRAMS_PER_LB)} lb Strength ${str} can manage.`];
  if (band.speedPct < 100) lines.push(`Overland speed ${band.speedPct}% of normal.`);
  if (band.fatigueTenths > 10) lines.push(`Tires ${Math.floor(band.fatigueTenths / 10)}.${band.fatigueTenths % 10} times as fast.`);
  if (band.stealth < 0) lines.push(`Stealth ${band.stealth}.`);
  if (band.climb < 0) lines.push(`Climbing and swimming ${band.climb}.`);
  if (band.id === 'staggering') lines.push('Short hauls only.');
  return { weightG: w, capacityG: cap, loadPct: pct, band, lines };
}
