import { loadContentOrThrow } from '@coulee/content';
import { describe, expect, it } from 'vitest';
import { activitySystem } from '../../core/src/activity/system.ts';
import type { ContentBundle } from '../../core/src/content.ts';
import { appendEvent, emptyLog } from '../../core/src/events/index.ts';
import { findNonIntegers, hashValue } from '../../core/src/hash.ts';
import { asActorId, asHouseholdId, asPlaceId, mustGet } from '../../core/src/ids.ts';
import {
  affordanceAt,
  allStacks,
  appendStacksDeep,
  carriedBy,
  consumeStack,
  consumeSupply,
  deleteStack,
  moveStack,
  stacksDeep,
  supplyUnits,
  withInventoryPass,
} from '../../core/src/items/api.ts';
import { protectionsOf, rootLocation } from '../../core/src/items/containers.ts';
import { loadCheckTerms, loadReport } from '../../core/src/items/encumbrance.ts';
import { createItemsState, newStack } from '../../core/src/items/state.ts';
import { viewItemsActor } from '../../core/src/items/view.ts';
import { proposeNeedUrges } from '../../core/src/needs/api.ts';
import { hourlyLedger } from '../../core/src/needs/system.ts';
import { heatPlaces } from '../../core/src/needs/thermal.ts';
import { drinkWater, readinessOf, refillWater, waterHour } from '../../core/src/provisions/api.ts';
import { purchase, replenishDomestic, shoppingHour } from '../../core/src/provisions/economy.ts';
import { devicesHour, storageHour } from '../../core/src/provisions/environment.ts';
import {
  foodServings,
  kitchenOf,
  preparationHour,
  recipesFor,
  serveMeal,
  withProjectionMeals,
} from '../../core/src/provisions/meals.ts';
import { nutritionHour } from '../../core/src/provisions/nutrition.ts';
import { spoilageFactors } from '../../core/src/provisions/spoilage.ts';
import { createProvisionsState, emptyNutrition } from '../../core/src/provisions/state.ts';
import { provisionsSystem } from '../../core/src/provisions/system.ts';
import { viewProvisionsActor, viewProvisionsHousehold } from '../../core/src/provisions/view.ts';
import { rng } from '../../core/src/rng.ts';
import type { SimContext } from '../../core/src/sim/context.ts';
import { runDays, step } from '../../core/src/sim/sim.ts';
import { debtOf, extendCredit, resolveInteraction } from '../../core/src/social/api.ts';
import { asGameMinute, calendarAt, parseGameDate } from '../../core/src/time.ts';
import { DEFAULT_VIEW_OPTIONS } from '../../core/src/viewmodel-types.ts';
import type { World } from '../../core/src/world.ts';

const content = loadContentOrThrow();

