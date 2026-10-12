import {
  type ActorId,
  activity,
  asGameMinute,
  items,
  makeContext,
  needs,
  provisions,
  psyche,
  type Sim,
  social,
  step,
} from '@coulee/core';
import { alertForEvent, PlaySession, parseText, renderObservation } from '@coulee/play';
import { expect, it } from 'vitest';
import { aftermathHour, die, helpHour } from '../../core/src/needs/survival-social.ts';
import { shoppingHour } from '../../core/src/provisions/economy.ts';
import { preparationHour } from '../../core/src/provisions/meals.ts';
import { actorByKey, baseContent, simFor } from './helpers.ts';

const required = <T>(x: T | undefined | null): T => {
  if (x == null) throw Error('Missing fixture');
  return x;
};
function collapse(s: Sim, id: ActorId, need = 'hunger') {
  required(s.world.needs.byActor[id]).values[need] = 0;
  Object.assign(required(needs.survivalOf(s.world, s.content, id)), {
    collapsed: true,
    vigor: 0,
    vigorHarm: { [need === 'hunger' ? 'starvation' : 'dehydration']: 7 },
  });
}
function beansOnly(s: Sim, id: ActorId) {
  const holder = items.pantryOf(required(s.world.actors[id]).householdId),
    ctx = makeContext(s.world, s.content, []);
  for (const { stack } of items.stacksDeep(s.world, holder))
    if (s.content.items[stack.defId]?.food) items.consumeStack(s.world, ctx, stack.id, stack.qty, 'fixture');
  items.createStack(s.world, ctx, 'beans_dry', 12, holder);
  items.createStack(s.world, ctx, 'firewood_armload', 30, holder);
}
it('S1: a housemate notices collapse, cooks real beans, reserves a plate and serves the patient', () => {
  const s = simFor({ seed: 42 }),
    p = actorByKey(s, 'joel_pike'),
    helper = actorByKey(s, 'amos_whitcomb');
  beansOnly(s, p);
  collapse(s, p);
  required(s.world.provisions.households[required(s.world.actors[p]).householdId]).rationPct = 50;
  required(s.world.needs.byActor[p]).debt = { hunger: 3000 };
  required(s.world.needs.byActor[helper]).values.hunger = 0;
  required(needs.survivalOf(s.world, s.content, helper)).hours.starvation = 24;
  helpHour(s.world, makeContext(s.world, s.content, []));
  const meal = required(s.world.provisions.pendingMeals?.find((m) => m.plates.some((x) => x.id === p)));
  expect(meal.cookId).toBe(helper);
  expect(meal.rationPct).toBe(100);
  expect(s.world.activity.byActor[helper]?.lockedUntil).toBeGreaterThan(meal.completesAt);
  expect(meal.completesAt).toBeGreaterThan(s.world.time);
  expect(s.world.provisions.nutrition[p]?.today.kcal).toBe(0);
  const plates = meal.plates.length;
  provisions.assistIntake(s.world, makeContext(s.world, s.content, []), helper, p, 500);
  expect(meal.plates).toHaveLength(plates);
  s.world.time = asGameMinute(meal.completesAt);
  preparationHour(s.world, makeContext(s.world, s.content, []));
  expect(s.world.provisions.nutrition[p]?.today.kcal).toBeGreaterThan(0);
  expect(s.world.log.events.some((e) => e.kind === 'provisions.meal' && e.data.assistedBy === helper)).toBe(true);
  for (let h = 0; h < 48; h++) step(s);
  expect(s.world.actors[p]?.alive).toBe(true);
  expect(needs.canAct(s.world, p)).toBe(true);
});
it('S1/S4: an authorized helper supplies a different household at the same address, including timed command consent', () => {
  const session = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
  const s = (session as unknown as { sim: Sim }).sim,
    p = session.playerId,
    helper = actorByKey(s, 'michael_dunleavy');
  collapse(s, p, 'thirst');
  required(s.world.provisions.households[required(s.world.actors[p]).householdId]).waterMl = 0;
  expect(provisions.assistIntake(s.world, makeContext(s.world, s.content, []), helper, p, 1000)).toBe(1000);
  collapse(s, p);
  beansOnly(s, helper);
  for (const { stack } of items.stacksDeep(s.world, items.carriedBy(p)))
    if (s.content.items[stack.defId]?.food)
      items.consumeStack(s.world, makeContext(s.world, s.content, []), stack.id, stack.qty, 'fixture');
  psyche.setAgency(s.world, helper, {
    ...psyche.agencyOf(s.world, helper),
    mode: 'commanded',
    issuer: { kind: 'player' },
  });
  expect(provisions.assistIntake(s.world, makeContext(s.world, s.content, []), helper, p, 500)).toBe(0);
  const ctx = makeContext(s.world, s.content, [{ kind: 'needs.aid', actorId: helper, data: { targetId: p } }]);
  provisions.assistIntake(s.world, ctx, helper, p, 500);
  const meal = required(s.world.provisions.pendingMeals?.find((m) => m.plates.some((x) => x.id === p)));
  s.world.time = asGameMinute(meal.completesAt);
  preparationHour(s.world, makeContext(s.world, s.content, []));
  expect(s.world.provisions.nutrition[p]?.today.kcal).toBeGreaterThan(0);
});
it('S1: care destinations require preparation resources, not raw calories', () => {
  const s = simFor(),
    p = actorByKey(s, 'joel_pike'),
    helper = actorByKey(s, 'gussie_pratt');
  beansOnly(s, p);
  collapse(s, p);
  const h = required(s.world.actors[p]).householdId,
    ctx = makeContext(s.world, s.content, []);
  for (const { stack } of items.stacksDeep(s.world, items.pantryOf(h)))
    if ((s.content.items[stack.defId]?.affordances.cookware ?? 0) > 0)
      items.consumeStack(s.world, ctx, stack.id, stack.qty, 'fixture');
  // Exhausting water prevents boiling even if a kettle remains.
  required(s.world.provisions.households[h]).waterMl = 0;
  expect(provisions.careHome(s.world, s.content, helper, p)).toBe(
    s.world.households[required(s.world.actors[helper]).householdId]?.homePlaceId,
  );
});
it('S2: succession transfers claims and liabilities with mirrored ledgers, tabs and durable history', () => {
  const s = simFor(),
    w = s.world,
    dead = actorByKey(s, 'gussie_pratt'),
    heir = actorByKey(s, 'lydia_pratt'),
    debtor = actorByKey(s, 'johann_brenner');
  const claims = Object.values(w.actors).map((a) => ({
    id: a.id,
    claim: social.debtOf(w, dead, a.id).cents,
    liability: social.debtOf(w, a.id, dead).cents,
  }));
  w.time = asGameMinute(10 * 1440);
  const ctx = makeContext(w, s.content, []);
  die(w, ctx, dead, 'fixture');
  aftermathHour(w, ctx);
  provisions.synchronizeStoreTabs(w);
  expect(w.households[required(w.actors[dead]).householdId]?.headId).toBe(heir);
  for (const c of claims) {
    if (c.id === heir) continue;
    expect(social.debtOf(w, heir, c.id).cents).toBe(c.claim);
    expect(social.debtOf(w, c.id, heir).cents).toBe(c.liability);
    expect(social.debtOf(w, dead, c.id).cents).toBe(0);
  }
  expect(w.provisions.estates?.[0]?.claims.length).toBeGreaterThan(0);
  expect(
    w.social.relationships.find((edge) => edge.kind === 'creditor' && edge.a === heir && edge.b === debtor)?.since,
  ).toBe(0);
  expect(w.social.opinions[heir]?.[debtor]?.obligation.cents).toBe(
    -(w.social.opinions[debtor]?.[heir]?.obligation.cents ?? 0),
  );
  const store = required(
    Object.values(w.provisions.stores).find((x) => x.ownerHouseholdId === w.actors[heir]?.householdId),
  );
  expect(store.tabs[debtor]).toBe(social.debtOf(w, heir, debtor).cents);
  expect(Object.values(w.social.opinions[heir] ?? {}).some((o) => o.obligation.cents !== 0)).toBe(true);
});
it('S3: collapsed buyers cannot purchase; an able housemate at the store buys instead', () => {
  const s = simFor(),
    w = s.world,
    p = actorByKey(s, 'johann_brenner'),
    helper = actorByKey(s, 'magdalena_brenner'),
    store = required(w.index.placeByDef.pratt_daughter_outfitters);
  w.time = asGameMinute(1440 + 12 * 60);
  collapse(s, p, 'thirst');
  required(w.actors[p]).placeId = store;
  required(w.actors[helper]).placeId = store;
  const ctx = makeContext(w, s.content, []),
    before = provisions.cashOf(w, p);
  expect(provisions.purchase(w, ctx, p, store, 'beans_dry', 1, false)).toBe(0);
  expect(provisions.cashOf(w, p)).toBe(before);
  const first = w.log.lastId;
  shoppingHour(w, ctx);
  const purchases = w.log.events.filter((e) => e.id > first && e.kind === 'provisions.purchase');
  expect(purchases.some((e) => e.kind === 'provisions.purchase' && e.data.buyerId === helper)).toBe(true);
  expect(purchases.some((e) => e.kind === 'provisions.purchase' && e.data.buyerId === p)).toBe(false);
});
it.each([60, 114])('S5: %i minute travel resolves in the step reaching its boundary', (minutes) => {
  const s = simFor(),
    w = s.world,
    p = actorByKey(s, 'joel_pike'),
    a = required(w.places[required(w.actors[p]).placeId]),
    to = required(w.places[required(w.index.placeByDef.pratt_daughter_outfitters)]);
  to.x = a.x + Math.floor((minutes * 264) / 10);
  to.y = a.y;
  to.w = a.w;
  to.h = a.h;
  expect(activity.walkMinutes(w, s.content, a.id, to.id)).toBe(minutes);
  psyche.setAgency(w, p, { ...psyche.agencyOf(w, p), mode: 'commanded', issuer: { kind: 'player' } });
  step(s, [
    { kind: 'core.urge', actorId: p, data: { urge: { kind: 'activity', activityId: 'walk', placeId: to.id } } },
  ]);
  if (minutes > 60) {
    expect(w.actors[p]?.placeId).toBe(a.id);
    step(s);
  }
  expect(w.actors[p]?.placeId).toBe(to.id);
  expect(w.activity.byActor[p]?.travel).toBeNull();
});
function ask(s: PlaySession, line: string) {
  const cmd = parseText(line, s.observe());
  if (typeof cmd === 'string') throw Error(cmd);
  return s.act(cmd);
}
it('P1: mild hunger and thirst pause only when standing orders cannot handle them; serious bands always pause', () => {
  const session = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 }),
    s = (session as unknown as { sim: Sim }).sim,
    p = session.playerId;
  const band = (needId: string, to: string) => {
    const ctx = makeContext(s.world, s.content, []);
    const id = ctx.emit({
      kind: 'needs.band_changed',
      data: { actorId: p, needId, from: '', to, value: 500, layer: 'meter' },
      roles: [{ actor: p, role: 'subject' }],
      visibility: 'inner',
    });
    return required(s.world.log.events.find((e) => e.id === id));
  };
  const hunger = required(s.content.needs.hunger?.bands.find((b) => b.below > 300)),
    thirst = required(s.content.needs.thirst?.bands.find((b) => b.below > 300));
  expect(alertForEvent(s.world, s.content, p, band('hunger', hunger.label)).pause).toBe(false);
  expect(alertForEvent(s.world, s.content, p, band('thirst', thirst.label)).pause).toBe(false);
  ask(session, 'standing eat off');
  expect(alertForEvent(s.world, s.content, p, band('hunger', hunger.label)).pause).toBe(true);
  ask(session, 'standing eat on');
  expect(
    alertForEvent(s.world, s.content, p, band('hunger', required(s.content.needs.hunger?.bands.at(-1)).label)).pause,
  ).toBe(true);
});
it.each([true, false])(
  'P2/P4: standing lodging=%s chooses the paid nearby bed or camp, and sleeping text has no urges',
  (lodging) => {
    const session = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 }),
      s = (session as unknown as { sim: Sim }).sim,
      p = session.playerId;
    const home = required(s.world.actors[p]).placeId;
    s.world.provisions.beds = { [p]: { placeId: home, until: 36 * 60 } };
    ask(session, 'go Cold Stair');
    ask(session, `standing lodging ${lodging ? 'on' : 'off'}`);
    s.world.time = asGameMinute(22 * 60);
    required(s.world.needs.byActor[p]).values.rest = 100;
    required(s.world.activity.byActor[p]).lockedUntil = null;
    step(s);
    expect(s.world.actors[p]?.placeId === home).toBe(lodging);
    expect(s.content.activities[required(required(s.world.activity.byActor[p]).activityId)]?.asleep).toBe(true);
    expect(renderObservation(session.observe())).not.toMatch(/Appetite:|Conscience:|fire wants minding/);
  },
);
it('P3/P5: arrival status, liquor label, clean health and Kit warnings only on looks', () => {
  const session = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
  ask(session, 'go Cold Stair');
  const o = session.observe(),
    text = renderObservation(o);
  expect(text).not.toContain('walking about');
  expect(text).not.toContain('Drink 800');
  expect(text).not.toMatch(/Wounds \d+\/\d+\. +\n/);
  expect(renderObservation({ ...o, changes: { ...o.changes, elapsed: 60 } })).not.toContain('Kit:');
});

