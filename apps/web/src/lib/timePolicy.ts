/**
 * Time policy (11 §1.6). OWNER: module:web.
 *
 * On a phone the gesture that hides the map also slows the world: a peek sheet leaves the sim
 * running, a half sheet clamps it to reading speed (1×), a full sheet pauses it unless pinned.
 * The app pauses whenever it is hidden (11 §1.3: the world waits for you).
 * Pure functions so the policy is testable; the UI sends the effective speed to the worker.
 */
import { SPEED_ORDER, type Speed } from '../protocol.ts';

export type SheetState = 'closed' | 'peek' | 'half' | 'full';

export interface PolicyInput {
  chosen: Speed;
  sheet: SheetState;
  /** "Keep running" pin on a full sheet. */
  pinned: boolean;
  hidden: boolean;
  /** Desk layout: panels never pause the sim (11 §3.1). */
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

/** The clock glyph (11 §1.6): always shows which policy is in force. */
export function clockGlyph(chosen: Speed, effective: Speed): string {
  if (chosen === 'paused') return '❚❚';
  if (effective === 'paused') return '❚❚·';
  if (effective !== chosen) return `▶${SPEED_LABEL[effective]}·`;
  return `▶${SPEED_LABEL[chosen]}`;
}

export function clockGlyphTitle(chosen: Speed, effective: Speed): string {
  if (chosen === 'paused') return 'Paused by you';
  if (effective === 'paused') return 'Paused while the sheet covers the map (pin it to keep running)';
  if (effective !== chosen) return `Clamped to reading speed while a sheet is open (chosen ${SPEED_LABEL[chosen]})`;
  return `Running at ${SPEED_LABEL[chosen]}`;
}
