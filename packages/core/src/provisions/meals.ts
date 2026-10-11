/** Shared meal kernel: runtime and readiness both consume this exact inventory/preparation model. */
import type { PrepDef } from '@coulee/content/schema';
import { skillCheck } from '../checks.ts';
import type { ContentBundle, ItemDef } from '../content.ts';
import { type Explain, term } from '../explain.ts';
import { type ActorId, type HouseholdId, type ItemId, rowsOf } from '../ids.ts';
import {
  affordanceAt,
  carriedBy,
  consumeSupply,
  deleteStack,
  pantryOf,
  stacksDeep,
  supplyUnits,
} from '../items/api.ts';
import { rootLocation, sameLoc } from '../items/containers.ts';
import { type ItemLocation, type ItemStack, recordProvenance } from '../items/state.ts';
import { drink, feed, needValue } from '../needs/api.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { asGameMinute, calendarAt, yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import {
  agePct,
  BASE_KCAL_PER_DAY,
  LABOR_PCT,
  MAX_SHARE_PCT,
  mealPlanFor,
  peopleKcalPct,
  policyFor,
  SIDE_KCAL_MAX,
  TURNING_MORALE,
} from './rules.ts';
import { emptyNutrition } from './state.ts';

export type Holder = { actorId: ActorId } | { householdId: HouseholdId };
export const locationOf = (h: Holder): ItemLocation =>
  'actorId' in h ? carriedBy(h.actorId) : pantryOf(h.householdId);

/** The schedule's full day burn, avoiding the noon-labor/overnight-labor estimate discontinuity. */
export function dailyKcal(world: World, content: ContentBundle, id: ActorId, now: number): number {
  const a = world.actors[id];
  if (!a?.alive) return 0;
  const cal = calendarAt(asGameMinute(now));
  const schedule = content.occupations[a.occupationId]?.schedule ?? [];
  let labor = 0;
  for (let h = 0; h < 24; h++) {
    const block = schedule.find(
      (b) =>
        (!b.days || b.days.includes(cal.weekday)) &&
        (b.from < b.to ? h >= b.from && h < b.to : h >= b.from || h < b.to),
    );
    labor += LABOR_PCT[(block ? content.activities[block.activity]?.labor : undefined) ?? 'light'];
  }
  return Math.round(
    (BASE_KCAL_PER_DAY * labor * agePct(yearsBetween(a.born, cal.t)) * peopleKcalPct(content.peoples[a.ancestryId])) /
      (24 * 100 * 100 * 100),
  );
}

export function membersOf(world: World, holder: Holder): ActorId[] {
  return 'actorId' in holder
    ? world.actors[holder.actorId]?.alive
      ? [holder.actorId]
      : []
    : rowsOf(world.actors)
        .filter((a) => a.alive && a.householdId === holder.householdId)
        .map((a) => a.id);
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
  morale: number;
  kcal: number;
  units: number;
}

