/**
 * Psyche view part. OWNER: module:psyche. Contract with module:web (see needs/view.ts note).
 * P1: inner states are 'self' knowledge — show them only for the perspective actor or in
 * god view (opts.perspective === null) / omniscient. Another actor's mind is never shown
 * with a perspective set: only the public Persona (label and presented traits).
 * Defenses and the Shadow are unconscious (10 §1, §8.5): hidden from the self-view until
 * Insight reveals defenses of the matching maturity tier (1 immature, 2 neurotic, 3 mature)
 * and, from Insight 1, the Shadow.
 */
import type { ContentBundle } from '../content.ts';
import { type Explain, visibleExplain } from '../explain.ts';
import type { ActorId } from '../ids.ts';
import { type Urge, urgeLabel } from '../urge.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';
import { anxietyBand, BAND_LABELS } from './anxiety.ts';
import { TIER_RANK } from './defenses.ts';
import { presentedTraits } from './mind.ts';
import type { ActorPsyche } from './state.ts';

export interface ThoughtView {
  id: number;
  /** 'id' | 'superego' | 'command' — the UI colors by voice (period labels allowed). */
  voice: string;
  label: string;
  intensity: number;
  urge: string;
  ageMinutes: number;
  // ---- additive ----
  /** 'for' | 'against' | 'aside': against = a prohibition ("not the tavern"). */
  stance?: string;
  /** The voiced line: Id first person, Superego quoted from `speaker`. */
  line?: string;
  /** Who speaks a Superego line ("Mother", "the Pastor", "the neighbors"). */
  speaker?: string;
  /** Period label of its drive or norm ("Appetite", "Choler", "Temperance"). */
  periodLabel?: string;
  /** Defense that produced it, only when the viewer may know (Insight or god view). */
  maskedBy?: string;
  /** Named terms summing to `intensity` (only with includeExplain). */
  reasons?: Array<{ label: string; value: number }>;
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
  // ---- additive ----
  /** Period band of anxiety: Easy, Uneasy, Nervous, Harrowed, Breaking. */
  anxietyBand?: string;
  /** The three anxieties (self/god only). */
  anxietyPools?: { real: number; neur: number; moral: number };
  /** The Ego's verdict line and how it was reached ('plain', 'compromise', 'command'...). */
  verdict?: { label: string; mode: string } | null;
  /** Traits the Persona presents in public (visible to everyone). */
  presentedTraits?: string[];
  /** Insight tier 0..3 (self/god only). */
  insight?: number;
}

export function canSeeMind(opts: ViewOptions, actorId: ActorId): boolean {
  return opts.perspective === null || opts.perspective === actorId || opts.omniscient === true;
}

/**
 * Defense labels and the Shadow are hidden even from the actor themself (10 §1, §8.5): they
 * are 'omniscient' until Insight. Only god view / the epilogue sees them all.
 */
export function canSeeUnconscious(opts: ViewOptions): boolean {
  return opts.perspective === null || opts.omniscient === true;
}

/** May this viewer see a defense of this tier in `actorId`'s mind? God view, or self with Insight. */
export function canSeeDefense(opts: ViewOptions, actorId: ActorId, p: ActorPsyche, tier: string | undefined): boolean {
  if (canSeeUnconscious(opts)) return true;
  if (opts.perspective !== actorId) return false;
  return p.insight >= (tier !== undefined ? (TIER_RANK[tier] ?? 3) : 3);
}

/** May this viewer see the Shadow? God view, or self from Insight 1 ("the Shadow met"). */
export function canSeeShadow(opts: ViewOptions, actorId: ActorId, p: ActorPsyche): boolean {
  return canSeeUnconscious(opts) || (opts.perspective === actorId && p.insight >= 1);
}

