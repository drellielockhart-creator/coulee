import { asGameMinute, findNonIntegers, items, makeContext, provisions, psyche, social, stateHash } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { mustGet } from '../../core/src/ids.ts';
import { reliefHour, reliefPlan, reliefUrges } from '../../core/src/social/relief.ts';
import { requestsHour } from '../../core/src/social/requests.ts';
import { availableActions } from '../../play/src/actions.ts';
import { actorByKey, baseContent, simFor } from './helpers.ts';

function fixture() {
  const sim = simFor({ seed: 42 });
  const giver = actorByKey(sim, 'gussie_pratt'),
    receiver = actorByKey(sim, 'thomas_glover');
  const a = sim.world.actors[giver],
    b = sim.world.actors[receiver];
  if (!a || !b) throw new Error('Missing fixture actors');
  a.placeId = sim.world.households[a.householdId]?.homePlaceId ?? a.placeId;
  b.placeId = a.placeId;
  const ctx = makeContext(sim.world, sim.content, []);
  items.createStack(sim.world, ctx, 'hardtack', 300, items.pantryOf(a.householdId));
  return { sim, giver, receiver, a, b, ctx };
}
function interact(f: ReturnType<typeof fixture>, id: string) {
  const def = f.sim.content.interactions[id];
  if (!def) throw new Error(id);
  return social.resolveInteraction(f.sim.world, f.ctx, {
    def,
    initiatorId: f.giver,
    targetId: f.receiver,
    placeId: f.a.placeId,
    present: [],
    mode: 'forced',
    via: 'urge',
  });
}
describe('poor relief', () => {
  it('the scenario keeper owns a store despite another household lodging there', () => {
    const sim = simFor();
    const place = sim.world.index.placeByDef.dunleavys_tavern;
    expect((place === undefined ? undefined : sim.world.provisions.stores[place])?.ownerHouseholdId).toBe(
      sim.world.index.householdByKey.dunleavy,
    );
  });
  it('moves real food and records gratitude and a favor, retaining a planner reserve', () => {
    const f = fixture(),
      w = f.sim.world;
    const before = items.stacksDeep(w, items.pantryOf(f.b.householdId)).reduce((n, e) => n + e.stack.qty, 0);
    const result = interact(f, 'give_relief');
    expect(result.success).toBe(true);
    expect(items.stacksDeep(w, items.pantryOf(f.b.householdId)).reduce((n, e) => n + e.stack.qty, 0)).toBeGreaterThan(
      before,
    );
    expect(social.debtOf(w, f.giver, f.receiver).favors).toBe(1);
    expect(
      provisions.readinessOf(w, f.sim.content, { householdId: f.a.householdId }, w.time, 5).daysOfFoodTenths,
    ).toBeGreaterThanOrEqual(40);
    expect(findNonIntegers(w)).toEqual([]);
  });
  it('uses the same projected food horizon as the full readiness readout', () => {
    const sim = simFor();
    const before = stateHash(sim.world);
    for (const h of Object.values(sim.world.households)) {
      expect(provisions.householdFoodDays(sim.world, sim.content, h.id, sim.world.time, 4)).toBe(
        provisions.readinessOf(sim.world, sim.content, { householdId: h.id }, sim.world.time, 4).daysOfFoodTenths,
      );
    }
    expect(stateHash(sim.world)).toBe(before);
  });
  it('never takes food or imposes terms on commanded actors without consent', () => {
    const f = fixture();
    psyche.applyStandingOrders(f.sim.world, f.receiver, {
      agencyMode: 'commanded',
      orders: psyche.DEFAULT_STANDING_ORDERS,
    });
    expect(interact(f, 'give_relief').success).toBe(false);
    expect(social.debtOf(f.sim.world, f.giver, f.receiver).favors).toBe(0);
    const r = social.pendingRequests(f.sim.world, f.receiver)[0];
    expect(r?.text).toContain('one favor');
    expect(r).toBeDefined();
    if (!r) return;
    requestsHour(
      f.sim.world,
      makeContext(f.sim.world, f.sim.content, [
        { kind: 'social.answer_request', actorId: f.receiver, data: { requestId: r.id, accept: true } },
      ]),
    );
    expect(social.debtOf(f.sim.world, f.giver, f.receiver).favors).toBe(1);
  });
  it('learns want at a meeting, does not inform absent strangers, and offers Commands in play', () => {
    const f = fixture();
    const w = f.sim.world;
    for (const { stack } of items.stacksDeep(w, items.pantryOf(f.b.householdId)))
      if (f.sim.content.items[stack.defId]?.food) items.deleteStack(w, stack.id);
    const pantry = w.provisions.households[f.b.householdId];
    if (pantry) pantry.cashCents = 0;
    for (const id of w.households[f.b.householdId]?.memberIds ?? []) w.provisions.purses[id] = 0;
    w.time = asGameMinute(7 * 60);
    reliefHour(w, makeContext(w, f.sim.content, []));
    expect(social.knowsWant(w, f.sim.content, f.giver, f.b.householdId)).toBe(true);
    const absent = actorByKey(f.sim, 'edwin_fenn');
    expect(social.knowsWant(w, f.sim.content, absent, f.b.householdId)).toBe(false);
    const choices = availableActions(f.sim, f.giver);
    expect(
      choices.some(
        (x) =>
          x.command.kind === 'core.urge' &&
          x.command.data.urge.kind === 'interaction' &&
          x.command.data.urge.interactionId === 'give_relief',
      ),
    ).toBe(true);
  });
  it('keeps a finite members-only Club account distinct from the keeper personal favors', () => {
    const sim = simFor(),
      w = sim.world;
    w.time = asGameMinute(7 * 60);
    reliefHour(w, makeContext(w, sim.content, []));
    const keeper = actorByKey(sim, 'demelza_pascoe'),
      outsider = actorByKey(sim, 'thomas_glover');
    const office = social.officeOf(w, keeper);
    expect(office).toBeDefined();
    if (!office) return;
    const a = w.actors[keeper],
      b = w.actors[outsider];
    if (!a || !b) return;
    a.placeId = office.placeId;
    b.placeId = office.placeId;
    const ctx = makeContext(w, sim.content, []);
    const food = items.createStack(w, ctx, 'hardtack', 1, items.atPlace(office.placeId));
    office.pantry.push(food);
    expect(reliefPlan(w, ctx, outsider, keeper, 'ask')).toBeNull();
    office.members.push(b.householdId);
    const def = sim.content.interactions.ask_relief;
    if (!def) return;
    const r = social.resolveInteraction(w, ctx, {
      def,
      initiatorId: outsider,
      targetId: keeper,
      placeId: office.placeId,
      present: [],
      mode: 'forced',
      via: 'urge',
    });
    expect(r.success).toBe(true);
    expect(office.favors[b.householdId]).toBe(1);
    expect(office.pantry).not.toContain(food);
    expect(reliefPlan(w, ctx, outsider, keeper, 'ask')?.parcel.itemId).not.toBe(food);
    expect(social.debtOf(w, keeper, outsider).favors).toBe(0);
    expect(
      social.reliefObligations(w, sim.content, outsider, { perspective: outsider, omniscient: false }),
    ).toHaveLength(1);
    expect(
      social.reliefObligations(w, sim.content, outsider, {
        perspective: actorByKey(sim, 'lydia_pratt'),
        omniscient: false,
      }),
    ).toEqual([]);
  });
  it('lets a household ask its own Club keeper for institutional food', () => {
    const sim = simFor(),
      w = sim.world;
    const keeper = actorByKey(sim, 'demelza_pascoe');
    const actor = mustGet(w.actors, keeper);
    const household = mustGet(w.households, actor.householdId);
    expect(household.headId).not.toBe(keeper);
    for (const { stack } of items.stacksDeep(w, items.pantryOf(household.id)))
      if (sim.content.items[stack.defId]?.food) items.deleteStack(w, stack.id);
    mustGet(w.provisions.households, household.id).cashCents = 0;
    for (const id of household.memberIds) w.provisions.purses[id] = 0;
    w.time = asGameMinute(7 * 60);
    const ctx = makeContext(w, sim.content, []);
    reliefHour(w, ctx);
    const office = social.officeOf(w, keeper);
    if (!office) throw new Error('Missing Club office');
    actor.placeId = office.placeId;
    mustGet(w.actors, household.headId).placeId = office.placeId;
    office.pantry.push(items.createStack(w, ctx, 'hardtack', 20, items.atPlace(office.placeId)));
    expect(
      reliefUrges(w, ctx, household.headId).some(
        (p) => p.urge.kind === 'interaction' && p.urge.interactionId === 'ask_relief' && p.urge.targetId === keeper,
      ),
    ).toBe(true);
  });
  it('extends finite credit by regard and rejects extension for distrusted buyers', () => {
    const f = fixture();
    const place = f.sim.world.index.placeByDef.pratt_daughter_outfitters;
    expect(place).toBeDefined();
    if (place === undefined) return;
    social.addOpinionReason(f.sim.world, f.ctx, f.giver, f.receiver, {
      label: 'Respected neighbor',
      cites: { kind: 'seed' },
      delta: { affection: 0, respect: 100, trust: 100, fear: 0 },
      since: f.ctx.now,
    });
    const store = f.sim.world.provisions.stores[place];
    expect(store).toBeDefined();
    if (!store) return;
    expect(provisions.creditLimitFor(f.sim.world, f.sim.content, place, f.receiver)).toBeGreaterThan(
      store.creditLimitCents,
    );
    social.addOpinionReason(f.sim.world, f.ctx, f.giver, f.receiver, {
      label: 'Distrusted account',
      cites: { kind: 'seed' },
      delta: { affection: 0, respect: 0, trust: -200, fear: 0 },
      since: f.ctx.now,
    });
    expect(provisions.creditLimitFor(f.sim.world, f.sim.content, place, f.receiver)).toBe(store.creditLimitCents);
  });
  it('generic theft respects agency, moves goods deterministically and charges moral anxiety', () => {
    const f = fixture();
    const w = f.sim.world;
    const item = items.createStack(w, f.ctx, 'hardtack', 5, items.carriedBy(f.receiver));
    psyche.applyStandingOrders(w, f.giver, { agencyMode: 'commanded', orders: psyche.DEFAULT_STANDING_ORDERS });
    expect(social.attemptTheft(w, f.ctx, { actorId: f.giver, victimId: f.receiver, itemId: item }).success).toBe(false);
    const copy = structuredClone(w);
    const c1 = makeContext(w, baseContent(), []),
      c2 = makeContext(copy, baseContent(), []);
    const req = {
      actorId: f.giver,
      victimId: f.receiver,
      itemId: item,
      basis: { kind: 'command' as const, issuer: { kind: 'player' as const } },
    };
    expect(social.attemptTheft(w, c1, req)).toEqual(social.attemptTheft(copy, c2, req));
    expect(stateHash(w)).toBe(stateHash(copy));
    expect(findNonIntegers(w)).toEqual([]);
    expect(w.log.events.some((e) => e.kind === 'social.theft')).toBe(true);
    expect(w.social.totals.interactions).toBe(w.log.events.filter((e) => e.kind === 'social.interaction').length);
  });
  it('a household without a surplus cannot manufacture relief or a favor', () => {
    const f = fixture();
    for (const stack of Object.values(f.sim.world.items.stacks)) {
      const root = items.rootOf(f.sim.world, stack);
      if (
        f.sim.content.items[stack.defId]?.food &&
        ((root.kind === 'household' && root.householdId === f.a.householdId) ||
          (root.kind === 'actor' && root.actorId === f.giver))
      )
        items.deleteStack(f.sim.world, stack.id);
    }
    expect(interact(f, 'give_relief').success).toBe(false);
    expect(social.debtOf(f.sim.world, f.giver, f.receiver).favors).toBe(0);
    expect(f.sim.world.log.events.some((e) => e.kind === 'social.relief')).toBe(false);
  });
  it('collects actual goods into the church pantry without creating personal favors', () => {
    const f = fixture(),
      w = f.sim.world;
    w.time = asGameMinute(7 * 60);
    reliefHour(w, makeContext(w, f.sim.content, []));
    const keeper = actorByKey(f.sim, 'anders_tveit');
    const office = social.officeOf(w, keeper);
    if (!office) throw new Error('No congregation office');
    const pastor = w.actors[keeper];
    if (!pastor) throw new Error('No pastor');
    f.a.placeId = office.placeId;
    pastor.placeId = office.placeId;
    const ctx = makeContext(w, f.sim.content, []);
    items.createStack(w, ctx, 'hardtack', 30, items.carriedBy(f.giver));
    const def = f.sim.content.interactions.collect_relief;
    if (!def) throw new Error('No collection interaction');
    expect(
      social.resolveInteraction(w, ctx, {
        def,
        initiatorId: f.giver,
        targetId: keeper,
        placeId: office.placeId,
        present: [],
        mode: 'forced',
        via: 'urge',
      }).success,
    ).toBe(true);
    expect(office.pantry.some((id) => w.items.stacks[id]?.qty)).toBe(true);
    expect(social.debtOf(w, keeper, f.giver).favors).toBe(0);
    expect(w.log.events.some((e) => e.kind === 'social.relief' && e.data.collection)).toBe(true);
    const stocked = items.createStack(w, ctx, 'hardtack', 10000, items.atPlace(office.placeId));
    office.pantry.push(stocked);
    expect(reliefPlan(w, ctx, f.giver, keeper, 'collect')).toBeNull();
  });
  it('supports nonfood theft without revealing an undetected taker to the victim', () => {
    const f = fixture(),
      w = f.sim.world;
    const item = items.createStack(w, f.ctx, 'tin_cup', 1, items.carriedBy(f.receiver));
    const ctx = {
      ...f.ctx,
      rng: (...args: Parameters<typeof f.ctx.rng>) => ({ ...f.ctx.rng(...args), int: () => 20 }),
    };
    const result = social.attemptTheft(w, ctx, { actorId: f.giver, victimId: f.receiver, itemId: item });
    expect(result.success).toBe(true);
    expect(result.detected).toBe(false);
    if (result.movedId === null) throw new Error('Nothing moved');
    const moved = w.items.stacks[result.movedId];
    if (!moved) throw new Error('Missing moved item');
    expect(items.rootOf(w, moved)).toEqual(items.carriedBy(f.giver));
    expect(social.reasonsOf(w, f.receiver, f.giver).some((r) => r.label === 'Took our goods')).toBe(false);
    expect(w.log.events.some((e) => e.kind === 'social.theft' && e.visibility === 'secret')).toBe(true);
    expect(findNonIntegers(w)).toEqual([]);
  });
});
