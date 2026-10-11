/**
 * Small integer-only text helpers for period prose. OWNER: module:chronicle.
 * No Intl, no locale, no floats: everything here is deterministic on every engine.
 */
import { type GameMinute, hourOfDay, WEEKDAY_NAMES, weekdayOf } from '../time.ts';

const WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 0..99 as words ("twenty-six"), else digits. */
export function numberWord(n: number): string {
  if (n >= 0 && n < 20) return WORDS[n] as string;
  if (n >= 20 && n < 100) {
    const t = TENS[Math.floor(n / 10)] as string;
    return n % 10 === 0 ? t : `${t}-${WORDS[n % 10]}`;
  }
  return String(n);
}

/** The ballad's exaggeration of a count: a tall tale grows in the telling. */
export function tallWord(n: number): string {
  if (n <= 2) return 'a pair';
  if (n <= 4) return 'half a dozen';
  if (n <= 8) return 'a dozen';
  if (n <= 16) return 'a score';
  if (n <= 40) return 'a hundred';
  return 'a thousand';
}

export function capFirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/** "a", "a and b", "a, b and c". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** $4.20, 35 cents as "35¢". */
export function moneyText(cents: number): string {
  const c = Math.abs(Math.round(cents));
  const sign = cents < 0 ? '-' : '';
  if (c < 100) return `${sign}${c}¢`;
  const dollars = Math.floor(c / 100);
  const rem = c % 100;
  return `${sign}$${dollars}.${String(rem).padStart(2, '0')}`;
}

/** Days from tenths: 14 tenths = "a day and a half"? Plain: "1.4"-free words, whole days (rounded up). */
export function daysText(tenths: number): string {
  if (tenths <= 0) return 'less than a day';
  const days = Math.max(1, Math.ceil(tenths / 10));
  return days === 1 ? 'a day' : `${numberWord(days)} days`;
}

export function partOfDay(hour: number): string {
  if (hour < 5) return 'in the small hours';
  if (hour < 7) return 'at first light';
  if (hour < 12) return 'in the forenoon';
  if (hour < 13) return 'at noon';
  if (hour < 18) return 'in the afternoon';
  if (hour < 22) return 'of an evening';
  return 'late at night';
}

/** "on Tuesday in the afternoon" style stamp used by journals and the paper. */
export function whenPhrase(t: GameMinute): string {
  return `on ${WEEKDAY_NAMES[weekdayOf(t)]} ${partOfDay(hourOfDay(t))}`;
}

/** Singular/plural by count. */
export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Deterministic string order (code units; no locale). */
export function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Unique ascending numbers. */
export function uniqSorted(xs: readonly number[]): number[] {
  const out = [...new Set(xs)];
  out.sort((a, b) => a - b);
  return out;
}

/** Unique, insertion-ordered numbers. */
export function uniq(xs: readonly number[]): number[] {
  return [...new Set(xs)];
}

/** Integer percent of part/whole, 0 if whole is 0. */
export function pctOf(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.round((part * 100) / whole);
}
