/**
 * Wave 5 provisions review fixes (Codex adversarial review, runs/review-w5-prov):
 *  1. automatic refilling never loads a character past what she can move, says when it stopped
 *     short, and `empty <vessel>` pours one out (menu, text and help agree);
 *  2. the collapse forecast replays the sim's own deprivation counter;
 *  3. reduced winter freight carries its fractional remainder, so small orders still arrive;
 *  4. a drink is offered for the last partial serving.
 */
import {
  type ActorId,
  asGameMinute,
  type Command,
  calendarAt,
  findNonIntegers,
  idsOf,
  items,
  makeContext,
  needs,
  provisions,
  type Sim,
} from '@coulee/core';
import { HELP, PlaySession, parseText } from '@coulee/play';
import { expect, it } from 'vitest';
import { survivalHour } from '../../core/src/needs/survival.ts';
import { actorByKey, baseContent, simFor } from './helpers.ts';

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
const carriedWater = (s: PlaySession) =>
  s
    .observe()
    .self.inventory.carried.filter((i) => (i.liquidMl ?? 0) > 0)
    .map((i) => i.waterMl ?? 0);
/** Water vessels in her pack (at any depth), the kettle before the canteen. */
const vesselsOf = (s: PlaySession) =>
  Object.values(simOf(s).world.items.stacks).filter((st) => {
    const root = items.rootOf(simOf(s).world, st);
    return (
      (simOf(s).content.items[st.defId]?.container?.liquid_ml ?? 0) > 0 &&
      root.kind === 'actor' &&
      root.actorId === s.playerId
    );
  });
/** Everything she carries weighs this much, and the most she can carry and still walk. */
function load(s: PlaySession) {
  const sim = simOf(s);
  const r = items.loadReport(sim.world, sim.content, s.playerId);
  return { weightG: r.weightG, limitG: Math.floor((r.capacityG * items.MOVE_LIMIT_PCT) / 100), pct: r.loadPct };
}

// --- 1. refilling and the load limit ------------------------------------------------------------

/** A heavily laden newcomer at a creek, vessels dry, with about `spare` grams left under the move limit (0: none). */
function loadedAtCreek(spare: number) {
  const s = create();
  const sim = simOf(s);
  for (const st of Object.values(sim.world.items.stacks)) if (st.waterMl) st.waterMl = 0;
  const before = items.loadReport(sim.world, sim.content, s.playerId);
  const unitG = required(sim.content.items.cornmeal).weight_g;
  const qty = Math.floor(((before.capacityG * items.MOVE_LIMIT_PCT) / 100 - before.weightG - spare) / unitG);
  items.createStack(sim.world, makeContext(sim.world, sim.content, []), 'cornmeal', qty, items.carriedBy(s.playerId));
  // Spare of zero: take up what the cornmeal leaves under the limit with water, so there is no room at all.
  if (spare === 0) required(vesselsOf(s)[0]).waterMl = items.movableRoomG(sim.world, sim.content, s.playerId);
  required(sim.world.actors[s.playerId]).placeId = placeNamed(s, 'Hasp Creek').id;
  // Awake and not eating, so the only thing that changes her load in the hour is the water.
  ask(s, 'standing sleep off');
  ask(s, 'standing eat off');
  ask(s, 'standing drink on');
  return s;
}

it('standing drink fills only as far as she can still walk, says it stopped short, and she can still go', () => {
  const s = loadedAtCreek(300);
  const start = load(s);
  expect(start.limitG - start.weightG).toBeGreaterThanOrEqual(300);
  expect(start.limitG - start.weightG).toBeLessThan(300 + 454);
  const r = ask(s, 'wait 1h');
  expect(r.ok).toBe(true);
  const after = load(s);
  // Trimmed to exactly the room under the 150% limit, never over it.
  expect(after.weightG).toBe(after.limitG);
  expect(after.pct).toBeLessThanOrEqual(items.MOVE_LIMIT_PCT);
  expect(carriedWater(s).reduce((n, ml) => n + ml, 0)).toBe(start.limitG - start.weightG);
  // Said aloud, with the amount left out: not folded into the routine fill lines.
  const said = r.observation.events.map((e) => e.summary).find((x) => /filled/.test(x));
  expect(said).toMatch(/\(\d+ ml; \d+ ml more would be too heavy to walk with\)/);
  // The old trap: "You cannot move: your load is 158%".
  const go = ask(s, 'go Pratt');
  expect(go.ok, go.reason).toBe(true);
  expect(go.observation.place.name).toMatch(/^Pratt/);
});

