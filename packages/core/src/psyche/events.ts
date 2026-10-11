/**
 * Psyche events. OWNER: module:psyche. Mind events use visibility 'inner'.
 * Payload fields after the first block of each kind are additive (module:psyche finish).
 */
import type { EventOf } from '../events/base.ts';
import type { ActorId, ThoughtId } from '../ids.ts';

export type PsycheEvent =
  /** A notable thought surfaced (do not log every routine thought). Explain: its weighting ('self'). */
  | EventOf<
      'psyche.thought',
      {
        actorId: ActorId;
        thoughtId: ThoughtId;
        voice: string;
        label: string;
        intensity: number;
        /** The voiced line ("I've half a mind to tell Asa Crane exactly what I think"). */
        line?: string;
        targetId?: ActorId;
      }
    >
  /** Ego arbitration result when it CHANGES the actor's course or is a real conflict. Explain attached. */
  | EventOf<
      'psyche.arbitrated',
      {
        actorId: ActorId;
        urge: string;
        voice: string;
        compromise: boolean;
        rejected: string[];
        /** 'plain' | 'command' | 'compromise' | 'sublimation' | 'impulse'. */
        mode?: string;
        /** The Ego's verdict line ("A quick bite, then back to it"). */
        label?: string;
      }
    >
  /**
   * A defense mechanism fired (P7: these drive scapegoating). Chronicle-worthy. Explain:
   * anxiety vs Θ, children = every candidate defense with style × fit; knowledge
   * 'omniscient' (defenses are unconscious until Insight, 10 §1).
   */
  | EventOf<
      'psyche.defense',
      {
        actorId: ActorId;
        defense: string;
        targetId: ActorId | null;
        label: string;
        anxietyBefore: number;
        anxietyAfter: number;
        /** The anxiety pool that triggered it ('real' | 'neur' | 'moral'). */
        pool?: string;
        relief?: number;
        /** Projection: the disowned trait pinned on the target. */
        trait?: string;
        /** The urge it set for the hour (urgeLabel), executed by social/activity. */
        act?: string;
        /** A trait acquired from the habit (style ≥ 70). */
        acquiredTrait?: string;
      }
    >;
