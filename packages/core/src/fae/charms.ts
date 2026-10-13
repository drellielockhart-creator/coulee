/**
 * Charm records and the facts every charm path needs (13 §5). OWNER: module:fae.
 *
 * A charm is an ordinary item (module:provisions owns the stack, its place, its condition) plus a
 * fae record keyed by item id. Records are created lazily when a charm item first matters, so a
 * world without charms keeps its slice (and its hash) unchanged.
 */
import type { CharmDef } from '@coulee/content/schema';
import type { ContentBundle } from '../content.ts';
import type { ActorId, HouseholdId, ItemId, PlaceId } from '../ids.ts';
import { asItemId } from '../ids.ts';
import { type BinIron, binIron, type InventoryIndex, rootOf, stacksDeep } from '../items/api.ts';
import type { ItemLocation, ItemStack } from '../items/state.ts';
import type { World } from '../world.ts';
import type { CharmKnowledge, CharmState, DrawCase } from './state.ts';

export function charmTable(world: World): Record<number, CharmState> {
  world.fae.charms ??= {};
  return world.fae.charms;
}
export function caseTable(world: World): Record<string, DrawCase> {
  world.fae.drawCases ??= {};
  return world.fae.drawCases;
}
/** Charm ids in ascending order (a total order, independent of insertion). */
export function charmIds(world: World): ItemId[] {
  return Object.keys(world.fae.charms ?? {})
    .map(Number)
    .sort((a, b) => a - b)
    .map(asItemId);
}
export function charmDefOf(content: ContentBundle, defId: string | undefined): CharmDef | undefined {
  return defId === undefined ? undefined : content.charms?.[defId];
}

/** The fae record of a charm item, created on first use. Null for a non-charm stack. */
export function ensureCharm(world: World, content: ContentBundle, itemId: ItemId): CharmState | null {
  const existing = world.fae.charms?.[itemId];
  if (existing) return existing;
  const stack = world.items.stacks[itemId];
  const def = charmDefOf(content, stack?.defId);
  if (!stack || !def) return null;
  const c: CharmState = {
    itemId,
    defId: stack.defId,
    virtue: def.virtue.start,
    vigor: 100,
    boundTo: null,
    custodianId: null,
    tie: null,
    lastUseAt: null,
    lastDrawDay: -1,
    lastRechargeAt: null,
    rechargeBlockedUntil: 0,
    offering: null,
    exposure: 0,
    drawLedger: {},
    stringIds: [],
    found: null,
    reservoir: null,
    attachment: {},
    attachWeek: {},
    witnessed: {},
    desire: {},
    thankedAt: null,
    disposed: null,
    inert: false,
  };
  charmTable(world)[itemId] = c;
  return c;
}

/** Where a charm is: the actor carrying it, the household keeping it, the place it lies at. */
export interface Holding {
  actorId: ActorId | null;
  householdId: HouseholdId | null;
  placeId: PlaceId | null;
  root: ItemLocation;
}
export function holdingOf(world: World, stack: ItemStack): Holding {
  const root = rootOf(world, stack);
  if (root.kind === 'actor') {
    const a = world.actors[root.actorId];
    return { actorId: root.actorId, householdId: a?.householdId ?? null, placeId: a?.placeId ?? null, root };
  }
  if (root.kind === 'household') {
    const h = world.households[root.householdId];
    return { actorId: null, householdId: root.householdId, placeId: h?.homePlaceId ?? null, root };
  }
  if (root.kind === 'place') return { actorId: null, householdId: null, placeId: root.placeId, root };
  return { actorId: null, householdId: null, placeId: null, root };
}

/**
 * Who keeps it, as the town would say: whoever carries it; else its custodian when it is in the
 * custodian's household's stores; else that household's head. Null when it lies loose somewhere.
 */
export function keeperOf(world: World, c: CharmState): ActorId | null {
  const stack = world.items.stacks[c.itemId];
  if (!stack) return null;
  const h = holdingOf(world, stack);
  if (h.actorId !== null) return h.actorId;
  if (h.householdId === null) return null;
  const cust = c.custodianId !== null ? world.actors[c.custodianId] : undefined;
  if (cust?.alive && cust.householdId === h.householdId) return cust.id;
  const head = world.households[h.householdId]?.headId;
  return head !== undefined && world.actors[head]?.alive ? head : null;
}

/** Iron in contact with the charm, and whether it suppresses it (13 §5.4). */
export function ironOn(
  world: World,
  content: ContentBundle,
  stack: ItemStack,
  def: CharmDef,
  index?: InventoryIndex,
): BinIron & { suppressed: boolean } {
  const iron = binIron(world, content, stack, index);
  return { ...iron, suppressed: iron.ironLined || iron.grams >= def.iron.nearby_g };
}

