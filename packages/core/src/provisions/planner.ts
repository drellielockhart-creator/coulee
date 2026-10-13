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
  dailyKcalParts,
  dailyNeedExplain,
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
  details = true,
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
    details && world.fae?.charms
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
  const storedWater = details ? waterAvailable(world, content, holder) : 0;
  const thirst = content.needs.thirst;
  // A day's drinking: 16 waking hours and 8 asleep at the thirst need's rates (light labor).
  const dailyDrinking =
    members.length *
    (thirst
      ? Math.round(
          ((thirst.decay_per_hour * (16 * 100 + 8 * thirst.asleep_pct)) / 100) * (thirst.intake?.per_point ?? 2),
        )
      : 3000);
  const carriedWater = !('householdId' in holder) && storedWater < 100000;
  result.daysOfWaterTenths = carriedWater ? Math.floor((storedWater * 10) / Math.max(1, dailyDrinking)) : null;
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
    const factors = details ? spoilageFactors(world, content, stack, calendarAt(asGameMinute(now))) : null;
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
  // A paid or cooking plate is food on hand. The projection counts it as eaten in the first
  // window instead of keeping a plate that may wait at another place and block every meal.
  const pendingKcal = (world.provisions.pendingMeals ?? []).reduce(
    (n, meal) => n + meal.plates.filter((p) => members.includes(p.id)).reduce((sum, p) => sum + p.kcal, 0),
    0,
  );
  result.kcalOnHand += pendingKcal;
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
      pendingMeals: [],
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
  const fuelStart = details ? holderSupply(world, content, holder, 'fire') : 0;
  let fuelDay = 0,
    foodHours = 0,
    windowKcal = pendingKcal,
    windowTarget = 0,
    saltPoints = 0;
  /** Each judged day's planned energy: the figure the readout prints is their mean (P1). */
  const targets: number[] = [];
  // Cap at a year: huge debug inventories must not freeze a view query. Report the cap plainly.
  // Household decisions pass a shorter horizon: they only compare against the ration thresholds.
  const horizon = Math.max(1, Math.min(366, Math.floor(horizonDays)));
  // Placement is stable within this private projection; hourly supply devices need stepping only when present.
  const placement: PlacementMemo = {};
  const hasDevices = rowsOf(projection.items.stacks).some((s) =>
    (content.items[s.defId]?.consumes ?? []).some((c) => c.per === 'hour' || c.per === 'day'),
  );
  // Orders change who eats, not what exists: the readout projects the kit as if it is eaten.
  const pass = { energy: new Map<string, number>(), explain: false, hypothetical: true };
  const rationPct = rationOf(world, holder);
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
          // Salt meat is the only thing that lowers Thirst through an event (meals.ts thirstFromSalt).
          if (event.kind === 'needs.changed' && event.data.needId === thirst?.id && event.data.delta < 0)
            saltPoints -= event.data.delta;
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
      const fuelBefore = details && hour < 24 ? holderSupply(projection, content, holder, 'fire') : 0;
      projectWaterHour(projection, ctx);
      nutritionHour(projection, ctx);
      storageHour(projection, ctx, placement, hems);
      preparationHour(projection, ctx);
      waterHour(projection, ctx);
      if (hasDevices) devicesHour(projection, ctx);
      const meal = dueMeal(projection, content, holder, cal.hour);
      if (meal) {
        // The same per-plate rounding as serveMeal: this is the energy the meal is sized to.
        windowTarget += members.reduce(
          (n, id) => n + Math.round((mealEnergy(projection, ctx, id, pass) * rationPct * meal.share_pct) / 10_000),
          0,
        );
        if (!members.some((id) => awaitingMeal(projection, id)))
          serveMeal(projection, ctx, holder, members, meal.share_pct, meal.cold, undefined, pass);
      }
      if (details && hour < 24) fuelDay += Math.max(0, fuelBefore - holderSupply(projection, content, holder, 'fire'));
      // A cold noon piece may fail while the two hot meals still cover 80% of the ration.
      // Judge a complete 24-hour window, including preparation completions, against the
      // documented daily 50% threshold. A partial day is never mistaken for exhaustion.
      if (hour % 24 === 23) {
        targets.push(windowTarget);
        if (windowKcal * 2 < windowTarget) break;
        foodHours = hour + 1;
        windowKcal = 0;
        windowTarget = 0;
      }
    }
  });
  result.daysOfFoodTenths = Math.round((foodHours * 10) / 24);
  // Internal decisions need only the projected horizon, not the seven-day
  // readout and conditional charm descriptions. Meal/storage rules above are identical.
  if (!details) return result;
  if (targets.length) result.kcalPerDay = Math.round(targets.reduce((n, t) => n + t, 0) / targets.length);
  // Water carried, with the salt the projected meals add (P8: salt meat costs water).
  const saltPerDay = Math.round(
    (saltPoints * (thirst?.intake?.per_point ?? 2)) / Math.max(1, Math.ceil(Math.max(foodHours, 24) / 24)),
  );
  if (carriedWater) {
    const perDay = dailyDrinking + saltPerDay;
    result.daysOfWaterTenths = Math.floor((storedWater * 10) / Math.max(1, perDay));
    if (result.daysOfWaterTenths < 10)
      result.warnings.push(
        `Water carried: ${(result.daysOfWaterTenths / 10).toFixed(1)} days (${storedWater} ml against about ${perDay} ml a day${saltPerDay ? `, ${saltPerDay} of it for salt meat` : ''}); fill at springs, creeks and fords.`,
      );
  }
  if (saltPerDay >= 300)
    result.warnings.push(
      `Salt meat asks about ${saltPerDay} ml more water a day as you would eat it; boiling it draws the salt (a kettle and pot water).`,
    );
  needLegibility(world, content, members, now, rationPct, result);
  if (world.fae?.charms && hems) {
    const rows = forecastCharms(world, content, members, stacks, hems);
    if (rows.length) result.charms = rows;
  }
  result.daysOfFuelTenths = fuelDay > 0 ? Math.floor((fuelStart * 10) / fuelDay) : null;
  if (foodHours >= 24 * horizon) result.warnings.push(`Food horizon capped at ${horizon} days.`);
  // The most urgent line first: hosts show only the first few.
  if (result.daysOfFoodTenths < 40) result.warnings.unshift('Less than four days of usable food at current rations.');
  return result;
}

