/** Hourly storage and scheduled supplies. Shared with the forward readiness projection. */

import { isAsleep } from '../activity/api.ts';
import type { ProtectionId } from '../content.ts';
import { term } from '../explain.ts';
import { type HemSet, hemmed, openHemHour, spillHems } from '../fae/hem.ts';
import { type ItemId, rowsOf } from '../ids.ts';
import {
  allStacks,
  campThermal,
  consumeStack,
  consumeSupply,
  createStack,
  deleteStack,
  inventoryIndex,
  supplyUnits,
} from '../items/api.ts';
import { protectionsOf, rootLocation } from '../items/containers.ts';
import { recordProvenance } from '../items/state.ts';
import { mixKey } from '../rng.ts';
import { TICKS_PER_HOUR } from '../sim/clock.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { mealExplain } from './meals.ts';
import { BEDTIME_HOUR, VERMIN_BLOCKERS, VERMIN_DAILY_PERMILLE } from './rules.ts';
import { advanceSpoilage, isOutdoorsPlace, type StorageClass, spoilageFactors, storageClassOf } from './spoilage.ts';
import { isRaining } from './temperature.ts';

/**
 * Where each stack sits, cached by stack id. Only for the planner's projection, where no stack
 * moves within a pass (new stacks are computed on first sight). The live sim passes none.
 */
export type PlacementMemo = Record<
  number,
  { exposed: boolean; protections: ProtectionId[]; storage: StorageClass } | undefined
>;

/**
 * One hour of storage: rain, drying, spoilage, vermin. `hems` (13 §5.8 Rain-Hem) covers hemmed
 * containers and spills their turned rain; the live sim passes the fae hem set and commits it
 * afterwards, the planner passes its own projected copy.
 */
