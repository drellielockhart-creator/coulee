import type { CommandOf } from '../command.ts';
import type { ActorId } from '../ids.ts';
export type TacticalCommand =
  | CommandOf<'tactical.attack', { targetId: ActorId }>
  | CommandOf<'tactical.grapple', { targetId: ActorId }>
  | CommandOf<'tactical.accept', { targetId: ActorId }>
  | CommandOf<'tactical.stabilize', { targetId: ActorId }>
  | CommandOf<'tactical.escape', Record<string, never>>
  | CommandOf<'tactical.yield', Record<string, never>>
  | CommandOf<'tactical.parley', Record<string, never>>
  | CommandOf<'tactical.flee', Record<string, never>>
  | CommandOf<'tactical.reaction', { count: number }>
  | CommandOf<'tactical.move', { x: number; y: number }>
  | CommandOf<'tactical.guard', Record<string, never>>
  | CommandOf<'tactical.cancel', Record<string, never>>
  | CommandOf<'tactical.advance', { ticks: number }>
  | CommandOf<'tactical.breathe', Record<string, never>>;
