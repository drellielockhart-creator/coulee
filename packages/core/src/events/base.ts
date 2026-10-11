/**
 * Event log building blocks. FOUNDATION-OWNED.
 *
 * REGISTRY PATTERN (so parallel module agents never edit one shared file):
 *   - Each module declares its own union in `src/<module>/events.ts`:
 *       export type SocialEvent =
 *         | EventOf<'social.interaction', { interactionId: string; success: boolean }>
 *         | EventOf<'social.memory_formed', { ... }>;
 *   - `src/events/index.ts` (foundation) unions the per-module unions into `Event`.
 *     It already imports every module's union, so adding a kind = editing only your file.
 *   - Kinds are namespaced '<module>.<snake_case>' so they never collide.
 *   - Payloads (`data`) are plain JSON data with integer numbers.
 */
import type { Explain } from '../explain.ts';
import type { ActorId, EventId, PlaceId } from '../ids.ts';
import type { GameMinute } from '../time.ts';

/** 07 §3.4 roles of actors in an event. */
export type EventRoleKind =
  | 'agent'
  | 'patient'
  | 'target'
  | 'witness'
  | 'beneficiary'
  | 'victim'
  | 'subject'
  | 'speaker'
  | 'listener'
  | 'participant';

export interface EventRole {
  actor: ActorId;
  role: EventRoleKind;
}

/**
 * Who could know the event happened (P1). Ground truth always lives in the log; the UI and
 * the chronicle filter by visibility + roles + perspective.
 * - public: anyone present or who would hear (a sermon, a fight in the street)
 * - witnessed: participants and listed witnesses
 * - private: participants only
 * - secret: only the agent (a curse, a theft unseen); omniscient epilogue only for others
 * - inner: a mind event (thought, arbitration, defense) — the actor's own, never perceived
 */
export type Visibility = 'public' | 'witnessed' | 'private' | 'secret' | 'inner';

export interface EventBase {
  id: EventId;
  /** Game minute it happened (defaults to the start of the hour being simulated). */
  t: GameMinute;
  roles: EventRole[];
  place?: PlaceId;
  visibility: Visibility;
  /** 0..100 base notability (chronicle/director); omit for routine events. */
  importance?: number;
  /** Explicit causal links where the sim knows them (05 §9.1). */
  causes?: EventId[];
  /** The math behind it (P1). */
  explain?: Explain;
}

/** Define one event kind: `EventOf<'provisions.meal_eaten', { ... }>`. */
export type EventOf<K extends string, D> = EventBase & { kind: K; data: D };

/** Distributive helper: omit fields across each member of a union. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
