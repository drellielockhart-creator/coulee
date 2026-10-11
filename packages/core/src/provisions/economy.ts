/** Cash, credit and physical goods share one transaction path for commands and errands. */

import { term } from '../explain.ts';
import type { ActorId, HouseholdId, PlaceId } from '../ids.ts';
import { rowsOf } from '../ids.ts';
import { atPlace, carriedBy, createStack, moveStack, pantryOf, stacksDeep, supplyUnits } from '../items/api.ts';
import type { ItemLocation } from '../items/state.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { priceAt, readinessOf } from './api.ts';
import { dailyKcal, foodServings, mealExplain, membersOf } from './meals.ts';
import { RATION_RESTORE_DAYS, RATION_STEPS, SHOPPING, WOODPILE } from './rules.ts';

export function purchase(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  placeId: PlaceId,
  defId: string,
  wanted: number,
  onCredit: boolean,
  to: ItemLocation = carriedBy(actorId),
): number {
  const actor = world.actors[actorId],
    store = world.provisions.stores[placeId];
  const unitPrice = priceAt(world, ctx.content, placeId, defId);
  if (
    !actor?.alive ||
    actor.placeId !== placeId ||
    !store ||
    unitPrice === null ||
    !Number.isInteger(wanted) ||
    wanted <= 0
  )
    return 0;
  const buyer = world.provisions.households[actor.householdId];
  const owner = store.ownerHouseholdId === null ? undefined : world.provisions.households[store.ownerHouseholdId];
  // Buying from one's own shelves is at cost: stock and the kitchen remain distinct.
  const price =
    store.ownerHouseholdId === actor.householdId ? (ctx.content.items[defId]?.value_cents ?? unitPrice) : unitPrice;
  const purse = world.provisions.purses[actorId] ?? 0;
  const cash = purse + (buyer?.cashCents ?? 0);
  const credit = onCredit ? Math.max(0, store.creditLimitCents - (store.tabs[actorId] ?? 0)) : 0;
  let remaining = price > 0 ? Math.min(wanted, Math.floor((cash + credit) / price)) : wanted;
  let bought = 0;
  for (const { stack } of stacksDeep(world, atPlace(placeId))) {
    if (
      stack.defId !== defId ||
      stack.condition <= 0 ||
      stack.spoilage >= 1000 ||
      stack.partial > 0 ||
      (stack.foodPartialPm ?? 0) > 0
    )
      continue;
    const n = Math.min(remaining, stack.qty);
    if (n <= 0) break;
    moveStack(world, ctx, stack.id, n, to);
    bought += n;
    remaining -= n;
  }
  if (!bought) return 0;
  const cost = bought * price;
  let pay = Math.min(cost, cash);
  const pursePay = Math.min(purse, pay);
  world.provisions.purses[actorId] = purse - pursePay;
  pay -= pursePay;
  if (buyer) buyer.cashCents -= pay;
  const cashPaid = Math.min(cost, cash),
    debt = cost - cashPaid;
  if (owner) owner.cashCents += cashPaid;
  else store.tillCents += cashPaid;
  if (debt) store.tabs[actorId] = (store.tabs[actorId] ?? 0) + debt;
  ctx.emit({
    kind: 'provisions.purchase',
    data: { buyerId: actorId, placeId, defId, qty: bought, priceCents: cost, onCredit: debt > 0 },
    roles: [{ actor: actorId, role: 'agent' }],
    visibility: 'private',
    explain: mealExplain('Store transaction', [actorId], cost, [
      term('price', 'Unit price cents', price),
      term('item', 'Quantity', bought),
      term('money', 'Cash transferred cents', cashPaid),
      term('credit', 'Tab increased cents', debt),
    ]),
  });
  return bought;
}

/** A cheap trigger; exact projected days are computed only for household decisions and views. */
export function larderKcal(world: World, ctx: Pick<SimContext, 'content'>, householdId: number): number {
  const h = world.households[householdId];
  if (!h) return 0;
  return stacksDeep(world, pantryOf(h.id)).reduce(
    (n, { stack }) =>
      n +
      Math.round(
        (foodServings(ctx.content, stack) * (ctx.content.items[stack.defId]?.food?.kcal ?? 0)) /
          (ctx.content.items[stack.defId]?.food?.servings ?? 1),
      ),
    0,
  );
}

