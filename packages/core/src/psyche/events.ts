/**
 * Psyche events. OWNER: module:psyche. Mind events use visibility 'inner'.
 */
import type { EventOf } from '../events/base.ts';
import type { ActorId, ThoughtId } from '../ids.ts';

export type PsycheEvent =
  /** A notable thought surfaced (do not log every routine thought). */
  | EventOf<
      'psyche.thought',
      { actorId: ActorId; thoughtId: ThoughtId; voice: string; label: string; intensity: number }
    >
  /** Ego arbitration result when it CHANGES the actor's course or is a real conflict. Explain attached. */
  | EventOf<
      'psyche.arbitrated',
      { actorId: ActorId; urge: string; voice: string; compromise: boolean; rejected: string[] }
    >
  /** A defense mechanism fired (P7: these drive scapegoating). Chronicle-worthy. */
  | EventOf<
      'psyche.defense',
      {
        actorId: ActorId;
        defense: string;
        targetId: ActorId | null;
        label: string;
        anxietyBefore: number;
        anxietyAfter: number;
      }
    >;
