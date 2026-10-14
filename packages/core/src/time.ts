/**
 * Game time and the calendar (ADR 0001 "Time"; 05 §4).
 *
 * Canonical time is integer game-minutes since 1855-04-01 00:00 local solar time
 * (no time zones until 1883). Everything here is integer math: no Date, no floats stored.
 */
import type { Brand } from './ids.ts';

/** Integer minutes since the epoch, 1855-04-01 00:00 local solar time. May be negative (births). */
export type GameMinute = Brand<number, 'GameMinute'>;
export const asGameMinute = (n: number): GameMinute => n as GameMinute;

export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_WEEK = 10080;
export const EPOCH = { year: 1855, month: 4, day: 1 } as const;

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const WEEKDAY_NAMES: Record<Weekday, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const MOON_PHASES = [
  'new',
  'waxing_crescent',
  'first_quarter',
  'waxing_gibbous',
  'full',
  'waning_gibbous',
  'last_quarter',
  'waning_crescent',
] as const;
export type MoonPhase = (typeof MOON_PHASES)[number];
export const MOON_PHASE_NAMES: Record<MoonPhase, string> = {
  new: 'new moon',
  waxing_crescent: 'waxing crescent',
  first_quarter: 'first quarter',
  waxing_gibbous: 'waxing gibbous',
  full: 'full moon',
  waning_gibbous: 'waning gibbous',
  last_quarter: 'last quarter',
  waning_crescent: 'waning crescent',
};

/** Synodic month in 1/20ths of a minute: 29.530588 days = 42524.05 minutes. */
const SYNODIC_TWENTIETHS = 850_481;
/**
 * A mean new moon, in minutes after the epoch (local solar time at ~91°W):
 * 1855-04-16 ~14:10 (Meeus mean phase; within a few hours of the true phase).
 */
const REFERENCE_NEW_MOON = 22_451;

/** Days since 1970-01-01 for a proleptic Gregorian date (H. Hinnant's algorithm, integer only). */
export function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
}

/** Inverse of daysFromCivil. */
export function civilFromDays(days: number): { year: number; month: number; day: number } {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

const EPOCH_DAYS = daysFromCivil(EPOCH.year, EPOCH.month, EPOCH.day);

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Game minute for a calendar date and time of day. */
export function toGameMinute(year: number, month: number, day: number, hour = 0, minute = 0): GameMinute {
  return asGameMinute((daysFromCivil(year, month, day) - EPOCH_DAYS) * MINUTES_PER_DAY + hour * 60 + minute);
}

/** Parse 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' (content and CLI convenience). */
export function parseGameDate(s: string): GameMinute {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(s);
  if (!m) throw new Error(`bad game date '${s}', expected YYYY-MM-DD[THH:MM]`);
  return toGameMinute(
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    m[4] === undefined ? 0 : Number(m[4]),
    m[5] === undefined ? 0 : Number(m[5]),
  );
}

/** Floor division and positive modulo, so negative minutes (pre-epoch births) behave. */
export const floorDiv = (a: number, b: number): number => Math.floor(a / b);
export const mod = (a: number, b: number): number => ((a % b) + b) % b;

/** Integer day number since the epoch (day 0 = 1855-04-01). */
export const dayIndex = (t: GameMinute): number => floorDiv(t, MINUTES_PER_DAY);
/** Start of the day containing t. */
export const startOfDay = (t: GameMinute): GameMinute => asGameMinute(dayIndex(t) * MINUTES_PER_DAY);
export const minuteOfDay = (t: GameMinute): number => mod(t, MINUTES_PER_DAY);
export const hourOfDay = (t: GameMinute): number => Math.floor(minuteOfDay(t) / 60);
export const addMinutes = (t: GameMinute, m: number): GameMinute => asGameMinute(t + m);
export const addHours = (t: GameMinute, h: number): GameMinute => asGameMinute(t + h * 60);
export const addDays = (t: GameMinute, d: number): GameMinute => asGameMinute(t + d * MINUTES_PER_DAY);

export function weekdayOf(t: GameMinute): Weekday {
  // 1855-04-01 was a Sunday.
  return WEEKDAYS[mod(dayIndex(t), 7)] as Weekday;
}

export function seasonOfMonth(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

export interface MoonInfo {
  phase: MoonPhase;
  /** Minutes since the last new moon. */
  ageMinutes: number;
  /** 0..1000, approximate fraction lit (integer parabola, no trig). */
  illuminationPermille: number;
}

export function moonAt(t: GameMinute): MoonInfo {
  const ageTw = mod((t - REFERENCE_NEW_MOON) * 20, SYNODIC_TWENTIETHS);
  // Eight phases centered on the principal phases: new spans the last 1/16 and first 1/16.
  const idx = Math.floor((ageTw * 16 + SYNODIC_TWENTIETHS) / (2 * SYNODIC_TWENTIETHS)) % 8;
  // Distance from full as 0..1000 (0 = full, 1000 = new), then lit = 1000 - d^2/1000.
  const half = SYNODIC_TWENTIETHS / 2;
  const fromFull = Math.abs(ageTw - half);
  const d = Math.floor((fromFull * 1000) / half);
  const lit = 1000 - Math.floor((d * d) / 1000);
  return {
    phase: MOON_PHASES[idx] as MoonPhase,
    ageMinutes: Math.floor(ageTw / 20),
    illuminationPermille: lit,
  };
}

/**
 * Day length in minutes at ~43.5°N (05 §4.2), piecewise-linear between solstices and
 * equinoxes by day of year. Good enough for schedules and light; not an ephemeris.
 */
export function dayLengthMinutes(year: number, month: number, day: number): number {
  const doy = daysFromCivil(year, month, day) - daysFromCivil(year, 1, 1); // 0-based
  // Anchors: [dayOfYear, minutes]. Dec 21 ~ 9h, Mar 20 ~ 12h, Jun 21 ~ 15h18, Sep 22 ~ 12h.
  const anchors: ReadonlyArray<readonly [number, number]> = [
    [-11, 540],
    [78, 720],
    [171, 918],
    [264, 720],
    [354, 540],
    [443, 720],
  ];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i] as readonly [number, number];
    const b = anchors[i + 1] as readonly [number, number];
    if (doy >= a[0] && doy < b[0]) {
      return a[1] + Math.floor(((doy - a[0]) * (b[1] - a[1])) / (b[0] - a[0]));
    }
  }
  return 720;
}

