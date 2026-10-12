/**
 * Tending a charm (13 §5.4, §5.5, §5.8): tying it shut for the night, setting out porridge and
 * butter, thanking it aloud (which `unthanked` charms take badly), stowing it in the household's
 * stores, and the dawn recharges (an offering left overnight at the keeper's hearth; a hem hung
 * empty in the dew). Every act passes `authorizeAct` first; a refusal changes nothing.
 * OWNER: module:fae.
 */
import type { CharmDef, CharmRechargeDef } from '@coulee/content/schema';
import type { ActorId, HouseholdId } from '../ids.ts';
import { consumeStack, moveStack, pantryOf, stacksDeep } from '../items/api.ts';
import { airTempF, isRaining } from '../provisions/api.ts';
import { isOutdoorsPlace } from '../provisions/spoilage.ts';
import { authorizeAct, type Basis } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { charmDefOf, charmIds, charmLive, holdingOf, ironOn, unitsInside } from './charms.ts';
import { drawEffectOf } from './draws.ts';
import { dryEffectOf } from './hem.ts';
import type { CharmState } from './state.ts';

export type TendResult = { ok: true; text: string } | { ok: false; reason: string };

/** The actor can reach the charm: carrying it, or at home where their household keeps it. */
export function canReach(world: World, actorId: ActorId, c: CharmState): boolean {
  const stack = world.items.stacks[c.itemId];
  const a = world.actors[actorId];
  if (!stack || !a) return false;
  const h = holdingOf(world, stack);
  if (h.actorId === actorId) return true;
  if (h.actorId !== null) return false;
  if (h.householdId !== null) return h.householdId === a.householdId && h.placeId === a.placeId;
  return h.placeId === a.placeId;
}

function authorize(world: World, actorId: ActorId, kind: string, c: CharmState, basis: Basis): string | null {
  const r = authorizeAct(world, actorId, { kind, itemId: c.itemId }, basis);
  return r.ok ? null : r.reason;
}

/** Dark enough to tie: from an hour before sunset until sunrise. */
export function tieWindow(ctx: Pick<SimContext, 'cal'>): boolean {
  const m = ctx.cal.hour * 60;
  return m >= ctx.cal.sunsetMinute - 60 || m < ctx.cal.sunriseMinute;
}

export function tieCharm(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, basis: Basis): TendResult {
  const def = charmDefOf(ctx.content, c.defId);
  const eff = drawEffectOf(def);
  if (!def || !eff || def.activation.kind !== 'tied_overnight') return { ok: false, reason: 'It is not tied to work' };
  if (!canReach(world, actorId, c)) return { ok: false, reason: 'You do not have it to hand' };
  if (def.activation.dark && !tieWindow(ctx)) return { ok: false, reason: 'It must be tied after dark' };
  if (c.tie && c.tie.at > ctx.now - 720) return { ok: false, reason: 'It is already tied for tonight' };
  const denied = authorize(world, actorId, 'tie_charm', c, basis);
  if (denied) return { ok: false, reason: denied };
  c.tie = { at: ctx.now, by: actorId, units: unitsInside(world, c.itemId, eff.defs) };
  emitTended(world, ctx, actorId, c, 'tie', 'You tie the sack shut and set it by the hearth for the night.');
  return { ok: true, text: 'Tied shut for the night. Do not look in before cockcrow.' };
}

function offeringOf(def: CharmDef): Extract<CharmRechargeDef, { kind: 'offering' }> | undefined {
  return def.recharge.find((r): r is Extract<CharmRechargeDef, { kind: 'offering' }> => r.kind === 'offering');
}

