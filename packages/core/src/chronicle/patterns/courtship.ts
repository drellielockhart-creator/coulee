/**
 * Courtship (05 §9.2, S2/S5): two people walking out, keeping company, betrothed or turned
 * down. Love across a feud's lines is the better story. A single flirtation is not one.
 * OWNER: module:chronicle.
 */
import type { Fact } from '../facts.ts';
import { familiesOf, familyOfActor, familyOfHousehold } from '../names.ts';
import type { PatternParams } from '../params.ts';
import type { ThreadFact } from '../state.ts';
import { numberWord } from '../text.ts';
import type { Accept, DetectCtx, PatternDef } from './types.ts';
import { accept, DAY, householdOfActor, ofKind, pairKey, sortedByTime, spanWords, tfOf } from './util.ts';

function acts(facts: readonly ThreadFact[]): number {
  return ofKind(facts, 'flirt').length + ofKind(facts, 'court').length;
}

/** 0 none, 1 walking out, 2 keeping company, 3 betrothed, 4 refused. */
function stageOf(facts: readonly ThreadFact[], p: PatternParams): number {
  const ordered = sortedByTime(facts);
  const lastBig = [...ordered].reverse().find((f) => f.k === 'propose' || f.k === 'refused');
  if (lastBig) return lastBig.k === 'propose' ? 3 : 4;
  const n = acts(facts);
  if (n >= p.n('company_acts', 4) || ofKind(facts, 'court').length >= 2) return 2;
  if (n >= p.n('walking_acts', 2)) return 1;
  return 0;
}

function acrossLines(dc: DetectCtx, a: number, b: number): boolean {
  if (!a || !b) return false;
  const ha = householdOfActor(dc, a);
  const hb = householdOfActor(dc, b);
  if (!ha || !hb || ha === hb) return false;
  const key = `h${pairKey(ha, hb)}`;
  return dc.world.chronicle.threads.some(
    (t) => t.pattern === 'feud' && t.key === key && t.facts.filter((f) => f.k === 'harm').length >= 2,
  );
}

export const courtship: PatternDef = {
  id: 'courtship',
  topic: 'courtship',
  importance: 45,
  balladLevel: 3,
  suppressSingles: true,

  accept(f: Fact, dc: DetectCtx): Accept[] {
    if (f.cls !== 'courtship' || !f.agent || !f.target) return [];
    const key = pairKey(f.agent, f.target);
    const base = { actors: [f.agent, f.target], tags: { across: acrossLines(dc, f.agent, f.target) ? '1' : '0' } };
    if (f.sub === 'propose') {
      return [accept(key, tfOf(f, f.success === false ? 'refused' : 'propose'), base)];
    }
    if (f.success === false) return [];
    return [accept(key, tfOf(f, f.sub === 'court' ? 'court' : 'flirt'), base)];
  },

  level(facts, _th, _dc, p) {
    const s = stageOf(facts, p);
    return s === 4 ? 3 : s;
  },

  cast(facts) {
    const f = sortedByTime(facts)[0];
    return f ? [f.a, f.b] : [];
  },

  bind(facts, th, _level, dc, p) {
    const s = stageOf(facts, p);
    const first = sortedByTime(facts)[0];
    const last = sortedByTime(facts).pop();
    const across = th.tags.across === '1';
    const ha = householdOfActor(dc, first?.a ?? 0);
    const hb = householdOfActor(dc, first?.b ?? 0);
    const nameA = ha ? familiesOf(dc.world, ha) : `the ${familyOfActor(dc.world, first?.a ?? 0)}s`;
    const nameB = hb ? familiesOf(dc.world, hb) : `the ${familyOfActor(dc.world, first?.b ?? 0)}s`;
    return {
      families: `${nameA} and ${nameB}`,
      family: ha ? familyOfHousehold(dc.world, ha) : familyOfActor(dc.world, first?.a ?? 0),
      family_b: hb ? familyOfHousehold(dc.world, hb) : familyOfActor(dc.world, first?.b ?? 0),
      stage: s === 4 ? 'refused' : s === 3 ? 'betrothed' : s === 2 ? 'company' : 'walking',
      across,
      count: acts(facts),
      count_word: numberWord(acts(facts)),
      span: first && last ? spanWords(first.t, last.t) : 'some days',
    };
  },

  importanceAt(level, th, p) {
    const bump = th.tags.across === '1' ? 15 : 0;
    return (level >= 3 ? p.importance + 25 : level === 2 ? p.importance + 5 : p.importance - 15) + bump;
  },

  valence(th) {
    return th.facts.some((f) => f.k === 'refused') ? -20 : 45;
  },

  stale(th, dc, p) {
    return (dc.ctx.now as number) - th.lastAt > p.n('quiet_days', 45) * DAY;
  },
};