it('a full vessel at the limit is not refilled hour after hour, and no fill announces itself twice', () => {
  const s = loadedAtCreek(300);
  const refills = () =>
    simOf(s).world.log.events.filter((e) => e.kind === 'provisions.refilled' && e.data.actorId === s.playerId);
  ask(s, 'wait 1h');
  const first = refills().length;
  expect(first).toBe(1);
  s.advance(60);
  s.advance(60);
  expect(refills().length).toBe(first);
  expect(load(s).weightG).toBeLessThanOrEqual(load(s).limitG);
});

it('a fill with nothing to spare, or a fixed amount past the room, is refused with the numbers', () => {
  const s = loadedAtCreek(0);
  const sim = simOf(s);
  const vessel = required(vesselsOf(s)[0]);
  const check = provisions.refillCheck(sim.world, sim.content, s.playerId, vessel.id);
  expect('reason' in check && check.reason).toMatch(/^Too heavy: \d+ ml of water would put your load at \d+%/);
  const r = ask(s, 'fill canteen');
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/over 150% you cannot walk/);
  // With room for 400 ml: the brim fill is offered trimmed, an explicit 900 ml is refused, 300 ml is fine.
  const t = loadedAtCreek(450);
  const tsim = simOf(t);
  const cup = required(vesselsOf(t).find((st) => (tsim.content.items[st.defId]?.container?.liquid_ml ?? 0) >= 1900));
  const room = items.movableRoomG(tsim.world, tsim.content, t.playerId);
  expect(room).toBeGreaterThanOrEqual(450);
  const trimmed = provisions.refillCheck(tsim.world, tsim.content, t.playerId, cup.id);
  expect(trimmed).toMatchObject({ ml: room });
  expect(provisions.refillCheck(tsim.world, tsim.content, t.playerId, cup.id, room + 1)).toHaveProperty('reason');
  expect(provisions.refillCheck(tsim.world, tsim.content, t.playerId, cup.id, 300)).toEqual({ ml: 300 });
  // The menu says how much it will take.
  const label = required(t.observe().actions.find((a) => a.id === `refill:${cup.id}`)).label;
  expect(label).toMatch(new RegExp(`^Fill .+ \\(${room} ml; \\d+ ml more would be too heavy to walk with\\)$`));
});

it('empty <vessel> pours it out: on the menu, in the text parser, in help, and refused when dry', () => {
  const s = create();
  const sim = simOf(s);
  const o = s.observe();
  const kettle = required(o.self.inventory.carried.find((i) => /kettle/i.test(i.name) && (i.waterMl ?? 0) > 0));
  // UI parity: the same Command the text parser builds is on the offered menu.
  const offered = required(o.actions.find((a) => a.id === `empty:${kettle.id}`));
  expect(offered.label).toMatch(/^Empty .*kettle.* \(pour out \d+ ml\)$/i);
  expect(offered.command).toEqual({ kind: 'provisions.empty', actorId: s.playerId, data: { itemId: kettle.id } });
  expect(parseText('empty kettle', o)).toEqual(offered.command);
  expect(parseText('pour out kettle', o)).toEqual(offered.command);
  expect(HELP).toMatch(/empty <canteen\/kettle>/);
  const weight = load(s).weightG;
  const poured = required(kettle.waterMl);
  const r = ask(s, 'empty kettle');
  expect(r.ok, r.reason).toBe(true);
  expect(required(sim.world.items.stacks[kettle.id]).waterMl).toBe(0);
  expect(load(s).weightG).toBe(weight - poured);
  expect(r.observation.events.some((e) => /poured out .*kettle.* \(\d+ ml\)/i.test(e.summary))).toBe(true);
  // Dry now: the offer is gone, and the words still get a plain reason.
  expect(s.observe().actions.some((a) => a.id === `empty:${kettle.id}`)).toBe(false);
  const again = ask(s, 'empty kettle');
  expect(again.ok).toBe(false);
  expect(again.reason).toMatch(/is already empty/);
  expect(parseText('empty', s.observe())).toMatch(/^Empty what\?/);
  expect(parseText('empty zeppelin', s.observe())).toMatch(/You carry nothing called/);
});

it('a character over the move limit is told how to lighten the pack, including pouring water out', () => {
  const s = loadedAtCreek(0);
  const sim = simOf(s);
  for (const st of vesselsOf(s)) st.waterMl = 500;
  items.createStack(sim.world, makeContext(sim.world, sim.content, []), 'cornmeal', 6, items.carriedBy(s.playerId));
  const r = ask(s, 'go Pratt');
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/You cannot move: your load is \d+%.*, or empty a vessel$/);
  expect(ask(s, 'empty canteen').ok).toBe(true);
});

