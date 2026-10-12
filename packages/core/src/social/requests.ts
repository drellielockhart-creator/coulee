import type { ActorId, PlaceId } from '../ids.ts';
import { authorizationExplain, authorizeAct, type Basis } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { resolveInteraction } from './interact.ts';
export interface PendingRequest {
  id: string;
  from: ActorId;
  to: ActorId;
  interactionId: string;
  response?: 'lend' | 'borrow' | 'proposal' | 'accept_favor' | 'disclose';
  basis?: Basis;
  topic?: import('../ids.ts').PropId;
  placeId: PlaceId | null;
  until: number;
  status: 'pending' | 'accepted' | 'refused' | 'no answer';
}
export function pendingRequests(world: World, id: ActorId): PendingRequest[] {
  return (world.social.pendingRequests ?? []).filter(
    (r) => r.to === id && r.status === 'pending' && r.until >= world.time,
  );
}
export function requestsHour(world: World, ctx: SimContext): void {
  for (const r of world.social.pendingRequests ?? []) {
    if (r.status !== 'pending') continue;
    const answer = ctx.commands.find(
      (c) => c.kind === 'social.answer_request' && c.actorId === r.to && c.data.requestId === r.id,
    );
    if (answer?.kind === 'social.answer_request' && ctx.now <= r.until) {
      const auth = authorizeAct(
        world,
        r.to,
        { kind: r.response ?? 'lend', targetId: r.from },
        { kind: 'command', issuer: answer.issuer ?? { kind: 'player' } },
      );
      if (!auth.ok) {
        ctx.emit({
          kind: 'social.act_refused',
          data: { actorId: r.to, reason: auth.reason },
          roles: [{ actor: r.to, role: 'agent' }],
          visibility: 'private',
          explain: authorizationExplain(
            world,
            r.to,
            { kind: r.response ?? 'lend', targetId: r.from },
            { kind: 'command', issuer: answer.issuer ?? { kind: 'player' } },
          ),
        });
        continue;
      }
      r.status = answer.data.accept ? 'accepted' : 'refused';
      const def = ctx.content.interactions[r.interactionId];
      if (answer.data.accept && def)
        resolveInteraction(world, ctx, {
          def,
          initiatorId: r.from,
          targetId: r.to,
          placeId: r.placeId,
          present: [],
          mode: 'forced',
          via: 'urge',
          acceptedRequestId: r.id,
          ...(r.topic !== undefined ? { topic: r.topic } : {}),
        });
    } else if (ctx.now > r.until) r.status = 'no answer';
    else continue;
    ctx.emit({
      kind: 'social.request_answered',
      data: { requestId: r.id, actorId: r.to, status: r.status },
      visibility: 'private',
      roles: [
        { actor: r.to, role: 'agent' },
        { actor: r.from, role: 'target' },
      ],
      explain: {
        kind: 'choice',
        label: r.status,
        subjects: [r.to],
        knowledge: 'self',
        terms: [],
        total: 0,
        outcome: r.status,
      },
    });
  }
  if (world.social.pendingRequests)
    world.social.pendingRequests = world.social.pendingRequests.filter(
      (r) => r.status === 'pending' || r.until > ctx.now - 1440,
    );
}
