import { authorizeAct, commandBasis, recordStandingSpend } from '../psyche/api.ts';
/** Cash, credit and physical goods share one transaction path for commands and errands. */

import { isShunning } from '../belief/api.ts';
import type { ContentBundle, ItemDef } from '../content.ts';
import { term } from '../explain.ts';
import type { ActorId, EventId, HouseholdId, PlaceId } from '../ids.ts';
import { rowsOf } from '../ids.ts';
import { atPlace, carriedBy, createStack, moveStack, pantryOf, stacksDeep, supplyUnits } from '../items/api.ts';
import type { ItemLocation } from '../items/state.ts';
import { canAct } from '../needs/api.ts';
import type { SimContext } from '../sim/context.ts';
import { debtOf, extendCredit } from '../social/api.ts';
import type { World } from '../world.ts';
import { priceAt, readinessOf } from './api.ts';
import {
  dailyKcal,
  foodServings,
  holderStacks,
  kitchenOf,
  mealExplain,
  membersOf,
  prepBudget,
  recipesFor,
} from './meals.ts';
import { nutritionTargets } from './nutrition.ts';
import { RATION_RESTORE_DAYS, RATION_STEPS, SHUNNED, shoppingDays, WOODPILE } from './rules.ts';
import { storeOpen } from './services.ts';

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
  let basis = commandBasis(ctx, actorId, ['provisions.buy']);
  if (!authorizeAct(world, actorId, { kind: 'purchase' }, basis).ok) {
    if (
      !authorizeAct(
        world,
        actorId,
        { kind: 'purchase', cents: 0, itemTags: ['food'] },
        { kind: 'standing', capability: 'buy_staples' },
      ).ok
    )
      return 0;
    basis = { kind: 'standing', capability: 'buy_staples' };
  }
  synchronizeStoreTabs(world);
  const actor = world.actors[actorId],
    store = world.provisions.stores[placeId];
  const unitPrice = priceAt(world, ctx.content, placeId, defId);
  if (
    !canAct(world, actorId) ||
    !actor ||
    actor.placeId !== placeId ||
    !store ||
    !storeOpen(world, ctx.content, placeId, ctx.now) ||
    unitPrice === null ||
    !Number.isInteger(wanted) ||
    wanted <= 0
  )
    return 0;
  const buyer = world.provisions.households[actor.householdId];
  const owner = store.ownerHouseholdId === null ? undefined : world.provisions.households[store.ownerHouseholdId];
  // A storekeeper who shuns the buyer (04 §9.2 rung 3) refuses credit and asks a hard price.
  const keeper = store.ownerHouseholdId === null ? undefined : world.households[store.ownerHouseholdId]?.headId;
  const shunned = keeper !== undefined && keeper !== actorId && isShunning(world, keeper, actorId);
  // Buying from one's own shelves is at cost: stock and the kitchen remain distinct.
  const listPrice =
    store.ownerHouseholdId === actor.householdId ? (ctx.content.items[defId]?.value_cents ?? unitPrice) : unitPrice;
  const price = shunned ? Math.round((listPrice * SHUNNED.markupPct) / 100) : listPrice;
  const purse = world.provisions.purses[actorId] ?? 0;
  const cash = purse + (buyer?.cashCents ?? 0);
  const credit =
    onCredit && !shunned && keeper !== undefined ? Math.max(0, store.creditLimitCents - (store.tabs[actorId] ?? 0)) : 0;
  let remaining = price > 0 ? Math.min(wanted, Math.floor((cash + credit) / price)) : wanted;
  if (basis.kind === 'standing') {
    const itemTags = [...(ctx.content.items[defId]?.tags ?? []), ...(ctx.content.items[defId]?.food ? ['food'] : [])];
    // A bounded order never opens credit; shrink the basket to its remaining allowance.
    remaining =
      price > 0
        ? Math.min(
            remaining,
            Math.floor(cash / price),
            Math.floor((world.psyche.standingCapabilities?.[basis.capability]?.max_cents ?? 0) / price),
          )
        : remaining;
    while (
      remaining > 0 &&
      !authorizeAct(world, actorId, { kind: 'purchase', cents: remaining * price, itemTags }, basis).ok
    )
      remaining--;
  }
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
  if (basis.kind === 'standing') recordStandingSpend(world, actorId, basis.capability, cost);
  let pay = Math.min(cost, cash);
  const pursePay = Math.min(purse, pay);
  world.provisions.purses[actorId] = purse - pursePay;
  pay -= pursePay;
  if (buyer) buyer.cashCents -= pay;
  const cashPaid = Math.min(cost, cash),
    debt = cost - cashPaid;
  if (owner) owner.cashCents += cashPaid;
  else store.tillCents += cashPaid;
  if (debt) {
    if (keeper !== undefined) {
      extendCredit(world, ctx, keeper, actorId, debt);
      store.tabs[actorId] = debtOf(world, keeper, actorId).cents;
    }
  }
  ctx.emit({
    kind: 'provisions.purchase',
    data: { buyerId: actorId, placeId, defId, qty: bought, priceCents: cost, onCredit: debt > 0 },
    roles: [{ actor: actorId, role: 'agent' }],
    visibility: 'private',
    explain: mealExplain('Store transaction', [actorId], cost, [
      term('price', 'Unit price cents', listPrice),
      ...(shunned
        ? [
            term('belief', 'Shunned: the storekeeper’s price', price - listPrice),
            term('credit', 'Shunned: no credit', 0),
          ]
        : []),
      term('item', 'Quantity', bought),
      term('money', 'Cash transferred cents', cashPaid),
      term('credit', 'Goods charged to money ledger cents', debt),
      term('credit', 'Outstanding store account cents', store.tabs[actorId] ?? 0),
    ]),
  });
  return bought;
}

