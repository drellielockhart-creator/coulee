/**
 * Belief view parts. OWNER: module:belief. Contract with module:web (see needs/view.ts note).
 * P1: an actor's beliefs are visible to themselves (perspective) and in god view; others
 * see only what is public (voiced beliefs) — module:belief enforces this.
 */
import type { ContentBundle } from '../content.ts';
import { type ActorId, rowsOf } from '../ids.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';
import { propText } from './api.ts';
import { targetLabel } from './misfortune.ts';

export interface BeliefView {
  id: number;
  text: string;
  /** A claim with its provenance, for fair presentations. */
  account?: string;
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
    if (!b || !mayView) continue;
    const source = b.evidence.findLast((e) => e.sourceId !== null)?.sourceId;
    const teller = source == null ? undefined : world.actors[source];
    const claim = propText(world, content, b.propId);
    const account = teller
      ? `Heard from ${teller.name.given} ${teller.name.family} that ${claim}`
      : `${b.credence >= 50 ? 'Believes' : 'Suspects'} that ${claim}`;
    beliefs.push({
      id: b.id,
      text: claim,
      ...(!opts.omniscient && opts.perspective !== null ? { account } : {}),
      credence: b.credence,
      evidenceCount: b.evidence.length,
      voiced: b.voiced,
      conceal: b.conceal,
    });
  }
  const grudges: GrudgeView[] = [];
  for (const g of rowsOf(world.belief.grudges)) {
    if (g.holderId !== actorId || !mayView) continue;
    const t = g.target;
    const targetLabel =
      t.kind === 'actor'
        ? (world.actors[t.id]?.name.given ?? '?') + ' ' + (world.actors[t.id]?.name.family ?? '')
        : t.kind === 'household'
          ? (world.households[t.id]?.name ?? '?')
          : t.kind === 'figure'
            ? (world.belief.figures[t.id]?.name ?? '?')
            : 'an unknown hand';
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
  const full = _opts.omniscient || _opts.perspective === null;
  const knownFigures = new Set<number>();
  for (const id of world.belief.beliefsByHolder[_opts.perspective ?? -1] ?? []) {
    const b = world.belief.beliefs[id];
    for (const arg of (b ? world.belief.props[b.propId]?.args : []) ?? [])
      if (arg.kind === 'figure') knownFigures.add(arg.id);
  }
  return {
    figures: rowsOf(world.belief.figures)
      .filter((f) => full || knownFigures.has(f.id))
      .map((f) => ({ id: f.id, name: f.name, notoriety: full ? f.notoriety : 0 })),
    persecutions: world.belief.persecutions
      .filter(
        (p) =>
          _opts.omniscient ||
          _opts.perspective === null ||
          (_opts.perspective !== null &&
            p.charges.some((id) =>
              (world.belief.beliefsByHolder[_opts.perspective ?? -1] ?? []).some(
                (bid) => world.belief.beliefs[bid]?.propId === id,
              ),
            )),
      )
      .map((p) => ({
        targetLabel: targetLabel(world, p.target),
        rung: p.rung,
        heat: full ? p.heat : 0,
        consensus: full ? p.consensus : 0,
      })),
    misfortune: full ? world.belief.misfortune : 0,
  };
}

export function beliefDailyStats(_world: World, _content: ContentBundle): Record<string, number> {
  return {
    belief_count: rowsOf(_world.belief.beliefs).length,
    belief_rumors: rowsOf(_world.belief.rumors).length,
    belief_grudges: rowsOf(_world.belief.grudges).filter((g) => g.intensity > 0).length,
    belief_misfortune: _world.belief.misfortune,
    belief_max_rung: Math.max(0, ..._world.belief.persecutions.map((p) => p.rung)),
  };
}
