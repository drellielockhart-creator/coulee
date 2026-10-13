import { tacticalPosition } from '../activity/api.ts';
import { type ActorId, idsOf } from '../ids.ts';
import { healthOf } from '../needs/api.ts';
import { instantOf, instantText, TICKS_PER_SECOND } from '../sim/clock.ts';
import type { World } from '../world.ts';
import { activeBrawls } from './brawl.ts';
export function tacticalView(w: World, pc: ActorId) {
  const s = w.tactical,
    p = s?.participants[pc];
  if (!s?.active || !p) return null;
  const now = instantOf(w),
    a = p.action;
  const status = a
    ? `${a.kind}: ${a.phase}; ${((a.phase === 'windup' ? a.due : a.recoverUntil) - now) / TICKS_PER_SECOND}s remaining`
    : 'awaiting your order';
  const h = healthOf(w, pc);
  const health = h
    ? ` Nonlethal ${h.nonlethal} / Vigor ${w.needs.byActor[pc]?.survival?.vigor ?? 0}.${h.dying ? ' Dying: needs stabilization.' : h.stable ? ' Stable but unconscious.' : ''}`
    : '';
  return {
    mode: 'Tactical' as const,
    instant: now,
    clock: instantText(now),
    position: tacticalPosition(w, pc),
    status,
    guarding: p.guarding,
    health: healthOf(w, pc) ?? null,
    conditions: w.actors[pc]?.sheet.conditions ?? [],
    submitted: p.submitted ?? false,
    fled: p.fled ?? false,
    breathe:
      s.heap.length === 0 &&
      activeBrawls(w).length === 0 &&
      !idsOf<ActorId>(s.participants).some((id) => healthOf(w, id)?.dying) &&
      now - s.quietSince >= 6 * TICKS_PER_SECOND,
    timeline: `Tactical ${instantText(now)} — ${status}.${p.submitted ? ' You have yielded.' : ''}${p.fled ? ' You have left the brawl.' : ''}${health}`,
    interruptLatched: s.pause !== null,
  };
}