describe('provisions acceptance', () => {
  it('inventory pass enumeration stays ordered and live through splits, deletion, and separate worlds', () => {
    const world = fixture(content);
    const other = fixture(content);
    const first = add(world, 'flour', 4);
    const second = add(world, 'salt_pork', 2);
    const elsewhere = add(other, 'dried_apples', 3);
    const ctx = context(world, content);
    let split = first;
    withInventoryPass(world, () => {
      expect(allStacks(world).map((s) => s.id)).toEqual([first, second]);
      split = moveStack(world, ctx, first, 1, carriedBy(A));
      expect(allStacks(world).map((s) => s.id)).toEqual([first, second, split]);
      deleteStack(world, second);
      expect(allStacks(world).map((s) => s.id)).toEqual([first, split]);
      withInventoryPass(other, () => {
        expect(allStacks(other).map((s) => s.id)).toEqual([elsewhere]);
        expect(allStacks(world).map((s) => s.id)).toEqual([first, split]);
      });
      // A returned array belongs to the caller, not the pass.
      allStacks(world).length = 0;
      expect(allStacks(world).map((s) => s.id)).toEqual([first, split]);
    });
    expect(() =>
      withInventoryPass(world, () => {
        allStacks(world);
        throw new Error('end pass');
      }),
    ).toThrow('end pass');
    const fresh = add(world, 'salt_pork', 1);
    expect(allStacks(world).map((s) => s.id)).toEqual([first, split, fresh]);
  });

  it('nested inventory passes track leaf deletion, container hoisting, and moves without stale locations', () => {
    const world = fixture(content);
    const bag = add(world, 'oilcloth_bag', 1, true);
    const food = newStack(world, 'flour', 1, { kind: 'container', itemId: bag }, world.time);
    const leaf = add(world, 'dried_apples', 1, true);
    const atActor = () => stacksDeep(world, carriedBy(A)).map(({ stack, depth }) => [stack.id, depth]);
    withInventoryPass(world, () => {
      expect(atActor()).toEqual([
        [bag, 0],
        [food, 1],
        [leaf, 0],
      ]);
      stacksDeep(world, carriedBy(A)).length = 0;
      const collected: import('../../core/src/items/state.ts').ItemStack[] = [];
      appendStacksDeep(world, carriedBy(A), collected);
      expect(collected.map((s) => s.id)).toEqual([bag, food, leaf]);
      withInventoryPass(world, () => deleteStack(world, leaf));
      expect(atActor()).toEqual([
        [bag, 0],
        [food, 1],
      ]);
      withInventoryPass(world, () => deleteStack(world, bag));
      expect(atActor()).toEqual([[food, 0]]);
      withInventoryPass(world, () =>
        moveStack(world, context(world, content), food, 1, { kind: 'household', householdId: H }),
      );
      expect(atActor()).toEqual([]);
      expect(stacksDeep(world, { kind: 'household', householdId: H }).map(({ stack }) => stack.id)).toEqual([food]);
    });
  });

  it('internal supply snapshots stay live across nested draws and exhausted stacks', () => {
    const world = fixture(content);
    const loc = { kind: 'household' as const, householdId: H };
    const box = add(world, 'oilcloth_bag', 1);
    const fuel = newStack(world, 'firewood_armload', 1, { kind: 'container', itemId: box }, world.time);
    const spare = add(world, 'firewood_armload', 1);
    const units = content.items.firewood_armload?.supply?.units ?? 0;
    withInventoryPass(world, () => {
      expect(supplyUnits(world, content, loc, 'fire')).toBe(units * 2);
      expect(consumeSupply(world, content, loc, 'fire', units + 1)).toBe(units + 1);
      expect(world.items.stacks[fuel]).toBeUndefined();
      expect(world.items.stacks[spare]?.partial).toBe(1);
      expect(supplyUnits(world, content, loc, 'fire')).toBe(units - 1);
      const collected: import('../../core/src/items/state.ts').ItemStack[] = [];
      appendStacksDeep(world, loc, collected);
      expect(collected.map((s) => s.id)).toEqual([box, spare]);
      deleteStack(world, spare);
      expect(supplyUnits(world, content, loc, 'fire')).toBe(0);
      expect(consumeSupply(world, content, loc, 'fire', 1)).toBe(0);
    });
  });

  it('1: equal energy with fresh sides prevents scurvy while a salt-pork/flour diet crosses the threshold', () => {
    const lean = fixture(content),
      varied = fixture(content);
    for (const w of [lean, varied]) {
      add(w, 'flint_steel_char_tin', 1);
      add(w, 'flour', 150);
      add(w, 'salt_pork', 100);
      add(w, 'firewood_armload', 1500);
      add(w, 'frying_pan', 1);
      add(w, 'camp_kettle_pair', 1);
    }
    // Equal stored kcal: replace pork calories with apples, rather than grant extra energy.
    const apple = content.items.dried_apples?.food?.kcal ?? 1;
    const pork = content.items.salt_pork?.food?.kcal ?? 1;
    let x = pork,
      y = apple;
    while (y !== 0) {
      const remainder = x % y;
      x = y;
      y = remainder;
    }
    const removedPork = (2 * apple) / x,
      q = (2 * pork) / x;
    const s = Object.values(varied.items.stacks).find((s) => s.defId === 'salt_pork');
    if (s) s.qty -= removedPork;
    add(varied, 'dried_apples', q);
    const storedKcal = (w: World) =>
      Object.values(w.items.stacks).reduce((n, s) => n + (content.items[s.defId]?.food?.kcal ?? 0) * s.qty, 0);
    expect(storedKcal(lean)).toBe(storedKcal(varied));
    advanceOwned(lean, content, 60 * 24 + 1, provisionsSystem);
    advanceOwned(varied, content, 60 * 24 + 1, provisionsSystem);
    expect(lean.provisions.nutrition[A]?.scurvy).toBeGreaterThanOrEqual(500);
    expect(varied.provisions.nutrition[A]?.scurvy).toBeLessThan(500);
    expect(lean.actors[A]?.sheet.conditions).toContain('scurvy_early');
    expect(lean.provisions.nutrition[A]?.monotony).toBeGreaterThan(varied.provisions.nutrition[A]?.monotony ?? 0);
  });

  it('2: cellar and brine slow pork; wet hardtack accelerates; summer trout expires with factor Explains', () => {
    const w = fixture(content);
    w.time = parseGameDate('1855-07-15T14:00');
    const pork = add(w, 'salt_pork', 2),
      keg = add(w, 'brine_keg_10gal', 1);
    const stack = w.items.stacks[pork];
    if (!stack) throw new Error('missing');
    const indoor = spoilageFactors(w, content, stack, context(w, content).cal);
    const hp = w.provisions.households[H];
    if (hp) hp.storage = 'cellar';
    const cellar = spoilageFactors(w, content, stack, context(w, content).cal);
    expect(cellar?.combinedPct).toBeLessThan(indoor?.combinedPct ?? 0);
    stack.location = { kind: 'container', itemId: keg };
    expect(spoilageFactors(w, content, stack, context(w, content).cal)?.combinedPct).toBeLessThan(
      cellar?.combinedPct ?? 0,
    );
    const tack = add(w, 'hardtack', 1),
      bag = add(w, 'oilcloth_bag', 1);
    const t = w.items.stacks[tack];
    if (!t) throw new Error('missing');
    const dry = spoilageFactors(w, content, t, context(w, content).cal);
    t.wetness = 100;
    const wet = spoilageFactors(w, content, t, context(w, content).cal);
    expect(wet?.combinedPct).toBeGreaterThan(dry?.combinedPct ?? 0);
    t.location = { kind: 'container', itemId: bag };
    expect(spoilageFactors(w, content, t, context(w, content).cal)?.combinedPct).toBeLessThan(wet?.combinedPct ?? 0);
    if (hp) hp.storage = 'indoor';
    const trout = add(w, 'trout_fresh', 1);
    advanceOwned(w, content, 48, storageHour);
    expect(w.items.stacks[trout]).toBeUndefined();
    const event = w.log.events.find((e) => e.kind === 'provisions.spoiled');
    expect(event?.explain?.terms.some((t) => t.label.includes('Temperature band'))).toBe(true);
    expect(event?.explain?.terms.some((t) => t.label.includes('Wet multiplier'))).toBe(true);
    expect(event?.explain?.terms.some((t) => t.label.includes('Packaging multiplier'))).toBe(true);
    expect(event?.explain?.knowledge).toBeDefined();
  });

  it('3: no kettle leaves beans inedible and hardtack raw; fire is per batch; coffee requires every stage', () => {
    const w = fixture(content, 2);
    const beans = add(w, 'beans_dry', 2),
      tack = add(w, 'hardtack', 10);
    add(w, 'firewood_armload', 50);
    serveMeal(w, context(w, content), { householdId: H }, [A], 25);
    expect(w.items.stacks[beans]?.qty).toBe(2);
    w.time = asGameMinute(w.time + 60);
    preparationHour(w, context(w, content));
    expect(w.log.events.some((e) => e.kind === 'provisions.meal' && !e.data.hot)).toBe(true);
    const noFire = fixture(content);
    add(noFire, 'beans_dry', 2);
    add(noFire, 'camp_kettle_pair', 1);
    expect(serveMeal(noFire, context(noFire, content), { householdId: H }, [A], 25).kcal).toBe(0);
    const batch = fixture(content, 2);
    add(batch, 'flint_steel_char_tin', 1);
    const apples = add(batch, 'dried_apples', 10);
    add(batch, 'camp_kettle_pair', 1);
    add(batch, 'firewood_armload', 10);
    const before = supplyUnits(batch, content, { kind: 'household', householdId: H }, 'fire');
    const recipe = recipesFor(
      batch,
      content,
      { householdId: H },
      mustGet(batch.items.stacks, apples, 'stack'),
      2,
      false,
      'boil',
    )[0];
    expect(recipe?.fire).toBe(30);
    serveMeal(batch, context(batch, content), { householdId: H }, [A, 2 as typeof A], 25, false, {
      itemId: apples,
      method: 'boil',
      servings: 1,
    });
    expect(before - supplyUnits(batch, content, { kind: 'household', householdId: H }, 'fire')).toBe(40); // Thirty cooking minutes plus ten kindling minutes for the cold fire.
    const coffee = add(batch, 'coffee_green', 1);
    expect(
      recipesFor(batch, content, { householdId: H }, mustGet(batch.items.stacks, coffee, 'stack'), 1)[0]?.missing,
    ).toContain('grind');
    add(batch, 'coffee_mill_hand', 1);
    add(batch, 'frying_pan', 1);
    const paths = recipesFor(batch, content, { householdId: H }, mustGet(batch.items.stacks, coffee, 'stack'), 1);
    expect(
      paths.some((r) => r.missing.length === 0 && r.steps.map((p) => p.method).join('/') === 'roast/grind/brew'),
    ).toBe(true);
    expect(foodServings(content, mustGet(w.items.stacks, tack, 'stack'))).toBeLessThan(
      10 * (content.items.hardtack?.food?.servings ?? 1),
    );
  });

  it.each([1, 42, 99])('4: projected depletion matches runtime at seed %s, including spoilage and fuel', (seed) => {
    const w = fixture(content);
    w.meta.seed = seed;
    add(w, 'hardtack', 12);
    add(w, 'dried_apples', 3);
    add(w, 'salt_pork', 3);
    const before = hashValue(w);
    const r = readinessOf(w, content, { householdId: H }, w.time);
    expect(hashValue(w)).toBe(before);
    let goodDays = 0;
    for (let day = 0; day < 25; day++) {
      let kcal = 0;
      const begin = w.log.events.length;
      advanceOwned(w, content, 24, provisionsSystem);
      for (const event of w.log.events.slice(begin)) if (event.kind === 'provisions.meal') kcal += event.data.kcal;
      if (kcal * 2 < r.kcalPerDay) break;
      goodDays++;
    }
    expect(r.daysOfFoodTenths).toBe(goodDays * 10);
  });

  it('readiness isolates existing nutrition history and fires across repeated projections', () => {
    const w = fixture(content);
    add(w, 'hardtack', 30);
    add(w, 'dried_apples', 10);
    advanceOwned(w, content, 48, provisionsSystem);
    const nutrition = mustGet(w.provisions.nutrition, A, 'nutrition');
    expect(nutrition.history.length).toBeGreaterThan(0);
    w.provisions.fires[P] = { placeId: P, lit: true, fuelMinutes: 120, until: w.time + 120 };
    const before = hashValue(w);
    const plan = readinessOf(w, content, { householdId: H }, w.time, 4);
    expect(hashValue(w)).toBe(before);
    expect(readinessOf(w, content, { householdId: H }, w.time, 4)).toEqual(plan);
    expect(hashValue(w)).toBe(before);
  });

  it('compiled preparation paths retain live resource checks and caller-owned steps', () => {
    const w = fixture(content);
    const holder = { householdId: H };
    const coffee = mustGet(w.items.stacks, add(w, 'coffee_green', 2));
    const oysters = mustGet(w.items.stacks, add(w, 'oysters_tinned', 2));
    add(w, 'flint_steel_char_tin', 1);
    add(w, 'firewood_armload', 20);
    add(w, 'frying_pan', 1);
    add(w, 'camp_kettle_pair', 1);
    withProjectionMeals(w, () => {
      const kitchen = kitchenOf(w, content, holder);
      const brew = () => recipesFor(w, content, holder, coffee, 1.333, false, 'roast', 360, kitchen);
      const first = brew();
      expect(first[0]?.steps.map((p) => p.method)).toEqual(['roast', 'grind', 'brew']);
      expect(first[0]?.water).toBe(334);
      first[0]?.steps.pop();
      expect(brew()[0]?.steps).toHaveLength(3);
      expect(recipesFor(w, content, holder, coffee, 1, false, 'grind', 360, kitchen)).toEqual([]);
      mustGet(w.provisions.households, H).waterMl = 0;
      consumeSupply(w, content, { kind: 'household', householdId: H }, 'fire', 100000);
      kitchen.refresh();
      expect(brew()[0]?.missing).toContain('water');
      expect(brew()[0]?.missing).toContain('fire supply');
      expect(brew()).toEqual(
        recipesFor(w, content, holder, coffee, 1.333, false, 'roast', 360, {
          ...kitchen,
          preparationPaths: undefined,
        }),
      );
      const closed = recipesFor(w, content, holder, oysters, 1, false, 'raw', 360, kitchen)[0];
      oysters.opened = true;
      oysters.spoilage = 999;
      const opened = recipesFor(w, content, holder, oysters, 1, false, 'raw', 360, kitchen)[0];
      expect(opened?.minutes).toBe((closed?.minutes ?? 0) - 1);
      expect(opened?.morale).toBeLessThan(closed?.morale ?? 0);
      // A later kitchen shares only content paths, not the previous kitchen's frozen state.
      coffee.frozen = true;
      const frozen = kitchenOf(w, content, holder);
      const frozenBrew = recipesFor(w, content, holder, coffee, 1.333, false, 'roast', 360, frozen)[0];
      expect(frozenBrew?.fire).toBe(Math.ceil(((brew()[0]?.fire ?? 0) * 150) / 100));
    });
  });

  it('5: shortages cut rations; cash transfers balance and credit obeys the limit', () => {
    const w = fixture(content);
    add(w, 'hardtack', 1);
    w.provisions.settings.autoRations = true;
    provisionsSystem(w, context(w, content));
    expect(w.provisions.households[H]?.rationPct).toBe(50);
    expect(w.log.events.some((e) => e.kind === 'provisions.shortage')).toBe(true);
    const a = w.actors[A];
    if (a) a.placeId = STORE;
    w.provisions.stores[STORE] = {
      placeId: STORE,
      ownerHouseholdId: null,
      markupPct: 125,
      creditLimitCents: 100,
      restockId: null,
      tabs: {},
      tillCents: 0,
      wholesaleDebtCents: 0,
      lastRestockDay: null,
      targets: {},
    };
    newStack(w, 'flour', 100, { kind: 'place', placeId: STORE }, w.time);
    w.time = asGameMinute(8 * 60); // Shop is open.
    const cashBefore = w.provisions.households[H]?.cashCents ?? 0;
    expect(purchase(w, context(w, content), A, STORE, 'flour', 2, false)).toBe(2);
    expect((w.provisions.households[H]?.cashCents ?? 0) + mustGet(w.provisions.stores, STORE, 'store').tillCents).toBe(
      cashBefore,
    );
    mustGet(w.provisions.households, H, 'household').cashCents = 0;
    // Without an identifiable creditor there can be no repayable credit account.
    expect(purchase(w, context(w, content), A, STORE, 'flour', 100, true)).toBe(0);
    expect(w.provisions.stores[STORE]?.tabs[A] ?? 0).toBe(0);
  });

  it('6: a lantern burns hourly, and loses its light affordance on depletion', () => {
    const w = fixture(content);
    const lamp = add(w, 'glass_lantern_fenwick', 1, true);
    add(w, 'lard_oil_quart', 1, true);
    const s = w.items.stacks[lamp];
    if (!s) throw new Error('lamp');
    s.litMode = 'on';
    advanceOwned(w, content, 10, devicesHour);
    expect(supplyUnits(w, content, carriedBy(A), 'lamp_oil')).toBe(0);
    expect(s.lit).toBe(false);
    expect(affordanceAt(w, content, carriedBy(A), 'light')).toBe(0);
    advanceOwned(w, content, 1, devicesHour);
    expect(w.log.events.some((e) => e.kind === 'provisions.light' && e.data.reason === 'supply depleted')).toBe(true);
  });

  it('7: deterministic JSON continuation and integer state, including long-life spoilage carry', () => {
    const one = fixture(content);
    add(one, 'hardtack', 20);
    add(one, 'salt_pork', 20);
    add(one, 'lard_oil_quart', 1);
    advanceOwned(one, content, 100, provisionsSystem);
    const two = JSON.parse(JSON.stringify(one));
    advanceOwned(one, content, 100, provisionsSystem);
    advanceOwned(two, content, 100, provisionsSystem);
    expect(hashValue(one)).toBe(hashValue(two));
    expect(findNonIntegers(one)).toEqual([]);
    expect(Object.values(one.items.stacks).some((s) => s.spoilageCarry > 0)).toBe(true);
  });
});

