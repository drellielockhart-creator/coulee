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

interface ContainerLoad {
  weightG: number;
  bulkTenths: number;
  external: number;
}
/** Local to one fit/view query. Postorder evaluation handles arbitrarily deep nesting without
 * recursion, and enclosing containers reuse their already evaluated descendants. */
export interface ContainerLoadMemo {
  children: Record<number, ItemStack[]>;
  loads: Map<ItemId, ContainerLoad>;
}
export function containerLoadMemo(world: World): ContainerLoadMemo {
  const children: Record<number, ItemStack[]> = {};
  for (const stack of rowsOf(world.items.stacks))
    if (stack.location.kind === 'container') {
      children[stack.location.itemId] ??= [];
      children[stack.location.itemId]?.push(stack);
    }
  return { children, loads: new Map() };
}
/** Rigid vessels occupy their full capacity; a soft pack expands by its contents plus shell. */
export function externalBulkTenths(
  world: World,
  content: ContentBundle,
  stack: ItemStack,
  memo = containerLoadMemo(world),
): number {
  return loadOf(content, stack, memo).external;
}
function loadOf(content: ContentBundle, root: ItemStack, memo: ContainerLoadMemo): ContainerLoad {
  const pending = [{ stack: root, expanded: false }],
    seen = new Set<ItemId>();
  while (pending.length) {
    const entry = pending.pop();
    if (!entry || memo.loads.has(entry.stack.id)) continue;
    const stack = entry.stack,
      children = memo.children[stack.id] ?? [];
    if (!entry.expanded) {
      if (seen.has(stack.id)) continue;
      seen.add(stack.id);
      pending.push({ stack, expanded: true });
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        if (child) pending.push({ stack: child, expanded: false });
      }
      continue;
    }
    const def = content.items[stack.defId];
    let weightG = 0,
      bulkTenths = Math.ceil(((stack.waterMl ?? 0) * 10) / 946);
    for (const child of children) {
      const load = memo.loads.get(child.id);
      if (!load) continue;
      weightG += (content.items[child.defId]?.weight_g ?? 0) * child.qty + (child.waterMl ?? 0) + load.weightG;
      bulkTenths += load.external;
    }
    const shell = Math.round((def?.bulk ?? 0) * 10) * stack.qty;
    const external =
      def?.container && !def.shape.includes('soft')
        ? Math.max(shell, Math.round(def.container.capacity_bulk * 10) * stack.qty)
        : shell + bulkTenths;
    memo.loads.set(stack.id, { weightG, bulkTenths, external });
  }
  return memo.loads.get(root.id) ?? { weightG: 0, bulkTenths: 0, external: 0 };
}
/** Contents occupy their external volume, recursively (weight includes all descendants). */
export function contentsLoad(
  world: World,
  content: ContentBundle,
  containerId: ItemId,
  memo = containerLoadMemo(world),
): { weightG: number; bulkTenths: number } {
  const stack = world.items.stacks[containerId];
  return stack ? loadOf(content, stack, memo) : { weightG: 0, bulkTenths: 0 };
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
  // Check a projected relocation, including every enclosing soft pack's expansion. No caller
  // state is changed even when a distant ancestor is the first capacity that fails.
  const projected: World = { ...world, items: { ...world.items, stacks: { ...world.items.stacks } } };
  if (qty === stack.qty)
    projected.items.stacks[stack.id] = { ...stack, location: { kind: 'container', itemId: container.id } };
  else {
    projected.items.stacks[stack.id] = { ...stack, qty: stack.qty - qty };
    const id = (world.items.counters.item + 1) as ItemId;
    projected.items.stacks[id] = {
      ...stack,
      id,
      qty,
      waterMl: 0,
      location: { kind: 'container', itemId: container.id },
    };
  }
  const memo = containerLoadMemo(projected);
  for (const target of [container, ...containerChain(world, container)]) {
    const capacity = content.items[target.defId]?.container;
    if (!capacity) return { ok: false, reason: 'invalid enclosing container' };
    const load = contentsLoad(projected, content, target.id, memo);
    if (load.weightG + (target.waterMl ?? 0) > capacity.capacity_g)
      return { ok: false, reason: `${content.items[target.defId]?.name ?? target.defId} is full by weight` };
    if (load.bulkTenths > Math.round(capacity.capacity_bulk * 10))
      return { ok: false, reason: `${content.items[target.defId]?.name ?? target.defId} is full by bulk` };
  }
  return { ok: true };
}
