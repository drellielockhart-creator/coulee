/**
 * Social view part. OWNER: module:social. Contract with module:web (see needs/view.ts note).
 *
 * P1 privacy (04 §12.1, §3.6). DOCUMENTED CHOICE:
 * - Full view (numbers, every reason, memories) when the viewer is the actor itself
 *   (`perspective === actorId`), the god/debug view (`perspective === null`), or the
 *   omniscient epilogue.
 * - Any other viewer sees: no memories (they are private); of the actor's opinions, only
 *   the one toward the viewer, as a LABEL ('Friend', 'Enemy'...) with numbers zeroed
 *   (`numbersKnown: false`) and only the reasons the viewer was present for (the reason
 *   cites a memory of an event the viewer also remembers); structural relationships
 *   (public facts) stay visible.
 * - Defense provenance (`viaDefense`) is shown only to the omniscient epilogue (04 §3.6).
 */
import { displayName } from '../actor.ts';
import type { ContentBundle } from '../content.ts';
import type { ActorId, EventId } from '../ids.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';
import { memoriesOf, relationshipsOf } from './api.ts';
import { isZeroDims } from './model.ts';
import { opinionOf, reasonContribution, reasonStrength } from './opinion.ts';
import type { Opinion } from './state.ts';

export interface OpinionReasonView {
  label: string;
  affection: number;
  respect: number;
  trust: number;
  fear: number;
  since: number;
  /** Current weight 0..1000 (cited memory salience / belief credence ×10). Additive field. */
  weight?: number;
  /** The defense that made this reason; omniscient view only. Additive field. */
  viaDefense?: string;
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
  /** False when the viewer may only infer the label (numbers are zeroed). Additive field. */
  numbersKnown?: boolean;
  /** Familiarity 0..1000 (full view only). Additive field. */
  familiarity?: number;
  /** Ledger: positive = the target owes this actor (full view only). Additive field. */
  owedCents?: number;
  owedFavors?: number;
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
  reliefObligations?: ReliefObligationView[];
  opinions: OpinionView[];
  memories: MemoryView[];
  relationships: RelationshipView[];
}

const DIRECTED: Record<string, string> = {
  parent: 'child of',
  employer: 'employed by',
  creditor: 'in debt to',
  patron: 'client of',
  lodger: 'host of',
};

