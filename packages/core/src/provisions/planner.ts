import { provisionCalendar as calendarAt } from './calendar.ts';
/** A private forward inventory simulation. No mutation of the caller, and no separate meal math. */

import { scheduledBlock } from '../activity/api.ts';
import type { ContentBundle } from '../content.ts';
import { forecastCharms, forecastHems } from '../fae/forecast.ts';
import { rowsOf } from '../ids.ts';
import { withInventoryPass } from '../items/api.ts';
import { projectWaterHour } from '../needs/api.ts';
import { rng } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { asGameMinute } from '../time.ts';
import type { World } from '../world.ts';
import type { Readiness } from './api.ts';
import { waterHour } from './api.ts';
import { replenishDomestic } from './economy.ts';
import { devicesHour, type PlacementMemo, storageHour } from './environment.ts';
import {
  awaitingMeal,
  dailyKcal,
  dueMeal,
  foodServings,
  type Holder,
  holderStacks,
  holderSupply,
  kitchenOf,
  mealEnergy,
  membersOf,
  preparationHour,
  prepBudget,
  rationOf,
  recipesFor,
  serveMeal,
  waterAvailable,
} from './meals.ts';
import { nutritionHour } from './nutrition.ts';
import { minutesUntil, spoilageFactors } from './spoilage.ts';
import { emptyNutrition } from './state.ts';

