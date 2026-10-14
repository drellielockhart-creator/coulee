/** Wave 10 D: r3 Greenhorn, edge QA session-a and Explorer command regressions. */
import {
  asGameMinute,
  type Command,
  findNonIntegers,
  items,
  makeContext,
  provisions,
  psyche,
  runHours,
} from '@coulee/core';
import { PlaySession, parseText, renderDetail, renderObservation, sessionSimOf } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { householdDay } from '../../core/src/provisions/economy.ts';
import { employmentHour } from '../../core/src/provisions/employment.ts';
import { holderStacks } from '../../core/src/provisions/meals.ts';
import { actorByKey, baseContent, simFor } from './helpers.ts';

function ask(s: PlaySession, text: string) {
  const command = parseText(text, s.observe());
  if (typeof command === 'string') throw new Error(`${text}: ${command}`);
  return s.act(command);
}
function ok(s: PlaySession, text: string) {
  const result = ask(s, text);
  expect(result.ok, `${text}: ${result.reason}`).toBe(true);
  return result;
}
function fixture(day = 1, hour = 8) {
  const s = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42, pc: { kit: 'greenhorn' } });
  const sim = sessionSimOf(s),
    w = sim.world,
    pc = s.playerId;
  const employer = actorByKey(sim, 'gussie_pratt');
  const place = w.index.placeByDef.pratt_daughter_outfitters;
  if (!place) throw new Error('Missing shop');
  w.time = asGameMinute(day * 1440 + hour * 60);
  const locate = (id = pc, where = place) => {
    const actor = w.actors[id],
      state = w.activity.byActor[id];
    if (!actor || !state) throw new Error('Missing actor');
    actor.placeId = where;
    Object.assign(state, { placeId: where, activityId: 'idle_at_home', lockedUntil: null, travel: null });
  };
  locate();
  locate(employer);
  w.activity.occupancy[place] = [employer, pc].sort((a, b) => a - b);
  const ctx = (commands: Command[] = []) => makeContext(w, sim.content, commands);
  return { s, sim, w, pc, employer, place, locate, ctx };
}

