import {
  asGameMinute,
  createSim,
  findNonIntegers,
  items,
  makeContext,
  packJson,
  provisions,
  restoreSim,
  rowsOf,
  stateHash,
  step,
  type World,
} from '@coulee/core';
import { PlaySession } from '@coulee/play';
import { GEN_VERSION, generateTown, townContent } from '@coulee/worldgen';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { productionHour } from '../../core/src/activity/production.ts';
import { hourlyLedger } from '../../core/src/needs/system.ts';
import { householdDay } from '../../core/src/provisions/economy.ts';
import { employmentHour } from '../../core/src/provisions/employment.ts';
import { lightCampfire } from '../../core/src/provisions/meals.ts';
import { actorByKey, baseContent, simFor } from './helpers.ts';

const content = baseContent();

describe('playtest economy regressions', () => {
  it('conserves county cash through paid work, poverty, and freight (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10000 }), fc.integer({ min: 1, max: 500 }), (cash, dailyWage) => {
        const sim = simFor(),
          w = sim.world;
        w.provisions.settings.autoRations = false;
        const rel = w.social.relationships.find((r) => r.kind === 'employer');
        if (!rel) throw new Error('Fixture requires employer');
        const worker = w.actors[rel.b],
          employer = w.actors[rel.a];
        if (!worker || !employer) throw new Error('Missing employment actors');
        const payer = w.provisions.households[employer.householdId];
        if (!payer) throw new Error('Missing employer cash box');
        payer.cashCents = cash;
        w.provisions.employment = {
          [worker.id]: { payerId: employer.householdId, earnedCents: dailyWage * 6, carry: 0, day: 5, minutes: 480 },
        };
        const before = provisions.countyCash(w);
        const purseBefore = w.provisions.purses[worker.id] ?? 0;
        w.time = asGameMinute(6 * 1440);
        employmentHour(w, makeContext(w, content, []));
        expect(provisions.countyCash(w)).toBe(before);
        expect(w.provisions.purses[worker.id]).toBe(purseBefore + Math.min(cash, dailyWage * 6));
        expect(w.provisions.employment[worker.id]?.earnedCents).toBe(Math.max(0, dailyWage * 6 - cash));
        w.time = asGameMinute(7 * 1440);
        householdDay(w, makeContext(w, content, []));
        expect(provisions.countyCash(w) - (w.provisions.externalCashCents ?? 0)).toBe(before);
        expect(findNonIntegers(w)).toEqual([]);
      }),
      { numRuns: 12 },
    );
  });

  it('conserves all county cash across a generated week of ordinary simulation', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (seed) => {
        const sim = simFor({ seed });
        const initial = provisions.countyCash(sim.world) - (sim.world.provisions.externalCashCents ?? 0);
        for (let hour = 0; hour < 8 * 24; hour++) {
          step(sim);
          expect(provisions.countyCash(sim.world) - (sim.world.provisions.externalCashCents ?? 0)).toBe(initial);
        }
      }),
      { numRuns: 4 },
    );
  });

  it('accrues only labor at the employer workplace and pays no unemployed allowance', () => {
    const sim = simFor(),
      w = sim.world;
    const rel = w.social.relationships.find((r) => r.kind === 'employer');
    if (!rel) throw new Error('Missing employer');
    const worker = w.actors[rel.b],
      state = w.activity.byActor[rel.b];
    if (!worker || !state) throw new Error('Missing worker');
    state.activityId = 'sleep';
    employmentHour(w, makeContext(w, content, []));
    expect(w.provisions.employment?.[worker.id]?.earnedCents).toBe(0);
    state.workplaceId = worker.placeId;
    state.activityId = 'work';
    for (let h = 0; h < 8; h++) {
      w.time = asGameMinute(h * 60);
      employmentHour(w, makeContext(w, content, []));
    }
    expect(w.provisions.employment?.[worker.id]?.earnedCents).toBe(
      content.occupations[worker.occupationId]?.wage_cents_per_day,
    );
  });

  it('every buyback quote is strictly below every county retail quote', () => {
    const sim = simFor(),
      w = sim.world,
      actor = actorByKey(sim, 'gussie_pratt');
    for (const def of Object.values(content.items)) {
      const id = items.createStack(w, makeContext(w, content, []), def.id, 1, items.carriedBy(actor));
      for (const store of rowsOf(w.provisions.stores)) {
        const quote = provisions.saleQuote(w, content, store.placeId, id);
        if (quote === null) continue;
        for (const other of rowsOf(w.provisions.stores))
          expect(quote).toBeLessThan(provisions.priceAt(w, content, other.placeId, def.id) ?? 0);
      }
    }
  });

  it('counts a lone householder pack in the larder and never invents a day-zero empty pantry', () => {
    const session = PlaySession.create(content, { source: 'iron_ford', seed: 42 });
    const w = JSON.parse(session.save()).world as World;
    const actor = rowsOf(w.actors).find((a) => a.key === 'play_newcomer');
    if (!actor) throw new Error('Missing newcomer');
    const readiness = provisions.readinessOf(w, content, { householdId: actor.householdId }, w.time, 4);
    expect(readiness.kcalOnHand).toBeGreaterThan(10000);
    householdDay(w, makeContext(w, content, []));
    expect(w.provisions.households[actor.householdId]?.rationPct).toBeGreaterThan(50);
  });

  it('generated stores carry camping gear and restore exhausted stock', () => {
    const town = generateTown(content, { genVersion: GEN_VERSION, seed: 7 });
    const generated = townContent(content, town),
      sim = createSim(generated, { scenarioId: town.scenario.id, seed: 7 }),
      w = sim.world;
    w.provisions.settings.autoRations = false;
    for (const store of rowsOf(w.provisions.stores)) expect(store.restockId).toBeTruthy();
    const store = rowsOf(w.provisions.stores).find((s) => s.restockId === 'pratt_wholesale');
    if (!store) throw new Error('Missing outfitter');
    const stock = items.stacksDeep(w, items.atPlace(store.placeId));
    for (const defId of ['oilcloth_fly_8x10', 'wall_tent_9x9', 'snare_wire_brass', 'black_powder_canister'])
      expect(stock.some(({ stack }) => stack.defId === defId)).toBe(true);
    for (const { stack } of stock) if (stack.defId === 'oilcloth_fly_8x10') items.deleteStack(w, stack.id);
    w.time = asGameMinute(7 * 1440);
    householdDay(w, makeContext(w, generated, []));
    expect(
      items.stacksDeep(w, items.atPlace(store.placeId)).some(({ stack }) => stack.defId === 'oilcloth_fly_8x10'),
    ).toBe(true);
  });

  it('packed saves preserve state hashes and subsequent replay', () => {
    const a = simFor({ seed: 42 });
    step(a);
    const b = restoreSim(content, packJson(a.world));
    expect(stateHash(a.world)).toBe(stateHash(b.world));
    step(a);
    step(b);
    expect(stateHash(a.world)).toBe(stateHash(b.world));
  });
});