export function storageHour(
  world: World,
  ctx: SimContext,
  memo?: PlacementMemo,
  hems?: HemSet,
  forecastVermin?: (food: string, riskPm: number) => void,
): void {
  const raining = isRaining(ctx.seed, ctx.cal, world);
  const campShelter = new Map<number, boolean>();
  if (raining) {
    const index = inventoryIndex(world);
    for (const actor of rowsOf(world.actors)) {
      const activity = ctx.content.activities[world.activity.byActor[actor.id]?.activityId ?? ''];
      if (actor.alive && !world.activity.byActor[actor.id]?.travel && (activity?.asleep || activity?.labor === 'rest'))
        campShelter.set(actor.id, campThermal(world, ctx.content, actor.id, true, index).shelter >= 20);
    }
  }
  const rootPlace = (stackId: ItemId): { exposed: boolean; underFly: boolean } => {
    const st = world.items.stacks[stackId];
    if (!st) return { exposed: false, underFly: false };
    const root = rootLocation(world, st);
    const place =
      root.kind === 'actor'
        ? world.actors[root.actorId]?.placeId
        : root.kind === 'household'
          ? world.households[root.householdId]?.homePlaceId
          : root.placeId;
    return {
      exposed: place !== undefined && isOutdoorsPlace(world.places[place]?.kind ?? 'wild'),
      underFly: root.kind === 'actor' && campShelter.get(root.actorId) === true,
    };
  };
  const hemsOn = raining && hems !== undefined && Object.keys(hems.byContainer).length > 0;
  // Every hour, rain or not: a dry hour ends a hem's block (13 §5.8), so a later shower pays anew.
  if (hems && Object.keys(hems.byContainer).length > 0)
    openHemHour(world, ctx.content, hems, (id) => {
      if (!raining) return false;
      const r = rootPlace(id);
      return r.exposed && !r.underFly;
    });
  for (const stack of allStacks(world)) {
    const def = ctx.content.items[stack.defId];
    if (!def) continue;
    let placed = memo?.[stack.id];
    if (!placed) {
      const root = rootLocation(world, stack);
      const place =
        root.kind === 'actor'
          ? world.actors[root.actorId]?.placeId
          : root.kind === 'household'
            ? world.households[root.householdId]?.homePlaceId
            : root.placeId;
      placed = {
        exposed: place !== undefined && isOutdoorsPlace(world.places[place]?.kind ?? 'wild'),
        protections: protectionsOf(world, ctx.content, stack),
        storage: storageClassOf(world, ctx.content, stack),
      };
      if (memo) memo[stack.id] = placed;
    }
    const exposed = placed.exposed;
    const protections = placed.protections;
    const root = raining ? rootLocation(world, stack) : null;
    const underFly = root?.kind === 'actor' && campShelter.get(root.actorId);
    if (raining && !underFly && exposed && !protections.includes('waterproof') && !protections.includes('airtight')) {
      // A hemmed container turns the rain; what is already wet inside stays wet (13 §5.8).
      if (!(hemsOn && hemmed(world, hems, stack.id)))
        stack.wetness = Math.min(100, stack.wetness + (protections.includes('splashproof') ? 3 : 20));
    } else if (!protections.includes('airtight')) stack.wetness = Math.max(0, stack.wetness - 4);
    if (!def.food) continue;
    const factors = spoilageFactors(world, ctx.content, stack, ctx.cal, placed);
    if (!factors) continue;
    stack.frozen = factors.band === 'frozen';
    advanceSpoilage(stack, def.food, factors, 60);
    if (def.food.spoilage.frozen_ruins && factors.band === 'frozen') stack.spoilage = 1000;
    if (stack.spoilage >= 1000) {
      const into = def.food.spoilage.spoils_to ?? null;
      const qty = stack.qty,
        location = stack.location;
      const ev = ctx.emit({
        kind: 'provisions.spoiled',
        data: { itemId: stack.id, defId: stack.defId, qty, into },
        visibility: 'public',
        explain: mealExplain('Food spoiled', [], 1000, [
          term('weather', `Temperature band ${factors.band} (${factors.storageTempF} F) percent`, factors.tempPct),
          term('item', 'Wet multiplier percent', factors.wetPct),
          term('item', 'Packaging multiplier percent', factors.packPct),
          ...factors.packClasses.map((p) => term('item', `Packaging ${p.cls} percent`, p.pct)),
          term('item', 'Shelf life days', def.food.shelf_life_days),
        ]),
      });
      recordProvenance(stack, ev);
      deleteStack(world, stack.id);
      if (into && ctx.content.items[into]) {
        const newServings = ctx.content.items[into]?.food?.servings ?? def.food.servings;
        const consumedPm = Math.floor(
          ((stack.partial * 1000 + (stack.foodPartialPm ?? 0)) * newServings) / def.food.servings,
        );
        createStack(world, { ...ctx, emit: (event) => ctx.emit({ ...event, causes: [ev] }) }, into, qty, location, {
          partial: Math.floor(consumedPm / 1000),
          foodPartialPm: consumedPm % 1000,
        });
      }
      continue;
    }
    if (ctx.isNewDay && def.food.spoilage.vermin && !VERMIN_BLOCKERS.some((p) => protections.includes(p))) {
      const risk = VERMIN_DAILY_PERMILLE[placed.storage] ?? 0;
      if (forecastVermin) {
        forecastVermin(def.name, risk);
        continue;
      }
      const r = ctx.rng('spoilage', mixKey(stack.id, 0x6d696365));
      const roll = r.int(1, 1000);
      if (roll <= risk) {
        const qty = Math.max(1, Math.floor(stack.qty / 20));
        consumeStack(world, ctx, stack.id, qty, 'vermin');
        ctx.emit({
          kind: 'provisions.vermin',
          data: { itemId: stack.id, defId: stack.defId, qty },
          explain: {
            ...mealExplain(
              'Mice in unprotected stores',
              [],
              risk,
              [term('storage', 'Daily vermin risk per mille', risk)],
              'loss',
            ),
            roll: { die: 1000, natural: roll },
            dc: { total: risk, terms: [] },
          },
        });
      }
    }
  }
  if (hemsOn && hems)
    spillHems(
      world,
      ctx.content,
      hems,
      (id) => {
        const st = world.items.stacks[id];
        if (!st) return false;
        const r = rootPlace(id);
        const prot = protectionsOf(world, ctx.content, st);
        const own = ctx.content.items[st.defId]?.container?.protects ?? [];
        return r.exposed && !r.underFly && ![...prot, ...own].some((p) => p === 'waterproof' || p === 'airtight');
      },
      (id) => {
        const st = world.items.stacks[id];
        if (!st) return;
        const prot = protectionsOf(world, ctx.content, st);
        if (prot.includes('waterproof') || prot.includes('airtight')) return;
        st.wetness = Math.min(100, st.wetness + (prot.includes('splashproof') ? 3 : 20));
      },
    );
}

