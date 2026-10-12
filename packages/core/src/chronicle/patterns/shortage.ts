/**
 * The thin spring / the long winter (05 §9.2, P8): a household's stores run short, the
 * ration is cut, the gap drags on, and then it is over (or it is not). Keyed by household.
 * The partial match is the first short count; the story is how long it lasted and what it
 * cost (the board, the spoilage, scurvy); the ending is "they held". The town knows a
 * neighbor is pinched once it has gone on for a while. OWNER: module:chronicle.
 */
import type { ActorId, HouseholdId } from '../../ids.ts';
import { yearsBetween } from '../../time.ts';
import type { Fact } from '../facts.ts';
import { conditionName, familiesOf, familyOfHousehold, itemName } from '../names.ts';
import type { ThreadFact } from '../state.ts';
import { daysText, joinList, numberWord } from '../text.ts';
import type { Accept, DetectCtx, PatternDef } from './types.ts';
import { accept, DAY, daysBetween, ofKind, sortedByTime, spanWords, tfOf } from './util.ts';

interface Run {
  shorts: ThreadFact[];
  spanDays: number;
  lowestTenths: number;
  lowestRation: number;
  conditions: string[];
}

function run(facts: readonly ThreadFact[]): Run {
  const shorts = sortedByTime(ofKind(facts, 'short'));
  const first = shorts[0];
  const last = shorts[shorts.length - 1];
  return {
    shorts,
    spanDays: first && last ? daysBetween(first.t, last.t) : 0,
    lowestTenths: shorts.length > 0 ? Math.min(...shorts.map((s) => s.w)) : 0,
    lowestRation: shorts.length > 0 ? Math.min(...shorts.map((s) => Number(s.x) || 100)) : 100,
    conditions: [...new Set(ofKind(facts, 'cond').map((c) => c.x))].sort(),
  };
}

export const shortage: PatternDef = {
  id: 'shortage',
  topic: 'food',
  importance: 50,
  balladLevel: 4,
  suppressSingles: true,
  closingLevel: 2,
  publicFrom: 2,
  publicActors(th) {
    return th.actorIds.slice(0, 1);
  },

  accept(f: Fact, dc: DetectCtx): Accept[] {
    if (f.cls === 'shortage') {
      const hid = f.households[0] ?? 0;
      if (!hid) return [];
      const ration = (f.ev.data as unknown as { rationPct?: number }).rationPct ?? 100;
      return [
        accept(`h${hid}`, tfOf(f, 'short', { x: String(ration) }), {
          actors: f.actors,
          households: [hid],
          tags: { household: String(hid) },
        }),
      ];
    }
    if (f.cls === 'nutrition' && f.agent && f.success) {
      const hid = dc.world.actors[f.agent as ActorId]?.householdId ?? 0;
      if (!hid) return [];
      return [
        accept(`h${hid}`, tfOf(f, 'cond', { x: f.sub }), {
          actors: [f.agent],
          households: [hid],
          tags: { household: String(hid) },
        }),
      ];
    }
    return [];
  },

  level(facts, _th, _dc, p) {
    const r = run(facts);
    if (r.shorts.length === 0) return 0;
    if (r.spanDays >= p.n('long_days', 20)) return 4;
    if (r.spanDays >= p.n('gap_days', 12) || r.lowestTenths < p.n('dire_tenths', 10) || r.conditions.length > 0)
      return 3;
    if (r.shorts.length >= p.n('rationing_notices', 3) || r.lowestRation <= p.n('rationing_pct', 60)) return 2;
    return 1;
  },

  cast(facts) {
    const who = facts.find((f) => f.k === 'cond')?.a ?? facts.find((f) => f.a > 0)?.a ?? 0;
    return who ? [who] : [];
  },

  bind(facts, th, level, dc, _p, view) {
    const hid = Number(th.tags.household ?? 0);
    const r = run(facts);
    const out: Record<string, string | number | boolean> = {
      family: familyOfHousehold(dc.world, hid),
      families: familiesOf(dc.world, hid),
      household: familyOfHousehold(dc.world, hid),
      level_word: level >= 4 ? 'long' : level === 3 ? 'hard' : level === 2 ? 'close' : 'short',
      // Only a house with children in it can say the children no longer ask.
      children: (dc.world.households[hid as HouseholdId]?.memberIds ?? []).some((m) => {
        const a = dc.world.actors[m];
        return a?.alive === true && yearsBetween(a.born, dc.ctx.now) < 13;
      }),
      detail: r.shorts.length > 0,
      // How long the thread has run is the story's own length, which the town can see.
      span: spanWords(th.openedAt, th.lastAt),
      days: Math.max(1, daysBetween(th.openedAt, th.lastAt)),
    };
    const others = dc.world.chronicle.threads.filter(
      (t) =>
        t.pattern === 'shortage' &&
        t.id !== th.id &&
        t.facts.some((f) => f.k === 'short' && (dc.ctx.now as number) - f.t < 10 * DAY),
    ).length;
    out.count = others;
    out.count_word = numberWord(others);
    if (r.shorts.length > 0) {
      out.ration_pct = r.lowestRation;
      out.lowest_days = daysText(r.lowestTenths);
    }
    if (r.conditions.length > 0) {
      out.gravity = 'sick';
      out.condition_name = joinList(r.conditions.map((c) => conditionName(c)));
    }
    // The household's own books are private: only the people in it (and the epilogue) read them.
    const tally = view === 'pub' ? undefined : dc.world.chronicle.tallies.households[hid];
    out.board = 'what came to hand';
    out.lost = 'nothing worth the naming';
    out.cold_meals = 0;
    if (tally) {
      const foods = Object.entries(tally.foods)
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .slice(0, 3)
        .map(([d]) => itemName(dc.content, d));
      if (foods.length > 0) out.board = joinList(foods);
      const lost = Object.entries(tally.lost)
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .slice(0, 2)
        .map(([d]) => itemName(dc.content, d));
      if (lost.length > 0) out.lost = joinList(lost);
      out.cold_meals = tally.coldMeals;
    }
    return out;
  },

  repeat(th, level, _p, dc) {
    // When a good part of the town is pinched it is one story, told once a week.
    const others = dc.world.chronicle.threads.filter(
      (t) =>
        t.pattern === 'shortage' &&
        t.id !== th.id &&
        t.facts.some((f) => f.k === 'short' && (dc.ctx.now as number) - f.t < 10 * DAY),
    ).length;
    return others >= 2 ? { key: `shortage.town.${level >= 3 ? 'hard' : 'close'}`, days: 7 } : null;
  },

  importanceAt(level, _th, p) {
    return level >= 4
      ? p.importance + 22
      : level === 3
        ? p.importance + 12
        : level === 2
          ? p.importance
          : p.importance - 12;
  },

  valence(th) {
    return th.facts.some((f) => f.k === 'cond') ? -65 : -45;
  },

  stale(th, dc, p) {
    const shorts = ofKind(th.facts, 'short');
    const last = shorts[shorts.length - 1];
    return (dc.ctx.now as number) - (last?.t ?? th.lastAt) > p.n('over_days', 8) * DAY;
  },
};