/** Cash an actor can lay hands on: their own purse plus their household's cash box. */
export function cashOf(world: World, actorId: ActorId): number {
  const a = world.actors[actorId];
  const h = a ? world.provisions.households[a.householdId] : undefined;
  return (world.provisions.purses[actorId] ?? 0) + Math.max(0, h?.cashCents ?? 0);
}

/**
 * Move up to `cents` from one actor to another (a loan, a repayment, a gift of money): the payer's
 * purse first, then their household's cash; it lands in the payee's household cash box (or purse
 * when they have none). Returns the cents actually moved; logs `provisions.cash_transfer` with
 * the math. The ledger of who owes whom is social's; this is only the money.
 */
export function transferCash(
  world: World,
  ctx: SimContext,
  fromId: ActorId,
  toId: ActorId,
  cents: number,
  reason: string,
  causeEventId?: number,
  basis?: import('../psyche/api.ts').Basis,
): number {
  if (
    !authorizeAct(
      world,
      fromId,
      { kind: 'transfer', targetId: toId, cents },
      basis ?? commandBasis(ctx, fromId, ['core.urge', 'social.answer_request', 'provisions.board_meal']),
    ).ok
  )
    return 0;
  const from = world.actors[fromId];
  const to = world.actors[toId];
  const wanted = Math.max(0, Math.floor(cents));
  if (!from?.alive || !to || fromId === toId || wanted === 0) return 0;
  const purse = world.provisions.purses[fromId] ?? 0;
  const fromHh = world.provisions.households[from.householdId];
  const moved = Math.min(wanted, purse + Math.max(0, fromHh?.cashCents ?? 0));
  if (moved <= 0) return 0;
  const fromPurse = Math.min(purse, moved);
  world.provisions.purses[fromId] = purse - fromPurse;
  if (fromHh && moved > fromPurse) fromHh.cashCents -= moved - fromPurse;
  const toHh = from.householdId === to.householdId ? fromHh : world.provisions.households[to.householdId];
  if (toHh) toHh.cashCents += moved;
  else world.provisions.purses[toId] = (world.provisions.purses[toId] ?? 0) + moved;
  ctx.emit({
    kind: 'provisions.cash_transfer',
    data: { fromId, toId, cents: moved, wantedCents: wanted, reason },
    roles: [
      { actor: fromId, role: 'agent' },
      { actor: toId, role: 'beneficiary' },
    ],
    visibility: 'private',
    ...(causeEventId !== undefined ? { causes: [causeEventId as EventId] } : {}),
    explain: mealExplain(reason, [fromId, toId], moved, [
      term('money', 'Cents asked', wanted),
      term('money', 'From the purse', fromPurse),
      term('money', 'From the household cash', moved - fromPurse),
    ]),
  });
  return moved;
}

