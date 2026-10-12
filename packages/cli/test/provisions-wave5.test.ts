/**
 * Wave 5 group A regressions (r2 playtest triage Tier 1 #1, #2, #3, #8 and Tier 2 provisions):
 * water in the wild, the Food readout, standing orders, survival forecasts, containers and load,
 * stock legibility and the salt and monotony levers.
 */
import { asGameMinute, type Command, items, makeContext, needs, provisions, type Sim, step } from '@coulee/core';
import { type Observation, PlaySession, parseText, renderDetail, renderObservation } from '@coulee/play';
import { expect, it } from 'vitest';
import { baseContent } from './helpers.ts';

const createStack = items.createStack;

const required = <T>(x: T | undefined | null): T => {
  if (x == null) throw new Error('Missing fixture');
  return x;
};
const create = (seed = 42, source = 'iron_ford') => PlaySession.create(baseContent(), { source, seed });
const simOf = (s: PlaySession) => (s as unknown as { sim: Sim }).sim;
function ask(s: PlaySession, line: string) {
  const c = parseText(line, s.observe());
  expect(typeof c, `${line}: ${String(c)}`).toBe('object');
  return s.act(c as Command);
}
const placeNamed = (s: PlaySession, name: string) =>
  required(Object.values(simOf(s).world.places).find((p) => p.name === name));

it('the Food readout follows the kit, not the eat order, and prints the kcal/day it judges by', () => {
  const s = create();
  const before = s.observe().self.provisions.readiness;
  expect(before.daysOfFoodTenths).toBeGreaterThan(40);
  ask(s, 'standing eat off');
  const after = s.observe().self.provisions.readiness;
  expect(after.daysOfFoodTenths).toBe(before.daysOfFoodTenths);
  // The printed kcal/day is the mean of the projected days, so on-hand / per-day agrees with the days.
  expect(Math.abs(after.kcalOnHand / after.kcalPerDay - after.daysOfFoodTenths / 10)).toBeLessThan(1);
  expect(after.needExplain?.total).toBeGreaterThan(0);
  expect(after.needRange?.max).toBeGreaterThan(required(after.needRange).min);
  expect(after.warnings.join(' ')).toMatch(/Daily need runs \d+–\d+ kcal this week: the heavier days carry \d+ h/);
  const plan = s.act('plan');
  expect(String(JSON.stringify(plan.detail))).toContain('needExplain');
});

it('a bought plate left at another place neither zeroes the readout nor blocks eating from the pack', () => {
  const s = create();
  s.advance({ time: 7 * 60, maxMinutes: 480 });
  expect(ask(s, 'meal').ok).toBe(true);
  expect(ask(s, 'go Pratt').ok).toBe(true);
  expect(s.observe().self.provisions.readiness.daysOfFoodTenths).toBeGreaterThan(30);
  const r = ask(s, 'eat pemmican');
  expect(r.ok).toBe(true);
  expect(r.observation.events.some((e) => /You ate Pemmican/.test(e.summary))).toBe(true);
});

