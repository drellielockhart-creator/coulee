/** Venue trade and board use the same prices and admission rules for every actor. */
import { hourInBlock } from '../activity/api.ts';
import type { ContentBundle } from '../content.ts';
import type { ActorId, PlaceId } from '../ids.ts';
import { authorizeAct, chosenUrge, recordStandingSpend, standingOrders } from '../psyche/api.ts';
import { processingActors } from '../region/processing.ts';
import type { SimContext } from '../sim/context.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { cashOf, transferCash } from './economy.ts';
import { mealExplain, serveMeal } from './meals.ts';

export function serviceAt(world: World, content: ContentBundle, placeId: PlaceId) {
  return Object.values(content.venueServices ?? {}).find((s) => world.places[placeId]?.tags.includes(s.place_tag));
}
export function storeOpen(world: World, content: ContentBundle, placeId: PlaceId, at = world.time): boolean {
  const service = serviceAt(world, content, placeId);
  return !service || hourInBlock(calendarAt(asGameMinute(at)).hour, service.opens, service.closes);
}
function keeperAt(world: World, content: ContentBundle, placeId: PlaceId) {
  const service = serviceAt(world, content, placeId);
  return processingActors(world).find(
    (a) =>
      a.alive &&
      content.occupations[a.occupationId]?.roles.includes(service?.keeper_role ?? '') &&
      world.households[a.householdId]?.homePlaceId === placeId,
  );
}
function reject(_world: World, ctx: SimContext, actorId: ActorId, reason: string): false {
  ctx.emit({
    kind: 'provisions.command_rejected',
    data: { actorId, command: 'board', reason },
    roles: [{ actor: actorId, role: 'agent' }],
    visibility: 'private',
    explain: mealExplain(reason, [actorId], 0, [], 'rejected'),
  });
  return false;
}
/**
 * Who may pay for a bed: their own choice, an order, or the standing sleep order at their own
 * lodgings (with the lodging order on). A standing order never rents a bed elsewhere.
 */
function bedAuthorized(world: World, actorId: ActorId, placeId: PlaceId, cents: number): boolean {
  return (
    authorizeAct(world, actorId, { kind: 'consequential' }, { kind: 'own' }).ok ||
    chosenUrge(world, actorId)?.voice === 'command' ||
    standingBed(world, actorId, placeId, cents)
  );
}
/** The standing route: sleep and lodging orders, one's own lodgings, a bounded daily spend. */
function standingBed(world: World, actorId: ActorId, placeId: PlaceId, cents: number): boolean {
  const actor = world.actors[actorId];
  return (
    standingOrders(world, actorId).lodging &&
    world.households[actor?.householdId ?? -1]?.homePlaceId === placeId &&
    authorizeAct(world, actorId, { kind: 'sleep' }, { kind: 'standing', capability: 'sleep' }).ok &&
    authorizeAct(world, actorId, { kind: 'transfer', cents }, { kind: 'standing', capability: STANDING_BED }).ok
  );
}
const STANDING_BED = 'pay_lodging';
/**
 * A bed is paid once per overnight stay, until noon after the coming night. This only admits:
 * the charge falls in the provisions hour, once the sleeper is actually in the bed (B15).
 */