/** A cheap trigger; exact projected days are computed only for household decisions and views. */
export function larderKcal(world: World, ctx: Pick<SimContext, 'content'>, householdId: number): number {
  const h = world.households[householdId];
  if (!h) return 0;
  return holderStacks(world, { householdId: h.id }).reduce(
    (n, stack) =>
      n +
      Math.round(
        (foodServings(ctx.content, stack) * (ctx.content.items[stack.defId]?.food?.kcal ?? 0)) /
          (ctx.content.items[stack.defId]?.food?.servings ?? 1),
      ),
    0,
  );
}

/** Single-slot memo (content is immutable for a run; not world state, so determinism is unaffected). */
let fuelMemo: { content: ContentBundle; def: ItemDef | undefined } | null = null;

/** The cheapest fire supply in the catalog: what a household gathers or splits for its woodpile. */
export function cheapestFuel(content: ContentBundle): ItemDef | undefined {
  if (fuelMemo?.content === content) return fuelMemo.def;
  const def = Object.values(content.items)
    .filter((d) => d.supply?.kind === 'fire')
    .sort((a, b) => a.value_cents - b.value_cents || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  fuelMemo = { content, def };
  return def;
}

/** Daily domestic water and gathered fuel, also used by readiness's forward projection. */
export function replenishDomestic(world: World, ctx: SimContext, householdId: HouseholdId): void {
  const household = world.households[householdId];
  const h = world.provisions.households[householdId];
  if (!household || !h || h.lastSuppliesDay === ctx.cal.dayIndex) return;
  h.lastSuppliesDay = ctx.cal.dayIndex;
  const members = membersOf(world, { householdId });
  const fireDef = cheapestFuel(ctx.content);
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
    const cap = (WOODPILE.capBase + WOODPILE.capPerMember * members.length) * fireDef.supply.units;
    const gap = cap - supplyUnits(world, ctx.content, pantryOf(household.id), 'fire');
    const qty = Math.min(
      (ctx.content.domesticRules?.daily?.wood_base_per_day ?? WOODPILE.baseDay) +
        (ctx.content.domesticRules?.daily?.wood_per_member_per_day ?? WOODPILE.perMemberDay) * members.length,
      Math.max(0, Math.floor(gap / fireDef.supply.units)),
    );
    if (qty) createStack(world, ctx, fireDef.id, qty, pantryOf(household.id));
  }
}

