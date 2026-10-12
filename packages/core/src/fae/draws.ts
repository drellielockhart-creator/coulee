/**
 * The Never-Empty Sack's dawn draw (13 §5.2, §5.8). OWNER: module:fae.
 *
 * In the dawn hour (fae runs before provisions, so breakfast sees the flour), a charm tied shut
 * overnight in the dark and not opened, with virtue, unsuppressed by iron and not sulking,
 * moves whole units of a listed def from the nearest eligible source within its radius into
 * itself: one source per dawn, min(qty, room, units there). One effect resolution is one
 * transaction under the conservation rule. The draw is physical at once and known later: the
 * only writes are the stacks, the charm's ledger and the source's private draw case.
 */
import type { CharmDef, CharmEffectDef } from '@coulee/content/schema';
import type { ContentBundle } from '../content.ts';
import { type ExplainTerm, term } from '../explain.ts';
import type { HouseholdId, ItemId, PlaceId } from '../ids.ts';
import { rowsOf } from '../ids.ts';
import { binIron, inventoryIndex, moveStack, pantryOf, stacksDeep } from '../items/api.ts';
import { fitsInContainer, sameLoc } from '../items/containers.ts';
import type { ItemLocation, ItemStack } from '../items/state.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { effectiveFi } from './api.ts';
import {
  caseTable,
  charmDefOf,
  charmIds,
  charmLive,
  feetBetween,
  holdingOf,
  ironOn,
  transact,
  unitsInside,
} from './charms.ts';
import type { CharmState, DrawCase } from './state.ts';

type DrawEffect = Extract<CharmEffectDef, { kind: 'draw' }>;

export function drawEffectOf(def: CharmDef | undefined): DrawEffect | undefined {
  return def?.effects.find((e): e is DrawEffect => e.kind === 'draw');
}

/** The dawn hour: the hour that holds sunrise. */
export function isDawnHour(ctx: Pick<SimContext, 'cal'>): boolean {
  return ctx.cal.hour === Math.floor(ctx.cal.sunriseMinute / 60);
}

export interface DrawSource {
  stack: ItemStack;
  loc: ItemLocation;
  placeId: PlaceId;
  source: DrawCase['source'];
  householdId: HouseholdId | null;
  feet: number;
  ironTerms: ExplainTerm[];
  /** Nearer sources passed over, and why (for the omniscient Explain). */
  passed: string[];
}

/** Owner household of a stocked place: its residents, else a business head working there. */
function placeOwner(world: World, placeId: PlaceId): HouseholdId | null {
  const store = world.provisions.stores[placeId];
  if (store?.ownerHouseholdId !== undefined && store.ownerHouseholdId !== null) return store.ownerHouseholdId;
  for (const h of rowsOf(world.households)) if (h.homePlaceId === placeId) return h.id;
  return null;
}

/**
 * The nearest eligible stack of a listed def (13 §5.2 step 2): by place distance, ties by place
 * id, then place stock before household stores, then stack id. Inside the radius, not in an
 * `iron_lined` container and under the ward weight of Iron Presence at its bin. The charm's own
 * holder is never a source. Pure.
 */
