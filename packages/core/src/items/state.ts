/**
 * Item instances, stacks, containers and locations (03 §3). OWNER: module:provisions.
 *
 * An ItemStack is qty units of one ItemDef sharing condition/wetness/spoilage (stackable
 * defs) or a single unit (non-stackable tools). Containers are stacks of container defs;
 * contents point at them with location { kind: 'container' } (arbitrary nesting, 03 §3.4).
 */
import type { ItemDefId } from '../content.ts';
import { type ActorId, asItemId, type HouseholdId, type ItemId, nextId, type PlaceId, type Table } from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import type { GameMinute } from '../time.ts';
import type { World } from '../world.ts';

export type ItemLocation =
  /** Carried (or worn) by an actor. */
  | { kind: 'actor'; actorId: ActorId; worn: boolean }
  /** Household stores (the pantry, the woodpile), kept at the household's home place. */
  | { kind: 'household'; householdId: HouseholdId }
  /** Lying at / stocked at a place (store stock, a cache). */
  | { kind: 'place'; placeId: PlaceId }
  /** Inside another stack that is a container. */
  | { kind: 'container'; itemId: ItemId };

/** How a light-giving or fuel-burning device is switched (provisions.light): 'auto' lights when dark and someone is up. */
export type LitMode = 'auto' | 'on' | 'off';

export interface ItemStack {
  id: ItemId;
  defId: ItemDefId;
  qty: number;
  location: ItemLocation;
  /** 0..100 (03 §3.6). */
  condition: number;
  /** 0..100 percent saturation (03 §3.5). */
  wetness: number;
  /** 0..1000 progress toward spoiled (food only; 1000 = spoiled). */
  spoilage: number;
  /**
   * Remainder of the spoilage division (03 §3.7.4): `spoilage` gains floor(num/den) each step and
   * the remainder is carried, so long-keeping food still spoils. 0 <= carry < den.
   */
  spoilageCarry: number;
  /**
   * Sub-units already used from the top unit of the stack: servings eaten of a food unit, or supply
   * units (minutes of fire, lamp-minutes, strikes) burned from a fuel/match/oil unit. 0 <= partial < unit size.
   */
  partial: number;
  /** Devices that burn supplies: how the player or the household has set them. */
  litMode: LitMode;
  /** True while a device is burning supply this hour (gates its affordances). */
  lit: boolean;
  createdAt: GameMinute;
  /** Provenance log (03 §10.1): ids of events that touched this stack. Capped by provisions. */
  provenance: number[];
}

export interface ItemsState {
  counters: { item: number };
  stacks: Table<ItemId, ItemStack>;
}

export function createItemsState(): ItemsState {
  return { counters: { item: 0 }, stacks: {} };
}

/** Keep only the last few provenance entries so a stack's history cannot grow without bound. */
export const PROVENANCE_CAP = 8;

/** Create a stack (no event; callers emit 'items.created' when it matters). */
export function newStack(world: World, defId: ItemDefId, qty: number, location: ItemLocation, at: GameMinute): ItemId {
  const id = asItemId(nextId(world.items.counters, 'item'));
  world.items.stacks[id] = {
    id,
    defId,
    qty,
    location,
    condition: 100,
    wetness: 0,
    spoilage: 0,
    spoilageCarry: 0,
    partial: 0,
    litMode: 'auto',
    lit: false,
    createdAt: at,
    provenance: [],
  };
  return id;
}

/** Append an event id to a stack's provenance log, trimming to PROVENANCE_CAP. */
export function recordProvenance(stack: ItemStack, eventId: number): void {
  stack.provenance.push(eventId);
  if (stack.provenance.length > PROVENANCE_CAP) stack.provenance.splice(0, stack.provenance.length - PROVENANCE_CAP);
}

/**
 * Seed inventories, pantries and store stock from the scenario (provisions fields).
 * `in = "<itemDefId>"` nests a stack in the first earlier container stack of that def in
 * the same list.
 */
export function initItemsState(world: World, ctx: InitContext): void {
  type Seed = { item: string; qty: number; in?: string | undefined; worn: boolean };
  const seedList = (list: readonly Seed[], loc: (s: Seed) => ItemLocation) => {
    const placed: Array<{ defId: string; id: ItemId }> = [];
    for (const s of list) {
      const parent = s.in !== undefined ? placed.find((p) => p.defId === s.in) : undefined;
      const location: ItemLocation = parent ? { kind: 'container', itemId: parent.id } : loc(s);
      const def = ctx.content.items[s.item];
      if (def && !def.stackable) {
        for (let i = 0; i < s.qty; i++)
          placed.push({ defId: s.item, id: newStack(world, s.item, 1, location, ctx.now) });
      } else {
        placed.push({ defId: s.item, id: newStack(world, s.item, s.qty, location, ctx.now) });
      }
    }
  };
  for (const h of ctx.scenario.households) {
    const hid = world.index.householdByKey[h.key];
    if (hid === undefined) continue;
    seedList(h.pantry, () => ({ kind: 'household', householdId: hid }));
  }
  for (const a of ctx.scenario.actors) {
    const aid = world.index.actorByKey[a.key];
    if (aid === undefined) continue;
    seedList(a.inventory, (s) => ({ kind: 'actor', actorId: aid, worn: s.worn }));
  }
  for (const st of ctx.scenario.stocks) {
    const pid = world.index.placeByDef[st.place];
    if (pid === undefined) continue;
    seedList(st.items, () => ({ kind: 'place', placeId: pid }));
  }
}
