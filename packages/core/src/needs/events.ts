/**
 * Needs events. OWNER: module:needs-activities. Add kinds here ('needs.<snake_case>').
 */
import type { EventOf } from '../events/base.ts';
import type { ActorId } from '../ids.ts';

export type NeedsEvent =
  | EventOf<'needs.combat_health', { actorId: ActorId; text: string }>
  | EventOf<'needs.survival_check', { actorId: ActorId; cause: string; damage: number; vigor: number; wounds: number }>
  | EventOf<'needs.collapsed', { actorId: ActorId; cause: string }>
  | EventOf<'needs.recovered', { actorId: ActorId }>
  | EventOf<'needs.stasis', { actorId: ActorId; frozen: boolean }>
  | EventOf<'needs.died', { actorId: ActorId; cause: string; name: string }>
  | EventOf<'needs.death_discovered', { actorId: ActorId; cause: string; name: string }>
  | EventOf<'needs.funeral', { actorId: ActorId; name: string; attendees: ActorId[] }>
  | EventOf<'needs.aid', { actorId: ActorId; targetId: ActorId; success: boolean; waterMl: number; carried: boolean }>
  | EventOf<'needs.estate', { actorId: ActorId; heirId: ActorId; adopted: ActorId[] }>
  | EventOf<'needs.ending', { actorId: ActorId; type: 'retire' | 'depart' }>
  | EventOf<'needs.command_rejected', { actorId: ActorId; reason: string }>

  /** A need crossed into a different legible band (e.g. Peckish -> Hungry). */
  | EventOf<
      'needs.band_changed',
      { actorId: ActorId; needId: string; from: string; to: string; value: number; layer?: 'meter' | 'debt' }
    >
  /** Hunger satisfied by food (called from provisions via api.feed). */
  | EventOf<'needs.fed', { actorId: ActorId; kcal: number; before: number; after: number }>
  | EventOf<'needs.drank', { actorId: ActorId; ml: number; before: number; after: number }>
  | EventOf<
      'needs.changed',
      { actorId: ActorId; needId: string; before: number; after: number; delta: number; debt: number }
    >
  | EventOf<'needs.hearth', { placeId: import('../ids.ts').PlaceId; fuel: number; lit: boolean; temperatureF: number }>;
