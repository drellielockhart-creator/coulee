/** Actor policy, independent of controller. Missing fields preserve legacy psyche saves/hashes. */
import type { ActorId, ItemId } from '../ids.ts';
import { needValue } from '../needs/api.ts';
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
  return agencyMode(world, id) === 'psyche';
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
  if (urge.activityId === 'take_meal') return can('eat_own_stores') && needValue(world, id, 'hunger') < 600;
  if (urge.activityId === 'fetch_water') return can('drink') && needValue(world, id, 'thirst') < 600;
  return can('keep_warm') && (def.needs.warmth ?? 0) > 0 && needValue(world, id, 'warmth') < 500;
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
}
export interface AgencyState {
  mode: AgencyMode | 'fits';
  issuer: Issuer | null;
  standing: StandingId[];
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
  if (p) p.agency = state;
}
export function authorizeAct(
  world: World,
  id: ActorId,
  act: Act,
  basis: Basis,
): { ok: true } | { ok: false; reason: string } {
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
  const defaults: Record<string, boolean> = {
    sleep: orders.sleep,
    eat_own_stores: orders.eat,
    drink: orders.drink,
    keep_warm: orders.warmth,
    go_home: orders.lodging,
    shelter: orders.lodging,
  };
  const granted =
    defaults[basis.capability] === true ||
    policy.standing.includes(basis.capability) ||
    orders.activities.includes(basis.capability);
  return granted && act.kind === basis.capability
    ? { ok: true }
    : { ok: false, reason: `No standing capability for ${act.kind}` };
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
