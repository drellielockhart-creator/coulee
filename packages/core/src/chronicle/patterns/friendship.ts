/**
 * Friendship and Unlikely friendship (05 §9.2): a pair who came to be friends, and the rarer
 * story of a pair who were at odds first (an enemy or rival label, or harm traded) and ended
 * warm. Order matters: friendship that precedes the quarrel is a falling-out, not this.
 * OWNER: module:chronicle.
 */
import type { Fact } from '../facts.ts';
import type { PatternParams } from '../params.ts';
import { numberWord } from '../text.ts';
import type { Accept, DetectCtx, PatternDef } from './types.ts';
import { accept, DAY, householdOfActor, ofKind, pairKey, sortedByTime, spanWords, tfOf } from './util.ts';

function hostileBefore(facts: readonly import('../state.ts').ThreadFact[], t: number, p: PatternParams) {
  const earlier = facts.filter((f) => f.t < t || (f.t === t && false));
  const cold = earlier.filter((f) => f.k === 'cold').length;
  const harms = earlier.filter((f) => f.k === 'harm').length;
  return { cold, harms, hostile: cold > 0 || harms >= p.n('harm_min', 2) };
}

export const friendship: PatternDef = {
  id: 'friendship',
  topic: 'friendship',
  importance: 45,
  balladLevel: 2,
  suppressSingles: true,

  accept(f: Fact, dc: DetectCtx, _p: PatternParams): Accept[] {
    if (!f.agent || !f.target) return [];
    // Kin under one roof are not "friends" in the Chronicle's sense.
    const hh = householdOfActor(dc, f.agent);
    if (hh > 0 && hh === householdOfActor(dc, f.target)) return [];
    const key = pairKey(f.agent, f.target);
    const base = { actors: [f.agent, f.target] };
    if (f.cls === 'label') {
      const from = ((f.ev.data as unknown as { from?: string }).from ?? '').toLowerCase();
      if (f.sub === 'friend')
        return [accept(key, tfOf(f, 'warm', { w: from === 'enemy' || from === 'rival' ? 1 : 0 }), base)];
      if (f.sub === 'enemy' || f.sub === 'rival') return [accept(key, tfOf(f, 'cold'), base)];
      return [];
    }
    if (f.success === false) return [];
    if (f.cls === 'harm') return [accept(key, tfOf(f, 'harm'), base)];
    if (f.cls === 'help') return [accept(key, tfOf(f, 'help'), base)];
    if (f.cls === 'amends') return [accept(key, tfOf(f, 'amends'), base)];
    return [];
  },

  level(facts, _th, _dc, p) {
    const warm = sortedByTime(ofKind(facts, 'warm'))[0];
    if (!warm) return 0;
    const h = hostileBefore(facts, warm.t, p);
    return warm.w === 1 || h.hostile ? 2 : 1;
  },

  cast(facts) {
    const warm = sortedByTime(ofKind(facts, 'warm'))[0];
    return warm ? [warm.a, warm.b] : [];
  },

  bind(facts, _th, level, _dc, p) {
    const warm = sortedByTime(ofKind(facts, 'warm'))[0];
    const h = warm ? hostileBefore(facts, warm.t, p) : { cold: 0, harms: 0, hostile: false };
    const firstBad = sortedByTime(facts.filter((f) => f.k === 'harm' || f.k === 'cold'))[0];
    const amends = ofKind(facts, 'amends').length > 0;
    const helps = ofKind(facts, 'help').length;
    return {
      across: level >= 2,
      count: h.harms,
      count_word: numberWord(h.harms),
      span: warm && firstBad ? spanWords(firstBad.t, warm.t) : 'a while',
      label: amends ? 'amends' : helps > 0 ? 'help' : 'time',
      kind: amends ? 'amends' : helps > 0 ? 'help' : 'time',
    };
  },

  importanceAt(level, _th, p) {
    return level >= 2 ? p.importance + 10 : p.importance - 20;
  },

  valence() {
    return 60;
  },

  stale(th, dc, p) {
    return (dc.ctx.now as number) - th.lastAt > p.n('quiet_days', 30) * DAY;
  },
};
