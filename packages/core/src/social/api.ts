/**
 * Social cross-module API. OWNER: module:social.
 *
 * Opinions change only through Reasons (04 §6.2): `addOpinionReason` (and the interactions
 * social resolves). `opinionOf` = clamp(base + Σ floorDiv(delta × strength, 1000) +
 * volatile), strength = cited memory salience | 10 × cited belief credence | 1000.
 */
import type { ContentBundle, DefenseId } from '../content.ts';
import type { ActorId, EventId, MemoryId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { insertMemory, ownerMemories } from './memory.ts';
import { addReason, compatibility, computeBase, opinionRecord, owedCents, owedFavors } from './opinion.ts';
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
