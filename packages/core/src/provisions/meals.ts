import { walking } from '../activity/api.ts';
import { accessContents } from '../items/api.ts';
import { provisionCalendar as calendarAt } from './calendar.ts';
/** Shared meal kernel: runtime and readiness both consume this exact inventory/preparation model. */

import type { PrepDef } from '@coulee/content/schema';
import { reservePreparation } from '../activity/api.ts';
import { skillCheck } from '../checks.ts';
import type { ContentBundle, ItemDef } from '../content.ts';
import { type Explain, intValue, term } from '../explain.ts';
import { type ActorId, type HouseholdId, type ItemId, type PlaceId, rowsOf } from '../ids.ts';
import {
  carriedBy,
  consumeStackSupply,
  consumeSupply,
  deleteStack,
  type InventoryIndex,
  inventoryIndex,
  pantryOf,
  stackAffordance,
  stackSupplyUnits,
  stacksDeep,
} from '../items/api.ts';
import { rootLocation, sameLoc } from '../items/containers.ts';
import { type ItemLocation, type ItemStack, newStack, recordProvenance } from '../items/state.ts';
import { canAct, drink, feed, litHearthAt, needValue, satisfyNeed } from '../needs/api.ts';
import { authorizeAct, commandBasis } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { asGameMinute, yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import { nutritionTargets } from './nutrition.ts';
import {
  agePct,
  BASE_KCAL_PER_DAY,
  MAX_SHARE_PCT,
  mealPlanFor,
  peopleKcalPct,
  policyFor,
  SIDE_KCAL_MAX,
  TURNING_MORALE,
} from './rules.ts';
import { spoilageFactors } from './spoilage.ts';
import { emptyNutrition, type PendingMeal, type PendingPlate } from './state.ts';
import { airTempF } from './temperature.ts';

export type Holder = { actorId: ActorId } | { householdId: HouseholdId };
export const locationOf = (h: Holder): ItemLocation =>
  'actorId' in h ? carriedBy(h.actorId) : pantryOf(h.householdId);

// Only the stationary readiness copy opts in: its membership, locations and scheduled
// energy inputs do not change. Nothing is cached for live meals or travel projections.
const projectionMeals = new Map<
  World,
  { members: Map<string, ActorId[]>; locations: Map<string, ItemLocation[]>; energy: Map<string, number> }
>();
const holderKey = (h: Holder): string => ('actorId' in h ? `a${h.actorId}` : `h${h.householdId}`);
export function withProjectionMeals<T>(world: World, run: () => T): T {
  const previous = projectionMeals.get(world);
  projectionMeals.set(world, { members: new Map(), locations: new Map(), energy: new Map() });
  try {
    return run();
  } finally {
    if (previous) projectionMeals.set(world, previous);
    else projectionMeals.delete(world);
  }
}

/** A lone householder's carried kit is part of the larder while they are home. */
export function holderLocations(world: World, holder: Holder): ItemLocation[] {
  const memo = projectionMeals.get(world)?.locations;
  const key = memo ? holderKey(holder) : '';
  const cached = memo?.get(key);
  if (cached) return cached;
  const locations = [locationOf(holder)];
  if ('householdId' in holder) {
    const members = membersOf(world, holder);
    const id = members.length === 1 ? members[0] : undefined;
    if (id !== undefined && world.actors[id]?.placeId === world.households[holder.householdId]?.homePlaceId)
      locations.push(carriedBy(id));
  }
  memo?.set(key, locations);
  return locations;
}
export function holderStacks(world: World, holder: Holder, index = inventoryIndex(world)): ItemStack[] {
  const stacks: ItemStack[] = [];
  for (const loc of holderLocations(world, holder))
    for (const entry of stacksDeep(world, loc, index)) stacks.push(entry.stack);
  return stacks;
}
export function holderSupply(
  world: World,
  content: ContentBundle,
  holder: Holder,
  kind: string,
  index = inventoryIndex(world),
): number {
  return holderStacks(world, holder, index).reduce((n, stack) => n + stackSupplyUnits(content, stack, kind), 0);
}

/** The schedule's full day burn, avoiding the noon-labor/overnight-labor estimate discontinuity. */
export function dailyKcal(world: World, content: ContentBundle, id: ActorId, now: number): number {
  const memo = projectionMeals.get(world)?.energy;
  const key = memo ? `${Math.floor(now / 1440)}:${id}` : '';
  const cached = memo?.get(key);
  if (cached !== undefined) return cached;
  const kcal = dailyKcalParts(world, content, id, now, false).kcal;
  memo?.set(key, kcal);
  return kcal;
}

/** Hours and energy of one scheduled day by labor class (P1: why the daily need is what it is). */
export interface DailyNeedParts {
  kcal: number;
  /** Hours per labor class awake, plus asleep hours, and the activities filling them. */
  hours: { heavy: number; light: number; rest: number; asleep: number };
  kcalBy: { heavy: number; light: number; rest: number; asleep: number };
  /** Hours whose weather multiplier was not 100%. */
  weatherHours: number;
  /** Activity name -> hours, in schedule order of first appearance. */
  activities: Array<{ name: string; labor: string; hours: number }>;
  /** Values, traits and physiology together, percent. */
  personPct: number;
}

/** The same loop as dailyKcal (one implementation), optionally keeping the breakdown. */
export function dailyKcalParts(
  world: World,
  content: ContentBundle,
  id: ActorId,
  now: number,
  detail = true,
): DailyNeedParts {
  const parts: DailyNeedParts = {
    kcal: 0,
    hours: { heavy: 0, light: 0, rest: 0, asleep: 0 },
    kcalBy: { heavy: 0, light: 0, rest: 0, asleep: 0 },
    weatherHours: 0,
    activities: [],
    personPct: 100,
  };
  const a = world.actors[id];
  if (!a?.alive) return parts;
  const cal = calendarAt(asGameMinute(now));
  const schedule = content.occupations[a.occupationId]?.schedule ?? [];
  const hunger = Object.values(content.needs).find((n) => n.intake?.unit === 'kcal');
  if (!hunger?.intake) {
    parts.kcal = BASE_KCAL_PER_DAY;
    return parts;
  }
  // These factors are constant across the 24 schedule slots. Keep multiplication
  // order below unchanged: rounding the hourly result is part of the food rules.
  let values = 100;
  for (const clause of hunger.value_pct) values += clause.per_step_pct * a.values[clause.value];
  const valueFactor = Math.max(0, values) / 100;
  const physiology = (agePct(yearsBetween(a.born, cal.t)) * peopleKcalPct(content.peoples[a.ancestryId])) / 10000;
  if (detail) {
    let person = valueFactor * physiology;
    for (const trait of a.traits) person *= (hunger.trait_pct[trait] ?? 100) / 100;
    parts.personPct = Math.round(person * 100);
  }
  let total = 0;
  const hourlyCal = { ...cal };
  for (let hour = 0; hour < 24; hour++) {
    const block = schedule.find(
      (b) =>
        (!b.days || b.days.includes(cal.weekday)) &&
        (!b.seasons || b.seasons.includes(cal.season)) &&
        (!b.months || b.months.includes(cal.month)) &&
        (b.from < b.to ? hour >= b.from && hour < b.to : hour >= b.from || hour < b.to),
    );
    const activity = block ? content.activities[block.activity] : undefined;
    let points =
      ((hunger.decay_per_hour * hunger.labor_pct[activity?.labor ?? 'light']) / 100) *
      (activity?.asleep ? hunger.asleep_pct / 100 : 1);
    points *= valueFactor;
    for (const trait of a.traits) points *= (hunger.trait_pct[trait] ?? 100) / 100;
    points *= physiology;
    hourlyCal.hour = hour;
    const air = airTempF(hourlyCal, world);
    let weather = 100;
    for (const clause of hunger.temperature_pct)
      if (
        (clause.below_f === undefined || air < clause.below_f) &&
        (clause.above_f === undefined || air > clause.above_f)
      )
        weather += clause.pct - 100;
    const kcal = Math.round((points * Math.max(0, weather)) / 100) * hunger.intake.per_point;
    total += kcal;
    if (detail) {
      const labor = activity?.asleep ? 'asleep' : (activity?.labor ?? 'light');
      parts.hours[labor]++;
      parts.kcalBy[labor] += kcal;
      if (weather !== 100) parts.weatherHours++;
      const name = activity?.name ?? 'Unscheduled';
      const row = parts.activities.find((r) => r.name === name);
      if (row) row.hours++;
      else parts.activities.push({ name, labor, hours: 1 });
    }
  }
  parts.kcal = Math.round(total);
  return parts;
}

/** P1: the daily energy need as an Explain with its named hours (labor, sleep, weather, person). */
export function dailyNeedExplain(world: World, content: ContentBundle, id: ActorId, now: number): Explain {
  const p = dailyKcalParts(world, content, id, now);
  const cal = calendarAt(asGameMinute(now));
  return {
    kind: 'formula',
    label: `Daily energy need (${cal.weekday}): the occupation's scheduled day`,
    subjects: [id],
    knowledge: 'self',
    terms: [
      term('labor', `Heavy labor ${p.hours.heavy} h, kcal`, p.kcalBy.heavy),
      term('labor', `Light labor ${p.hours.light} h, kcal`, p.kcalBy.light),
      term('labor', `Resting ${p.hours.rest} h, kcal`, p.kcalBy.rest),
      term('labor', `Asleep ${p.hours.asleep} h, kcal`, p.kcalBy.asleep),
      term('weather', 'Hours with a weather multiplier', p.weatherHours),
      term('person', 'Values, traits, age and people percent', p.personPct),
    ],
    total: p.kcal,
    outcome: 'projected',
    note: `Scheduled: ${p.activities.map((a) => `${a.name} ${a.hours} h`).join(', ')}. Carried load costs rest, not food.`,
  };
}

export function membersOf(world: World, holder: Holder): ActorId[] {
  const memo = projectionMeals.get(world)?.members;
  const key = memo ? holderKey(holder) : '';
  const cached = memo?.get(key);
  if (cached) return cached;
  const members =
    'actorId' in holder
      ? world.actors[holder.actorId]?.alive
        ? [holder.actorId]
        : []
      : rowsOf(world.actors)
          .filter((a) => a.alive && a.householdId === holder.householdId)
          .map((a) => a.id);
  memo?.set(key, members);
  return members;
}
export function rationOf(world: World, holder: Holder): number {
  return 'actorId' in holder
    ? (world.provisions.nutrition[holder.actorId]?.rationPct ?? 100)
    : (world.provisions.households[holder.householdId]?.rationPct ?? 100);
}
export function foodServings(content: ContentBundle, stack: ItemStack): number {
  const food = content.items[stack.defId]?.food;
  return food && stack.condition > 0 && stack.spoilage < 1000
    ? Math.max(0, stack.qty * food.servings - stack.partial - (stack.foodPartialPm ?? 0) / 1000)
    : 0;
}
export function holderOfActor(world: World, id: ActorId): Holder {
  const a = world.actors[id];
  const home = a && world.households[a.householdId];
  // Meals away from home use the personal pack. An empty pack does not grant access to a distant larder.
  return a && home && a.placeId === home.homePlaceId ? { householdId: a.householdId } : { actorId: id };
}

export interface Recipe {
  food: NonNullable<ItemDef['food']>;
  defId: string;
  steps: PrepDef[];
  missing: string[];
  fire: number;
  water: number;
  minutes: number;
  activeMinutes: number;
  morale: number;
  kcal: number;
  units: number;
}

/** Natural water (content: the water need's `sources` tags): springs, creeks, rivers, fords. */
export function isWaterSource(world: World, content: ContentBundle, placeId: PlaceId | undefined): boolean {
  const place = placeId === undefined ? undefined : world.places[placeId];
  if (!place) return false;
  let tags: readonly string[] = ['water'];
  for (const key in content.needs) {
    const need = content.needs[key];
    if (need?.intake?.unit === 'ml' && need.sources?.length) tags = need.sources;
  }
  return place.tags.some((t) => tags.includes(t));
}

/** Household water is hauled daily; travelers need stored water or a water source at their place. */
export function waterAvailable(world: World, content: ContentBundle, holder: Holder, index?: InventoryIndex): number {
  if ('householdId' in holder) {
    const carried = holderLocations(world, holder).find((loc) => loc.kind === 'actor');
    return (
      (world.provisions.households[holder.householdId]?.waterMl ?? 0) +
      (carried?.kind === 'actor' ? waterAvailable(world, content, { actorId: carried.actorId }, index) : 0)
    );
  }
  const actor = world.actors[holder.actorId];
  if (actor && isWaterSource(world, content, actor.placeId)) return 100_000;
  // Supply and vessel water share the same inventory traversal.
  return stacksDeep(world, locationOf(holder), index).reduce(
    (n, { stack }) => n + stackSupplyUnits(content, stack, 'water') + (stack.waterMl ?? 0),
    0,
  );
}
export function drawWater(
  world: World,
  content: ContentBundle,
  holder: Holder,
  ml: number,
  index?: InventoryIndex,
): void {
  if ('householdId' in holder) {
    const h = world.provisions.households[holder.householdId];
    const fromHome = Math.min(h?.waterMl ?? 0, ml);
    if (h) h.waterMl -= fromHome;
    const carried = holderLocations(world, holder).find((loc) => loc.kind === 'actor');
    if (ml > fromHome && carried?.kind === 'actor')
      drawWater(world, content, { actorId: carried.actorId }, ml - fromHome, index);
    return;
  }
  const actor = world.actors[holder.actorId];
  if (actor && isWaterSource(world, content, actor.placeId)) return;
  let remaining = ml - consumeSupply(world, content, locationOf(holder), 'water', ml, index);
  for (const { stack } of stacksDeep(world, locationOf(holder), index)) {
    const take = Math.min(stack.waterMl ?? 0, remaining);
    stack.waterMl = (stack.waterMl ?? 0) - take;
    remaining -= take;
    if (remaining <= 0) break;
  }
}

/**
 * What a kitchen or kit offers for preparation: fuel, water, and best cookware affordances (memoized).
 * One meal or one readiness pass builds it once instead of rescanning the inventory per recipe step.
 * Refresh fuel/water after anything consumes them.
 */
export interface Kitchen {
  fuel: number;
  water: number;
  frozen: (stack: ItemStack) => boolean;
  stacks: ItemStack[];
  index: InventoryIndex;
  placeId: import('../ids.ts').PlaceId | undefined;
  fireCredit: number;
  phaseStart: number;
  fireCost: (minutes: number) => number;
  ignition: string[];
  afford: (key: string) => number;
  refresh: () => void;
}
export function prepBudget(holder: Holder): number {
  return 'householdId' in holder ? 360 : 120;
}
export function kitchenOf(
  world: World,
  content: ContentBundle,
  holder: Holder,
  now = world.time,
  passIndex?: InventoryIndex,
): Kitchen {
  const index = passIndex ?? inventoryIndex(world);
  const stacks = holderStacks(world, holder, index);
  const placeId =
    'householdId' in holder ? world.households[holder.householdId]?.homePlaceId : world.actors[holder.actorId]?.placeId;
  const hearth = Object.keys(content.hearths ?? {})
    .sort()
    .map((key) => content.hearths[key])
    .find((h) => h?.place_tags.some((tag) => placeId !== undefined && world.places[placeId]?.tags.includes(tag)));
  const memo: Record<string, number> = {};
  for (const stack of stacks)
    for (const key of Object.keys(content.items[stack.defId]?.affordances ?? {}))
      memo[key] = Math.max(memo[key] ?? 0, stackAffordance(content, stack, key));
  const calendar = calendarAt(asGameMinute(world.time));
  const frozen = new Map<ItemId, boolean>();
  const fireCosts = new Map<string, number>();
  const k: Kitchen = {
    frozen: (stack) => {
      let value = frozen.get(stack.id);
      if (value === undefined) {
        value = stack.frozen || spoilageFactors(world, content, stack, calendar)?.band === 'frozen';
        frozen.set(stack.id, value);
      }
      return value;
    },
    fuel: 0,
    water: 0,
    stacks,
    index,
    placeId,
    fireCredit: 0,
    phaseStart: 0,
    fireCost: (minutes) => {
      if (minutes <= 0) return 0;
      const start = Math.max(k.phaseStart, k.fireCredit),
        end = k.phaseStart + minutes;
      if (start >= end) return 0;
      if (hearth?.fuel_kind !== 'fire') return end - start;
      if (hearth.fuel_from === 'free') return 0;
      const key = `${start}:${end}`;
      const cached = fireCosts.get(key);
      if (cached !== undefined) return cached;
      let fuel = 0;
      for (let offset = start; offset < end; ) {
        const t = now + offset,
          length = Math.min(end - offset, 60 - (t % 60));
        const air = airTempF(calendarAt(asGameMinute(t)), world);
        const hourly = hearth.burn_base + Math.floor((hearth.burn_per_10f * Math.max(0, hearth.ref_f - air)) / 10);
        fuel += Math.ceil((hourly * length) / 60);
        offset += length;
      }
      fireCosts.set(key, fuel);
      return fuel;
    },
    ignition: [],
    afford: (key) => memo[key] ?? 0,
    refresh: () => {
      k.fuel = stacks.reduce(
        (n, stack) => n + (world.items.stacks[stack.id] ? stackSupplyUnits(content, stack, 'fire') : 0),
        0,
      );
      k.water = waterAvailable(world, content, holder, index);
      const fire = placeId === undefined ? undefined : world.provisions.fires[placeId];
      k.fireCredit = Math.max(
        placeId !== undefined && litHearthAt(world, placeId) ? 60 : 0,
        fire?.lit ? Math.max(0, (fire.until ?? now + fire.fuelMinutes) - now) : 0,
      );
      k.ignition = ignitionMissing(world, content, k, now);
    },
  };
  k.refresh();
  return k;
}
function ignitionMissing(world: World, content: ContentBundle, kitchen: Kitchen, now: number): string[] {
  if (kitchen.fireCredit > 0) return [];
  const dry = kitchen.stacks.filter((s) => world.items.stacks[s.id] && s.wetness <= 20 && s.condition > 0);
  const starter = dry.some((s) => {
    const def = content.items[s.defId];
    return (
      (def?.affordances.ignite ?? 0) > 0 &&
      (!def?.tags.includes('sun_only') || calendarAt(asGameMinute(now)).isDaylight) &&
      (!def?.supply || stackSupplyUnits(content, s, def.supply.kind) > 0)
    );
  });
  const tinder = dry.some(
    (s) =>
      (content.items[s.defId]?.affordances.tinder ?? 0) > 0 &&
      (!content.items[s.defId]?.supply || stackSupplyUnits(content, s, content.items[s.defId]?.supply?.kind ?? '') > 0),
  );
  return [...(starter ? [] : ['ignition gear']), ...(tinder ? [] : ['dry tinder'])];
}
/** Reserve cooking fuel once, reusing the heating fire or another paid cooking fire. */
function cookingFire(world: World, ctx: SimContext, holder: Holder, kitchen: Kitchen, minutes: number): number {
  if (!minutes || kitchen.placeId === undefined) return 0;
  const needed = kitchen.fireCost(minutes);
  let ignition = 'existing fire';
  let kindling = 0;
  if (kitchen.fireCredit === 0) {
    const starters = kitchen.stacks.filter((s) => s.wetness <= 20 && s.condition > 0 && world.items.stacks[s.id]);
    const starter = starters.find((s) => {
      const d = ctx.content.items[s.defId];
      return (
        (d?.affordances.ignite ?? 0) > 0 &&
        (!d?.tags.includes('sun_only') || ctx.cal.isDaylight) &&
        (!d?.supply || stackSupplyUnits(ctx.content, s, d.supply.kind) > 0)
      );
    });
    const tinder = starters.find((s) => (ctx.content.items[s.defId]?.affordances.tinder ?? 0) > 0);
    if (!starter || !tinder) return 0;
    ignition = ctx.content.items[starter.defId]?.name ?? starter.defId;
    for (const supply of new Set([starter, tinder])) {
      const kind = ctx.content.items[supply.defId]?.supply?.kind;
      if (kind) consumeStackSupply(world, ctx.content, supply, kind, 1);
    }
    kindling = 10;
  }
  let used = 0;
  for (const loc of holderLocations(world, holder))
    used += consumeSupply(world, ctx.content, loc, 'fire', needed + kindling - used, kitchen.index);
  const fire = world.provisions.fires[kitchen.placeId] ?? { placeId: kitchen.placeId, lit: false, fuelMinutes: 0 };
  fire.lit = true;
  fire.until = ctx.now + Math.max(kitchen.fireCredit, kitchen.phaseStart + minutes);
  fire.fuelMinutes = fire.until - ctx.now;
  world.provisions.fires[kitchen.placeId] = fire;
  if (ignition !== 'existing fire')
    ctx.emit({
      kind: 'provisions.fire',
      data: { placeId: kitchen.placeId, lit: true, fuelMinutes: used, ignition },
      place: kitchen.placeId,
      visibility: 'public',
      explain: mealExplain(
        'Ignite cooking fire',
        membersOf(world, holder),
        used,
        [term('fuel', 'Kindling minutes', kindling), term('fuel', 'Cooking minutes', needed)],
        'lit',
      ),
    });
  return used;
}

/** Follow preparation yields to an edible endpoint; no item ids are special-cased, including coffee. */
export function recipesFor(
  world: World,
  content: ContentBundle,
  holder: Holder,
  stack: ItemStack,
  servings: number,
  cold = false,
  method?: string,
  budget = prepBudget(holder),
  kitchen: Kitchen = kitchenOf(world, content, holder),
): Recipe[] {
  const fuel = kitchen.fuel;
  const water = kitchen.water;
  const out: Recipe[] = [];
  const walk = (defId: string, steps: PrepDef[], seen: Set<string>) => {
    const food = content.items[defId]?.food;
    if (!food || seen.has(defId)) return;
    const nextSeen = new Set(seen);
    nextSeen.add(defId);
    for (const prep of food.prep) {
      if (steps.length === 0 && method !== undefined && prep.method !== method) continue;
      const path = [...steps, prep];
      if (prep.yields) {
        walk(prep.yields, path, nextSeen);
        continue;
      }
      if (prep.kcal_pct <= 0) continue;
      let fire = 0,
        minutes = 0,
        activeMinutes = 0,
        waterMl = 0;
      const missing: string[] = [];
      const original = content.items[stack.defId]?.food;
      let stageId = stack.defId,
        units = 1;
      for (const p of path) {
        const stageFood = content.items[stageId]?.food;
        const stageServings = (servings * units * (stageFood?.servings ?? 1)) / (original?.servings ?? 1);
        const batches = Math.ceil(stageServings / p.batch_servings);
        fire += p.fire_minutes * batches;
        minutes += p.minutes * batches;
        activeMinutes += (p.active_minutes ?? p.minutes) * batches;
        waterMl += Math.ceil(p.water_ml * stageServings);
        for (const key of p.cookware) if (kitchen.afford(key) <= 0 && !missing.includes(key)) missing.push(key);
        if (p.yields) {
          units *= p.yields_qty;
          stageId = p.yields;
        }
      }
      if (fire > 0 && kitchen.frozen(stack)) {
        fire = Math.ceil((fire * 150) / 100);
        minutes = Math.ceil((minutes * 150) / 100);
      }
      const opening = content.items[stack.defId]?.food?.opening;
      if (opening && !stack.opened) {
        if (kitchen.afford('cut') < opening.cut * 10 && kitchen.afford('pry') < opening.pry * 10)
          missing.push('opening tool (cut or pry)');
        minutes += opening.minutes * Math.ceil(servings / Math.max(1, original?.servings ?? 1));
        activeMinutes += opening.minutes;
      }
      if (fire > 0) missing.push(...kitchen.ignition);
      if (kitchen.fireCost(fire) + (fire > 0 && kitchen.fireCredit === 0 ? 10 : 0) > fuel) missing.push('fire supply');
      if (waterMl > water) missing.push('water');
      if (minutes > budget) missing.push(`time (${minutes} minutes)`);
      if (
        'actorId' in holder &&
        walking(world, holder.actorId) &&
        path.some((p) => p.minutes > 0 || p.fire_minutes > 0)
      )
        missing.push('stop to prepare');
      if (cold && path.some((p) => p.fire_minutes > 0 || p.minutes > 30)) missing.push('cold meal');
      // Nutrition follows the final units yielded by the preparation chain.
      const kcal = Math.round(
        ((food.fae_food ? 0 : food.kcal) * units * prep.kcal_pct) / (100 * (original?.servings ?? food.servings)),
      );
      out.push({
        food,
        defId,
        steps: path,
        missing,
        fire,
        water: waterMl,
        minutes,
        activeMinutes,
        morale:
          food.morale +
          prep.morale +
          (stack.spoilage >= (original?.spoilage.turning_pm ?? food.spoilage.turning_pm) ? TURNING_MORALE : 0),
        kcal,
        units,
      });
    }
  };
  walk(stack.defId, [], new Set());
  return out;
}

export function mealExplain(
  label: string,
  subjects: ActorId[],
  total: number,
  terms: Explain['terms'] = [],
  outcome = 'success',
): Explain {
  return {
    kind: 'formula',
    label,
    subjects,
    knowledge: subjects.length ? 'participants' : 'public',
    terms: terms.map((t) => ({ ...t, value: t.value === 0 ? 0 : t.value })),
    total: Math.round(total) || 0,
    outcome,
  };
}

type Plate = PendingPlate;
const FOOD_PREFERENCES = [
  ['time', 'Preparation time preference'],
  ['nutrition', 'Fat deficit preference'],
  ['nutrition', 'Protein deficit preference'],
  ['spoilage', 'Spoils-first preference'],
  ['nutrition', 'Fresh-food preference'],
  ['morale', 'Food morale preference'],
  ['variety', 'Variety preference'],
  ['weight', 'Pack-weight preference'],
  ['cost', 'Thrift preference'],
  ['policy', 'Reserved trail rations'],
] as const;
/** Inventory and energy estimates live only for a provisions/projection pass. */
export interface MealPass {
  /** Private projections discard explanations; live meals always retain them. */
  explain?: boolean;
  /** A readiness projection of what exists: whose order lets them cook is not consulted. */
  hypothetical?: boolean;
  inventory?: InventoryIndex;
  energy: Map<string, number>;
}
export function mealEnergy(world: World, ctx: SimContext, id: ActorId, pass?: MealPass): number {
  if (!pass) return dailyKcal(world, ctx.content, id, ctx.now);
  const key = `${ctx.cal.dayIndex}:${id}`;
  let kcal = pass.energy.get(key);
  if (kcal === undefined) {
    kcal = dailyKcal(world, ctx.content, id, ctx.now);
    pass.energy.set(key, kcal);
  }
  return kcal;
}
/** Per-meal options: a standing order's meal is sized to what the body takes and says so. */
export interface MealOptions {
  /** kcal cap per diner (the room left in the hunger meter), so an order never gorges. */
  capKcal?: Readonly<Record<number, number>>;
  /** Served by a standing order rather than chosen or commanded (announced as such). */
  standing?: boolean;
  /** A private forecast assumes successful preparation and labels each unrolled check. */
  forecastCheck?: (label: string) => void;
}
export interface MealResult {
  target: number;
  kcal: number;
  fire: number;
  minutes: number;
  pending?: boolean;
}

/** Serve a mess together, charging fire/time once per batch rather than once per mouth. */
export function serveMeal(
  world: World,
  ctx: SimContext,
  holder: Holder,
  diners: ActorId[],
  sharePct: number,
  cold = false,
  explicit?: { itemId: ItemId; method: string; servings: number },
  passMemo?: MealPass,
  caregiver?: ActorId,
  opts?: MealOptions,
): MealResult {
  if ('actorId' in holder && walking(world, holder.actorId)) cold = true;
  const content = ctx.content;
  const trace = passMemo?.explain !== false;
  const cookIds =
    !explicit && 'householdId' in holder
      ? membersOf(world, holder).filter(
          (id) => world.actors[id]?.placeId === world.households[holder.householdId]?.homePlaceId,
        )
      : diners;
  const cookId = [...(caregiver === undefined ? cookIds : [caregiver])]
    .filter(
      (id) =>
        passMemo?.hypothetical ||
        (canAct(world, id) &&
          (caregiver !== undefined ||
            authorizeAct(
              world,
              id,
              { kind: 'prepare_meal' },
              commandBasis(ctx, id, ['provisions.eat', 'provisions.board_meal']),
            ).ok ||
            ((('actorId' in holder && holder.actorId === id) ||
              ('householdId' in holder && world.actors[id]?.householdId === holder.householdId)) &&
              authorizeAct(world, id, { kind: 'eat_own_stores' }, { kind: 'standing', capability: 'eat_own_stores' })
                .ok))),
    )
    .sort(
      (a, b) =>
        (world.actors[b]?.sheet.skills.trade_cookery ?? 0) - (world.actors[a]?.sheet.skills.trade_cookery ?? 0) ||
        a - b,
    )[0];
  if (
    cookId === undefined ||
    (caregiver !== undefined &&
      !authorizeAct(world, caregiver, { kind: 'aid' }, commandBasis(ctx, caregiver, ['needs.aid'])).ok)
  )
    return { target: 0, kcal: 0, fire: 0, minutes: 0 };
  // Emergency care feeds a full portion even while the household is cutting rations.
  // Ingredients, fuel, water and elapsed preparation remain fully charged.
  const rationPct =
    caregiver === undefined ? rationOf(world, holder) : (content.survival_tuning?.survival?.care_ration_pct ?? 100);
  const plates: Plate[] = diners.map((id) => ({
    id,
    target: Math.min(
      Math.round((mealEnergy(world, ctx, id, passMemo) * rationPct * sharePct) / 10_000),
      opts?.capKcal?.[id] ?? Number.MAX_SAFE_INTEGER,
    ),
    kcal: 0,
    proteinG: 0,
    fatG: 0,
    freshPoints: 0,
    waterMl: 0,
    ethanolPoints: 0,
    servings: 0,
    groups: [],
    foods: [],
    items: [],
    hot: false,
    morale: 0,
    children: [],
  }));
  const policy = policyFor(
    content,
    'householdId' in holder ? world.provisions.households[holder.householdId]?.policy : undefined,
  );
  let timeLeft = prepBudget(holder),
    totalFire = 0,
    totalMinutes = 0,
    totalActiveMinutes = 0;
  const batches: PendingMeal['batches'] = [];
  const kitchen = kitchenOf(world, content, holder, ctx.now, passMemo?.inventory);
  const candidates = kitchen.stacks.filter(
    (s) => foodServings(content, s) > 0 && (!explicit || s.id === explicit.itemId),
  );
  const targets = nutritionTargets(content);
  const hasStaple = candidates.some((s) => {
    const food = content.items[s.defId]?.food;
    return (
      food &&
      ['grain', 'bread', 'legume', 'mixed'].includes(food.group) &&
      recipesFor(world, content, holder, s, 1, cold, explicit?.method, timeLeft, kitchen).some(
        (r) => !r.missing.length && r.kcal > SIDE_KCAL_MAX,
      )
    );
  });
  /** A real food (not sugar or molasses) can be prepared: sweets are then a relish, not the meal. */
  let mainAvailable = false;
  const scores = new Map<ItemId, number>();
  const scoreTerms = new Map<ItemId, Explain['terms']>();
  const mayBeSide = new Set<ItemId>();
  const history = plates.flatMap((p) => world.provisions.nutrition[p.id]?.history.slice(-7) ?? []);
  const intake = history.reduce((n, d) => n + d.kcal, 0);
  const fatEnergy = history.reduce((n, d) => n + d.fatG * 9, 0);
  const protein = history.reduce((n, d) => n + d.proteinG, 0);
  const need = history.reduce((n, d) => n + d.needKcal, 0);
  const fatNeed = !history.length || fatEnergy * 100 < intake * targets.fat_recovery_pct;
  const proteinNeed = !history.length || protein * 1000 < need * targets.protein_g_per_1000_kcal;
  for (const stack of candidates) {
    const food = content.items[stack.defId]?.food;
    const def = content.items[stack.defId];
    if (!food || !def) continue;
    const variety = plates.some((p) => !world.provisions.nutrition[p.id]?.today.foods.includes(stack.defId)) ? 40 : 0;
    const urgency = Math.floor(500 / Math.max(1, food.shelf_life_days)) + Math.floor(stack.spoilage / 10);
    const reserved = def.tags.some((t) => policy.reserve_tags.includes(t)) ? -10_000 : 0;
    const trials = recipesFor(world, content, holder, stack, 1, cold, explicit?.method, timeLeft, kitchen);
    if (trials.some((r) => r.kcal <= SIDE_KCAL_MAX)) mayBeSide.add(stack.id);
    const paths = trials.filter((r) => !r.missing.length);
    if (food.group !== 'sweet' && paths.some((r) => r.kcal > SIDE_KCAL_MAX)) mainAvailable = true;
    const prepMinutes = paths.length ? Math.min(...paths.map((r) => r.minutes)) : timeLeft + 1;
    // The projection needs the same rounded score, but discards the named terms.
    const values = [
      -prepMinutes * (policy.weights.preparation_time ?? 2),
      fatNeed ? Math.floor((food.fat_g * 9 * 100) / Math.max(1, food.kcal)) * 20 : 0,
      proteinNeed ? Math.floor((food.protein_g * 100) / Math.max(1, food.kcal)) * 20 : 0,
      urgency * policy.weights.spoils_first,
      plates.some((p) => {
        const n = world.provisions.nutrition[p.id];
        return !n || n.today.freshPoints < targets.fresh_target * targets.fresh_reference_servings || n.scurvy >= 500;
      })
        ? food.fresh * policy.weights.fresh_need
        : 0,
      food.morale * policy.weights.morale,
      variety * policy.weights.variety,
      Math.floor(def.weight_g / food.servings / 10) * policy.weights.lightness,
      -def.value_cents * policy.weights.thrift,
      reserved,
    ];
    scores.set(
      stack.id,
      values.reduce((n, value) => n + intValue(value), 0),
    );
    if (trace)
      scoreTerms.set(
        stack.id,
        FOOD_PREFERENCES.map(([source, label], i) => term(source, label, values[i] ?? 0)),
      );
  }
  candidates.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || a.id - b.id);
  const sides = new Set<ItemId>();
  /** Foods that could not be prepared; logged only if the meal then fell short (the failure mattered). */
  const failures: Array<{ itemId: ItemId; missing: string[] }> = [];
  for (let pass = 0; pass < (explicit ? 1 : 3); pass++) {
    for (const stack of candidates) {
      if (!explicit && !mayBeSide.has(stack.id) && plates.every((p) => p.kcal >= p.target)) continue;
      kitchen.phaseStart = totalActiveMinutes;
      if (!world.items.stacks[stack.id]) continue;
      const have = foodServings(content, stack);
      if (!have) continue;
      const trial = recipesFor(world, content, holder, stack, 1, cold, explicit?.method, timeLeft, kitchen);
      const recipe = trial
        .filter((r) => r.missing.length === 0)
        .sort(
          (a, b) =>
            (b.morale - a.morale) * policy.weights.morale -
              (b.minutes - a.minutes) * (policy.weights.preparation_time ?? 2) ||
            a.fire - b.fire ||
            a.minutes - b.minutes ||
            (a.steps.map((p) => p.method).join('/') < b.steps.map((p) => p.method).join('/')
              ? -1
              : a.steps.map((p) => p.method).join('/') > b.steps.map((p) => p.method).join('/')
                ? 1
                : 0),
        )[0];
      if (!recipe) {
        if (pass === 0) failures.push({ itemId: stack.id, missing: [...new Set(trial.flatMap((r) => r.missing))] });
        continue;
      }
      const side = recipe.kcal <= SIDE_KCAL_MAX;
      if (side && sides.has(stack.id)) continue;
      const portions: number[] = [];
      let havePm = Math.round(have * 1000);
      for (const plate of plates) {
        const limit = pass === 0 ? Math.round((plate.target * MAX_SHARE_PCT) / 100) : plate.target;
        const deficit = Math.max(0, Math.min(plate.target - plate.kcal, limit));
        const needPm = explicit
          ? explicit.servings * 1000
          : side
            ? 1000
            : Math.ceil((deficit * 1000) / Math.max(1, recipe.kcal));
        let n = Math.min(havePm, needPm, !explicit && plate.kcal >= plate.target && !side ? 0 : needPm);
        // Fat and keeping produce complement a staple; they do not displace half its
        // protein just because their policy score is high. A final fallback still fills
        // energy when the kit has only those foods. Explicit portions remain literal.
        if (!explicit && !side && hasStaple && pass < 2) {
          if (['fruit', 'vegetable', 'fungus'].includes(recipe.food.group) && recipe.food.fresh > 0) {
            const freshTarget = Math.ceil((targets.fresh_target * targets.fresh_reference_servings * sharePct) / 100);
            const remaining = Math.max(0, freshTarget - plate.freshPoints);
            const pointsPerServing =
              (recipe.food.fresh * recipe.units * recipe.food.servings) /
              (content.items[stack.defId]?.food?.servings ?? 1);
            n = Math.min(n, Math.ceil((remaining * 1000) / Math.max(1, pointsPerServing)));
          }
          if (
            recipe.food.fat_g * 900 >= recipe.food.kcal * targets.fat_recovery_pct &&
            recipe.food.protein_g * 1000 < recipe.food.kcal * targets.protein_g_per_1000_kcal
          ) {
            const remaining = Math.max(0, Math.ceil((plate.target * targets.fat_recovery_pct) / 900) - plate.fatG);
            const gramsPerServing =
              (recipe.food.fat_g * recipe.units) / (content.items[stack.defId]?.food?.servings ?? 1);
            n = Math.min(n, Math.ceil((remaining * 1000) / Math.max(1, gramsPerServing)));
          }
        }
        // Sugar and molasses sweeten a meal; while real food is to hand they never make it.
        if (!explicit && !side && pass < 2 && recipe.food.group === 'sweet' && mainAvailable) n = Math.min(n, 1000);
        portions.push(n);
        havePm -= n;
      }
      let servingsPm = portions.reduce((a, b) => a + b, 0);
      let servings = servingsPm / 1000;
      if (servings <= 0) continue;
      let batch = recipesFor(world, content, holder, stack, servings, cold, explicit?.method, timeLeft, kitchen).find(
        (r) => r.steps.map((p) => p.method).join('/') === recipe.steps.map((p) => p.method).join('/'),
      );
      // If a full mess exceeds fuel/water/time, reduce servings deterministically, keeping the same recipe.
      while (batch && batch.missing.length > 0 && servingsPm > 0) {
        for (let i = portions.length - 1; i >= 0; i--)
          if ((portions[i] ?? 0) > 0) {
            const cut = Math.min(1000, portions[i] ?? 0);
            portions[i] = (portions[i] ?? 0) - cut;
            servingsPm -= cut;
            break;
          }
        servings = servingsPm / 1000;
        batch = recipesFor(world, content, holder, stack, servings, cold, explicit?.method, timeLeft, kitchen).find(
          (r) => r.steps.map((p) => p.method).join('/') === recipe.steps.map((p) => p.method).join('/'),
        );
      }
      if (!batch || servings <= 0 || batch.missing.length) continue;
      const fuelUsed = cookingFire(world, ctx, holder, kitchen, batch.fire);
      drawWater(world, content, holder, batch.water, kitchen.index);
      kitchen.refresh();
      timeLeft -= batch.activeMinutes;
      // Unattended simmering overlaps later hands-on tasks; active work remains serial.
      totalMinutes = Math.max(totalMinutes, totalActiveMinutes + batch.minutes);
      totalFire += fuelUsed;
      totalActiveMinutes += batch.activeMinutes;
      const checks: Explain[] = [];
      let failed = false;
      const cook = cookId === undefined ? undefined : world.actors[cookId];
      for (let i = 0; i < batch.steps.length; i++) {
        const prep = batch.steps[i];
        if (prep?.check && cook && content.skills[prep.check.skill]) {
          if (opts?.forecastCheck) {
            opts.forecastCheck(
              `Prepare ${content.items[stack.defId]?.name}: ${prep.check.skill} check, DC ${prep.check.dc}`,
            );
            continue;
          }
          const result = skillCheck(
            content,
            cook,
            { label: `Prepare ${content.items[stack.defId]?.name}`, skill: prep.check.skill, dc: prep.check.dc },
            ctx.rng('cooking', mixKey(stack.id, cook.id, i)),
          );
          checks.push(result.explain);
          failed ||= !result.success;
        }
      }
      const sourceDefId = stack.defId;
      const usedPm = stack.partial * 1000 + (stack.foodPartialPm ?? 0) + servingsPm;
      const food = content.items[stack.defId]?.food;
      if (!food) continue;
      accessContents(world, stack);
      const unitsUsed = Math.floor(usedPm / (food.servings * 1000));
      stack.qty -= unitsUsed;
      const leftPm = usedPm % (food.servings * 1000);
      stack.partial = Math.floor(leftPm / 1000);
      stack.foodPartialPm = leftPm % 1000;
      if (food.opening && leftPm > 0 && stack.qty > 0) {
        if (stack.qty > 1) {
          const openedId = newStack(world, food.opening.yields, 1, stack.location, ctx.now);
          const opened = world.items.stacks[openedId];
          if (opened) {
            opened.partial = stack.partial;
            opened.foodPartialPm = stack.foodPartialPm;
            opened.opened = true;
            opened.condition = stack.condition;
            opened.wetness = stack.wetness;
            opened.frozen = stack.frozen ?? false;
          }
          stack.qty--;
          stack.partial = 0;
          stack.foodPartialPm = 0;
        } else {
          stack.defId = food.opening.yields;
          stack.opened = true;
          stack.spoilage = 0;
          stack.spoilageCarry = 0;
        }
      }
      const batchData = {
        itemId: stack.id,
        from: sourceDefId,
        into: food.opening?.yields ?? batch.defId,
        servings: Math.ceil(servings),
        servingsPm,
        methods: batch.steps.map((p) => p.method),
        fireMinutes: batch.fire,
        waterMl: batch.water,
        minutes: batch.minutes,
      };
      batches.push(batchData);
      const prepExplain = trace
        ? {
            ...mealExplain('Preparation batch', diners, servingsPm, [
              term('item', 'Serving portions per mille', servingsPm),
              term('fuel', 'Fire minutes required', batch.fire),
              term('fuel', 'Fuel debited (shared hearth credit)', fuelUsed),
              term('water', 'Water ml', batch.water),
              term('time', 'Elapsed preparation minutes', batch.minutes),
              term('time', 'Active work minutes', batch.activeMinutes),
              ...(food.opening
                ? [
                    term('tool', 'Opening cut magnitude (tenths)', kitchen.afford('cut')),
                    term('tool', 'Opening pry magnitude (tenths)', kitchen.afford('pry')),
                  ]
                : []),
              ...(stack.frozen ? [term('weather', 'Frozen food thawing fire percent', 150)] : []),
            ]),
            children: checks,
          }
        : undefined;
      if (trace) {
        const consumedEventId = ctx.emit({
          kind: 'items.consumed',
          data: { itemId: stack.id, defId: sourceDefId, qty: unitsUsed, reason: `${servings} servings prepared` },
          visibility: 'private',
          explain: mealExplain('Food consumed', diners, servingsPm, [
            term('food', 'Serving portions per mille', servingsPm),
          ]),
        });
        recordProvenance(stack, consumedEventId);
      }
      if (stack.qty <= 0) deleteStack(world, stack.id);
      if (side) sides.add(stack.id);
      for (let i = 0; i < plates.length; i++) {
        const plate = plates[i];
        const portionPm = portions[i] ?? 0;
        const n = portionPm / 1000;
        if (!plate || n === 0) continue;
        world.provisions.nutrition[plate.id] ??= emptyNutrition(ctx.cal.dayIndex);
        const nutrition = world.provisions.nutrition[plate.id];
        if (!nutrition) continue;
        const kcal = Math.round((n * batch.kcal * (failed ? 80 : 100)) / 100);
        plate.kcal += kcal;
        plate.hot ||= batch.fire > 0;
        plate.morale += Math.round(n * (batch.morale + (failed ? -3 : 0)));
        plate.items.push({
          defId: sourceDefId,
          qty: Math.ceil(n),
          servingsPm: portionPm,
          method: batch.steps.map((p) => p.method).join('/'),
        });
        if (trace && prepExplain) {
          plate.children.push(
            mealExplain('Food policy score', [plate.id], scores.get(stack.id) ?? 0, scoreTerms.get(stack.id) ?? []),
          );
          plate.children.push(prepExplain);
        }
        plate.proteinG += Math.round((batch.food.protein_g * batch.units * n) / food.servings);
        plate.fatG += Math.round((batch.food.fat_g * batch.units * n) / food.servings);
        plate.freshPoints += Math.round((batch.food.fresh * n * batch.units * batch.food.servings) / food.servings);
        if (batch.food.hydrates) plate.waterMl += Math.round((batch.food.liquid_ml * batch.units * n) / food.servings);
        const salt = batch.steps.reduce((sum, p) => sum + (p.thirst_ml ?? 0), 0);
        if (salt) plate.saltMl = (plate.saltMl ?? 0) + Math.round(salt * n);
        plate.servings += Math.ceil(n);
        if (!plate.groups.includes(batch.food.group)) plate.groups.push(batch.food.group);
        if (!plate.foods.includes(sourceDefId)) plate.foods.push(sourceDefId);
        plate.ethanolPoints += Math.round(
          (((batch.food.liquid_ml * batch.food.alcohol_pct * 79) / 10_000) * n * 14) / food.servings,
        );
      }
    }
  }
  const short = plates.some((p) => p.kcal * 10 < p.target * 9);
  if (short)
    for (const f of failures)
      ctx.emit({
        kind: 'provisions.prep_failed',
        data: { itemId: f.itemId, missing: f.missing },
        roles: diners.map((actor) => ({ actor, role: 'participant' })),
        visibility: 'private',
        explain: mealExplain(
          'Cannot prepare food',
          diners,
          0,
          f.missing.map((missing) => term('preparation', `Missing: ${missing}`, 1)),
          'failure',
        ),
      });
  for (const plate of plates) {
    world.provisions.nutrition[plate.id] ??= emptyNutrition(ctx.cal.dayIndex);
    const n = world.provisions.nutrition[plate.id];
    if (n) n.today.needKcal = mealEnergy(world, ctx, plate.id, passMemo);
  }
  const placeId = kitchen.placeId;
  if (placeId !== undefined && cookId !== undefined && plates.some((p) => p.items.length)) {
    const pending: PendingMeal = {
      placeId,
      householdId: 'householdId' in holder ? holder.householdId : null,
      cookId,
      ...(caregiver === undefined
        ? {}
        : { caregiverId: caregiver, caregiverBasis: commandBasis(ctx, caregiver, ['needs.aid']) }),
      startedAt: ctx.now,
      completesAt: ctx.now + totalMinutes,
      activeUntil: ctx.now + totalActiveMinutes,
      rationPct,
      plates: plates.filter((p) => p.items.length),
      batches,
      ...(opts?.standing ? { standing: true } : {}),
    };
    if (totalMinutes > 0) {
      world.provisions.pendingMeals ??= [];
      world.provisions.pendingMeals.push(pending);
      reservePreparation(world, ctx, cookId, caregiver === undefined ? totalActiveMinutes : totalMinutes + 60);
      ctx.emit({
        kind: 'provisions.prep_started',
        data: { cookId, completesAt: pending.completesAt, activeMinutes: totalActiveMinutes, minutes: totalMinutes },
        roles: diners.map((actor) => ({ actor, role: 'participant' })),
        visibility: 'private',
        explain: mealExplain('Preparation underway', diners, pending.completesAt, [
          term('time', 'Start minute', ctx.now),
          term('time', 'Elapsed minutes', totalMinutes),
          term('time', 'Active minutes', totalActiveMinutes),
        ]),
      });
    } else finishMeal(world, ctx, pending);
  }

  return {
    target: plates.reduce((n, p) => n + p.target, 0),
    kcal: plates.reduce((n, p) => n + p.kcal, 0),
    fire: totalFire,
    minutes: totalMinutes,
    pending: totalMinutes > 0,
  };
}