describe('camp and production', () => {
  it('bedding, wetness, shelter and a fuel-paid fire change the actual warmth ledger', () => {
    const sim = simFor(),
      w = sim.world,
      id = rowsOf(w.actors)[0]?.id;
    if (!id) throw new Error('No actor');
    const actor = w.actors[id],
      activity = w.activity.byActor[id];
    const outdoors = rowsOf(w.places).find((p) => p.tags.includes('wild'));
    if (!actor || !activity || !outdoors) throw new Error('Missing camp');
    actor.placeId = outdoors.id;
    activity.placeId = outdoors.id;
    activity.activityId = 'sleep';
    activity.travel = null;
    for (const { stack } of items.stacksDeep(w, items.carriedBy(id))) items.deleteStack(w, stack.id);
    const ledger = () => hourlyLedger(w, content, id, 'warmth', 0, 0, w.needs.byActor[id]?.values ?? {}).delta;
    const bare = ledger(),
      ctx = makeContext(w, content, []);
    const blanketId = items.createStack(w, ctx, 'blanket_wool_3pt', 1, items.carriedBy(id));
    expect(ledger()).toBeGreaterThan(bare);
    const dry = items.campThermal(w, content, id, true).bonusF;
    const blanket = w.items.stacks[blanketId];
    if (blanket) blanket.wetness = 100;
    expect(items.campThermal(w, content, id, true).bonusF).toBeLessThan(dry);
    items.createStack(w, ctx, 'oilcloth_fly_8x10', 1, items.carriedBy(id));
    for (const [defId, qty] of [
      ['firewood_armload', 6],
      ['flint_steel_char_tin', 1],
      ['tinder_pouch', 1],
    ] as const)
      items.createStack(w, ctx, defId, qty, items.carriedBy(id));
    const fuel = items.supplyUnits(w, content, items.carriedBy(id), 'fire');
    const cold = ledger();
    expect(lightCampfire(w, ctx, id)).toBe(true);
    expect(items.supplyUnits(w, content, items.carriedBy(id), 'fire')).toBeLessThan(fuel);
    expect(ledger()).toBeGreaterThan(cold);
    expect(actor.placeId).toBe(outdoors.id);
  });

  it('foraging has seasonal physical yields and explained skill checks; fish need water habitat', () => {
    const sim = simFor({ seed: 42 }),
      w = sim.world,
      actor = rowsOf(w.actors)[0];
    if (!actor) throw new Error('No actor');
    const activity = w.activity.byActor[actor.id],
      place = rowsOf(w.places).find((p) => p.tags.includes('wild'));
    if (!activity || !place) throw new Error('Missing woods');
    actor.placeId = place.id;
    activity.placeId = place.id;
    activity.travel = null;
    activity.activityId = 'forage_greens';
    actor.sheet.skills.herbalism = 30;
    for (let h = 0; h < 12; h++) {
      w.time = asGameMinute(h * 60);
      productionHour(w, makeContext(w, content, []));
    }
    const pack = items.stacksDeep(w, items.carriedBy(actor.id)).map(({ stack }) => stack.defId);
    expect(pack).toContain('ramps_fresh');
    expect(pack).toContain('morels_fresh');
    expect(pack).not.toContain('berries_fresh');
    const events = w.log.events.filter((e) => e.kind === 'provisions.production');
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.explain?.children?.[0]?.roll)).toBe(true);
    activity.activityId = 'fish_creek';
    productionHour(w, makeContext(w, content, []));
    expect(w.log.events.at(-1)?.explain?.outcome).toBe('wrong_habitat');
    expect(findNonIntegers(w)).toEqual([]);
  });
});