describe('wave 10 economy commands', () => {
  it('D1 Sabbath warning', () => {
    const { s, w, pc } = fixture(0);
    const hire = ok(s, 'hire Augusta daily');
    expect(renderObservation(hire.observation)).toContain('Sunday is unpaid');
    const contract = w.provisions.contracts?.[pc];
    expect(contract?.endsAt).toBe(2 * 1440); // Monday alone is paid, not Sunday + Monday.
    const hash = s.hash;
    for (let i = 0; i < 4; i++) {
      const result = ask(s, 'work');
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('Sunday is unpaid');
      expect(s.hash).toBe(hash);
    }
  });

  it('D1 daily renewal', () => {
    const { s, w, pc, employer, locate, ctx } = fixture();
    ok(s, 'hire Augusta daily');
    w.time = asGameMinute(2 * 1440);
    const expired = s.hash;
    expect(ask(s, 'work').ok).toBe(false);
    expect(s.hash).toBe(expired);
    employmentHour(w, ctx());
    expect(w.provisions.contracts?.[pc]?.ended).toBe('term_end');
    w.time = asGameMinute(2 * 1440 + 8 * 60);
    locate();
    locate(employer);
    ok(s, 'hire Augusta daily');
    expect(w.provisions.contracts?.[pc]?.ended).toBeUndefined();
  });

  it('D2 weekly quit/rehire', () => {
    const { s, w, pc, employer, locate, ctx } = fixture();
    ok(s, 'hire Augusta weekly');
    ok(s, 'work');
    const earned = w.provisions.employment?.[pc]?.earnedCents;
    expect(earned).toBeGreaterThan(0);
    // Greenhorn log: hire Monday, quit Tuesday, ask the same employer again.
    w.time = asGameMinute(2 * 1440 + 8 * 60);
    locate();
    locate(employer);
    const purse = w.provisions.purses[pc];
    ok(s, 'quit');
    expect(w.provisions.purses[pc]).toBe(purse);
    const result = ask(s, 'hire Augusta weekly');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('left this employer today');
    w.time = asGameMinute(3 * 1440);
    employmentHour(w, ctx());
    expect(w.provisions.purses[pc]).toBe(purse);
    const total = provisions.countyCash(w);
    w.time = asGameMinute(6 * 1440);
    employmentHour(w, ctx());
    expect(w.provisions.purses[pc]).toBe((purse ?? 0) + (earned ?? 0));
    expect(provisions.countyCash(w)).toBe(total);
    expect(findNonIntegers(w)).toEqual([]);
  });

  it('D3 wood bids', () => {
    const { s, w, pc, place } = fixture();
    expect(s.observe().store.bids?.find((b) => b.defId === 'firewood_armload')?.cents).toBe(3);
    expect(renderDetail(ok(s, 'prices wood').detail)).toContain('Piece bids');
    const cash = provisions.countyCash(w),
      purse = w.provisions.purses[pc] ?? 0;
    ok(s, 'sell firewood');
    expect(w.provisions.purses[pc]).toBe(purse + 3);
    expect(provisions.countyCash(w)).toBe(cash);
    expect(provisions.pieceStock(w, place, 'firewood_armload')).toBe(7);
  });

  it('D3 buying cash', () => {
    const { s, sim, w, pc, place, ctx } = fixture(3, 6);
    const store = w.provisions.stores[place];
    if (!store || store.ownerHouseholdId === null) throw new Error('Missing owner');
    const owner = w.provisions.households[store.ownerHouseholdId];
    if (!owner) throw new Error('Missing cashbox');
    owner.cashCents = 600;
    for (const stack of items.stacksAt(w, items.atPlace(place))) items.deleteStack(w, stack.id);
    w.time = asGameMinute(3 * 1440);
    householdDay(w, ctx());
    w.time = asGameMinute(3 * 1440 + 6 * 60);
    expect(owner.cashCents).toBeGreaterThanOrEqual(500);
    items.createStack(w, ctx(), 'trout_fresh', 1, items.carriedBy(pc));
    const cash = provisions.countyCash(w),
      outside = w.provisions.externalCashCents;
    ok(s, 'sell trout');
    expect(provisions.countyCash(w)).toBe(cash);
    expect(w.provisions.externalCashCents).toBe(outside);
    expect(provisions.saleBid(w, sim.content, place, 'trout_fresh')).toBeGreaterThan(0);
  });

  it('D3 proprietor purse funds bids without minting cash or bypassing agency', () => {
    const { s, w, pc, employer, place, ctx } = fixture(3, 6);
    const store = w.provisions.stores[place];
    if (!store || store.ownerHouseholdId === null) throw new Error('Missing owner');
    const owner = w.provisions.households[store.ownerHouseholdId];
    if (!owner) throw new Error('Missing cashbox');
    owner.cashCents = 0;
    w.provisions.purses[employer] = 25;
    items.createStack(w, ctx(), 'trout_fresh', 1, items.carriedBy(pc));
    const total = provisions.countyCash(w);
    ok(s, 'sell trout');
    expect(w.provisions.purses[employer]).toBe(21);
    expect(provisions.countyCash(w)).toBe(total);
    items.createStack(w, ctx(), 'trout_fresh', 1, items.carriedBy(pc));
    psyche.setAgency(w, employer, { ...psyche.agencyOf(w, employer), mode: 'commanded', issuer: { kind: 'player' } });
    const hash = s.hash;
    expect(ask(s, 'sell trout').ok).toBe(false);
    expect(s.hash).toBe(hash);
  });

  it('D3 reserved fish', () => {
    const { s, sim, w, pc, place, ctx } = fixture();
    const fish = items.createStack(w, ctx(), 'trout_fresh', 2, items.carriedBy(pc));
    const result = ok(s, 'for sale trout');
    expect(result.elapsedMinutes).toBe(0);
    const loaded = PlaySession.load(baseContent(), s.save());
    expect(sessionSimOf(loaded).world.items.stacks[fish]?.forSale).toBe(true);
    const kettle = items
      .stacksDeep(w, items.carriedBy(pc))
      .find(({ stack }) => stack.defId === 'camp_kettle_pair')?.stack;
    if (!kettle) throw new Error('Missing kettle');
    ok(s, 'empty kettle');
    const moved = items.moveStack(w, ctx(), fish, 1, { kind: 'container', itemId: kettle.id });
    expect(w.items.stacks[moved]?.forSale).toBe(true);
    const hunger = w.needs.byActor[pc]?.values;
    if (!hunger) throw new Error('Missing needs');
    hunger.hunger = 300;
    w.time = asGameMinute(1440 + 12 * 60);
    ok(s, 'wait 1h');
    expect(w.items.stacks[fish]?.partial).toBe(0);
    expect(w.items.stacks[moved]?.partial).toBe(0);
    expect(w.items.stacks[fish]?.qty).toBe(1);
    expect(provisions.saleQuote(w, sim.content, w.actors[pc]?.placeId ?? place, fish)).toBeGreaterThan(0);
    expect(
      s.act({
        kind: 'provisions.sell',
        actorId: pc,
        data: { placeId: w.actors[pc]?.placeId ?? place, itemId: fish, qty: 1 },
      }).ok,
    ).toBe(true);
    expect(w.items.stacks[fish]?.forSale).toBeUndefined();
  });

  it('D4 bacon and potatoes stay at the authored shelves across repeated freight', () => {
    const sim = simFor({ seed: 42 }),
      w = sim.world;
    const place = w.index.placeByDef.pratt_daughter_outfitters;
    if (!place) throw new Error('Missing store');
    w.provisions.settings.autoRations = false;
    for (const day of [3, 6, 9, 12]) {
      w.time = asGameMinute(day * 1440);
      householdDay(w, makeContext(w, sim.content, []));
      expect(provisions.pieceStock(w, place, 'salt_pork')).toBe(80);
      expect(provisions.pieceStock(w, place, 'potatoes')).toBe(200);
    }
  });

  it('D5 hiring notices', () => {
    const { s, sim, w, pc } = fixture();
    const text = renderObservation(s.observe());
    expect(text).toContain('Hiring notices');
    expect(text).toContain('Johann Brenner');
    expect(text).toContain('Josiah Trevenna');
    expect(provisions.hiringOffer(w, sim.content, actorByKey(sim, 'johann_brenner'))?.rule.id).toBe('smith_hands');
    const miner = actorByKey(sim, 'jory_trevenna');
    expect(provisions.hiringAvailability(w, sim.content, pc, miner)).toContain('Josiah Trevenna');
    for (const [key, name] of [
      ['johann_brenner', 'Johann Brenner'],
      ['josiah_trevenna', 'Josiah Trevenna'],
    ]) {
      if (!key || !name) throw new Error('Missing proprietor');
      const f = fixture();
      const boss = actorByKey(f.sim, key),
        offer = provisions.hiringOffer(f.w, f.sim.content, boss);
      if (!offer) throw new Error('Missing hiring offer');
      f.locate(f.pc, offer.workplaceId);
      f.locate(boss, offer.workplaceId);
      ok(f.s, `hire ${name} daily`);
      expect(f.w.provisions.contracts?.[f.pc]?.employerId).toBe(boss);
    }
  });

  it('D5 hire refusal', () => {
    const { s, sim, w, pc, locate } = fixture();
    const employer = actorByKey(sim, 'edwin_fenn');
    const offer = provisions.hiringOffer(w, sim.content, employer);
    if (!offer) throw new Error('Missing Fenn offer');
    locate(pc, offer.workplaceId);
    locate(employer, offer.workplaceId);
    const household = w.provisions.households[w.actors[employer]?.householdId ?? -1];
    if (!household) throw new Error('Missing farm');
    household.cashCents = 0;
    w.provisions.purses[employer] = 0;
    // Wave 10 E: a refused short-act hire restores the state and spends nothing; the refusal
    // still names the employer who declined (D5).
    const hash = s.hash;
    const result = ask(s, 'hire Edwin Fenn daily');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Edwin Fenn declines to hire you');
    expect(result.reason).toContain('Cannot fund that term');
    expect(s.hash).toBe(hash);
  });

  it('D6 work availability', () => {
    const { s } = fixture();
    expect(s.observe().actions.some((a) => a.id === 'activity:work')).toBe(false);
    const hash = s.hash;
    expect(ask(s, 'work').reason).toContain('no employer');
    expect(s.hash).toBe(hash);
    ok(s, 'hire Augusta weekly');
    ok(s, 'work');
    ok(s, 'quit');
    expect(s.observe().actions.some((a) => a.id === 'activity:work')).toBe(false);
    expect(renderObservation(s.observe())).not.toContain('Daily round: Work');
    expect(ask(s, 'work').ok).toBe(false);
  });

  it('D6 authored home trades and legacy employees keep their work', () => {
    const { sim, w } = fixture();
    for (const key of ['johanne_moe', 'joel_pike'])
      expect(provisions.workAvailability(w, sim.content, actorByKey(sim, key)), key).toBeNull();
  });

  it('D6 persistent shift', () => {
    const { s, w, pc } = fixture();
    ok(s, 'hire Augusta weekly');
    ok(s, 'work');
    const before = w.provisions.employment?.[pc]?.earnedCents ?? 0;
    ok(s, 'wait 1h');
    expect(w.activity.byActor[pc]?.activityId).toBe('work');
    expect(w.provisions.employment?.[pc]?.earnedCents).toBeGreaterThan(before);
    const account = w.provisions.employment?.[pc];
    if (!account) throw new Error('Missing account');
    account.minutes = 8 * 60;
    ok(s, 'wait 1h');
    expect(w.activity.byActor[pc]?.workShift).toBeUndefined();
    expect(w.activity.byActor[pc]?.activityId).not.toBe('work');
  });

  it('D7 market trade', () => {
    const { s } = fixture(1, 9);
    ok(s, 'activity:go_to_market');
    ok(s, 'buy whiskey');
    ok(s, 'sell blanket');
  });

  it('D7 failed meal', () => {
    const { s, w, pc, locate, sim } = fixture(1, 23);
    const tavern = w.index.placeByDef.dunleavys_tavern;
    if (!tavern) throw new Error('Missing tavern');
    locate(pc, tavern);
    const hash = s.hash;
    expect(ask(s, 'meal').ok).toBe(false);
    expect(s.hash).toBe(hash);
    w.time = asGameMinute(1440 + 12 * 60);
    const keeper = actorByKey(sim, 'michael_dunleavy');
    const householdId = w.actors[keeper]?.householdId;
    if (!householdId) throw new Error('Missing kitchen');
    for (const stack of holderStacks(w, { householdId }))
      if (sim.content.items[stack.defId]?.food) items.deleteStack(w, stack.id);
    const empty = s.hash;
    expect(ask(s, 'meal').ok).toBe(false);
    expect(s.hash).toBe(empty);
  });

  it('D7 forecast purity', () => {
    const { s, w, pc } = fixture();
    const needs = w.needs.byActor[pc];
    if (!needs) throw new Error('Missing needs');
    needs.values.hunger = 400;
    ok(s, 'wait 1h');
    const before = s.hash;
    s.observe();
    s.observe();
    expect(s.hash).toBe(before);
    expect(ask(s, 'work').ok).toBe(false);
    expect(s.hash).toBe(before);
  });

  it('D7 meal prompt', () => {
    const { s, w, pc, locate } = fixture(1, 12);
    const tavern = w.index.placeByDef.dunleavys_tavern;
    if (!tavern) throw new Error('Missing tavern');
    locate(pc, tavern);
    ok(s, 'meal');
    for (let i = 0; i < 3 && s.observe().self.provisions.nutrition.lastMealAt === null; i++) ok(s, 'wait 1h');
    expect(s.observe().self.provisions.nutrition.lastMealAt).not.toBeNull();
    expect(renderObservation(s.observe())).not.toContain('The table is laid');
  });

  it('fair income transcript replay', () => {
    const s = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42, pc: { kit: 'greenhorn' } });
    ok(s, 'for sale firewood');
    ok(s, 'look');
    ok(s, 'sleep');
    while (s.observe().time.t < 1440 + 7 * 60) ok(s, 'wait 1h');
    ok(s, 'go Pratt');
    ok(s, 'prices wood');
    ok(s, 'hire Augusta weekly');
    ok(s, 'work');
    ok(s, 'wait 1h');
    ok(s, 'quit');
    expect(PlaySession.replay(baseContent(), s.commandLog).hash).toBe(s.hash);
  });
});

it('D4 bounded year', () => {
  const sim = simFor({ seed: 42, fullLog: false }),
    w = sim.world;
  const initial = provisions.countyCash(w);
  for (let day = 0; day < 365; day++) {
    runHours(sim, 24);
    for (const store of Object.values(w.provisions.stores)) {
      const stock = new Map<string, number>();
      for (const { stack } of items.stacksDeep(w, items.atPlace(store.placeId)))
        stock.set(stack.defId, (stock.get(stack.defId) ?? 0) + stack.qty);
      const caps = { ...store.targets };
      for (const line of sim.content.restocks[store.restockId ?? '']?.lines ?? []) caps[line.item] ??= line.target_qty;
      for (const [defId, cap] of Object.entries(caps))
        expect(stock.get(defId) ?? 0, `day ${day + 1}, ${w.places[store.placeId]?.name}, ${defId}`).toBeLessThanOrEqual(
          cap,
        );
    }
  }
  expect(provisions.countyCash(w)).toBe(initial + (w.provisions.externalCashCents ?? 0));
  expect(findNonIntegers(w)).toEqual([]);
}, 600000);
