import { tacticalPinned } from '../activity/api.ts';
/** Actor policy, independent of controller. Missing fields preserve legacy psyche saves/hashes. */

import { walkMinutes } from '../activity/api.ts';
import type { ActorId, ItemId } from '../ids.ts';
import { canAct, needValue } from '../needs/api.ts';
import { foodToHand } from '../provisions/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { Urge } from '../urge.ts';
import type { World } from '../world.ts';
export type AgencyMode = 'psyche' | 'commanded';
export interface StandingOrders {
  sleep: boolean;
  eat: boolean;
  drink: boolean;
  warmth: boolean;
  lodging: boolean;
  /** Explicitly authorized activity ids; consequential interaction urges remain commands. */
  activities: string[];
  capabilities?: string[];
}
export const DEFAULT_STANDING_ORDERS: StandingOrders = {
  sleep: true,
  eat: true,
  drink: true,
  warmth: true,
  lodging: true,
  activities: [],
};
export function agencyMode(world: World, id: ActorId): AgencyMode {
  const p = world.psyche.byActor[id];
  return p?.agency?.mode === 'fits' ? 'commanded' : (p?.agency?.mode ?? p?.agencyMode ?? 'psyche');
}
export function standingOrders(world: World, id: ActorId): StandingOrders {
  return world.psyche.byActor[id]?.standingOrders ?? DEFAULT_STANDING_ORDERS;
}
export function autonomous(world: World, id: ActorId): boolean {
  return canAct(world, id) && agencyMode(world, id) === 'psyche';
}
export function standingUrge(world: World, ctx: SimContext, id: ActorId, urge: Urge): boolean {
  if (urge.kind !== 'activity') return false;
  const orders = standingOrders(world, id);
  if (orders.activities.includes(urge.activityId))
    return authorizeAct(world, id, { kind: urge.activityId }, { kind: 'standing', capability: urge.activityId }).ok;
  const def = ctx.content.activities[urge.activityId];
  if (!def) return false;
  const can = (capability: string) =>
    !!ctx.content.standingCapabilities?.[capability]?.default &&
    authorizeAct(world, id, { kind: capability }, { kind: 'standing', capability }).ok;
  const night = ctx.cal.hour >= 21 || ctx.cal.hour < 6;
  if (def.asleep) return can('sleep') && night && needValue(world, id, 'rest') < 750;
  // Never "at table" with nothing to eat: food to hand here, or the meal's place within an hour.
  if (urge.activityId === 'take_meal')
    return can('eat_own_stores') && needValue(world, id, 'hunger') < 600 && mealReachable(world, ctx, id, urge);
  if (urge.activityId === 'fetch_water') return can('drink') && needValue(world, id, 'thirst') < 600;
  return can('keep_warm') && (def.needs.warmth ?? 0) > 0 && needValue(world, id, 'warmth') < 500;
}

function mealReachable(world: World, ctx: SimContext, id: ActorId, urge: Urge & { kind: 'activity' }): boolean {
  const here = world.actors[id]?.placeId;
  if (here === undefined) return false;
  if (urge.placeId === undefined || urge.placeId === here) return foodToHand(world, ctx.content, id);
  return walkMinutes(world, ctx.content, here, urge.placeId) <= 60;
}

/** Authorization is independent of the shell/controller and defaults to refusal. */
export type Issuer = { kind: 'player' } | { kind: 'actor'; id: ActorId };
export type StandingId = string;
export type Basis =
  | { kind: 'command'; issuer: Issuer }
  | { kind: 'standing'; capability: StandingId }
  | { kind: 'own' };
