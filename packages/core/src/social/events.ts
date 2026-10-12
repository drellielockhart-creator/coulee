/**
 * Social events. OWNER: module:social.
 */
import type { EventOf } from '../events/base.ts';
import type { ActorId, ItemId, MemoryId, PlaceId } from '../ids.ts';

export type SocialEvent =
  | EventOf<'social.act_refused', { actorId: ActorId; reason: string }>
  | EventOf<'social.requested', { requestId: string; actorId: ActorId; from: ActorId; text: string }>
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
        /** An item-specific act's item (13 §6.1): the chronicle keys charm stories by it. */
        itemId?: ItemId;
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
  | EventOf<'social.reconciled', { aId: ActorId; bId: ActorId; mediatorId: ActorId | null }>
  // ---- object loans (13 §6.1 steps 5-7) ----
  /** A thing lent on terms: a promise with a due date. */
  | EventOf<
      'social.loan_opened',
      { loanId: string; itemId: ItemId; lenderId: ActorId; borrowerId: ActorId; dueAt: number; text: string }
    >
  /** Returned (on time or late), reclaimed, or lost. */
  | EventOf<
      'social.loan_closed',
      {
        loanId: string;
        itemId: ItemId;
        lenderId: ActorId;
        borrowerId: ActorId;
        status: 'returned' | 'reclaimed' | 'lost';
        late: boolean;
        text: string;
      }
    >
  /** The due day passed and it was not brought back: a remembered breach, not a theft verdict. */
  | EventOf<
      'social.loan_breached',
      { loanId: string; itemId: ItemId; lenderId: ActorId; borrowerId: ActorId; text: string }
    >
  /** An item act refused before any time is spent (validation), with its reason. */
  | EventOf<'social.item_refused', { actorId: ActorId; itemId: ItemId; interactionId: string; reason: string }>;
