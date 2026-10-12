import type { CommandOf } from '../command.ts';
import type { ActorId } from '../ids.ts';
export type NeedsCommand =
  | CommandOf<'needs.aid', { targetId: ActorId }>
  | CommandOf<'needs.retire', Record<string, never>>
  | CommandOf<'needs.depart', Record<string, never>>;
