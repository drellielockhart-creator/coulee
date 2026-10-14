/** Paid labor is a claim on an employer's existing cash, never a money source. */
import { currentActivity, minuteBudget, tacticalPinned } from '../activity/api.ts';
import { term } from '../explain.ts';
import { type ActorId, type HouseholdId, rowsOf } from '../ids.ts';
import { authorizeAct } from '../psyche/api.ts';
import { processesActor, processingActors } from '../region/processing.ts';
import type { SimContext } from '../sim/context.ts';
import { relationshipsOf } from '../social/api.ts';
import type { World } from '../world.ts';
import { cashOf } from './economy.ts';
import { endEmployment, hireOn, hiringAvailability, hiringOffer } from './hiring.ts';
import { mealExplain } from './meals.ts';

export function employerHousehold(world: World, id: ActorId): HouseholdId | null {
  const contract = world.provisions.contracts?.[id];
  if (contract)
    return !contract.ended && contract.endsAt > world.time
      ? (world.actors[contract.employerId]?.householdId ?? null)
      : null;
  const relationship = relationshipsOf(world, id).find((r) => r.kind === 'employer' && r.b === id);
  if (relationship) return world.actors[relationship.a]?.householdId ?? null;
  const workplace = currentActivity(world, id)?.workplaceId;
  const owner = workplace == null ? null : world.provisions.stores[workplace]?.ownerHouseholdId;
  return owner != null && world.households[owner]?.headId !== id ? owner : null;
}
/** One settlement kernel for legacy employment and signed day/week terms. */
export function settleWages(
  world: World,
  ctx: SimContext,
  workerId: ActorId,
  account = world.provisions.employment?.[workerId],
  employerId = world.provisions.contracts?.[workerId]?.employerId,
): void {
  const actor = world.actors[workerId];
  if (!account || !actor || account.earnedCents <= 0) return;
  const payer = world.provisions.households[account.payerId];
  if (!payer) return;
  const purse = employerId === undefined ? 0 : (world.provisions.purses[employerId] ?? 0);
  const cents = Math.min(Math.max(0, payer.cashCents) + purse, account.earnedCents);
  if (cents <= 0 && employerId !== undefined) return;
  const fromPurse = Math.min(purse, cents);
  if (employerId !== undefined) world.provisions.purses[employerId] = purse - fromPurse;
  payer.cashCents -= cents - fromPurse;
  world.provisions.purses[workerId] = (world.provisions.purses[workerId] ?? 0) + cents;
  account.earnedCents -= cents;
  ctx.emit({
    kind: 'provisions.wages',
    data: {
      householdId: actor.householdId,
      actorId: workerId,
      payerHouseholdId: account.payerId,
      cents,
      arrearsCents: account.earnedCents,
    },
    roles: [{ actor: workerId, role: 'beneficiary' }],
    visibility: 'private',
    explain: mealExplain('Employer pays earned wages', [workerId], cents, [
      term('money', 'Employer cash transferred', cents),
      term('debt', 'Unpaid earned wages', account.earnedCents),
    ]),
  });
}
export function employmentHour(world: World, ctx: SimContext): void {
  if (!world.provisions.settings.wages) return;
  world.provisions.employment ??= {};
  const accounts = world.provisions.employment;
  if (ctx.isNewDay && world.provisions.wageArrears) {
    for (const claim of world.provisions.wageArrears)
      if (processesActor(world, claim.workerId) && (claim.pay !== 'weekly' || ctx.cal.weekday === 'sat'))
        settleWages(world, ctx, claim.workerId, claim.account, claim.employerId);
    world.provisions.wageArrears = world.provisions.wageArrears.filter((claim) => claim.account.earnedCents > 0);
  }
  // An unemployed person short of cash may ask a proprietor they encounter that morning.
  // The same executor, consent, terms and refusal cooldown serve commands and autonomous acts.
  if (ctx.cal.hour === 8 && ctx.cal.weekday !== 'sun') {
    const employers = processingActors(world).filter((a) => hiringOffer(world, ctx.content, a.id));
    for (const worker of processingActors(world)) {
      if (
        !worker.alive ||
        cashOf(world, worker.id) >= 300 ||
        employerHousehold(world, worker.id) !== null ||
        employers.some((a) => a.id === worker.id) ||
        !authorizeAct(world, worker.id, { kind: 'hire_on' }, { kind: 'own' }).ok
      )
        continue;
      const employer = employers.find(
        (a) => a.placeId === worker.placeId && !hiringAvailability(world, ctx.content, worker.id, a.id),
      );
      if (employer) hireOn(world, ctx, worker.id, employer.id, 'daily');
    }
  }
  for (const actor of processingActors(world)) {
    if (!actor.alive) continue;
    const contract = world.provisions.contracts?.[actor.id];
    if (contract && !contract.ended && (ctx.now >= contract.endsAt || !world.actors[contract.employerId]?.alive))
      endEmployment(world, ctx, actor.id, 'term_end');
    // An ended or dismissed worker still owns their claim if the employer was short of cash.
    if (contract?.ended && ctx.isNewDay && (contract.pay === 'daily' || ctx.cal.weekday === 'sat'))
      settleWages(world, ctx, actor.id);
    const payerId = employerHousehold(world, actor.id);
    if (payerId === null) continue;
    accounts[actor.id] ??= { payerId, earnedCents: 0, carry: 0, day: ctx.cal.dayIndex, minutes: 0 };
    const account = accounts[actor.id];
    if (!account || account.payerId !== payerId) continue;
    if (ctx.isNewDay && (contract?.pay === 'daily' || ctx.cal.weekday === 'sat')) settleWages(world, ctx, actor.id);
    if (account.day !== ctx.cal.dayIndex) {
      account.day = ctx.cal.dayIndex;
      account.minutes = 0;
    }
    const state = currentActivity(world, actor.id);
    const activity = state?.activityId ? ctx.content.activities[state.activityId] : undefined;
    if (tacticalPinned(world, actor.id)) continue;
    if (state?.travel || state?.workplaceId !== actor.placeId || !activity?.tags.includes('labor')) continue;
    if (
      contract &&
      (contract.ended ||
        state.activityId !== 'work' ||
        ctx.now < contract.startedAt ||
        // A full-hour signing spends the hour; a sub-hour signing (short act) leaves the rest
        // of the hour workable, and the minute ledger below pays only those minutes.
        (ctx.now === contract.startedAt && minuteBudget(world, actor.id).spent === 0) ||
        ctx.cal.weekday === 'sun' ||
        ctx.cal.hour < contract.fromHour ||
        ctx.cal.hour >= contract.toHour)
    )
      continue;
    const dayMinutes = (contract?.hours ?? 8) * 60;
    const minutes = Math.max(0, Math.min(minuteBudget(world, actor.id).remaining, dayMinutes - account.minutes));
    const numerator =
      minutes * (contract?.dailyCents ?? ctx.content.occupations[actor.occupationId]?.wage_cents_per_day ?? 0) +
      account.carry;
    account.earnedCents += Math.floor(numerator / dayMinutes);
    account.carry = numerator % dayMinutes;
    account.minutes += minutes;
    // Day labor pays as soon as the agreed day has been worked, or when the counter closes.
    if (contract?.pay === 'daily' && (account.minutes >= dayMinutes || ctx.cal.hour + 1 >= contract.toHour))
      settleWages(world, ctx, actor.id);
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
