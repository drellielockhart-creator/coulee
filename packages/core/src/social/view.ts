/**
 * Social view part. OWNER: module:social. Contract with module:web (see needs/view.ts note).
 */
import { displayName } from '../actor.ts';
import type { ContentBundle } from '../content.ts';
import type { ActorId } from '../ids.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';
import { memoriesOf, opinionLabel, opinionOf, relationshipsOf } from './api.ts';

export interface OpinionReasonView {
  label: string;
  affection: number;
  respect: number;
  trust: number;
  fear: number;
  since: number;
}

export interface OpinionView {
  targetId: ActorId;
  targetName: string;
  affection: number;
  respect: number;
  trust: number;
  fear: number;
  /** Derived label ('Friend', 'Enemy'...) or ''. */
  label: string;
  reasons: OpinionReasonView[];
}

export interface MemoryView {
  id: number;
  kind: string;
  summary: string;
  at: number;
  emotion: string;
  intensity: number;
  /** 0..1000 */
  salience: number;
  source: string;
}

export interface RelationshipView {
  otherId: ActorId;
  otherName: string;
  /** Read from this actor's side: 'parent of', 'child of', 'spouse'... */
  label: string;
}

export interface SocialActorView {
  opinions: OpinionView[];
  memories: MemoryView[];
  relationships: RelationshipView[];
}

export function viewSocialActor(
  world: World,
  _content: ContentBundle,
  actorId: ActorId,
  _opts: ViewOptions,
): SocialActorView {
  const name = (id: ActorId) => {
    const a = world.actors[id];
    return a ? displayName(a) : `#${id}`;
  };
  const table = world.social.opinions[actorId] ?? {};
  const opinions: OpinionView[] = [];
  for (const k of Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b)) {
    const op = table[k];
    if (!op) continue;
    const d = opinionOf(world, actorId, op.targetId);
    opinions.push({
      targetId: op.targetId,
      targetName: name(op.targetId),
      ...d,
      label: opinionLabel(d),
      reasons: op.reasons.map((r) => ({ label: r.label, ...r.delta, since: r.since })),
    });
  }
  const memories = memoriesOf(world, actorId).map((m) => ({
    id: m.id,
    kind: m.kind,
    summary: m.summary,
    at: m.at,
    emotion: m.emotion,
    intensity: m.intensity,
    salience: m.salience,
    source: m.source.kind,
  }));
  const relationships = relationshipsOf(world, actorId).map((r) => {
    const mine = r.a === actorId;
    const other = mine ? r.b : r.a;
    const directed = ['parent', 'employer', 'creditor', 'patron', 'lodger'].includes(r.kind);
    const label = directed ? (mine ? `${r.kind} of` : `${r.kind}: has`) : r.kind;
    return { otherId: other, otherName: name(other), label };
  });
  return { opinions, memories, relationships };
}

export function socialDailyStats(_world: World, _content: ContentBundle): Record<string, number> {
  return {};
}
