import {
  type ActorId,
  activity,
  asItemId,
  type Command,
  fae,
  hashValue,
  items,
  needs,
  provisions,
  psyche,
  type Sim,
  social,
} from '@coulee/core';
/** What a pending request asks of the player, in words (one noun phrase per response kind). */
export function requestNoun(response: string | undefined): string {
  switch (response) {
    case 'borrow':
      return 'loan offer';
    case 'lend':
    case undefined:
      return 'loan request';
    case 'proposal':
      return 'proposal';
    case 'disclose':
      return 'request for information';
    case 'show_item':
      return 'request to see your charm';
    case 'lend_item':
      return 'request to borrow your charm';
    case 'return_item':
      return 'request to give back what you were lent';
    case 'accept_item':
      return 'offer of the loan of their charm';
    default:
      return 'favor with an obligation';
  }
}
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
  for (const r of social.pendingRequests(w, pc))
    for (const accept of [true, false])
      add(
        `answer:${r.id}:${accept ? 'yes' : 'no'}`,
        `${accept ? 'Accept' : 'Refuse'} ${requestNoun(r.response)} from ${w.actors[r.from]?.name.given}`,
        { kind: 'social.answer_request', actorId: pc, data: { requestId: r.id, accept } },
      );
  add('signs', 'Signs & Wonders', { kind: 'fae.signs', actorId: pc, data: {} });
  charmActions(sim, pc, add);
  for (const q of fae.signs(w, pc))
    if (!fae.investigationEligibility(w, pc, q.signId))
      add(`investigate:${q.signId}`, `Investigate: ${q.text}`, {
        kind: 'fae.investigate',
        actorId: pc,
        data: { signId: q.signId },
      });
  const inspect = (target: string, label: string) =>
    add(`inspect:${target}`, `Inspect ${label}`, {
      kind: 'activity.observe',
      actorId: pc,
      data: { query: 'inspect', target },
    });
  for (const p of Object.values(w.places)) inspect(`place:${p.id}`, p.name);
  for (const other of Object.values(w.actors))
    if (other.placeId === a.placeId || social.isAcquainted(w, pc, other.id))
      inspect(`actor:${other.id}`, `${other.name.given} ${other.name.family}`.trim());
  const carried = items.stacksDeep(w, items.carriedBy(pc)).map((s) => s.stack);
  for (const s of carried) inspect(`item:${s.id}`, c.items[s.defId]?.name ?? s.defId);
  add('prices', 'Prices / local stock', {
    kind: 'activity.observe',
    actorId: pc,
    data: { query: 'look', target: 'prices' },
  });
  if (!a.alive || w.needs.byActor[pc]?.survival?.ending) return out;
  add('wait', 'Wait 1 hour', { kind: 'activity.wait', actorId: pc, data: { minutes: 60 } });
  if (!needs.canAct(w, pc)) return out;
  for (const type of ['retire', 'depart'] as const)
    add(type, type === 'retire' ? 'Retire from this life' : 'Depart from the coulee', {
      kind: type === 'retire' ? 'needs.retire' : 'needs.depart',
      actorId: pc,
      data: {},
    });
  for (const other of Object.values(w.actors))
    if (other.alive && other.placeId === a.placeId && needs.needsHelp(w, other.id))
      add(`aid:${other.id}`, `Aid ${other.name.given} ${other.name.family}`, {
        kind: 'needs.aid',
        actorId: pc,
        data: { targetId: other.id },
      });
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
    // Away from lodgings on open ground, ordinary sleep is a camp bed on the spot (never a walk
    // back to a paid one), resting is resting here, and the camp activities are on offer.
    const camp = items.campContext(w, c, pc);
    const campId = items.campSleepActivity(c);
    const home = w.households[a.householdId]?.homePlaceId;
    for (const def of Object.values(c.activities)) {
      // Charm chores carry their item: they are offered as charm actions, never bare.
      if (def.tags.includes('charm')) continue;
      if (activity.resolveActivityPlace(w, sim, pc, def.id) === null) continue;
      const isCamp = def.tags.includes('camp') || def.tags.includes('campfire');
      if (isCamp && !camp.afield) continue;
      if (def.asleep && def.at === 'home' && camp.bedding && campId !== null) {
        add(`activity:${def.id}`, `Make camp and sleep here`, {
          kind: 'core.urge',
          actorId: pc,
          data: { urge: { kind: 'activity', activityId: campId, placeId: a.placeId } },
        });
        continue;
      }
      if (def.id === 'idle_at_home' && a.placeId !== home) {
        add(`activity:${def.id}`, 'Rest here awhile', {
          kind: 'core.urge',
          actorId: pc,
          data: { urge: { kind: 'activity', activityId: def.id, placeId: a.placeId } },
        });
        continue;
      }
      add(`activity:${def.id}`, def.name, {
        kind: 'core.urge',
        actorId: pc,
        data: { urge: { kind: 'activity', activityId: def.id } },
      });
    }
    for (const other of Object.values(w.actors))
      if (other.id !== pc && other.alive && other.placeId === a.placeId)
        for (const def of Object.values(c.interactions)) {
          // Item interactions name their item: offered as charm actions (charmActions).
          if (def.item || def.tags.includes('charm')) continue;
          if (!social.interactionAvailability(w, c, pc, other.id, def.id).ok) continue;
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

  const { world: w, content: c } = sim;
  const actor = w.actors[pc];
  if (!actor) return 'No player actor';
  if (
    command.kind === 'activity.observe' &&
    command.data.query === 'explain' &&
    /^\d+$/.test(command.data.target ?? '')
  )
    return null;
  const shape = { kind: command.kind, actorId: command.actorId, data: command.data };
  const offered = actions.some(
    (a) => hashValue({ kind: a.command.kind, actorId: a.command.actorId, data: a.command.data }) === hashValue(shape),
  );
  // Reading (look, journal, plan, signs) never acts, so it stays open after an ending.
  if (offered && (command.kind === 'activity.observe' || command.kind === 'fae.signs')) return null;
  if (w.needs.byActor[pc]?.survival?.ending || !actor.alive) return 'This life has ended; only reading remains';
  const authorization = psyche.authorizeAct(
    w,
    pc,
    { kind: command.kind },
    { kind: 'command', issuer: command.issuer ?? { kind: 'player' } },
  );
  if (!authorization.ok) return authorization.reason;
  if (!needs.canAct(w, pc) && command.kind !== 'activity.wait') return 'You have collapsed and need help';
  if (offered) return null;
  if (command.kind === 'fae.signs') return null;
  if (command.kind === 'fae.investigate') return fae.investigationEligibility(w, pc, command.data.signId);
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
      (d.untilEvent === undefined ||
        ['social.interaction', 'belief.transmitted', 'provisions.wages', 'activity.gathering'].includes(d.untilEvent))
      ? null
      : 'Wait uses whole hours, at most 30 days';
  }
  if (command.kind === 'core.standing_orders') {
    const d = command.data;
    return (d.agencyMode === undefined || ['commanded', 'psyche'].includes(d.agencyMode)) &&
      d.orders &&
      (d.orders.capabilities === undefined ||
        (Array.isArray(d.orders.capabilities) && d.orders.capabilities.every((id) => !!c.standingCapabilities[id]))) &&
      Object.keys(psyche.DEFAULT_STANDING_ORDERS).every((key) =>
        key === 'activities'
          ? Array.isArray(d.orders.activities) && d.orders.activities.every((id) => !!c.activities[id])
          : typeof d.orders[key as keyof typeof d.orders] === 'boolean',
      )
      ? null
      : 'Invalid standing orders';
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
    if (u.targetId === undefined) return 'Choose a person';
    return social.interactionAvailability(w, c, pc, u.targetId, u.interactionId).reason ?? null;
  }
  if (command.kind === 'provisions.buy' || command.kind === 'provisions.sell') {
    if (!Number.isSafeInteger(command.data.qty) || command.data.qty <= 0)
      return 'Quantity must be a positive whole number';
  }
  if (command.kind === 'provisions.sell') {
    const d = command.data,
      stack = w.items.stacks[d.itemId];
    if (!stack || d.qty > stack.qty) return 'Quantity exceeds available stock';
    const quote = provisions.saleQuote(w, c, d.placeId, d.itemId);
    const shop = w.provisions.stores[d.placeId];
    const cash =
      shop?.ownerHouseholdId == null
        ? (shop?.tillCents ?? 0)
        : (w.provisions.households[shop.ownerHouseholdId]?.cashCents ?? 0);
    return d.placeId === actor.placeId &&
      shop &&
      provisions.storeOpen(w, c, d.placeId) &&
      items.rootOf(w, stack).kind === 'actor' &&
      provisions.accessibleStack(w, pc, stack) &&
      quote !== null &&
      quote * d.qty <= cash
      ? null
      : 'Sale unavailable: check ownership, shop hours and shop cash';
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
    if (d.qty > stock) return 'Quantity exceeds available stock';
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

/**
 * Charm actions (13 §7.2 Commands), built from what the player character may know
 * (`fae.charmView`): their own charm's tending, study and disposal; a found charm to take; a
 * loan to offer or to ask for, with the usual terms (back by Sunday noon, household use, recharge
 * duty); bringing back what was lent. Each runs the same executor an NPC's choice would.
 */
function charmActions(sim: Sim, pc: ActorId, add: (id: string, label: string, command: Command) => void): void {
  const { world: w, content: c } = sim;
  const a = w.actors[pc];
  if (!a || !w.fae.charms) return;
  const here = Object.values(w.actors).filter((o) => o.id !== pc && o.alive && o.placeId === a.placeId);
  const urge = (interactionId: string, targetId: ActorId, itemId: number, terms?: unknown): Command => ({
    kind: 'core.urge',
    actorId: pc,
    data: {
      urge: {
        kind: 'interaction',
        interactionId,
        targetId,
        itemId: asItemId(itemId),
        ...(terms ? { terms: terms as never } : {}),
      },
    },
  });
  const item = (kind: string, itemId: number): Command =>
    ({ kind, actorId: pc, data: { itemId: asItemId(itemId) } }) as Command;
  const terms = fae.loanTerms(w.time);
  for (const card of fae.charmView(w, c, pc)) {
    const id = card.itemId;
    const name = card.name;
    if (card.relation === 'found') {
      add(`fae.take:${id}`, `Take ${name} (lying here)`, item('fae.take', id));
      add(`fae.inspect:${id}`, `Look over ${name}`, item('fae.inspect', id));
      continue;
    }
    if (card.relation === 'held' || card.relation === 'stores' || card.relation === 'borrowed') {
      const def = c.charms?.[w.items.stacks[id as never]?.defId ?? ''];
      if (def?.effects.some((e) => e.kind === 'draw')) {
        add(`fae.use:${id}`, `Tie ${name} shut for the night`, item('fae.use', id));
        add(`fae.recharge:${id}`, `Set out porridge and butter for ${name}`, item('fae.recharge', id));
      }
      add(`fae.inspect:${id}`, `Look over ${name}`, item('fae.inspect', id));
      add(`fae.study:${id}`, `Study ${name} (an hour)`, item('fae.study', id));
      add(`fae.thank:${id}`, `Thank ${name} aloud`, item('fae.thank', id));
      if (card.relation === 'stores') add(`fae.fetch:${id}`, `Take ${name} out of the stores`, item('fae.fetch', id));
      else add(`fae.stow:${id}`, `Put ${name} away with the household stores`, item('fae.stow', id));
      add(`fae.bury:${id}`, `Bury ${name} with iron`, item('fae.bury', id));
      add(`fae.destroy:${id}`, `Burn ${name} at the forge`, item('fae.destroy', id));
      add(`fae.return:${id}`, `Give ${name} back to the Good Neighbors`, item('fae.return', id));
      // What the player knows: the sources they traced or studied; whom it was borrowed from.
      const sources = w.fae.known?.[pc]?.[id]?.sources ?? [];
      const loan = social.openLoanOf(w, asItemId(id));
      for (const o of here) {
        const who = `${o.name.given} ${o.name.family}`.trim();
        if (card.relation !== 'borrowed')
          add(
            `talk:share_out:${id}:${o.id}`,
            `Lend ${name} to ${who} until Sunday`,
            urge('share_out', o.id, id, terms),
          );
        if (sources.includes(o.householdId))
          add(
            `talk:make_restitution:${id}:${o.id}`,
            `Make it right with ${who} for what ${name} took`,
            urge('make_restitution', o.id, id),
          );
        if (card.relation === 'borrowed' && loan && loan.lenderHouseholdId === o.householdId)
          add(`talk:return_item:${id}:${o.id}`, `Give ${name} back to ${who}`, urge('return_item', o.id, id));
      }
      continue;
    }
    const lentLoan = card.relation === 'lent' ? social.openLoanOf(w, asItemId(id)) : undefined;
    if (lentLoan)
      for (const o of here.filter((x) => x.householdId === lentLoan.borrowerHouseholdId))
        add(
          `talk:demand_return:${id}:${o.id}`,
          `Ask ${o.name.given} for ${name} back`,
          urge('demand_return', o.id, id),
        );
    if (card.relation === 'known' && card.keeperId !== null)
      for (const o of here) {
        if (o.id !== card.keeperId) continue;
        add(`talk:ask_to_see:${id}:${o.id}`, `Ask ${o.name.given} to see ${name}`, urge('ask_to_see', o.id, id));
        add(
          `talk:beg_loan:${id}:${o.id}`,
          `Beg the loan of ${name} from ${o.name.given} until Sunday`,
          urge('beg_loan', o.id, id, terms),
        );
        add(
          `talk:take:${id}:${o.id}`,
          `Take ${name} from ${o.name.given} when nobody is looking`,
          urge('take', o.id, id),
        );
      }
  }
  const home = w.households[a.householdId]?.homePlaceId;
  if (a.placeId === home || w.provisions.stores[a.placeId])
    add('fae.count', 'Count the stock here against the book', { kind: 'fae.count', actorId: pc, data: {} });
}
