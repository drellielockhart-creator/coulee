import {
  type ActorId,
  activity,
  asItemId,
  type Command,
  hashValue,
  items,
  provisions,
  type Sim,
  social,
} from '@coulee/core';
export interface AvailableAction {
  id: string;
  label: string;
  command: Command;
}
export function availableActions(sim: Sim, pc: ActorId): AvailableAction[] {
  const { world: w, content: c } = sim;
  const a = w.actors[pc];
  if (!a) return [];
  const out: AvailableAction[] = [];
  const add = (id: string, label: string, command: Command) => out.push({ id, label, command });
  for (const query of ['look', 'plan', 'journal'] as const)
    add(query, query === 'plan' ? 'Plan provisions / Kit Sheet' : query, {
      kind: 'activity.observe',
      actorId: pc,
      data: { query },
    });
  const inspect = (target: string, label: string) =>
    add(`inspect:${target}`, `Inspect ${label}`, {
      kind: 'activity.observe',
      actorId: pc,
      data: { query: 'inspect', target },
    });
  for (const p of Object.values(w.places)) inspect(`place:${p.id}`, p.name);
  for (const other of Object.values(w.actors))
    if (other.placeId === a.placeId) inspect(`actor:${other.id}`, `${other.name.given} ${other.name.family}`.trim());
  const carried = items.stacksDeep(w, items.carriedBy(pc)).map((s) => s.stack);
  for (const s of carried) inspect(`item:${s.id}`, c.items[s.defId]?.name ?? s.defId);
  if (!a.alive) return out;
  add('wait', 'Wait 1 hour', { kind: 'activity.wait', actorId: pc, data: { minutes: 60 } });
  const state = activity.currentActivity(w, pc);
  const unlocked = state?.lockedUntil === null || state?.lockedUntil === undefined || state.lockedUntil <= w.time;
  if (unlocked) {
    for (const p of Object.values(w.places))
      if (p.id !== a.placeId && c.activities.idle_at_home)
        add(`go:${p.id}`, `Go to ${p.name}`, {
          kind: 'core.urge',
          actorId: pc,
          data: { urge: { kind: 'activity', activityId: 'walk', placeId: p.id } },
        });
    for (const def of Object.values(c.activities)) {
      if (activity.resolveActivityPlace(w, sim, pc, def.id) === null) continue;
      add(`activity:${def.id}`, def.name, {
        kind: 'core.urge',
        actorId: pc,
        data: { urge: { kind: 'activity', activityId: def.id } },
      });
    }
    for (const other of Object.values(w.actors))
      if (other.id !== pc && other.alive && other.placeId === a.placeId)
        for (const def of Object.values(c.interactions)) {
          const acquainted = social.isAcquainted(w, pc, other.id);
          if ((def.requires.stranger && acquainted) || (def.requires.acquainted && !acquainted)) continue;
          add(`talk:${def.id}:${other.id}`, `${def.name}: ${other.name.given} ${other.name.family}`.trim(), {
            kind: 'core.urge',
            actorId: pc,
            data: { urge: { kind: 'interaction', interactionId: def.id, targetId: other.id } },
          });
        }
  }
  if (provisions.drinkingWater(w, c, pc) >= 500)
    add('drink', 'Drink water (500 ml)', { kind: 'provisions.drink', actorId: pc, data: { ml: 500 } });
  const service = provisions.serviceAt(w, c, a.placeId);
  if (
    service?.meal_cents !== undefined &&
    provisions.storeOpen(w, c, a.placeId) &&
    provisions.cashOf(w, pc) >= service.meal_cents
  )
    add('meal', `Buy a tavern meal ($${(service.meal_cents / 100).toFixed(2)})`, {
      kind: 'provisions.board_meal',
      actorId: pc,
      data: {},
    });
  const store = w.provisions.stores[a.placeId];
  if (store && provisions.storeOpen(w, c, a.placeId))
    for (const s of items.stacksAt(w, items.atPlace(a.placeId))) {
      const price = provisions.priceAt(w, c, a.placeId, s.defId);
      const cash = (w.provisions.purses[pc] ?? 0) + (w.provisions.households[a.householdId]?.cashCents ?? 0);
      if (price === null || price > cash || s.partial || s.foodPartialPm || s.condition <= 0 || s.spoilage >= 1000)
        continue;
      if (!out.some((x) => x.id === `buy:${s.defId}`))
        add(`buy:${s.defId}`, `Buy ${c.items[s.defId]?.name} ($${(price / 100).toFixed(2)})`, {
          kind: 'provisions.buy',
          actorId: pc,
          data: { placeId: a.placeId, defId: s.defId, qty: 1, onCredit: false },
        });
    }
  const accessible = Object.values(w.items.stacks).filter((s) => provisions.accessibleStack(w, pc, s));
  for (const s of accessible) {
    if (provisions.refillQuote(w, c, pc, s.id) !== null)
      add(`refill:${s.id}`, `Refill ${c.items[s.defId]?.name}`, {
        kind: 'provisions.refill',
        actorId: pc,
        data: { itemId: s.id },
      });
    const food = c.items[s.defId]?.food;
    const root = items.rootOf(w, s);
    const holder = root.kind === 'actor' ? { actorId: pc } : provisions.holderOfActor(w, pc);
    if (food && provisions.foodServings(c, s) >= 1)
      for (const prep of food.prep) {
        if (!provisions.recipesFor(w, c, holder, s, 1, false, prep.method).some((r) => !r.missing.length)) continue;
        add(
          `eat:${s.id}:${prep.method}`,
          `${prep.method === 'raw' ? 'Eat' : 'Prepare and eat'} ${c.items[s.defId]?.name} (${prep.method})`,
          { kind: 'provisions.eat', actorId: pc, data: { itemId: s.id, method: prep.method, servings: 1 } },
        );
      }
    const quote = provisions.saleQuote(w, c, a.placeId, s.id);
    const owner = store?.ownerHouseholdId == null ? undefined : w.provisions.households[store.ownerHouseholdId];
    if (
      store &&
      provisions.storeOpen(w, c, a.placeId) &&
      root.kind === 'actor' &&
      root.actorId === pc &&
      quote !== null &&
      quote <= (owner?.cashCents ?? store.tillCents)
    )
      add(`sell:${s.id}`, `Sell ${c.items[s.defId]?.name} ($${(quote / 100).toFixed(2)})`, {
        kind: 'provisions.sell',
        actorId: pc,
        data: { placeId: a.placeId, itemId: s.id, qty: 1 },
      });
    if (s.location.kind !== 'actor')
      add(`unpack:${s.id}`, `Unpack ${c.items[s.defId]?.name}`, {
        kind: 'provisions.pack',
        actorId: pc,
        data: { itemId: s.id, qty: s.qty, intoItemId: null },
      });
    for (const box of accessible)
      if (
        box.id !== s.id &&
        c.items[box.defId]?.container &&
        items.fitsInContainer(w, c, s, 1, box).ok &&
        !items.containerChain(w, box).some((p) => p.id === s.id)
      )
        add(`pack:${s.id}:${box.id}`, `Pack ${c.items[s.defId]?.name} into ${c.items[box.defId]?.name}`, {
          kind: 'provisions.pack',
          actorId: pc,
          data: { itemId: s.id, qty: 1, intoItemId: box.id },
        });
  }
  for (const rationPct of [50, 75, 100, 125, 150])
    add(`rations:${rationPct}`, `Set rations ${rationPct}%`, {
      kind: 'provisions.set_rations',
      actorId: pc,
      data: { householdId: null, rationPct },
    });
  return out;
}
/** Exact offered commands plus bounded quantity/ration variants from the same affordance. */
export function validateCommand(sim: Sim, pc: ActorId, command: Command, actions: AvailableAction[]): string | null {
  if (!command || command.actorId !== pc || !command.data) return 'Command must belong to the newcomer';
  if (actions.some((a) => hashValue(a.command) === hashValue(command))) return null;
  const { world: w, content: c } = sim;
  const actor = w.actors[pc];
  if (!actor) return 'No player actor';
  if (
    command.kind === 'activity.observe' &&
    command.data.query === 'explain' &&
    /^\d+$/.test(command.data.target ?? '')
  )
    return null;
  if (!actor.alive) return 'Your character is no longer alive';
  if (command.kind === 'activity.wait') {
    const d = command.data;
    return Number.isSafeInteger(d.minutes) &&
      d.minutes >= 0 &&
      d.minutes <= 43200 &&
      d.minutes % 60 === 0 &&
      (d.untilTime === undefined ||
        (Number.isSafeInteger(d.untilTime) &&
          d.untilTime >= w.time &&
          d.untilTime % 60 === 0 &&
          d.untilTime - w.time <= 43200)) &&
      (d.untilEvent === undefined || (typeof d.untilEvent === 'string' && d.untilEvent.length > 0))
      ? null
      : 'Wait uses whole hours, at most 30 days';
  }
  if (command.kind === 'provisions.refill')
    return provisions.refillQuote(w, c, pc, command.data.itemId, command.data.ml) !== null
      ? null
      : 'No accessible refill source or vessel capacity';
  if (command.kind === 'provisions.drink')
    return Number.isSafeInteger(command.data.ml) &&
      command.data.ml > 0 &&
      command.data.ml <= provisions.drinkingWater(w, c, pc)
      ? null
      : 'Not enough accessible water';
  if (command.kind === 'provisions.set_rations')
    return Number.isInteger(command.data.rationPct) &&
      command.data.rationPct >= 10 &&
      command.data.rationPct <= 150 &&
      (command.data.householdId === null || command.data.householdId === actor.householdId)
      ? null
      : 'Rations must be 10–150% for yourself or your household';
  if (command.kind === 'core.urge' && command.data.urge.kind === 'activity') {
    const u = command.data.urge;
    if (
      actions.some(
        (a) =>
          a.command.kind === 'core.urge' &&
          a.command.data.urge.kind === 'activity' &&
          a.command.data.urge.activityId === u.activityId,
      ) &&
      activity.resolveActivityPlace(w, sim, pc, u.activityId, u.placeId) !== null
    )
      return null;
  }
  if (command.kind === 'core.urge' && command.data.urge.kind === 'interaction') {
    const u = command.data.urge;
    const target = u.targetId === undefined ? undefined : w.actors[u.targetId];
    const state = activity.currentActivity(w, pc);
    if (
      c.interactions[u.interactionId] &&
      target?.alive &&
      target.id !== pc &&
      target.placeId === actor.placeId &&
      (state?.lockedUntil == null || state.lockedUntil <= w.time)
    )
      return null;
  }
  if (command.kind === 'provisions.buy') {
    if (!provisions.storeOpen(w, c, command.data.placeId)) return 'The shop is closed';
    const d = command.data,
      price = provisions.priceAt(w, c, d.placeId, d.defId);
    const store = w.provisions.stores[d.placeId];
    const stock = items
      .stacksAt(w, items.atPlace(d.placeId))
      .filter((s) => s.defId === d.defId && !s.partial && !s.foodPartialPm && s.condition > 0 && s.spoilage < 1000)
      .reduce((n, s) => n + s.qty, 0);
    const funds =
      (w.provisions.purses[pc] ?? 0) +
      (w.provisions.households[actor.householdId]?.cashCents ?? 0) +
      (d.onCredit && store ? Math.max(0, store.creditLimitCents - (store.tabs[pc] ?? 0)) : 0);
    if (
      d.placeId === actor.placeId &&
      price !== null &&
      Number.isSafeInteger(d.qty) &&
      d.qty > 0 &&
      d.qty <= stock &&
      d.qty * price <= funds &&
      typeof d.onCredit === 'boolean'
    )
      return null;
  }
  if (command.kind === 'provisions.eat') {
    const d = command.data,
      s = w.items.stacks[d.itemId];
    if (
      s &&
      provisions.accessibleStack(w, pc, s) &&
      Number.isSafeInteger(d.servings) &&
      d.servings > 0 &&
      d.servings <= provisions.foodServings(c, s)
    ) {
      const holder = items.rootOf(w, s).kind === 'actor' ? { actorId: pc } : provisions.holderOfActor(w, pc);
      if (provisions.recipesFor(w, c, holder, s, d.servings, false, d.method).some((r) => !r.missing.length))
        return null;
    }
  }
  if (command.kind === 'provisions.pack') {
    const d = command.data,
      s = w.items.stacks[d.itemId],
      box = d.intoItemId === null ? null : w.items.stacks[asItemId(d.intoItemId)];
    if (
      s &&
      provisions.accessibleStack(w, pc, s) &&
      Number.isSafeInteger(d.qty) &&
      d.qty > 0 &&
      d.qty <= s.qty &&
      (d.intoItemId === null ||
        (box &&
          box.id !== s.id &&
          provisions.accessibleStack(w, pc, box) &&
          items.fitsInContainer(w, c, s, d.qty, box).ok &&
          !items.containerChain(w, box).some((p) => p.id === s.id)))
    )
      return null;
  }
  return 'Action is unavailable here, locked, or has invalid quantities/resources; use look for current actions';
}
