/**
 * Reversal of fortune (05 §9.2): a household's ready money turns by more than half, up or
 * down, within a few weeks. Sampled weekly from the books (cash plus the members' purses);
 * the town knows a ruin or a windfall when it sees one, so the story is common knowledge, but
 * the figures themselves stay with the household. OWNER: module:chronicle.
 */
import { type HouseholdId, idsOf } from '../../ids.ts';
import type { Fact } from '../facts.ts';
import { familiesOf, familyOfHousehold } from '../names.ts';
import type { PatternParams } from '../params.ts';
import type { ThreadFact } from '../state.ts';
import { moneyText } from '../text.ts';
import type { Accept, DetectCtx, PatternDef } from './types.ts';
import { accept, DAY, sortedByTime } from './util.ts';

function wealth(dc: DetectCtx, hid: number): number | null {
  const h = dc.world.provisions?.households?.[hid as HouseholdId];
  if (!h) return null;
  let sum = h.cashCents;
  for (const m of dc.world.households[hid as HouseholdId]?.memberIds ?? []) {
    sum += dc.world.provisions.purses?.[m] ?? 0;
  }
  return sum;
}

/**
 * The turn in a run of weekly samples: 0 none, 1 windfall, 2 ruin. Wages land on pay day and
 * bills go out in lumps, so a single sample proves nothing: the last two samples must both be
 * well clear of both of the first two in the window.
 */
function turnOf(
  facts: readonly ThreadFact[],
  windowSamples: number,
  minDelta: number,
): { dir: 0 | 1 | 2; from: number; to: number } {
  const samples = sortedByTime(facts.filter((f) => f.k === 'wealth')).slice(-windowSamples);
  if (samples.length < 4) return { dir: 0, from: 0, to: 0 };
  const before = samples.slice(0, 2).map((f) => f.w);
  const after = samples.slice(-2).map((f) => f.w);
  // Sustained: both of the last two weeks must clear the bar against both of the first two.
  if (Math.min(...after) - Math.max(...before) >= minDelta && Math.min(...after) * 2 >= Math.max(...before) * 3) {
    return { dir: 1, from: Math.max(...before), to: Math.min(...after) };
  }
  if (Math.min(...before) - Math.max(...after) >= minDelta && Math.max(...after) * 2 <= Math.min(...before)) {
    return { dir: 2, from: Math.min(...before), to: Math.max(...after) };
  }
  return { dir: 0, from: before[0] ?? 0, to: after[after.length - 1] ?? 0 };
}

function turn(facts: readonly ThreadFact[], p: PatternParams) {
  return turnOf(facts, p.n('window_samples', 6), p.n('min_delta_cents', 1500));
}

export const reversal: PatternDef = {
  id: 'reversal',
  topic: 'fortune',
  importance: 52,
  balladLevel: 2,
  suppressSingles: false,
  publicFrom: 1,
  publicActors(th) {
    return th.actorIds.slice(0, 2);
  },

  accept(_f: Fact): Accept[] {
    return [];
  },

  daily(dc: DetectCtx, p: PatternParams): Accept[] {
    const now = dc.ctx.now as number;
    const day = Math.floor(now / DAY);
    if (day % p.n('sample_every_days', 7) !== 0) return [];
    const out: Accept[] = [];
    for (const hid of idsOf<HouseholdId>(dc.world.households)) {
      const w = wealth(dc, hid);
      if (w === null) continue;
      const members = (dc.world.households[hid]?.memberIds ?? []).map((m) => m as number);
      const sample: ThreadFact = {
        e: -(day * 1000 + hid),
        t: now,
        a: dc.world.households[hid]?.headId ?? 0,
        b: 0,
        pub: 0,
        by: members,
        k: 'wealth',
        w,
        s: 1,
        p: 0,
        x: '',
      };
      const prior = dc.world.chronicle.threads.find((t) => t.pattern === 'reversal' && t.key === `h${hid}`);
      const dir = turn([...(prior?.facts ?? []), sample], p).dir;
      out.push(
        accept(`h${hid}`, sample, {
          actors: members.slice(0, 4),
          households: [hid],
          tags: { household: String(hid), dir: String(dir) },
        }),
      );
    }
    return out;
  },

  level(facts, _th, _dc, p) {
    return turn(facts, p).dir === 0 ? 0 : 1;
  },

  bind(facts, th, _level, dc, p, view) {
    const hid = Number(th.tags.household ?? 0);
    th.data.toldAt = th.lastAt;
    const out: Record<string, string | number | boolean> = {
      family: familyOfHousehold(dc.world, hid),
      families: familiesOf(dc.world, hid),
      outcome: 'ruin',
    };
    if (view === 'pub') {
      // The town sees the turn, not the ledger.
      out.outcome = th.tags.dir === '1' ? 'rise' : 'ruin';
      return out;
    }
    const t = turn(facts, p);
    out.outcome = t.dir === 1 ? 'rise' : 'ruin';
    out.amount = moneyText(Math.abs(t.to - t.from));
    out.balance = moneyText(t.to);
    return out;
  },

  repeat(th) {
    return { key: `reversal.${th.tags.dir === '1' ? 'rise' : 'ruin'}`, days: 7 };
  },

  importanceAt(_level, _th, p) {
    return p.importance;
  },

  valence(th) {
    return turnOf(th.facts, 6, 1500).dir === 2 ? -55 : 55;
  },

  stale(th, dc, p) {
    // Keep sampling; once a turn is told, wait before a new one can be told.
    const toldAt = th.data.toldAt;
    return toldAt !== undefined && (dc.ctx.now as number) - toldAt >= p.n('retell_days', 56) * DAY;
  },
};
