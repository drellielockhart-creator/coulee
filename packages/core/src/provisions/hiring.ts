/** Hiring is a conversation between ordinary actors, backed by a finite business demand. */

import { currentActivity, setWorkplace } from '../activity/api.ts';
import type { ContentBundle } from '../content.ts';
import { term } from '../explain.ts';
import { type ActorId, rowsOf } from '../ids.ts';
import { authorizeAct, commandBasis } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import { interactionAvailability, opinionOf, reasonContribution, reasonsOf } from '../social/api.ts';
import { calendarAt, yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import { cashOf } from './economy.ts';
import { employerHousehold, settleWages } from './employment.ts';
import type { EmploymentContract } from './state.ts';

export function activeEmployment(world: World, id: ActorId): EmploymentContract | null {
  const c = world.provisions?.contracts?.[id];
  return c && !c.ended && c.endsAt > world.time ? c : null;
}

/** Minutes already credited on this workday, for the shared activity scheduler. */
export function employmentDayMinutes(world: World, id: ActorId, day: number): number {
  const account = world.provisions.employment?.[id];
  return account?.day === day ? account.minutes : 0;
}

/** A proprietor's own workplace (never another farmer's first matching field). */
export function hiringOffer(world: World, content: ContentBundle, employerId: ActorId) {
  const employer = world.actors[employerId];
  if (!employer?.alive || world.households[employer.householdId]?.headId !== employerId) return null;
  const workplaceId = currentActivity(world, employerId)?.workplaceId;
  if (workplaceId == null) return null;
  const place = world.places[workplaceId];
  const month = calendarAt(world.time).month;
  for (const rule of Object.values(content.hiringRules ?? {}).sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )) {
    if (
      !rule.employer_occupations.includes(employer.occupationId) ||
      !rule.months.includes(month) ||
      !place?.tags.includes(rule.workplace_tag)
    )
      continue;
    const hired = rowsOf(world.provisions.contracts ?? {}).filter(
      (c) => c.employerId === employerId && !c.ended && c.endsAt > world.time,
    ).length;
    return { rule, workplaceId, hands: Math.max(0, rule.hands - hired) };
  }
  return null;
}

export function hiringAvailability(
  world: World,
  content: ContentBundle,
  workerId: ActorId,
  employerId: ActorId,
): string | null {
  if (workerId === employerId) return 'You cannot hire yourself';
  const worker = world.actors[workerId];
  if (!worker || yearsBetween(worker.born, world.time) < 16) return 'Hiring on requires an adult worker';
  if (activeEmployment(world, workerId) || employerHousehold(world, workerId) !== null)
    return 'Already employed; quit before hiring on elsewhere';
  if (!hiringOffer(world, content, employerId)) return 'This employer has no seasonal hiring business';
  return interactionAvailability(world, content, workerId, employerId, 'chat').reason ?? null;
}

