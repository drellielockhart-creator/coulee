/**
 * What other modules ask of a charm during the arc (13 §6.1): the keeper's attachment, who has
 * it now, a granted look, and restitution owed and made against the private draw cases.
 * OWNER: module:fae (called through fae/api.ts).
 */
import type { ActorId, HouseholdId, ItemId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { learn } from './charms.ts';
import { credence, householdArg, itemArg } from './desire.ts';
import { guiltEased } from './refusal.ts';

/** charm_keep weight: 5 × the actor's attachment (13 §5.6). 0 for a non-charm. */
export function charmKeepWeight(world: World, actorId: ActorId, itemId: ItemId): number {
  return 5 * (world.fae.charms?.[itemId]?.attachment[actorId] ?? 0);
}

/** The thing changed hands (lent, returned, taken): it keeps no tie across a move. */
export function charmTransferred(world: World, _ctx: SimContext, itemId: ItemId, toActorId: ActorId): void {
  const c = world.fae.charms?.[itemId];
  if (!c) return;
  // Lending to a household once turned away eases the giver's conscience (refusal costs, wave 6).
  guiltEased(world, c, c.custodianId, toActorId);
  c.custodianId = toActorId;
  c.tie = null;
}

/** Shown it: the looker learns its make and may study it for the next three hours. */
export function grantLook(world: World, ctx: SimContext, actorId: ActorId, itemId: ItemId): void {
  const c = world.fae.charms?.[itemId];
  if (!c) return;
  learn(world, actorId, itemId, 'construction', ctx.now);
  c.access ??= {};
  c.access[actorId] = ctx.now + 180;
}

/** Units its draws took from a household's stores (its own and its business's), less what was repaid. */
export function restitutionOwed(world: World, itemId: ItemId, householdId: HouseholdId): number {
  let n = 0;
  for (const key of Object.keys(world.fae.drawCases ?? {}).sort()) {
    const dc = world.fae.drawCases?.[key];
    if (!dc || dc.itemId !== itemId || dc.householdId !== householdId) continue;
    n += dc.discovered + dc.undiscovered - (dc.restituted ?? 0);
  }
  return Math.max(0, n);
}

/**
 * Restitution paid (13 §5.2, §6.6): the cases record it, and a source that believes the draw
 * (`draws_from` ≥ 60 for its head) and is repaid records nothing new from then on: informed
 * acceptance, a legitimate ending.
 */
export function restitutionMade(
  world: World,
  _ctx: SimContext,
  itemId: ItemId,
  householdId: HouseholdId,
  units: number,
  _by: ActorId,
  receiver: ActorId,
): void {
  let left = units;
  const informed = credence(world, receiver, 'draws_from', [itemArg(itemId), householdArg(householdId)]) >= 60;
  for (const key of Object.keys(world.fae.drawCases ?? {}).sort()) {
    const dc = world.fae.drawCases?.[key];
    if (!dc || dc.itemId !== itemId || dc.householdId !== householdId) continue;
    const owed = dc.discovered + dc.undiscovered - (dc.restituted ?? 0);
    const pay = Math.min(owed, left);
    dc.restituted = (dc.restituted ?? 0) + pay;
    left -= pay;
    if (informed) dc.accepted = true;
  }
}

/**
 * An item interaction happened (13 §6.1): asking is remembered (a refusal is not asked again for
 * days), and a teller remembers whom they told.
 */
export function noteItemInteraction(
  world: World,
  ctx: SimContext,
  act: string | null,
  initiatorId: ActorId,
  targetId: ActorId,
  itemId: ItemId,
): void {
  const c = world.fae.charms?.[itemId];
  if (!c) return;
  if (act === 'show' || act === 'loan' || act === 'take') {
    c.asked ??= {};
    c.asked[initiatorId] = ctx.now;
  }
  if (act === 'tell') {
    const hid = world.actors[targetId]?.householdId;
    if (hid === undefined) return;
    c.told ??= {};
    c.told[initiatorId] = [...(c.told[initiatorId] ?? []).filter((h) => h !== hid), hid];
    // Telling the one who has it is a warning (13 §5.3 kept_drawing).
    const holder = Object.values(world.actors).find((a) => a.id === targetId);
    if (holder && c.custodianId !== null && world.actors[c.custodianId]?.householdId === holder.householdId) {
      c.warned ??= {};
      c.warned[targetId] = { at: ctx.now, by: initiatorId };
    }
  }
}
