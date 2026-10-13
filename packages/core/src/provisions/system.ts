import { onJourney } from '../activity/api.ts';
import { productionHour } from '../activity/production.ts';
/** Meals, household economy, nutrition, storage and scheduled supplies; sixth in the hourly schedule. */
import { commandsFor } from '../command.ts';
import { commitHems, hemSet } from '../fae/hem.ts';
import { type ActorId, rowsOf } from '../ids.ts';
import { carriedBy, inventoryIndex, moveStack, withInventoryPass } from '../items/api.ts';
import { rootLocation } from '../items/containers.ts';
import { canAct, needValue } from '../needs/api.ts';
import { authorizeAct, chosenUrge, standingOrders } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { autonomousProvisioning } from './agency.ts';
import {
  boardMeal,
  drinkWater,
  emptyCheck,
  emptyVessel,
  refillCheck,
  refillWater,
  sell,
  storeOpen,
  waterHour,
} from './api.ts';
import { householdDay, purchase, shoppingHour } from './economy.ts';
import { employmentHour } from './employment.ts';
import { devicesHour, storageHour } from './environment.ts';
import {
  accessibleStack,
  awaitingMeal,
  dueMeal,
  foodServings,
  type Holder,
  holderOfActor,
  lightCampfire,
  mealExplain,
  preparationHour,
  serveMeal,
} from './meals.ts';
import { nutritionHour } from './nutrition.ts';
import { STANDING_FULL } from './rules.ts';
import { settleBeds } from './services.ts';

const clock = (t: number) =>
  `${String(Math.floor((t % 1440) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

export function provisionsSystem(world: World, ctx: SimContext, forecast?: ProvisionForecast): void {
  withInventoryPass(world, () => provisionsHour(world, ctx, forecast));
}
interface ProvisionForecast {
  hems: import('../fae/hem.ts').HemSet;
  vermin?: (food: string, riskPm: number) => void;
  preparation?: (label: string) => void;
}
function provisionsHour(world: World, ctx: SimContext, forecast?: ProvisionForecast): void {
  employmentHour(world, ctx);
  productionHour(world, ctx);
  settleBeds(world, ctx);
  for (const actor of rowsOf(world.actors)) {
    const activity = world.activity.byActor[actor.id];
    if (
      canAct(world, actor.id) &&
      !activity?.travel &&
      activity?.activityId &&
      ctx.content.activities[activity.activityId]?.tags.includes('campfire') &&
      activity.since === ctx.now
    )
      lightCampfire(world, ctx, actor.id);
  }
  nutritionHour(world, ctx);
  if (ctx.isNewDay) householdDay(world, ctx);
  const hems = forecast?.hems ?? (world.fae?.charms ? hemSet(world, ctx.content) : undefined);
  storageHour(world, ctx, undefined, hems, forecast?.vermin);
  if (hems && !forecast) commitHems(world, ctx, hems);
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
        if (!refillWater(world, ctx, actor.id, cmd.data.itemId, cmd.data.ml)) {
          const check = refillCheck(world, ctx.content, actor.id, cmd.data.itemId, cmd.data.ml);
          reject('reason' in check ? check.reason : 'Cannot fill that vessel here');
        }
        break;
      case 'provisions.empty':
        if (!emptyVessel(world, ctx, actor.id, cmd.data.itemId)) {
          const check = emptyCheck(world, ctx.content, actor.id, cmd.data.itemId);
          reject('reason' in check ? check.reason : 'Cannot pour that out');
        }
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
        // Say which: a plate is cooking right here, the food is elsewhere, or the count is wrong.
        // A plate waiting at another place does not stop her eating from her pack.
        const waiting = (world.provisions.pendingMeals ?? []).find(
          (m) => m.placeId === actor.placeId && m.plates.some((p) => p.id === actor.id),
        );
        const why = !stack
          ? 'That food is gone'
          : !accessibleStack(world, actor.id, stack)
            ? 'That food is not in your pack, nor in your pantry here'
            : !Number.isInteger(cmd.data.servings) ||
                cmd.data.servings <= 0 ||
                cmd.data.servings > foodServings(ctx.content, stack)
              ? 'Not that many servings left'
              : ate.has(actor.id)
                ? 'You have already eaten this hour'
                : waiting
                  ? `Your meal here is still being prepared (ready at ${clock(waiting.completesAt)}); wait for it`
                  : null;
        if (why || !stack) {
          reject(why ?? 'That food is gone');
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
  const groups: Array<{
    holder: Holder;
    actors: ActorId[];
    share: number;
    cold: boolean;
    standing: boolean;
    cap: Record<number, number>;
  }> = [];
  const perPoint = ctx.content.needs.hunger?.intake?.per_point ?? 3;
  for (const actor of rowsOf(world.actors)) {
    if (
      !canAct(world, actor.id) ||
      awaitingMeal(world, actor.id, actor.placeId) ||
      ate.has(actor.id) ||
      world.provisions.nutrition[actor.id]?.lastMealAt === ctx.now
    )
      continue;
    // Held for orders: the standing eat order feeds them from their own stores (the pack, and the
    // household larder when home: what foodSeekingUrge offers), at the meals, unless nearly full.
    const held = !authorizeAct(world, actor.id, { kind: 'consequential' }, { kind: 'own' }).ok;
    if (held && !standingOrders(world, actor.id).eat) continue;
    const hunger = needValue(world, actor.id, 'hunger');
    const holder = holderOfActor(world, actor.id),
      meal = dueMeal(world, ctx.content, held ? { actorId: actor.id } : holder, ctx.cal.hour);
    const urge = chosenUrge(world, actor.id);
    const eating =
      !onJourney(world, actor.id) && urge?.urge.kind === 'activity' && urge.urge.activityId === 'take_meal';
    if (!meal && !eating) continue;
    if (held && hunger >= (meal ? STANDING_FULL : 600)) continue;
    // A chosen meal between scheduled meals is a snack; avoid a second full meal within three hours.
    if (!meal && ctx.now - (world.provisions.nutrition[actor.id]?.lastMealAt ?? -10000) < 180) continue;
    if (eating && autonomousProvisioning(world, actor.id) && boardMeal(world, ctx, actor.id)) continue;
    const group = groups.find(
      (g) =>
        !held &&
        !g.standing &&
        'householdId' in holder &&
        'householdId' in g.holder &&
        holder.householdId === g.holder.householdId,
    );
    if (group) group.actors.push(actor.id);
    else
      groups.push({
        holder,
        actors: [actor.id],
        share: meal?.share_pct ?? 30,
        cold: meal?.cold ?? false,
        standing: held,
        // An order never gorges: the plate is sized to the room left in the hunger meter.
        cap: held ? { [actor.id]: Math.max(0, (1000 - hunger) * perPoint) } : {},
      });
  }
  const pass = { inventory: inventoryIndex(world), energy: new Map<string, number>() };
  for (const group of groups)
    serveMeal(world, ctx, group.holder, group.actors, group.share, group.cold, undefined, pass, undefined, {
      ...(group.standing ? { capKcal: group.cap, standing: true } : {}),
      forecastCheck: forecast?.preparation,
    });
  devicesHour(world, ctx);
}