export function viewSocialActor(
  world: World,
  _content: ContentBundle,
  actorId: ActorId,
  opts: ViewOptions,
): SocialActorView {
  const name = (id: ActorId) => {
    const a = world.actors[id];
    return a ? displayName(a) : `#${id}`;
  };
  const viewer = opts.perspective;
  const full = opts.omniscient || viewer === null || viewer === actorId;
  const table = world.social.opinions[actorId] ?? {};
  const opinions: OpinionView[] = [];

  // Events the viewer remembers: reasons citing memories of those events are "known".
  let viewerEvents: Set<number> | null = null;
  if (!full && viewer !== null) {
    viewerEvents = new Set<number>();
    for (const m of memoriesOf(world, viewer)) if (m.eventId !== null) viewerEvents.add(m.eventId as number);
  }
  const eventOfCite = (op: Opinion, i: number): EventId | null => {
    const c = op.reasons[i]?.cites;
    if (c?.kind !== 'memory') return null;
    return world.social.memories[c.id]?.eventId ?? null;
  };

  for (const k of Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b)) {
    const op = table[k];
    if (!op) continue;
    if (!full && op.targetId !== viewer) continue;
    const d = opinionOf(world, actorId, op.targetId);
    const reasons: OpinionReasonView[] = [];
    for (let i = 0; i < op.reasons.length; i++) {
      const r = op.reasons[i];
      if (!r) continue;
      if (!full) {
        const ev = eventOfCite(op, i);
        if (ev === null || !viewerEvents?.has(ev as number)) continue;
      }
      // A Reason whose weight has faded to nothing explains nothing: hide it.
      if (full && isZeroDims(reasonContribution(world, actorId, op.targetId, r))) continue;
      const view: OpinionReasonView = {
        label: r.label,
        ...(full ? r.delta : { affection: 0, respect: 0, trust: 0, fear: 0 }),
        since: r.since,
      };
      if (full) view.weight = reasonStrength(world, actorId, op.targetId, r);
      if (opts.omniscient && r.viaDefense !== undefined) view.viaDefense = r.viaDefense;
      reasons.push(view);
    }
    const ov: OpinionView = full
      ? {
          targetId: op.targetId,
          targetName: name(op.targetId),
          ...d,
          label: op.label,
          reasons,
          numbersKnown: true,
          familiarity: op.familiarity,
          owedCents: op.obligation.cents,
          owedFavors: op.obligation.favors,
        }
      : {
          targetId: op.targetId,
          targetName: name(op.targetId),
          affection: 0,
          respect: 0,
          trust: 0,
          fear: 0,
          label: op.label,
          reasons,
          numbersKnown: false,
        };
    opinions.push(ov);
  }
  const memories: MemoryView[] = full
    ? memoriesOf(world, actorId).map((m) => ({
        id: m.id,
        kind: m.kind,
        summary: m.summary,
        at: m.at,
        emotion: m.emotion,
        intensity: m.intensity,
        salience: m.salience,
        source: m.source.kind,
      }))
    : [];
  const relationships = relationshipsOf(world, actorId)
    .filter((r) => full || r.a === viewer || r.b === viewer)
    .map((r) => {
      const mine = r.a === actorId;
      const other = mine ? r.b : r.a;
      const inverse = DIRECTED[r.kind];
      const label =
        r.endedByDeath !== undefined
          ? 'widowed from'
          : inverse !== undefined
            ? mine
              ? `${r.kind} of`
              : inverse
            : r.kind;
      return { otherId: other, otherName: name(other), label };
    });
  const relief = reliefObligations(world, _content, actorId, opts);
  return { opinions, memories, relationships, ...(relief.length ? { reliefObligations: relief } : {}) };
}

/** stats.csv columns (the same keys every day). */
export function socialDailyStats(world: World, _content: ContentBundle): Record<string, number> {
  const d = world.social.daily;
  let memories = 0;
  for (const k of Object.keys(world.social.memoriesByOwner))
    memories += world.social.memoriesByOwner[Number(k)]?.length ?? 0;
  let opinions = 0;
  let friends = 0;
  let enemies = 0;
  for (const k of Object.keys(world.social.opinions)) {
    const table = world.social.opinions[Number(k)] ?? {};
    for (const j of Object.keys(table)) {
      const op = table[Number(j)];
      if (!op) continue;
      opinions++;
      if (op.label === 'Friend') friends++;
      if (op.label === 'Enemy') enemies++;
    }
  }
  return {
    social_interactions: d.interactions,
    social_checks: d.checks,
    social_hostile: d.hostile,
    social_gossip: d.gossip,
    social_told: d.told,
    social_defense_acts: d.defenses,
    social_encounter_work: d.encounterWork,
    social_memories: memories,
    social_opinions: opinions,
    social_friend_pairs: friends,
    social_enemy_pairs: enemies,
    social_relationships: world.social.relationships.length,
  };
}

export interface ReliefObligationView {
  officeId: string;
  name: string;
  keeperId: ActorId;
  favors: number;
}
/** Institutional counterparties survive a change of keeper; a household sees only its own account. */
export function reliefObligations(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  opts: Pick<ViewOptions, 'perspective' | 'omniscient'>,
): ReliefObligationView[] {
  const householdId = world.actors[actorId]?.householdId;
  const viewerHousehold = opts.perspective === null ? undefined : world.actors[opts.perspective]?.householdId;
  if (householdId === undefined || (!opts.omniscient && opts.perspective !== null && viewerHousehold !== householdId))
    return [];
  return (world.social.relief?.offices ?? []).flatMap((office) => {
    const favors = office.favors[householdId] ?? 0;
    return favors > 0
      ? [
          {
            officeId: office.id,
            name: content.reliefOffices[office.ruleId]?.name ?? office.ruleId,
            keeperId: office.keeperId,
            favors,
          },
        ]
      : [];
  });
}
