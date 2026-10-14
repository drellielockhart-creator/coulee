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
import { applyRations, proposeProvisionUrges } from '../../core/src/provisions/api.ts';
import { restoreTopUpKcal } from '../../core/src/provisions/household.ts';
import { holderStacks } from '../../core/src/provisions/meals.ts';
import { planReadiness } from '../../core/src/provisions/planner.ts';
import { RATION_LEASE, RATION_RESTORE_DAYS, RATION_STEPS, SHOPPING } from '../../core/src/provisions/rules.ts';
import { makeContext, runHours, type Sim } from '../../core/src/sim/sim.ts';
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

  // Ellie, 2026-10-14: short rations go back to full only if the larder lasts the restore
  // threshold at FULL rations; judged at the cut ration, a restored household was cut again.
  describe('a return to full rations is judged at full rations', () => {
    const setup = () => {
      const sim = simFor({ seed: 42, hours: 24 });
      const w = sim.world;
      w.provisions.settings.npcBuying = false;
      const hid = household(sim);
      const h = w.provisions.households[hid];
      if (!h) throw new Error('household');
      h.rationPct = 75;
      h.shortageStep = 2;
      const forecast = (qty: number, ration?: number) => {
        stockPantry(sim, hid, { hardtack: qty });
        return withInventoryPass(w, () =>
          planReadiness(w, sim.content, { householdId: hid }, w.time, RATION_RESTORE_DAYS + 1, false, ration),
        ).daysOfFoodTenths;
      };
      return { sim, w, hid, h, forecast };
    };

    it('a larder that covers the restore horizon at 75% but not at full rations stays at 75%', () => {
      const { sim, w, hid, h, forecast } = setup();
      let qty = 10;
      while (forecast(qty) < RATION_RESTORE_DAYS * 10 + 5) qty += 5;
      const full = forecast(qty, 100);
      expect(full).toBeLessThan(RATION_RESTORE_DAYS * 10 - 5);
      expect(forecast(qty)).toBeGreaterThanOrEqual(RATION_RESTORE_DAYS * 10);
      const start = w.log.lastId;
      runHours(sim, 1); // day 1, hour 0
      expect(h.rationPct).toBe(75);
      expect(h.rationRestore).toMatchObject({ day: 1 });
      expect(h.rationRestore?.fullDaysTenths).toBeLessThan(RATION_RESTORE_DAYS * 10);
      expect(
        w.log.events.some((e) => e.id > start && e.kind === 'provisions.rations' && e.data.householdId === hid),
      ).toBe(false);
      // The readout says why rations stayed cut, with the full-ration forecast's figure (P1).
      const r = withInventoryPass(w, () => planReadiness(w, sim.content, { householdId: hid }, w.time, 30, true));
      expect(r.rations?.pct).toBe(75);
      expect(
        r.rations?.explain.terms.some(
          (t) => t.label === 'Days of food at full rations then, tenths' && t.value === h.rationRestore?.fullDaysTenths,
        ),
      ).toBe(true);
      expect(r.warnings.some((line) => line.includes('Rations stay at 75%') && line.includes('at full rations'))).toBe(
        true,
      );
      // The refused restore is a shopping trigger: in store hours the head is sent to top up,
      // though the larder is above the ordinary 21-day trigger.
      runHours(sim, 9);
      expect(h.rationRestore).toBeDefined();
      const head = w.households[hid]?.headId;
      if (head === undefined) throw new Error('head');
      w.provisions.settings.npcBuying = true;
      const urges = proposeProvisionUrges(w, makeContext(w, sim.content, []), head);
      expect(urges.some((u) => u.label.startsWith('Rations stay short until the larder lasts at full rations'))).toBe(
        true,
      );
    });

    it('the top-up target is set in the larder kcal the refusing forecast made too few days of', () => {
      const { w, hid, h } = setup();
      const daily = 5000;
      // A forecast that made 15.0 days of a 60,000 kcal larder: 32 forecast days need 60,000 x 32 / 15 kcal.
      h.rationRestore = { day: 1, fullDaysTenths: 150, larderKcal: 60_000 };
      expect(restoreTopUpKcal(w, hid, daily)).toBe(Math.ceil((SHOPPING.restoreTopUpDays * 60_000 * 10) / 150));
      // Capped at restoreTopUpCapDays of need, and nothing once the household is back on full rations.
      h.rationRestore = { day: 1, fullDaysTenths: 10, larderKcal: 600_000 };
      expect(restoreTopUpKcal(w, hid, daily)).toBe(daily * SHOPPING.restoreTopUpCapDays);
      h.rationPct = 100;
      expect(restoreTopUpKcal(w, hid, daily)).toBeUndefined();
    });

    it('a ration the household sets itself clears the standing forecast and the refused restore', () => {
      const { w, hid, h } = setup();
      h.rationRestore = { day: 1, fullDaysTenths: 250, larderKcal: 100_000 };
      h.rationLease = {
        day: 1,
        untilDay: 5,
        pct: 75,
        daysTenths: 310,
        larderKcal: 100_000,
        kcalPerDay: 4000,
        members: 2,
      };
      const head = w.households[hid]?.headId;
      if (head === undefined) throw new Error('head');
      expect(applyRations(w, head, hid, 90)).toBeNull();
      expect(h.rationPct).toBe(90);
      expect(h.rationRestore).toBeUndefined();
      expect(h.rationLease).toBeUndefined();
    });

    it('a larder that covers the restore horizon at full rations is restored and not cut the next day', () => {
      const { sim, w, hid, h, forecast } = setup();
      let qty = 10;
      while (forecast(qty, 100) < RATION_RESTORE_DAYS * 10 + 5) qty += 5;
      const start = w.log.lastId;
      runHours(sim, 1); // day 1, hour 0
      expect(h.rationPct).toBe(100);
      expect(h.rationRestore).toBeUndefined();
      const restored = w.log.events.find(
        (e) => e.id > start && e.kind === 'provisions.rations' && e.data.householdId === hid,
      );
      expect(
        restored?.explain?.terms.find((t) => t.label === 'Days of food at full rations, tenths')?.value,
      ).toBeGreaterThanOrEqual(RATION_RESTORE_DAYS * 10);
      runHours(sim, 24); // day 2, hour 0
      expect(h.rationPct).toBe(100);
      expect(
        w.log.events.some((e) => e.id > start && e.kind === 'provisions.shortage' && e.data.householdId === hid),
      ).toBe(false);
    });
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
