/** Actor policy, independent of controller. Missing fields preserve legacy psyche saves/hashes. */
import type { ActorId } from '../ids.ts';
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
  return world.psyche.byActor[id]?.agencyMode ?? 'psyche';
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
  if (orders.activities.includes(urge.activityId)) return true;
  const def = ctx.content.activities[urge.activityId];
  if (!def) return false;
  const night = ctx.cal.hour >= 21 || ctx.cal.hour < 6;
  if (def.asleep) return orders.sleep && night && needValue(world, id, 'rest') < 750;
  if (urge.activityId === 'take_meal') return orders.eat && needValue(world, id, 'hunger') < 600;
  if (urge.activityId === 'fetch_water') return orders.drink && needValue(world, id, 'thirst') < 600;
  return orders.warmth && (def.needs.warmth ?? 0) > 0 && needValue(world, id, 'warmth') < 500;
}
