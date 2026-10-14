/** Household-scoped daily ration/domestic kernel; shared with the regional daily scheduler. */

import { term } from '../explain.ts';
import type { HouseholdId } from '../ids.ts';
import { authorizeAct } from '../psyche/api.ts';
import { claimHouseholdEconomyDay, type ProcessingOwner } from '../region/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { larderKcal, replenishDomestic } from './economy.ts';
import { mealExplain, membersOf } from './meals.ts';
import { planReadiness } from './planner.ts';
import { RATION_LEASE, RATION_RESTORE_DAYS, RATION_STEPS, SHORTAGE_NOTICE_DAYS } from './rules.ts';

/** Canonical day-start work. Exactly once in regional worlds, including save/load and promotion.
 * Both schedulers must use this entry point; the receipt checks the active household owner before drawing any stock. */
export function householdEconomyDay(
  world: World,
  ctx: SimContext,
  householdId: HouseholdId,
  owner: ProcessingOwner = 'hourly',
): void {
  const household = world.households[householdId];
  if (!household || !world.provisions.households[householdId]) return;
  if (!claimHouseholdEconomyDay(world, householdId, ctx.now, owner)) return;
  const h = world.provisions.households[householdId];
  if (!h) return;
  replenishDomestic(world, ctx, householdId);
  decideRations(world, ctx, householdId);
}

/** The day's ration decision: the P8 forecast, or the standing of the last one (RATION_LEASE). */
function decideRations(world: World, ctx: SimContext, householdId: HouseholdId): void {
  const household = world.households[householdId];
  const h = world.provisions.households[householdId];
  if (!household || !h) return;
  const members = membersOf(world, { householdId });
  if (
    !world.provisions.settings.autoRations ||
    !members.length ||
    !authorizeAct(world, household.headId, { kind: 'consequential' }, { kind: 'own' }).ok
  )
    return;
  // The ration decision only compares against its thresholds: at full rations the question is
  // "below the first cut?"; on short rations, "below the next cut, or back above restore?".
  const day = ctx.cal.dayIndex;
  // A forecast with days to spare before the next cut stands while the larder keeps pace with it
  // (no faster than planned) and, on short rations, gains nothing that could restore them.
  const lease = h.rationLease;
  if (lease) {
    const larder = larderKcal(world, ctx, householdId);
    if (
      lease.pct === h.rationPct &&
      day <= lease.untilDay &&
      lease.members === members.length &&
      larder * 100 >= lease.larderKcal * 100 - (day - lease.day) * lease.kcalPerDay * RATION_LEASE.guardPct &&
      (h.rationPct >= 100 || larder <= lease.larderKcal)
    )
      return;
    delete h.rationLease;
  }
  // Full rations look past the first cut, so a forecast with days to spare can stand for them.
  // Restoring projects one day past the threshold: the "Full rations restored" Explain prints it.
  const before = h.rationPct;
  const horizon = before >= 100 ? RATION_LEASE.horizonDays : RATION_RESTORE_DAYS + 1;
  const readiness = planReadiness(world, ctx.content, { householdId }, ctx.now, horizon, false);
  const step = RATION_STEPS.find((s) => readiness.daysOfFoodTenths < s.belowDays * 10);
  const pct = step
    ? Math.min(h.rationPct, step.pct)
    : readiness.daysOfFoodTenths >= RATION_RESTORE_DAYS * 10
      ? 100
      : h.rationPct;
  if (
    pct < h.rationPct ||
    (readiness.daysOfFoodTenths < SHORTAGE_NOTICE_DAYS * 10 && h.lastShortageDay !== ctx.cal.dayIndex)
  ) {
    h.lastShortageDay = ctx.cal.dayIndex;
    ctx.emit({
      kind: 'provisions.shortage',
      data: { householdId, daysOfFoodTenths: readiness.daysOfFoodTenths, rationPct: pct },
      roles: members.map((actor) => ({ actor, role: 'participant' })),
      visibility: 'private',
      explain: mealExplain(
        'Larder horizon and ration cut',
        members,
        pct,
        [term('food', 'Days of food tenths', readiness.daysOfFoodTenths), term('policy', 'Ration percent', pct)],
        'rations_cut',
      ),
    });
  }
  if (pct > h.rationPct)
    ctx.emit({
      kind: 'provisions.rations',
      data: { actorId: household.headId, householdId, rationPct: pct },
      roles: members.map((actor) => ({ actor, role: 'participant' })),
      visibility: 'private',
      explain: mealExplain(
        'Full rations restored',
        members,
        pct,
        [term('food', 'Days of food tenths', readiness.daysOfFoodTenths)],
        'restored',
      ),
    });
  h.rationPct = pct;
  h.shortageStep = pct === 100 ? 0 : pct === 90 ? 1 : pct === 75 ? 2 : 3;
  // Only a forecast made at the ration it leaves in place can stand for it (a restore was judged
  // at the cut ration). It stands until the next cut, or the daily shortage notice, could fall due.
  const nextCut = Math.max(SHORTAGE_NOTICE_DAYS, ...RATION_STEPS.filter((s) => s.pct < pct).map((s) => s.belowDays));
  const spare = Math.min(
    RATION_LEASE.maxDays,
    Math.floor(readiness.daysOfFoodTenths / 10) - nextCut - RATION_LEASE.safetyDays,
  );
  if (pct === before && spare > 0)
    h.rationLease = {
      day,
      untilDay: day + spare,
      pct,
      larderKcal: larderKcal(world, ctx, householdId),
      kcalPerDay: readiness.kcalPerDay,
      members: members.length,
    };
}

/** Owner-scoped physical household pass: meals/preparation/storage, production and transfers. */
export { provisionsSystem as householdProcessingHour } from './system.ts';