it('P4: fire-minding thoughts require a live fire at the observed place', () => {
  const session = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 }),
    s = (session as unknown as { sim: Sim }).sim,
    placeId = required(s.world.actors[session.playerId]).placeId;
  delete s.world.provisions.fires[placeId];
  const o = session.observe();
  o.self.mind.chosen = null;
  o.self.mind.thoughts = [
    {
      id: 1,
      voice: 'Conscience',
      label: 'The fire wants minding',
      intensity: 100,
      urge: 'activity:cook',
      ageMinutes: 0,
    },
  ];
  expect(o.place.fireLit).toBe(false);
  expect(renderObservation(o)).not.toContain('The fire wants minding');
  s.world.provisions.fires[placeId] = { placeId, lit: true, until: s.world.time + 60, fuelMinutes: 60 };
  o.place = session.observe().place;
  expect(renderObservation(o)).toContain('The fire wants minding');
});

it('S1: a nearby housemate checks on a collapsed patient at home; fruitless care leaves shopping time free', () => {
  const s = simFor({ seed: 42 }),
    w = s.world,
    p = actorByKey(s, 'joel_pike'),
    helper = actorByKey(s, 'amos_whitcomb');
  beansOnly(s, p);
  collapse(s, p);
  for (const actor of Object.values(w.actors))
    if (actor.id !== helper)
      psyche.setAgency(w, actor.id, { ...psyche.agencyOf(w, actor.id), mode: 'commanded', issuer: { kind: 'player' } });
  s.content = {
    ...s.content,
    survival_tuning: {
      ...s.content.survival_tuning,
      survival: { ...required(s.content.survival_tuning.survival), aid_dc: 1 },
    },
  };
  const home = required(w.actors[p]).placeId;
  required(w.actors[helper]).placeId = required(w.index.placeByDef.pratt_daughter_outfitters);
  required(w.activity.byActor[helper]).activityId = 'idle_at_home';
  w.time = asGameMinute(12 * 60);
  helpHour(w, makeContext(w, s.content, []));
  expect(w.actors[helper]?.placeId).toBe(home);
  expect(w.provisions.pendingMeals?.some((m) => m.plates.some((plate) => plate.id === p))).toBe(true);
  w.provisions.pendingMeals = [];
  const ctx = makeContext(w, s.content, []),
    holder = items.pantryOf(required(w.actors[p]).householdId);
  for (const { stack } of items.stacksDeep(w, holder))
    if (s.content.items[stack.defId]?.food) items.consumeStack(w, ctx, stack.id, stack.qty, 'fixture');
  required(w.needs.byActor[p]).values.thirst = 1000;
  expect(provisions.careSuppliesAvailable(w, s.content, helper, p)).toBe(false);
});