export interface CalendarInfo {
  t: GameMinute;
  year: number;
  /** 1-12 */
  month: number;
  monthName: string;
  /** 1-31 */
  day: number;
  hour: number;
  minute: number;
  /** Days since the epoch. */
  dayIndex: number;
  weekday: Weekday;
  season: Season;
  moon: MoonInfo;
  /** Local solar sunrise / sunset, minutes after midnight. */
  sunriseMinute: number;
  sunsetMinute: number;
  isDaylight: boolean;
  isSabbath: boolean;
}

export function calendarAt(t: GameMinute): CalendarInfo {
  const di = dayIndex(t);
  const { year, month, day } = civilFromDays(EPOCH_DAYS + di);
  const mOfDay = minuteOfDay(t);
  const len = dayLengthMinutes(year, month, day);
  const sunrise = 720 - Math.floor(len / 2);
  const sunset = 720 + Math.floor(len / 2);
  const weekday = weekdayOf(t);
  return {
    t,
    year,
    month,
    monthName: MONTH_NAMES[month - 1] as string,
    day,
    hour: Math.floor(mOfDay / 60),
    minute: mOfDay % 60,
    dayIndex: di,
    weekday,
    season: seasonOfMonth(month),
    moon: moonAt(t),
    sunriseMinute: sunrise,
    sunsetMinute: sunset,
    isDaylight: mOfDay >= sunrise && mOfDay < sunset,
    isSabbath: weekday === 'sun',
  };
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "Sunday, the 1st of April, 1855" */
export function formatDate(t: GameMinute): string {
  const c = calendarAt(t);
  return `${WEEKDAY_NAMES[c.weekday]}, the ${ordinal(c.day)} of ${c.monthName}, ${c.year}`;
}

/** "1855-04-01 06:00" */
export function formatStamp(t: GameMinute): string {
  const c = calendarAt(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${c.year}-${p(c.month)}-${p(c.day)} ${p(c.hour)}:${p(c.minute)}`;
}

/** Whole years between two instants (for ages). */
/** Civil date packed as year*10000 + month*100 + day. Pure, so memoized (bounded; not world state). */
const packedCivil = new Map<number, number>();
function civilPacked(days: number): number {
  let v = packedCivil.get(days);
  if (v === undefined) {
    const { year, month, day } = civilFromDays(days);
    v = year * 10_000 + month * 100 + day;
    if (packedCivil.size >= 65_536) packedCivil.clear();
    packedCivil.set(days, v);
  }
  return v;
}

/**
 * The latest birth day index of someone at least `years` old on `to` (civil ages, as
 * `yearsBetween`). Age never increases with a later birth day, so `dayIndex(born) <= result` is
 * exactly `yearsBetween(born, to) >= years`: an arithmetic test for scans over many people.
 */
let lastBirthKey = '',
  lastBirthDay = 0;
export function latestBirthDay(years: number, to: GameMinute): number {
  const key = `${years}:${dayIndex(to)}`;
  if (key === lastBirthKey) return lastBirthDay;
  let d = dayIndex(to) - years * 366 - 2;
  while (yearsBetween(asGameMinute((d + 1) * MINUTES_PER_DAY), to) >= years) d++;
  lastBirthKey = key;
  lastBirthDay = d;
  return d;
}

let ageToDay = Number.NaN,
  ageToPacked = 0;
export function yearsBetween(from: GameMinute, to: GameMinute): number {
  // Ages use civil dates only; moon, daylight and time of day cannot affect them.
  // Hot path (ages are read every actor-hour): packed civil dates compare month/day directly.
  // Most calls repeat "today" as `to`: a one-slot cache skips that Map lookup.
  const toDay = EPOCH_DAYS + dayIndex(to);
  if (toDay !== ageToDay) {
    ageToDay = toDay;
    ageToPacked = civilPacked(toDay);
  }
  const b = ageToPacked;
  const a = civilPacked(EPOCH_DAYS + dayIndex(from));
  let y = Math.floor(b / 10_000) - Math.floor(a / 10_000);
  if (b % 10_000 < a % 10_000) y -= 1;
  return y;
}
