/**
 * Item events (generic movement/creation). OWNER: module:provisions.
 * Food-specific events (meals, spoilage) live in provisions/events.ts.
 */
import type { EventOf } from '../events/base.ts';
import type { ItemId } from '../ids.ts';
import type { ItemLocation } from './state.ts';

export type ItemsEvent =
  | EventOf<'items.created', { itemId: ItemId; defId: string; qty: number; location: ItemLocation }>
  | EventOf<'items.moved', { itemId: ItemId; defId: string; qty: number; from: ItemLocation; to: ItemLocation }>
  | EventOf<'items.consumed', { itemId: ItemId; defId: string; qty: number; reason: string }>;
