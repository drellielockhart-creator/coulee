/**
 * Food forecast (2026-10-13): the household ration decision uses the P8 planner with quiet hours
 * between meals, and a forecast with days to spare stands for them (RATION_LEASE).
 * Rationing must still happen when it should, and near the threshold the decision must agree
 * with the planner's hourly readout.
 */
import { describe, expect, it } from 'vitest';
import { asHouseholdId, type HouseholdId } from '../../core/src/ids.ts';
import { deleteStack, pantryOf, stacksDeep, withInventoryPass } from '../../core/src/items/api.ts';
import { newStack } from '../../core/src/items/state.ts';
import { holderStacks } from '../../core/src/provisions/meals.ts';
import { planReadiness } from '../../core/src/provisions/planner.ts';
import { RATION_LEASE, RATION_RESTORE_DAYS, RATION_STEPS } from '../../core/src/provisions/rules.ts';
import { runHours, type Sim } from '../../core/src/sim/sim.ts';
import { simFor } from './helpers.ts';

/** A household of more than one member at a roofed home (a house). */
function household(sim: Sim): HouseholdId {
  const w = sim.world;
  const h = Object.values(w.households).find(
    (x) => x && x.memberIds.length >= 2 && w.places[x.homePlaceId]?.kind === 'house',
  );
  if (!h) throw new Error('no household');
  return asHouseholdId(h.id);
}

/** Replace the pantry's food with `stock` (def id -> units). */
function stockPantry(sim: Sim, hid: HouseholdId, stock: Record<string, number>): void {
  const w = sim.world;
  for (const { stack } of stacksDeep(w, pantryOf(hid)))
    if (w.items.stacks[stack.id] && sim.content.items[stack.defId]?.food) deleteStack(w, stack.id);
  for (const [defId, qty] of Object.entries(stock)) if (qty > 0) newStack(w, defId, qty, pantryOf(hid), w.time);
}

const decision = (days: number, ration: number) => {
  const step = RATION_STEPS.find((s) => days < s.belowDays * 10);
  return step ? Math.min(ration, step.pct) : days >= RATION_RESTORE_DAYS * 10 ? 100 : ration;
};

