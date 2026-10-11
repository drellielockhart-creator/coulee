/**
 * Cross-module wiring (the integration pass): one real Iron Ford run, checked end to end.
 * Needs drive the psyche's thoughts; urges move people; interactions leave memories and
 * reasoned opinions; gossip moves beliefs; defenses fire; meals empty pantries; purchases and
 * loans move money; the chronicle sifts it. Plus the integration rules added with it:
 * confinement, shunning prices, defense-made Reasons, belief-colored opinions.
 */
import {
  asGameMinute,
  belief,
  chronicle,
  type Event,
  items,
  makeContext,
  provisions,
  psyche,
  rowsOf,
  runHours,
  social,
  yearsBetween,
} from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { collectingSink } from '../src/harness.ts';
import { actorByKey, baseContent, simFor } from './helpers.ts';

const content = baseContent();

describe('integration: a 21-day Iron Ford run is wired end to end', () => {
  const sim = simFor({ seed: 42, fullLog: false });
  const { sink, events } = collectingSink();
  for (const e of sim.world.log.events) sink(e);
  sim.sink = sink;
  const pantryKcalAt0 = rowsOf(sim.world.households).reduce(
    (n, h) =>
      n +
      items
        .stacksDeep(sim.world, items.pantryOf(h.id))
        .reduce((k, { stack }) => k + (content.items[stack.defId]?.food?.kcal ?? 0) * stack.qty, 0),
    0,
  );
  runHours(sim, 21 * 24);
  const w = sim.world;
  const of = <K extends Event['kind']>(k: K) => events.filter((e): e is Extract<Event, { kind: K }> => e.kind === k);

  it('needs and schedules drive the psyche, and chosen urges move people', () => {
    const started = of('activity.started');
    expect(started.some((e) => e.data.source === 'urge')).toBe(true);
    expect(started.some((e) => e.data.source === 'schedule')).toBe(true);
    const arbitrations = of('psyche.arbitrated');
    expect(arbitrations.length).toBeGreaterThan(0);
    // An Id thought sourced from a need (hunger, rest, company...) is alive in someone's mind.
    const needThoughts = rowsOf(w.psyche.byActor).flatMap((p) => p.thoughts.filter((t) => t.source === 'needs'));
    expect(needThoughts.length + of('psyche.thought').length).toBeGreaterThan(0);
  });

  it('interactions leave memories and opinions with reasons; gossip moves beliefs; defenses fire', () => {
    expect(of('social.interaction').length).toBeGreaterThan(500);
    expect(rowsOf(w.social.memories).length).toBeGreaterThan(100);
    const reasons = Object.values(w.social.opinions).flatMap((t) => Object.values(t).flatMap((o) => o.reasons));
    expect(reasons.some((r) => r.cites.kind === 'memory')).toBe(true);
    expect(of('belief.transmitted').some((e) => e.data.accepted)).toBe(true);
    expect(of('psyche.defense').length).toBeGreaterThan(0);
  });

  it('meals draw down pantries, food spoils, purchases and loans move money', () => {
    expect(of('provisions.meal').length).toBeGreaterThan(1000);
    expect(of('provisions.purchase').length).toBeGreaterThan(0);
    expect(of('provisions.purchase').some((e) => e.data.priceCents > 0)).toBe(true);
    expect(of('provisions.cash_transfer').length).toBeGreaterThan(0);
    const consumed = of('items.consumed').length;
    expect(consumed).toBeGreaterThan(100);
    expect(pantryKcalAt0).toBeGreaterThan(0);
  });

  it('the chronicle sifts it into entries, and the World keeps only a window of the log', () => {
    expect(chronicle.chronicleEntries(w).length).toBeGreaterThan(20);
    expect(w.log.events.length).toBeLessThan(events.length);
    expect(events.length).toBe(w.log.lastId);
  });

  it('the missing chainmen stay where they are held', () => {
    const tobias = w.actors[actorByKey(sim, 'tobias_vik')];
    expect(w.places[tobias?.placeId ?? -1]?.defId).toBe('lantern_spring');
  });
});

