/**
 * Social events. OWNER: module:social.
 */
import type { EventOf } from '../events/base.ts';
import type { ActorId, MemoryId, PlaceId } from '../ids.ts';

export type SocialEvent =
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
      }
    >
  /** A memory was encoded (inner; for debugging/inspect — keep rare or omit). */
  | EventOf<'social.memory_formed', { ownerId: ActorId; memoryId: MemoryId; kind: string; intensity: number }>
  /** A derived label changed (became Friend/Enemy/Rival...). Chronicle-worthy. */
  | EventOf<'social.label_changed', { holderId: ActorId; targetId: ActorId; from: string; to: string }>;