describe('item audit repairs', () => {
  it('rejects non-containers, capacity overflow, ancestor overflow, and cycles atomically', () => {
    const w = fixture(content);
    const food = add(w, 'flour', 20),
      tool = add(w, 'frying_pan', 1),
      bag = add(w, 'oilcloth_bag', 1);
    expect(() => moveStack(w, context(w, content), food, 1, { kind: 'container', itemId: tool })).toThrow(
      'not a container',
    );
    expect(() => moveStack(w, context(w, content), food, 20, { kind: 'container', itemId: bag })).toThrow('full');
    expect(w.items.stacks[food]?.qty).toBe(20);
    const outer = add(w, 'tin_canister_10lb', 1);
    newStack(w, 'flour', 8, { kind: 'container', itemId: outer }, w.time);
    const inner = newStack(w, 'oilcloth_bag', 1, { kind: 'container', itemId: outer }, w.time);
    expect(() => moveStack(w, context(w, content), food, 2, { kind: 'container', itemId: inner })).toThrow(
      'full by weight',
    );
    expect(() => moveStack(w, context(w, content), bag, 1, { kind: 'container', itemId: bag })).toThrow();
  });
  it('retains two partial remainders, splits whole units, and appends consumption provenance', () => {
    const w = fixture(content);
    const a = add(w, 'hardtack', 3),
      b = add(w, 'hardtack', 3, true);
    mustGet(w.items.stacks, a, 'stack').partial = 1;
    mustGet(w.items.stacks, b, 'stack').partial = 1;
    moveStack(w, context(w, content), b, 3, { kind: 'household', householdId: H });
    expect(w.items.stacks[a]?.qty).toBe(3);
    expect(w.items.stacks[b]?.partial).toBe(1);
    const c = moveStack(w, context(w, content), a, 1, carriedBy(A));
    expect(w.items.stacks[c]?.partial).toBe(0);
    expect(w.items.stacks[a]?.partial).toBe(1);
    consumeStack(w, context(w, content), a, 1, 'test');
    expect(w.items.stacks[a]?.provenance.at(-1)).toBe(w.log.lastId);
  });
  it('walks beyond depth 24, evaluates protections outside-in, and reports encumbrance', () => {
    const w = fixture(content);
    let parent = add(w, 'oilcloth_bag', 1, true);
    for (let i = 0; i < 40; i++)
      parent = newStack(w, 'stoneware_crock_2gal', 1, { kind: 'container', itemId: parent }, w.time);
    const food = newStack(w, 'flour', 1, { kind: 'container', itemId: parent }, w.time);
    expect(rootLocation(w, mustGet(w.items.stacks, food, 'stack'))).toEqual(carriedBy(A));
    expect(stacksDeep(w, carriedBy(A))).toHaveLength(42);
    expect(protectionsOf(w, content, mustGet(w.items.stacks, food, 'stack'))[0]).toBe('waterproof');
    add(w, 'firewood_armload', 10, true);
    expect(viewItemsActor(w, content, A, DEFAULT_VIEW_OPTIONS).loadBand).not.toBe('Unburdened');
  });
});

