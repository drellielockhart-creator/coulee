/**
 * Containers, nesting and packaging (03 §3.4, §3.7.4). OWNER: module:provisions.
 *
 * Protection is evaluated outside-in: the same `protects` list that keeps matches dry sets the
 * spoilage multiplier for food inside. Nesting is arbitrary depth; every walk here is bounded so
 * a corrupt save cannot loop forever.
 */
import type { ContentBundle, ProtectionId } from '../content.ts';
import { asPlaceId, type ItemId } from '../ids.ts';
import type { World } from '../world.ts';
import type { ItemLocation, ItemStack } from './state.ts';

/** Nesting deeper than this is treated as a cycle. */
export const MAX_NEST_DEPTH = 24;

/** Canonical order of protection classes, so integer products are applied in a fixed order. */
export const PROTECTION_ORDER: readonly ProtectionId[] = [
  'splashproof',
  'waterproof',
  'airtight',
  'crushproof',
  'insulated',
  'iron_lined',
  'concealed',
  'vermin_proof',
  'brine',
  'cool_storage',
];

export type RootLocation = Exclude<ItemLocation, { kind: 'container' }>;

export function sameLoc(a: ItemLocation, b: ItemLocation): boolean {
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

/** Stable text key for a location (used to group stacks without Maps keyed by objects). */
export function locKey(loc: ItemLocation): string {
  switch (loc.kind) {
    case 'actor':
      return `a${loc.actorId}`;
    case 'household':
      return `h${loc.householdId}`;
    case 'place':
      return `p${loc.placeId}`;
    case 'container':
      return `c${loc.itemId}`;
  }
}

/** The container stack this stack sits in, or undefined at top level. */
export function parentOf(world: World, stack: ItemStack): ItemStack | undefined {
  return stack.location.kind === 'container' ? world.items.stacks[stack.location.itemId] : undefined;
}

/** Containers from the innermost (direct parent) outward. Excludes the stack itself. */
export function containerChain(world: World, stack: ItemStack): ItemStack[] {
  const out: ItemStack[] = [];
  let cur: ItemStack | undefined = parentOf(world, stack);
  while (cur && out.length < MAX_NEST_DEPTH) {
    out.push(cur);
    cur = parentOf(world, cur);
  }
  return out;
}

/** Where the stack ultimately is: an actor, a household, or a place. Orphans resolve to themselves' last location. */
export function rootLocation(world: World, stack: ItemStack): RootLocation {
  let cur: ItemStack = stack;
  for (let i = 0; i < MAX_NEST_DEPTH; i++) {
    const loc = cur.location;
    if (loc.kind !== 'container') return loc;
    const up = world.items.stacks[loc.itemId];
    if (!up) break;
    cur = up;
  }
  return { kind: 'place', placeId: asPlaceId(0) };
}

/** Distinct protection classes anywhere in the container chain, in canonical order. */
export function protectionsOf(world: World, content: ContentBundle, stack: ItemStack): ProtectionId[] {
  const seen: Record<string, true> = {};
  for (const c of containerChain(world, stack)) {
    for (const p of content.items[c.defId]?.container?.protects ?? []) seen[p] = true;
  }
  return PROTECTION_ORDER.filter((p) => seen[p] === true);
}

/**
 * The carry point of the outermost thing carrying the stack ('worn', 'pocket', 'pack'...), or null
 * when the stack is not carried by an actor. Loose items count as 'pack'.
 */
export function carryPointOf(world: World, content: ContentBundle, stack: ItemStack): string | null {
  if (rootLocation(world, stack).kind !== 'actor') return null;
  const chain = containerChain(world, stack);
  const outer = chain.length > 0 ? (chain[chain.length - 1] as ItemStack) : stack;
  if (outer.location.kind === 'actor' && outer.location.worn) return 'worn';
  return content.items[outer.defId]?.container?.carry ?? 'pack';
}

/** Ids of the stacks directly inside a container, ascending. */
export function childrenOf(world: World, containerId: ItemId): ItemStack[] {
  const out: ItemStack[] = [];
  // Integer keys iterate in ascending order (ECMAScript OrdinaryOwnPropertyKeys), so this is id order.
  for (const s of Object.values(world.items.stacks)) {
    if (s.location.kind === 'container' && s.location.itemId === containerId) out.push(s);
  }
  return out;
}

/** Total weight in grams and bulk in tenths of what sits inside a container (deep for weight). */
export function contentsLoad(
  world: World,
  content: ContentBundle,
  containerId: ItemId,
): { weightG: number; bulkTenths: number } {
  let weightG = 0;
  let bulkTenths = 0;
  const visit = (id: ItemId, depth: number, top: boolean) => {
    if (depth > MAX_NEST_DEPTH) return;
    for (const c of childrenOf(world, id)) {
      const def = content.items[c.defId];
      weightG += (def?.weight_g ?? 0) * c.qty;
      if (top) bulkTenths += Math.round((def?.bulk ?? 0) * 10) * c.qty;
      visit(c.id, depth + 1, false);
    }
  };
  visit(containerId, 0, true);
  return { weightG, bulkTenths };
}

export interface FitResult {
  ok: boolean;
  reason?: string;
}

/**
 * Can `qty` units of `stack` go inside `container`? Checks that the target is a container, that
 * it is not the stack itself or inside it, and that weight and bulk capacity hold.
 */
export function fitsInContainer(
  world: World,
  content: ContentBundle,
  stack: ItemStack,
  qty: number,
  container: ItemStack,
): FitResult {
  const cdef = content.items[container.defId]?.container;
  if (!cdef)
    return { ok: false, reason: `${content.items[container.defId]?.name ?? container.defId} is not a container` };
  if (container.id === stack.id) return { ok: false, reason: 'cannot put a thing inside itself' };
  for (const up of containerChain(world, container)) {
    if (up.id === stack.id) return { ok: false, reason: 'cannot put a container inside its own contents' };
  }
  const def = content.items[stack.defId];
  const unitWeight = def?.weight_g ?? 0;
  const unitBulk = Math.round((def?.bulk ?? 0) * 10);
  // A moved container carries its own contents with it.
  const moving = stack.qty > 0 ? contentsLoad(world, content, stack.id) : { weightG: 0, bulkTenths: 0 };
  const share = stack.qty > 0 ? qty / stack.qty : 1;
  const addWeight = unitWeight * qty + Math.round(moving.weightG * share);
  const addBulk = unitBulk * qty;
  const load = contentsLoad(world, content, container.id);
  if (load.weightG + addWeight > cdef.capacity_g) {
    return { ok: false, reason: `${content.items[container.defId]?.name ?? container.defId} is full by weight` };
  }
  if (load.bulkTenths + addBulk > Math.round(cdef.capacity_bulk * 10)) {
    return { ok: false, reason: `${content.items[container.defId]?.name ?? container.defId} is full by bulk` };
  }
  return { ok: true };
}
