/**
 * Belief cross-module API. OWNER: module:belief.
 * social calls transmit() for every gossip; psyche calls formProjection() for projection.
 */
import type { ContentBundle, PredicateId } from '../content.ts';
import { type ActorId, asPropId, type EventId, nextId, type PlaceId, type PropId, type RumorId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import type { Belief, EvidenceType, Prop, PropArg } from './state.ts';

function argKey(a: PropArg): string {
  switch (a.kind) {
    case 'actor':
      return `a:${a.id}`;
    case 'household':
      return `h:${a.id}`;
    case 'figure':
      return `f:${a.id}`;
    case 'place':
      return `p:${a.id}`;
    case 'text':
      return `t:${JSON.stringify(a.value)}`;
    case 'number':
      return `n:${a.value}`;
    case 'misfortune':
      return `m:${a.id}`;
  }
}

export function propKey(pred: PredicateId, args: readonly PropArg[]): string {
  return `${pred}(${args.map(argKey).join(',')})`;
}

/** Intern a proposition (idempotent). */
export function internProp(world: World, pred: PredicateId, args: PropArg[]): PropId {
  const key = propKey(pred, args);
  const existing = world.belief.propByKey[key];
  if (existing !== undefined) return existing;
  const id = asPropId(nextId(world.belief.counters, 'prop'));
  world.belief.props[id] = { id, pred, args, key };
  world.belief.propByKey[key] = id;
  return id;
}

/** Render a proposition with its predicate template: "Loveday Trevenna is a witch". */
export function propText(world: World, content: ContentBundle, propId: PropId): string {
  const p: Prop | undefined = world.belief.props[propId];
  if (!p) return `#${propId}`;
  const tpl = content.predicates[p.pred]?.text ?? `${p.pred}({0})`;
  return tpl.replace(/\{(\d)\}/g, (_m, i: string) => {
    const a = p.args[Number(i)];
    if (!a) return '?';
    switch (a.kind) {
      case 'actor': {
        const act = world.actors[a.id];
        return act ? `${act.name.given} ${act.name.family}`.trim() : `#${a.id}`;
      }
      case 'household':
        return world.households[a.id]?.name ?? `#${a.id}`;
      case 'figure':
        return world.belief.figures[a.id]?.name ?? `#${a.id}`;
      case 'place':
        return world.places[a.id]?.name ?? `#${a.id}`;
      case 'text':
        return a.value;
      case 'number':
        return String(a.value);
      case 'misfortune':
        return `misfortune #${a.id}`;
    }
  });
}

export function beliefOf(world: World, holderId: ActorId, propId: PropId): Belief | undefined {
  for (const id of world.belief.beliefsByHolder[holderId] ?? []) {
    const b = world.belief.beliefs[id];
    if (b && b.propId === propId) return b;
  }
  return undefined;
}

/** Credence 0..100 that `holderId` gives `propId` (0 if no belief). */
export function credenceOf(world: World, holderId: ActorId, propId: PropId): number {
  return beliefOf(world, holderId, propId)?.credence ?? 0;
}

export type Channel =
  | 'tavern'
  | 'church'
  | 'church_steps'
  | 'store'
  | 'bee'
  | 'mill'
  | 'household'
  | 'letter'
  | 'newspaper'
  | 'peddler'
  | 'landing'
  | 'fae_whisper'
  | 'street';

export interface TransmitRequest {
  speakerId: ActorId;
  listenerId: ActorId;
  placeId: PlaceId | null;
  channel: Channel;
  /** The social.interaction event this happens inside (for causes / memory links). */
  interactionEventId: EventId | null;
  /** Force a topic (player choosing what to say); otherwise topic selection per 04 §8.3. */
  topic?: PropId;
}

export interface TransmitResult {
  /** False if the speaker had nothing worth telling this listener. */
  told: boolean;
  rumorId: RumorId | null;
  propId: PropId | null;
  mutation: string | null;
  /** Listener's credence after hearing (0..100). */
  listenerCredence: number;
}

/**
 * The ONE gossip path (04 §8.3–8.5): topic selection, telling, mutation, listener credence
 * update (04 §5.3), Told memory via social/api.ts addMemory, 'belief.transmitted' event.
 * STUB: tells nothing.
 */
export function transmit(_world: World, _ctx: SimContext, _req: TransmitRequest): TransmitResult {
  return { told: false, rumorId: null, propId: null, mutation: null, listenerCredence: 0 };
}

/** Whether the speaker has something juicy the listener (probably) hasn't heard. STUB. */
export function hasRumorFor(_world: World, _speakerId: ActorId, _listenerId: ActorId): boolean {
  return false;
}

/** Direct evidence (witnessing, finding a clue, a sermon). STUB. */
export function observe(
  _world: World,
  _ctx: SimContext,
  _observerId: ActorId,
  _propId: PropId,
  _evidence: { type: EvidenceType; dir: 1 | -1; sourceId: ActorId | null; eventId: EventId | null },
): void {
  // STUB
}

/** Projection (P7): a defense makes `holderId` believe `targetId` has the disowned trait. STUB. */
export function formProjection(
  _world: World,
  _ctx: SimContext,
  _holderId: ActorId,
  _targetId: ActorId,
  _traitId: string,
): void {
  // STUB
}

/** 0..100: how much `observerId` suspects `targetId` of being concealed/fae/witch. STUB. */
export function suspicionOf(_world: World, _observerId: ActorId, _targetId: ActorId): number {
  return 0;
}

/** Urges from beliefs and grudges (avoid, confront, accuse, ask around). STUB. */
export function proposeBeliefUrges(_world: World, _ctx: SimContext, _actorId: ActorId): UrgeProposal[] {
  return [];
}