export function viewPsycheActor(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  opts: ViewOptions,
): PsycheActorView {
  const p = world.psyche.byActor[actorId];
  const shown = world.actors[actorId] ? [...presentedTraits(world, actorId)] : [];
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
      presentedTraits: [...(p?.personaTraits ?? [])],
    };
  }
  const tierOf = (d: string) => content.defenses?.[d as keyof typeof content.defenses]?.tier;
  const thoughts: ThoughtView[] = [];
  for (const t of p.thoughts) {
    // A masked thought looks like an ordinary one (10 §4.3); only Insight adds the label.
    const masked = t.maskedBy !== undefined && canSeeDefense(opts, actorId, p, tierOf(t.maskedBy));
    const period =
      t.drive !== undefined
        ? content.drives?.[t.drive]?.period_label
        : t.norm !== undefined
          ? content.norms?.[t.norm]?.period_label
          : undefined;
    thoughts.push({
      id: t.id,
      voice: t.voice,
      label: t.label,
      intensity: t.intensity,
      urge: t.urge.kind === 'defense' && !masked ? '' : urgeLabel(t.urge),
      ageMinutes: world.time - t.bornAt,
      stance: t.stance ?? 'for',
      ...(t.line !== undefined ? { line: t.line } : {}),
      ...(t.speaker !== undefined && t.speaker !== '' ? { speaker: t.speaker } : {}),
      ...(period !== undefined ? { periodLabel: period } : {}),
      ...(masked && t.maskedBy !== undefined ? { maskedBy: t.maskedBy } : {}),
      ...(opts.includeExplain ? { reasons: t.reasons.map((r) => ({ label: r.label, value: r.value })) } : {}),
    });
  }
  const chosenIsDefense = p.chosen?.urge.kind === 'defense';
  const chosenDefenseVisible =
    chosenIsDefense && p.chosen?.urge.kind === 'defense'
      ? canSeeDefense(opts, actorId, p, tierOf(p.chosen.urge.defense))
      : true;
  return {
    visible: true,
    ego: p.ego,
    superego: p.superego,
    idAppetite: p.idAppetite,
    anxiety: p.anxiety,
    thoughts,
    chosen: p.chosen
      ? {
          urge: chosenDefenseVisible ? urgeLabel(p.chosen.urge) : hiddenDefenseLabel(p.chosen.urge),
          voice: p.chosen.voice,
          compromise: p.chosen.compromise,
          explain: opts.includeExplain ? visibleExplain(p.chosen.explain, opts.perspective, opts.omniscient) : null,
        }
      : null,
    recentDefenses: p.recentDefenses
      .filter((d) => canSeeDefense(opts, actorId, p, tierOf(d.defense)))
      .map((d) => ({ defense: d.defense, at: d.at, targetId: d.targetId })),
    persona: p.persona,
    shadow: canSeeShadow(opts, actorId, p) ? [...p.shadow] : [],
    anxietyBand: BAND_LABELS[anxietyBand(p.anxiety)] ?? 'Easy',
    anxietyPools: { ...p.anxSrc },
    verdict:
      p.chosen && visibleExplain(p.chosen.explain, opts.perspective, opts.omniscient)
        ? { label: p.chosen.explain.label, mode: p.lastMode }
        : null,
    presentedTraits: shown,
    insight: p.insight,
  };
}

/** What the actor experiences when a defense took the hour: an impulse at someone, unlabeled. */
function hiddenDefenseLabel(u: Urge): string {
  return u.kind === 'defense' && u.targetId !== undefined ? `impulse->${u.targetId}` : 'impulse';
}

/** stats.csv columns (same keys every day). */
export function psycheDailyStats(world: World, _content: ContentBundle): Record<string, number> {
  let n = 0;
  let sum = 0;
  let max = 0;
  let chosen = 0;
  let thoughts = 0;
  for (const id of Object.keys(world.psyche.byActor)) {
    const p = world.psyche.byActor[Number(id)];
    const a = world.actors[Number(id)];
    if (!p || !a?.alive) continue;
    n++;
    sum += p.anxiety;
    max = Math.max(max, p.anxiety);
    if (p.chosen) chosen++;
    thoughts += p.thoughts.length;
  }
  const c = world.psyche.counters;
  return {
    psyche_anxiety_mean: n > 0 ? Math.floor(sum / n) : 0,
    psyche_anxiety_max: max,
    psyche_chosen_pct: n > 0 ? Math.floor((chosen * 100) / n) : 0,
    psyche_thoughts_mean: n > 0 ? Math.floor(thoughts / n) : 0,
    psyche_defenses_total: c.defenses ?? 0,
    psyche_compromises_total: c.compromises ?? 0,
    psyche_sublimations_total: c.sublimations ?? 0,
  };
}
