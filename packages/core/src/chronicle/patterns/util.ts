/**
 * Helpers shared by the pattern detectors. OWNER: module:chronicle.
 */
import type { ActorId, HouseholdId } from '../../ids.ts';
import type { Fact } from '../facts.ts';
import { familiesOf, familyOfActor, familyOfHousehold } from '../names.ts';
import type { ThreadFact } from '../state.ts';
import { numberWord } from '../text.ts';
import type { Accept, DetectCtx } from './types.ts';

export const DAY = 1440;

/** A ThreadFact from a Fact: the small, JSON-able memory a thread keeps. */
export function tfOf(f: Fact, k: string, over: Partial<ThreadFact> = {}): ThreadFact {
  return {
    e: f.id,
    t: f.t,
    a: f.agent,
    b: f.target,
    pub: f.pub ? 1 : 0,
    by: f.pub ? [] : [...f.by],
    k,
    w: f.weight,
    s: f.success ? 1 : 0,
    p: f.place,
    x: f.sub,
    ...over,
  };
}

export function accept(key: string, tf: ThreadFact, extra: Partial<Accept> = {}): Accept {
  return { key, tf, ...extra };
}

export function lo(a: number, b: number): number {
  return a < b ? a : b;
}
export function hi(a: number, b: number): number {
  return a > b ? a : b;
}

/** "3-7": an unordered pair key. */
export function pairKey(a: number, b: number): string {
  return `${lo(a, b)}-${hi(a, b)}`;
}

export function householdOfActor(dc: DetectCtx, actor: number): number {
  return actor ? (dc.world.actors[actor as ActorId]?.householdId ?? 0) : 0;
}

export function count(facts: readonly ThreadFact[], k: string): number {
  let n = 0;
  for (const f of facts) if (f.k === k) n += 1;
  return n;
}

export function ofKind(facts: readonly ThreadFact[], k: string): ThreadFact[] {
  return facts.filter((f) => f.k === k);
}

export function sortedByTime(facts: readonly ThreadFact[]): ThreadFact[] {
  return [...facts].sort((a, b) => a.t - b.t || a.e - b.e);
}

export function distinct(xs: readonly number[]): number[] {
  return [...new Set(xs)];
}

/** Whole days between two game minutes. */
export function daysBetween(t0: number, t1: number): number {
  return Math.floor((t1 - t0) / DAY);
}

/** "three weeks", "four days": a span in plain words. */
export function spanWords(t0: number, t1: number): string {
  const d = Math.max(1, daysBetween(t0, t1));
  if (d >= 14) {
    const w = Math.round(d / 7);
    return `${numberWord(w)} weeks`;
  }
  return d === 1 ? 'a day' : `${numberWord(d)} days`;
}

/** Family-name bindings for one or two sides (households when known, else the person's family). */
export function sideNames(dc: DetectCtx, side: number, isHousehold: boolean): { family: string; families: string } {
  if (isHousehold) {
    return {
      family: familyOfHousehold(dc.world, side as HouseholdId),
      families: familiesOf(dc.world, side as HouseholdId),
    };
  }
  const f = familyOfActor(dc.world, side);
  return { family: f, families: `the ${f}${/s$/i.test(f) ? '' : 's'}` };
}