/** Why an offering would not be taken now, or null. */
export function offeringBlocked(world: World, ctx: Pick<SimContext, 'now' | 'content'>, c: CharmState): string | null {
  const def = charmDefOf(ctx.content, c.defId);
  const r = def && offeringOf(def);
  if (!def || !r) return 'It takes no offering';
  if (!charmLive(c)) return 'It is dormant past waking';
  if (c.vigor < def.iron.recharge_floor) return 'Iron has soured it past recharging';
  if (c.rechargeBlockedUntil > ctx.now) return 'It will take nothing for now (it was thanked aloud)';
  if (c.offering) return 'An offering is already set out';
  const stack = world.items.stacks[c.itemId];
  if (stack && ironOn(world, ctx.content, stack, def).suppressed) return 'It will take nothing while iron is on it';
  if (c.lastRechargeAt !== null && c.lastRechargeAt + r.cooldown_minutes > ctx.now) return 'It was fed this week';
  return null;
}

/** Porridge and butter left by it overnight at the keeper's hearth: the items are really used. */
export function setOffering(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, basis: Basis): TendResult {
  const def = charmDefOf(ctx.content, c.defId);
  const r = def && offeringOf(def);
  if (!def || !r) return { ok: false, reason: 'It takes no offering' };
  const blocked = offeringBlocked(world, ctx, c);
  if (blocked) return { ok: false, reason: blocked };
  const a = world.actors[actorId];
  const stack = world.items.stacks[c.itemId];
  if (!a || !stack) return { ok: false, reason: 'You do not have it to hand' };
  const home = world.households[a.householdId]?.homePlaceId;
  if (!canReach(world, actorId, c) || a.placeId !== home)
    return { ok: false, reason: 'It must be fed at your own hearth' };
  // Ingredients from the household's stores, then the actor's own kit.
  const where = [pantryOf(a.householdId as HouseholdId), { kind: 'actor' as const, actorId, worn: false }];
  const plan: Array<{ id: number; qty: number }> = [];
  for (const need of r.items) {
    let left = need.qty;
    for (const loc of where)
      for (const { stack: s } of stacksDeep(world, loc)) {
        if (left <= 0 || s.defId !== need.def || s.id === c.itemId) continue;
        const take = Math.min(left, s.qty);
        plan.push({ id: s.id, qty: take });
        left -= take;
      }
    if (left > 0) return { ok: false, reason: `It wants ${need.qty} lb of ${need.def} and you have not got it` };
  }
  const denied = authorize(world, actorId, 'feed_charm', c, basis);
  if (denied) return { ok: false, reason: denied };
  for (const p of plan) consumeStack(world, ctx, p.id as never, p.qty, 'fae_offering');
  c.offering = { at: ctx.now, by: actorId, placeId: a.placeId };
  emitTended(world, ctx, actorId, c, 'offering', 'You set out a bowl of porridge with butter beside it for the night.');
  return { ok: true, text: 'Porridge and butter set out beside it for the night.' };
}

/** Thanks aloud: harmless to most things; an `unthanked` charm sulks a moon (13 §5.5). */
export function thankCharm(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, basis: Basis): TendResult {
  if (!canReach(world, actorId, c)) return { ok: false, reason: 'You do not have it to hand' };
  const denied = authorize(world, actorId, 'thank_charm', c, basis);
  if (denied) return { ok: false, reason: denied };
  const def = charmDefOf(ctx.content, c.defId);
  c.thankedAt = ctx.now;
  for (const q of def?.quirks ?? []) {
    const block = ctx.content.quirks?.[q]?.block_minutes ?? 0;
    if (block > 0) c.rechargeBlockedUntil = Math.max(c.rechargeBlockedUntil, ctx.now + block);
  }
  emitTended(world, ctx, actorId, c, 'thank', 'You thank it aloud, as you would anyone who fed you.');
  return { ok: true, text: 'You thank it aloud.' };
}