// --- 2. the collapse forecast ---------------------------------------------------------------------

function alone(sim: Sim, id: ActorId) {
  const a = required(sim.world.actors[id]);
  const place = required(sim.world.index.placeByDef.lantern_coulee_upper);
  a.placeId = place;
  for (const other of idsOf<ActorId>(sim.world.actors)) {
    const actor = required(sim.world.actors[other]);
    if (other !== id && actor.placeId === place)
      actor.placeId = required(sim.world.households[actor.householdId]).homePlaceId;
  }
  return place;
}

/**
 * Drives the sim's real survivalHour with the need falling by `delta` an hour (as the needs system
 * would leave it), and returns the hour of the first Fortitude save against `ruleId`, or null.
 */
function firstSaveInSim(c: { ruleId: string; value: number; delta: number; hours: number; tempF?: number }): {
  sim: Sim;
  id: ActorId;
  step: number | null;
} {
  const sim = simFor({ seed: 42 });
  const id = actorByKey(sim, 'joel_pike');
  const place = alone(sim, id);
  const rule = required(sim.content.survival_rules[c.ruleId]);
  const n = required(sim.world.needs.byActor[id]);
  n.values = { hunger: 1000, thirst: 1000, warmth: 1000, rest: 1000 };
  const survival = required(needs.survivalOf(sim.world, sim.content, id));
  survival.hours[rule.id] = c.hours;
  if (c.tempF !== undefined) sim.world.needs.placeTempF = { ...sim.world.needs.placeTempF, [place]: c.tempF };
  for (let step = 1; step <= 400; step++) {
    n.values[rule.need] = Math.max(0, Math.min(1000, c.value + step * c.delta));
    const seen = sim.world.log.lastId;
    survivalHour(sim.world, makeContext(sim.world, sim.content, []));
    sim.world.time = asGameMinute(sim.world.time + 60);
    if (
      sim.world.log.events.some(
        (e) => e.id > seen && e.kind === 'needs.survival_check' && e.data.actorId === id && e.data.cause === rule.name,
      )
    )
      return { sim, id, step };
  }
  return { sim, id, step: null };
}

it('the collapse forecast agrees with the sim hour for hour: kept hours, decay, recovery threshold, heat', () => {
  const cases = [
    // The review's case: Thirst 50, 11 hours already on the counter: the save rolls as it runs out.
    { ruleId: 'dehydration', value: 50, delta: -56, hours: 11 },
    { ruleId: 'dehydration', value: 50, delta: -56, hours: 0 },
    { ruleId: 'dehydration', value: 0, delta: -10, hours: 0 },
    { ruleId: 'dehydration', value: 0, delta: -10, hours: 30 },
    // Above the recovery threshold the counter shrinks, then is kept below it while the need runs down.
    { ruleId: 'dehydration', value: 290, delta: -56, hours: 20 },
    { ruleId: 'dehydration', value: 150, delta: -10, hours: 9 },
    { ruleId: 'hypothermia', value: 120, delta: -25, hours: 3 },
    { ruleId: 'starvation', value: 271, delta: -30, hours: 0 },
    { ruleId: 'starvation', value: 80, delta: -30, hours: 100 },
    // Heat counts whenever Thirst is below the recovery threshold, not only when it is empty.
    { ruleId: 'heatstroke', value: 250, delta: -30, hours: 0, tempF: 100 },
    { ruleId: 'heatstroke', value: 120, delta: -30, hours: 3, tempF: 100 },
  ];
  for (const c of cases) {
    const { sim, id, step } = firstSaveInSim(c);
    const rule = required(sim.content.survival_rules[c.ruleId]);
    // Rebuild the starting state the forecast should be asked about.
    const fresh = simFor({ seed: 42 });
    const fid = actorByKey(fresh, 'joel_pike');
    const place = alone(fresh, fid);
    required(needs.survivalOf(fresh.world, fresh.content, fid)).hours[rule.id] = c.hours;
    if (c.tempF !== undefined) fresh.world.needs.placeTempF = { ...fresh.world.needs.placeTempF, [place]: c.tempF };
    const f = needs.collapseForecast(fresh.world, fresh.content, fid, rule, c.value, c.delta);
    expect(f.reachable, JSON.stringify(c)).toBe(true);
    expect(f.firstSaveHours, JSON.stringify(c)).toBe(step);
    expect(f.medianHours).toBeGreaterThanOrEqual(f.soonestHours);
    expect(sim.world.actors[id]?.alive).toBe(true);
  }
  // A need that is rising never rolls a save: the forecast has nothing to promise.
  const rising = firstSaveInSim({ ruleId: 'dehydration', value: 0, delta: 30, hours: 3 });
  expect(rising.step).toBeNull();
  const sim = simFor({ seed: 42 });
  const id = actorByKey(sim, 'joel_pike');
  const rule = required(sim.content.survival_rules.dehydration);
  expect(needs.collapseForecast(sim.world, sim.content, id, rule, 0, 30).reachable).toBe(false);
});