export function admitSleep(world: World, ctx: SimContext, actorId: ActorId, placeId: PlaceId): boolean {
  const service = serviceAt(world, ctx.content, placeId);
  if (service?.bed_cents === undefined) return true;
  const keeper = keeperAt(world, ctx.content, placeId);
  if (!keeper) return reject(world, ctx, actorId, 'No host can let a bed here');
  if (keeper.householdId === world.actors[actorId]?.householdId) return true;
  const bed = world.provisions.beds?.[actorId];
  if (bed?.placeId === placeId && bed.until > ctx.now) return true;
  if (!bedAuthorized(world, actorId, placeId, service.bed_cents)) return false;
  if (cashOf(world, actorId) < service.bed_cents)
    return reject(world, ctx, actorId, 'Cannot afford a bed; seek another place to sleep');
  return true;
}
/** Charge whoever is asleep in a let bed this hour without one paid through now. */
export function settleBeds(world: World, ctx: SimContext): void {
  for (const actor of processingActors(world)) {
    const state = world.activity.byActor[actor.id];
    if (
      !actor.alive ||
      state?.travel ||
      !ctx.content.activities[state?.activityId ?? '']?.asleep ||
      ctx.content.activities[state?.activityId ?? '']?.tags.includes('camp')
    )
      continue;
    const service = serviceAt(world, ctx.content, actor.placeId);
    if (service?.bed_cents === undefined) continue;
    const keeper = keeperAt(world, ctx.content, actor.placeId);
    const bed = world.provisions.beds?.[actor.id];
    if (!keeper || keeper.householdId === actor.householdId || (bed?.placeId === actor.placeId && bed.until > ctx.now))
      continue;
    const own =
      authorizeAct(world, actor.id, { kind: 'consequential' }, { kind: 'own' }).ok ||
      chosenUrge(world, actor.id)?.voice === 'command';
    const standing = !own && standingBed(world, actor.id, actor.placeId, service.bed_cents);
    const paid =
      (own || standing) && cashOf(world, actor.id) >= service.bed_cents
        ? transferCash(
            world,
            ctx,
            actor.id,
            keeper.id,
            service.bed_cents,
            'Tavern bed',
            undefined,
            standing ? { kind: 'standing', capability: STANDING_BED } : undefined,
          )
        : 0;
    if (paid < service.bed_cents) {
      reject(world, ctx, actor.id, 'Cannot pay for the bed; sleeping rough in the common room');
      continue;
    }
    if (standing) recordStandingSpend(world, actor.id, STANDING_BED, paid);
    world.provisions.beds ??= {};
    world.provisions.beds[actor.id] = {
      placeId: actor.placeId,
      until: (ctx.cal.dayIndex + (ctx.cal.hour < 12 ? 0 : 1)) * 1440 + 720,
    };
  }
}
/** A bought meal consumes the host's real pantry and cooking resources before money changes hands. */
export function boardMeal(world: World, ctx: SimContext, actorId: ActorId): boolean {
  if (
    !authorizeAct(world, actorId, { kind: 'consequential' }, { kind: 'own' }).ok &&
    !ctx.commands.some(
      (c) =>
        c.actorId === actorId &&
        (c.kind === 'provisions.board_meal' ||
          (c.kind === 'core.urge' && c.data.urge.kind === 'activity' && c.data.urge.activityId === 'take_meal')),
    )
  )
    return false;
  const actor = world.actors[actorId];
  if (!actor?.alive) return false;
  const service = serviceAt(world, ctx.content, actor.placeId);
  const keeper = keeperAt(world, ctx.content, actor.placeId);
  if (!keeper || service?.meal_cents === undefined || !storeOpen(world, ctx.content, actor.placeId)) return false;
  if (world.provisions.nutrition[actorId]?.lastMealAt === ctx.now) return false;
  // The host household uses its ordinary scheduled meals, not a second boarding portion.
  if (keeper.householdId === actor.householdId || cashOf(world, actorId) < service.meal_cents) return false;
  const report = serveMeal(
    world,
    ctx,
    { householdId: keeper.householdId },
    [actorId],
    service.meal_share_pct ?? 35,
    false,
  );
  if (report.kcal <= 0) return false;
  transferCash(world, ctx, actorId, keeper.id, service.meal_cents, 'Tavern meal');
  return true;
}

/** Zero-time meal refusal; pantry/preparation failure is still checked by the real executor. */
export function boardMealAvailability(world: World, content: ContentBundle, actorId: ActorId): string | null {
  const actor = world.actors[actorId];
  if (!actor) return 'No diner';
  const service = serviceAt(world, content, actor.placeId);
  if (service?.meal_cents === undefined) return 'No meals sold here';
  if (!storeOpen(world, content, actor.placeId)) return 'No meal available: the kitchen is closed';
  if (cashOf(world, actorId) < service.meal_cents) return 'Cannot afford a tavern meal';
  if (world.provisions.nutrition[actorId]?.lastMealAt === world.time) return 'You have already eaten this hour';
  if (world.provisions.pendingMeals?.some((m) => m.plates.some((p) => p.id === actorId)))
    return 'Your meal is already being prepared';
  return null;
}
