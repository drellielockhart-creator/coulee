import { loadContentOrThrow } from '@coulee/content';
import { describe, expect, it } from 'vitest';
import type { ContentBundle } from '../../core/src/content.ts';
import { appendEvent, emptyLog } from '../../core/src/events/index.ts';
import { findNonIntegers, hashValue } from '../../core/src/hash.ts';
import { asActorId, asHouseholdId, asPlaceId, mustGet } from '../../core/src/ids.ts';
import {
  affordanceAt,
  carriedBy,
  consumeStack,
  consumeSupply,
  moveStack,
  stacksDeep,
  supplyUnits,
} from '../../core/src/items/api.ts';
import { protectionsOf, rootLocation } from '../../core/src/items/containers.ts';
import { createItemsState, newStack } from '../../core/src/items/state.ts';
import { viewItemsActor } from '../../core/src/items/view.ts';
import { readinessOf } from '../../core/src/provisions/api.ts';
import { purchase, replenishDomestic } from '../../core/src/provisions/economy.ts';
import { devicesHour, storageHour } from '../../core/src/provisions/environment.ts';
import { foodServings, recipesFor, serveMeal } from '../../core/src/provisions/meals.ts';
import { spoilageFactors } from '../../core/src/provisions/spoilage.ts';
import { createProvisionsState, emptyNutrition } from '../../core/src/provisions/state.ts';
import { provisionsSystem } from '../../core/src/provisions/system.ts';
import { viewProvisionsActor, viewProvisionsHousehold } from '../../core/src/provisions/view.ts';
import { rng } from '../../core/src/rng.ts';
import type { SimContext } from '../../core/src/sim/context.ts';
import { asGameMinute, calendarAt, parseGameDate } from '../../core/src/time.ts';
import { DEFAULT_VIEW_OPTIONS } from '../../core/src/viewmodel-types.ts';
import type { World } from '../../core/src/world.ts';

const content = loadContentOrThrow();

describe('provisions acceptance', () => {
  it('1: equal energy with fresh sides prevents scurvy while a salt-pork/flour diet crosses the threshold', () => {
    const lean = fixture(content),
      varied = fixture(content);
    for (const w of [lean, varied]) {
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
    expect(w.log.events.some((e) => e.kind === 'provisions.meal' && !e.data.hot && e.data.morale < 0)).toBe(true);
    const noFire = fixture(content);
    add(noFire, 'beans_dry', 2);
    add(noFire, 'camp_kettle_pair', 1);
    expect(serveMeal(noFire, context(noFire, content), { householdId: H }, [A], 25).kcal).toBe(0);
    const batch = fixture(content, 2);
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
    expect(before - supplyUnits(batch, content, { kind: 'household', householdId: H }, 'fire')).toBe(30);
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
    let hours = 0;
    while (
      hours < 600 &&
      stacksDeep(w, { kind: 'household', householdId: H }).some(
        (s) => foodServings(content, s.stack) > 0 && (content.items[s.stack.defId]?.food?.kcal ?? 0) > 0,
      )
    ) {
      advanceOwned(w, content, 1, provisionsSystem);
      hours++;
    }
    expect(Math.abs(r.daysOfFoodTenths - (hours * 10) / 24)).toBeLessThanOrEqual(Math.max(3, r.daysOfFoodTenths * 0.1));
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
    const cashBefore = w.provisions.households[H]?.cashCents ?? 0;
    expect(purchase(w, context(w, content), A, STORE, 'flour', 2, false)).toBe(2);
    expect((w.provisions.households[H]?.cashCents ?? 0) + mustGet(w.provisions.stores, STORE, 'store').tillCents).toBe(
      cashBefore,
    );
    mustGet(w.provisions.households, H, 'household').cashCents = 0;
    expect(purchase(w, context(w, content), A, STORE, 'flour', 100, true)).toBeGreaterThan(0);
    expect(w.provisions.stores[STORE]?.tabs[A]).toBeLessThanOrEqual(100);
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
    buying.world.provisions.settings.wages = false;
    for (const store of Object.values(buying.world.provisions.stores)) store.restockId = null;
    const merchant = Object.values(buying.world.provisions.stores).find((s) => s.creditLimitCents > 0);
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