describe('water, fuel, nutrition and perspective', () => {
  it('charges household water once daily and rejects recipes beyond the time window', () => {
    const w = fixture(content),
      beans = add(w, 'beans_dry', 2);
    add(w, 'camp_kettle_pair', 1);
    add(w, 'firewood_armload', 20);
    const h = mustGet(w.provisions.households, H, 'household');
    h.waterMl = 0;
    expect(
      recipesFor(w, content, { householdId: H }, mustGet(w.items.stacks, beans, 'beans'), 1)[0]?.missing,
    ).toContain('water');
    replenishDomestic(w, context(w, content), H);
    h.waterMl = 123;
    replenishDomestic(w, context(w, content), H);
    expect(h.waterMl).toBe(123);
    expect(
      recipesFor(
        w,
        content,
        { householdId: H },
        mustGet(w.items.stacks, beans, 'beans'),
        1,
        false,
        undefined,
        120,
      )[0]?.missing.some((m) => m.includes('time')),
    ).toBe(true);
  });
  it('wet wood supplies half its dry fire minutes, with raw-unit carry conserved', () => {
    const w = fixture(content);
    const wood = add(w, 'firewood_armload', 2);
    const stack = mustGet(w.items.stacks, wood, 'wood');
    stack.wetness = 100;
    expect(supplyUnits(w, content, { kind: 'household', householdId: H }, 'fire')).toBe(60);
    expect(consumeSupply(w, content, { kind: 'household', householdId: H }, 'fire', 20)).toBe(20);
    expect(stack.partial).toBe(40);
    stack.wetness = 0;
    expect(supplyUnits(w, content, { kind: 'household', householdId: H }, 'fire')).toBe(80);
  });
  it('a per-day device draws fractional units exactly over twenty-four lit hours', () => {
    const w = fixture(content);
    const lamp = add(w, 'glass_lantern_fenwick', 1, true);
    add(w, 'lard_oil_quart', 1, true);
    const def = content.items.glass_lantern_fenwick;
    if (!def) throw new Error('lamp definition');
    const dailyContent = {
      ...content,
      items: {
        ...content.items,
        glass_lantern_fenwick: { ...def, consumes: [{ kind: 'lamp_oil', per: 'day' as const, units: 5 }] },
      },
    };
    mustGet(w.items.stacks, lamp, 'lamp').litMode = 'on';
    advanceOwned(w, dailyContent, 24, devicesHour);
    expect(supplyUnits(w, content, carriedBy(A), 'lamp_oil')).toBe(595);
    expect(findNonIntegers(w)).toEqual([]);
  });
  it('half rations cause malnutrition even when the reduced meal target is met', () => {
    const w = fixture(content);
    add(w, 'salt_pork', 20);
    add(w, 'flour', 20);
    add(w, 'firewood_armload', 100);
    add(w, 'frying_pan', 1);
    mustGet(w.provisions.households, H, 'household').rationPct = 50;
    advanceOwned(w, content, 7 * 24, provisionsSystem);
    expect(w.actors[A]?.sheet.conditions).toContain('malnourished');
  });
  it('perspective hides purses, larders and nutrition; omniscient views expose them', () => {
    const w = fixture(content);
    add(w, 'hardtack', 2);
    const opts = { ...DEFAULT_VIEW_OPTIONS, perspective: asActorId(999) };
    expect(viewProvisionsHousehold(w, content, H, opts).pantry).toEqual([]);
    expect(viewProvisionsActor(w, content, A, opts).purseCents).toBe(0);
    expect(viewItemsActor(w, content, A, opts).loadBand).toBe('Unknown');
    expect(viewProvisionsHousehold(w, content, H, { ...opts, omniscient: true }).pantry).toHaveLength(1);
  });
});

