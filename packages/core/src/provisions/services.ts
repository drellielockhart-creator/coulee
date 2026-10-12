/** Venue trade and board use the same prices and admission rules for every actor. */
import { hourInBlock } from '../activity/api.ts';
import type { ContentBundle } from '../content.ts';
import { type ActorId, type PlaceId, rowsOf } from '../ids.ts';
import { authorizeAct, chosenUrge } from '../psyche/api.ts';
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
  return rowsOf(world.actors).find(
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
/** A bed is paid once per overnight stay, until noon after the coming night. */
export function admitSleep(world: World, ctx: SimContext, actorId: ActorId, placeId: PlaceId): boolean {
  const service = serviceAt(world, ctx.content, placeId);
  if (service?.bed_cents === undefined) return true;
  const keeper = keeperAt(world, ctx.content, placeId);
  if (!keeper) return reject(world, ctx, actorId, 'No host can let a bed here');
  if (keeper.householdId === world.actors[actorId]?.householdId) return true;
  const bed = world.provisions.beds?.[actorId];
  if (bed?.placeId === placeId && bed.until > ctx.now) return true;
  if (
    !authorizeAct(world, actorId, { kind: 'consequential' }, { kind: 'own' }).ok &&
    chosenUrge(world, actorId)?.voice !== 'command'
  )
    return false;
  if (cashOf(world, actorId) < service.bed_cents)
    return reject(world, ctx, actorId, 'Cannot afford a bed; seek another place to sleep');
  transferCash(world, ctx, actorId, keeper.id, service.bed_cents, 'Tavern bed');
  world.provisions.beds ??= {};
  world.provisions.beds[actorId] = { placeId, until: (ctx.cal.dayIndex + (ctx.cal.hour < 12 ? 0 : 1)) * 1440 + 720 };
  return true;
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
