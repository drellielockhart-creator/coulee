/**
 * Defense fired (05 §9.2, 10 §7): a mind reaching for the same defense again and again. One
 * firing is a single-event entry; three inside a few weeks is a pattern, and a spread of
 * different defenses is a mind at the seams. Defenses are inner events, so the town never
 * sees them: this story belongs to the epilogue, and to the player for their own head.
 * OWNER: module:chronicle.
 */
import type { Fact } from '../facts.ts';
import type { PatternParams } from '../params.ts';
import type { ThreadFact } from '../state.ts';
import { numberWord } from '../text.ts';
import type { Accept, PatternDef } from './types.ts';
import { accept, DAY, ofKind, sortedByTime, spanWords, tfOf } from './util.ts';

function recent(facts: readonly ThreadFact[], p: PatternParams): ThreadFact[] {
  const fired = sortedByTime(ofKind(facts, 'def'));
  const last = fired[fired.length - 1];
  if (!last) return [];
  return fired.filter((f) => last.t - f.t <= p.n('window_days', 21) * DAY);
}

export const defenseFired: PatternDef = {
  id: 'defense_fired',
  topic: 'mind',
  importance: 40,
  suppressSingles: false,
  alwaysAll: false,

  accept(f: Fact): Accept[] {
    if (f.cls !== 'defense' || !f.agent) return [];
    return [accept(`a${f.agent}`, tfOf(f, 'def', { x: f.sub }), { actors: [f.agent] })];
  },

  level(facts, _th, _dc, p) {
    const r = recent(facts, p);
    const kinds = new Set(r.map((f) => f.x)).size;
    if (r.length < p.n('habit_firings', 3)) return 0;
    return r.length >= p.n('seams_firings', 6) || kinds >= p.n('seams_kinds', 3) ? 2 : 1;
  },

  cast(facts) {
    const f = facts[0];
    return f ? [f.a] : [];
  },

  bind(facts, _th, level, dc, p) {
    const r = recent(facts, p);
    const tally: Record<string, number> = {};
    for (const f of r) tally[f.x] = (tally[f.x] ?? 0) + 1;
    const top = Object.keys(tally).sort((a, b) => (tally[b] ?? 0) - (tally[a] ?? 0) || (a < b ? -1 : 1))[0] ?? '';
    const def = dc.content.defenses?.[top as never] as { name?: string; period_label?: string } | undefined;
    return {
      defense: top,
      defense_name: (def?.period_label ?? def?.name ?? top).toLowerCase(),
      defense_clinical: (def?.name ?? top).toLowerCase(),
      count: r.length,
      count_word: numberWord(r.length),
      span: r.length > 0 ? spanWords(r[0]?.t ?? 0, r[r.length - 1]?.t ?? 0) : 'a few days',
      level_word: level >= 2 ? 'seams' : 'habit',
    };
  },

  importanceAt(level, _th, p) {
    return level >= 2 ? p.importance + 18 : p.importance;
  },

  valence() {
    return -35;
  },

  stale(th, dc, p) {
    return (dc.ctx.now as number) - th.lastAt > p.n('quiet_days', 30) * DAY;
  },
};