/** Daily domestic water and gathered fuel, also used by readiness's forward projection. */
export function replenishDomestic(world: World, ctx: SimContext, householdId: HouseholdId): void {
  const household = world.households[householdId];
  const h = world.provisions.households[householdId];
  if (!household || !h || h.lastSuppliesDay === ctx.cal.dayIndex) return;
  h.lastSuppliesDay = ctx.cal.dayIndex;
  const members = membersOf(world, { householdId });
  const fireDef = Object.values(ctx.content.items)
    .filter((d) => d.supply?.kind === 'fire')
    .sort((a, b) => a.value_cents - b.value_cents || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  h.waterMl = members.length * 5000;
  ctx.emit({
    kind: 'provisions.water',
    data: { householdId: household.id, ml: h.waterMl },
    roles: members.map((actor) => ({ actor, role: 'participant' })),
    visibility: 'private',
    explain: mealExplain('Daily domestic water hauling', members, h.waterMl, [
      term('water', 'Cooking water ml per member', 5000),
    ]),
  });
  if (world.provisions.settings.householdWood && fireDef?.supply) {
    const cap = WOODPILE.capPerMember * members.length * fireDef.supply.units;
    const gap = cap - supplyUnits(world, ctx.content, pantryOf(household.id), 'fire');
    const qty = Math.min(WOODPILE.perMemberDay * members.length, Math.max(0, Math.floor(gap / fireDef.supply.units)));
    if (qty) createStack(world, ctx, fireDef.id, qty, pantryOf(household.id));
  }
}

export function householdDay(world: World, ctx: SimContext): void {
  for (const household of rowsOf(world.households)) {
    const h = world.provisions.households[household.id];
    if (!h) continue;
    const members = membersOf(world, { householdId: household.id });
    replenishDomestic(world, ctx, household.id);
    if (world.provisions.settings.wages && ctx.cal.weekday === 'sat') {
      const cents = members.reduce(
        (n, id) => n + (ctx.content.occupations[world.actors[id]?.occupationId ?? '']?.wage_cents_per_day ?? 0) * 6,
        0,
      );
      h.cashCents += cents;
      if (cents)
        ctx.emit({
          kind: 'provisions.wages',
          data: { householdId: household.id, cents },
          roles: members.map((actor) => ({ actor, role: 'beneficiary' })),
          visibility: 'private',
          explain: mealExplain('Six paid workdays', members, cents, [term('economy', 'Weekly wages cents', cents)]),
        });
    }
    if (!world.provisions.settings.autoRations || !members.length) continue;
    const readiness = readinessOf(world, ctx.content, { householdId: household.id }, ctx.now);
    const step = RATION_STEPS.find((s) => readiness.daysOfFoodTenths < s.belowDays * 10);
    const pct = step
      ? Math.min(h.rationPct, step.pct)
      : readiness.daysOfFoodTenths >= RATION_RESTORE_DAYS * 10
        ? 100
        : h.rationPct;
    if (pct < h.rationPct || (readiness.daysOfFoodTenths < 40 && h.lastShortageDay !== ctx.cal.dayIndex)) {
      h.lastShortageDay = ctx.cal.dayIndex;
      ctx.emit({
        kind: 'provisions.shortage',
        data: { householdId: household.id, daysOfFoodTenths: readiness.daysOfFoodTenths, rationPct: pct },
        roles: members.map((actor) => ({ actor, role: 'participant' })),
        visibility: 'private',
        explain: mealExplain(
          'Larder horizon and ration cut',
          members,
          pct,
          [term('food', 'Days of food tenths', readiness.daysOfFoodTenths), term('policy', 'Ration percent', pct)],
          'rations_cut',
        ),
      });
    }
    if (pct > h.rationPct)
      ctx.emit({
        kind: 'provisions.rations',
        data: { actorId: household.headId, householdId: household.id, rationPct: pct },
        roles: members.map((actor) => ({ actor, role: 'participant' })),
        visibility: 'private',
        explain: mealExplain(
          'Full rations restored',
          members,
          pct,
          [term('food', 'Days of food tenths', readiness.daysOfFoodTenths)],
          'restored',
        ),
      });
    h.rationPct = pct;
    h.shortageStep = pct === 100 ? 0 : pct === 90 ? 1 : pct === 75 ? 2 : 3;
  }
  for (const store of rowsOf(world.provisions.stores)) {
    const restock = store.restockId ? ctx.content.restocks?.[store.restockId] : undefined;
    if (
      !restock ||
      ctx.cal.dayIndex === 0 ||
      ctx.cal.dayIndex % restock.every_days !== 0 ||
      store.lastRestockDay === ctx.cal.dayIndex
    )
      continue;
    store.lastRestockDay = ctx.cal.dayIndex;
    const owner = store.ownerHouseholdId === null ? undefined : world.provisions.households[store.ownerHouseholdId];
    for (const line of restock.lines) {
      const have = stacksDeep(world, atPlace(store.placeId))
        .filter((s) => s.stack.defId === line.item)
        .reduce((n, s) => n + s.stack.qty, 0);
      let qty = Math.max(0, Math.min(line.target_qty - have, line.max_delivery ?? line.target_qty));
      if (restock.river_closed_months.includes(ctx.cal.month)) qty = Math.floor((qty * restock.river_closed_pct) / 100);
      if (!qty) continue;
      const cost = Math.round(((ctx.content.items[line.item]?.value_cents ?? 0) * restock.wholesale_pct) / 100) * qty;
      const cash = owner?.cashCents ?? store.tillCents;
      const pay = Math.min(cash, cost);
      if (owner) owner.cashCents -= pay;
      else store.tillCents -= pay;
      store.wholesaleDebtCents += cost - pay;
      createStack(world, ctx, line.item, qty, atPlace(store.placeId));
      ctx.emit({
        kind: 'provisions.restock',
        data: { placeId: store.placeId, defId: line.item, qty, costCents: cost },
        explain: mealExplain('Wholesale delivery', [], cost, [
          term('money', 'Cash paid cents', pay),
          term('credit', 'Wholesale debt cents', cost - pay),
        ]),
      });
    }
  }
}

/** A shopping activity brings the buyer physically to a store; activity owns all travel. */
export function shoppingHour(world: World, ctx: SimContext): void {
  if (!world.provisions.settings.npcBuying) return;
  for (const household of rowsOf(world.households)) {
    const h = world.provisions.households[household.id];
    const buyer = world.actors[household.headId];
    if (!h || !buyer?.alive || !world.provisions.stores[buyer.placeId]) continue;
    const need = membersOf(world, { householdId: household.id }).reduce(
      (n, id) => n + dailyKcal(world, ctx.content, id, ctx.now),
      0,
    );
    let missing = SHOPPING.targetDays * need - larderKcal(world, ctx, household.id);
    if (missing < (SHOPPING.targetDays - SHOPPING.triggerDays) * need) continue;
    const stock = stacksDeep(world, atPlace(buyer.placeId))
      .map((s) => s.stack)
      .filter((s) => (ctx.content.items[s.defId]?.food?.kcal ?? 0) > 0);
    stock.sort((a, b) => {
      const af = ctx.content.items[a.defId],
        bf = ctx.content.items[b.defId];
      const ap = priceAt(world, ctx.content, buyer.placeId, a.defId) ?? 0,
        bp = priceAt(world, ctx.content, buyer.placeId, b.defId) ?? 0;
      return ap * (bf?.food?.kcal ?? 1) - bp * (af?.food?.kcal ?? 1) || a.id - b.id;
    });
    for (const s of stock) {
      if (missing <= 0) break;
      const kcal = ctx.content.items[s.defId]?.food?.kcal ?? 0;
      const bought = purchase(
        world,
        ctx,
        buyer.id,
        buyer.placeId,
        s.defId,
        Math.ceil(missing / Math.max(1, kcal)),
        true,
        pantryOf(household.id),
      );
      missing -= bought * kcal;
    }
  }
}