it('the warning counts hours already on the counter instead of promising a fresh grace period', () => {
  const s = create();
  const sim = simOf(s);
  const id = s.playerId;
  const n = required(sim.world.needs.byActor[id]);
  required(sim.world.actors[id]).placeId = placeNamed(s, 'East Bluff').id;
  n.values.thirst = 50;
  required(needs.survivalOf(sim.world, sim.content, id)).hours.dehydration = 11;
  const warning = required(
    required(needs.survivalWarnings(sim.world, sim.content, id).find((w) => /collapse from thirst/.test(w))),
  );
  expect(warning).toMatch(/thirst runs out in about 1 hour/);
  expect(warning).toMatch(/11 hours of earlier thirst still count/);
  expect(warning).toMatch(/the first Fortitude save is rolled in that same hour/);
  expect(warning).not.toMatch(/then 12 hours before the first Fortitude save/);
  // And a fresh counter still gets its grace, one hour shorter than the old arithmetic claimed.
  required(needs.survivalOf(sim.world, sim.content, id)).hours.dehydration = 0;
  expect(needs.survivalWarnings(sim.world, sim.content, id).join(' ')).toMatch(
    /thirst runs out in about 1 hour.*; then 11 hours before the first Fortitude save/,
  );
});

// --- 3. winter freight ----------------------------------------------------------------------------

it('reduced winter freight carries its remainder: kettles and firewood still arrive, billed by the unit', () => {
  const sim = simFor({ seed: 42 });
  const w = sim.world;
  w.provisions.settings.npcBuying = false;
  w.provisions.settings.autoRations = false;
  for (const a of Object.values(w.actors)) a.alive = false;
  const store = required(Object.values(w.provisions.stores).find((st) => st.restockId === 'pratt_wholesale'));
  const restock = required(sim.content.restocks?.pratt_wholesale);
  expect(restock.river_closed_pct).toBe(15);
  const defs = ['camp_kettle_pair', 'firewood_armload', 'hardtack'];
  for (const st of Object.values(w.items.stacks))
    if (st.location.kind === 'place' && st.location.placeId === store.placeId && defs.includes(st.defId))
      delete w.items.stacks[st.id];
  const target = (defId: string) => required(restock.lines.find((l) => l.item === defId)).target_qty;
  expect(Math.floor((target('camp_kettle_pair') * 15) / 100)).toBe(0); // the old rounding: never
  const delivered: Record<string, number> = {};
  const stockAt = (defId: string) =>
    Object.values(w.items.stacks)
      .filter((st) => st.location.kind === 'place' && st.location.placeId === store.placeId && st.defId === defId)
      .reduce((n, st) => n + st.qty, 0);
  let cash = provisions.countyCash(w);
  let owedSeen = 0;
  const firstWinterOwed: number[] = [];
  for (let day = 246; day <= 363; day += 3) {
    w.time = asGameMinute(day * 1440);
    const events: Array<{ kind: string; data: Record<string, unknown> }> = [];
    provisions.provisionsSystem(
      w,
      makeContext(w, sim.content, [], (e) => events.push(e)),
    );
    const restocks = events.filter((e) => e.kind === 'provisions.restock' && e.data.placeId === store.placeId);
    let paid = 0;
    for (const e of restocks) {
      const d = e.data as { defId: string; qty: number; costCents: number; cashPaidCents: number };
      expect(Number.isInteger(d.qty) && d.qty > 0).toBe(true);
      // Charged for the whole units that arrived, at the wholesale price, and nothing for the fraction.
      const unit = Math.round(((sim.content.items[d.defId]?.value_cents ?? 0) * restock.wholesale_pct) / 100);
      expect(d.costCents).toBe(unit * d.qty);
      delivered[d.defId] = (delivered[d.defId] ?? 0) + d.qty;
      paid += d.cashPaidCents;
    }
    for (const defId of defs) expect(stockAt(defId)).toBeLessThanOrEqual(target(defId));
    // Conservation: the county's cash fell by exactly what the wholesaler was paid.
    const after = provisions.countyCash(w);
    expect(cash - after).toBe(paid);
    cash = after;
    for (const hundredths of Object.values(store.freightOwed ?? {})) {
      expect(Number.isInteger(hundredths) && hundredths > 0 && hundredths < 100).toBe(true);
      owedSeen++;
    }
    if (calendarAt(w.time).month === 12 && firstWinterOwed.length < 3)
      firstWinterOwed.push(store.freightOwed?.camp_kettle_pair ?? 0);
  }
  expect(delivered.camp_kettle_pair).toBe(target('camp_kettle_pair'));
  expect(delivered.firewood_armload).toBe(target('firewood_armload'));
  expect(delivered.hardtack).toBeGreaterThan(0);
  expect(owedSeen).toBeGreaterThan(0);
  // 4 kettles x 15% = 0.6 of one: 60 owed, then 120 -> one arrives and 20 stays owed.
  expect(firstWinterOwed.slice(0, 2)).toEqual([60, 20]);
  expect(findNonIntegers(w)).toEqual([]);
});

