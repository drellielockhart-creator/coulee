/**
 * Rain-Hem (13 §5.8): `container_dry`. OWNER: module:fae; applied inside provisions'
 * `storageHour` through a HemSet the caller passes in, so the planner can project on its own
 * copy (13 §5.7) and only the live sim commits.
 *
 * One container stays dry while the hem has virtue: 1 virtue per 6-h block of exposure (a block
 * starts with its first rainy, exposed hour; an hour without exposure ends it). Wet contents stay
 * wet. ≥ 2 lb of iron in the container suppresses it. The rain it turns lands on the nearest
 * other uncovered container at the same place: the holder's own other bags first, then other
 * people's, by id (harm_basis `instrument`: the keeper's act, no forfeit needed).
 */
import type { CharmDef, CharmEffectDef } from '@coulee/content/schema';
import type { ContentBundle } from '../content.ts';
import type { ActorId, ItemId, PlaceId } from '../ids.ts';
import { type InventoryIndex, inventoryIndex, stacksDeep } from '../items/api.ts';
import { containerLoadMemo, contentsLoad, parentOf, rootLocation, sameLoc } from '../items/containers.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { isProtectedSite } from './api.ts';
import { charmDefOf, charmIds, charmLive, holdingOf, ironOn, learn } from './charms.ts';
import { harmAllowed } from './harm.ts';

type DryEffect = Extract<CharmEffectDef, { kind: 'container_dry' }>;
export function dryEffectOf(def: CharmDef | undefined): DryEffect | undefined {
  return def?.effects.find((e): e is DryEffect => e.kind === 'container_dry');
}

export interface HemRecord {
  hemId: ItemId;
  containerId: ItemId;
  virtue: number;
  exposure: number;
  blockMinutes: number;
  cost: number;
  maxContentsG: number;
  spill: boolean;
  /** Set during the pass. */
  active: boolean;
  exposedThisHour: boolean;
  spent: number;
  /** Container that took the turned rain this hour, if any. */
  spilledOn: ItemId | null;
  suppressed: boolean;
  fizzled?: boolean;
  placeId: PlaceId | null;
  holderId: ActorId | null;
  /** Rainy, exposed hours seen and hours covered (the forecast's exact row; 13 §5.7). */
  exposedHours?: number;
  coveredHours?: number;
}
export interface HemSet {
  byContainer: Record<number, HemRecord>;
}

/** Live hems stitched into a container (the hem sits directly inside it). */
export function hemSet(world: World, content: ContentBundle): HemSet {
  const out: HemSet = { byContainer: {} };
  if (!world.fae.charms) return out;
  for (const id of charmIds(world)) {
    const c = world.fae.charms[id];
    const def = charmDefOf(content, c?.defId);
    const eff = dryEffectOf(def);
    const stack = world.items.stacks[id];
    if (!c || !def || !eff || !stack || !charmLive(c)) continue;
    const parent = parentOf(world, stack);
    if (!parent || !content.items[parent.defId]?.container) continue;
    const h = holdingOf(world, stack);
    out.byContainer[parent.id] = {
      hemId: id,
      containerId: parent.id,
      virtue: c.virtue,
      exposure: c.exposure,
      blockMinutes: eff.block_minutes,
      cost: eff.virtue,
      maxContentsG: eff.max_contents_g,
      spill: eff.spill === 'nearest_uncovered',
      active: false,
      exposedThisHour: false,
      spent: 0,
      spilledOn: null,
      suppressed: false,
      placeId: h.placeId,
      holderId: h.actorId,
    };
  }
  return out;
}

/**
 * Settle the hour's blocks before the stack loop: which hems are exposed (the container's root is
 * out in the rain and not under a fly), and whether each starts or continues a paid block.
 */
export function openHemHour(
  world: World,
  content: ContentBundle,
  hems: HemSet,
  exposedRoot: (containerId: ItemId) => boolean,
  index: InventoryIndex = inventoryIndex(world),
): void {
  for (const key of Object.keys(hems.byContainer).sort((a, b) => Number(a) - Number(b))) {
    const r = hems.byContainer[Number(key)];
    if (!r) continue;
    const container = world.items.stacks[r.containerId];
    const hem = world.items.stacks[r.hemId];
    r.active = false;
    r.exposedThisHour = !!container && exposedRoot(r.containerId);
    if (!container || !hem) continue;
    if (r.placeId !== null && isProtectedSite(world.places[r.placeId] ?? { tags: [] })) {
      r.exposure = 0;
      continue;
    }
    if (!r.exposedThisHour) {
      r.exposure = 0;
      continue;
    }
    r.exposedHours = (r.exposedHours ?? 0) + 1;
    const def = charmDefOf(content, hem.defId);
    r.suppressed = !!def && ironOn(world, content, hem, def, index).suppressed;
    const load = contentsLoad(world, content, r.containerId, containerLoadMemo(world));
    if (r.suppressed || load.weightG > r.maxContentsG) {
      r.exposure = 0;
      continue;
    }
    if (r.exposure % r.blockMinutes === 0) {
      if (r.virtue < r.cost) {
        r.exposure = 0;
        continue;
      }
      r.virtue -= r.cost;
      r.spent += r.cost;
    }
    r.active = true;
    r.coveredHours = (r.coveredHours ?? 0) + 1;
    r.exposure += 60;
    if (r.exposure >= r.blockMinutes) r.exposure = 0;
  }
}

