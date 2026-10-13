/** Marginal purchase prices use real stock, with no daily demand reset or cash source. */
import type { ContentBundle } from '../content.ts';
import type { ItemId, PlaceId } from '../ids.ts';
import { atPlace, stacksDeep } from '../items/api.ts';
import type { World } from '../world.ts';
import { saleQuote } from './api.ts';

export function pieceRate(world: World, content: ContentBundle, placeId: PlaceId, defId: string) {
  const tags = world.places[placeId]?.tags ?? [];
  return Object.values(content.pieceRates ?? {})
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .find((r) => r.item === defId && tags.includes(r.store_tag));
}
export function pieceStock(world: World, placeId: PlaceId, defId: string): number {
  return stacksDeep(world, atPlace(placeId)).reduce((n, { stack }) => n + (stack.defId === defId ? stack.qty : 0), 0);
}

/** Whole transaction quote. Each additional unit fills demand before the next is priced. */
export function saleTotal(
  world: World,
  content: ContentBundle,
  placeId: PlaceId,
  itemId: ItemId,
  qty: number,
): number | null {
  if (!Number.isSafeInteger(qty) || qty < 1) return null;
  const stack = world.items.stacks[itemId];
  if (!stack || qty > stack.qty) return null;
  const first = saleQuote(world, content, placeId, itemId);
  if (first === null || first <= 0) return null;
  const rate = pieceRate(world, content, placeId, stack.defId);
  if (!rate) return Number.isSafeInteger(first * qty) ? first * qty : null;
  const stocked = pieceStock(world, placeId, stack.defId);
  if (qty > rate.capacity - stocked) return null;
  let cents = 0;
  for (let i = 0; i < qty; i++) cents += saleQuote(world, content, placeId, itemId, stocked + i) ?? 0;
  return cents;
}