export function findDrawSource(
  world: World,
  content: ContentBundle,
  charmStack: ItemStack,
  eff: DrawEffect,
): DrawSource | null {
  const holding = holdingOf(world, charmStack);
  const origin = holding.placeId;
  if (origin === null) return null;
  const radiusFt = eff.radius_mi * 5280;
  const places = rowsOf(world.places)
    .map((p) => ({ p, feet: feetBetween(world, content, origin, p.id) }))
    .filter((x) => x.feet <= radiusFt)
    .sort((a, b) => a.feet - b.feet || a.p.id - b.p.id);
  const homes: Record<number, HouseholdId[]> = {};
  for (const h of rowsOf(world.households)) {
    const list = homes[h.homePlaceId] ?? [];
    list.push(h.id);
    homes[h.homePlaceId] = list;
  }
  const index = inventoryIndex(world);
  const passed: string[] = [];
  const allowHousehold = eff.from.includes('household') || eff.from.includes('club_pantry');
  for (const { p, feet } of places) {
    const locs: Array<{ loc: ItemLocation; source: DrawCase['source']; householdId: HouseholdId | null }> = [];
    const stockKind =
      (eff.from.includes('store') && p.tags.includes('store')) ||
      (eff.from.includes('mill') && p.tags.includes('mill'));
    if (stockKind && world.provisions.stores[p.id])
      locs.push({
        loc: { kind: 'place', placeId: p.id },
        source: { kind: 'place', id: p.id },
        householdId: placeOwner(world, p.id),
      });
    if (allowHousehold)
      for (const hid of homes[p.id] ?? [])
        locs.push({ loc: pantryOf(hid), source: { kind: 'household', id: hid }, householdId: hid });
    for (const l of locs) {
      if (sameLoc(l.loc, holding.root)) continue;
      if (holding.householdId !== null && l.source.kind === 'household' && l.source.id === holding.householdId)
        continue;
      for (const { stack } of stacksDeep(world, l.loc, index)) {
        if (!eff.defs.includes(stack.defId) || availableUnits(stack) < 1) continue;
        const iron = binIron(world, content, stack, index);
        if (iron.ironLined || iron.grams >= eff.ward_g) {
          if (passed.length < 6)
            passed.push(
              `${world.places[p.id]?.name ?? p.id}: warded (${iron.ironLined ? 'iron-lined' : `${iron.grams} g iron`})`,
            );
          continue;
        }
        return {
          stack,
          loc: l.loc,
          placeId: p.id,
          source: l.source,
          householdId: l.householdId,
          feet,
          ironTerms: iron.terms,
          passed,
        };
      }
    }
  }
  return null;
}

/** Whole units a draw may take: a partly used top unit stays with the source (13 §1 rule 3). */
export function availableUnits(stack: ItemStack): number {
  return Math.max(0, stack.qty - (stack.partial > 0 || (stack.foodPartialPm ?? 0) > 0 ? 1 : 0));
}

/** Most whole units of `stack` the container takes, up to `want`. */
function roomFor(world: World, content: ContentBundle, stack: ItemStack, want: number, container: ItemStack): number {
  for (let n = want; n >= 1; n--) if (fitsInContainer(world, content, stack, n, container).ok) return n;
  return 0;
}

export function sourceKey(s: DrawCase['source']): string {
  return `${s.kind === 'household' ? 'h' : 'p'}${s.id}`;
}

export type DawnOutcome = { kind: 'drew'; qty: number; source: DrawSource } | { kind: 'idle'; reason: string };

/** Whether the tie held overnight in the dark (13 §5.8 activation). */
export function tieHeld(
  world: World,
  c: CharmState,
  def: CharmDef,
  ctx: Pick<SimContext, 'now' | 'cal'>,
): string | null {
  if (!c.tie) return 'not tied overnight';
  const dawnAt = ctx.now - (ctx.now % 1440) + ctx.cal.sunriseMinute;
  if (c.tie.at > dawnAt - 240) return 'tied too late to sit the night';
  if (c.tie.at < dawnAt - 1440) return 'the tie is from another night';
  const eff = drawEffectOf(def);
  if (eff && unitsInside(world, c.itemId, eff.defs) < c.tie.units) return 'opened before cockcrow';
  return null;
}

