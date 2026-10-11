/**
 * Time policy (11 §1.6). OWNER: module:web.
 *
 * On a phone the gesture that hides the map also slows the world: a peek sheet leaves the sim
 * running, a half sheet clamps it to reading speed (1×), a full sheet pauses it unless pinned.
 * The app pauses whenever it is hidden (11 §1.3: the world waits for you).
 * Pure functions so the policy is testable; the UI sends the effective speed to the worker.
 */
import { SPEED_ORDER, SPEEDS, type Speed } from '../protocol.ts';

export type SheetState = 'closed' | 'peek' | 'half' | 'full';

export interface PolicyInput {
  chosen: Speed;
  sheet: SheetState;
  /** "Keep running" pin on a full sheet. */
  pinned: boolean;
  hidden: boolean;
  /**
   * The map stays visible beside the panels (Desk and Folio): panels never slow the sim
   * (11 §3.1, §3.4). Only Pocket's bottom sheets cover the map.
   */
  desk: boolean;
}

export function effectiveSpeed(p: PolicyInput): Speed {
  if (p.hidden || p.chosen === 'paused') return 'paused';
  if (p.desk) return p.chosen;
  if (p.sheet === 'full') return p.pinned ? p.chosen : 'paused';
  if (p.sheet === 'half') return SPEED_ORDER.indexOf(p.chosen) > SPEED_ORDER.indexOf('x1') ? 'x1' : p.chosen;
  return p.chosen;
}

export const SPEED_LABEL: Record<Speed, string> = {
  paused: '❚❚',
  x1: '1×',
  x2: '2×',
  x3: '3×',
  ultra: '»',
};

/** The clock glyph (11 §1.6): always shows which policy is in force. `!` = auto-paused. */
export function clockGlyph(chosen: Speed, effective: Speed, alerted = false): string {
  if (chosen === 'paused') return alerted ? '❚❚!' : '❚❚';
  if (effective === 'paused') return '❚❚·';
  if (effective !== chosen) return `▶${SPEED_LABEL[effective]}·`;
  return `▶${SPEED_LABEL[chosen]}`;
}

/** The same policy in words, shown on screen (hover is never the only path, 11 §3.3). */
export function clockGlyphTitle(chosen: Speed, effective: Speed, alerted = false): string {
  if (chosen === 'paused') return alerted ? 'Paused: something needs you' : 'Paused by you';
  if (effective === 'paused') return 'Paused while the sheet covers the map (Keep running to override)';
  if (effective !== chosen)
    return `Reading speed ${SPEED_LABEL[effective]} while the sheet is up (chosen ${SPEED_LABEL[chosen]})`;
  return `Running at ${SPEED_LABEL[chosen]}`;
}

/**
 * Real seconds until the next game-hour step, for "Order applies in ~25 s" (display only).
 * Null when the clock is stopped.
 */
export function secondsToNextHour(effective: Speed, frac: number): number | null {
  const rate = SPEEDS[effective];
  if (rate <= 0) return null;
  return Math.max(0, Math.ceil((1 - Math.min(1, Math.max(0, frac))) / rate));
}

/** Clock minutes shown in the strip: the sim's whole hour plus display-only progress through it. */
export function displayMinute(minute: number, frac: number): number {
  return Math.min(59, minute + Math.floor(Math.min(0.999, Math.max(0, frac)) * 60));
}
