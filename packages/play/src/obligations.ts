/**
 * Debts the player's character owes, as a journal reads them: who, how much, since when and by
 * when it ought to be settled. Money never leaves her purse unordered (the sim holds every
 * money-moving act for her order); a debt coming due is a duty to be reminded of, not a charge.
 */
import { type ActorId, type ContentBundle, timeView, type World } from '@coulee/core';

export interface Obligation {
  creditorId: number;
  creditor: string;
  cents: number;
  since: number;
  /** The day the town expects it paid by (the chronicle's "overdue" horizon). */
  dueT: number;
  dueDate: string;
  /** Whole days until due; negative once overdue. */
  daysLeft: number;
  overdue: boolean;
}

const DAY = 1440;

export function obligationsOf(world: World, content: ContentBundle, pc: ActorId): Obligation[] {
  const graceDays = content.chroniclePatterns?.debt?.params.overdue_days ?? 30;
  const out: Obligation[] = [];
  for (const r of world.social.relationships) {
    if (r.kind !== 'creditor' || r.b !== pc || !r.amountCents || r.amountCents <= 0) continue;
    const creditor = world.actors[r.a];
    const dueT = r.since + graceDays * DAY;
    const daysLeft = Math.floor((dueT - world.time) / DAY);
    out.push({
      creditorId: r.a,
      creditor: creditor ? `${creditor.name.given} ${creditor.name.family}`.trim() : 'someone',
      cents: r.amountCents,
      since: r.since,
      dueT,
      dueDate: timeView(dueT).dateText,
      daysLeft,
      overdue: world.time >= dueT,
    });
  }
  return out.sort((a, b) => a.dueT - b.dueT || a.creditorId - b.creditorId);
}

export function obligationText(o: Obligation): string {
  const when = o.overdue
    ? `overdue since ${o.dueDate}`
    : `due ${o.dueDate}${o.daysLeft <= 7 ? ` (${o.daysLeft <= 0 ? 'today' : `in ${o.daysLeft} day${o.daysLeft === 1 ? '' : 's'}`})` : ''}`;
  return `You owe ${o.creditor} $${(o.cents / 100).toFixed(2)}, ${when}. Settling up is yours to order (repay ${o.creditor.split(' ')[0]}).`;
}
