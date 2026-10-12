import type { ContentBundle, InteractionDef } from '../content.ts';
import type { ActorId, PlaceId } from '../ids.ts';
import { authorizationExplain, authorizeAct, type Basis } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { dayText } from './availability.ts';
import { resolveInteraction } from './interact.ts';
import { formatCents } from './model.ts';
import { opinionRecord } from './opinion.ts';
import { tuningOf } from './tuning.ts';
export interface PendingRequest {
  id: string;
  from: ActorId;
  to: ActorId;
  interactionId: string;
  response?:
    | 'lend'
    | 'borrow'
    | 'proposal'
    | 'accept_favor'
    | 'disclose'
    | 'show_item'
    | 'lend_item'
    | 'return_item'
    | 'accept_item';
  basis?: Basis;
  topic?: import('../ids.ts').PropId;
  /** An item-specific request's item and terms (13 §2.2 rule 5: answered by Command or it lapses). */
  itemId?: import('../ids.ts').ItemId;
  terms?: import('../urge.ts').Terms;
  placeId: PlaceId | null;
  until: number;
  status: 'pending' | 'accepted' | 'refused' | 'no answer';
  // ---- additive (playtest r2: requests state their terms) ----
  /** What is asked and what a yes undertakes, in words. */
  text?: string;
  cents?: number;
  favors?: number;
  dueT?: number | null;
}
/** What a request asks, and what a yes would undertake (playtest r2: favors never said either). */
export interface RequestTerms {
  /** The full sentence the asked one hears: the ask, then the obligation, then the deadline. */
  text: string;
  /** Money that would change hands on a yes (cents), and favors that would be owed. */
  cents: number;
  favors: number;
  /** When a money debt taken on a yes ought to be settled (the town's overdue horizon), else null. */
  dueT: number | null;
}

/** The terms of `def` asked of `targetId` by `initiatorId`, for the response a yes would be. */
export function requestTerms(
  world: World,
  content: ContentBundle,
  def: InteractionDef,
  initiatorId: ActorId,
  response: NonNullable<PendingRequest['response']>,
  now: number,
  /** An item request's terms (13 §6.1: a loan's day of return), when the act is about a thing. */
  item?: { terms?: import('../urge.ts').Terms },
): RequestTerms {
  const a = world.actors[initiatorId];
  const name = a ? `${a.name.given} ${a.name.family}`.trim() : 'Someone';
  const him = a?.sex === 'male' ? 'him' : a?.sex === 'female' ? 'her' : 'them';
  const he = a?.sex === 'male' ? 'he' : a?.sex === 'female' ? 'she' : 'they';
  const cents = Math.abs(def.success.ledger.cents);
  const favors = Math.abs(def.success.ledger.favors);
  const money = formatCents(cents);
  const overdueDays = content.chroniclePatterns?.debt?.params.overdue_days ?? 30;
  const dueT = cents > 0 ? now + overdueDays * 1440 : null;
  const due = dueT !== null ? `, due by ${dayText(dueT)}` : '';
  const hour = def.minutes >= 60 ? 'for an hour' : 'for a little while';
  let ask: string;
  switch (response) {
    case 'lend':
      ask = `${name} asks to borrow ${money} from you. Say yes and ${money} leaves your purse; ${he} will owe you ${money}${due}.`;
      break;
    case 'borrow':
      ask = `${name} offers you the loan of ${money}. Say yes and ${he} pays it into your purse; you will owe ${him} ${money}${due}.`;
      break;
    case 'proposal':
      ask =
        def.success.add_relationship === 'betrothed' || def.success.add_relationship === 'spouse'
          ? `${name} asks for your hand. Say yes and you are promised to each other.`
          : `${name} asks to walk out with you. Say yes and you are courting.`;
      break;
    case 'disclose':
      ask = `${name} asks you for the news. Say yes and you tell ${him} the freshest thing you have heard.`;
      break;
    // Item requests (13 §6.1): about a thing the asked one keeps, was lent, or is offered.
    case 'show_item':
      ask = `${name} asks to see what you keep. Say yes and ${he} may look it over for a while.`;
      break;
    case 'lend_item':
      ask = `${name} begs the loan of what you keep${item?.terms?.kind === 'loan' ? `, to bring it back by ${dayText(item.terms.dueAt)}` : ''}. Say yes and it goes home with ${him}.`;
      break;
    case 'return_item':
      ask = `${name} asks for back what you were lent. Say yes and you hand it over now.`;
      break;
    case 'accept_item':
      ask = `${name} offers you the loan of what ${he} keeps${item?.terms?.kind === 'loan' ? `, to bring back by ${dayText(item.terms.dueAt)}` : ''}. Say yes and you take it home on those terms.`;
      break;
    default:
      ask = def.success.give_item
        ? `${name} offers you a gift. Take it and you owe ${him} a kindness in return (${favors || 1} favor).`
        : `${name} offers to ${def.label.toLowerCase()} ${hour} (${def.name}). Accept and you will owe ${him} ${favors === 1 ? 'a favor' : `${favors} favors`}, to be returned in kind.`;
  }
  return { text: `${ask} Answer yes or no within the hour; silence means no.`, cents, favors, dueT };
}

/**
 * The asker will not put the same request to the same person again for a while (playtest r2:
 * one neighbor offered the same favor five times a week): a request sets the asker's cooldown,
 * a refusal or no answer a longer one.
 */
export function throttleRequest(
  world: World,
  content: ContentBundle,
  from: ActorId,
  to: ActorId,
  def: InteractionDef | undefined,
  now: number,
  refused: boolean,
): void {
  const rec = opinionRecord(world, from, to);
  if (!rec || !def) return;
  const t = tuningOf(content);
  const hours = refused ? t.refused_request_cooldown_hours : Math.max(def.cooldown_hours, t.request_cooldown_hours);
  rec.cooldowns[def.id] = Math.max(rec.cooldowns[def.id] ?? 0, now + hours * 60);
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
      const act = {
        kind: r.response ?? 'lend',
        targetId: r.from,
        ...(r.itemId !== undefined ? { itemId: r.itemId } : {}),
      };
      const auth = authorizeAct(world, r.to, act, { kind: 'command', issuer: answer.issuer ?? { kind: 'player' } });
      if (!auth.ok) {
        ctx.emit({
          kind: 'social.act_refused',
          data: { actorId: r.to, reason: auth.reason },
          roles: [{ actor: r.to, role: 'agent' }],
          visibility: 'private',
          explain: authorizationExplain(world, r.to, act, {
            kind: 'command',
            issuer: answer.issuer ?? { kind: 'player' },
          }),
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
          ...(r.itemId !== undefined ? { itemId: r.itemId } : {}),
          ...(r.terms !== undefined ? { terms: r.terms } : {}),
        });
    } else if (ctx.now > r.until) r.status = 'no answer';
    else continue;
    if (r.status === 'refused' || r.status === 'no answer')
      throttleRequest(world, ctx.content, r.from, r.to, ctx.content.interactions[r.interactionId], ctx.now, true);
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