/** Atomic supply draw: devices do not grant light when they cannot sustain this hour. */
export function devicesHour(world: World, ctx: SimContext, elapsedTicks?: number): void {
  const inventory = inventoryIndex(world);
  for (const stack of allStacks(world)) {
    const def = ctx.content.items[stack.defId];
    const consumes = def?.consumes.filter((c) => c.per === 'hour' || c.per === 'day') ?? [];
    if (!def || !consumes.length) continue;
    const loc = rootLocation(world, stack);
    const owner = loc.kind === 'actor' ? world.actors[loc.actorId] : undefined;
    const live = !!owner && !!world.tactical?.frame?.live.includes(owner.id);
    if (elapsedTicks === undefined ? live : !live) continue;
    const awake = owner
      ? !isAsleep(world, ctx, owner.id)
      : rowsOf(world.actors).some(
          (a) =>
            a.alive &&
            !isAsleep(world, ctx, a.id) &&
            (loc.kind === 'household'
              ? a.householdId === loc.householdId && world.households[loc.householdId]?.homePlaceId === a.placeId
              : loc.kind === 'place' && a.placeId === loc.placeId),
        );
    const wanted =
      stack.litMode === 'on' ||
      (stack.litMode === 'auto' && !ctx.cal.isDaylight && ctx.cal.hour < BEDTIME_HOUR && awake);
    const requirements: Record<string, number> = {};
    const nextCarry = { ...stack.supplyCarry };
    for (const c of consumes) {
      let units = c.units;
      if (elapsedTicks !== undefined) {
        world.provisions.tacticalCarry ??= {};
        const key = `device:${stack.id}:${c.kind}`;
        const denominator = TICKS_PER_HOUR * (c.per === 'day' ? 24 : 1);
        const accumulated = (world.provisions.tacticalCarry[key] ?? 0) + c.units * elapsedTicks;
        units = Math.floor(accumulated / denominator);
        if (wanted) world.provisions.tacticalCarry[key] = accumulated % denominator;
      } else if (c.per === 'day') {
        const accumulated = (nextCarry[c.kind] ?? 0) + c.units;
        units = Math.floor(accumulated / 24);
        nextCarry[c.kind] = accumulated % 24;
      }
      requirements[c.kind] = (requirements[c.kind] ?? 0) + units;
    }
    const supplied = Object.entries(requirements).every(
      ([kind, units]) => supplyUnits(world, ctx.content, loc, kind, inventory) >= Math.max(1, units),
    );
    let lit = wanted && supplied && stack.condition > 0;
    if (wanted && !supplied) {
      // Burn the last partial oil/candle; the device is dark for the remainder of the hour.
      for (const [kind, units] of Object.entries(requirements)) {
        const used = consumeSupply(world, ctx.content, loc, kind, units, inventory);
        if (used)
          ctx.emit({
            kind: 'provisions.supply_used',
            data: { itemId: stack.id, kind, units: used },
            explain: mealExplain('Last device supply', [], used),
          });
      }
    }
    if (lit && consumes.some((c) => c.per === 'day')) stack.supplyCarry = nextCarry;
    // Routine burning (oil by the hour while lit) is silent; the stack's lit flag and supply show it,
    // and running out is logged below.
    if (lit)
      for (const [kind, units] of Object.entries(requirements))
        consumeSupply(world, ctx.content, loc, kind, units, inventory);
    const exhausted =
      lit && Object.keys(requirements).some((kind) => supplyUnits(world, ctx.content, loc, kind, inventory) === 0);
    if (exhausted) lit = false;
    if (exhausted || (wanted && !supplied && stack.lit))
      ctx.emit({
        kind: 'items.depleted',
        data: {
          itemId: stack.id,
          defId: stack.defId,
          kind:
            consumes.find((c) => supplyUnits(world, ctx.content, loc, c.kind, inventory) < c.units)?.kind ?? 'supply',
          wasLit: true,
        },
        explain: mealExplain('Device supply depleted', [], 0, [], 'depleted'),
      });
    // Lamps lit at dusk and put out at bedtime are routine: only a light that fails is news.
    if ((lit !== stack.lit && wanted && !lit) || (wanted && !supplied && stack.lit))
      ctx.emit({
        kind: 'provisions.light',
        data: {
          itemId: stack.id as ItemId,
          lit,
          reason: !wanted ? 'schedule' : supplied && !exhausted ? 'lit' : 'supply depleted',
        },
        explain: mealExplain('Device lighting', [], lit ? 1 : 0, [], lit ? 'lit' : 'dark'),
      });
    stack.lit = lit;
  }
}
