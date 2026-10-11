/**
 * Small value helpers shared by the social files (kept apart from state.ts to avoid an
 * import cycle with init.ts). OWNER: module:social.
 */
import type { ActorId } from '../ids.ts';
import type { Opinion, OpinionDims } from './state.ts';

export const ZERO_DIMS: OpinionDims = { affection: 0, respect: 0, trust: 0, fear: 0 };

export const DIM_KEYS = ['affection', 'respect', 'trust', 'fear'] as const;
export type DimKey = (typeof DIM_KEYS)[number];

export function emptyOpinion(targetId: ActorId): Opinion {
  return {
    targetId,
    base: { ...ZERO_DIMS },
    reasons: [],
    volatile: { ...ZERO_DIMS },
    obligation: { favors: 0, cents: 0 },
    familiarity: 0,
    cooldowns: {},
    label: '',
  };
}

export const clampInt = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const floorDiv = (a: number, b: number): number => Math.floor(a / b);
export const ceilDiv = (a: number, b: number): number => Math.ceil(a / b);

export function clampDims(d: OpinionDims): OpinionDims {
  return {
    affection: clampInt(d.affection, -100, 100),
    respect: clampInt(d.respect, -100, 100),
    trust: clampInt(d.trust, -100, 100),
    fear: clampInt(d.fear, 0, 100),
  };
}

export function addDims(a: OpinionDims, b: OpinionDims): OpinionDims {
  return {
    affection: a.affection + b.affection,
    respect: a.respect + b.respect,
    trust: a.trust + b.trust,
    fear: a.fear + b.fear,
  };
}

/** floorDiv(delta × strength, 1000) per dimension (04 §6.2). */
export function weightDims(d: OpinionDims, strength: number): OpinionDims {
  return {
    affection: floorDiv(d.affection * strength, 1000),
    respect: floorDiv(d.respect * strength, 1000),
    trust: floorDiv(d.trust * strength, 1000),
    fear: floorDiv(d.fear * strength, 1000),
  };
}

export function scaleDimsPct(d: OpinionDims, pct: number): OpinionDims {
  // Truncate toward zero so small shares do not flip sign.
  const s = (v: number) => Math.trunc((v * pct) / 100) + 0;
  return { affection: s(d.affection), respect: s(d.respect), trust: s(d.trust), fear: s(d.fear) };
}

export const isZeroDims = (d: OpinionDims): boolean =>
  d.affection === 0 && d.respect === 0 && d.trust === 0 && d.fear === 0;

/** Sum of absolute values: how much a reason moves an opinion. */
export const dimsMagnitude = (d: OpinionDims): number =>
  Math.abs(d.affection) + Math.abs(d.respect) + Math.abs(d.trust) + Math.abs(d.fear);

/** "$1.50" without locale APIs. */
export function formatCents(cents: number): string {
  const c = Math.abs(Math.round(cents));
  const dollars = Math.floor(c / 100);
  const rest = c % 100;
  return `$${dollars}.${rest < 10 ? `0${rest}` : rest}`;
}