// These tests exercise the actual Iron Ford initializer and its living household inventories.
describe('Iron Ford integration', () => {
  it('5: ninety days without purchasing cuts household rations; enabled errands move stock and money', async () => {
    const { simFor } = await import('./helpers.ts');
    const noBuy = simFor({ seed: 42 });
    noBuy.world.provisions.settings.npcBuying = false;
    for (const store of Object.values(noBuy.world.provisions.stores)) store.restockId = null;
    // Exercise owned rules while neighboring systems may still be stubs; locations remain at their initialized homes.
    advanceOwned(noBuy.world, content, 90 * 24, provisionsSystem);
    expect(noBuy.world.log.events.some((e) => e.kind === 'provisions.shortage')).toBe(true);
    expect(Object.values(noBuy.world.provisions.households).some((h) => h.rationPct < 100)).toBe(true);
    expect(findNonIntegers(noBuy.world)).toEqual([]);
    const buying = simFor({ seed: 42 });
    // Errands must run while the integrated venue service is open.
    buying.world.time = asGameMinute(9 * 60);
    buying.world.provisions.settings.wages = false;
    for (const store of Object.values(buying.world.provisions.stores)) store.restockId = null;
    // Select the grocery venue by role; canonical place IDs need not put it before the mill.
    const merchant = Object.values(buying.world.provisions.stores).find(
      (s) => s.creditLimitCents > 0 && buying.world.places[s.placeId]?.tags.includes('store'),
    );
    if (!merchant) throw new Error('No store');
    const household = Object.values(buying.world.households).find((h) => h.id !== merchant.ownerHouseholdId);
    if (!household) throw new Error('No household');
    const buyer = mustGet(buying.world.actors, household.headId, 'buyer');
    buyer.placeId = merchant.placeId;
    const h = mustGet(buying.world.provisions.households, household.id, 'household');
    h.cashCents = 0;
    buying.world.provisions.purses[buyer.id] = 0;
    merchant.tabs[buyer.id] = 0;
    for (const entry of stacksDeep(buying.world, { kind: 'household', householdId: household.id }))
      if (content.items[entry.stack.defId]?.food) entry.stack.qty = 0;
    const stockBefore = stacksDeep(buying.world, { kind: 'place', placeId: merchant.placeId }).reduce(
      (n, s) => n + s.stack.qty,
      0,
    );
    provisionsSystem(buying.world, context(buying.world, content));
    expect(
      buying.world.log.events.some(
        (e) => e.kind === 'provisions.purchase' && e.data.buyerId === buyer.id && e.data.onCredit,
      ),
    ).toBe(true);
    expect(
      stacksDeep(buying.world, { kind: 'place', placeId: merchant.placeId }).reduce((n, s) => n + s.stack.qty, 0),
    ).toBeLessThan(stockBefore);
    expect(merchant.tabs[buyer.id]).toBeGreaterThan(0);
    expect(merchant.tabs[buyer.id]).toBeLessThanOrEqual(merchant.creditLimitCents);
  }, 60_000);

  it('commands use accessible kit, enforce preparation and reject foreign packing', () => {
    const w = fixture(content);
    const tack = add(w, 'hardtack', 3, true);
    const bag = add(w, 'oilcloth_bag', 1, true);
    const ctx = context(w, content);
    provisionsSystem(w, {
      ...ctx,
      commands: [
        { kind: 'provisions.pack', actorId: A, data: { itemId: tack, qty: 1, intoItemId: bag } },
        { kind: 'provisions.set_rations', actorId: A, data: { householdId: null, rationPct: 75 } },
        { kind: 'provisions.eat', actorId: A, data: { itemId: tack, method: 'raw', servings: 1 } },
      ],
    });
    expect(w.provisions.nutrition[A]?.rationPct).toBe(75);
    expect(w.log.events.some((e) => e.kind === 'provisions.meal')).toBe(true);
    expect(w.log.events.some((e) => e.kind === 'provisions.command_rejected')).toBe(false);
  });
});

