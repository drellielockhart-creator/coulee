/**
 * Notability (05 §9): what the Chronicle bothers to tell. A story's score is its face
 * importance plus the notoriety of the people in it, minus the fatigue of a crowded week and
 * a penalty for telling the same thing twice. Also the tallies (P8 accounting) that the
 * weekly digests read. OWNER: module:chronicle.
 */
import type { ExplainTerm } from '../explain.ts';
import { weekNumber } from './bindings.ts';
import type { Fact } from './facts.ts';
import type { DetectCtx } from './patterns/types.ts';
import { type ChronicleState, emptyTally, type Tally } from './state.ts';

const DAY = 1440;

export interface Score {
  total: number;
  terms: ExplainTerm[];
}

export interface ScoreInput {
  /** The story's face importance, 0..100. */
  base: number;
  /** Everyone in it (notoriety is taken from the most-talked-of). */
  actors: readonly number[];
  /** Repeat-suppression key (null = none). */
  repeatKey: string | null;
  /** Window for the repeat key, days (default: the notability record's `repeat_days`). */
  repeatDays?: number;
  t: number;
  /** Whether the player character is in the story. */
  pcIn: boolean;
  /** The omniscient epilogue weighs fame less: its subject is what nobody knew. */
  epilogue?: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Highest notoriety among `actors`, 0..100. */
export function notorietyOf(st: ChronicleState, actors: readonly number[]): number {
  let n = 0;
  for (const a of actors) n = Math.max(n, st.notoriety[a] ?? 0);
  return n;
}

export function scoreStory(dc: DetectCtx, i: ScoreInput): Score {
  const st = dc.world.chronicle;
  const p = dc.params('notability', 0);
  const terms: ExplainTerm[] = [{ source: 'base', label: 'What happened', value: Math.round(i.base) }];
  const nCap = p.n('notoriety_cap', 25);
  const nDiv = Math.max(1, p.n('notoriety_div', 4));
  const noto = Math.min(i.epilogue ? Math.floor(nCap / 2) : nCap, Math.floor(notorietyOf(st, i.actors) / nDiv));
  if (noto > 0) terms.push({ source: 'other', label: 'Names the county is talking of', value: noto });
  if (i.pcIn) terms.push({ source: 'other', label: 'You were there', value: p.n('pc_bonus', 15) });

  const week = weekNumber(i.t);
  const load = st.weekLoad.week === week ? st.weekLoad.entries : 0;
  const free = p.n('fatigue_free', 14);
  if (load > free) {
    terms.push({
      source: 'other',
      label: 'A crowded week',
      value: -Math.min(p.n('fatigue_cap', 30), (load - free) * p.n('fatigue_step', 2)),
    });
  }

  const sum = terms.reduce((s, x) => s + x.value, 0);
  if (i.repeatKey !== null && sum < p.n('repeat_exempt', 70)) {
    const last = st.recent[i.repeatKey];
    if (last !== undefined && i.t - last < (i.repeatDays ?? p.n('repeat_days', 10)) * DAY) {
      terms.push({ source: 'other', label: 'Told already', value: -p.n('repeat_penalty', 35) });
    }
  }
  return {
    total: clamp(
      terms.reduce((s, x) => s + x.value, 0),
      0,
      100,
    ),
    terms,
  };
}

/** Remember that a story was told, for repeat suppression. */
export function noteTold(st: ChronicleState, key: string, t: number): void {
  st.recent[key] = t;
}

/** Daily upkeep: notoriety fades; stale repeat keys are forgotten. */
export function fadeNotoriety(st: ChronicleState, now: number, keepDays: number): void {
  for (const k of Object.keys(st.notoriety)) {
    const a = Number(k);
    const n = st.notoriety[a] ?? 0;
    const next = n - Math.max(1, Math.floor((n * 3) / 100));
    if (next <= 0) delete st.notoriety[a];
    else st.notoriety[a] = next;
  }
  for (const k of Object.keys(st.recent)) {
    if (now - (st.recent[k] ?? 0) > keepDays * DAY) delete st.recent[k];
  }
}

// ---- tallies (P8) -----------------------------------------------------------------------

function bump(rec: Record<string, number>, key: string, by: number): void {
  rec[key] = (rec[key] ?? 0) + by;
}

function apply(t: Tally, f: Fact, dc: DetectCtx): void {
  const d = f.ev.data as unknown as Record<string, unknown>;
  switch (f.cls) {
    case 'meal': {
      t.meals += 1;
      if (f.sub === 'cold') t.coldMeals += 1;
      t.kcal += f.weight;
      const items = (d.items as Array<{ defId: string; qty: number }> | undefined) ?? [];
      for (const it of items) {
        t.servings += it.qty;
        bump(t.foods, it.defId, it.qty);
        const fresh = dc.content.items?.[it.defId]?.food?.fresh ?? 0;
        t.freshPoints += fresh * it.qty;
      }
      break;
    }
    case 'purchase': {
      const qty = Math.max(1, (d.qty as number | undefined) ?? 1);
      bump(t.bought, f.sub, qty);
      t.spentCents += f.weight;
      if (f.success) t.creditCents += f.weight;
      break;
    }
    case 'spoiled': {
      bump(t.lost, f.sub, f.weight);
      bump(t.lostWhy, (d.into as string | null | undefined) ?? 'spoiled', 1);
      break;
    }
    case 'consumed':
      bump(t.consumed, f.sub, f.weight);
      break;
    case 'shortage': {
      t.shortages += 1;
      t.lowestDaysTenths = t.lowestDaysTenths < 0 ? f.weight : Math.min(t.lowestDaysTenths, f.weight);
      t.lowestRationPct = Math.min(t.lowestRationPct, (d.rationPct as number | undefined) ?? 100);
      break;
    }
    case 'nutrition':
      if (f.success) bump(t.nutrition, f.sub, 1);
      break;
    case 'defense':
      t.defenses += 1;
      break;
    case 'gathering':
      bump(t.acts, 'gatherings', 1);
      bump(t.acts, `gather:${f.place}`, f.weight);
      bump(t.acts, `gatherN:${f.place}`, 1);
      break;
    case 'observance':
      bump(t.acts, `obs:${f.sub}`, 1);
      break;
    case 'harm':
    case 'help':
    case 'courtship':
    case 'gossip':
    case 'dun':
    case 'repay':
    case 'debt':
    case 'amends':
      bump(t.acts, f.cls, 1);
      break;
    default:
      break;
  }
}

/** Record one fact in this week's, this year's and the run's accounts. */
export function tallyFact(dc: DetectCtx, f: Fact): void {
  const tl = dc.world.chronicle.tallies;
  const tallies: Tally[] = [tl.week, tl.year, tl.total];
  const hh = f.households[0] ?? 0;
  if (hh > 0) {
    let h = tl.households[hh];
    if (!h) {
      h = emptyTally();
      tl.households[hh] = h;
    }
    tallies.push(h);
  }
  if (f.pub && tl.pubWeek) tallies.push(tl.pubWeek);
  for (const t of tallies) apply(t, f, dc);

  if (f.cls === 'purchase') {
    const qty = Math.max(1, ((f.ev.data as unknown as { qty?: number }).qty ?? 1) as number);
    const mills = Math.round((f.weight * 10) / qty);
    const pt = tl.prices[f.sub] ?? { sum: 0, n: 0, last: 0 };
    pt.sum += mills;
    pt.n += 1;
    tl.prices[f.sub] = pt;
  }
}
