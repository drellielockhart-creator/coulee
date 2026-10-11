/**
 * Kindness (05 §9.2, P6): help freely given, above all to someone who is going without. A
 * lone favor between friends is ordinary; a hand held out to a pinched household, or a
 * neighbor who keeps helping, is what a town remembers. Keyed by the one who helps.
 * OWNER: module:chronicle.
 */
import type { ActorId } from '../../ids.ts';
import type { Fact } from '../facts.ts';
import type { PatternParams } from '../params.ts';
import type { ThreadFact } from '../state.ts';
import { numberWord } from '../text.ts';
import type { Accept, DetectCtx, PatternDef } from './types.ts';
import { accept, DAY, distinct, householdOfActor, ofKind, sortedByTime, spanWords, tfOf } from './util.ts';

/** Is the target's household in the middle of a shortage (told or not)? */
function pinched(dc: DetectCtx, target: number, now: number, p: PatternParams): boolean {
  const hid = dc.world.actors[target as ActorId]?.householdId ?? 0;
  if (!hid) return false;
  const windowMin = p.n('need_window_days', 14) * DAY;
  return dc.world.chronicle.threads.some(
    (t) =>
      t.pattern === 'shortage' &&
      t.key === `h${hid}` &&
      now - t.lastAt <= windowMin &&
      t.facts.some((f) => f.k === 'short'),
  );
}

function recent(facts: readonly ThreadFact[], p: PatternParams): ThreadFact[] {
  const all = sortedByTime(facts);
  const last = all[all.length - 1];
  if (!last) return [];
  return all.filter((f) => last.t - f.t <= p.n('window_days', 21) * DAY);
}

export const kindness: PatternDef = {
  id: 'kindness',
  topic: 'kindness',
  importance: 45,
  suppressSingles: true,
  closingLevel: 2,

  accept(f: Fact, dc: DetectCtx, p: PatternParams): Accept[] {
    if (f.cls !== 'help' || !f.agent || !f.target || f.success === false) return [];
    // Looking after your own is not a story; the neighbor's kindness is.
    if (householdOfActor(dc, f.agent) > 0 && householdOfActor(dc, f.agent) === householdOfActor(dc, f.target))
      return [];
    const needy = pinched(dc, f.target, f.t, p);
    return [accept(`k${f.agent}`, tfOf(f, needy ? 'aid' : 'help'), { actors: [f.agent, f.target] })];
  },

  level(facts, _th, _dc, p) {
    const r = recent(facts, p);
    const aid = ofKind(r, 'aid');
    const recipients = distinct(r.map((f) => f.b)).length;
    if (aid.length >= p.n('aid_known', 3)) return 3;
    if (r.length >= p.n('help_known', 4) && recipients >= p.n('help_recipients', 3)) return 2;
    if (aid.length >= 1) return 1;
    return 0;
  },

  cast(facts) {
    const a = sortedByTime(facts).pop();
    return a ? [a.a, a.b] : [];
  },

  bind(facts, _th, level, dc, p) {
    const r = recent(facts, p);
    const last = sortedByTime(facts).pop();
    const id = last?.x ?? '';
    const first = sortedByTime(r)[0];
    return {
      span: first && last ? spanWords(first.t, last.t) : 'a few days',
      count: r.length,
      count_word: numberWord(r.length),
      needy: ofKind(r, 'aid').length > 0,
      interaction_name: dc.content.interactions?.[id]?.name?.toLowerCase() ?? id.replace(/_/g, ' '),
      level_word: level >= 3 ? 'known' : level === 2 ? 'steady' : 'timely',
    };
  },

  importanceAt(level, _th, p) {
    return level >= 3 ? p.importance + 15 : level === 2 ? p.importance + 3 : p.importance - 5;
  },

  valence() {
    return 65;
  },

  stale(th, dc, p) {
    return (dc.ctx.now as number) - th.lastAt > p.n('quiet_days', 30) * DAY;
  },
};