/** A keeper home with the charm puts it away in the household's stores (by the hearth). */
export function stowCharm(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, basis: Basis): TendResult {
  const a = world.actors[actorId];
  const stack = world.items.stacks[c.itemId];
  if (!a || !stack) return { ok: false, reason: 'Nothing to stow' };
  const h = holdingOf(world, stack);
  if (h.actorId !== actorId) return { ok: false, reason: 'You are not carrying it' };
  if (world.households[a.householdId]?.homePlaceId !== a.placeId) return { ok: false, reason: 'You are not at home' };
  const denied = authorize(world, actorId, 'stow_charm', c, basis);
  if (denied) return { ok: false, reason: denied };
  moveStack(world, ctx, c.itemId, 1, pantryOf(a.householdId));
  emitTended(world, ctx, actorId, c, 'stow', 'You put it away with the household stores.');
  return { ok: true, text: 'Put away with the household stores.' };
}

function emitTended(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  c: CharmState,
  act: 'tie' | 'offering' | 'hang' | 'thank' | 'stow',
  text: string,
): void {
  const place = world.actors[actorId]?.placeId;
  ctx.emit({
    kind: 'fae.charm_tended',
    ...(place !== undefined ? { place } : {}),
    visibility: 'private',
    roles: [{ actor: actorId, role: 'agent' }],
    data: { itemId: c.itemId, charm: c.defId, actorId, act, text },
  });
}

/**
 * The dawn recharges (13 §5.8), after the draws: an offering left overnight with the charm still
 * at that hearth is eaten and restores virtue; a hem hung empty outdoors in a dry, above-freezing
 * dawn gains one. Iron in contact, souring past the floor, or a sulk refuse it.
 */
export function dawnRecharge(world: World, ctx: SimContext): void {
  for (const id of charmIds(world)) {
    const c = world.fae.charms?.[id];
    const def = charmDefOf(ctx.content, c?.defId);
    const stack = world.items.stacks[id];
    if (!c || !def || !stack) continue;
    const h = holdingOf(world, stack);
    const refuse =
      !charmLive(c) ||
      c.vigor < def.iron.recharge_floor ||
      c.rechargeBlockedUntil > ctx.now ||
      ironOn(world, ctx.content, stack, def).suppressed;
    if (c.offering) {
      const r = offeringOf(def);
      const by = c.offering.by;
      const there = h.placeId === c.offering.placeId && h.actorId === null;
      c.offering = null;
      if (r && there && !refuse) {
        const before = c.virtue;
        c.virtue = Math.min(def.virtue.max, c.virtue + r.amount);
        c.lastRechargeAt = ctx.now;
        recharged(world, ctx, c, by, c.virtue - before, 'The bowl is licked clean by morning.');
      }
    }
    const dew = def.recharge.find((r) => r.kind === 'dew');
    const dry = dryEffectOf(def);
    if (dew?.kind === 'dew' && dry && !refuse && c.virtue < def.virtue.max) {
      const parent = stack.location.kind === 'container' ? world.items.stacks[stack.location.itemId] : undefined;
      const others = parent
        ? stacksDeep(world, { kind: 'container', itemId: parent.id }).filter((x) => x.stack.id !== id).length
        : 1;
      const place = h.placeId !== null ? world.places[h.placeId] : undefined;
      if (
        parent &&
        others === 0 &&
        place &&
        isOutdoorsPlace(place.kind) &&
        !isRaining(ctx.seed, ctx.cal) &&
        airTempF(ctx.cal) >= dew.min_temp_f
      ) {
        c.virtue = Math.min(def.virtue.max, c.virtue + dew.amount);
        c.lastRechargeAt = ctx.now;
        recharged(
          world,
          ctx,
          c,
          h.actorId,
          dew.amount,
          'The empty bag hung out in the dew comes in damp and somehow lighter.',
        );
      }
    }
  }
}

function recharged(world: World, ctx: SimContext, c: CharmState, by: ActorId | null, amount: number, text: string) {
  const place = by !== null ? world.actors[by]?.placeId : undefined;
  ctx.emit({
    kind: 'fae.charm_recharged',
    ...(place !== undefined ? { place } : {}),
    visibility: 'private',
    roles: by !== null ? [{ actor: by, role: 'agent' }] : [],
    data: { itemId: c.itemId, charm: c.defId, actorId: by, amount, text },
  });
}
