import type { EventOf } from '../events/base.ts';
import type { ActorId } from '../ids.ts';
export type TacticalEvent =
  | EventOf<'tactical.blow', { actorId: ActorId; targetId: ActorId; hit: boolean; damage: number; text: string }>
  | EventOf<'tactical.grapple', { actorId: ActorId; targetId: ActorId; text: string }>
  | EventOf<'tactical.submission', { actorId: ActorId; text: string }>
  | EventOf<
      'tactical.outcome',
      { episodeId: number; actorId: ActorId; targetId: ActorId; text: string; outcome: string }
    >
  | EventOf<'tactical.morale', { actorId: ActorId; text: string }>
  | EventOf<'tactical.danger', { sceneId: string; text: string; actorIds: ActorId[] }>
  | EventOf<'tactical.initiative', { actorId: ActorId; delay: number }>
  | EventOf<'tactical.action', { actorId: ActorId; action: string; phase: string; text: string }>
  | EventOf<'tactical.breathe', { text: string }>;
