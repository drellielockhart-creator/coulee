import type { CommandOf } from '../command.ts';
export type TacticalCommand =
  | CommandOf<'tactical.move', { x: number; y: number }>
  | CommandOf<'tactical.guard', Record<string, never>>
  | CommandOf<'tactical.cancel', Record<string, never>>
  | CommandOf<'tactical.advance', { ticks: number }>
  | CommandOf<'tactical.breathe', Record<string, never>>;