/** Household water is hauled daily; travelers need stored water or a water source at their place. */
export function waterAvailable(world: World, content: ContentBundle, holder: Holder): number {
  if ('householdId' in holder) return world.provisions.households[holder.householdId]?.waterMl ?? 0;
  const actor = world.actors[holder.actorId];
  if (actor && world.places[actor.placeId]?.tags.includes('water')) return 100_000;
  return (
    supplyUnits(world, content, locationOf(holder), 'water') +
    stacksDeep(world, locationOf(holder)).reduce((n, s) => n + (s.stack.waterMl ?? 0), 0)
  );
}
export function drawWater(world: World, content: ContentBundle, holder: Holder, ml: number): void {
  if ('householdId' in holder) {
    const h = world.provisions.households[holder.householdId];
    if (h) h.waterMl = Math.max(0, (h.waterMl ?? 0) - ml);
    return;
  }
  const actor = world.actors[holder.actorId];
  if (actor && world.places[actor.placeId]?.tags.includes('water')) return;
  let remaining = ml - consumeSupply(world, content, locationOf(holder), 'water', ml);
  for (const { stack } of stacksDeep(world, locationOf(holder))) {
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
  afford: (key: string) => number;
  refresh: () => void;
}

export function kitchenOf(world: World, content: ContentBundle, holder: Holder): Kitchen {
  const loc = locationOf(holder);
  const memo: Record<string, number> = {};
  const k: Kitchen = {
    fuel: supplyUnits(world, content, loc, 'fire'),
    water: waterAvailable(world, content, holder),
    afford: (key) => {
      const hit = memo[key];
      if (hit !== undefined) return hit;
      const v = affordanceAt(world, content, loc, key);
      memo[key] = v;
      return v;
    },
    refresh: () => {
      k.fuel = supplyUnits(world, content, loc, 'fire');
      k.water = waterAvailable(world, content, holder);
    },
  };
  return k;
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
  budget = 360,
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
        waterMl += Math.ceil(p.water_ml * stageServings);
        for (const key of p.cookware) if (kitchen.afford(key) <= 0 && !missing.includes(key)) missing.push(key);
        if (p.yields) {
          units *= p.yields_qty;
          stageId = p.yields;
        }
      }
      if (fire > fuel) missing.push('fire supply');
      if (waterMl > water) missing.push('water');
      if (minutes > budget) missing.push(`time (${minutes} minutes)`);
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

interface Plate {
  id: ActorId;
  target: number;
  kcal: number;
  items: Array<{ defId: string; qty: number; method: string; servingsPm?: number }>;
  hot: boolean;
  morale: number;
  children: Explain[];
}
export interface MealResult {
  target: number;
  kcal: number;
  fire: number;
  minutes: number;
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
): MealResult {
  const content = ctx.content,
    loc = locationOf(holder);
  const plates: Plate[] = diners.map((id) => ({
    id,
    target: Math.round((dailyKcal(world, content, id, ctx.now) * rationOf(world, holder) * sharePct) / 10_000),
    kcal: 0,
    items: [],
    hot: false,
    morale: 0,
    children: [],
  }));
  const policy = policyFor(
    content,
    'householdId' in holder ? world.provisions.households[holder.householdId]?.policy : undefined,
  );
  let timeLeft = 'householdId' in holder ? 360 : 120,
    totalFire = 0,
    totalMinutes = 0;
  const kitchen = kitchenOf(world, content, holder);
  const candidates = stacksDeep(world, loc)
    .map((s) => s.stack)
    .filter((s) => foodServings(content, s) > 0 && (!explicit || s.id === explicit.itemId));
  const scores = new Map<ItemId, number>();
  const scoreTerms = new Map<ItemId, Explain['terms']>();
  for (const stack of candidates) {
    const food = content.items[stack.defId]?.food;
    const def = content.items[stack.defId];
    if (!food || !def) continue;
    const variety = plates.some((p) => !world.provisions.nutrition[p.id]?.today.foods.includes(stack.defId)) ? 40 : 0;
    const urgency = Math.floor(500 / Math.max(1, food.shelf_life_days)) + Math.floor(stack.spoilage / 10);
    const reserved = def.tags.some((t) => policy.reserve_tags.includes(t)) ? -10_000 : 0;
    const terms = [
      term('spoilage', 'Spoils-first preference', urgency * policy.weights.spoils_first),
      term('nutrition', 'Fresh-food preference', food.fresh * policy.weights.fresh_need),
      term('morale', 'Food morale preference', food.morale * policy.weights.morale),
      term('variety', 'Variety preference', variety * policy.weights.variety),
      term(
        'weight',
        'Pack-weight preference',
        Math.floor(def.weight_g / food.servings / 10) * policy.weights.lightness,
      ),
      term('cost', 'Thrift preference', -def.value_cents * policy.weights.thrift),
      term('policy', 'Reserved trail rations', reserved),
    ];
    scores.set(
      stack.id,
      terms.reduce((n, t) => n + t.value, 0),
    );
    scoreTerms.set(stack.id, terms);
  }
  candidates.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || a.id - b.id);
  const sides = new Set<ItemId>();
  /** Foods that could not be prepared; logged only if the meal then fell short (the failure mattered). */
  const failures: Array<{ itemId: ItemId; missing: string[] }> = [];
  for (let pass = 0; pass < (explicit ? 1 : 2); pass++) {
    for (const stack of candidates) {
      if (!world.items.stacks[stack.id]) continue;
      const have = foodServings(content, stack);
      if (!have) continue;
      const trial = recipesFor(world, content, holder, stack, 1, cold, explicit?.method, timeLeft, kitchen);
      const recipe = trial
        .filter((r) => r.missing.length === 0)
        .sort(
          (a, b) =>
            b.morale - a.morale ||
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
        const n = Math.min(havePm, needPm, !explicit && plate.kcal >= plate.target && !side ? 0 : needPm);
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
      consumeSupply(world, content, loc, 'fire', batch.fire);
      drawWater(world, content, holder, batch.water);
      kitchen.refresh();
      timeLeft -= batch.minutes;
      totalMinutes += batch.minutes;
      totalFire += batch.fire;
      const checks: Explain[] = [];
      let failed = false;
      const cook = world.actors[diners[0] as ActorId];
      for (let i = 0; i < batch.steps.length; i++) {
        const prep = batch.steps[i];
        if (prep?.check && cook && content.skills[prep.check.skill]) {
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
      const usedPm = stack.partial * 1000 + (stack.foodPartialPm ?? 0) + servingsPm;
      const food = content.items[stack.defId]?.food;
      if (!food) continue;
      const unitsUsed = Math.floor(usedPm / (food.servings * 1000));
      stack.qty -= unitsUsed;
      const leftPm = usedPm % (food.servings * 1000);
      stack.partial = Math.floor(leftPm / 1000);
      stack.foodPartialPm = leftPm % 1000;
      const e = ctx.emit({
        kind: 'provisions.prepared',
        data: {
          itemId: stack.id,
          from: stack.defId,
          into: batch.defId,
          servings: Math.ceil(servings),
          servingsPm,
          methods: batch.steps.map((p) => p.method),
          fireMinutes: batch.fire,
          waterMl: batch.water,
          minutes: batch.minutes,
        },
        roles: diners.map((actor) => ({ actor, role: 'participant' })),
        visibility: 'private',
        explain: {
          ...mealExplain('Preparation batch', diners, servingsPm, [
            term('item', 'Serving portions per mille', servingsPm),
            term('fuel', 'Fire minutes', batch.fire),
            term('water', 'Water ml', batch.water),
            term('time', 'Preparation minutes', batch.minutes),
          ]),
          children: checks,
        },
      });
      recordProvenance(stack, e);
      const consumedEventId = ctx.emit({
        kind: 'items.consumed',
        data: { itemId: stack.id, defId: stack.defId, qty: unitsUsed, reason: `${servings} servings prepared` },
        visibility: 'private',
        explain: mealExplain('Food consumed', diners, servingsPm, [
          term('food', 'Serving portions per mille', servingsPm),
        ]),
      });
      recordProvenance(stack, consumedEventId);
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
        const today = nutrition.today;
        const kcal = Math.round((n * batch.kcal * (failed ? 80 : 100)) / 100);
        plate.kcal += kcal;
        plate.hot ||= batch.fire > 0;
        plate.morale += Math.round(n * (batch.morale + (failed ? -3 : 0)));
        plate.items.push({
          defId: stack.defId,
          qty: Math.ceil(n),
          servingsPm: portionPm,
          method: batch.steps.map((p) => p.method).join('/'),
        });
        plate.children.push(
          mealExplain('Food policy score', [plate.id], scores.get(stack.id) ?? 0, scoreTerms.get(stack.id) ?? []),
        );
        today.kcal += kcal;
        today.proteinG += Math.round((batch.food.protein_g * batch.units * n) / food.servings);
        today.fatG += Math.round((batch.food.fat_g * batch.units * n) / food.servings);
        today.freshPoints += Math.round((batch.food.fresh * n * batch.units * batch.food.servings) / food.servings);
        if (batch.food.hydrates)
          drink(world, ctx, plate.id, Math.round((batch.food.liquid_ml * batch.units * n) / food.servings), {
            label: 'Drink with meal',
          });
        today.servings += Math.ceil(n);
        if (!today.groups.includes(batch.food.group)) today.groups.push(batch.food.group);
        if (!today.foods.includes(stack.defId)) today.foods.push(stack.defId);
        nutrition.intoxication = Math.min(
          1000,
          nutrition.intoxication +
            Math.round((((batch.food.liquid_ml * batch.food.alcohol_pct * 79) / 10_000) * n * 14) / food.servings),
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
        explain: mealExplain('Cannot prepare food', diners, 0, [], 'failure'),
      });
  for (const plate of plates) {
    world.provisions.nutrition[plate.id] ??= emptyNutrition(ctx.cal.dayIndex);
    const n = world.provisions.nutrition[plate.id];
    if (!n) continue;
    n.today.needKcal += Math.round((dailyKcal(world, content, plate.id, ctx.now) * sharePct) / 100);
    if (!plate.items.length) continue;
    n.today.meals++;
    n.today.morale += plate.morale;
    if (plate.hot) n.today.hotMeals++;
    else n.today.coldMeals++;
    n.lastMealAt = ctx.now;
    const eventId = ctx.emit({
      kind: 'provisions.meal',
      data: {
        actorId: plate.id,
        householdId: 'householdId' in holder ? holder.householdId : null,
        items: plate.items,
        kcal: plate.kcal,
        hot: plate.hot,
        morale: plate.morale,
      },
      roles: [{ actor: plate.id, role: 'agent' }],
      visibility: 'private',
      explain: {
        ...mealExplain('Meal intake', [plate.id], plate.kcal, [
          term('need', 'Target kcal', plate.target),
          term('policy', 'Ration percent', rationOf(world, holder)),
        ]),
        children: plate.children,
      },
    });
    feed(world, ctx, plate.id, plate.kcal, { label: 'Meal', eventId });
  }
  return {
    target: plates.reduce((n, p) => n + p.target, 0),
    kcal: plates.reduce((n, p) => n + p.kcal, 0),
    fire: totalFire,
    minutes: totalMinutes,
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
