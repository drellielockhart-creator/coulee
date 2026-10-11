/**
 * Provisions commands (player provisioning verbs, P8). OWNER: module:provisions.
 * NPCs do the same things through urges/activities — no player-only rule paths.
 */
import type { CommandOf } from '../command.ts';
import type { HouseholdId, ItemId, PlaceId } from '../ids.ts';

export type ProvisionsCommand =
  | CommandOf<'provisions.board_meal', Record<string, never>>
  | CommandOf<'provisions.drink', { ml: number }>
  | CommandOf<'provisions.sell', { placeId: PlaceId; itemId: ItemId; qty: number }>
  | CommandOf<'provisions.buy', { placeId: PlaceId; defId: string; qty: number; onCredit: boolean }>
  | CommandOf<'provisions.eat', { itemId: ItemId; method: string; servings: number }>
  | CommandOf<'provisions.set_rations', { householdId: HouseholdId | null; rationPct: number }>
  | CommandOf<'provisions.pack', { itemId: ItemId; qty: number; intoItemId: ItemId | null }>;
