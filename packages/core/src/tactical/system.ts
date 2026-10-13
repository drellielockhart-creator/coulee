import { moveTactical } from '../activity/api.ts';
import { canAct } from '../needs/api.ts';
import { authorizeAct } from '../psyche/api.ts';
import { instantOf } from '../sim/clock.ts';
import type { SimContext } from '../sim/context.ts';
import { heapPop, heapPush } from '../sim/heap.ts';
import type { World } from '../world.ts';
import { cancelAction, releaseReservation } from './api.ts';
export function tacticalSystem(w: World, ctx: SimContext): void {
  const s = w.tactical;
  if (!s?.active) return;
  const now = instantOf(w);
  while (s.heap[0] && s.heap[0].instant <= now) {
    const e = heapPop(s.heap);
    if (!e) break;
    const p = s.participants[e.actorId],
      a = p?.action;
    if (!p || !a || a.token !== e.token) continue;
    if (e.kind === 'commit') {
      if (!canAct(w, e.actorId) || !authorizeAct(w, e.actorId, { kind: `tactical.${a.kind}` }, a.basis).ok) {
        cancelAction(w, ctx, e.actorId);
        continue;
      }
      if (a.destination) moveTactical(w, e.actorId, a.destination);
      releaseReservation(w, e.actorId, a);
      a.phase = 'recovery';
      p.unready = false;
      if (a.kind === 'guard') p.guarding = true;
      heapPush(s.heap, { instant: a.recoverUntil, actorId: e.actorId, seq: ++s.seq, kind: 'recover', token: a.token });
      ctx.emit({
        kind: 'tactical.action',
        data: {
          actorId: e.actorId,
          action: a.kind,
          phase: 'committed',
          text: a.kind === 'move' ? 'Your step lands; you recover.' : 'Your guard is set; you recover.',
        },
        roles: [{ actor: e.actorId, role: 'agent' }],
        visibility: 'private',
      });
    } else {
      p.action = null;
      p.readyAt = now;
      s.declarations[e.actorId] = 0;
      const eventId = ctx.emit({
        kind: 'tactical.action',
        data: { actorId: e.actorId, action: a.kind, phase: 'complete', text: 'Your action and recovery are complete.' },
        roles: [{ actor: e.actorId, role: 'agent' }],
        visibility: 'private',
      });
      // The host applies the shared perception/interrupt policy, never the actor's controller.
      s.pause = { instant: now, eventId };
    }
  }
}
