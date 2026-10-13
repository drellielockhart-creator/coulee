/**
 * Temperature hook for spoilage, exposure and fuel (05 §4.4, §6.3). OWNER: module:provisions
 * until a weather module exists; a future weather module will replace `airTempF` behind
 * the same signature.
 *
 * Deterministic and integer: monthly normals for the Driftless (°F, La Crosse-like),
 * linearly interpolated by day, plus a fixed diurnal curve. No randomness yet.
 */
import type { TempBand } from '../content.ts';
import { mixKey, rng } from '../rng.ts';
import type { CalendarInfo } from '../time.ts';

/** Mean daily temperature by month (index 0 = January), °F. */
export const MONTHLY_MEAN_F = [14, 19, 32, 47, 59, 68, 73, 70, 61, 49, 33, 19] as const;

/** Offset from the daily mean by hour of day (0..23), °F; coldest before dawn, warmest mid-afternoon. */
export const DIURNAL_OFFSET_F = [
  -7, -8, -8, -9, -9, -10, -9, -7, -4, -1, 2, 5, 7, 9, 10, 10, 9, 7, 4, 2, 0, -2, -4, -6,
] as const;

/** Outdoor air temperature, °F (integer). */
export function airTempF(cal: CalendarInfo, world?: import('../world.ts').World): number {
  if (world?.region?.definition.fixed_weather) return world.region.definition.fixed_weather.temperature_f;
  const m = cal.month - 1;
  const here = MONTHLY_MEAN_F[m] as number;
  // Interpolate toward the neighboring month's mean around mid-month (day 15).
  const nextIdx = cal.day >= 15 ? (m + 1) % 12 : (m + 11) % 12;
  const there = MONTHLY_MEAN_F[nextIdx] as number;
  const dist = Math.abs(cal.day - 15); // 0..16
  const mean = here + Math.floor(((there - here) * dist) / 31);
  return mean + (DIURNAL_OFFSET_F[cal.hour] as number);
}

/** Storage temperature for a kind of storage (indoors buffers swings; cellars hold ~50°F). */
export function storageTempF(
  cal: CalendarInfo,
  storage: 'outdoor' | 'indoor' | 'cellar' | 'springhouse',
  world?: import('../world.ts').World,
): number {
  const air = airTempF(cal, world);
  switch (storage) {
    case 'outdoor':
      return air;
    case 'indoor':
      return Math.max(air, 40) - Math.floor(Math.max(0, air - 75) / 2);
    case 'cellar':
      return 50 + Math.floor((air - 50) / 6);
    case 'springhouse':
      return 48;
  }
}

/** Spoilage band (items.ts TEMP_BANDS): frozen < 32 <= cold < 45 <= cool < 70 <= warm < 85 <= hot. */
export function tempBand(f: number): TempBand {
  if (f < 32) return 'frozen';
  if (f < 45) return 'cold';
  if (f < 70) return 'cool';
  if (f < 85) return 'warm';
  return 'hot';
}

/**
 * Chance that a given day is a rain day, per mille, by month (index 0 = January). A rain day has
 * one spell of rain of 2..8 hours starting somewhere in the day. Deterministic in (seed, day).
 */
export const RAIN_DAY_PERMILLE = [150, 150, 250, 330, 380, 400, 380, 380, 340, 280, 250, 170] as const;

/** Salt for the rain draws so they never collide with other weather-stream users. */
const SALT_RAIN = 0x7261696e;

/** The day's rain spell: start hour and length, or null on a dry day. Pure in (seed, dayIndex, month). */
export function rainSpell(seed: number, dayIdx: number, month: number): { start: number; hours: number } | null {
  const r = rng(seed, 'weather', dayIdx, mixKey(dayIdx, SALT_RAIN));
  if (!r.chancePermille(RAIN_DAY_PERMILLE[month - 1] as number)) return null;
  const hours = r.int(2, 8);
  const start = r.int(0, 23);
  return { start, hours };
}

/** Is it raining during this hour? A spell is clipped at midnight. */
export function isRaining(seed: number, cal: CalendarInfo, world?: import('../world.ts').World): boolean {
  if (world?.region?.definition.fixed_weather) return world.region.definition.fixed_weather.raining;
  const spell = rainSpell(seed, cal.dayIndex, cal.month);
  if (spell && cal.hour >= spell.start && cal.hour < spell.start + spell.hours) return true;
  return false;
}
