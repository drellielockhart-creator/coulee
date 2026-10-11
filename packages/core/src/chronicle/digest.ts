/**
 * Digests (05 §11.2): the Almanac's weekly summary and annual reckoning, the household
 * ledger (P8: the account book of a family's food and stores), and the epilogue's view
 * behind the doors. Built from the tallies the sifting pass keeps. OWNER: module:chronicle.
 */
import type { ActorId, HouseholdId } from '../ids.ts';
import { weekNumber } from './bindings.ts';
import { newDraft, writeEntry } from './entries.ts';
import { itemName, itemUnit, placeName } from './names.ts';
import type { DetectCtx } from './patterns/types.ts';
import type { Bindings } from './prose.ts';
import { emptyTally, type Tally } from './state.ts';
import { joinList, moneyText, numberWord, pctOf } from './text.ts';
import { weekWeatherText } from './weather.ts';

const DAY = 1440;

function topFoods(dc: DetectCtx, rec: Record<string, number>, n: number): string[] {
  return Object.entries(rec)
    .filter(([, q]) => q > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([d]) => itemName(dc.content, d));
}

/** "salt pork at 9¢ the pound": the week's average posted prices, best-sampled first. */
function priceLine(dc: DetectCtx): string {
  const prices = dc.world.chronicle.tallies.prices;
  const keys = Object.keys(prices)
    .filter((k) => (prices[k]?.n ?? 0) >= 2)
    .sort((a, b) => (prices[b]?.n ?? 0) - (prices[a]?.n ?? 0) || (a < b ? -1 : 1))
    .slice(0, 3);
  return joinList(
    keys.map((k) => {
      const pt = prices[k] as { sum: number; n: number };
      const cents = Math.max(1, Math.round(pt.sum / pt.n / 10));
      return `${itemName(dc.content, k)} at ${moneyText(cents)} the ${itemUnit(dc.content, k).replace(/^each$/, 'piece')}`;
    }),
  );
}

/** "not once", "once", "twice", "four times". */
export function timesWord(n: number): string {
  return n <= 0 ? 'not once' : n === 1 ? 'once' : n === 2 ? 'twice' : `${numberWord(n)} times`;
}

/** "one matter", "fifteen matters". */
function matters(n: number): string {
  return `${numberWord(n)} ${n === 1 ? 'matter' : 'matters'}`;
}

/** Average attendance per place for gatherings tallied under `prefix` (gather / market). */
function gatherings(dc: DetectCtx, t: Tally, prefix: string): Array<{ name: string; avg: number }> {
  const places = Object.keys(t.acts)
    .filter((k) => k.startsWith(`${prefix}:`))
    .map((k) => Number(k.slice(prefix.length + 1)))
    .sort((a, b) => a - b);
  return places
    .map((pid) => {
      const total = t.acts[`${prefix}:${pid}`] ?? 0;
      const n = Math.max(1, t.acts[`${prefix}N:${pid}`] ?? 1);
      return { name: placeName(dc.world, pid), avg: Math.round(total / n) };
    })
    .filter((x) => x.name && x.avg > (prefix === 'market' ? 1 : 0))
    .sort((a, b) => b.avg - a.avg || (a.name < b.name ? -1 : 1))
    .slice(0, 3);
}

/** "Divine service drew nineteen to the Lutheran church and nine to the Haugean meeting." */
function servicesLine(dc: DetectCtx, t: Tally): string {
  const items = gatherings(dc, t, 'gather');
  if (items.length === 0) return '';
  return `Divine service drew ${joinList(items.map((x) => `${numberWord(x.avg)} to ${x.name}`))}.`;
}

/** "Market drew fourteen to Pratt & Daughter, Outfitters." */
function marketLine(dc: DetectCtx, t: Tally): string {
  const items = gatherings(dc, t, 'market');
  if (items.length === 0) return '';
  return `Market drew ${joinList(items.map((x) => `${numberWord(x.avg)} to ${x.name}`))}.`;
}