/** A charm that can act at all: found, not disposed, not soured to nothing. */
export function charmLive(c: CharmState): boolean {
  return !c.inert && c.disposed === null && c.reservoir === null && c.vigor > 0;
}

/** Whole units of the listed defs inside a container charm (its "fullness"). */
export function unitsInside(world: World, itemId: ItemId, defs: readonly string[]): number {
  let n = 0;
  for (const { stack } of stacksDeep(world, { kind: 'container', itemId }))
    if (defs.includes(stack.defId)) n += stack.qty;
  return n;
}

export function knowledgeOf(world: World, actorId: ActorId, itemId: ItemId): CharmKnowledge | undefined {
  return world.fae.known?.[actorId]?.[itemId];
}
/** The actor's verified-knowledge record for a charm, created empty on first use. */
export function knownRecord(world: World, actorId: ActorId, itemId: ItemId): CharmKnowledge {
  if (!world.fae.known) world.fae.known = {};
  let byItem = world.fae.known[actorId];
  if (!byItem) {
    byItem = {};
    world.fae.known[actorId] = byItem;
  }
  let k = byItem[itemId];
  if (!k) {
    k = {};
    byItem[itemId] = k;
  }
  return k;
}
/** Record a verified fact (first time only keeps its minute). */
export function learn(
  world: World,
  actorId: ActorId,
  itemId: ItemId,
  fact: 'construction' | 'effects' | 'counterparty' | 'observed',
  at: number,
): boolean {
  const k = knownRecord(world, actorId, itemId);
  if (k[fact] !== undefined) return false;
  k[fact] = at;
  return true;
}

/** Feet between two places (same site: grid Manhattan; else a flat three miles, an hour's walk). */
export function feetBetween(world: World, content: ContentBundle, from: PlaceId, to: PlaceId): number {
  const a = world.places[from];
  const b = world.places[to];
  if (!a || !b) return Number.MAX_SAFE_INTEGER;
  if (from === to) return 0;
  if (a.siteId !== b.siteId) return world.region ? Number.MAX_SAFE_INTEGER : 15840;
  const tileFt = content.sites?.[a.siteId]?.tile_ft ?? 10;
  const halfTiles = Math.abs(2 * a.x + a.w - (2 * b.x + b.w)) + Math.abs(2 * a.y + a.h - (2 * b.y + b.h));
  return Math.ceil((halfTiles * tileFt) / 2);
}

// ---- conservation (13 §1 rule 3) -----------------------------------------------------------

/** An account a fae transaction names: a location (deep) and, optionally, whose cash. */
export interface Account {
  loc: ItemLocation;
  cashOf?: { kind: 'actor'; id: ActorId } | { kind: 'household'; id: HouseholdId };
}
export interface Ledger {
  units: Record<string, number>;
  cents: number;
}
function measure(world: World, accounts: readonly Account[]): Ledger {
  const units: Record<string, number> = {};
  const seen = new Set<number>();
  for (const a of accounts)
    for (const { stack } of stacksDeep(world, a.loc)) {
      if (seen.has(stack.id)) continue;
      seen.add(stack.id);
      units[stack.defId] = (units[stack.defId] ?? 0) + stack.qty;
    }
  let cents = 0;
  for (const a of accounts) {
    if (a.cashOf?.kind === 'actor') cents += world.provisions.purses[a.cashOf.id] ?? 0;
    else if (a.cashOf?.kind === 'household') cents += world.provisions.households[a.cashOf.id]?.cashCents ?? 0;
  }
  return { units, cents };
}

/** Optional observer for tests and audits: every transaction's before/after over its accounts. */
export type ConservationProbe = (r: { label: string; before: Ledger; after: Ledger; ok: boolean }) => void;
let probe: ConservationProbe | null = null;
export function setConservationProbe(p: ConservationProbe | null): void {
  probe = p;
}

/**
 * Run one fae effect resolution as one transaction (13 §1 rule 3): the total remaining material
 * quantity per def and spendable money across exactly the named accounts must not increase.
 * Splitting is allowed. A violation is a bug: it throws, so no world ever holds minted goods.
 */
export function transact<T>(world: World, label: string, accounts: readonly Account[], run: () => T): T {
  const before = measure(world, accounts);
  const out = run();
  const after = measure(world, accounts);
  let ok = after.cents <= before.cents;
  for (const def of Object.keys(after.units)) if ((after.units[def] ?? 0) > (before.units[def] ?? 0)) ok = false;
  probe?.({ label, before, after, ok });
  if (!ok) throw new Error(`fae conservation violated: ${label}`);
  return out;
}

/** The derived predicate of a charm claim (13 §5.3; mirrors the content derivation). */
export function claimPredicateOf(itemDefId: string, claimId: string): string {
  return `claim.${itemDefId}.${claimId}`;
}