/** One charm's dawn. Returns what happened; the caller logs. */
export function dawnDraw(world: World, ctx: SimContext, c: CharmState): DawnOutcome {
  const def = charmDefOf(ctx.content, c.defId);
  const eff = drawEffectOf(def);
  const stack = world.items.stacks[c.itemId];
  if (!def || !eff || !stack) return { kind: 'idle', reason: 'no draw' };
  const tie = tieHeld(world, c, def, ctx);
  c.tie = null; // a tie is spent by the dawn whatever comes of it
  if (!charmLive(c)) return { kind: 'idle', reason: 'dormant' };
  if (tie) return { kind: 'idle', reason: tie };
  if (c.virtue < eff.virtue) return { kind: 'idle', reason: 'no virtue' };
  if (c.rechargeBlockedUntil > ctx.now) return { kind: 'idle', reason: 'sulking (thanked aloud)' };
  const holding = holdingOf(world, stack);
  if (holding.placeId !== null && effectiveFi(world, holding.placeId, ctx.now) < def.minimum_fi)
    return { kind: 'idle', reason: 'too little Faerie here' };
  if (ironOn(world, ctx.content, stack, def).suppressed) return { kind: 'idle', reason: 'iron in contact' };
  const src = findDrawSource(world, ctx.content, stack, eff);
  if (!src) return { kind: 'idle', reason: 'no source in reach' };
  const qty = roomFor(world, ctx.content, src.stack, Math.min(eff.qty, availableUnits(src.stack)), stack);
  if (qty < 1) return { kind: 'idle', reason: 'no room' };
  const into: ItemLocation = { kind: 'container', itemId: c.itemId as ItemId };
  transact(world, `draw ${c.defId}#${c.itemId}`, [{ loc: src.loc }, { loc: into }], () =>
    moveStack(world, ctx, src.stack.id, qty, into),
  );
  c.virtue -= eff.virtue;
  c.lastUseAt = ctx.now;
  c.lastDrawDay = ctx.cal.dayIndex;
  const key = sourceKey(src.source);
  c.drawLedger[key] = (c.drawLedger[key] ?? 0) + qty;
  const def0 = src.stack.defId;
  const cases = caseTable(world);
  const id = `${c.itemId}:${key}:${def0}`;
  const dc: DrawCase = cases[id] ?? {
    id,
    itemId: c.itemId,
    source: src.source,
    householdId: src.householdId,
    placeId: src.placeId,
    def: def0,
    undiscovered: 0,
    discovered: 0,
    firstAt: ctx.now,
    lastAt: ctx.now,
    misfortuneId: null,
    lastEvidenceAt: null,
    accepted: false,
    traceUntil: 0,
    traceRolls: {},
  };
  cases[id] = dc;
  dc.undiscovered += qty;
  dc.lastAt = ctx.now;
  dc.traceUntil = ctx.now + 1440;
  dc.traceRolls = {};
  return { kind: 'drew', qty, source: src };
}

/** Run every charm's dawn (called by the fae system in the dawn hour). */
export function dawnHour(world: World, ctx: SimContext): void {
  for (const id of charmIds(world)) {
    const c = world.fae.charms?.[id];
    if (!c || !drawEffectOf(charmDefOf(ctx.content, c.defId))) continue;
    const out = dawnDraw(world, ctx, c);
    if (out.kind !== 'drew') continue;
    const s = out.source;
    ctx.emit({
      kind: 'fae.charm_drew',
      place: s.placeId,
      visibility: 'secret',
      data: {
        itemId: c.itemId,
        charm: c.defId,
        def: s.stack.defId,
        qty: out.qty,
        source: sourceKey(s.source),
        householdId: s.householdId,
        placeId: s.placeId,
      },
      explain: {
        kind: 'formula',
        label: `A draw at dawn: ${out.qty} lb of ${s.stack.defId} from ${world.places[s.placeId]?.name ?? 'somewhere'}`,
        subjects: [],
        knowledge: 'omniscient',
        terms: [
          term('fae', 'Distance (ft)', s.feet),
          term('fae', 'Units moved', out.qty),
          term('fae', 'Virtue left', c.virtue),
          ...s.ironTerms,
        ],
        total: out.qty,
        outcome: 'drew',
        ...(s.passed.length ? { note: `Passed over: ${s.passed.join('; ')}` } : {}),
      },
    });
  }
}