export function planReadiness(
  world: World,
  content: ContentBundle,
  holder: Holder,
  now: number,
  horizonDays = 366,
): Readiness {
  const members = membersOf(world, holder);
  const stacks = holderStacks(world, holder);
  const result: Readiness = {
    kcalOnHand: 0,
    kcalPerDay: Math.round(
      (members.reduce((n, id) => n + dailyKcal(world, content, id, now), 0) * rationOf(world, holder)) / 100,
    ),
    daysOfFoodTenths: 0,
    daysOfFuelTenths: null,
    spoilsFirst: null,
    unpreparable: [],
    warnings: [],
  };
  // Charm rows show whatever the plan (13 §5.7): with no projection they cover no hours.
  const charmRows = (hems: import('../fae/hem.ts').HemSet | undefined): Readiness =>
    world.fae?.charms
      ? (() => {
          const rows = forecastCharms(
            world,
            content,
            members,
            stacks,
            hems ?? forecastHems(world, content, members, stacks),
          );
          return rows.length ? { ...result, charms: rows } : result;
        })()
      : result;
  if (!members.length || result.kcalPerDay === 0) return charmRows(undefined);
  const storedWater = waterAvailable(world, content, holder);
  const thirst = content.needs.thirst;
  const dailyDrinking = members.length * (thirst ? thirst.decay_per_hour * 24 * (thirst.intake?.per_point ?? 2) : 3000);
  result.daysOfWaterTenths =
    'householdId' in holder || storedWater >= 100000
      ? null
      : Math.floor((storedWater * 10) / Math.max(1, dailyDrinking));
  if (result.daysOfWaterTenths !== null && result.daysOfWaterTenths < 10)
    result.warnings.push('Less than a day of stored drinking water; preparation also draws from it.');
  let fresh = false;
  const kitchen = kitchenOf(world, content, holder);
  for (const stack of stacks) {
    const food = content.items[stack.defId]?.food;
    if (!food || foodServings(content, stack) === 0) continue;
    fresh ||= food.fresh >= 10;
    const recipes = recipesFor(world, content, holder, stack, 1, false, undefined, prepBudget(holder), kitchen);
    const usable = recipes.filter((r) => r.missing.length === 0);
    if (!usable.length)
      result.unpreparable.push({
        defId: stack.defId,
        name: content.items[stack.defId]?.name ?? stack.defId,
        missing: [...new Set(recipes.flatMap((r) => r.missing))],
      });
    else result.kcalOnHand += Math.round(Math.max(...usable.map((r) => r.kcal)) * foodServings(content, stack));
    const factors = spoilageFactors(world, content, stack, calendarAt(asGameMinute(now)));
    const minutes = factors ? minutesUntil(stack, food, factors.combinedPct, 1000) : null;
    if (minutes !== null) {
      const days = Math.floor((minutes * 10) / 1440);
      if (!result.spoilsFirst || days < result.spoilsFirst.inDaysTenths)
        result.spoilsFirst = {
          defId: stack.defId,
          name: content.items[stack.defId]?.name ?? stack.defId,
          inDaysTenths: days,
        };
    }
  }
  if (!fresh) result.warnings.push('No fresh food: scurvy watch after about six weeks.');
  if (result.unpreparable.length)
    result.warnings.push('Some food cannot be prepared with the available cookware, fuel, water, or time.');
  result.kcalOnHand += (world.provisions.pendingMeals ?? []).reduce(
    (n, meal) => n + meal.plates.filter((p) => members.includes(p.id)).reduce((sum, p) => sum + p.kcal, 0),
    0,
  );
  if (!result.kcalOnHand) return charmRows(undefined);
  // Only owned slices are cloned; neither social nor belief state is touched by this kernel.
  const projection: World = {
    ...world,
    items: { counters: { ...world.items.counters }, stacks: Object.create(null) },
    // Only the eaters exist in the projection: every hourly kernel iterates actors.
    actors: Object.create(null),
    households: Object.create(null),
    places: Object.create(null),
    needs: {
      ...world.needs,
      byActor: {},
      hearthLit: { ...world.needs.hearthLit },
      placeTempF: { ...world.needs.placeTempF },
    },
    activity: { ...world.activity, byActor: {} },
    provisions: {
      ...world.provisions,
      nutrition: {},
      households: Object.create(null),
      fires: JSON.parse(JSON.stringify(world.provisions.fires)),
      pendingMeals: JSON.parse(
        JSON.stringify(
          (world.provisions.pendingMeals ?? []).filter((m) => m.plates.some((p) => members.includes(p.id))),
        ),
      ),
    },
  };
  if ('householdId' in holder) {
    const household = world.households[holder.householdId];
    if (household) projection.households[household.id] = household;
  }
  for (const id of members) {
    const actor = world.actors[id];
    const pid = 'householdId' in holder ? world.households[holder.householdId]?.homePlaceId : actor?.placeId;
    if (pid !== undefined && world.places[pid]) projection.places[pid] = world.places[pid];
  }
  for (const stack of stacks)
    projection.items.stacks[stack.id] = {
      ...stack,
      location: { ...stack.location },
      provenance: [...stack.provenance],
    };
  for (const id of members) {
    const a = world.actors[id];
    if (!a) continue;
    projection.actors[id] = {
      ...a,
      placeId: 'householdId' in holder ? (world.households[holder.householdId]?.homePlaceId ?? a.placeId) : a.placeId,
      sheet: { ...a.sheet, conditions: [...a.sheet.conditions] },
    };
    const needs = world.needs.byActor[id];
    if (needs)
      projection.needs.byActor[id] = {
        ...needs,
        values: { ...needs.values },
        bands: { ...needs.bands },
        debt: { ...needs.debt },
        debtBands: { ...needs.debtBands },
      };
    const activity = world.activity.byActor[id];
    if (activity) projection.activity.byActor[id] = { ...activity, travel: null };
    projection.provisions.nutrition[id] = world.provisions.nutrition[id]
      ? JSON.parse(JSON.stringify(world.provisions.nutrition[id]))
      : emptyNutrition(Math.floor(now / 1440));
    const nutrition = projection.provisions.nutrition[id];
    if (nutrition) nutrition.rationPct = world.provisions.nutrition[id]?.rationPct ?? 100;
  }
  if ('householdId' in holder) {
    const h = world.provisions.households[holder.householdId];
    if (h) projection.provisions.households[holder.householdId] = { ...h };
  }
  const fuelStart = holderSupply(world, content, holder, 'fire');
  let fuelDay = 0,
    foodHours = 0,
    windowKcal = 0;
  // Cap at a year: huge debug inventories must not freeze a view query. Report the cap plainly.
  // Household decisions pass a shorter horizon: they only compare against the ration thresholds.
  const horizon = Math.max(1, Math.min(366, Math.floor(horizonDays)));
  // Placement is stable within this private projection; hourly supply devices need stepping only when present.
  const placement: PlacementMemo = {};
  const hasDevices = rowsOf(projection.items.stacks).some((s) =>
    (content.items[s.defId]?.consumes ?? []).some((c) => c.per === 'hour' || c.per === 'day'),
  );
  const pass = { energy: new Map<string, number>(), explain: false };
  // The projection's own hem state: verified charms only, never written back (13 §5.7).
  const hems = world.fae?.charms ? forecastHems(world, content, members, stacks) : undefined;
  withInventoryPass(projection, () => {
    for (let hour = 0; hour < 24 * horizon; hour++) {
      const t = asGameMinute(Math.floor(now / 60) * 60 + hour * 60),
        cal = calendarAt(t);
      const ctx: SimContext = {
        content,
        now: t,
        seed: world.meta.seed,
        cal,
        isNewDay: cal.hour === 0,
        commands: [],
        rng: (stream, key) => rng(world.meta.seed, stream, t, key),
        emit: (event) => {
          if (event.kind === 'provisions.meal') windowKcal += event.data.kcal;
          return 0 as never;
        },
      };
      if (ctx.isNewDay && 'householdId' in holder) replenishDomestic(projection, ctx, holder.householdId);
      projection.time = t;
      for (const id of members) {
        const state = projection.activity.byActor[id];
        if (state && (state.lockedUntil ?? 0) <= t)
          state.activityId = scheduledBlock(projection, ctx, id, cal)?.activity ?? null;
      }
      const fuelBefore = hour < 24 ? holderSupply(projection, content, holder, 'fire') : 0;
      projectWaterHour(projection, ctx);
      nutritionHour(projection, ctx);
      storageHour(projection, ctx, placement, hems);
      preparationHour(projection, ctx);
      waterHour(projection, ctx);
      if (hasDevices) devicesHour(projection, ctx);
      const meal = dueMeal(projection, content, holder, cal.hour);
      if (meal && !members.some((id) => awaitingMeal(projection, id))) {
        serveMeal(projection, ctx, holder, members, meal.share_pct, meal.cold, undefined, pass);
      }
      if (hour < 24) fuelDay += Math.max(0, fuelBefore - holderSupply(projection, content, holder, 'fire'));
      // A cold noon piece may fail while the two hot meals still cover 80% of the ration.
      // Judge a complete 24-hour window, including preparation completions, against the
      // documented daily 50% threshold. A partial day is never mistaken for exhaustion.
      if (hour % 24 === 23) {
        const dailyTarget = Math.round(
          (members.reduce((n, id) => n + mealEnergy(projection, ctx, id, pass), 0) * rationOf(projection, holder)) /
            100,
        );
        if (windowKcal * 2 < dailyTarget) break;
        foodHours = hour + 1;
        windowKcal = 0;
      }
    }
  });
  result.daysOfFoodTenths = Math.round((foodHours * 10) / 24);
  if (world.fae?.charms && hems) {
    const rows = forecastCharms(world, content, members, stacks, hems);
    if (rows.length) result.charms = rows;
  }
  result.daysOfFuelTenths = fuelDay > 0 ? Math.floor((fuelStart * 10) / fuelDay) : null;
  if (foodHours >= 24 * horizon) result.warnings.push(`Food horizon capped at ${horizon} days.`);
  if (result.daysOfFoodTenths < 40) result.warnings.push('Less than four days of usable food at current rations.');
  return result;
}
