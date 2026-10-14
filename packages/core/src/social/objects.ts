/**
 * Object loans and item-specific interactions (13 §6.1 steps 5-7, §6.2). OWNER: module:social.
 *
 * An item interaction carries the urge's `itemId` (and loan `terms`). Before any time is spent,
 * `itemPreflight` checks possession, an open loan, room and terms, and names the reason; the
 * holder then decides by their own arbitration where the def says so (`holderDecision`), or a
 * commanded holder answers a pending request. Only then does the item move (provisions'
 * `moveStack`) and a promise open. Due dates raise a borrower's duty; a missed one is a
 * remembered breach with a restitution grudge, never a theft verdict.
 */
import { isAsleep } from '../activity/api.ts';
import { formGrudge, internProp, observe } from '../belief/api.ts';
import type { InteractionDef } from '../content.ts';
import { noteNudge, windowPickFor } from '../director/api.ts';
import type { Explain } from '../explain.ts';
import { term } from '../explain.ts';
import {
  charmKeepWeight,
  charmTransferred,
  grantLook,
  guiltToward,
  restitutionMade,
  restitutionOwed,
} from '../fae/api.ts';
import type { ActorId, HouseholdId, ItemId, PlaceId } from '../ids.ts';
import { asItemId } from '../ids.ts';
import { carriedBy, moveStack, pantryOf, rootOf, stacksDeep } from '../items/api.ts';
import { cashOf, transferCash } from '../provisions/api.ts';
import { authorizeAct, chosenUrge, driveWeight, normStrength } from '../psyche/api.ts';
import { processesHousehold } from '../region/processing.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { yearsBetween } from '../time.ts';
import type { Terms, UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { addMemory } from './api.ts';
import { addReason, opinionOf } from './opinion.ts';

export interface ObjectLoan {
  id: string;
  itemId: ItemId;
  lenderId: ActorId;
  borrowerId: ActorId;
  lenderHouseholdId: HouseholdId;
  borrowerHouseholdId: HouseholdId;
  at: number;
  dueAt: number;
  use: 'household' | 'any';
  depositCents: number;
  /** Actual receipt; absent on legacy loans whose nominal deposit was not verified. */
  collectedDepositCents?: number;
  rechargeDuty: boolean;
  status: 'open' | 'returned' | 'reclaimed' | 'lost';
  closedAt: number | null;
  breachedAt: number | null;
}
export interface Rota {
  itemId: ItemId;
  a: HouseholdId;
  b: HouseholdId;
  loans: number;
  returned: number;
  breaches: number;
  lastAt: number;
}

const SALT_DECIDE = 0x0b1d;
/** A day's grace after the due time before a breach is remembered. */
const BREACH_GRACE = 1440;

export function loansOf(world: World): ObjectLoan[] {
  return world.social.objectLoans ?? [];
}
/** The open loan of an item, if it is lent out. */
export function openLoanOf(world: World, itemId: ItemId): ObjectLoan | undefined {
  return loansOf(world).find((l) => l.itemId === itemId && l.status === 'open');
}
function rotaKey(itemId: ItemId, a: HouseholdId, b: HouseholdId): string {
  return `${itemId}:${Math.min(a, b)}-${Math.max(a, b)}`;
}
export function rotaOf(world: World, itemId: ItemId, a: HouseholdId, b: HouseholdId): Rota | undefined {
  return world.social.rotas?.[rotaKey(itemId, a, b)];
}

/** The actor has the thing to hand: carrying it, or at home where their household keeps it. */
export function holds(world: World, actorId: ActorId, itemId: ItemId): boolean {
  const stack = world.items.stacks[itemId];
  const a = world.actors[actorId];
  if (!stack || !a) return false;
  const root = rootOf(world, stack);
  if (root.kind === 'actor') return root.actorId === actorId;
  if (root.kind === 'household')
    return root.householdId === a.householdId && world.households[a.householdId]?.homePlaceId === a.placeId;
  return false;
}

/** Validation before any time is spent (13 §6.1 step 5). Null when the act may go ahead. */
export function itemPreflight(
  world: World,
  def: InteractionDef,
  initiatorId: ActorId,
  targetId: ActorId,
  itemId: ItemId | undefined,
  terms: Terms | undefined,
  now: number,
): string | null {
  const spec = def.item;
  if (!spec) return null;
  if (itemId === undefined) return 'Which thing? Name it.';
  const stack = world.items.stacks[itemId];
  if (!stack) return 'That thing is not to be found.';
  const holder = spec.holder === 'initiator' ? initiatorId : targetId;
  const open = openLoanOf(world, itemId);
  const ini = world.actors[initiatorId];
  const tgt = world.actors[targetId];
  if (!ini || !tgt) return 'Nobody to deal with.';
  switch (spec.act) {
    case 'show':
    case 'take':
      return holds(world, holder, itemId) ? null : 'They have not got it with them.';
    case 'loan':
    case 'share': {
      if (!holds(world, holder, itemId))
        return spec.act === 'share' ? 'You have not got it with you.' : 'They have not got it with them.';
      if (open && open.borrowerId === holder) return 'It is lent to them; it is not theirs to lend on.';
      if (open) return 'It is lent out already.';
      if (ini.householdId === tgt.householdId) return 'It is already in the household.';
      if (terms?.kind !== 'loan') return 'A loan needs a day for its return.';
      if (terms.dueAt <= now + 60 || terms.dueAt > now + 30 * 1440)
        return 'The day for its return must be within a month.';
      if (!Number.isInteger(terms.depositCents) || terms.depositCents < 0) return 'The deposit must be whole cents.';
      const borrower = spec.act === 'loan' ? initiatorId : targetId;
      if (cashOf(world, borrower) < terms.depositCents) return 'The borrower cannot afford that deposit.';
      return null;
    }
    case 'return':
      if (!open || open.borrowerHouseholdId !== ini.householdId || open.lenderHouseholdId !== tgt.householdId)
        return 'Nothing of theirs is lent to you.';
      return holds(world, initiatorId, itemId) ? null : 'Bring it with you to give it back.';
    case 'demand':
      if (!open || open.lenderHouseholdId !== ini.householdId || open.borrowerHouseholdId !== tgt.householdId)
        return 'Nothing of yours is lent to them.';
      return holds(world, targetId, itemId) ? null : 'They have not got it with them.';
    case 'restitution': {
      const owed = restitutionOwed(world, itemId, tgt.householdId, initiatorId);
      if (owed <= 0) return 'There is nothing owed them that you know of.';
      return null;
    }
  }
  return null;
}

export interface Decision {
  yes: boolean;
  explain: Explain;
}

/**
 * The holder's own arbitration (13 §6.1 step 4, §5.6): charm_keep (5 × attachment) and want
 * against neighborliness at an observed hunger, trust and affection, and the duty of a rota
 * promise. Attachment is a preference, never a veto: it only weighs. Self-knowledge only.
 */
export function holderDecision(
  world: World,
  ctx: SimContext,
  def: InteractionDef,
  holderId: ActorId,
  askerId: ActorId,
  itemId: ItemId,
): Decision {
  const act = def.item?.act ?? 'show';
  const op = opinionOf(world, holderId, askerId);
  const holder = world.actors[holderId];
  const asker = world.actors[askerId];
  const askerShort = shortOf(world, asker?.householdId);
  const ownShort = shortOf(world, holder?.householdId);
  const keep = charmKeepWeight(world, holderId, itemId);
  const neighborly = normStrength(world, holderId, 'neighborliness');
  const duty = normStrength(world, holderId, 'duty');
  const honesty = normStrength(world, holderId, 'honesty');
  const greed = driveWeight(world, holderId, 'greed');
  const rota = holder && asker ? rotaOf(world, itemId, holder.householdId, asker.householdId) : undefined;
  const promise = rota && rota.returned >= 1 && rota.breaches === 0 ? 300 + duty * 3 : 0;
  const breached = rota && rota.breaches > 0 ? 300 : 0;
  const pro = [
    term('psyche', 'Neighborliness', neighborly * 4),
    term('need', 'They are short of food', askerShort ? 200 : 0),
    term('opinion', 'Trust', op.trust * 3),
    term('opinion', 'Affection', op.affection * 2),
    term('psyche', 'A promise kept before (the rota)', promise),
    // Refusal has costs (wave 6): the keeper's duty-guilt over turning neighbors away.
    term(
      'psyche',
      'Guilt over turning neighbors away',
      act === 'loan' ? guiltToward(world, holderId, askerId, itemId) : 0,
    ),
  ];
  const con = [
    term('psyche', 'Keep it (attachment ×5)', keep),
    term('need', 'Our own bin is low', ownShort ? 200 : 0),
    term('psyche', 'Greed', greed * 2),
    term('opinion', 'They kept it past the day before', breached),
  ];
  if (act === 'show') {
    pro.push(term('psyche', 'Plain courtesy', 200));
    con.splice(1, 3);
  }
  if (act === 'demand') {
    // The borrower decides whether to give it back now: the loan's duty against wanting it.
    pro.splice(
      0,
      pro.length,
      term('psyche', 'Duty to return what was lent', world.fae?.ablation?.loanDuty ?? 300 + duty * 4),
      term('psyche', 'Honesty', honesty * 3),
      term('opinion', 'Trust in the lender', Math.max(0, op.trust) * 2),
    );
  }
  const r = ctx.rng('social', mixKey(holderId, askerId, itemId, hashString32(def.id), SALT_DECIDE));
  const noise = r.int(-60, 60);
  const sum = (ts: typeof pro) => ts.reduce((n, t) => n + t.value, 0);
  const margin = sum(pro) - sum(con) + noise;
  return {
    yes: margin >= 0,
    explain: {
      kind: 'arbitration',
      label: `${def.name}: ${holder ? holder.name.given : holderId} decides`,
      subjects: [holderId],
      knowledge: 'self',
      terms: [...pro, ...con.map((t) => ({ ...t, value: -t.value })), term('psyche', 'Mood of the moment', noise)],
      total: margin,
      outcome: margin >= 0 ? 'yes' : 'no',
    },
  };
}

function shortOf(world: World, hid: HouseholdId | undefined): boolean {
  if (hid === undefined) return false;
  const h = world.provisions.households[hid];
  return !!h && (h.rationPct < 100 || h.shortageStep > 0);
}

/** Apply a successful item act after the decision (13 §6.1 steps 5-6). */
export function applyItemAct(
  world: World,
  ctx: SimContext,
  def: InteractionDef,
  initiatorId: ActorId,
  targetId: ActorId,
  itemId: ItemId,
  terms: Terms | undefined,
  eventId: number,
  witnesses: readonly ActorId[],
  placeId: PlaceId | null,
): void {
  const act = def.item?.act;
  const ini = world.actors[initiatorId];
  const tgt = world.actors[targetId];
  if (!act || !ini || !tgt) return;
  if (itemPreflight(world, def, initiatorId, targetId, itemId, terms, ctx.now) !== null) return;
  const item = { kind: 'item' as const, id: asItemId(itemId) };
  const saw = (who: ActorId, pred: 'has' | 'lent', args: Array<{ kind: 'actor'; id: ActorId } | typeof item>) => {
    observe(world, ctx, who, internProp(world, pred, args), {
      type: 'observation',
      dir: 1,
      sourceId: null,
      eventId: eventId as never,
    });
  };
  const everyone = [initiatorId, targetId, ...witnesses];
  if (act === 'show') {
    grantLook(world, ctx, initiatorId, itemId);
    return;
  }
  if (act === 'loan' || act === 'share') {
    const lender = act === 'loan' ? targetId : initiatorId;
    const borrower = act === 'loan' ? initiatorId : targetId;
    const t = terms?.kind === 'loan' ? terms : null;
    if (!t) return;
    const collected =
      t.depositCents > 0 ? transferCash(world, ctx, borrower, lender, t.depositCents, 'Deposit on a loan', eventId) : 0;
    if (collected !== t.depositCents) return;
    moveStack(world, ctx, itemId, 1, carriedBy(borrower));
    const lenderH = world.actors[lender]?.householdId as HouseholdId;
    const borrowerH = world.actors[borrower]?.householdId as HouseholdId;
    const loan: ObjectLoan = {
      id: `${itemId}:${ctx.now}`,
      itemId,
      lenderId: lender,
      borrowerId: borrower,
      lenderHouseholdId: lenderH,
      borrowerHouseholdId: borrowerH,
      at: ctx.now,
      dueAt: t.dueAt,
      use: t.use,
      depositCents: collected,
      collectedDepositCents: collected,
      rechargeDuty: t.rechargeDuty,
      status: 'open',
      closedAt: null,
      breachedAt: null,
    };
    world.social.objectLoans ??= [];
    world.social.objectLoans.push(loan);
    const key = rotaKey(itemId, lenderH, borrowerH);
    world.social.rotas ??= {};
    const rota: Rota = world.social.rotas[key] ?? {
      itemId,
      a: Math.min(lenderH, borrowerH) as HouseholdId,
      b: Math.max(lenderH, borrowerH) as HouseholdId,
      loans: 0,
      returned: 0,
      breaches: 0,
      lastAt: ctx.now,
    };
    world.social.rotas[key] = rota;
    rota.loans += 1;
    rota.lastAt = ctx.now;
    charmTransferred(world, ctx, itemId, borrower);
    for (const w of everyone) {
      saw(w, 'lent', [{ kind: 'actor', id: lender }, { kind: 'actor', id: borrower }, item]);
      saw(w, 'has', [{ kind: 'actor', id: borrower }, item]);
    }
    ctx.emit({
      kind: 'social.loan_opened',
      ...(placeId !== null ? { place: placeId } : {}),
      visibility: 'witnessed',
      importance: 30,
      roles: [
        { actor: lender, role: 'agent' },
        { actor: borrower, role: 'target' },
        ...witnesses.map((w) => ({ actor: w, role: 'witness' as const })),
      ],
      causes: [eventId as never],
      data: {
        loanId: loan.id,
        itemId,
        lenderId: lender,
        borrowerId: borrower,
        dueAt: t.dueAt,
        text: `${ini.name.given} and ${tgt.name.given} agree: it goes home with ${world.actors[borrower]?.name.given}, to come back by the day agreed.`,
      },
    });
    return;
  }
  if (act === 'return' || act === 'demand') {
    const loan = openLoanOf(world, itemId);
    if (!loan) return;
    const giver = act === 'return' ? initiatorId : targetId;
    const receiver = act === 'return' ? targetId : initiatorId;
    moveStack(world, ctx, itemId, 1, carriedBy(receiver));
    closeLoan(world, ctx, loan, 'returned', eventId, placeId, witnesses, receiver);
    if ((loan.collectedDepositCents ?? 0) > 0)
      transferCash(world, ctx, receiver, giver, loan.collectedDepositCents ?? 0, 'Deposit returned', eventId);
    charmTransferred(world, ctx, itemId, receiver);
    for (const w of everyone) saw(w, 'has', [{ kind: 'actor', id: receiver }, item]);
    return;
  }
  if (act === 'take') {
    moveStack(world, ctx, itemId, 1, carriedBy(initiatorId));
    charmTransferred(world, ctx, itemId, initiatorId);
    return;
  }
  if (act === 'restitution') {
    const owed = restitutionOwed(world, itemId, tgt.householdId, initiatorId);
    let paid = 0;
    // In kind first, from the keeper's household stores; the rest in cash at 5 cents a pound.
    for (const { stack } of stacksDeep(world, pantryOf(ini.householdId))) {
      if (paid >= owed || stack.defId !== 'flour' || stack.id === itemId) continue;
      const n = Math.min(owed - paid, stack.qty - (stack.partial > 0 || (stack.foodPartialPm ?? 0) > 0 ? 1 : 0));
      if (n <= 0) continue;
      moveStack(world, ctx, stack.id, n, pantryOf(tgt.householdId));
      paid += n;
    }
    if (paid < owed) {
      const cents = transferCash(
        world,
        ctx,
        initiatorId,
        targetId,
        (owed - paid) * 5,
        'Restitution for flour taken',
        eventId,
      );
      paid += Math.floor(cents / 5);
    }
    if (paid > 0) restitutionMade(world, ctx, itemId, tgt.householdId, paid, initiatorId, targetId);
  }
}

function closeLoan(
  world: World,
  ctx: SimContext,
  loan: ObjectLoan,
  status: 'returned' | 'reclaimed' | 'lost',
  cause: number | null,
  placeId: PlaceId | null,
  witnesses: readonly ActorId[],
  receiverId: ActorId = loan.lenderId,
  leftAtHouse = false,
): void {
  loan.status = status;
  loan.closedAt = ctx.now;
  const late = ctx.now > loan.dueAt;
  const rota = world.social.rotas?.[rotaKey(loan.itemId, loan.lenderHouseholdId, loan.borrowerHouseholdId)];
  if (rota && status === 'returned') {
    rota.returned += 1;
    rota.lastAt = ctx.now;
  }
  const lender = world.actors[loan.lenderId];
  const borrower = world.actors[loan.borrowerId];
  const receiver = world.actors[receiverId];
  const to =
    receiverId === loan.lenderId || !receiver
      ? (lender?.name.given ?? 'the lender')
      : `${receiver.name.given}, for ${lender?.name.given ?? 'the lender'}`;
  ctx.emit({
    kind: 'social.loan_closed',
    ...(placeId !== null ? { place: placeId } : {}),
    visibility: 'witnessed',
    importance: late ? 30 : 25,
    roles: [
      { actor: loan.borrowerId, role: 'agent' },
      { actor: loan.lenderId, role: 'target' },
      ...witnesses.map((w) => ({ actor: w, role: 'witness' as const })),
    ],
    ...(cause !== null ? { causes: [cause as never] } : {}),
    data: {
      loanId: loan.id,
      itemId: loan.itemId,
      lenderId: loan.lenderId,
      borrowerId: loan.borrowerId,
      status,
      late,
      text: leftAtHouse
        ? `${borrower?.name.given ?? 'The borrower'} leaves it at ${lender?.name.given ?? 'the lender'}'s house, there being nobody to take it${late ? ', late' : ', on the day'}.`
        : `${borrower?.name.given ?? 'The borrower'} brings it back to ${to}${late ? ', late' : ', on the day'}.`,
    },
  });
}

/**
 * Hourly, after everyone has moved: a borrower out on the errand of bringing a due loan back,
 * who finds nobody of the lender's house at home to take it, leaves it with their stores, as
 * neighbors do (13 §6.1 step 7). That closes the loan at this hour; the lender finds it on coming
 * home. Only the borrower's own chosen errand does this, under their own authorization.
 */
export function loansHourly(world: World, ctx: SimContext): void {
  for (const loan of loansOf(world)) {
    if (!processesHousehold(world, loan.borrowerHouseholdId)) continue;
    if (loan.status !== 'open' || ctx.now < loan.dueAt - 720) continue;
    const stack = world.items.stacks[loan.itemId];
    if (!stack) continue;
    const root = rootOf(world, stack);
    if (root.kind !== 'actor') continue;
    const giver = world.actors[root.actorId];
    const home = world.households[loan.lenderHouseholdId]?.homePlaceId;
    if (!giver?.alive || giver.householdId !== loan.borrowerHouseholdId || home === undefined || giver.placeId !== home)
      continue;
    const chosen = chosenUrge(world, giver.id)?.urge;
    const onErrand =
      (chosen?.kind === 'activity' && chosen.activityId === 'visit_kin' && chosen.itemId === loan.itemId) ||
      (chosen?.kind === 'interaction' && chosen.interactionId === 'return_item' && chosen.itemId === loan.itemId);
    if (!onErrand || isAsleep(world, ctx, giver.id)) continue;
    const someoneHome = (world.households[loan.lenderHouseholdId]?.memberIds ?? []).some((m) => {
      const t = world.actors[m];
      return t?.alive === true && t.placeId === home && yearsBetween(t.born, ctx.now) >= 14 && !isAsleep(world, ctx, m);
    });
    if (someoneHome) continue;
    if (!authorizeAct(world, giver.id, { kind: 'consequential' }, { kind: 'own' }).ok) continue;
    moveStack(world, ctx, loan.itemId, 1, pantryOf(loan.lenderHouseholdId));
    closeLoan(world, ctx, loan, 'returned', null, home, [], loan.lenderId, true);
    charmTransferred(world, ctx, loan.itemId, loan.lenderId);
    const lender = world.actors[loan.lenderId];
    const remember = (ownerId: ActorId, who: ActorId, summary: string, source: 'witnessed' | 'inferred') =>
      addMemory(world, ctx, {
        ownerId,
        eventId: null,
        kind: 'repayment',
        at: ctx.now,
        placeId: home,
        roles: [{ who, role: 'agent', conf: 1000 }],
        source: { kind: source },
        emotion: 'gratitude',
        intensity: 25,
        salience: 500,
        confidence: 900,
        rehearsals: 0,
        pinned: false,
        summary,
      });
    remember(
      giver.id,
      giver.id,
      `Left it at ${lender?.name.given ?? 'their'}'s, there being nobody to take it`,
      'witnessed',
    );
    if (lender?.alive)
      remember(lender.id, giver.id, `${giver.name.given} ${giver.name.family} left it back at the house`, 'inferred');
  }
}

/**
 * Daily: a due day passed by a day's grace without return is a breach, remembered once: the
 * lender's Trust −15 reason and a restitution grudge (13 §6.2 opinion defaults). The loan stays
 * open: the thing is still owed.
 */
export function loansDaily(world: World, ctx: SimContext): void {
  for (const loan of loansOf(world)) {
    if (!processesHousehold(world, loan.borrowerHouseholdId)) continue;
    if (loan.status !== 'open' || loan.breachedAt !== null) continue;
    // N6 (Director timing): the breach lands inside its own window, [due + 12 h, due + 3 days].
    const fallback = loan.dueAt + BREACH_GRACE;
    const pick = windowPickFor(
      world,
      'loan_breach',
      loan.borrowerId,
      [loan.borrowerId, loan.lenderId],
      [],
      [loan.dueAt + 720, loan.dueAt + BREACH_GRACE + 2880],
      fallback,
    );
    if (pick.bias && ctx.now >= fallback !== ctx.now >= pick.at)
      noteNudge(world, pick.bias, loan.borrowerId, fallback, pick.at, false, `${loan.id}:${pick.at}`);
    if (ctx.now < pick.at) continue;
    loan.breachedAt = ctx.now;
    const rota = world.social.rotas?.[rotaKey(loan.itemId, loan.lenderHouseholdId, loan.borrowerHouseholdId)];
    if (rota) rota.breaches += 1;
    const borrower = world.actors[loan.borrowerId];
    const lender = world.actors[loan.lenderId];
    if (!borrower?.alive || !lender?.alive) continue;
    const ev = ctx.emit({
      kind: 'social.loan_breached',
      visibility: 'witnessed',
      importance: 40,
      roles: [
        { actor: loan.borrowerId, role: 'agent' },
        { actor: loan.lenderId, role: 'target' },
      ],
      data: {
        loanId: loan.id,
        itemId: loan.itemId,
        lenderId: loan.lenderId,
        borrowerId: loan.borrowerId,
        text: `The day came and went, and ${borrower.name.given} ${borrower.name.family} did not bring it back.`,
      },
    });
    const memoryId = addMemory(world, ctx, {
      ownerId: loan.lenderId,
      eventId: ev as never,
      kind: 'debt',
      at: ctx.now,
      placeId: world.households[loan.lenderHouseholdId]?.homePlaceId ?? null,
      roles: [{ who: loan.borrowerId, role: 'agent', conf: 1000 }],
      source: { kind: 'witnessed' },
      emotion: 'anger',
      intensity: 50,
      salience: 700,
      confidence: 900,
      rehearsals: 0,
      pinned: false,
      summary: `${borrower.name.given} ${borrower.name.family} kept what I lent past the day`,
    });
    addReason(
      world,
      ctx.content,
      loan.lenderId,
      loan.borrowerId,
      {
        label: 'Kept what was lent past the day',
        cites: memoryId !== null ? { kind: 'memory', id: memoryId } : { kind: 'other', strength: 800 },
        delta: { affection: -5, respect: 0, trust: -15, fear: 0 },
        since: ctx.now as never,
      },
      ctx.now as never,
    );
    formGrudge(world, ctx, {
      holderId: loan.lenderId,
      target: { kind: 'actor', id: loan.borrowerId },
      aim: 'restitution',
      intensity: 35,
      label: 'Kept what was lent past the day',
    });
  }
}

/**
 * Loan duties (13 §6.1 step 7): from half a day before the due time the borrower carries a duty
 * to bring it back (to the lender if here, else a call at the lender's home); a lender whose loan
 * is overdue goes to ask for it. Proposals only: arbitration decides.
 */
export function loanUrges(world: World, ctx: SimContext, actorId: ActorId): UrgeProposal[] {
  const a = world.actors[actorId];
  if (!a?.alive) return [];
  const out: UrgeProposal[] = [];
  const day = ctx.cal.hour >= 8 && ctx.cal.hour < 20;
  for (const loan of loansOf(world)) {
    if (loan.status !== 'open') continue;
    // The borrower's duty; a housemate who has it in hand when the lender is by may hand it back too.
    const carrying =
      loan.borrowerId !== actorId &&
      a.householdId === loan.borrowerHouseholdId &&
      world.items.stacks[loan.itemId] !== undefined &&
      (() => {
        const r = rootOf(world, world.items.stacks[loan.itemId] as never);
        return r.kind === 'actor' && r.actorId === actorId;
      })();
    if ((loan.borrowerId === actorId || carrying) && ctx.now >= loan.dueAt - 720) {
      const lender = world.actors[loan.lenderId];
      if (!world.households[loan.lenderHouseholdId]) continue;
      const duty = world.fae?.ablation?.loanDuty ?? 350 + normStrength(world, actorId, 'duty') * 4;
      // The duty presses as the day nears and harder once it is past (review wave 13: a flat +150
      // lost to chores and grudges until the loan breached): +10 an hour over the last half day,
      // then 150 + 50 an hour overdue, to at most +500.
      const nearing = Math.min(12, Math.max(0, Math.floor((ctx.now - (loan.dueAt - 720)) / 60))) * 10;
      const overdue =
        (ctx.now > loan.dueAt ? Math.min(500, 150 + Math.floor((ctx.now - loan.dueAt) / 60) * 50) : 0) + nearing;
      const home = world.households[loan.lenderHouseholdId]?.homePlaceId;
      const returnDef = ctx.content.interactions.return_item;
      // The loan is between households (13 §6.1): the lender first, else any grown member of the
      // lender's household who is here and awake takes it back.
      const takers = [
        loan.lenderId,
        ...(world.households[loan.lenderHouseholdId]?.memberIds ?? []).filter((m) => m !== loan.lenderId),
      ];
      const taker = takers.find((m) => {
        const t = world.actors[m];
        return (
          !!returnDef &&
          t?.alive === true &&
          t.placeId === a.placeId &&
          yearsBetween(t.born, ctx.now) >= 14 &&
          !isAsleep(world, ctx, m) &&
          itemPreflight(world, returnDef, actorId, m, loan.itemId, undefined, ctx.now) === null
        );
      });
      const here = taker !== undefined;
      if (taker !== undefined)
        out.push({
          urge: { kind: 'interaction', interactionId: 'return_item', targetId: taker, itemId: loan.itemId },
          voice: 'superego',
          norm: 'duty',
          intensity: Math.min(1000, duty + overdue),
          label: `It's due back to ${lender?.name.given ?? 'the lender'}; bring it`,
          source: 'social',
          reasons: [term('psyche', 'Loan due', duty), term('psyche', 'Due soon or overdue', overdue)],
        });
      else if (
        day &&
        home !== undefined &&
        !here &&
        world.items.stacks[loan.itemId] &&
        rootOf(world, world.items.stacks[loan.itemId] as never).kind === 'actor'
      )
        out.push({
          urge: { kind: 'activity', activityId: 'visit_kin', placeId: home, itemId: loan.itemId },
          voice: 'superego',
          norm: 'duty',
          intensity: Math.min(1000, duty + overdue - 50),
          label: `It's due back; take it round to ${lender?.name.given ?? 'the lender'}'s`,
          source: 'social',
          reasons: [term('psyche', 'Loan due', duty), term('psyche', 'Due soon or overdue', overdue)],
        });
    }
    if (loan.lenderId === actorId && ctx.now > loan.dueAt + 720) {
      const borrower = world.actors[loan.borrowerId];
      if (!borrower?.alive) continue;
      const want = 250 + charmKeepWeight(world, actorId, loan.itemId);
      const home = world.households[borrower.householdId]?.homePlaceId;
      const demandDef = ctx.content.interactions.demand_return;
      const canDemand =
        !!demandDef &&
        itemPreflight(world, demandDef, actorId, loan.borrowerId, loan.itemId, undefined, ctx.now) === null;
      if (borrower.placeId === a.placeId && canDemand)
        out.push({
          urge: { kind: 'interaction', interactionId: 'demand_return', targetId: loan.borrowerId, itemId: loan.itemId },
          voice: 'id',
          drive: 'greed',
          intensity: Math.min(900, want),
          label: `${borrower.name.given} has had it past the day`,
          source: 'social',
          reasons: [term('psyche', 'Want it back', want)],
        });
      else if (day && home !== undefined && borrower.placeId === home && a.placeId !== home)
        out.push({
          urge: { kind: 'activity', activityId: 'visit_kin', placeId: home },
          voice: 'id',
          drive: 'greed',
          intensity: Math.min(800, want - 50),
          label: `Go round to ${borrower.name.given}'s and get it back`,
          source: 'social',
          reasons: [term('psyche', 'Want it back', want)],
        });
    }
  }
  return out;
}

/** Whether an actor is the borrower of an open loan of this item (fae reads it for tying). */
export function borrowedBy(world: World, itemId: ItemId): ActorId | null {
  return openLoanOf(world, itemId)?.borrowerId ?? null;
}

export const ITEM_RESPONSES = ['show_item', 'lend_item', 'return_item', 'accept_item'] as const;
export type ItemLocationKind = ReturnType<typeof rootOf>['kind'];