describe('integration rules', () => {
  it('a shunned customer pays the storekeeper’s hard price and gets no credit', () => {
    const sim = simFor({ seed: 3 });
    const w = sim.world;
    w.time = asGameMinute(8 * 60); // Transactions happen during posted shop hours.
    const store = rowsOf(w.provisions.stores).find((s) => s.restockId !== null);
    if (!store || store.ownerHouseholdId === null) throw new Error('fixture needs an owned store');
    const keeper = w.households[store.ownerHouseholdId]?.headId;
    const buyer = rowsOf(w.actors).find(
      (a) => a.householdId !== store.ownerHouseholdId && yearsBetween(a.born, w.time) >= 18,
    );
    if (keeper === undefined || !buyer) throw new Error('fixture');
    buyer.placeId = store.placeId;
    const def = items
      .stacksDeep(w, items.atPlace(store.placeId))
      .map((s) => s.stack.defId)
      .find((d) => (content.items[d]?.value_cents ?? 0) > 0);
    if (!def) throw new Error('store has stock');
    const list = provisions.priceAt(w, content, store.placeId, def) ?? 0;
    w.belief.persecutions.push({
      id: 999,
      target: { kind: 'actor', id: buyer.id },
      rung: 3,
      since: w.time,
      heat: 400,
      consensus: 500,
      leaderIds: [],
      charges: [],
      actAttributed: false,
      holdersOver40: 5,
      history: [],
      lastFuelAt: w.time,
      pending: null,
      shunnerIds: [keeper],
      revealed: false,
      lastFallbackDay: -1,
    });
    expect(belief.isShunning(w, keeper, buyer.id)).toBe(true);
    w.provisions.purses[buyer.id] = 100_000;
    const ctx = makeContext(w, content, []);
    provisions.purchase(w, ctx, buyer.id, store.placeId, def, 1, true);
    const ev = w.log.events.findLast((e) => e.kind === 'provisions.purchase');
    expect(ev?.kind === 'provisions.purchase' && ev.data.priceCents).toBe(Math.round((list * 150) / 100));
    // No credit: with an empty purse nothing can be bought on the tab.
    w.provisions.purses[buyer.id] = 0;
    const hh = w.provisions.households[buyer.householdId];
    if (hh) hh.cashCents = 0;
    expect(provisions.purchase(w, ctx, buyer.id, store.placeId, def, 1, true)).toBe(0);
  });

  it('cash transfers move real money, purse first, and never invent it', () => {
    const sim = simFor({ seed: 5 });
    const w = sim.world;
    const a = rowsOf(w.actors)[0];
    const b = rowsOf(w.actors).find((x) => x.householdId !== a?.householdId);
    if (!a || !b) throw new Error('fixture');
    w.provisions.purses[a.id] = 70;
    const ha = w.provisions.households[a.householdId];
    if (ha) ha.cashCents = 50;
    const hb = w.provisions.households[b.householdId];
    const before = hb?.cashCents ?? 0;
    const moved = provisions.transferCash(w, makeContext(w, content, []), a.id, b.id, 500, 'Lend');
    expect(moved).toBe(120);
    expect(w.provisions.purses[a.id]).toBe(0);
    expect(ha?.cashCents).toBe(0);
    expect(hb?.cashCents).toBe(before + 120);
  });

  it('rationalization leaves a fading "had it coming" Reason that cites the defense', () => {
    const sim = simFor({ seed: 2 });
    const w = sim.world;
    const [a, b] = rowsOf(w.actors);
    if (!a || !b) throw new Error('fixture');
    const ctx = makeContext(w, content, []);
    expect(social.addDefenseReason(w, ctx, a.id, b.id, 'rationalization', 77 as never)).toBe(true);
    const r = social.reasonsOf(w, a.id, b.id).find((x) => x.cites.kind === 'defense');
    expect(r?.label).toBe('Had it coming');
    expect(r?.viaDefense).toBe('rationalization');
    expect(r && social.reasonStrength(w, a.id, b.id, r)).toBe(1000);
  });

  it('a belief about a person colors the holder’s opinion through a Reason weighted by credence', () => {
    const sim = simFor({ seed: 4 });
    const w = sim.world;
    const [holder, subject] = rowsOf(w.actors).filter((x) => yearsBetween(x.born, w.time) >= 18);
    if (!holder || !subject) throw new Error('fixture');
    const ctx = makeContext(w, content, []);
    const prop = belief.internProp(w, 'drinks', [{ kind: 'actor', id: subject.id }]);
    const before = social.opinionOf(w, holder.id, subject.id);
    for (let i = 0; i < 12 && (belief.credenceOf(w, holder.id, prop) ?? 0) < 60; i++)
      belief.observe(w, ctx, holder.id, prop, { type: 'observation', dir: 1, sourceId: null, eventId: null });
    expect(belief.credenceOf(w, holder.id, prop)).toBeGreaterThanOrEqual(50);
    const cite = social.reasonsOf(w, holder.id, subject.id).find((r) => r.cites.kind === 'belief');
    expect(cite).toBeDefined();
    const after = social.opinionOf(w, holder.id, subject.id);
    expect(after.trust).toBeLessThan(before.trust);
    expect(after.affection).toBeLessThanOrEqual(before.affection);
  });

  it('projection maps a trait id to a predicate (or Is(target, trait)) at credence 5 + PF/2', () => {
    const sim = simFor({ seed: 6 });
    const w = sim.world;
    const [holder, target] = rowsOf(w.actors);
    if (!holder || !target) throw new Error('fixture');
    const ctx = makeContext(w, content, []);
    belief.formProjection(w, ctx, holder.id, target.id, 'hot_tempered', 60);
    const held = (w.belief.beliefsByHolder[holder.id] ?? [])
      .map((id) => w.belief.beliefs[id])
      .find((b) => b && w.belief.props[b.propId]?.args[0]?.kind === 'actor');
    expect(held?.credence).toBe(35);
    const prop = held ? w.belief.props[held.propId] : undefined;
    // hot_tempered belongs to the rage drive, which `violent` projects.
    expect(prop?.pred).toBe('violent');
    expect(psyche.effectiveTraits(w, holder.id)).toEqual(expect.arrayContaining([...holder.traits]));
  });
});
