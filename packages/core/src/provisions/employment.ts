/** Paid labor is a claim on an employer's existing cash, never a money source. */
import { currentActivity, tacticalPinned } from '../activity/api.ts';
import { term } from '../explain.ts';
import { type ActorId, type HouseholdId, rowsOf } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import { relationshipsOf } from '../social/api.ts';
import type { World } from '../world.ts';
import { mealExplain } from './meals.ts';

function employerHousehold(world: World, id: ActorId): HouseholdId | null {
  const relationship = relationshipsOf(world, id).find((r) => r.kind === 'employer' && r.b === id);
  if (relationship) return world.actors[relationship.a]?.householdId ?? null;
  const workplace = currentActivity(world, id)?.workplaceId;
  const owner = workplace == null ? null : world.provisions.stores[workplace]?.ownerHouseholdId;
  return owner != null && world.households[owner]?.headId !== id ? owner : null;
}
export function employmentHour(world: World, ctx: SimContext): void {
  if (!world.provisions.settings.wages) return;
  world.provisions.employment ??= {};
  const accounts = world.provisions.employment;
  for (const actor of rowsOf(world.actors)) {
    if (!actor.alive) continue;
    const payerId = employerHousehold(world, actor.id);
    if (payerId === null) continue;
    const payer = world.provisions.households[payerId];
    if (!payer) continue;
    accounts[actor.id] ??= { payerId, earnedCents: 0, carry: 0, day: ctx.cal.dayIndex, minutes: 0 };
    const account = accounts[actor.id];
    if (!account) continue;
    // Claims retain their named debtor. Changing employment needs a settlement first.
    if (account.payerId !== payerId) continue;
    if (ctx.isNewDay && ctx.cal.weekday === 'sat' && account.earnedCents > 0) {
      const cents = Math.min(payer.cashCents, account.earnedCents);
      payer.cashCents -= cents;
      world.provisions.purses[actor.id] = (world.provisions.purses[actor.id] ?? 0) + cents;
      account.earnedCents -= cents;
      ctx.emit({
        kind: 'provisions.wages',
        data: {
          householdId: actor.householdId,
          actorId: actor.id,
          payerHouseholdId: payerId,
          cents,
          arrearsCents: account.earnedCents,
        },
        roles: [{ actor: actor.id, role: 'beneficiary' }],
        visibility: 'private',
        explain: mealExplain('Employer pays earned wages', [actor.id], cents, [
          term('money', 'Employer cash transferred', cents),
          term('debt', 'Unpaid earned wages', account.earnedCents),
        ]),
      });
    }
    if (account.day !== ctx.cal.dayIndex) {
      account.day = ctx.cal.dayIndex;
      account.minutes = 0;
    }
    const state = currentActivity(world, actor.id);
    const activity = state?.activityId ? ctx.content.activities[state.activityId] : undefined;
    if (tacticalPinned(world, actor.id)) continue;
    if (state?.travel || state?.workplaceId !== actor.placeId || !activity?.tags.includes('labor')) continue;
    const minutes = Math.min(60, 480 - account.minutes);
    const numerator = minutes * (ctx.content.occupations[actor.occupationId]?.wage_cents_per_day ?? 0) + account.carry;
    account.earnedCents += Math.floor(numerator / 480);
    account.carry = numerator % 480;
    account.minutes += minutes;
  }
}
/** County cash, excluding claims on money (tabs and wages owed). */
export function countyCash(world: World): number {
  return (
    rowsOf(world.provisions.purses).reduce((n, c) => n + c, 0) +
    rowsOf(world.provisions.households).reduce((n, h) => n + h.cashCents, 0) +
    rowsOf(world.provisions.stores).reduce((n, s) => n + s.tillCents, 0)
  );
}