/** "Market day and court day were kept." */
function observancesLine(dc: DetectCtx, t: Tally): string {
  const ids = Object.keys(t.acts)
    .filter((k) => k.startsWith('obs:'))
    .map((k) => k.slice(4))
    .sort();
  // The authored name keeps its case ("the Fourth of July"); only a leading article drops it.
  const names = ids
    .map((id) => (dc.content.observances?.[id]?.name ?? id.replace(/_/g, ' ')).replace(/^The /, 'the '))
    .filter((n, i, all) => all.indexOf(n) === i);
  if (names.length === 0) return '';
  const first = names[0] as string;
  const list = joinList(names);
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} ${names.length > 1 || /s$/.test(first) ? 'were' : 'was'} kept.`;
}

function entriesInWeek(dc: DetectCtx, week: number, voices: readonly string[]): number {
  let n = 0;
  for (const e of dc.world.chronicle.entries) {
    if (weekNumber(e.t) === week && voices.includes(e.voice) && e.kind !== 'digest' && e.kind !== 'almanac') n += 1;
  }
  return n;
}

function ledgerBind(dc: DetectCtx, t: Tally, members: number, days: number): Bindings {
  const out: Bindings = {
    meals: t.meals,
    cold_meals: t.coldMeals,
    fresh_pct: pctOf(t.freshPoints, Math.max(1, t.servings * 100)) * 1,
    kcal_day: members > 0 && days > 0 ? Math.round(t.kcal / (members * days)) : 0,
  };
  const board = topFoods(dc, t.foods, 3);
  out.board = board.length > 0 ? joinList(board) : 'what came to hand';
  const lost = topFoods(dc, t.lost, 2);
  out.lost = lost.length > 0 ? joinList(lost) : 'nothing worth the naming';
  const why = Object.entries(t.lostWhy).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  if (why) out.why = why[0].replace(/_/g, ' ');
  out.credit = t.creditCents > 0 ? moneyText(t.creditCents) : 'nothing';
  out.amount = t.spentCents > 0 ? moneyText(t.spentCents) : 'little';
  out.shortages = t.shortages;
  out.shortages_word = numberWord(t.shortages);
  out.shortages_times = timesWord(t.shortages);
  out.in_need = t.shortages > 0;
  if (t.shortages > 0) {
    out.ration_pct = t.lowestRationPct;
    out.lowest_days =
      t.lowestDaysTenths < 10 ? 'under a day' : `${numberWord(Math.round(t.lowestDaysTenths / 10))} days`;
  }
  return out;
}

/** Write the digests for the week that just ended, then roll the week's accounts. */
export function weeklyDigest(dc: DetectCtx, endedWeek: number, at: number): void {
  const st = dc.world.chronicle;
  const tl = st.tallies;
  const monday = at - DAY; // the digest is dated the last day of the week it summarizes
  const week = tl.week;
  const pubWeek = tl.pubWeek ?? emptyTally();
  const publicCount = entriesInWeek(dc, endedWeek, ['paper', 'ballad']);
  const prices = priceLine(dc);

  const almanacBind: Bindings = {
    week: endedWeek,
    count: publicCount,
    count_word: numberWord(publicCount),
    matters: matters(publicCount),
    shortages: pubWeek.shortages,
    shortages_word: numberWord(pubWeek.shortages),
    shortages_times: timesWord(pubWeek.shortages),
    quiet: publicCount === 0 && prices === '',
    priced: prices !== '',
  };
  if (prices) almanacBind.prices = prices;
  const services = servicesLine(dc, pubWeek);
  const kept = observancesLine(dc, pubWeek);
  if (services) almanacBind.services = services;
  const market = marketLine(dc, pubWeek);
  if (market) almanacBind.services = services ? `${services} ${market}` : market;
  if (kept) almanacBind.observances = kept;
  almanacBind.weather = weekWeatherText(dc.ctx.seed, monday - 6 * DAY);
  if (week.creditCents > 0) almanacBind.credit = moneyText(week.creditCents);
  writeEntry(
    dc,
    newDraft({
      key: 'digest.week',
      voice: 'almanac',
      basis: 'public',
      importance: 10,
      t: monday,
      tEnd: monday,
      kind: 'digest',
      level: endedWeek,
      topics: ['almanac'],
      bind: almanacBind,
      optional: true,
    }),
  );

  // The ledger of the player character's own household: their books, nobody else's.
  const pcId = dc.pcId;
  const pcHouse = pcId ? (dc.world.actors[pcId as ActorId]?.householdId ?? 0) : 0;
  const hhTally = pcHouse ? tl.households[pcHouse] : undefined;
  if (pcHouse && hhTally && hhTally.meals + hhTally.shortages > 0) {
    const members = dc.world.households[pcHouse as HouseholdId]?.memberIds ?? [];
    writeEntry(
      dc,
      newDraft({
        key: 'digest.ledger',
        voice: 'ledger',
        basis: 'witnessed',
        knownBy: members.map((m) => m as number),
        authorId: pcId,
        importance: 12,
        t: monday,
        tEnd: monday,
        actorIds: [pcId],
        kind: 'digest',
        level: endedWeek,
        topics: ['food'],
        bind: ledgerBind(dc, hhTally, members.length, 7),
        optional: true,
      }),
    );
  }

  // Behind the doors, for the epilogue: the whole town's board, which nobody saw at once.
  if (week.meals + week.shortages + Object.keys(week.lost).length > 0) {
    const members = Object.keys(dc.world.actors).length;
    writeEntry(
      dc,
      newDraft({
        key: 'digest.week',
        voice: 'epilogue',
        basis: 'omniscient',
        importance: 12,
        t: monday,
        tEnd: monday,
        kind: 'digest',
        level: endedWeek,
        topics: ['food'],
        bind: {
          ...ledgerBind(dc, week, members, 7),
          week: endedWeek,
          count: week.shortages,
          truth: true,
        },
        optional: true,
        salt: 5,
      }),
    );
  }

  // Roll the week: prices keep last week's average, the week's accounts start over.
  for (const k of Object.keys(tl.prices)) {
    const pt = tl.prices[k];
    if (!pt) continue;
    if (pt.n > 0) pt.last = Math.round(pt.sum / pt.n);
    pt.sum = 0;
    pt.n = 0;
  }
  tl.week = emptyTally();
  tl.pubWeek = emptyTally();
  tl.households = {};
  st.lastDigestWeek = endedWeek;
}

/** The Almanac's annual reckoning (each Jan 1, 05 §11.2). */
export function annualAlmanac(dc: DetectCtx, at: number, year: number): void {
  const st = dc.world.chronicle;
  const y = st.tallies.year;
  const told = st.entries.filter((e) => e.kind === 'pattern' && e.voice === 'paper').length;
  writeEntry(
    dc,
    newDraft({
      key: 'digest.year',
      voice: 'almanac',
      basis: 'public',
      importance: 30,
      t: at,
      tEnd: at,
      kind: 'almanac',
      level: year,
      topics: ['almanac'],
      bind: {
        year: year - 1,
        count: told,
        count_word: numberWord(told),
        matters: matters(told),
        shortages: y.shortages,
        shortages_word: numberWord(y.shortages),
        shortages_times: timesWord(y.shortages),
      },
      optional: true,
    }),
  );
  st.tallies.year = emptyTally();
}