describe('P8 review regressions', () => {
  it('repays opening and newly purchased store credit, restores borrowing capacity, and forgives without moving cash', async () => {
    const { simFor } = await import('./helpers.ts');
    const sim = simFor({ seed: 42 }),
      w = sim.world;
    const store = Object.values(w.provisions.stores).find(
      (s) => s.creditLimitCents > 0 && s.ownerHouseholdId !== null && Object.values(s.tabs).includes(450),
    );
    if (!store || store.ownerHouseholdId === null) throw new Error('store');
    const keeper = mustGet(w.households, store.ownerHouseholdId, 'keeper household').headId;
    const debtorId = Object.keys(store.tabs)
      .map(Number)
      .find((id) => store.tabs[id] === 450) as typeof A;
    const debtor = mustGet(w.actors, debtorId, 'debtor');
    debtor.placeId = store.placeId;
    w.time = asGameMinute(9 * 60);
    const resolve = (id: string, initiatorId: typeof A, targetId: typeof A) => {
      const def = content.interactions[id];
      if (!def) throw new Error(id);
      const forgiving =
        id === 'forgive' ? { ...def, success: { ...def.success, settle: 'target_debt' as const } } : def;
      return resolveInteraction(w, context(w, content), {
        def: forgiving,
        initiatorId,
        targetId,
        placeId: store.placeId,
        present: [],
        mode: 'forced',
        via: 'urge',
      });
    };
    mustGet(w.provisions.households, debtor.householdId, 'household').cashCents = 1000;
    expect(debtOf(w, keeper, debtorId).cents).toBe(450);
    resolve('repay', debtorId, keeper);
    expect(store.tabs[debtorId]).toBe(0);
    expect(debtOf(w, keeper, debtorId).cents).toBe(0);
    mustGet(w.provisions.households, debtor.householdId, 'household').cashCents = 0;
    w.provisions.purses[debtorId] = 0;
    expect(purchase(w, context(w, content), debtorId, store.placeId, 'hardtack', 1, true)).toBe(1);
    const tab = store.tabs[debtorId];
    expect(tab).toBeGreaterThan(0);
    expect(debtOf(w, keeper, debtorId).cents).toBe(tab);
    const cash = mustGet(w.provisions.households, store.ownerHouseholdId, 'keeper cash').cashCents;
    resolve('forgive', keeper, debtorId);
    expect(store.tabs[debtorId]).toBe(0);
    expect(debtOf(w, keeper, debtorId).cents).toBe(0);
    expect(w.provisions.households[store.ownerHouseholdId]?.cashCents).toBe(cash);
    // An account can also be a receivable: buying goods offsets what the keeper owes,
    // without leaving a phantom tab or two contradictory creditor edges.
    extendCredit(w, context(w, content), debtorId, keeper, 100);
    purchase(w, context(w, content), debtorId, store.placeId, 'hardtack', 1, true);
    expect(store.tabs[debtorId]).toBe(0);
    expect(debtOf(w, keeper, debtorId).cents).toBe(0);
    expect(debtOf(w, debtorId, keeper).cents).toBe(92);
  });

  it('buys a preparable, varied diet from cornmeal, pork and apples; rejects inaccessible preparation', () => {
    const w = fixture(content);
    add(w, 'frying_pan', 1);
    add(w, 'flint_steel_char_tin', 1);
    add(w, 'firewood_armload', 30);
    mustGet(w.actors, A, 'actor').placeId = STORE;
    mustGet(w.provisions.households, H, 'cash').cashCents = 10000;
    w.provisions.settings.npcBuying = true;
    w.time = asGameMinute(9 * 60);
    w.provisions.stores[STORE] = {
      placeId: STORE,
      ownerHouseholdId: null,
      markupPct: 100,
      creditLimitCents: 0,
      restockId: null,
      tabs: {},
      tillCents: 0,
      wholesaleDebtCents: 0,
      lastRestockDay: null,
      targets: {},
    };
    for (const food of ['cornmeal', 'salt_pork', 'dried_apples', 'beans_dry'])
      newStack(w, food, 100, { kind: 'place', placeId: STORE }, w.time);
    shoppingHour(w, context(w, content));
    const bought = w.log.events.filter((e) => e.kind === 'provisions.purchase');
    for (const id of ['cornmeal', 'salt_pork', 'dried_apples'])
      expect(bought.some((e) => e.data.defId === id)).toBe(true);
    expect(bought.some((e) => e.data.defId === 'beans_dry')).toBe(false);
    expect(
      w.log.events
        .find((e) => e.kind === 'provisions.shopping_plan')
        ?.explain?.terms.some((t) => t.label.includes('Fat target')),
    ).toBe(true);
  });

  it('routes a starving funded actor to groceries rather than an impossible meal at an empty pantry', async () => {
    const { simFor, actorByKey } = await import('./helpers.ts');
    const sim = simFor({ seed: 42 }),
      w = sim.world,
      id = actorByKey(sim, 'johann_brenner');
    const actor = mustGet(w.actors, id, 'actor');
    for (const { stack } of stacksDeep(w, { kind: 'household', householdId: actor.householdId }))
      if (content.items[stack.defId]?.food) stack.qty = 0;
    const n = mustGet(w.needs.byActor, id, 'needs');
    n.values.hunger = 0;
    n.values.rest = 800;
    w.time = asGameMinute(9 * 60);
    const urges = proposeNeedUrges(w, context(w, content), id);
    expect(
      urges.some((p) => p.urge.kind === 'activity' && content.activities[p.urge.activityId]?.tags.includes('commerce')),
    ).toBe(true);
    step(sim);
    expect(
      w.log.events.some(
        (e) => e.kind === 'provisions.purchase' && w.actors[e.data.buyerId]?.householdId === actor.householdId,
      ),
    ).toBe(true);
  });

  it('recovers hunger through full household meals rather than repeatedly replacing them with pending snacks', async () => {
    const { simFor, actorByKey } = await import('./helpers.ts');
    const sim = simFor({ seed: 42 });
    const id = actorByKey(sim, 'johann_brenner');
    mustGet(sim.world.needs.byActor, id, 'needs').values.hunger = 0;
    runDays(sim, 14);
    const household = mustGet(sim.world.households, mustGet(sim.world.actors, id, 'actor').householdId, 'household');
    for (const member of household.memberIds) {
      const week = mustGet(sim.world.provisions.nutrition, member, 'nutrition').history.slice(-7);
      expect(week.reduce((n, day) => n + day.kcal, 0)).toBeGreaterThan(
        week.reduce((n, day) => n + day.needKcal, 0) * 0.8,
      );
      expect(sim.world.needs.byActor[member]?.values.hunger).toBeGreaterThan(200);
    }
  });

  it('rejects filled soft packs and propagates newly packed bulk into distant ancestors', () => {
    const w = fixture(content);
    const pack = add(w, 'knapsack_army', 1, true),
      sack = add(w, 'haversack_tarred', 1, true),
      blankets = add(w, 'blanket_wool_3pt', 2, true);
    moveStack(w, context(w, content), blankets, 2, { kind: 'container', itemId: pack });
    expect(() => moveStack(w, context(w, content), pack, 1, { kind: 'container', itemId: sack })).toThrow('bulk');
    const small = add(w, 'oilcloth_bag', 1, true);
    const flour = add(w, 'flour', 10, true);
    moveStack(w, context(w, content), small, 1, { kind: 'container', itemId: sack });
    moveStack(w, context(w, content), flour, 4, { kind: 'container', itemId: small });
    const before = hashValue(w);
    expect(() => moveStack(w, context(w, content), flour, 3, { kind: 'container', itemId: small })).toThrow('bulk');
    expect(hashValue(w)).toBe(before);
  });

  it('applies Small capacity, fatigue, movement delays, the 150% limit and skill modifiers', () => {
    const w = fixture(content),
      a = mustGet(w.actors, A, 'actor');
    expect(loadReport(w, content, A).capacityG).toBe(45400);
    a.ancestryId = 'goblin';
    expect(loadReport(w, content, A).capacityG).toBe(34050);
    a.ancestryId = 'human';
    w.activity.byActor[A] = {
      activityId: 'work',
      placeId: P,
      since: w.time,
      lockedUntil: null,
      source: 'init',
      travel: null,
      workplaceId: STORE,
    };
    const before = hourlyLedger(w, content, A, 'rest', 60, 60, { rest: 800 });
    const lead = add(w, 'lead_bar_5lb', 18, true);
    const loaded = hourlyLedger(w, content, A, 'rest', 60, 60, { rest: 800 });
    expect(loaded.delta).toBeLessThan(before.delta);
    expect(loaded.terms.some((t) => t.source === 'load')).toBe(true);
    expect(loadCheckTerms(w, content, A, 'stealth')[0]?.value).toBe(-5);
    // A commanded destination exercises the same activity transition as an NPC urge. The store is
    // far enough off (30,000 ft) that the trip outlasts the hour: a short hop is simply done.
    mustGet(w.places, STORE, 'place').x = 3000;
    const state = mustGet(w.activity.byActor, A, 'activity');
    state.travel = null;
    w.psyche.byActor[A] = {
      chosen: {
        urge: { kind: 'activity', activityId: 'work', placeId: STORE },
        voice: 'command',
        thoughtId: null,
        compromise: false,
        at: w.time,
        explain: {
          kind: 'formula',
          label: 'go',
          subjects: [A],
          knowledge: 'self',
          terms: [],
          total: 0,
          outcome: 'chosen',
        },
      },
    } as unknown as (typeof w.psyche.byActor)[number];
    activitySystem(w, context(w, content));
    expect(a.placeId).toBe(P);
    expect(w.activity.byActor[A]?.travel?.arrive).toBeGreaterThan(w.time);
    state.travel = null;
    mustGet(w.items.stacks, lead, 'lead').qty = 100;
    state.lockedUntil = null;
    activitySystem(w, context(w, content));
    expect(a.placeId).toBe(P);
    expect(state.travel).toBeNull();
    expect(w.log.events.some((e) => e.kind === 'provisions.load_movement' && e.data.blocked)).toBe(true);
  });

  it('forecasts completed days when a cornmeal trail kit has no cold noon meal, with the actor time budget', () => {
    const w = fixture(content);
    w.time = asGameMinute(6 * 60);
    const a = mustGet(w.actors, A, 'actor');
    a.placeId = STORE;
    add(w, 'cornmeal', 20, true);
    add(w, 'frying_pan', 1, true);
    add(w, 'flint_steel_char_tin', 1, true);
    add(w, 'firewood_armload', 20, true);
    mustGet(w.places, STORE, 'trail').tags.push('water');
    const canteen = add(w, 'canteen_tin_wool', 1, true);
    mustGet(w.items.stacks, canteen, 'canteen').waterMl = 1900;
    const beans = add(w, 'beans_dry', 10, true);
    add(w, 'camp_kettle_pair', 1, true);
    const before = hashValue(w),
      plan = readinessOf(w, content, { actorId: A }, w.time, 3);
    expect(plan.daysOfFoodTenths).toBe(30);
    expect(plan.unpreparable.find((f) => f.defId === 'beans_dry')?.missing.some((m) => m.includes('time'))).toBe(true);
    expect(plan.daysOfWaterTenths).toBeNull();
    expect(hashValue(w)).toBe(before);
    expect(w.items.stacks[beans]?.qty).toBe(10);
  });

  it('drinks carried water, refuses a dry refill, and conserves water through nested refills', () => {
    const w = fixture(content);
    mustGet(w.actors, A, 'actor').placeId = STORE;
    mustGet(w.needs.byActor, A, 'needs').values.thirst = 300;
    const bottle = add(w, 'canteen_tin_wool', 1, true),
      stack = mustGet(w.items.stacks, bottle, 'canteen');
    stack.waterMl = 1900;
    waterHour(w, context(w, content));
    expect(w.needs.byActor[A]?.values.thirst).toBe(900);
    expect(stack.waterMl).toBe(700);
    expect(refillWater(w, context(w, content), A, bottle)).toBe(false);
    mustGet(w.places, STORE, 'source').tags.push('water');
    expect(refillWater(w, context(w, content), A, bottle)).toBe(true);
    expect(stack.waterMl).toBe(1900);
    mustGet(w.places, STORE, 'source').tags = [];
    expect(drinkWater(w, context(w, content), A, 1901)).toBe(false);
    expect(stack.waterMl).toBe(1900);
  });

  it('offers and validates refilling through the headless action menu', async () => {
    const { PlaySession, parseText } = await import('@coulee/play');
    const original = PlaySession.create(content, { source: 'iron_ford', seed: 42 });
    const saved = JSON.parse(original.save()),
      world = saved.world as World;
    const source = Object.values(world.places).find((p) => p.tags.includes('water'));
    const bottle = stacksDeep(world, carriedBy(original.playerId)).find(
      (s) => content.items[s.stack.defId]?.container?.liquid_ml,
    )?.stack;
    if (!source || !bottle) throw new Error('water fixture');
    mustGet(world.actors, original.playerId, 'player').placeId = source.id;
    const activity = mustGet(world.activity.byActor, original.playerId, 'activity');
    activity.placeId = source.id;
    activity.lockedUntil = null;
    bottle.waterMl = 100;
    delete saved.finalHash;
    const session = PlaySession.load(content, JSON.stringify(saved));
    const action = session.observe().actions.find((a) => a.id === `refill:${bottle.id}`);
    expect(action).toBeDefined();
    const command = parseText(action?.id ?? '', session.observe());
    if (typeof command === 'string') throw new Error(command);
    expect(session.act(command).ok).toBe(true);
    const filled = JSON.parse(session.save()).world as World;
    expect(filled.items.stacks[bottle.id]?.waterMl).toBe(content.items[bottle.defId]?.container?.liquid_ml);
    expect(filled.log.events.some((e) => e.kind === 'provisions.refilled' && e.data.itemId === bottle.id)).toBe(true);
  });

  it('defers a four-hour bean batch until completion, reserves only active work and survives JSON', () => {
    const w = fixture(content);
    w.time = asGameMinute(6 * 60);
    const beans = add(w, 'beans_dry', 2);
    add(w, 'camp_kettle_pair', 1);
    add(w, 'firewood_armload', 20);
    add(w, 'flint_steel_char_tin', 1);
    w.activity.byActor[A] = {
      activityId: 'cook',
      placeId: P,
      since: w.time,
      lockedUntil: null,
      source: 'init',
      travel: null,
      workplaceId: null,
    };
    const before = w.needs.byActor[A]?.values.hunger;
    serveMeal(w, context(w, content), { householdId: H }, [A], 25, false, {
      itemId: beans,
      method: 'boil',
      servings: 1,
    });
    expect(w.needs.byActor[A]?.values.hunger).toBe(before);
    expect(w.provisions.pendingMeals?.[0]?.completesAt).toBe(600);
    expect(w.activity.byActor[A]?.lockedUntil).toBe(390);
    expect(w.log.events.some((e) => e.kind === 'provisions.prepared')).toBe(false);
    const restored: World = JSON.parse(JSON.stringify(w));
    for (const world of [w, restored]) {
      world.time = asGameMinute(599);
      preparationHour(world, context(world, content));
      expect(world.needs.byActor[A]?.values.hunger).toBe(before);
      world.time = asGameMinute(600);
      preparationHour(world, context(world, content));
      expect(world.needs.byActor[A]?.values.hunger).toBeGreaterThan(before ?? 0);
    }
    expect(hashValue(w)).toBe(hashValue(restored));
    expect(findNonIntegers(w)).toEqual([]);
  });

  it('requires ignition and dry tinder, consumes strikes, tracks the fire, and reuses a lit household hearth', () => {
    const w = fixture(content),
      trout = add(w, 'trout_fresh', 1, true);
    add(w, 'firewood_armload', 5, true);
    const holder = { actorId: A };
    expect(recipesFor(w, content, holder, mustGet(w.items.stacks, trout, 'fish'), 1)[0]?.missing).toContain(
      'ignition gear',
    );
    const wetMatches = add(w, 'lucifers_box', 1, true);
    mustGet(w.items.stacks, wetMatches, 'wet matches').wetness = 100;
    const matches = add(w, 'lucifers_box', 1, true);
    const tinder = add(w, 'tinder_pouch', 1, true);
    mustGet(w.items.stacks, tinder, 'tinder').wetness = 100;
    expect(recipesFor(w, content, holder, mustGet(w.items.stacks, trout, 'fish'), 1)[0]?.missing).toContain(
      'dry tinder',
    );
    const dryTinder = add(w, 'tinder_pouch', 1, true);
    serveMeal(w, context(w, content), holder, [A], 25, false, { itemId: trout, method: 'roast', servings: 1 });
    expect(supplyUnits(w, content, carriedBy(A), 'match')).toBe(199);
    expect(supplyUnits(w, content, carriedBy(A), 'tinder')).toBe(39);
    expect(w.items.stacks[wetMatches]?.partial).toBe(0);
    expect(w.items.stacks[matches]?.partial).toBe(1);
    expect(w.items.stacks[tinder]?.partial).toBe(0);
    expect(w.items.stacks[dryTinder]?.partial).toBe(1);
    expect(w.provisions.fires[P]?.lit).toBe(true);
    const home = fixture(content),
      corn = add(home, 'cornmeal', 1);
    add(home, 'frying_pan', 1);
    add(home, 'firewood_armload', 10);
    mustGet(home.places, P, 'home').tags.push('home');
    heatPlaces(home, context(home, content));
    const fuel = supplyUnits(home, content, { kind: 'household', householdId: H }, 'fire');
    expect(kitchenOf(home, content, { householdId: H }).fireCredit).toBe(60);
    serveMeal(home, context(home, content), { householdId: H }, [A], 25, false, {
      itemId: corn,
      method: 'fry',
      servings: 1,
    });
    expect(supplyUnits(home, content, { kind: 'household', householdId: H }, 'fire')).toBe(fuel);
    const beans = add(home, 'beans_dry', 1);
    add(home, 'camp_kettle_pair', 1);
    serveMeal(home, context(home, content), { householdId: H }, [A], 25, false, {
      itemId: beans,
      method: 'boil',
      servings: 1,
    });
    const reserved = supplyUnits(home, content, { kind: 'household', householdId: H }, 'fire');
    home.time = asGameMinute(60);
    heatPlaces(home, context(home, content));
    expect(supplyUnits(home, content, { kind: 'household', householdId: H }, 'fire')).toBe(reserved);
  });

  it('requires an opening tool and spoils only the opened oyster remainder while unopened tins keep', () => {
    const w = fixture(content),
      oysters = add(w, 'oysters_tinned', 3, true);
    expect(recipesFor(w, content, { actorId: A }, mustGet(w.items.stacks, oysters, 'tin'), 1)[0]?.missing).toContain(
      'opening tool (cut or pry)',
    );
    add(w, 'butcher_knife', 1, true);
    serveMeal(w, context(w, content), { actorId: A }, [A], 25, false, { itemId: oysters, method: 'raw', servings: 1 });
    const opened = stacksDeep(w, carriedBy(A)).find((s) => s.stack.defId === 'oysters_opened')?.stack;
    expect(opened).toBeDefined();
    expect(foodServings(content, opened ?? mustGet(w.items.stacks, oysters, 'tin'))).toBe(1);
    expect(w.items.stacks[oysters]?.qty).toBe(2);
    advanceOwned(w, content, 72, storageHour);
    expect(opened && w.items.stacks[opened.id]).toBeUndefined();
    expect(w.items.stacks[oysters]?.qty).toBe(2);
  });

  it('ruins frost-sensitive food and charges frozen fish 50% more preparation fuel', () => {
    const w = fixture(content);
    w.time = parseGameDate('1856-01-15T06:00');
    mustGet(w.actors, A, 'actor').placeId = STORE;
    mustGet(w.places, STORE, 'place').kind = 'wild';
    const potato = add(w, 'potatoes', 1, true),
      egg = add(w, 'eggs', 1, true),
      fish = add(w, 'trout_fresh', 1, true);
    add(w, 'firewood_armload', 10, true);
    add(w, 'flint_steel_char_tin', 1, true);
    storageHour(w, context(w, content));
    expect(w.items.stacks[potato]).toBeUndefined();
    expect(w.items.stacks[egg]).toBeUndefined();
    expect(
      recipesFor(w, content, { actorId: A }, mustGet(w.items.stacks, fish, 'fish'), 1, false, 'roast')[0]?.fire,
    ).toBe(38);
  });

  it('equal-energy low-protein and low-fat diets differ with explicit physiological causes and hysteresis', () => {
    const deficient = fixture(content),
      adequate = fixture(content);
    for (let day = 0; day < 21; day++)
      for (const w of [deficient, adequate]) {
        const n = mustGet(w.provisions.nutrition, A, 'nutrition');
        n.today = {
          ...n.today,
          dayIndex: day,
          kcal: 2400,
          needKcal: 2400,
          fatG: 100,
          proteinG: w === deficient ? 3 : 60,
          freshPoints: 100,
        };
        w.time = asGameMinute((day + 1) * 1440);
        nutritionHour(w, context(w, content));
      }
    expect(deficient.actors[A]?.sheet.conditions).toContain('malnourished');
    expect(adequate.actors[A]?.sheet.conditions).not.toContain('malnourished');
    const event = deficient.log.events.find(
      (e) => e.kind === 'provisions.nutrition' && e.data.condition === 'malnourished',
    );
    expect(event?.explain?.terms.find((t) => t.label === 'Protein deficiency branch')?.value).toBe(1);
    expect(event?.explain?.knowledge).toBe('participants');
    expect(hourlyLedger(deficient, content, A, 'rest', 60, 60, {}).delta).toBeLessThan(
      hourlyLedger(adequate, content, A, 'rest', 60, 60, {}).delta,
    );
    const lowFat = fixture(content);
    for (let day = 0; day < 7; day++) {
      const n = mustGet(lowFat.provisions.nutrition, A, 'nutrition');
      n.today = { ...n.today, dayIndex: day, kcal: 2400, needKcal: 2400, fatG: 5, proteinG: 60 };
      lowFat.time = asGameMinute((day + 1) * 1440);
      nutritionHour(lowFat, context(lowFat, content));
    }
    expect(
      lowFat.log.events
        .find((e) => e.kind === 'provisions.nutrition' && e.data.condition === 'malnourished')
        ?.explain?.terms.find((t) => t.label === 'Fat deficiency branch')?.value,
    ).toBe(1);
  });
});

