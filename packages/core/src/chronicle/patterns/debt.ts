/**
 * Debt repaid / unpaid (05 §9.2): a loan, the dunning, and how it ended. A debt thread is
 * keyed creditor>debtor. The partial match is the loan itself; pressing for it, or letting it
 * lapse past its due day, is the story; paying it up is the ending. OWNER: module:chronicle.
 */
import type { ActorId } from '../../ids.ts';
import type { Fact } from '../facts.ts';
import type { PatternParams } from '../params.ts';
import type { ThreadFact } from '../state.ts';
import { daysText, moneyText } from '../text.ts';
import type { Accept, DetectCtx, PatternDef } from './types.ts';
import { accept, DAY, daysBetween, householdOfActor, ofKind, sortedByTime, tfOf } from './util.ts';

function obligationCents(dc: DetectCtx, creditor: number, debtor: number): number {
  const o = dc.world.social?.opinions?.[creditor as ActorId]?.[debtor as ActorId];
  return Math.max(0, o?.obligation?.cents ?? 0);
}

/** 1 owed, 2 pressed, 3 unpaid, 4 repaid. */
function stage(facts: readonly ThreadFact[], p: PatternParams): number {
  if (facts.some((f) => f.k === 'repay')) return 4;
  const duns = ofKind(facts, 'dun').length;
  if (facts.some((f) => f.k === 'overdue') || duns >= p.n('unpaid_duns', 2)) return 3;
  if (duns >= 1) return 2;
  return facts.some((f) => f.k === 'debt') ? 1 : 0;
}

export const debt: PatternDef = {
  id: 'debt',
  topic: 'debt',
  importance: 40,
  balladLevel: 99,
  suppressSingles: true,

  accept(f: Fact, dc: DetectCtx, p: PatternParams): Accept[] {
    if (!f.agent || !f.target) return [];
    // Money between members of one household is housekeeping, not a debt.
    const hh = householdOfActor(dc, f.agent);
    if (hh > 0 && hh === householdOfActor(dc, f.target)) return [];
    const borrow = p.l('borrow_ids', ['borrow']);
    if (f.cls === 'debt' && f.success !== false) {
      const creditor = borrow.includes(f.sub) ? f.target : f.agent;
      const debtor = creditor === f.agent ? f.target : f.agent;
      return [
        accept(
          `${creditor}>${debtor}`,
          tfOf(f, 'debt', { a: creditor, b: debtor, w: obligationCents(dc, creditor, debtor) }),
          {
            actors: [creditor, debtor],
          },
        ),
      ];
    }
    if (f.cls === 'dun') {
      return [
        accept(`${f.agent}>${f.target}`, tfOf(f, 'dun', { w: obligationCents(dc, f.agent, f.target) }), {
          actors: [f.agent, f.target],
        }),
      ];
    }
    if (f.cls === 'repay' && f.success !== false) {
      return [
        accept(`${f.target}>${f.agent}`, tfOf(f, 'repay', { a: f.target, b: f.agent }), {
          actors: [f.target, f.agent],
        }),
      ];
    }
    return [];
  },

  daily(dc: DetectCtx, p: PatternParams): Accept[] {
    const out: Accept[] = [];
    const now = dc.ctx.now as number;
    for (const th of dc.world.chronicle.threads) {
      if (th.pattern !== 'debt') continue;
      if (th.facts.some((f) => f.k === 'repay' || f.k === 'overdue')) continue;
      const first = sortedByTime(th.facts.filter((f) => f.k === 'debt' || f.k === 'dun'))[0];
      if (!first || now - first.t < p.n('overdue_days', 30) * DAY) continue;
      out.push(
        accept(
          th.key,
          {
            e: -(th.id * 4 + 1),
            t: now,
            a: first.a,
            b: first.b,
            pub: first.pub,
            by: [...first.by],
            k: 'overdue',
            w: first.w,
            s: 1,
            p: first.p,
            x: '',
          },
          { actors: [first.a, first.b] },
        ),
      );
    }
    return out;
  },

  level(facts, _th, _dc, p) {
    return stage(facts, p);
  },

  cast(facts) {
    const f = sortedByTime(facts)[0];
    return f ? [f.a, f.b] : [];
  },

  bind(facts, _th, _level, _dc, p) {
    const s = stage(facts, p);
    const cents = Math.max(0, ...facts.map((f) => (f.k === 'overdue' ? 0 : f.w)));
    const first = sortedByTime(facts)[0];
    const last = sortedByTime(facts).pop();
    const days = first && last ? Math.max(1, daysBetween(first.t, last.t)) : 1;
    return {
      outcome: s === 4 ? 'repaid' : s === 3 ? 'unpaid' : s === 2 ? 'pressed' : 'owed',
      sum: cents > 0,
      amount: cents > 0 ? moneyText(cents) : '',
      days,
      days_word: daysText(days * 10),
    };
  },

  importanceAt(level, th, p) {
    // A loan squared within the fortnight, never pressed, is a ledger entry, not news.
    const facts = sortedByTime(th.facts);
    const first = facts[0];
    const last = facts[facts.length - 1];
    const pressed = facts.some((f) => f.k === 'dun' || f.k === 'overdue');
    const long = first && last ? last.t - first.t >= p.n('news_after_days', 14) * DAY : false;
    if (level >= 4 && !pressed && !long) return p.importance - 25;
    return level >= 4
      ? p.importance + 5
      : level === 3
        ? p.importance + 10
        : level === 2
          ? p.importance
          : p.importance - 25;
  },

  valence(th) {
    return th.facts.some((f) => f.k === 'repay') ? 25 : -30;
  },

  stale(th, dc, p) {
    const done = th.facts.some((f) => f.k === 'repay');
    return (dc.ctx.now as number) - th.lastAt > (done ? 7 : p.n('quiet_days', 75)) * DAY;
  },
};
