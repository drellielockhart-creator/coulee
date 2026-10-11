/**
 * Item queries and mutations (03 §3–4). OWNER: module:provisions.
 * Jobs query AFFORDANCES, not item ids (03 §3.2 DECISION).
 */
import type { ContentBundle } from '../content.ts';
import { type ActorId, type HouseholdId, type ItemId, idsOf, type PlaceId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import type { ItemLocation, ItemStack } from './state.ts';

function sameLoc(a: ItemLocation, b: ItemLocation): boolean {
  switch (a.kind) {
    case 'actor':
      return b.kind === 'actor' && a.actorId === b.actorId;
    case 'household':
      return b.kind === 'household' && a.householdId === b.householdId;
    case 'place':
      return b.kind === 'place' && a.placeId === b.placeId;
    case 'container':
      return b.kind === 'container' && a.itemId === b.itemId;
  }
}

/** Stacks directly at a location (not recursing into containers), ascending id. */
export function stacksAt(world: World, loc: ItemLocation): ItemStack[] {
  const out: ItemStack[] = [];
  for (const id of idsOf<ItemId>(world.items.stacks)) {
    const s = world.items.stacks[id];
    if (s && sameLoc(s.location, loc)) out.push(s);
  }
  return out;
}

/** All stacks at a location including nested container contents, depth-first, with depth. */
export function stacksDeep(world: World, loc: ItemLocation): Array<{ stack: ItemStack; depth: number }> {
  const out: Array<{ stack: ItemStack; depth: number }> = [];
  const visit = (l: ItemLocation, depth: number) => {
    for (const s of stacksAt(world, l)) {
      out.push({ stack: s, depth });
      visit({ kind: 'container', itemId: s.id }, depth + 1);
    }
  };
  visit(loc, 0);
  return out;
}

export const carriedBy = (actorId: ActorId): ItemLocation => ({ kind: 'actor', actorId, worn: false });
export const pantryOf = (householdId: HouseholdId): ItemLocation => ({ kind: 'household', householdId });
export const atPlace = (placeId: PlaceId): ItemLocation => ({ kind: 'place', placeId });

/** Total weight in grams of everything at a location (deep). */
export function weightG(world: World, content: ContentBundle, loc: ItemLocation): number {
  let g = 0;
  for (const { stack } of stacksDeep(world, loc)) g += (content.items[stack.defId]?.weight_g ?? 0) * stack.qty;
  return g;
}

/** Total bulk in tenths of a Bulk unit at a location (top level only: nested bulk is inside its container). */
export function bulkTenths(world: World, content: ContentBundle, loc: ItemLocation): number {
  let b = 0;
  for (const s of stacksAt(world, loc)) b += Math.round((content.items[s.defId]?.bulk ?? 0) * 10) * s.qty;
  return b;
}

/**
 * Best magnitude (tenths) of an affordance available at a location (deep), scaled by
 * condition (03 §3.6: below 50 scales down). E.g. affordanceAt(w, c, carriedBy(a), 'boil').
 */
export function affordanceAt(world: World, content: ContentBundle, loc: ItemLocation, key: string): number {
  let best = 0;
  for (const { stack } of stacksDeep(world, loc)) {
    const mag = content.items[stack.defId]?.affordances[key];
    if (mag === undefined) continue;
    let t = Math.round(mag * 10);
    if (stack.condition < 50) t = Math.floor((t * stack.condition) / 50);
    if (t > best) best = t;
  }
  return best;
}

/** Move qty units of a stack (splitting if needed). Returns the id of the moved stack. STUB-simple. */
export function moveStack(world: World, _ctx: SimContext, itemId: ItemId, qty: number, to: ItemLocation): ItemId {
  const s = world.items.stacks[itemId];
  if (!s) throw new Error(`no stack ${itemId}`);
  if (qty >= s.qty) {
    s.location = to;
    return s.id;
  }
  throw new Error('moveStack: partial moves not implemented yet (module:provisions)');
}

/** Remove qty units (eaten, burned, spent). Deletes the stack at 0. */
export function consumeStack(world: World, _ctx: SimContext, itemId: ItemId, qty: number): number {
  const s = world.items.stacks[itemId];
  if (!s) return 0;
  const used = Math.min(qty, s.qty);
  s.qty -= used;
  if (s.qty <= 0) delete world.items.stacks[itemId];
  return used;
}
