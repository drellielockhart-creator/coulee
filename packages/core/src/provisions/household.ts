/** Household-scoped daily ration/domestic kernel; shared with the regional daily scheduler. */

import { term } from '../explain.ts';
import type { HouseholdId } from '../ids.ts';
import { authorizeAct } from '../psyche/api.ts';
import { claimHouseholdEconomyDay, type ProcessingOwner } from '../region/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { replenishDomestic } from './economy.ts';
import { mealExplain, membersOf } from './meals.ts';
import { planReadiness } from './planner.ts';
import { RATION_RESTORE_DAYS, RATION_STEPS } from './rules.ts';

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
  const members = membersOf(world, { householdId });
  replenishDomestic(world, ctx, householdId);
  if (
    !world.provisions.settings.autoRations ||
    !members.length ||
    !authorizeAct(world, household.headId, { kind: 'consequential' }, { kind: 'own' }).ok
  )
    return;
  // The ration decision only compares against its thresholds, so project only as far as can matter:
  // at full rations the question is "below the first cut?"; on short rations, "back above restore?".
  const firstCut = Math.max(...RATION_STEPS.map((s) => s.belowDays));
  // At full rations no event carries the figure and every cut is `days < firstCut`, so a
  // firstCut-day projection decides identically. Restoring keeps the extra day: the
  // "Full rations restored" Explain prints the projected days.
  const horizon = h.rationPct >= 100 ? firstCut : RATION_RESTORE_DAYS + 1;
  const readiness = planReadiness(world, ctx.content, { householdId }, ctx.now, horizon, false);
  const step = RATION_STEPS.find((s) => readiness.daysOfFoodTenths < s.belowDays * 10);
  const pct = step
    ? Math.min(h.rationPct, step.pct)
    : readiness.daysOfFoodTenths >= RATION_RESTORE_DAYS * 10
      ? 100
      : h.rationPct;
  if (pct < h.rationPct || (readiness.daysOfFoodTenths < 40 && h.lastShortageDay !== ctx.cal.dayIndex)) {
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
}

/** Owner-scoped physical household pass: meals/preparation/storage, production and transfers. */
export { provisionsSystem as householdProcessingHour } from './system.ts';
