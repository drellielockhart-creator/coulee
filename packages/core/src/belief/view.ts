/**
 * Belief view parts. OWNER: module:belief. Contract with module:web (see needs/view.ts note).
 * P1: an actor's beliefs are visible to themselves (perspective) and in god view; others
 * see only what is public (voiced beliefs) — module:belief enforces this.
 */
import type { ContentBundle } from '../content.ts';
import type { ActorId } from '../ids.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';
import { propText } from './api.ts';

export interface BeliefView {
  id: number;
  text: string;
  /** 0..100 */
  credence: number;
  evidenceCount: number;
  voiced: boolean;
  conceal: boolean;
}

export interface GrudgeView {
  id: number;
  targetLabel: string;
  intensity: number;
  aim: string;
  founding: string[];
}

export interface BeliefActorView {
  beliefs: BeliefView[];
  grudges: GrudgeView[];
}

export interface FigureView {
  id: number;
  name: string;
  notoriety: number;
}

export interface BeliefGlobalView {
  figures: FigureView[];
  /** Escalation processes (rung 0..3) visible to the viewer. */
  persecutions: Array<{ targetLabel: string; rung: number; heat: number; consensus: number }>;
  misfortune: number;
}

export function viewBeliefActor(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  opts: ViewOptions,
): BeliefActorView {
  const mayView = opts.perspective === null || opts.perspective === actorId || opts.omniscient === true;
  const beliefs: BeliefView[] = [];
  for (const id of world.belief.beliefsByHolder[actorId] ?? []) {
    const b = world.belief.beliefs[id];
    if (!b || (!mayView && !b.voiced)) continue;
    beliefs.push({
      id: b.id,
      text: propText(world, content, b.propId),
      credence: b.credence,
      evidenceCount: b.evidence.length,
      voiced: b.voiced,
      conceal: b.conceal,
    });
  }
  const grudges: GrudgeView[] = [];
  for (const g of Object.values(world.belief.grudges)) {
    if (g.holderId !== actorId || (!mayView && !g.public)) continue;
    const t = g.target;
    const targetLabel =
      t.kind === 'actor'
        ? (world.actors[t.id]?.name.given ?? '?') + ' ' + (world.actors[t.id]?.name.family ?? '')
        : t.kind === 'household'
          ? (world.households[t.id]?.name ?? '?')
          : (world.belief.figures[t.id]?.name ?? '?');
    grudges.push({
      id: g.id,
      targetLabel: targetLabel.trim(),
      intensity: g.intensity,
      aim: g.aim,
      founding: g.founding.map((f) => f.label),
    });
  }
  return { beliefs, grudges };
}

export function viewBeliefGlobal(world: World, _content: ContentBundle, _opts: ViewOptions): BeliefGlobalView {
  return {
    figures: Object.values(world.belief.figures).map((f) => ({ id: f.id, name: f.name, notoriety: f.notoriety })),
    persecutions: [],
    misfortune: world.belief.misfortune,
  };
}

export function beliefDailyStats(_world: World, _content: ContentBundle): Record<string, number> {
  return {};
}
