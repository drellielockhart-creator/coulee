/**
 * Containers, nesting and packaging (03 §3.4, §3.7.4). OWNER: module:provisions.
 *
 * Protection is evaluated outside-in: the same `protects` list that keeps matches dry sets the
 * spoilage multiplier for food inside. Nesting is arbitrary depth; every walk here is bounded so
 * a corrupt save cannot loop forever.
 */
import type { ContentBundle, ProtectionId } from '../content.ts';
import { asPlaceId, type ItemId, rowsOf } from '../ids.ts';
import type { World } from '../world.ts';
import type { ItemLocation, ItemStack } from './state.ts';

/** Compatibility export; traversal uses visited ids instead of a depth cutoff. */
export const MAX_NEST_DEPTH = Number.MAX_SAFE_INTEGER;

/** Legacy class catalogue; protection application follows the actual outside-in container chain. */
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
  const seen = new Set<ItemId>([stack.id]);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    cur = parentOf(world, cur);
  }
  return out;
}

/** Where the stack ultimately is: an actor, a household, or a place. Orphans resolve to themselves' last location. */
export function rootLocation(world: World, stack: ItemStack): RootLocation {
  let cur: ItemStack = stack;
  const seen = new Set<ItemId>();
  while (!seen.has(cur.id)) {
    seen.add(cur.id);
    const loc = cur.location;
    if (loc.kind !== 'container') return loc;
    const up = world.items.stacks[loc.itemId];
    if (!up) break;
    cur = up;
  }
  return { kind: 'place', placeId: asPlaceId(0) };
}

/** Distinct protection classes, encountered in outside-in container order. */
export function protectionsOf(world: World, content: ContentBundle, stack: ItemStack): ProtectionId[] {
  const seen = new Set<ProtectionId>();
  const out: ProtectionId[] = [];
  for (const c of containerChain(world, stack).reverse()) {
    if (c.condition <= 0) continue;
    for (const p of content.items[c.defId]?.container?.protects ?? []) {
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
  }
  return out;
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
  for (const s of rowsOf(world.items.stacks)) {
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
  const seen = new Set<ItemId>([containerId]);
  const pending = childrenOf(world, containerId).map((stack) => ({ stack, top: true }));
  while (pending.length > 0) {
    const entry = pending.pop();
    if (!entry || seen.has(entry.stack.id)) continue;
    const c = entry.stack;
    seen.add(c.id);
    const def = content.items[c.defId];
    weightG += (def?.weight_g ?? 0) * c.qty + (c.waterMl ?? 0);
    if (entry.top) bulkTenths += Math.round((def?.bulk ?? 0) * 10) * c.qty;
    for (const stack of childrenOf(world, c.id)) pending.push({ stack, top: false });
  }
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
  const addWeight =
    unitWeight * qty + (qty === stack.qty ? moving.weightG : 0) + (qty === stack.qty ? (stack.waterMl ?? 0) : 0);
  const addBulk = unitBulk * qty;
  const sourceChain = containerChain(world, stack);
  for (const target of [container, ...containerChain(world, container)]) {
    const capacity = content.items[target.defId]?.container;
    if (!capacity) return { ok: false, reason: 'invalid enclosing container' };
    const load = contentsLoad(world, content, target.id);
    const weightDelta = sourceChain.some((c) => c.id === target.id) ? 0 : addWeight;
    if (load.weightG + weightDelta > capacity.capacity_g) {
      return { ok: false, reason: `${content.items[target.defId]?.name ?? target.defId} is full by weight` };
    }
    const bulkDelta =
      target.id === container.id
        ? stack.location.kind === 'container' && stack.location.itemId === target.id
          ? 0
          : addBulk
        : 0;
    if (load.bulkTenths + bulkDelta > Math.round(capacity.capacity_bulk * 10)) {
      return { ok: false, reason: `${content.items[target.defId]?.name ?? target.defId} is full by bulk` };
    }
  }
  return { ok: true };
}
