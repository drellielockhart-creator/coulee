import { tacticalPosition } from '../activity/api.ts';
import type { ActorId } from '../ids.ts';
import { instantOf, instantText, TICKS_PER_SECOND } from '../sim/clock.ts';
import type { World } from '../world.ts';
export function tacticalView(w: World, pc: ActorId) {
  const s = w.tactical,
    p = s?.participants[pc];
  if (!s?.active || !p) return null;
  const now = instantOf(w),
    a = p.action;
  const status = a
    ? `${a.kind}: ${a.phase}; ${((a.phase === 'windup' ? a.due : a.recoverUntil) - now) / TICKS_PER_SECOND}s remaining`
    : 'awaiting your order';
  return {
    mode: 'Tactical' as const,
    instant: now,
    clock: instantText(now),
    position: tacticalPosition(w, pc),
    status,
    guarding: p.guarding,
    breathe: s.heap.length === 0 && now - s.quietSince >= 6 * TICKS_PER_SECOND,
    timeline: `Tactical ${instantText(now)} — ${status}.`,
    interruptLatched: s.pause !== null,
  };
}
