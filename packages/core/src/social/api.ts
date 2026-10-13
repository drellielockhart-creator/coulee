/**
 * Social cross-module API. OWNER: module:social.
 *
 * Opinions change only through Reasons (04 §6.2): `addOpinionReason` (and the interactions
 * social resolves). `opinionOf` = clamp(base + Σ floorDiv(delta × strength, 1000) +
 * volatile), strength = cited memory salience | 10 × cited belief credence | 1000.
 */
import type { ContentBundle, DefenseId } from '../content.ts';
import { type ActorId, type EventId, idsOf, type MemoryId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { decayOneDay, insertMemory, memoryFloor, memoryTauDays, ownerMemories } from './memory.ts';
import {
  addReason,
  adjustLedger,
  compatibility,
  computeBase,
  opinionRecord,
  owedCents,
  owedFavors,
  refreshBase,
} from './opinion.ts';
import type { Memory, MemoryInput, OpinionReason, Relationship } from './state.ts';
import { tuningOf } from './tuning.ts';
import { areKinBy } from './volition.ts';

export { resolveInteraction } from './interact.ts';
export { decayOneDay, encodeSalience, memoryDigest } from './memory.ts';
export {
  bumpFamiliarity,
  isAcquainted,
  opinionLabel,
  opinionOf,
  opinionSum,
  reasonContribution,
  reasonStrength,
} from './opinion.ts';
export { dailyStrife, isEstranged, mediationHour, strifeCount, wearinessPermille } from './strife.ts';
export { composeExchange, type Exchange, moodOf, referTo, type TalkFacts, type TalkTurn } from './talk.ts';
export { tuningOf } from './tuning.ts';
export { proposeSocialUrges } from './urges.ts';
export { attraction, eligible, makePair, requiresFail, volition } from './volition.ts';
export { compatibility, computeBase };

/**
 * Add a reason (the only way opinions change, 04 §6.2). Enforces the reason cap: the
 * weakest reason folds into the "other reasons" bucket.
 */
export function addOpinionReason(
  world: World,
  ctx: SimContext,
  from: ActorId,
  to: ActorId,
  reason: OpinionReason,
): void {
  addReason(world, ctx.content, from, to, reason, ctx.now);
}

/**
 * A defense-made Reason (04 §6.2 viaDefense) with no interaction behind it: rationalization's
 * "had it coming" about the one the holder wronged. The label and delta are social content
 * (social_tuning.defense_interactions); the Reason cites the `psyche.defense` event and fades.
 * Returns true if a Reason was added.
 */
export function addDefenseReason(
  world: World,
  ctx: SimContext,
  holder: ActorId,
  target: ActorId,
  defense: DefenseId,
  eventId: EventId,
): boolean {
  if (holder === target || !world.actors[holder] || !world.actors[target]) return false;
  const entry = tuningOf(ctx.content).defense_interactions.find((d) => d.defense === defense);
  if (!entry?.reason) return false;
  const d = entry.reason_delta;
  if (d.affection === 0 && d.respect === 0 && d.trust === 0 && d.fear === 0) return false;
  addReason(
    world,
    ctx.content,
    holder,
    target,
    {
      label: entry.reason,
      cites: { kind: 'defense', eventId, strength: 1000 },
      delta: { ...d },
      since: ctx.now,
      viaDefense: defense,
    },
    ctx.now,
  );
  return true;
}

/**
 * Encode a memory for an actor (perception, being told, etc.). Salience/intensity are
 * clamped; `aboutId`/`did` default from `roles`. Returns the new memory id.
 */
export function addMemory(world: World, ctx: SimContext, memory: MemoryInput): MemoryId | null {
  if (!world.actors[memory.ownerId]) return null;
  return insertMemory(world, ctx, memory);
}

/** Freeze the producer's decay inputs before a named off-screen memory is deferred.
 * Subsequent disposition changes must not reroll its unresolved history on arrival. */
export interface MemoryDecayPolicy {
  tauDays: number;
  floor: number;
  forgetBelow: number;
}
export function memoryDecayPolicy(world: World, content: ContentBundle, input: MemoryInput): MemoryDecayPolicy {
  const memory: Memory = {
    ...input,
    id: 0 as MemoryId,
    aboutId: input.aboutId ?? null,
    did: input.did ?? false,
    count: input.count ?? 1,
    since: input.since ?? input.at,
  };
  return {
    tauDays: memoryTauDays(world, content, memory),
    floor: memoryFloor(content, memory),
    forgetBelow: tuningOf(content).forget_below,
  };
}

/** Same integer daily step as a materialized mind; no World mutation or new memory ID. */
export function decayMemorySnapshot(salience: number, pinned: boolean, policy: MemoryDecayPolicy): number | null {
  const next = decayOneDay(salience, policy.tauDays, policy.floor);
  return !pinned && next < policy.forgetBelow && policy.floor < policy.forgetBelow ? null : next;
}

export function memoriesOf(world: World, actorId: ActorId): Memory[] {
  return ownerMemories(world, actorId);
}

export function relationshipsOf(world: World, actorId: ActorId): Relationship[] {
  return world.social.relationships.filter((r) => r.a === actorId || r.b === actorId);
}

const KIN: ReadonlySet<string> = new Set(['parent', 'sibling', 'spouse', 'cousin', 'in_law', 'betrothed']);
/** Kin by structural edge (the period default set; `areKinBy` reads social_tuning.kin_kinds). */
export function areKin(world: World, a: ActorId, b: ActorId): boolean {
  return world.social.relationships.some(
    (r) => KIN.has(r.kind) && ((r.a === a && r.b === b) || (r.a === b && r.b === a)),
  );
}
export { areKinBy };

/** The Reasons behind holder's opinion of target (read-only; empty when none). */
export function reasonsOf(world: World, from: ActorId, to: ActorId): readonly OpinionReason[] {
  return opinionRecord(world, from, to)?.reasons ?? [];
}

/** The holder's acquaintance-level familiarity with the target, 0..1000. */
export function familiarityOf(world: World, from: ActorId, to: ActorId): number {
  return opinionRecord(world, from, to)?.familiarity ?? 0;
}

/** Obligation ledger read (04 §6.1): what `debtor` owes `creditor`. */
export function debtOf(world: World, creditor: ActorId, debtor: ActorId): { cents: number; favors: number } {
  return { cents: owedCents(world, creditor, debtor), favors: owedFavors(world, creditor, debtor) };
}

/** Acquaintances of an actor (holders of an opinion record), ascending ids. */
export function acquaintancesOf(world: World, actorId: ActorId): ActorId[] {
  return Object.keys(world.social.opinions[actorId] ?? {})
    .map(Number)
    .sort((a, b) => a - b) as ActorId[];
}

/** Base opinion recomputed now (for tests and the dossier). */
export function baseOpinion(world: World, content: ContentBundle, from: ActorId, to: ActorId) {
  return computeBase(world, content, from, to);
}

/** Store purchases extend the ordinary mirrored money obligation; repayment and forgiveness
 * therefore use exactly the same ledger as loans. No money moves when goods extend credit. */
export function extendCredit(world: World, ctx: SimContext, creditor: ActorId, debtor: ActorId, cents: number): void {
  if (!Number.isSafeInteger(cents) || cents <= 0 || creditor === debtor) return;
  adjustLedger(world, ctx.content, creditor, debtor, { favors: 0, cents });
}

export { interactionAvailability } from './availability.ts';

/** Keep historical marriage edges; record widowhood without inventing a new spouse. */
export function markBereaved(world: World, ctx: SimContext, deceased: ActorId): void {
  for (const r of relationshipsOf(world, deceased)) {
    if (r.kind !== 'spouse') continue;
    const survivor = r.a === deceased ? r.b : r.a;
    if (world.actors[survivor]?.alive) {
      r.endedAt = ctx.now;
      r.endedByDeath = deceased;
    }
  }
}
export { dayText, keepsFromWork, type WorkStatus, whenText, workAllows, workStatus } from './availability.ts';
export { giftStack } from './gifts.ts';
export { type PendingRequest, pendingRequests, type RequestTerms, requestTerms } from './requests.ts';

/** Move monetary claims/liabilities to an estate representative; personal favors stay historical. */
export function inheritMoneyLedger(world: World, ctx: SimContext, deceased: ActorId, heir: ActorId) {
  const history: Array<{ creditorId: ActorId; debtorId: ActorId; cents: number; since: number }> = [];
  for (const other of idsOf<ActorId>(world.actors)) {
    if (other === deceased) continue;
    const cents = opinionRecord(world, deceased, other)?.obligation.cents ?? 0;
    if (!cents) continue;
    const original = world.social.relationships.find(
      (edge) =>
        edge.kind === 'creditor' &&
        edge.a === (cents > 0 ? deceased : other) &&
        edge.b === (cents > 0 ? other : deceased),
    );
    const since = original?.since ?? ctx.now;
    history.push({
      since,
      creditorId: cents > 0 ? deceased : other,
      debtorId: cents > 0 ? other : deceased,
      cents: Math.abs(cents),
    });
    adjustLedger(world, ctx.content, deceased, other, { favors: 0, cents: -cents });
    // Mutual claims against the representative settle by merger; others inherit net balances.
    if (other !== heir) {
      adjustLedger(world, ctx.content, heir, other, { favors: 0, cents });
      for (const [a, b] of [
        [heir, other],
        [other, heir],
      ] as const) {
        const amount = owedCents(world, a, b);
        const edge = world.social.relationships.find((e) => e.kind === 'creditor' && e.a === a && e.b === b);
        if (edge) {
          edge.amountCents = amount;
          if (amount) edge.since = Math.min(edge.since, since) as typeof edge.since;
        } else if (amount) world.social.relationships.push({ a, b, kind: 'creditor', since, amountCents: amount });
      }
      refreshBase(world, ctx.content, heir, other);
    }
    for (const edge of world.social.relationships)
      if (
        edge.kind === 'creditor' &&
        ((edge.a === deceased && edge.b === other) || (edge.b === deceased && edge.a === other))
      )
        edge.amountCents = 0;
    refreshBase(world, ctx.content, deceased, other);
  }
  return history;
}

export type { ObjectLoan, Rota } from './objects.ts';
export {
  borrowedBy,
  holds,
  itemPreflight,
  loansDaily,
  loansHourly,
  loansOf,
  loanUrges,
  openLoanOf,
  rotaOf,
} from './objects.ts';
export { knowsWant, officeOf, prepareReliefTravel, reliefOffices, reliefReservations, reliefRules } from './relief.ts';
export { executeSocialCommand } from './system.ts';
export { attemptTheft, desperationUrges, type TheftOutcome, type TheftRequest, theftPreflight } from './theft.ts';