it('open water clears what the ice season owed: full loads, no stored fraction', () => {
  const sim = simFor({ seed: 42 });
  const w = sim.world;
  w.provisions.settings.npcBuying = false;
  for (const a of Object.values(w.actors)) a.alive = false;
  const store = required(Object.values(w.provisions.stores).find((st) => st.restockId === 'pratt_wholesale'));
  for (const st of Object.values(w.items.stacks))
    if (st.location.kind === 'place' && st.location.placeId === store.placeId && st.defId === 'camp_kettle_pair')
      delete w.items.stacks[st.id];
  store.freightOwed = { camp_kettle_pair: 60 };
  w.time = asGameMinute(120 * 1440); // July
  expect(calendarAt(w.time).month).toBe(7);
  const events: Array<{ kind: string; data: Record<string, unknown> }> = [];
  provisions.provisionsSystem(
    w,
    makeContext(w, sim.content, [], (e) => events.push(e)),
  );
  const kettles = events.find((e) => e.kind === 'provisions.restock' && e.data.defId === 'camp_kettle_pair');
  expect(kettles?.data.qty).toBe(4);
  expect(store.freightOwed).toBeUndefined();
});

// --- 4. the last partial serving ----------------------------------------------------------------------

it('the last 200 ml is a drink: offered with its amount, parsed, drunk; nothing left says why not', () => {
  const s = create();
  const sim = simOf(s);
  ask(s, 'standing drink off');
  required(sim.world.actors[s.playerId]).placeId = placeNamed(s, 'East Bluff').id;
  const vessels = vesselsOf(s);
  for (const v of vessels) v.waterMl = 0;
  required(vessels[0]).waterMl = 200;
  const o = s.observe();
  const drink = required(o.actions.find((a) => a.id === 'drink'));
  expect(drink.command).toEqual({ kind: 'provisions.drink', actorId: s.playerId, data: { ml: 200 } });
  expect(drink.label).toBe('Drink water (200 ml, all that is left)');
  expect(parseText('drink', o)).toEqual(drink.command);
  const thirst = needs.needValue(sim.world, s.playerId, 'thirst');
  const r = ask(s, 'drink');
  expect(r.ok, r.reason).toBe(true);
  expect(carriedWater(s).reduce((n, ml) => n + ml, 0)).toBe(0);
  expect(needs.needValue(sim.world, s.playerId, 'thirst')).toBeGreaterThan(thirst);
  // Dry: no offer, and the refusal is the old plain one (empty vessels, no spring here).
  expect(s.observe().actions.some((a) => a.id === 'drink')).toBe(false);
  expect(parseText('drink', s.observe())).toMatch(/empty, and there is no spring, creek or ford here/);
  // 700 ml is still a 500 ml drink, said as such.
  required(vessels[0]).waterMl = 700;
  expect(required(s.observe().actions.find((a) => a.id === 'drink')).label).toBe('Drink water (500 ml)');
  // At a spring the water is raw and the amount is the full drink.
  required(sim.world.actors[s.playerId]).placeId = placeNamed(s, 'Lantern Spring').id;
  expect(required(s.observe().actions.find((a) => a.id === 'drink')).label).toMatch(
    /^Drink from Lantern Spring \(raw water, 500 ml\)$/,
  );
});