export interface Act {
  kind: string;
  targetId?: ActorId;
  itemId?: ItemId;
  cents?: number;
  itemTags?: readonly string[];
}
export interface AgencyState {
  mode: AgencyMode | 'fits';
  issuer: Issuer | null;
  standing: StandingId[];
  standingUsage?: Record<string, { period: number; cents: number }>;
  compulsion: 'off' | 'capped' | 'full';
  until: number | null;
  source: { kind: 'charm' | 'working' | 'bargain'; id: string } | null;
  restore: Omit<AgencyState, 'restore'> | null;
}
export function agencyOf(world: World, id: ActorId): AgencyState {
  return (
    world.psyche.byActor[id]?.agency ?? {
      mode: agencyMode(world, id),
      issuer: agencyMode(world, id) === 'commanded' ? { kind: 'player' } : null,
      standing: [],
      compulsion: agencyMode(world, id) === 'commanded' ? 'capped' : 'full',
      until: null,
      source: null,
      restore: null,
    }
  );
}
export function setAgency(world: World, id: ActorId, state: AgencyState): void {
  const p = world.psyche.byActor[id];
  if (!p) return;
  p.agency = state;
  delete p.pace;
}
export function authorizeAct(
  world: World,
  id: ActorId,
  act: Act,
  basis: Basis,
): { ok: true } | { ok: false; reason: string } {
  if (
    tacticalPinned(world, id) &&
    !act.kind.startsWith('tactical.') &&
    act.kind !== 'core.standing_orders' &&
    act.kind !== 'activity.observe' &&
    act.kind !== 'activity.wait'
  )
    return { ok: false, reason: 'Tactical scene owns this actor; finish or leave the scene first' };
  if (!world.actors[id]?.alive) return { ok: false, reason: 'No living actor' };
  const policy = agencyOf(world, id);
  if (basis.kind === 'own')
    return policy.mode === 'psyche' ? { ok: true } : { ok: false, reason: `Agency ${policy.mode}: requires an order` };
  if (basis.kind === 'command') {
    const owner = policy.issuer;
    const same =
      owner === null ||
      (owner.kind === basis.issuer.kind &&
        (owner.kind === 'player' || (basis.issuer.kind === 'actor' && owner.id === basis.issuer.id)));
    return same ? { ok: true } : { ok: false, reason: 'Command issuer does not hold agency' };
  }
  const orders = standingOrders(world, id);
  const def = world.psyche.standingCapabilities?.[basis.capability];
  // Migration compatibility for saves predating the content catalogue.
  const oldDefaults: Record<string, keyof StandingOrders> = {
    sleep: 'sleep',
    eat_own_stores: 'eat',
    drink: 'drink',
    keep_warm: 'warmth',
    go_home: 'lodging',
    shelter: 'lodging',
  };
  const legacy = (def?.legacy ?? (!world.psyche.standingCapabilities ? oldDefaults[basis.capability] : undefined)) as
    | keyof StandingOrders
    | undefined;
  const granted =
    ((def?.default === true || !world.psyche.standingCapabilities) &&
      legacy !== undefined &&
      orders[legacy] === true) ||
    policy.standing.includes(basis.capability) ||
    orders.capabilities?.includes(basis.capability) ||
    orders.activities.includes(basis.capability);
  if (!granted || act.kind !== (def?.act ?? basis.capability))
    return { ok: false, reason: `No standing capability for ${act.kind}` };
  if (def?.item_tags.length && !def.item_tags.some((t) => act.itemTags?.includes(t)))
    return { ok: false, reason: 'Standing order does not cover this item' };
  if (def?.max_cents !== undefined) {
    const period = Math.floor(world.time / def.period_minutes);
    const usage = policy.standingUsage?.[basis.capability];
    const spent = usage?.period === period ? usage.cents : 0;
    if (act.cents === undefined || !Number.isInteger(act.cents) || act.cents < 0 || spent + act.cents > def.max_cents)
      return { ok: false, reason: `Standing spending limit: ${def.max_cents - spent} cents remain` };
  }
  return { ok: true };
}
/** Book only a completed transaction, after the executor has validated and moved the goods. */
export function recordStandingSpend(world: World, id: ActorId, capability: string, cents: number): void {
  const def = world.psyche.standingCapabilities?.[capability];
  if (def?.max_cents === undefined) return;
  const policy = agencyOf(world, id);
  const period = Math.floor(world.time / def.period_minutes);
  const old = policy.standingUsage?.[capability];
  policy.standingUsage ??= {};
  policy.standingUsage[capability] = {
    period,
    cents: (old?.period === period ? old.cents : 0) + Math.max(0, Math.floor(cents)),
  };
  setAgency(world, id, policy);
}

export function authorizationExplain(
  world: World,
  id: ActorId,
  act: Act,
  basis: Basis,
): import('../explain.ts').Explain {
  const policy = agencyOf(world, id),
    result = authorizeAct(world, id, act, basis);
  const issuer =
    basis.kind === 'command' ? (basis.issuer.kind === 'player' ? 'player' : `actor ${basis.issuer.id}`) : 'none';
  return {
    kind: 'authorization',
    label: `${act.kind}: ${policy.mode}; ${basis.kind}; issuer ${issuer}`,
    subjects: [id],
    knowledge: 'self',
    terms: [],
    total: result.ok ? 1 : 0,
    outcome: result.ok ? 'authorized' : result.reason,
  };
}
/** Executor helper: a matching command supplies its issuer; otherwise this is the actor's own act. */
export function commandBasis(ctx: SimContext, id: ActorId, kinds: readonly string[]): Basis {
  const command = ctx.commands.find((c) => c.actorId === id && kinds.includes(c.kind));
  return command ? { kind: 'command', issuer: command.issuer ?? { kind: 'player' } } : { kind: 'own' };
}

/**
 * Apply a `core.standing_orders` command's settings to an actor's psyche (agency mode and
 * standing orders). The psyche system applies each hour's commands through it; a host may apply
 * the same command at the moment it is given, since settings take no game time (playtest r2).
 */
export function applyStandingOrders(
  world: World,
  actorId: ActorId,
  data: { agencyMode?: AgencyMode; orders: StandingOrders },
): boolean {
  const p = world.psyche.byActor[actorId];
  if (!p) return false;
  delete p.pace;
  if (data.agencyMode) p.agencyMode = data.agencyMode;
  p.standingOrders = {
    ...data.orders,
    activities: [...data.orders.activities],
    ...(data.orders.capabilities ? { capabilities: [...data.orders.capabilities] } : {}),
  };
  return true;
}
