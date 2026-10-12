/**
 * Social events. OWNER: module:social.
 */
import type { EventOf } from '../events/base.ts';
import type { ActorId, MemoryId, PlaceId } from '../ids.ts';

export type SocialEvent =
  | EventOf<'social.act_refused', { actorId: ActorId; reason: string }>
  | EventOf<
      'social.requested',
      {
        requestId: string;
        actorId: ActorId;
        from: ActorId;
        text: string;
        // ---- additive (playtest r2: requests state their terms) ----
        interactionId?: string;
        /** What answering yes undertakes ('lend' | 'borrow' | 'proposal' | 'accept_favor' | 'disclose'). */
        response?: string;
        /** Money that would change hands, and favors that would be owed, on a yes. */
        cents?: number;
        favors?: number;
        /** When a money debt taken on a yes ought to be settled (game minute). */
        dueT?: number;
        /** The game minute the offer lapses. */
        until?: number;
      }
    >
  | EventOf<'social.request_answered', { requestId: string; actorId: ActorId; status: string }>
  /** An interaction resolved (04 §10). Explain carries the check. Witnesses in roles. */
  | EventOf<
      'social.interaction',
      {
        interactionId: string;
        initiatorId: ActorId;
        targetId: ActorId;
        placeId: PlaceId | null;
        success: boolean;
        /** Speech-bubble label (04 §11.1): "Gossip ▸ Kass widow", "Dun ▸ $4 flour". */
        label: string;
        /** The defense this act discharged (10 §7), when it was one (omniscient provenance). */
        viaDefense?: string;
        // ---- additive (playtest 2026-10-11: social verbs return content) ----
        /** What was said, as one display string: `Name: “...” Name: “...”`. */
        line?: string;
        /** What was said, turn by turn (1–3). Overhearable: never a rumor's content (that rides on belief.transmitted). */
        lines?: Array<{ speaker: string; speakerId: ActorId; text: string }>;
        /** A news-carrying act: whether anything was told (the words are on the belief.transmitted it caused). */
        told?: boolean;
        // ---- additive (playtest r2) ----
        /** The target was held from their work for it (at work, or due there): it cost a little regard. */
        atWork?: boolean;
        /** The money the act was about (a loan, a repayment), in cents. */
        cents?: number;
        /** What changed hands (a gift), by item definition id. */
        itemDefId?: string;
      }
    >
  /** A memory was encoded (inner; for debugging/inspect — keep rare or omit). */
  | EventOf<'social.memory_formed', { ownerId: ActorId; memoryId: MemoryId; kind: string; intensity: number }>
  /** A derived label changed (became Friend/Enemy/Rival...). Chronicle-worthy. */
  | EventOf<'social.label_changed', { holderId: ActorId; targetId: ActorId; from: string; to: string }>
  /**
   * A household or family quarrel came to blows `fights` times in the rupture window: the two
   * stop speaking for `days` (an `estranged` edge) unless someone mediates. Public: it is talked of.
   */
  | EventOf<'social.rupture', { aId: ActorId; bId: ActorId; fights: number; household: boolean; days: number }>
  /** A third party tried to talk an estranged pair round (Explain = the skill check). */
  | EventOf<'social.mediation', { mediatorId: ActorId; aId: ActorId; bId: ActorId; success: boolean }>
  /** An estrangement ended: by mediation (mediatorId) or by time (null). */
  | EventOf<'social.reconciled', { aId: ActorId; bId: ActorId; mediatorId: ActorId | null }>;
