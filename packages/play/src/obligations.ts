/**
 * Debts the player's character owes, as a journal reads them: who, how much, since when and by
 * when it ought to be settled. Money never leaves her purse unordered (the sim holds every
 * money-moving act for her order); a debt coming due is a duty to be reminded of, not a charge.
 *
 * Playtest r2: favors owed (an accepted offer of help, a gift taken) are obligations too, and so
 * is what others owe her: both are listed, in the journal and on `inspect`.
 */
import { type ActorId, type ContentBundle, social, timeView, type World } from '@coulee/core';

export interface Obligation {
  creditorId: number;
  creditor: string;
  /** Money owed (cents); 0 for a favor. */
  cents: number;
  since: number;
  /** The day the town expects it paid by (the chronicle's "overdue" horizon). */
  dueT: number;
  dueDate: string;
  /** Whole days until due; negative once overdue. */
  daysLeft: number;
  overdue: boolean;
  // ---- additive (playtest r2) ----
  /** 'money' (the default) or 'favor': a kindness owed in kind, with no date on it. */
  kind?: 'money' | 'favor' | 'thing';
  /** Favors owed (for kind 'favor'). */
  favors?: number;
  /** A thing borrowed on terms (kind 'thing', 13 §6.1): owed back by the day agreed. */
  thing?: string;
}

/** What someone owes the player's character (a loan she made, a favor she did). */
export interface Claim {
  debtorId: number;
  debtor: string;
  cents: number;
  favors: number;
  /** When the money debt began (0 when only favors are owed). */
  since: number;
  // ---- additive (fae 1b: a thing lent on terms, 13 §6.1) ----
  thing?: string;
  dueT?: number;
  overdue?: boolean;
}

const DAY = 1440;
const nameOf = (world: World, id: number) => {
  const a = world.actors[id];
  return a ? `${a.name.given} ${a.name.family}`.trim() : 'someone';
};
/** A lent thing as its holder sees it: the item's plain name ("flour sack, moonsilk ticking"). */
const thingOf = (world: World, content: ContentBundle | undefined, itemId: number) => {
  const defId = world.items.stacks[itemId as never]?.defId;
  const name = (defId && content?.items[defId]?.name) || 'the thing lent';
  return name.charAt(0).toLowerCase() + name.slice(1);
};

export function obligationsOf(world: World, content: ContentBundle, pc: ActorId): Obligation[] {
  const graceDays = content.chroniclePatterns?.debt?.params.overdue_days ?? 30;
  const out: Obligation[] = [];
  for (const r of world.social.relationships) {
    if (r.kind !== 'creditor' || r.b !== pc || !r.amountCents || r.amountCents <= 0) continue;
    const dueT = r.since + graceDays * DAY;
    const daysLeft = Math.floor((dueT - world.time) / DAY);
    out.push({
      creditorId: r.a,
      creditor: nameOf(world, r.a),
      cents: r.amountCents,
      since: r.since,
      dueT,
      dueDate: timeView(dueT).dateText,
      daysLeft,
      overdue: world.time >= dueT,
      kind: 'money',
    });
  }
  // Favors: the ledger's other column, owed in kind (no date; the town remembers who helped).
  for (const other of social.acquaintancesOf(world, pc)) {
    const favors = social.debtOf(world, other, pc).favors;
    if (favors <= 0 || !world.actors[other]) continue;
    out.push({
      creditorId: other,
      creditor: nameOf(world, other),
      cents: 0,
      since: world.time,
      dueT: Number.MAX_SAFE_INTEGER,
      dueDate: '',
      daysLeft: Number.MAX_SAFE_INTEGER,
      overdue: false,
      kind: 'favor',
      favors,
    });
  }
  // Things borrowed on terms (13 §6.1): the promise is the borrower's, owed back by the day agreed.
  for (const l of social.loansOf(world)) {
    if (l.status !== 'open' || l.borrowerId !== pc) continue;
    out.push({
      creditorId: l.lenderId,
      creditor: nameOf(world, l.lenderId),
      cents: 0,
      since: l.at,
      dueT: l.dueAt,
      dueDate: timeView(l.dueAt).dateText,
      daysLeft: Math.floor((l.dueAt - world.time) / DAY),
      overdue: world.time >= l.dueAt,
      kind: 'thing',
      thing: thingOf(world, content, l.itemId),
    });
  }
  return out.sort((a, b) => a.dueT - b.dueT || a.creditorId - b.creditorId || (a.kind === 'favor' ? 1 : -1));
}

/** Money lent and favors done that others still owe her. */
export function claimsOf(world: World, pc: ActorId, content?: ContentBundle): Claim[] {
  const out: Claim[] = [];
  for (const other of social.acquaintancesOf(world, pc)) {
    const d = social.debtOf(world, pc, other);
    if (d.cents <= 0 && d.favors <= 0) continue;
    const edge = world.social.relationships.find((r) => r.kind === 'creditor' && r.a === pc && r.b === other);
    out.push({
      debtorId: other,
      debtor: nameOf(world, other),
      cents: Math.max(0, d.cents),
      favors: Math.max(0, d.favors),
      since: edge?.since ?? 0,
    });
  }
  // Things she lent on terms (13 §6.1), owed back by the day agreed.
  for (const l of social.loansOf(world)) {
    if (l.status !== 'open' || l.lenderId !== pc) continue;
    out.push({
      debtorId: l.borrowerId,
      debtor: nameOf(world, l.borrowerId),
      cents: 0,
      favors: 0,
      since: l.at,
      thing: thingOf(world, content, l.itemId),
      dueT: l.dueAt,
      overdue: world.time >= l.dueAt,
    });
  }
  return out;
}

export function obligationText(o: Obligation): string {
  if (o.kind === 'thing') {
    const first = o.creditor.split(' ')[0];
    return `You have ${first}'s ${o.thing ?? 'thing'}, ${o.overdue ? `overdue since ${o.dueDate}` : `due back ${o.dueDate}`}. Bringing it back is yours to order (give it back to ${first}).`;
  }
  if (o.kind === 'favor') {
    const n = o.favors ?? 1;
    return `You owe ${o.creditor} ${n === 1 ? 'a favor' : `${n} favors`}, to be returned in kind (help ${o.creditor.split(' ')[0]} when ${o.creditor.split(' ')[0]} needs a hand).`;
  }
  const when = o.overdue
    ? `overdue since ${o.dueDate}`
    : `due ${o.dueDate}${o.daysLeft <= 7 ? ` (${o.daysLeft <= 0 ? 'today' : `in ${o.daysLeft} day${o.daysLeft === 1 ? '' : 's'}`})` : ''}`;
  return `You owe ${o.creditor} $${(o.cents / 100).toFixed(2)}, ${when}. Settling up is yours to order (repay ${o.creditor.split(' ')[0]}).`;
}

export function claimText(c: Claim): string {
  if (c.thing !== undefined)
    return `${c.debtor} has your ${c.thing}, lent until ${timeView(c.dueT ?? 0).dateText}${c.overdue ? ' (overdue)' : ''}.`;
  const parts = [
    ...(c.cents > 0 ? [`$${(c.cents / 100).toFixed(2)}`] : []),
    ...(c.favors > 0 ? [c.favors === 1 ? 'a favor' : `${c.favors} favors`] : []),
  ];
  return `${c.debtor} owes you ${parts.join(' and ')}${c.cents > 0 && c.since > 0 ? ` (since ${timeView(c.since).dateText})` : ''}.`;
}
