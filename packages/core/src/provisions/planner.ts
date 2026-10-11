/** A private forward inventory simulation. No mutation of the caller, and no separate meal math. */
import type { ContentBundle } from '../content.ts';
import { rowsOf } from '../ids.ts';
import { stacksDeep, supplyUnits } from '../items/api.ts';
import { rng } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import type { Readiness } from './api.ts';
import { replenishDomestic } from './economy.ts';
import { devicesHour, storageHour } from './environment.ts';
import {
  dailyKcal,
  dueMeal,
  foodServings,
  type Holder,
  locationOf,
  membersOf,
  rationOf,
  recipesFor,
  serveMeal,
} from './meals.ts';
import { nutritionHour } from './nutrition.ts';
import { minutesUntil, spoilageFactors } from './spoilage.ts';
import { emptyNutrition } from './state.ts';

export function planReadiness(world: World, content: ContentBundle, holder: Holder, now: number): Readiness {
  const loc = locationOf(holder),
    members = membersOf(world, holder);
  const stacks = stacksDeep(world, loc).map((s) => s.stack);
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
  if (!members.length || result.kcalPerDay === 0) return result;
  let fresh = false;
  for (const stack of stacks) {
    const food = content.items[stack.defId]?.food;
    if (!food || foodServings(content, stack) === 0) continue;
    fresh ||= food.fresh >= 10;
    const recipes = recipesFor(world, content, holder, stack, 1);
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
  if (!result.kcalOnHand) return result;
  // Only owned slices are cloned; neither social nor belief state is touched by this kernel.
  const projection: World = {
    ...world,
    items: { counters: { ...world.items.counters }, stacks: {} },
    actors: { ...world.actors },
    needs: { ...world.needs, byActor: {} },
    provisions: { ...world.provisions, nutrition: {}, households: {}, fires: {} },
  };
  for (const stack of stacks)
    projection.items.stacks[stack.id] = {
      ...stack,
      location: { ...stack.location },
      provenance: [...stack.provenance],
    };
  for (const id of members) {
    const a = world.actors[id];
    if (!a) continue;
    projection.actors[id] = { ...a, sheet: { ...a.sheet, conditions: [...a.sheet.conditions] } };
    projection.provisions.nutrition[id] = emptyNutrition(Math.floor(now / 1440));
    projection.provisions.nutrition[id].rationPct = world.provisions.nutrition[id]?.rationPct ?? 100;
  }
  if ('householdId' in holder) {
    const h = world.provisions.households[holder.householdId];
    if (h) projection.provisions.households[holder.householdId] = { ...h };
  }
  const fuelStart = supplyUnits(world, content, loc, 'fire');
  let fuelDay = 0,
    foodHours = 0;
  // Cap at a year: huge debug inventories must not freeze a view query. Report the cap plainly.
  for (let hour = 0; hour < 24 * 366; hour++) {
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
      emit: () => 0 as never,
    };
    if (ctx.isNewDay && 'householdId' in holder) replenishDomestic(projection, ctx, holder.householdId);
    nutritionHour(projection, ctx);
    storageHour(projection, ctx);
    devicesHour(projection, ctx);
    const meal = dueMeal(projection, content, holder, cal.hour);
    if (meal) {
      const report = serveMeal(projection, ctx, holder, members, meal.share_pct, meal.cold);
      if (hour < 24) fuelDay += report.fire;
      // Exhaustion means there is no energetic food left, rather than a rounded serving shortfall.
      if (report.kcal === 0 && report.target > 0) {
        foodHours = hour;
        break;
      }
    }
    foodHours = hour + 1;
    if (
      !rowsOf(projection.items.stacks).some(
        (s) => foodServings(content, s) > 0 && (content.items[s.defId]?.food?.kcal ?? 0) > 0,
      )
    )
      break;
  }
  result.daysOfFoodTenths = Math.round((foodHours * 10) / 24);
  result.daysOfFuelTenths = fuelDay > 0 ? Math.floor((fuelStart * 10) / fuelDay) : null;
  if (foodHours >= 24 * 366) result.warnings.push('Food horizon capped at 366 days.');
  if (result.daysOfFoodTenths < 40) result.warnings.push('Less than four days of usable food at current rations.');
  return result;
}
