/**
 * Item queries and mutations (03 §3–4). OWNER: module:provisions.
 * Jobs query AFFORDANCES, not item ids (03 §3.2 DECISION).
 *
 * Iteration note: `world.items.stacks` is keyed by positive integer ids, and ECMAScript walks integer
 * keys in ascending numeric order, so `Object.values` here is ascending-id order, the same total
 * order `idsOf` gives, without a sort per call.
 */
import type { ContentBundle, ItemDef } from '../content.ts';
import { type ActorId, type HouseholdId, type ItemId, type PlaceId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import { containerChain, MAX_NEST_DEPTH, rootLocation, sameLoc } from './containers.ts';
import { type ItemLocation, type ItemStack, newStack, recordProvenance } from './state.ts';
import type { World } from '../world.ts';

export { sameLoc } from './containers.ts';

/** Every stack, ascending id. */
export function allStacks(world: World): ItemStack[] {
  return Object.values(world.items.stacks);
}

/** Stacks directly at a location (not recursing into containers), ascending id. */
export function stacksAt(world: World, loc: ItemLocation): ItemStack[] {
  const out: ItemStack[] = [];
  for (const s of Object.values(world.items.stacks)) if (sameLoc(s.location, loc)) out.push(s);
  return out;
}

/** All stacks at a location including nested container contents, depth-first, with depth. */
export function stacksDeep(world: World, loc: ItemLocation): Array<{ stack: ItemStack; depth: number }> {
  // One pass groups children by parent; the walk then never rescans the table.
  const kids: Record<number, ItemStack[]> = {};
  const top: ItemStack[] = [];
  for (const s of Object.values(world.items.stacks)) {
    if (s.location.kind === 'container') {
      const list = kids[s.location.itemId] ?? [];
      list.push(s);
      kids[s.location.itemId] = list;
    } else if (sameLoc(s.location, loc)) top.push(s);
  }
  if (loc.kind === 'container') top.push(...(kids[loc.itemId] ?? []));
  const out: Array<{ stack: ItemStack; depth: number }> = [];
  const visit = (list: readonly ItemStack[], depth: number) => {
    if (depth > MAX_NEST_DEPTH) return;
    for (const s of list) {
      out.push({ stack: s, depth });
      visit(kids[s.id] ?? [], depth + 1);
    }
  };
  visit(top, 0);
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

/** Quality multipliers on affordance magnitude, percent (03 §3.2: magnitude x quality x condition). */
export const QUALITY_PCT: Record<string, number> = { shoddy: 70, common: 100, good: 115, fine: 130, exceptional: 150 };

/** True if the def burns supply over time, so its affordances exist only while it is lit. */
export function isBurner(def: ItemDef | undefined): boolean {
  return def !== undefined && def.consumes.some((c) => c.per === 'hour' || c.per === 'day');
}

/**
 * Magnitude (tenths) a single stack gives for an affordance, scaled once by quality and condition
 * (03 §3.6: below 50 condition scales down). 0 if the def lacks it or a burner is not lit.
 */
export function stackAffordance(content: ContentBundle, stack: ItemStack, key: string): number {
  const def = content.items[stack.defId];
  const mag = def?.affordances[key];
  if (def === undefined || mag === undefined) return 0;
  if (isBurner(def) && !stack.lit) return 0;
  const base = Math.round(mag * 10);
  const q = QUALITY_PCT[def.quality] ?? 100;
  const c = stack.condition < 50 ? Math.max(0, stack.condition) : 50;
  return Math.floor((base * q * c) / (100 * 50));
}

/**
 * Best magnitude (tenths) of an affordance available at a location (deep), scaled by quality and
 * condition. E.g. affordanceAt(w, c, carriedBy(a), 'boil'). Lit-only devices count only while lit.
 */
export function affordanceAt(world: World, content: ContentBundle, loc: ItemLocation, key: string): number {
  let best = 0;
  for (const { stack } of stacksDeep(world, loc)) {
    const t = stackAffordance(content, stack, key);
    if (t > best) best = t;
  }
  return best;
}

/** Two stacks can merge when everything but quantity, id and history matches. */
export function mergeCompatible(a: ItemStack, b: ItemStack, def: ItemDef | undefined): boolean {
  if (a.id === b.id || a.defId !== b.defId || def === undefined || !def.stackable) return false;
  return (
    sameLoc(a.location, b.location) &&
    a.condition === b.condition &&
    a.wetness === b.wetness &&
    a.spoilage === b.spoilage &&
    a.spoilageCarry === b.spoilageCarry &&
    a.partial === b.partial &&
    a.litMode === b.litMode &&
    a.lit === b.lit
  );
}

/** If another stack at the same place is interchangeable, fold `stack` into it and return that id. */
export function tryMerge(world: World, content: ContentBundle, stack: ItemStack): ItemId {
  const def = content.items[stack.defId];
  for (const other of Object.values(world.items.stacks)) {
    if (other.id < stack.id && mergeCompatible(stack, other, def)) {
      other.qty += stack.qty;
      delete world.items.stacks[stack.id];
      return other.id;
    }
  }
  return stack.id;
}

/** Remove a stack, hoisting any contents to the container's own location so nothing is orphaned. */
function removeStack(world: World, stack: ItemStack): void {
  for (const s of Object.values(world.items.stacks)) {
    if (s.location.kind === 'container' && s.location.itemId === stack.id) s.location = stack.location;
  }
  delete world.items.stacks[stack.id];
}

/**
 * Create `qty` units of a def at a location (merging into an identical stack there) and log
 * 'items.created'. Returns the surviving stack id.
 */
export function createStack(
  world: World,
  ctx: Pick<SimContext, 'content' | 'now' | 'emit'>,
  defId: string,
  qty: number,
  location: ItemLocation,
  init: Partial<Pick<ItemStack, 'spoilage' | 'condition' | 'wetness'>> = {},
): ItemId {
  const id = newStack(world, defId, qty, location, ctx.now);
  const s = world.items.stacks[id];
  if (!s) return id;
  if (init.spoilage !== undefined) s.spoilage = init.spoilage;
  if (init.condition !== undefined) s.condition = init.condition;
  if (init.wetness !== undefined) s.wetness = init.wetness;
  const ev = ctx.emit({
    kind: 'items.created',
    data: { itemId: id, defId, qty, location },
    visibility: 'private',
  });
  recordProvenance(s, ev);
  return tryMerge(world, ctx.content, s);
}

/**
 * Move qty units of a stack to a new location, splitting the stack if only part moves. The
 * moved units keep condition, wetness, spoilage and partial use. Returns the id of the moved
 * stack (the original when everything moved). Logs 'items.moved'. Throws on a container cycle.
 */
export function moveStack(world: World, ctx: SimContext, itemId: ItemId, qty: number, to: ItemLocation): ItemId {
  const s = world.items.stacks[itemId];
  if (!s) throw new Error(`no stack ${itemId}`);
  const n = Math.max(0, Math.min(qty, s.qty));
  if (n === 0) return s.id;
  if (to.kind === 'container') {
    const target = world.items.stacks[to.itemId];
    if (!target) throw new Error(`no container ${to.itemId}`);
    if (target.id === s.id || containerChain(world, target).some((c) => c.id === s.id)) {
      throw new Error('moveStack: container cycle');
    }
  }
  const from = s.location;
  let movedId: ItemId = s.id;
  if (n >= s.qty) {
    s.location = to;
  } else {
    const rest = newStack(world, s.defId, n, to, s.createdAt);
    const moved = world.items.stacks[rest];
    if (moved) {
      moved.condition = s.condition;
      moved.wetness = s.wetness;
      moved.spoilage = s.spoilage;
      moved.spoilageCarry = s.spoilageCarry;
      moved.litMode = s.litMode;
      moved.lit = s.lit;
      moved.provenance = [...s.provenance];
      // Partial use belongs to the top unit; leave it with the stack that keeps the top unit.
    }
    s.qty -= n;
    movedId = rest;
  }
  const ev = ctx.emit({
    kind: 'items.moved',
    data: { itemId: movedId, defId: s.defId, qty: n, from, to },
    visibility: 'private',
  });
  const moved = world.items.stacks[movedId];
  if (moved) recordProvenance(moved, ev);
  return tryMerge(world, ctx.content, world.items.stacks[movedId] ?? s);
}

/**
 * Remove qty units (eaten, burned, spent). Deletes the stack at 0, hoisting its contents. Quiet
 * unless `reason` is given, in which case it logs 'items.consumed'. Returns the units removed.
 */
export function consumeStack(world: World, ctx: SimContext, itemId: ItemId, qty: number, reason?: string): number {
  const s = world.items.stacks[itemId];
  if (!s) return 0;
  const used = Math.max(0, Math.min(qty, s.qty));
  if (used === 0) return 0;
  s.qty -= used;
  s.partial = 0;
  if (reason !== undefined) {
    ctx.emit({
      kind: 'items.consumed',
      data: { itemId, defId: s.defId, qty: used, reason },
      visibility: 'private',
    });
  }
  if (s.qty <= 0) removeStack(world, s);
  return used;
}

/** Remove a stack and hoist its contents. Exposed for the provisions system (spoilage, vermin). */
export function deleteStack(world: World, itemId: ItemId): void {
  const s = world.items.stacks[itemId];
  if (s) removeStack(world, s);
}

// ---- supplies (03 §3.8): fuel, lamp oil, matches, powder... -------------------------------

/** Units a stack provides of a supply kind: qty x units/item minus what is already burned off the top unit. */
export function stackSupplyUnits(content: ContentBundle, stack: ItemStack, kind: string): number {
  const sup = content.items[stack.defId]?.supply;
  if (!sup || sup.kind !== kind || stack.condition <= 0) return 0;
  return Math.max(0, stack.qty * sup.units - stack.partial);
}

/** Total units of a supply kind at a location (deep). */
export function supplyUnits(world: World, content: ContentBundle, loc: ItemLocation, kind: string): number {
  let t = 0;
  for (const { stack } of stacksDeep(world, loc)) t += stackSupplyUnits(content, stack, kind);
  return t;
}

/**
 * Burn up to `units` of a supply kind from the stacks at a location, lowest stack id first, tracking
 * the used part of the top unit in `partial`. Returns the units actually drawn.
 */
export function consumeSupply(world: World, content: ContentBundle, loc: ItemLocation, kind: string, units: number): number {
  let need = Math.max(0, Math.round(units));
  let drawn = 0;
  for (const { stack } of stacksDeep(world, loc)) {
    if (need <= 0) break;
    const sup = content.items[stack.defId]?.supply;
    if (!sup || sup.kind !== kind || stack.condition <= 0) continue;
    const have = stack.qty * sup.units - stack.partial;
    if (have <= 0) continue;
    const take = Math.min(have, need);
    const used = stack.partial + take;
    stack.qty -= Math.floor(used / sup.units);
    stack.partial = used % sup.units;
    drawn += take;
    need -= take;
    if (stack.qty <= 0) removeStack(world, stack);
  }
  return drawn;
}

/** Which actor, household or place a stack ultimately belongs to. */
export function rootOf(world: World, stack: ItemStack): ItemLocation {
  return rootLocation(world, stack);
}
