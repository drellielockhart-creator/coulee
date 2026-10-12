/**
 * Kindness (05 §9.2, P6): help freely given, above all to someone who is going without. A
 * lone favor between friends is ordinary; a hand held out to a pinched household, or a
 * neighbor who keeps helping, is what a town remembers. Keyed by the one who helps.
 * OWNER: module:chronicle.
 */
import type { Fact } from '../facts.ts';
import type { PatternParams } from '../params.ts';
import type { ThreadFact } from '../state.ts';
import { numberWord } from '../text.ts';
import type { Accept, DetectCtx, PatternDef } from './types.ts';
import { accept, DAY, distinct, householdOfActor, ofKind, sortedByTime, spanWords, tfOf } from './util.ts';

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

  accept(f: Fact, dc: DetectCtx, _p: PatternParams): Accept[] {
    const meal = f.ev.kind === 'provisions.meal' ? f.ev.data : null;
    const food = meal !== null && meal.kcal > 0 && meal.assistedBy !== undefined;
    const agent = food ? (meal.assistedBy ?? 0) : f.agent;
    const target = food ? meal.actorId : f.target;
    if ((!food && f.cls !== 'help') || !agent || !target || f.success === false) return [];
    if (householdOfActor(dc, agent) > 0 && householdOfActor(dc, agent) === householdOfActor(dc, target)) return [];
    return [
      accept(`k${agent}`, { ...tfOf(f, food ? 'aid' : 'help'), a: agent, b: target }, { actors: [agent, target] }),
    ];
  },

  level(facts, _th, dc, p, view) {
    const told = dc.world.chronicle.recent[`kindness|${view}`];
    const lastAt = sortedByTime(facts).at(-1)?.t ?? 0;
    if (told !== undefined && lastAt - told < p.n('repeat_days', 7) * DAY) return 0;
    const r = recent(facts, p);
    const aid = ofKind(r, 'aid');
    const recipients = distinct(r.map((f) => f.b)).length;
    if (aid.length >= p.n('aid_known', 3)) return 3;
    if (r.length >= p.n('help_known', 4) && recipients >= p.n('help_recipients', 3)) return 2;
    if (aid.length >= 1) return 1;
    return 0;
  },

  cast(facts) {
    const aid = ofKind(facts, 'aid');
    const a = sortedByTime(aid.length ? aid : facts).pop();
    return a ? [a.a, a.b] : [];
  },

  bind(facts, _th, level, dc, p) {
    const r = recent(facts, p);
    const last = sortedByTime(facts).pop();
    const id = last?.x ?? '';
    const first = sortedByTime(r)[0];
    return {
      // "Again" only when this neighbor has been kind to this same person before, lately.
      again: r.filter((f) => f.b === last?.b).length > 1,
      span: first && last ? spanWords(first.t, last.t) : 'a few days',
      count: r.length,
      count_word: numberWord(r.length),
      needy: ofKind(r, 'aid').length > 0,
      interaction_name: dc.content.interactions?.[id]?.name?.toLowerCase() ?? id.replace(/_/g, ' '),
      level_word: level >= 3 ? 'known' : level === 2 ? 'steady' : 'timely',
    };
  },

  repeat(_th, _level, p) {
    return { key: 'kindness', days: p.n('repeat_days', 7) };
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
