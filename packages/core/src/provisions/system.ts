/** Meals, household economy, nutrition, storage and scheduled supplies; sixth in the hourly schedule. */
import { commandsFor } from '../command.ts';
import { type ActorId, rowsOf } from '../ids.ts';
import { carriedBy, inventoryIndex, moveStack } from '../items/api.ts';
import { rootLocation } from '../items/containers.ts';
import { chosenUrge } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { boardMeal, drinkWater, refillWater, sell, storeOpen, waterHour } from './api.ts';
import { householdDay, purchase, shoppingHour } from './economy.ts';
import { devicesHour, storageHour } from './environment.ts';
import {
  accessibleStack,
  awaitingMeal,
  dueMeal,
  type Holder,
  holderOfActor,
  mealExplain,
  preparationHour,
  serveMeal,
} from './meals.ts';
import { nutritionHour } from './nutrition.ts';

export function provisionsSystem(world: World, ctx: SimContext): void {
  nutritionHour(world, ctx);
  if (ctx.isNewDay) householdDay(world, ctx);
  storageHour(world, ctx);
  preparationHour(world, ctx);
  const ate = new Set<ActorId>();
  for (const cmd of commandsFor(ctx.commands, 'provisions.')) {
    const actor = world.actors[cmd.actorId];
    const reject = (reason: string) =>
      ctx.emit({
        kind: 'provisions.command_rejected',
        data: { actorId: cmd.actorId, command: cmd.kind, reason },
        roles: [{ actor: cmd.actorId, role: 'agent' }],
        visibility: 'private',
        explain: mealExplain(reason, [cmd.actorId], 0, [], 'rejected'),
      });
    if (!actor?.alive) {
      reject('Actor is not alive');
      continue;
    }
    switch (cmd.kind) {
      case 'provisions.board_meal':
        if (boardMeal(world, ctx, actor.id)) ate.add(actor.id);
        else reject('No meal available: closed, insufficient cash, or kitchen supplies exhausted');
        break;
      case 'provisions.refill':
        if (!refillWater(world, ctx, actor.id, cmd.data.itemId, cmd.data.ml))
          reject('Cannot refill: no accessible source or vessel capacity');
        break;
      case 'provisions.drink':
        if (!drinkWater(world, ctx, actor.id, cmd.data.ml)) reject('Not enough accessible water');
        break;
      case 'provisions.sell':
        if (!sell(world, ctx, actor.id, cmd.data.placeId, cmd.data.itemId, cmd.data.qty))
          reject('Store cannot buy these goods');
        break;
      case 'provisions.buy':
        if (!storeOpen(world, ctx.content, cmd.data.placeId)) {
          reject('The shop is closed');
          break;
        }
        if (!purchase(world, ctx, actor.id, cmd.data.placeId, cmd.data.defId, cmd.data.qty, cmd.data.onCredit))
          reject('Cannot buy: location, stock, cash, or credit limit');
        break;
      case 'provisions.eat': {
        const stack = world.items.stacks[cmd.data.itemId];
        if (
          !stack ||
          !accessibleStack(world, actor.id, stack) ||
          !Number.isInteger(cmd.data.servings) ||
          cmd.data.servings <= 0 ||
          ate.has(actor.id) ||
          awaitingMeal(world, actor.id)
        ) {
          reject('Food is inaccessible or servings are invalid');
          break;
        }
        const holder =
          rootLocation(world, stack).kind === 'actor' ? { actorId: actor.id } : holderOfActor(world, actor.id);
        const report = serveMeal(world, ctx, holder, [actor.id], 25, false, cmd.data);
        if (report.kcal > 0 || world.provisions.nutrition[actor.id]?.lastMealAt === ctx.now) ate.add(actor.id);
        else reject('No usable preparation with this kit');
        break;
      }
      case 'provisions.set_rations': {
        if (!Number.isInteger(cmd.data.rationPct) || cmd.data.rationPct < 10 || cmd.data.rationPct > 150) {
          reject('Rations must be an integer percent from 10 to 150');
          break;
        }
        const hid = cmd.data.householdId;
        if (hid !== null) {
          if (actor.householdId !== hid || !world.provisions.households[hid]) {
            reject('Cannot set another household’s rations');
            break;
          }
          const h = world.provisions.households[hid];
          if (h) h.rationPct = cmd.data.rationPct;
        } else {
          const n = world.provisions.nutrition[actor.id];
          if (n) n.rationPct = cmd.data.rationPct;
        }
        ctx.emit({
          kind: 'provisions.rations',
          data: { actorId: actor.id, householdId: hid, rationPct: cmd.data.rationPct },
          roles: [{ actor: actor.id, role: 'agent' }],
          visibility: 'private',
          explain: mealExplain('Set ration policy', [actor.id], cmd.data.rationPct),
        });
        break;
      }
      case 'provisions.pack': {
        const stack = world.items.stacks[cmd.data.itemId];
        const container = cmd.data.intoItemId === null ? undefined : world.items.stacks[cmd.data.intoItemId];
        if (
          !stack ||
          !accessibleStack(world, actor.id, stack) ||
          (cmd.data.intoItemId !== null && (!container || !accessibleStack(world, actor.id, container))) ||
          !Number.isInteger(cmd.data.qty) ||
          cmd.data.qty <= 0 ||
          cmd.data.qty > stack.qty
        ) {
          reject('Packing requires accessible items and a valid quantity');
          break;
        }
        try {
          moveStack(
            world,
            ctx,
            stack.id,
            cmd.data.qty,
            container ? { kind: 'container', itemId: container.id } : carriedBy(actor.id),
          );
        } catch (error) {
          reject(error instanceof Error ? error.message : 'Cannot pack');
        }
        break;
      }
    }
  }
  waterHour(world, ctx);
  shoppingHour(world, ctx);
  const groups: Array<{ holder: Holder; actors: ActorId[]; share: number; cold: boolean }> = [];
  for (const actor of rowsOf(world.actors)) {
    if (
      !actor.alive ||
      awaitingMeal(world, actor.id) ||
      ate.has(actor.id) ||
      world.provisions.nutrition[actor.id]?.lastMealAt === ctx.now
    )
      continue;
    const holder = holderOfActor(world, actor.id),
      meal = dueMeal(world, ctx.content, holder, ctx.cal.hour);
    const urge = chosenUrge(world, actor.id);
    const eating = urge?.urge.kind === 'activity' && urge.urge.activityId === 'take_meal';
    if (!meal && !eating) continue;
    // A chosen meal between scheduled meals is a snack; avoid a second full meal within three hours.
    if (!meal && ctx.now - (world.provisions.nutrition[actor.id]?.lastMealAt ?? -10000) < 180) continue;
    if (eating && boardMeal(world, ctx, actor.id)) continue;
    const group = groups.find(
      (g) => 'householdId' in holder && 'householdId' in g.holder && holder.householdId === g.holder.householdId,
    );
    if (group) group.actors.push(actor.id);
    else groups.push({ holder, actors: [actor.id], share: meal?.share_pct ?? 30, cold: meal?.cold ?? false });
  }
  const pass = { inventory: inventoryIndex(world), energy: new Map<string, number>() };
  for (const group of groups)
    serveMeal(world, ctx, group.holder, group.actors, group.share, group.cold, undefined, pass);
  devicesHour(world, ctx);
}
