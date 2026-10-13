import type { EventOf } from '../events/base.ts';
import type { ActorId } from '../ids.ts';
export type TacticalEvent =
  | EventOf<'tactical.danger', { sceneId: string; text: string; actorIds: ActorId[] }>
  | EventOf<'tactical.initiative', { actorId: ActorId; delay: number }>
  | EventOf<'tactical.action', { actorId: ActorId; action: string; phase: string; text: string }>
  | EventOf<'tactical.breathe', { text: string }>;
