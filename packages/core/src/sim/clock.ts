import { asGameMinute } from '../time.ts';
import type { World } from '../world.ts';
/** Q04 recommended default; all tactical durations derive from this single resolution. */
export const TICKS_PER_SECOND = 10;
export const TICKS_PER_MINUTE = 60 * TICKS_PER_SECOND;
export const TICKS_PER_HOUR = 60 * TICKS_PER_MINUTE;
export const CLOCK_VERSION = 1;
export const instantOf = (world: World): number => world.time * TICKS_PER_MINUTE + (world.tenth ?? 0);
export function setInstant(world: World, instant: number): void {
  if (!Number.isSafeInteger(instant) || instant < 0) throw new Error('Invalid clock instant');
  world.time = asGameMinute(Math.floor(instant / TICKS_PER_MINUTE));
  world.tenth = instant % TICKS_PER_MINUTE;
}
export function instantText(instant: number): string {
  const minute = Math.floor(instant / TICKS_PER_MINUTE);
  return `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:${((instant % TICKS_PER_MINUTE) / TICKS_PER_SECOND).toFixed(1).padStart(4, '0')}`;
}