export function hireOn(
  world: World,
  ctx: SimContext,
  workerId: ActorId,
  employerId: ActorId,
  pay: 'daily' | 'weekly',
): boolean {
  if (
    !authorizeAct(
      world,
      workerId,
      { kind: 'hire_on', targetId: employerId },
      commandBasis(ctx, workerId, ['provisions.hire_on']),
    ).ok
  )
    return false;
  const previous = world.provisions.contracts?.[workerId];
  if (previous && !previous.ended && previous.endsAt <= ctx.now) endEmployment(world, ctx, workerId, 'term_end');
  const offer = hiringOffer(world, ctx.content, employerId);
  const unavailable = hiringAvailability(world, ctx.content, workerId, employerId);
  const op = opinionOf(world, employerId, workerId);
  // Reputation is only what this employer has heard and believes, not a county mind read.
  const reputation = reasonsOf(world, employerId, workerId)
    .filter((r) => r.cites.kind === 'belief')
    .reduce((n, r) => {
      const d = reasonContribution(world, employerId, workerId, r);
      return n + d.trust + d.respect;
    }, 0);
  const opinion = Math.trunc((op.trust + op.respect + op.affection - reputation) / 15);
  const reputationTerm = Math.max(-10, Math.min(10, Math.trunc(reputation / 15)));
  const cash = cashOf(world, employerId);
  const reserved = [
    ...rowsOf(world.provisions.employment ?? {}),
    ...(world.provisions.wageArrears ?? []).map((c) => c.account),
  ]
    .filter((a) => a.payerId === world.actors[employerId]?.householdId)
    .reduce((n, a) => n + a.earnedCents, 0);
  const promised = rowsOf(world.provisions.contracts ?? {})
    .filter((c) => c.employerId === employerId && !c.ended && c.endsAt > ctx.now)
    .reduce((n, c) => n + c.dailyCents * Math.max(1, Math.ceil((c.endsAt - ctx.now) / 1440)), 0);
  const cost = (offer?.rule.daily_cents ?? 0) * (pay === 'weekly' ? 6 : 1);
  const funded = cash - reserved - promised >= cost;
  const key = `${workerId}:${employerId}`;
  const repeated = world.provisions.hiringAttempts?.[key] === ctx.cal.dayIndex;
  const terms = [
    term('base', 'Ordinary applicant', 8),
    term('opinion', 'Personal opinion', opinion),
    term('reputation', 'Heard reputation', reputationTerm),
    term('business', 'Unfilled extra hands', (offer?.hands ?? 0) * 4),
    term('cash', 'Cash covers offered term after wage debts', funded ? 2 : -20),
  ];
  const total = terms.reduce((n, t) => n + t.value, 0);
  const dc = offer?.rule.dc ?? 10;
  const reason =
    unavailable ??
    (pay !== 'daily' && pay !== 'weekly'
      ? 'Unknown pay term'
      : repeated
        ? 'Already asked this employer today'
        : !authorizeAct(world, employerId, { kind: 'hire', targetId: workerId }, { kind: 'own' }).ok
          ? 'Employer cannot consent without an order'
          : !offer?.hands
            ? 'No extra hands needed'
            : !funded
              ? 'Cannot fund that term from current cash'
              : total < dc
                ? 'Employer declines on opinion and reputation'
                : 'Agreed');
  const accepted = reason === 'Agreed';
  if (!unavailable) {
    world.provisions.hiringAttempts ??= {};
    world.provisions.hiringAttempts[key] = ctx.cal.dayIndex;
  }
  let contract: EmploymentContract | undefined;
  if (accepted && offer) {
    const { rule, workplaceId } = offer;
    const day = ctx.cal.dayIndex + (ctx.cal.weekday === 'sun' || ctx.cal.hour >= rule.to_hour - 1 ? 1 : 0);
    contract = {
      employerId,
      workplaceId,
      previousWorkplaceId: currentActivity(world, workerId)?.workplaceId ?? null,
      dailyCents: rule.daily_cents,
      hours: rule.hours,
      fromHour: rule.from_hour,
      toHour: rule.to_hour,
      pay,
      startedAt: ctx.now,
      endsAt: (day + (pay === 'daily' ? 1 : 7)) * 1440,
    };
    const previousAccount = world.provisions.employment?.[workerId];
    if (previous && previousAccount && previousAccount.earnedCents > 0) {
      world.provisions.wageArrears ??= [];
      world.provisions.wageArrears.push({ workerId, employerId: previous.employerId, account: { ...previousAccount } });
    }
    world.provisions.contracts ??= {};
    world.provisions.contracts[workerId] = contract;
    const payerId = world.actors[employerId]?.householdId;
    world.provisions.employment ??= {};
    if (payerId !== undefined)
      world.provisions.employment[workerId] = {
        payerId,
        earnedCents: 0,
        carry: 0,
        day: ctx.cal.dayIndex,
        minutes: 0,
      };
    setWorkplace(world, workerId, workplaceId);
  }
  ctx.emit({
    kind: 'provisions.hiring',
    data: {
      workerId,
      employerId,
      accepted,
      reason,
      ...(contract
        ? {
            workplaceId: contract.workplaceId,
            dailyCents: contract.dailyCents,
            hours: contract.hours,
            fromHour: contract.fromHour,
            toHour: contract.toHour,
            endsAt: contract.endsAt,
            pay,
          }
        : {}),
    },
    roles: [
      { actor: workerId, role: 'agent' },
      { actor: employerId, role: 'target' },
    ],
    visibility: 'private',
    explain: {
      kind: 'arbitration',
      label: 'Ask for paid work',
      subjects: [workerId, employerId],
      knowledge: 'participants',
      terms: [],
      total: accepted ? 1 : 0,
      outcome: accepted ? 'accepted' : 'refused',
      note: reason,
      children: [
        {
          kind: 'arbitration',
          label: 'Employer assessment',
          subjects: [employerId],
          knowledge: 'self',
          terms,
          total,
          dc: { total: dc, terms: [] },
          outcome: accepted ? 'accepted' : 'refused',
          note: `Cash ${cash} cents; prior wage claims ${reserved} cents; existing commitments ${promised} cents; offered term ${cost} cents`,
        },
      ],
    },
  });
  return accepted;
}

export function endEmployment(
  world: World,
  ctx: SimContext,
  workerId: ActorId,
  reason: 'quit' | 'dismissed' | 'term_end',
): boolean {
  const contract = world.provisions.contracts?.[workerId];
  if (!contract || contract.ended) return false;
  contract.ended = reason;
  settleWages(world, ctx, workerId);
  setWorkplace(world, workerId, contract.previousWorkplaceId);
  ctx.emit({
    kind: 'provisions.employment_ended',
    data: { workerId, employerId: contract.employerId, reason },
    roles: [
      { actor: workerId, role: 'agent' },
      { actor: contract.employerId, role: 'target' },
    ],
    visibility: 'private',
    explain: {
      kind: 'formula',
      label: 'Employment ends; earned wage claim survives',
      subjects: [workerId, contract.employerId],
      knowledge: 'participants',
      terms: [],
      total: world.provisions.employment?.[workerId]?.earnedCents ?? 0,
      outcome: reason,
    },
  });
  return true;
}

export function quitWork(world: World, ctx: SimContext, workerId: ActorId): boolean {
  return (
    authorizeAct(world, workerId, { kind: 'quit' }, commandBasis(ctx, workerId, ['provisions.quit'])).ok &&
    endEmployment(world, ctx, workerId, 'quit')
  );
}
export function dismissWorker(world: World, ctx: SimContext, employerId: ActorId, workerId: ActorId): boolean {
  return (
    world.provisions.contracts?.[workerId]?.employerId === employerId &&
    authorizeAct(
      world,
      employerId,
      { kind: 'dismiss', targetId: workerId },
      commandBasis(ctx, employerId, ['provisions.dismiss']),
    ).ok &&
    endEmployment(world, ctx, workerId, 'dismissed')
  );
}
