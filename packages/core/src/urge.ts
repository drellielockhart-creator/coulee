/**
 * Urges: what a mind wants to do next. FOUNDATION-OWNED contract.
 *
 * Flow each hour (see docs/impl/MODULES.md "System order"):
 *   1. Modules PROPOSE urges for an actor (`UrgeProposal`), each voiced by the Id
 *      (appetite, impulse, fear) or the Superego (duty, conscience, norms).
 *      Player Commands become proposals with voice 'command' (P2: same arbitration path).
 *   2. psyche turns proposals into Thoughts and the Ego arbitrates -> one `ChosenUrge`
 *      per actor, stored in world.psyche and read via psyche/api.ts `chosenUrge()`.
 *   3. activity consumes kind 'activity' (falls back to the schedule if none);
 *      social consumes kind 'interaction' and 'defense' urges that target someone.
 */
import type { ActivityId, DefenseId, InteractionId } from './content.ts';
import type { Explain, ExplainTerm } from './explain.ts';
import type { ActorId, ItemId, PlaceId, PropId, ThoughtId } from './ids.ts';
import type { GameMinute } from './time.ts';

/**
 * What an item-specific interaction proposes (13 §6.1): integers and closed strings only, so
 * `sameUrge` compares them field by field and they replay exactly through `core.command`.
 */
export type Terms =
  | { kind: 'loan'; dueAt: GameMinute; use: 'household' | 'any'; depositCents: number; rechargeDuty: boolean }
  | { kind: 'sale'; priceCents: number }
  | { kind: 'gift' };

export type Urge =
  /** Do an activity (optionally at a specific place instead of the activity's default), optionally with an item. */
  | { kind: 'activity'; activityId: ActivityId; placeId?: PlaceId; itemId?: ItemId }
  /** Initiate a social interaction (optionally with a target, a topic proposition, an item and terms). */
  | {
      kind: 'interaction';
      interactionId: InteractionId;
      targetId?: ActorId;
      topic?: PropId;
      itemId?: ItemId;
      terms?: Terms;
    }
  /** A defense mechanism discharging anxiety (P7), possibly aimed at someone. */
  | { kind: 'defense'; defense: DefenseId; targetId?: ActorId };

export type UrgeKind = Urge['kind'];

/** The two voices of P7; 'command' is the player's will entering through Commands. */
export type Voice = 'id' | 'superego';
export type ChoiceVoice = Voice | 'ego' | 'command';

/** Module ids that may propose urges (also used to tag sources in Explain). */
export type ModuleId =
  | 'fae'
  | 'core'
  | 'needs'
  | 'activity'
  | 'psyche'
  | 'social'
  | 'belief'
  | 'provisions'
  | 'chronicle';

export interface UrgeProposal {
  urge: Urge;
  voice: Voice | 'command';
  /**
   * 0..1000 strength before psyche weighting. (10-psyche.md uses 0..100: read its
   * intensities ×10.) 'command' proposals must always win arbitration (10 §5.5).
   */
  intensity: number;
  /** Short label for the thought: "Hungry: eat something", "The forge won't tend itself". */
  label: string;
  source: ModuleId;
  /** Why (named integer terms summing to intensity), for the Explain. */
  reasons: ExplainTerm[];
  /** Id drive this voices ('hunger', 'sloth', 'fear', 'longing'... — 10 §3.2), if any. */
  drive?: string;
  /** Superego norm this voices ('piety', 'duty', 'shame'... — 10 §3.3), if any. */
  norm?: string;
  /** Voiced speaker for superego thoughts ("Mother:", "Pastor Tveit:" — 10 §4.3), if any. */
  speaker?: string;
}

export interface ChosenUrge {
  urge: Urge;
  voice: ChoiceVoice;
  /** The winning thought, if it came from one. */
  thoughtId?: ThoughtId;
  /** True when the ego found a compromise/sublimation rather than a straight win. */
  compromise: boolean;
  /** When this choice was made. */
  at: GameMinute;
  /** The arbitration: each candidate as a child with its score (knowledge 'self'). */
  explain: Explain;
}

export function sameUrge(a: Urge, b: Urge): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'activity':
      return b.kind === 'activity' && a.activityId === b.activityId && a.placeId === b.placeId && a.itemId === b.itemId;
    case 'interaction':
      return (
        b.kind === 'interaction' &&
        a.interactionId === b.interactionId &&
        a.targetId === b.targetId &&
        a.topic === b.topic &&
        a.itemId === b.itemId &&
        sameTerms(a.terms, b.terms)
      );
    case 'defense':
      return b.kind === 'defense' && a.defense === b.defense && a.targetId === b.targetId;
  }
}

/** Terms compared field by field (13 §6.1). */
export function sameTerms(a: Terms | undefined, b: Terms | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  switch (a.kind) {
    case 'loan':
      return (
        b.kind === 'loan' &&
        a.dueAt === b.dueAt &&
        a.use === b.use &&
        a.depositCents === b.depositCents &&
        a.rechargeDuty === b.rechargeDuty
      );
    case 'sale':
      return b.kind === 'sale' && a.priceCents === b.priceCents;
    case 'gift':
      return b.kind === 'gift';
  }
}

/** A compact, stable label for terms: `loan@<due>/<use>/<deposit>/<duty>`, `sale@<cents>`, `gift`. */
export function termsLabel(t: Terms): string {
  switch (t.kind) {
    case 'loan':
      return `loan@${t.dueAt}/${t.use}/${t.depositCents}/${t.rechargeDuty ? 1 : 0}`;
    case 'sale':
      return `sale@${t.priceCents}`;
    case 'gift':
      return 'gift';
  }
}

export function urgeLabel(u: Urge): string {
  switch (u.kind) {
    case 'activity':
      return `activity:${u.activityId}${u.itemId !== undefined ? `:item${u.itemId}` : ''}`;
    case 'interaction':
      return `interaction:${u.interactionId}${u.targetId !== undefined ? `->${u.targetId}` : ''}${u.itemId !== undefined ? `:item${u.itemId}` : ''}${u.terms !== undefined ? `:${termsLabel(u.terms)}` : ''}`;
    case 'defense':
      return `defense:${u.defense}${u.targetId !== undefined ? `->${u.targetId}` : ''}`;
  }
}
