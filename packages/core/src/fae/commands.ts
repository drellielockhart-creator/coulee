import type { CommandOf } from '../command.ts';
export type FaeCommand =
  | CommandOf<'fae.investigate', { signId: string }>
  | CommandOf<'fae.signs', Record<string, never>>;
