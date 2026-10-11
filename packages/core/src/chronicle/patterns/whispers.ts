/**
 * Rumor spreading through town (05 §9.2, 04 §8): a claim passed from mouth to mouth until
 * the place is talking of nothing else. Keyed by proposition. The count of people who have
 * taken it in is the measure; a town need not have overheard every whisper to know it is
 * whispered, so from the second level the story is common knowledge (the claim and who it is
 * about, never who said what to whom). Supernatural claims are the faekin-suspicion
 * pattern's business. OWNER: module:chronicle.
 */
import type { ActorId } from '../../ids.ts';
import { areKin } from '../../social/api.ts';
import type { Fact } from '../facts.ts';
import type { PatternParams } from '../params.ts';
import type { ThreadFact } from '../state.ts';
import { numberWord, tallWord } from '../text.ts';
import type { Accept, DetectCtx, PatternDef } from './types.ts';
import { accept, DAY, distinct, ofKind, sortedByTime, spanWords, tfOf } from './util.ts';

export function isSupernatural(dc: DetectCtx, pred: string): boolean {
  const def = dc.content.predicates?.[pred];
  return !!def && (def.supernatural === true || def.kind_of !== undefined);
}

/**
 * Everyone known to hold the claim: those told (and took it in), and those who came to believe
 * it. `insider` excludes people who cannot count as the town's opinion: the subject, and those
 * who share the subject's roof or blood (they keep the secret; they are not its rumor).
 */
export function holdersOf(facts: readonly ThreadFact[], toldOnly = false, insider?: (id: number) => boolean): number[] {
  const out: number[] = [];
  for (const f of facts) {
    if (f.k === 'told' && f.s === 1) out.push(f.b);
    else if (f.k === 'held' && !toldOnly) out.push(f.a);
  }
  return distinct(out.filter((x) => x > 0 && !(insider?.(x) ?? false)));
}

/** The subject and everyone under the subject's roof or of the subject's blood. */
export function insiderOf(dc: DetectCtx, subject: number): (id: number) => boolean {
  const s = dc.world.actors[subject as ActorId];
  return (id: number) => {
    if (id === subject) return true;
    const a = dc.world.actors[id as ActorId];
    if (!s || !a) return false;
    return a.householdId === s.householdId || areKin(dc.world, id as ActorId, subject as ActorId);
  };
}

function levelFor(n: number, p: PatternParams): number {
  if (n >= p.n('town_holders', 10)) return 3;
  if (n >= p.n('about_holders', 6)) return 2;
  if (n >= p.n('talk_holders', 3)) return 1;
  return 0;
}

export const whispers: PatternDef = {
  id: 'whispers',
  topic: 'rumor',
  importance: 38,
  balladLevel: 3,
  suppressSingles: true,
  closingLevel: 2,
  publicFrom: 2,
  publicActors(th) {
    const s = Number(th.tags.subject ?? 0);
    return s > 0 ? [s] : [];
  },

  accept(f: Fact, dc: DetectCtx): Accept[] {
    if ((f.cls !== 'transmit' && f.cls !== 'belief') || !f.prop) return [];
    if (isSupernatural(dc, f.sub)) return [];
    const tags = { prop: String(f.prop), subject: String(f.subject), rumor: String(f.bind.rumor ?? '') };
    if (f.cls === 'transmit') {
      return [
        accept(`p${f.prop}`, tfOf(f, f.success ? 'told' : 'refused'), { actors: [f.agent, f.target, f.subject], tags }),
      ];
    }
    return [accept(`p${f.prop}`, tfOf(f, 'held'), { actors: [f.agent, f.subject], tags })];
  },

  level(facts, th, dc, p: PatternParams) {
    return levelFor(holdersOf(facts, false, insiderOf(dc, Number(th.tags.subject ?? 0))).length, p);
  },

  townLevel(facts, th, dc, p: PatternParams) {
    return levelFor(holdersOf(facts, true, insiderOf(dc, Number(th.tags.subject ?? 0))).length, p);
  },

  cast(_facts, th) {
    const s = Number(th.tags.subject ?? 0);
    return s > 0 ? [s] : [];
  },

  bind(facts, th, _level, dc) {
    const out: Record<string, string | number | boolean> = {
      rumor: th.tags.rumor ?? '',
      named: Number(th.tags.subject ?? 0) > 0,
    };
    if (facts.length === 0) return out; // common knowledge, no private tellings to count
    const n = holdersOf(facts, false, insiderOf(dc, Number(th.tags.subject ?? 0))).length;
    const told = sortedByTime(ofKind(facts, 'told'));
    const first = told[0];
    const last = told[told.length - 1];
    out.holders = n;
    out.count = n;
    out.count_word = numberWord(n);
    out.count_tall = tallWord(n);
    out.span = first && last ? spanWords(first.t, last.t) : 'some days';
    return out;
  },

  importanceAt(level, _th, p) {
    return level >= 3 ? p.importance + 24 : level === 2 ? p.importance + 12 : p.importance - 4;
  },

  valence() {
    return -25;
  },

  stale(th, dc, p) {
    return (dc.ctx.now as number) - th.lastAt > p.n('quiet_days', 21) * DAY;
  },
};
