/**
 * The weather in words for the almanac (05 §11.2): rain or snow by part of the day, the cold and
 * the heat, a thaw, rain on market day. Read from the same hooks the sim uses (provisions/api:
 * airTempF, isRaining), so the page never claims weather the needs and the larders did not feel.
 * OWNER: module:chronicle.
 */
import { airTempF, isRaining } from '../provisions/api.ts';
import { calendarAt, MINUTES_PER_DAY } from '../time.ts';
import type { World } from '../world.ts';

export interface DayWeather {
  /** Hours of rain or snow, and which. */
  wetHours: number;
  snow: boolean;
  /** Part of the day the wet weather began: 'night', 'morning', 'afternoon', 'evening'. */
  when: string;
  /** Air at 14:00 and at 05:00, °F. */
  noonF: number;
  dawnF: number;
}

const partOfDay = (h: number): string => (h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening');

export function dayWeather(seed: number, dayStart: number, world?: World): DayWeather {
  let wetHours = 0;
  let first = -1;
  let snowHours = 0;
  for (let h = 0; h < 24; h++) {
    const cal = calendarAt((dayStart + h * 60) as never);
    if (!isRaining(seed, cal, world)) continue;
    wetHours += 1;
    if (first < 0) first = h;
    if (airTempF(cal, world) <= 32) snowHours += 1;
  }
  return {
    wetHours,
    snow: wetHours > 0 && snowHours * 2 >= wetHours,
    when: first >= 0 ? partOfDay(first) : '',
    noonF: airTempF(calendarAt((dayStart + 14 * 60) as never), world),
    dawnF: airTempF(calendarAt((dayStart + 5 * 60) as never), world),
  };
}

/** The day line's weather clause ('' on an unremarkable day). */
export function dayWeatherText(seed: number, dayStart: number, world?: World): string {
  const w = dayWeather(seed, dayStart, world);
  const y = dayWeather(seed, dayStart - MINUTES_PER_DAY, world);
  const parts: string[] = [];
  if (w.wetHours > 0) {
    const heavy = w.wetHours >= 6;
    if (w.snow) parts.push(heavy ? `Snow from the ${w.when} on, and drifting` : `Snow in the ${w.when}`);
    else parts.push(heavy ? `Rain from the ${w.when} on` : `Rain in the ${w.when}`);
  }
  if (w.noonF > 32 && y.noonF <= 32) parts.push('a thaw at midday');
  else if (w.noonF <= 10) parts.push(`bitter cold, ${w.noonF} degrees at noon`);
  else if (w.dawnF <= 0) parts.push(`${Math.abs(w.dawnF)} below at dawn`);
  else if (w.noonF >= 88) parts.push(`hot, ${w.noonF} degrees in the shade`);
  if (parts.length === 0) return '';
  const s = parts.join('; ');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

/** The week's weather for the Almanac digest ('' when nothing to say). `start` = the week's first day. */
export function weekWeatherText(seed: number, start: number, world?: World): string {
  let wet = 0;
  let snow = 0;
  let noonSum = 0;
  let market = '';
  for (let d = 0; d < 7; d++) {
    const day = start + d * MINUTES_PER_DAY;
    const w = dayWeather(seed, day, world);
    noonSum += w.noonF;
    if (w.wetHours > 0) {
      if (w.snow) snow += 1;
      else wet += 1;
      const cal = calendarAt(day as never);
      if (cal.weekday === 'sat' && (w.when === 'morning' || w.when === 'afternoon'))
        market = w.snow ? ' It snowed on market day.' : ' It rained on market day.';
    }
  }
  const noon = Math.round(noonSum / 7);
  const bits: string[] = [];
  if (snow > 0) bits.push(`snow on ${snow === 1 ? 'one day' : `${dayWord(snow)} days`}`);
  if (wet > 0) bits.push(`rain on ${wet === 1 ? 'one day' : `${dayWord(wet)} days`}`);
  const sky = bits.length > 0 ? `Weather: ${bits.join(' and ')}` : 'Weather: dry all week';
  const glass = `the glass near ${noon} at noon`;
  return `${sky}, ${glass}.${market}`;
}

const DAY_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const dayWord = (n: number): string => DAY_WORDS[n] ?? String(n);
