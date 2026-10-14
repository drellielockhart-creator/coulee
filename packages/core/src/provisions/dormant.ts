/** T3 livelihood: one ordinary household meal per canonical day, bulk storage between.
 * Uses real preparation, nutrition, water/fuel and fractional serving kernels. */
import { resumeDormantActor } from '../activity/api.ts';
import type { HouseholdId } from '../ids.ts';
import { allStacks, deleteStack, inventoryIndex, withInventoryPass } from '../items/api.ts';
import { satisfyNeed } from '../needs/api.ts';
import { processesPlace, processesStack } from '../region/processing.ts';
import { rng } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { replenishDomestic } from './economy.ts';
import { dailyKcal, preparationHour, serveMeal } from './meals.ts';
import { nutritionHour } from './nutrition.ts';
import { advanceSpoilage, spoilageFactors } from './spoilage.ts';

export function dormantPantries(world: World, ctx: SimContext, from: number, through: number): void {
  // Six-hour environmental bins; exact integer carry makes splitting a bin associative.
  for (let at = from; at < through; ) {
    const end = Math.min(through, (Math.floor(at / 360) + 1) * 360);
    const cal = calendarAt(asGameMinute(Math.floor(at / 360) * 360));
    for (const stack of allStacks(world)) {
      if (!processesStack(world, stack)) continue;
      const food = ctx.content.items[stack.defId]?.food;
      if (!food) continue;
      const factors = spoilageFactors(world, ctx.content, stack, cal);
      if (!factors) continue;
      advanceSpoilage(stack, food, factors, end - at);
      if (food.spoilage.frozen_ruins && factors.band === 'frozen') stack.spoilage = 1000;
      if (stack.spoilage >= 1000) {
        if (food.spoilage.spoils_to) {
          stack.defId = food.spoilage.spoils_to;
          stack.spoilage = 0;
          stack.spoilageCarry = 0;
        } else deleteStack(world, stack.id);
      }
    }
    at = end;
  }
}

export function dormantHouseholdMeal(
  world: World,
  ctx: SimContext,
  householdId: HouseholdId,
): { consumed: number; shortage: number } {
  const household = world.households[householdId];
  if (!household) return { consumed: 0, shortage: 0 };
  const ids = household.memberIds.filter((id) => world.actors[id]?.alive);
  if (!ids.length) return { consumed: 0, shortage: 0 };
  return withInventoryPass(world, () => {
    replenishDomestic(world, ctx, householdId);
    const need = new Map<string, number>();
    let target = 0;
    for (const id of ids) {
      resumeDormantActor(world, id, ctx.now);
      const kcal = dailyKcal(world, ctx.content, id, ctx.now);
      need.set(`${ctx.cal.dayIndex}:${id}`, kcal);
      target += kcal;
      // The daily meal's credit offsets its bulk expenditure; never replayed on promotion.
      satisfyNeed(world, ctx, id, 'hunger', -Math.round(kcal / (ctx.content.needs.hunger?.intake?.per_point ?? 3)), {
        label: 'Dormant daily food expenditure',
        quiet: true,
      });
    }
    const meal = serveMeal(world, ctx, { householdId }, ids, 100, false, undefined, {
      inventory: inventoryIndex(world),
      energy: need,
      explain: false,
    });
    // Preparation has paid its ingredients, fire and water. The aggregate reserves the
    // actual elapsed duration, and finishes only at a later committed boundary.
    return { consumed: meal.kcal, shortage: Math.max(0, target - meal.kcal) };
  });
}

export function dormantNutritionDay(world: World, ctx: SimContext): void {
  nutritionHour(world, { ...ctx, isNewDay: true });
}

export function finishDormantMeals(world: World, ctx: SimContext): void {
  const saved = world.time;
  try {
    const due = [
      ...new Set(
        (world.provisions.pendingMeals ?? [])
          .filter((m) => processesPlace(world, m.placeId) && m.completesAt <= ctx.now)
          .map((m) => m.completesAt),
      ),
    ].sort((a, b) => a - b);
    for (const at of due) {
      const now = asGameMinute(at);
      world.time = now;
      preparationHour(world, {
        ...ctx,
        now,
        cal: calendarAt(now),
        rng: (stream, key) => rng(ctx.seed, stream, now, key),
        emit: (e) => ctx.emit({ ...e, t: e.t ?? now }),
      });
    }
    world.time = saved;
    preparationHour(world, ctx);
  } finally {
    world.time = saved;
  }
}