/** True when a stack sits (at any depth) in a container covered by an active hem this hour. */
export function hemmed(world: World, hems: HemSet | undefined, stackId: ItemId): boolean {
  if (!hems) return false;
  let cur = world.items.stacks[stackId];
  const seen = new Set<number>();
  while (cur && cur.location.kind === 'container' && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (hems.byContainer[cur.location.itemId]?.active) return true;
    cur = world.items.stacks[cur.location.itemId];
  }
  return false;
}

/**
 * Where the turned rain lands (after the stack loop): the nearest other container at the same
 * place that took rain this hour (exposed, not waterproof or airtight, not itself hemmed): the
 * holder's own other bags first, then others', by stack id. Its direct and nested contents take
 * one more wetting. Returns the container chosen per hem.
 */
export function spillHems(
  world: World,
  content: ContentBundle,
  hems: HemSet,
  uncovered: (stackId: ItemId) => boolean,
  wet: (stackId: ItemId) => void,
): void {
  const keys = Object.keys(hems.byContainer)
    .map(Number)
    .sort((a, b) => a - b);
  for (const k of keys) {
    const r = hems.byContainer[k];
    if (!r?.active || !r.spill || r.placeId === null) continue;
    const container = world.items.stacks[r.containerId];
    if (!container) continue;
    const myRoot = rootLocation(world, container);
    let best: { id: ItemId; rank: number } | null = null;
    for (const s of Object.values(world.items.stacks)) {
      if (s.id === r.containerId || s.id === r.hemId || !content.items[s.defId]?.container) continue;
      if (hems.byContainer[s.id]?.active || !uncovered(s.id)) continue;
      const root = rootLocation(world, s);
      const place =
        root.kind === 'actor'
          ? world.actors[root.actorId]?.placeId
          : root.kind === 'household'
            ? world.households[root.householdId]?.homePlaceId
            : root.placeId;
      if (place !== r.placeId) continue;
      const def = charmDefOf(content, world.fae.charms?.[r.hemId]?.defId);
      if (def && !harmAllowed(world, def, r.holderId, holdingOf(world, s).householdId)) {
        r.fizzled = true;
        continue;
      }
      const same = sameLoc(root, myRoot) ? 0 : 1;
      const rank = same * 1_000_000_000 + s.id;
      if (!best || rank < best.rank) best = { id: s.id, rank };
    }
    if (!best) continue;
    r.spilledOn = best.id;
    for (const { stack } of stacksDeep(world, { kind: 'container', itemId: best.id })) wet(stack.id);
  }
}

/** Write the pass back to the charms and record what the holder saw (live sim only). */
export function commitHems(world: World, ctx: SimContext, hems: HemSet): void {
  for (const key of Object.keys(hems.byContainer)
    .map(Number)
    .sort((a, b) => a - b)) {
    const r = hems.byContainer[key];
    const c = r ? world.fae.charms?.[r.hemId] : undefined;
    if (!r || !c) continue;
    c.virtue = r.virtue;
    c.exposure = r.exposure;
    if (r.fizzled && r.spilledOn === null) {
      ctx.emit({
        kind: 'fae.charm_fizzled',
        visibility: 'secret',
        data: { itemId: r.hemId, reason: 'The rain recipient has not forfeited protection' },
        explain: {
          kind: 'formula',
          label: 'Turned rain: protected recipient',
          subjects: [],
          knowledge: 'omniscient',
          terms: [],
          total: 0,
          outcome: 'fizzled',
        },
      });
    }
    if (!r.active) continue;
    c.lastUseAt = ctx.now;
    // The holder sees the bag come in dry while the rest is soaked: a controlled result (13 §5.3).
    if (r.holderId !== null && learn(world, r.holderId, r.hemId, 'observed', ctx.now)) {
      ctx.emit({
        kind: 'fae.charm_used',
        ...(r.placeId !== null ? { place: r.placeId } : {}),
        visibility: 'private',
        importance: 10,
        roles: [{ actor: r.holderId, role: 'agent' }],
        data: {
          itemId: r.hemId,
          charm: c.defId,
          keeperId: r.holderId,
          placeId: r.placeId,
          witnesses: [r.holderId],
          text: 'The rain beads and runs off the hemmed flap; what is inside stays dry.',
        },
      });
    }
  }
}