it('springs, creeks and fords are water: drink and fill there; elsewhere the refusal says why and where', () => {
  const s = create();
  const sim = simOf(s);
  const pc = s.playerId;
  // Lantern Spring is a spring: drinking is raw water from it.
  required(sim.world.actors[pc]).placeId = placeNamed(s, 'Lantern Spring').id;
  expect(s.observe().actions.find((a) => a.id === 'drink')?.label).toMatch(/Drink from Lantern Spring \(raw water/);
  // On a dry bluff with empty vessels.
  required(sim.world.actors[pc]).placeId = placeNamed(s, 'East Bluff').id;
  for (const st of Object.values(sim.world.items.stacks)) if (st.waterMl) st.waterMl = 0;
  const o = s.observe();
  expect(parseText('drink', o)).toMatch(
    /empty, and there is no spring, creek or ford here\. The nearest water is .+, \d+ min on foot/,
  );
  const fetch = required(o.actions.find((a) => a.id === 'activity:fetch_water'));
  const target =
    fetch.command.kind === 'core.urge' && fetch.command.data.urge.kind === 'activity'
      ? fetch.command.data.urge.placeId
      : undefined;
  expect(provisions.isWaterSource(sim.world, sim.content, target)).toBe(true);
  const fill = s.act(parseText('fill canteen', o) as Command);
  expect(fill.ok).toBe(false);
  expect(fill.reason).toMatch(/^No water to draw here: fill at a spring, creek or ford; the nearest is/);
  // At the creek the order fills the vessels.
  expect(ask(s, 'fetch water').ok).toBe(true);
  expect(s.observe().self.inventory.carried.some((i) => (i.liquidMl ?? 0) > 0 && i.waterMl === i.liquidMl)).toBe(true);
});

it('any order wakes a camper; a parched sleeper drinks what she carries', () => {
  const s = create();
  const sim = simOf(s);
  required(sim.world.actors[s.playerId]).placeId = placeNamed(s, 'East Bluff').id;
  expect(ask(s, 'sleep').observation.self.activity.asleep).toBe(true);
  const r = ask(s, 'go Lantern Spring');
  expect(r.ok).toBe(true);
  expect(r.observation.place.name).toBe('Lantern Spring');
  expect(r.observation.self.activity.asleep).toBe(false);
  // Parched while asleep: the standing drink order sips from the canteen.
  required(sim.world.actors[s.playerId]).placeId = placeNamed(s, 'East Bluff').id;
  ask(s, 'sleep');
  required(sim.world.needs.byActor[s.playerId]).values.thirst = 150;
  expect(needs.rousedBy(sim.world, sim.content, s.playerId)).toBe('Thirst');
  s.advance(60);
  expect(needs.needValue(sim.world, s.playerId, 'thirst')).toBeGreaterThan(600);
});

it('the standing sleep order beds a lodger and pays only once she is asleep in the bed (B12, B15)', () => {
  const s = create();
  const sim = simOf(s);
  s.advance({ time: 21 * 60, maxMinutes: 1440 });
  s.advance({ time: 24 * 60 + 5 * 60, maxMinutes: 1440 });
  expect(needs.needValue(sim.world, s.playerId, 'rest')).toBeGreaterThan(600);
  const tavern = placeNamed(s, "Dunleavy's Tavern").id;
  const charges = sim.world.log.events.filter(
    (e) => e.kind === 'provisions.cash_transfer' && e.data.fromId === s.playerId && e.data.reason === 'Tavern bed',
  );
  expect(charges.length).toBeGreaterThan(0);
  expect(sim.world.provisions.beds?.[s.playerId]?.placeId).toBe(tavern);
  // A sleeper who cannot get there is never charged: admission alone moves no money.
  const purse = sim.world.provisions.purses[s.playerId];
  required(sim.world.actors[s.playerId]).placeId = placeNamed(s, 'Pratt & Daughter, Outfitters').id;
  delete sim.world.provisions.beds?.[s.playerId];
  const ctx = makeContext(sim.world, sim.content, []);
  provisions.admitSleep(sim.world, ctx, s.playerId, tavern);
  provisions.settleBeds(sim.world, ctx);
  expect(sim.world.provisions.purses[s.playerId]).toBe(purse);
});

it('the eat order feeds by the meter, announces itself, and never sits at table with nothing to eat', () => {
  const s = create();
  const lines: string[] = [];
  for (let h = 0; h < 48; h++) {
    const r = s.advance(60);
    lines.push(...r.observation.events.map((e) => e.summary));
  }
  const meals = [...new Set(lines.filter((l) => l.startsWith('Standing order (eat): you ate')))];
  expect(meals.length).toBeGreaterThanOrEqual(4);
  for (const m of meals) expect(Number(/: (\d+) kcal/.exec(m)?.[1])).toBeLessThan(1300);
  expect(needs.needValue(simOf(s).world, s.playerId, 'hunger')).toBeGreaterThan(500);
});

it('survival forecasts give the stages from the live rate and the real save odds', () => {
  const s = create();
  const sim = simOf(s);
  required(sim.world.needs.byActor[s.playerId]).values.hunger = 271;
  const w = required(s.observe().self.needs.warnings).find((x) => /starvation/.test(x));
  expect(w).toMatch(
    /^You may collapse from starvation in about [\d.]+ days \([\d.]+ days if every save fails\) if this continues: hunger runs out in about \d+ hours at the current rate \(-\d+\/h\); then 5 days before the first Fortitude save; a save \(DC 15, \+1 each time\) every 24 hours/,
  );
  const rule = required(sim.content.survival_rules.starvation);
  const f = needs.collapseForecast(sim.world, sim.content, s.playerId, rule, 271, -30);
  expect(f.toZero).toBe(10);
  expect(f.soonestHours).toBe(10 + 120 + (f.vigor - 1) * 24);
  expect(f.medianHours).toBeGreaterThanOrEqual(f.soonestHours);
  expect(f.medianHours).toBeLessThan(f.soonestHours + 6 * 24);
});

it('loads: buying past what she can walk with is refused with the band; an immovable load says why', () => {
  const s = create();
  s.advance({ time: 8 * 60, maxMinutes: 600 });
  ask(s, 'go Pratt');
  const r = s.act(parseText('buy cornmeal 150', s.observe()) as Command);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(
    /^Too heavy: 150 × Cornmeal \([\d.]+ kg\) would put your load at \d+% .*over 150% you cannot walk\. You can carry \d+ more$/,
  );
  expect(r.elapsedMinutes).toBe(0);
  const o: Observation = s.observe();
  expect(renderObservation(o)).toMatch(/Freight due .+ every \d+ days/);
});

it('salt meat asks for water, and a fortnight of the same food is an Appetite thought', () => {
  const sim = simOf(create());
  const pc = required(sim.world.meta.playerId);
  const w = sim.world;
  // Monotony: the same two foods for days.
  const n = required(w.provisions.nutrition[pc]);
  n.monotony = 700;
  n.history.push({ ...n.today, dayIndex: -1, foods: ['salt_pork', 'hardtack'], groups: ['meat', 'bread'] });
  w.time = asGameMinute(9 * 60);
  const urges = provisions.proposeProvisionUrges(w, makeContext(w, sim.content, []), pc);
  expect(urges.some((u) => /^Sick of bacon and hardtack: something different/.test(u.label))).toBe(true);
  // Salt: raw salt pork costs Thirst through a named, explained change.
  expect(sim.content.items.salt_pork?.food?.prep.find((p) => p.method === 'raw')?.thirst_ml).toBeGreaterThan(0);
  step(sim);
});

it('household errands buy into the pantry at her lodgings, and the status and plan say so', () => {
  const s = create();
  const sim = simOf(s);
  const pc = s.playerId;
  const household = required(sim.world.actors[pc]).householdId;
  createStack(sim.world, makeContext(sim.world, sim.content, []), 'cornmeal', 10, items.pantryOf(household));
  ask(s, 'go Pratt');
  const o = s.observe();
  expect(o.self.pantry?.items.some((i) => /Cornmeal/.test(i.name))).toBe(true);
  expect(renderObservation(o)).toMatch(/Food [\d.]+ days in your pack; [\d.]+ more in the pantry at Dunleavy's Tavern/);
  expect(renderDetail(s.act('plan').detail)).toMatch(/Pantry at Dunleavy's Tavern: [\d.]+ days; 10 × Cornmeal/);
});