export function householdDay(world: World, ctx: SimContext): void {
  for (const household of rowsOf(world.households)) {
    const h = world.provisions.households[household.id];
    if (!h) continue;
    const members = membersOf(world, { householdId: household.id });
    replenishDomestic(world, ctx, household.id);
    if (
      !world.provisions.settings.autoRations ||
      !members.length ||
      !authorizeAct(world, household.headId, { kind: 'consequential' }, { kind: 'own' }).ok
    )
      continue;
    // The ration decision only compares against its thresholds, so project only as far as can matter:
    // at full rations the question is "below the first cut?"; on short rations, "back above restore?".
    const firstCut = Math.max(...RATION_STEPS.map((s) => s.belowDays));
    const horizon = (h.rationPct >= 100 ? firstCut : RATION_RESTORE_DAYS) + 1;
    const readiness = readinessOf(world, ctx.content, { householdId: household.id }, ctx.now, horizon);
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
      world.provisions.externalCashCents = (world.provisions.externalCashCents ?? 0) - pay;
      createStack(world, ctx, line.item, qty, atPlace(store.placeId));
      ctx.emit({
        kind: 'provisions.restock',
        data: {
          placeId: store.placeId,
          defId: line.item,
          qty,
          costCents: cost,
          cashPaidCents: pay,
          boundary: 'freight',
        },
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
    // Whoever of the household is at a store this hour buys (the head first, then by id).
    const atStore = (id: ActorId) => {
      const a = world.actors[id];
      return (
        a?.alive === true &&
        canAct(world, id) &&
        (authorizeAct(world, id, { kind: 'consequential' }, { kind: 'own' }).ok ||
          authorizeAct(
            world,
            id,
            { kind: 'purchase', cents: 0, itemTags: ['food'] },
            { kind: 'standing', capability: 'buy_staples' },
          ).ok) &&
        world.provisions.stores[a.placeId] !== undefined
      );
    };
    const buyerId = atStore(household.headId) ? household.headId : household.memberIds.find(atStore);
    const buyer = buyerId === undefined ? undefined : world.actors[buyerId];
    if (!h || !buyer) continue;
    const members = membersOf(world, { householdId: household.id });
    const need = members.reduce((n, id) => n + dailyKcal(world, ctx.content, id, ctx.now), 0);
    const horizon = shoppingDays(ctx.cal.month),
      holder = { householdId: household.id };
    let kitchen = kitchenOf(world, ctx.content, holder, ctx.now);
    // Buying food which cannot be cooked is not a useful errand. Replace exhausted
    // ignition gear from the authored domestic kit before calculating the food order.
    if (kitchen.ignition.length) {
      for (const gear of ctx.content.domesticRules?.daily?.equipment ?? []) {
        const def = ctx.content.items[gear.item];
        if (
          !def ||
          !kitchen.ignition.some((missing) =>
            missing === 'ignition gear' ? (def.affordances.ignite ?? 0) > 0 : (def.affordances.tinder ?? 0) > 0,
          )
        )
          continue;
        purchase(world, ctx, buyer.id, buyer.placeId, gear.item, 1, true, pantryOf(household.id));
        kitchen = kitchenOf(world, ctx.content, holder, ctx.now);
        if (!kitchen.ignition.length) break;
      }
    }
    const targets = nutritionTargets(ctx.content);
    type Diet = { kcal: number; fatG: number; proteinG: number; freshPoints: number };
    const daily: Diet = {
      kcal: need,
      fatG: Math.ceil((need * targets.fat_recovery_pct) / 900),
      proteinG: Math.ceil((need * targets.protein_g_per_1000_kcal) / 1000),
      freshPoints: members.length * targets.fresh_target * targets.fresh_reference_servings,
    };
    const stored: Diet = { kcal: 0, fatG: 0, proteinG: 0, freshPoints: 0 };
    const usable = (s: import('../items/state.ts').ItemStack) =>
      recipesFor(world, ctx.content, holder, s, 1, false, undefined, prepBudget(holder), kitchen)
        .filter((r) => r.missing.length === 0 && r.food.alcohol_pct === 0 && r.kcal > 0)
        .sort(
          (a, b) => a.minutes - b.minutes || a.fire - b.fire || (a.defId < b.defId ? -1 : a.defId > b.defId ? 1 : 0),
        )[0];
    const dietOf = (s: import('../items/state.ts').ItemStack): Diet | null => {
      const r = usable(s),
        food = ctx.content.items[s.defId]?.food;
      return !r || !food
        ? null
        : {
            kcal: r.kcal * food.servings,
            fatG: r.food.fat_g * r.units,
            proteinG: r.food.protein_g * r.units,
            freshPoints: r.food.fresh * r.food.servings * r.units,
          };
    };
    for (const stack of kitchen.stacks) {
      const food = ctx.content.items[stack.defId]?.food,
        diet = dietOf(stack);
      if (!diet || !food) continue;
      const units = foodServings(ctx.content, stack) / food.servings;
      for (const key of ['kcal', 'fatG', 'proteinG', 'freshPoints'] as const)
        stored[key] += Math.floor(diet[key] * units);
    }
    const history = members.flatMap((id) => world.provisions.nutrition[id]?.history.slice(-7) ?? []);
    const historyEnergy = history.reduce((n, d) => n + d.kcal, 0),
      historyFat = history.reduce((n, d) => n + d.fatG, 0);
    const lowFat = history.length > 0 && historyFat * 900 < historyEnergy * targets.fat_recovery_pct;
    const lowFresh = members.some((id) => (world.provisions.nutrition[id]?.lowFreshDays ?? 0) > 0);
    const missing: Diet = {
      kcal: Math.max(0, daily.kcal * horizon.target - stored.kcal),
      fatG: Math.max(0, daily.fatG * horizon.target - stored.fatG),
      proteinG: Math.max(0, daily.proteinG * horizon.target - stored.proteinG),
      freshPoints: Math.max(0, daily.freshPoints * horizon.target - stored.freshPoints),
    };
    if (
      stored.kcal >= daily.kcal * horizon.trigger &&
      !lowFat &&
      !lowFresh &&
      stored.fatG >= daily.fatG * horizon.trigger &&
      stored.freshPoints >= daily.freshPoints * horizon.trigger
    )
      continue;
    if (Object.values(missing).every((n) => n === 0)) continue;
    const stock = stacksDeep(world, atPlace(buyer.placeId))
      .map((s) => s.stack)
      .filter((s) => s.condition > 0 && s.spoilage < 1000 && !s.partial && !s.foodPartialPm)
      .map((stack) => ({
        stack,
        diet: dietOf(stack),
        price: priceAt(world, ctx.content, buyer.placeId, stack.defId) ?? 0,
      }))
      .filter((entry): entry is typeof entry & { diet: Diet } => entry.diet !== null);
    ctx.emit({
      kind: 'provisions.shopping_plan',
      data: {
        householdId: household.id,
        energyKcal: missing.kcal,
        fatG: missing.fatG,
        proteinG: missing.proteinG,
        freshPoints: missing.freshPoints,
      },
      roles: [{ actor: buyer.id, role: 'agent' }],
      visibility: 'private',
      explain: mealExplain('Balanced provision order', members, missing.kcal, [
        term('time', 'Target days', horizon.target),
        term('need', 'Daily full energy kcal', need),
        term('nutrition', 'Fat target percent', targets.fat_recovery_pct),
        term('nutrition', 'Protein grams per thousand kcal', targets.protein_g_per_1000_kcal),
        term(
          'nutrition',
          'Fresh target points per member-day',
          targets.fresh_target * targets.fresh_reference_servings,
        ),
        term('history', 'Rolling fat deficit', lowFat ? 1 : 0),
        term('history', 'Fresh-food deficit', lowFresh ? 1 : 0),
        term('target', 'Missing fat grams', missing.fatG),
        term('target', 'Missing protein grams', missing.proteinG),
        term('target', 'Missing fresh points', missing.freshPoints),
      ]),
    });
    // Cover nutrients before filling the remaining energy cheaply. Cross-products compare
    // cents per nutrient without rounding ties; preparations and opening tools are shared.
    for (const key of ['fatG', 'freshPoints', 'proteinG', 'kcal'] as const) {
      stock.sort((a, b) => a.price * b.diet[key] - b.price * a.diet[key] || a.stack.id - b.stack.id);
      for (const entry of stock) {
        if (missing[key] <= 0) break;
        if (entry.diet[key] <= 0 || !world.items.stacks[entry.stack.id]) continue;
        const bought = purchase(
          world,
          ctx,
          buyer.id,
          buyer.placeId,
          entry.stack.defId,
          Math.ceil(missing[key] / entry.diet[key]),
          true,
          pantryOf(household.id),
        );
        for (const field of ['kcal', 'fatG', 'proteinG', 'freshPoints'] as const)
          missing[field] = Math.max(0, missing[field] - bought * entry.diet[field]);
      }
    }
  }
}

/** Store tabs are the shop view of the keeper's social money ledger. Unowned shops retain
 * their own till account; a shop with a keeper never keeps an independent monetary debt. */
export function synchronizeStoreTabs(world: World): void {
  for (const store of rowsOf(world.provisions.stores)) {
    const keeper = store.ownerHouseholdId === null ? undefined : world.households[store.ownerHouseholdId]?.headId;
    if (keeper === undefined) continue;
    for (const actor of rowsOf(world.actors)) {
      const cents = debtOf(world, keeper, actor.id).cents;
      if (cents || store.tabs[actor.id] !== undefined) store.tabs[actor.id] = cents;
    }
  }
}
