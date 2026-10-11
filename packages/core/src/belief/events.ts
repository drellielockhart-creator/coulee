/**
 * Belief events. OWNER: module:belief.
 */
import type { EventOf } from '../events/base.ts';
import type { ActorId, BeliefId, PropId, RumorId } from '../ids.ts';

export type BeliefEvent =
  | EventOf<'belief.catalyst', { actorId: ActorId; rung: number; takesStep: boolean }>
  | EventOf<'belief.evidence', { holderId: ActorId; propId: PropId; before: number; credence: number }>
  | EventOf<'belief.decayed', { holderId: ActorId; propId: PropId; before: number; credence: number }>
  | EventOf<'belief.misfortune', { misfortuneId: number; kindId: string; text: string }>
  | EventOf<'belief.attributed', { misfortuneId: number; holderId: ActorId; target: string; sharePermille: number }>
  | EventOf<'belief.tell', { targetId: ActorId; tellId: string; noticed: boolean }>
  | EventOf<'belief.figure_attached', { figureId: number; actorId: ActorId; consensus: number }>
  | EventOf<'belief.revealed', { actorId: ActorId; propId: PropId; consensus: number }>
  | EventOf<'belief.grudge_changed', { grudgeId: number; before: number; intensity: number; reason: string }>

  /** An actor formed a new belief (credence crossed 50 or first heard). */
  | EventOf<'belief.formed', { holderId: ActorId; beliefId: BeliefId; propId: PropId; credence: number; text: string }>
  /** Gossip transmitted a rumor variant (04 §8.3). `mutation` non-null if it changed in the telling. */
  | EventOf<
      'belief.transmitted',
      {
        speakerId: ActorId;
        listenerId: ActorId;
        rumorId: RumorId;
        propId: PropId;
        mutation: string | null;
        accepted: boolean;
      }
    >
  /** A grudge was formed (04 §6.3). Chronicle-worthy. */
  | EventOf<'belief.grudge_formed', { holderId: ActorId; target: string; intensity: number; aim: string }>
  /** The escalation ladder moved (04 §9.2). Chronicle-worthy. */
  | EventOf<'belief.escalation', { target: string; from: number; to: number; heat: number; consensus: number }>;
