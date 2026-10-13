import { moveTactical } from '../activity/api.ts';
import { canAct } from '../needs/api.ts';
import { authorizeAct } from '../psyche/api.ts';
import { instantOf } from '../sim/clock.ts';
import type { SimContext } from '../sim/context.ts';
import { heapPop, heapPush } from '../sim/heap.ts';
import type { World } from '../world.ts';
import { cancelAction, releaseReservation, startAction } from './api.ts';
import { brawlCheck, commitBrawl, decideBrawl, settleBrawls } from './brawl.ts';
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
      if (
        (a.fromReaction && !p.reaction) ||
        brawlCheck(w, ctx.content, e.actorId, a.kind, a.targetId) ||
        !canAct(w, e.actorId) ||
        !authorizeAct(w, e.actorId, { kind: `tactical.${a.kind}` }, a.basis).ok
      ) {
        cancelAction(w, ctx, e.actorId);
        continue;
      }
      if (a.destination) moveTactical(w, e.actorId, a.destination);
      releaseReservation(w, e.actorId, a);
      a.phase = 'recovery';
      commitBrawl(w, ctx, e.actorId, a);
      p.unready = false;
      if (a.kind === 'guard') p.guarding = true;
      heapPush(s.heap, { instant: a.recoverUntil, actorId: e.actorId, seq: ++s.seq, kind: 'recover', token: a.token });
      ctx.emit({
        kind: 'tactical.action',
        data: {
          actorId: e.actorId,
          action: a.kind,
          phase: 'committed',
          text: `${a.kind} resolves; you recover.`,
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
      if (a.kind === 'flee' && !a.cancelled && !p.fled) startAction(w, ctx, e.actorId, 'flee', a.basis);
      else decideBrawl(w, ctx, e.actorId);
    }
  }
  settleBrawls(w, ctx);
}