/**
 * P1: why the daily need is what it is. One eater gets the Explain of today's scheduled day;
 * when the coming week's days differ by more than a tenth, a Kit line names the heavier day.
 */
function needLegibility(
  world: World,
  content: ContentBundle,
  members: readonly import('../ids.ts').ActorId[],
  now: number,
  rationPct: number,
  result: Readiness,
): void {
  const id = members.length === 1 ? members[0] : undefined;
  if (id === undefined) return;
  result.needExplain = dailyNeedExplain(world, content, id, now);
  const days = Array.from({ length: 7 }, (_, d) => dailyKcalParts(world, content, id, now + d * 1440));
  const kcal = (p: (typeof days)[number]) => Math.round((p.kcal * rationPct) / 100);
  const low = days.reduce((a, b) => (kcal(b) < kcal(a) ? b : a));
  const high = days.reduce((a, b) => (kcal(b) > kcal(a) ? b : a));
  result.needRange = { min: kcal(low), max: kcal(high) };
  if (kcal(high) * 10 <= kcal(low) * 11) return;
  const heavy = high.activities.filter((a) => a.labor === 'heavy').map((a) => `${a.name} ${a.hours} h`);
  result.warnings.push(
    `Daily need runs ${kcal(low)}–${kcal(high)} kcal this week: the heavier days carry ${high.hours.heavy} h of heavy labor${heavy.length ? ` (${heavy.join(', ')})` : ''} against ${low.hours.heavy} h.`,
  );
}