describe('food forecast: household ration decisions', () => {
  it('a household with clearly insufficient stores cuts rations at day start', () => {
    const sim = simFor({ seed: 42, hours: 24 });
    const w = sim.world;
    const hid = household(sim);
    stockPantry(sim, hid, { hardtack: 3 });
    const start = w.log.lastId;
    runHours(sim, 1); // day 1, hour 0
    const h = w.provisions.households[hid];
    expect(h?.rationPct).toBe(50);
    const cut = w.log.events.find(
      (e) => e.id > start && e.kind === 'provisions.shortage' && e.data.householdId === hid,
    );
    expect(cut?.t).toBe(1440);
    expect(h?.rationLease).toBeUndefined();
  });

  it('a household with ample stores keeps full rations, and the forecast stands for its spare days', () => {
    const sim = simFor({ seed: 42, hours: 24 });
    const w = sim.world;
    const hid = household(sim);
    stockPantry(sim, hid, { hardtack: 400, salt_pork: 60, cornmeal: 200 });
    runHours(sim, 1); // day 1, hour 0
    const h = w.provisions.households[hid];
    expect(h?.rationPct).toBe(100);
    // The decision forecast reached its whole horizon, as the hourly readout does.
    const readout = withInventoryPass(w, () =>
      planReadiness(w, sim.content, { householdId: hid }, w.time, RATION_LEASE.horizonDays, true),
    );
    expect(readout.daysOfFoodTenths).toBe(RATION_LEASE.horizonDays * 10);
    expect(h?.rationLease).toMatchObject({ day: 1, pct: 100, untilDay: 1 + RATION_LEASE.maxDays });
    // The standing forecast is re-checked the moment the larder falls faster than planned.
    runHours(sim, 24);
    expect(h?.rationLease?.day).toBe(1);
    // No errand to the store refills it (a snowed-in household).
    w.provisions.settings.npcBuying = false;
    stockPantry(sim, hid, { hardtack: 3 });
    runHours(sim, 24);
    expect(h?.rationPct).toBe(50);
    expect(h?.rationLease).toBeUndefined();
  });

  it('a household on short rations restores them the day its larder gains enough, despite a standing forecast', () => {
    const sim = simFor({ seed: 42, hours: 24 });
    const w = sim.world;
    w.provisions.settings.npcBuying = false;
    const hid = household(sim);
    const h = w.provisions.households[hid];
    if (!h) throw new Error('household');
    h.rationPct = 75;
    h.shortageStep = 2;
    // A larder lasting 15-25 days at 75%: past the next cut (10 days), short of restoring (30).
    const days = (qty: number) => {
      stockPantry(sim, hid, { hardtack: qty });
      return withInventoryPass(w, () =>
        planReadiness(w, sim.content, { householdId: hid }, w.time, RATION_RESTORE_DAYS + 1, false),
      ).daysOfFoodTenths;
    };
    let qty = 10;
    while (days(qty) < 150) qty += 5;
    expect(days(qty)).toBeLessThan(250);
    runHours(sim, 1);
    // Days to spare before the next cut (10 days at 75%): the forecast stands, rations stay cut.
    expect(h.rationPct).toBe(75);
    expect(h.rationLease).toMatchObject({ day: 1, pct: 75 });
    runHours(sim, 24);
    expect(h.rationLease?.day).toBe(1);
    // A full larder arrives: the next day start re-forecasts and restores full rations.
    stockPantry(sim, hid, { hardtack: 600, salt_pork: 80 });
    runHours(sim, 24);
    expect(h.rationPct).toBe(100);
    expect(w.log.events.some((e) => e.kind === 'provisions.rations' && e.data.householdId === hid)).toBe(true);
  });

  it('a bedridden member does not make a full larder look empty', () => {
    const sim = simFor({ seed: 42, hours: 24 });
    const w = sim.world;
    const h = Object.values(w.households).find(
      (x) => x && x.memberIds.length === 2 && w.places[x.homePlaceId]?.kind === 'house',
    );
    if (!h) throw new Error('no two-person household');
    const hid = asHouseholdId(h.id);
    stockPantry(sim, hid, { hardtack: 300, salt_pork: 40, cornmeal: 150 });
    const sick = h.memberIds[1];
    const needs = sick === undefined ? undefined : w.needs.byActor[sick];
    if (!needs) throw new Error('needs');
    needs.survival = { vigor: 0, wounds: 0, hours: {}, recovering: 0, collapsed: true, stasis: false };
    const [decide, readout] = withInventoryPass(w, () => [
      planReadiness(w, sim.content, { householdId: hid }, w.time, RATION_LEASE.horizonDays, false),
      planReadiness(w, sim.content, { householdId: hid }, w.time, RATION_LEASE.horizonDays, true),
    ]);
    expect(decide?.daysOfFoodTenths).toBeGreaterThanOrEqual(210);
    expect(readout?.daysOfFoodTenths).toBeGreaterThanOrEqual(210);
    expect(decision(decide?.daysOfFoodTenths ?? 0, 100)).toBe(100);
  });

  it('the readout names the standing forecast its household keeps rations on (P1)', () => {
    const sim = simFor({ seed: 42, hours: 24 });
    const w = sim.world;
    const hid = household(sim);
    stockPantry(sim, hid, { hardtack: 400, salt_pork: 60, cornmeal: 200 });
    runHours(sim, 1);
    const lease = w.provisions.households[hid]?.rationLease;
    expect(lease).toBeDefined();
    const r = withInventoryPass(w, () => planReadiness(w, sim.content, { householdId: hid }, w.time, 30, true));
    expect(r.rations?.heldUntilDay).toBe(lease?.untilDay);
    expect(r.rations?.explain.terms.some((t) => t.label === 'Rechecked by day' && t.value === lease?.untilDay)).toBe(
      true,
    );
    expect(r.warnings.some((line) => line.startsWith('Rations held at 100% on the forecast of'))).toBe(true);
  });

  it('near the threshold the decision forecast agrees with the hourly readout', () => {
    const sim = simFor({ seed: 42, hours: 24 });
    const w = sim.world;
    const hid = household(sim);
    // A cooked larder (fire, water, cookware) sized around the first cut at 21 days.
    const members = w.households[hid]?.memberIds.length ?? 0;
    let checked = 0;
    for (const meal of [12, 14, 16, 18]) {
      stockPantry(sim, hid, { cornmeal: meal * members, salt_pork: 4 * members, dried_apples: 3 * members });
      const [decide, readout] = withInventoryPass(w, () => [
        planReadiness(w, sim.content, { householdId: hid }, w.time, 36, false).daysOfFoodTenths,
        planReadiness(w, sim.content, { householdId: hid }, w.time, 36, true).daysOfFoodTenths,
      ]);
      if (readout < 150 || readout > 280) continue;
      checked++;
      expect(Math.abs((decide ?? 0) - (readout ?? 0))).toBeLessThanOrEqual(10);
      expect(decision(decide ?? 0, 100)).toBe(decision(readout ?? 0, 100));
    }
    expect(checked).toBeGreaterThan(0);
    expect(holderStacks(w, { householdId: hid }).length).toBeGreaterThan(0);
  });
});
