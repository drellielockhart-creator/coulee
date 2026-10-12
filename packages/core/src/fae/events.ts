import type { EventOf } from '../events/base.ts';
import type { ActorId, PlaceId } from '../ids.ts';
export type FaeEvent =
  | EventOf<'fae.refused', { actorId: ActorId; signId: string; reason: string }>
  | EventOf<
      'fae.omen',
      { signId: string; placeId: PlaceId; family: string; text: string; witnesses: ActorId[]; truth: 'fae' | 'mundane' }
    >
  | EventOf<'fae.investigated', { signId: string; actorId: ActorId; found: boolean; text: string }>
  | EventOf<'fae.read', { signId: string; actorId: ActorId; text: string }>;
