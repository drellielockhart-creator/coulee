/**
 * Encumbrance (03 §4.1): weight against a Strength-derived capacity, in legible bands. OWNER: module:provisions.
 * The bands are labels over continuous penalties; the numbers below are the plain-language consequences the
 * Kit Sheet shows (the UI formats, never computes).
 */
import type { ContentBundle } from '../content.ts';
import { type ExplainTerm, term } from '../explain.ts';
import type { ActorId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { carriedBy, type InventoryIndex, weightG } from './api.ts';

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
/** Above this percent of capacity a load cannot be moved at all (03 §4.1). */
export const MOVE_LIMIT_PCT = 150;

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
  {
    id: 'staggering',
    label: 'Staggering',
    upToPct: 1_000_000,
    speedPct: 30,
    fatigueTenths: 30,
    stealth: -10,
    climb: -10,
  },
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
export function loadReport(world: World, content: ContentBundle, actorId: ActorId, index?: InventoryIndex): LoadReport {
  const actor = world.actors[actorId];
  const str = actor?.sheet.abilities.str ?? 10;
  const size = content.peoples?.[actor?.ancestryId ?? '']?.size ?? 'medium';
  const cap = Math.floor(
    (capacityLb(str) * GRAMS_PER_LB * (size === 'small' ? 75 : size === 'large' ? 200 : 100)) / 100,
  );
  const w = world.items?.stacks ? weightG(world, content, carriedBy(actorId), index) : 0;
  const pct = cap > 0 ? Math.floor((w * 100) / cap) : 0;
  const baseBand = bandForPct(pct);
  const band = w * 100 > cap * MOVE_LIMIT_PCT ? { ...baseBand, speedPct: 0 } : baseBand;
  const lines: string[] = [
    `${band.label}: ${pct}% of the ${Math.round(cap / GRAMS_PER_LB)} lb Strength ${str} can manage.`,
  ];
  if (band.speedPct < 100) lines.push(`Overland speed ${band.speedPct}% of normal.`);
  if (band.fatigueTenths > 10)
    lines.push(`Tires ${Math.floor(band.fatigueTenths / 10)}.${band.fatigueTenths % 10} times as fast.`);
  if (band.stealth < 0) lines.push(`Stealth ${band.stealth}.`);
  if (band.climb < 0) lines.push(`Climbing and swimming ${band.climb}.`);
  if (band.speedPct === 0) lines.push('Cannot move until the load is reduced below 150% capacity.');
  else if (band.id === 'staggering') lines.push('Short hauls only.');
  return { weightG: w, capacityG: cap, loadPct: pct, band, lines };
}

/**
 * Grams the actor can still take on and be able to move (up to MOVE_LIMIT_PCT of capacity): what
 * a purchase, a refill or any other weight added to the pack must stay inside. Zero when already
 * at or over the limit.
 */
export function movableRoomG(world: World, content: ContentBundle, actorId: ActorId, index?: InventoryIndex): number {
  const report = loadReport(world, content, actorId, index);
  return Math.max(0, Math.floor((report.capacityG * MOVE_LIMIT_PCT) / 100) - report.weightG);
}

/** Shared modifiers for any simulated skill check involving this physical load. */
export function loadCheckTerms(world: World, content: ContentBundle, actorId: ActorId, skill: string): ExplainTerm[] {
  if (!['stealth', 'climb', 'swim'].includes(skill)) return [];
  const band = loadReport(world, content, actorId).band;
  const penalty = skill === 'stealth' ? band.stealth : skill === 'climb' || skill === 'swim' ? band.climb : 0;
  return penalty ? [term('load', `${band.label} load: ${skill}`, penalty)] : [];
}
/** Extra rest loss while awake and doing physical work; sleep and seated rest do not bear the pack. */
export function loadFatigue(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  decay: number,
  index?: InventoryIndex,
): { extra: number; terms: ExplainTerm[] } {
  const report = loadReport(world, content, actorId, index);
  const extra = Math.max(0, Math.round((decay * (report.band.fatigueTenths - 10)) / 10));
  return {
    extra,
    terms: extra
      ? [
          term('load', `${report.band.label} load fatigue tenths`, report.band.fatigueTenths),
          term('load', 'Load percent of capacity', report.loadPct),
        ]
      : [],
  };
}

/**
 * Activity asks for the load's extra transit time (null means movement is impossible). `baseMinutes`
 * is the unburdened walking time of the trip (an hour when unknown): a load at 80% speed adds a
 * quarter of it.
 */
export function movementDelay(
  _world: World,
  ctx: SimContext,
  actorId: ActorId,
  load: LoadReport,
  baseMinutes = 60,
): number | null {
  if (load.band.speedPct >= 100) return 0;
  const minutes =
    load.band.speedPct > 0 ? Math.ceil((baseMinutes * (100 - load.band.speedPct)) / load.band.speedPct) : 0;
  ctx.emit({
    kind: 'provisions.load_movement',
    data: { actorId, loadPct: load.loadPct, speedPct: load.band.speedPct, minutes, blocked: load.band.speedPct === 0 },
    roles: [{ actor: actorId, role: 'agent' }],
    visibility: 'private',
    explain: {
      kind: 'formula',
      label: 'Movement with carried load',
      subjects: [actorId],
      knowledge: 'self',
      terms: [
        term('load', 'Load percent of capacity', load.loadPct),
        term('load', 'Movement speed percent', load.band.speedPct),
        term('load', 'Movement limit percent', 150),
      ],
      total: minutes,
      outcome: load.band.speedPct === 0 ? 'blocked' : 'traveling',
    },
  });
  return load.band.speedPct === 0 ? null : minutes;
}
