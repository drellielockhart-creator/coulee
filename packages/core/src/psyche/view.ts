/**
 * Psyche view part. OWNER: module:psyche. Contract with module:web (see needs/view.ts note).
 * P1: inner states are 'self' knowledge — show them only for the perspective actor or in
 * god view (opts.perspective === null) / omniscient.
 */
import type { ContentBundle } from '../content.ts';
import type { Explain } from '../explain.ts';
import type { ActorId } from '../ids.ts';
import { urgeLabel } from '../urge.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';

export interface ThoughtView {
  id: number;
  /** 'id' | 'superego' | 'command' — the UI colors by voice (period labels allowed). */
  voice: string;
  label: string;
  intensity: number;
  urge: string;
  ageMinutes: number;
}

export interface PsycheActorView {
  /** False when the viewer may not see this mind (P1); all fields are then empty/zero. */
  visible: boolean;
  ego: number;
  superego: number;
  idAppetite: number;
  anxiety: number;
  thoughts: ThoughtView[];
  chosen: { urge: string; voice: string; compromise: boolean; explain: Explain | null } | null;
  recentDefenses: Array<{ defense: string; at: number; targetId: ActorId | null }>;
  persona: string | null;
  shadow: string[];
}

export function canSeeMind(opts: ViewOptions, actorId: ActorId): boolean {
  return opts.perspective === null || opts.perspective === actorId || opts.omniscient === true;
}

/**
 * Defense labels and the Shadow are hidden even from the actor themself (10 §1, §8.5): they
 * are 'omniscient' until Insight. Only god view / the epilogue sees them (psyche refines by insight tier).
 */
export function canSeeUnconscious(opts: ViewOptions): boolean {
  return opts.perspective === null || opts.omniscient === true;
}

export function viewPsycheActor(
  world: World,
  _content: ContentBundle,
  actorId: ActorId,
  opts: ViewOptions,
): PsycheActorView {
  const p = world.psyche.byActor[actorId];
  if (!p || !canSeeMind(opts, actorId)) {
    return {
      visible: false,
      ego: 0,
      superego: 0,
      idAppetite: 0,
      anxiety: 0,
      thoughts: [],
      chosen: null,
      recentDefenses: [],
      persona: p?.persona ?? null,
      shadow: [],
    };
  }
  return {
    visible: true,
    ego: p.ego,
    superego: p.superego,
    idAppetite: p.idAppetite,
    anxiety: p.anxiety,
    thoughts: p.thoughts.map((t) => ({
      id: t.id,
      voice: t.voice,
      label: t.label,
      intensity: t.intensity,
      urge: urgeLabel(t.urge),
      ageMinutes: world.time - t.bornAt,
    })),
    chosen: p.chosen
      ? {
          urge: urgeLabel(p.chosen.urge),
          voice: p.chosen.voice,
          compromise: p.chosen.compromise,
          explain: opts.includeExplain ? p.chosen.explain : null,
        }
      : null,
    recentDefenses: canSeeUnconscious(opts)
      ? p.recentDefenses.map((d) => ({ defense: d.defense, at: d.at, targetId: d.targetId }))
      : [],
    persona: p.persona,
    shadow: canSeeUnconscious(opts) ? [...p.shadow] : [],
  };
}

export function psycheDailyStats(_world: World, _content: ContentBundle): Record<string, number> {
  return {};
}