/** Access control for commands: ownership plus physical access; households share their larder at home. */
export function accessibleStack(world: World, actorId: ActorId, stack: ItemStack): boolean {
  const a = world.actors[actorId];
  if (!a?.alive) return false;
  const root = rootLocation(world, stack);
  return (
    sameLoc(root, carriedBy(actorId)) ||
    (root.kind === 'household' &&
      root.householdId === a.householdId &&
      world.households[a.householdId]?.homePlaceId === a.placeId)
  );
}

export function dueMeal(_world: World, content: ContentBundle, holder: Holder, hour: number) {
  return mealPlanFor(content, 'householdId' in holder ? 'household' : 'trail').meals.find((m) => m.hour === hour);
}
export function hungry(world: World, id: ActorId): boolean {
  return needValue(world, id, 'hunger') < 400;
}

/** Pending output is plain data and survives a save. Nobody is fed until the work completes
 * and they can reach the prepared meal; unattended work does not hold the cook in an activity. */
function finishMeal(world: World, ctx: SimContext, meal: PendingMeal): void {
  for (const batch of meal.batches)
    ctx.emit({
      kind: 'provisions.prepared',
      data: batch,
      roles: [{ actor: meal.cookId, role: 'agent' }],
      visibility: 'private',
      explain: mealExplain('Preparation completed', [meal.cookId], meal.completesAt, [
        term('time', 'Started at', meal.startedAt),
        term('time', 'Completion minute', meal.completesAt),
      ]),
    });
  meal.batches = [];
  const remaining: PendingPlate[] = [];
  for (const plate of meal.plates) {
    const actor = world.actors[plate.id];
    if (!actor?.alive) continue;
    const helper = meal.caregiverId;
    const assisted =
      helper !== undefined &&
      canAct(world, helper) &&
      world.actors[helper]?.placeId === meal.placeId &&
      authorizeAct(world, helper, { kind: 'aid' }, meal.caregiverBasis ?? { kind: 'own' }).ok;
    if (actor.placeId !== meal.placeId || (!canAct(world, plate.id) && !assisted)) {
      if (ctx.now < meal.completesAt + 1440) remaining.push(plate);
      continue;
    }
    world.provisions.nutrition[plate.id] ??= emptyNutrition(ctx.cal.dayIndex);
    const n = world.provisions.nutrition[plate.id];
    if (!n) continue;
    const today = n.today;
    today.kcal += plate.kcal;
    today.proteinG += plate.proteinG;
    today.fatG += plate.fatG;
    today.freshPoints += plate.freshPoints;
    today.servings += plate.servings;
    for (const group of plate.groups) if (!today.groups.includes(group)) today.groups.push(group);
    for (const food of plate.foods) if (!today.foods.includes(food)) today.foods.push(food);
    plate.hot &&= ctx.now <= meal.completesAt + 120;
    today.meals++;
    today.morale += plate.morale;
    if (plate.hot) today.hotMeals++;
    else today.coldMeals++;
    n.intoxication = Math.min(1000, n.intoxication + plate.ethanolPoints);
    n.lastMealAt = ctx.now;
    const eventId = ctx.emit({
      kind: 'provisions.meal',
      data: {
        actorId: plate.id,
        ...(assisted && helper !== undefined ? { assistedBy: helper } : {}),
        householdId: meal.householdId,
        items: plate.items,
        kcal: plate.kcal,
        hot: plate.hot,
        morale: plate.morale,
        ...(meal.standing ? { standing: true } : {}),
      },
      roles: [
        { actor: plate.id, role: 'agent' },
        ...(assisted && helper !== undefined ? [{ actor: helper, role: 'agent' as const }] : []),
      ],
      visibility: assisted ? 'witnessed' : 'private',
      place: meal.placeId,
      explain: {
        ...mealExplain('Meal intake', [plate.id], plate.kcal, [
          term('need', 'Target kcal', plate.target),
          term('policy', 'Ration percent', meal.rationPct),
        ]),
        children: plate.children,
      },
    });
    feed(world, ctx, plate.id, plate.kcal, { label: 'Meal', eventId });
    if (plate.waterMl) drink(world, ctx, plate.id, plate.waterMl, { label: 'Drink with meal', eventId });
    if (plate.saltMl) thirstFromSalt(world, ctx, plate.id, plate.saltMl, eventId);
  }
  meal.plates = remaining;
}
/** Salt meat leaves a thirst: the water the salt asks for comes off the Thirst meter (P8). */
function thirstFromSalt(world: World, ctx: SimContext, id: ActorId, ml: number, eventId: number): void {
  const thirst = Object.values(ctx.content.needs).find((n) => n.intake?.unit === 'ml');
  if (!thirst?.intake) return;
  const points = Math.round(ml / thirst.intake.per_point);
  satisfyNeed(world, ctx, id, thirst.id, -points, {
    label: 'Salt meat: thirst',
    eventId: eventId as import('../ids.ts').EventId,
    log: true,
    terms: [
      { source: 'food', label: `Salt in the meal asks ${ml} ml of water`, value: -points },
      { source: 'need', label: `Ml per Thirst point ${thirst.intake.per_point}`, value: 0 },
    ],
  });
}
export function preparationHour(world: World, ctx: SimContext): void {
  for (const fire of rowsOf(world.provisions.fires))
    if ((fire.until ?? 0) <= ctx.now) {
      fire.lit = false;
      fire.fuelMinutes = 0;
    }
  for (const meal of world.provisions.pendingMeals ?? []) if (meal.completesAt <= ctx.now) finishMeal(world, ctx, meal);
  world.provisions.pendingMeals = (world.provisions.pendingMeals ?? []).filter((m) => m.plates.length > 0);
}
/** A plate is waiting for them (at `placeId` only, when given: a plate elsewhere does not hold them). */
export function awaitingMeal(world: World, id: ActorId, placeId?: PlaceId): boolean {
  return (world.provisions.pendingMeals ?? []).some(
    (m) => (placeId === undefined || m.placeId === placeId) && m.plates.some((p) => p.id === id),
  );
}

/** One command-voiced activity can buy four hours of shared heat with real kit/fuel. */
export function lightCampfire(world: World, ctx: SimContext, actorId: ActorId): boolean {
  const holder = holderOfActor(world, actorId);
  const kitchen = kitchenOf(world, ctx.content, holder, ctx.now);
  const minutes = 240;
  const needed = kitchen.fireCost(minutes) + (kitchen.fireCredit > 0 ? 0 : 10);
  if (kitchen.ignition.length || kitchen.fuel < needed) {
    ctx.emit({
      kind: 'provisions.command_rejected',
      data: {
        actorId,
        command: 'campfire',
        reason: kitchen.ignition.length ? kitchen.ignition.join(', ') : 'Not enough fuel for four hours',
      },
      roles: [{ actor: actorId, role: 'agent' }],
      visibility: 'private',
      explain: mealExplain(
        'Cannot light campfire',
        [actorId],
        0,
        [term('fuel', 'Required fire minutes', needed), term('fuel', 'Available fire minutes', kitchen.fuel)],
        'rejected',
      ),
    });
    return false;
  }
  cookingFire(world, ctx, holder, kitchen, minutes);
  return true;
}