/** Unit-test fixture for the owned kernels, independent of unfinished neighboring systems. */

const A = asActorId(1),
  H = asHouseholdId(1),
  P = asPlaceId(1),
  STORE = asPlaceId(2);
function fixture(content: ContentBundle, mouths = 1): World {
  const time = parseGameDate('1855-04-01');
  const world = {
    time,
    meta: { format: 1, seed: 42, scenarioId: 'test', contentHash: content.meta.hash, playerId: null },
    actors: {},
    households: {},
    places: {},
    counters: { actor: mouths, household: 1, place: 2 },
    index: { actorByKey: {}, householdByKey: {}, placeByDef: {} },
    items: createItemsState(),
    provisions: createProvisionsState(),
    activity: { byActor: {}, occupancy: {} },
    needs: { byActor: {} },
    psyche: { byActor: {} },
    social: {},
    belief: {},
    chronicle: {},
    log: emptyLog(),
  } as World;
  world.provisions.settings = { npcBuying: false, autoRations: false, householdWood: false, wages: false };
  world.places[P] = {
    id: P,
    defId: '',
    siteId: 'test',
    name: 'Home',
    kind: 'house',
    tags: [],
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    rotation: 0,
    capacity: 20,
    model: null,
    faeIntensity: 0,
  };
  world.places[STORE] = { ...mustGet(world.places, P, 'place'), id: STORE, name: 'Store', tags: ['store'] };
  const members = [];
  for (let i = 1; i <= mouths; i++) {
    const id = asActorId(i);
    members.push(id);
    world.actors[id] = {
      id,
      key: `a${i}`,
      name: { given: `Person ${i}`, family: 'Test' },
      sex: 'female',
      born: parseGameDate('1825-04-01'),
      ancestryId: 'human',
      presentsAsId: 'human',
      occupationId: '',
      householdId: H,
      placeId: P,
      values: {
        piety: 0,
        thrift: 0,
        neighborliness: 0,
        parochialism: 0,
        superstition: 0,
        ambition: 0,
        temper: 0,
        rancor: 0,
        discretion: 0,
      },
      traits: [],
      sheet: {
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        skills: {},
        level: 1,
        feats: [],
        conditions: [],
        languages: [],
        literate: true,
      },
      controller: 'ai',
      alive: true,
    };
    world.provisions.nutrition[id] = emptyNutrition(0);
    world.provisions.purses[id] = 0;
    world.needs.byActor[id] = { values: { hunger: 200 }, bands: {}, debt: {}, debtBands: {} };
  }
  world.households[H] = { id: H, key: 'h', name: 'Household', headId: A, memberIds: members, homePlaceId: P };
  world.provisions.households[H] = {
    cashCents: 1000,
    waterMl: mouths * 5000,
    rationPct: 100,
    storage: 'indoor',
    policy: 'spoils_first',
    shortageStep: 0,
    lastShortageDay: null,
  };
  return world;
}
function context(world: World, content: ContentBundle): SimContext {
  const now = world.time,
    cal = calendarAt(now);
  return {
    now,
    cal,
    content,
    seed: world.meta.seed,
    isNewDay: cal.hour === 0,
    commands: [],
    rng: (s, k) => rng(world.meta.seed, s, now, k),
    emit: (e) => appendEvent(world.log, e, now),
  };
}
function add(world: World, def: string, qty: number, personal = false) {
  return newStack(
    world,
    def,
    qty,
    personal ? { kind: 'actor', actorId: A, worn: false } : { kind: 'household', householdId: H },
    world.time,
  );
}
function advanceOwned(
  world: World,
  content: ContentBundle,
  hours: number,
  system: (w: World, c: SimContext) => void,
): void {
  for (let i = 0; i < hours; i++) {
    system(world, context(world, content));
    world.time = asGameMinute(world.time + 60);
  }
}
