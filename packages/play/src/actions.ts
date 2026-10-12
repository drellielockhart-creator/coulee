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
export interface AvailableAction {
  id: string;
  label: string;
  command: Command;
}
/** "Michael Dunleavy's offer to lend a hand (you would owe him a favor)": an answer's label. */
export function requestLabel(w: Sim['world'], r: social.PendingRequest): string {
  const from = w.actors[r.from];
  const name = from ? `${from.name.given} ${from.name.family}`.trim() : 'someone';
  const him = from?.sex === 'male' ? 'him' : from?.sex === 'female' ? 'her' : 'them';
  const money = r.cents ? `$${(r.cents / 100).toFixed(2)}` : '';
  switch (r.response) {
    case 'borrow':
      return `${name}'s loan of ${money || 'money'} (you would owe ${him} ${money || 'it'})`;
    case 'lend':
    case undefined:
      return `${name}'s request to borrow ${money || 'money'} (${him === 'them' ? 'they' : him === 'him' ? 'he' : 'she'} would owe you)`;
    case 'proposal':
      return `${name}'s proposal`;
    case 'disclose':
      return `${name}'s question (tell ${him} your news)`;
    default:
      return `${name}'s offer (you would owe ${him} ${r.favors && r.favors > 1 ? `${r.favors} favors` : 'a favor'})`;
  }
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const clock = (t: number) =>
  `${String(Math.floor((t % 1440) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
function closedText(sim: Sim, placeId: number): string {
  const s = provisions.serviceAt(sim.world, sim.content, placeId as never);
  return s ? `The counter is closed; it is open ${s.opens}:00–${s.closes}:00` : 'The shop is closed';
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
        accept ? `Yes to ${requestLabel(w, r)}` : `No to ${requestLabel(w, r).replace(/ \(.*\)$/, '')}`,
        { kind: 'social.answer_request', actorId: pc, data: { requestId: r.id, accept } },
      );
  add('signs', 'Signs & Wonders', { kind: 'fae.signs', actorId: pc, data: {} });
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
  // A sleeper can always be woken by an order (core: activity wakes on a command).
  const asleep = !!c.activities[state?.activityId ?? '']?.asleep;
  const unlocked =
    asleep || state?.lockedUntil === null || state?.lockedUntil === undefined || state.lockedUntil <= w.time;
  if (unlocked) {
    // Nearest first, with the minutes on foot (playtest r2: the Go menu showed only 3-4 hubs);
    // among places as near, the public ones (tavern, store, church, street) before private homes.
    const publicTags = social.tuningOf(c).public_venue_tags;
    const isPublic = (p: (typeof w.places)[number]) => (p.tags.some((t) => publicTags.includes(t)) ? 0 : 1);
    const destinations = Object.values(w.places)
      .filter((p) => p.id !== a.placeId && c.activities.idle_at_home)
      .map((p) => ({ p, minutes: activity.walkMinutes(w, c, a.placeId, p.id) }))
      .sort((x, y) => x.minutes - y.minutes || isPublic(x.p) - isPublic(y.p) || x.p.id - y.p.id);
    for (const { p, minutes } of destinations)
      add(`go:${p.id}`, `Go to ${p.name} (${minutes} min)`, {
        kind: 'core.urge',
        actorId: pc,
        data: { urge: { kind: 'activity', activityId: 'walk', placeId: p.id } },
      });
    // Another trade's work is not hers to take up (playtest r2: a newcomer offered "Hold court"
    // and "Keep the tavern"): labor is offered when her own occupation schedules it, or it is a
    // chore or wild work anyone may do.
    const own = new Set(
      (c.occupations[a.occupationId]?.schedule ?? []).flatMap((b) => [b.activity, b.fallback ?? b.activity]),
    );
    // Away from lodgings on open ground, ordinary sleep is a camp bed on the spot (never a walk
    // back to a paid one), resting is resting here, and the camp activities are on offer.
    const camp = items.campContext(w, c, pc);
    const campId = items.campSleepActivity(c);
    const home = w.households[a.householdId]?.homePlaceId;
    for (const def of Object.values(c.activities)) {
      if (activity.resolveActivityPlace(w, sim, pc, def.id) === null) continue;
      const isCamp = def.tags.includes('camp') || def.tags.includes('campfire');
      if (isCamp && !camp.afield) continue;
      if (
        def.tags.includes('labor') &&
        !own.has(def.id) &&
        !def.tags.includes('chore') &&
        !def.tags.includes('wild_production')
      )
        continue;
      if (def.asleep && def.at === 'home' && camp.bedding && campId !== null) {
        add(`activity:${def.id}`, `Make camp and sleep here`, {
          kind: 'core.urge',
          actorId: pc,
          data: { urge: { kind: 'activity', activityId: campId, placeId: a.placeId } },
        });
        continue;
      }
      // Fetching water goes to the nearest spring, creek or ford (vessels fill there), not home.
      const source = def.id === 'fetch_water' ? provisions.nearestWaterSource(w, c, pc) : null;
      if (source) {
        const where = w.places[source.placeId]?.name ?? 'the water';
        add(
          `activity:${def.id}`,
          source.minutes === 0
            ? `Fetch water here at ${where} (drink and fill your vessels)`
            : `Fetch water at ${where} (${source.minutes} min on foot; drink and fill your vessels)`,
          {
            kind: 'core.urge',
            actorId: pc,
            data: { urge: { kind: 'activity', activityId: def.id, placeId: source.placeId } },
          },
        );
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
          if (!social.interactionAvailability(w, c, pc, other.id, def.id).ok) continue;
          add(`talk:${def.id}:${other.id}`, `${def.name}: ${other.name.given} ${other.name.family}`.trim(), {
            kind: 'core.urge',
            actorId: pc,
            data: { urge: { kind: 'interaction', interactionId: def.id, targetId: other.id } },
          });
        }
  }
  if (provisions.drinkingWater(w, c, pc) >= 500)
    add(
      'drink',
      provisions.isWaterSource(w, c, a.placeId)
        ? `Drink from ${w.places[a.placeId]?.name ?? 'the water'} (raw water, 500 ml)`
        : 'Drink water (500 ml)',
      { kind: 'provisions.drink', actorId: pc, data: { ml: 500 } },
    );
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
    const fill = provisions.refillQuote(w, c, pc, s.id);
    if (fill !== null)
      add(`refill:${s.id}`, `Fill ${c.items[s.defId]?.name} (${fill} ml)`, {
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
/** Load limits, said before any time passes: no walking over the limit, no buying past it. */
function loadRefusal(w: Sim['world'], c: Sim['content'], pc: ActorId, command: Command): string | null {
  const actor = w.actors[pc];
  if (!actor) return null;
  const load = items.loadReport(w, c, pc);
  if (
    command.kind === 'core.urge' &&
    command.data.urge.kind === 'activity' &&
    command.data.urge.placeId !== undefined &&
    command.data.urge.placeId !== actor.placeId &&
    load.band.speedPct === 0
  )
    return `You cannot move: your load is ${load.loadPct}% of what you can carry (over ${items.MOVE_LIMIT_PCT}%). Drop, sell or unpack something first`;
  if (command.kind !== 'provisions.buy') return null;
  // Carried goods must leave her able to walk (core caps the purchase the same way): say so.
  const d = command.data;
  const unitG = c.items[d.defId]?.weight_g ?? 0;
  if (
    unitG <= 0 ||
    !Number.isSafeInteger(d.qty) ||
    (load.weightG + unitG * d.qty) * 100 <= load.capacityG * items.MOVE_LIMIT_PCT
  )
    return null;
  const fits = Math.max(0, Math.floor((load.capacityG * items.MOVE_LIMIT_PCT - load.weightG * 100) / (unitG * 100)));
  const pct = Math.floor(((load.weightG + unitG * d.qty) * 100) / Math.max(1, load.capacityG));
  return `Too heavy: ${d.qty} × ${c.items[d.defId]?.name} (${((unitG * d.qty) / 1000).toFixed(1)} kg) would put your load at ${pct}% of what you can carry (now ${load.loadPct}%, ${load.band.label}); over ${items.MOVE_LIMIT_PCT}% you cannot walk. ${fits ? `You can carry ${fits} more` : 'Lighten your pack first'}`;
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
  // The counter's prices, a page or a filter at a time (reading: no time, open after an ending).
  if (
    command.kind === 'activity.observe' &&
    command.data.query === 'look' &&
    /^prices:[\w ,'-]{1,40}$/.test(command.data.target ?? '')
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
  const load = loadRefusal(w, c, pc, command);
  if (load) return load;
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
  if (command.kind === 'provisions.refill') {
    const check = provisions.refillCheck(w, c, pc, command.data.itemId, command.data.ml);
    return 'ml' in check ? null : check.reason;
  }
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
    // Say why not (playtest r2: "Nothing here matches" for a locked activity, an internal id leaked).
    const state = activity.currentActivity(w, pc);
    if (state?.lockedUntil != null && state.lockedUntil > w.time) {
      const held = c.activities[state.activityId ?? ''];
      const camp = held?.tags.includes('camp') === true;
      return `You are still ${held?.verb ?? 'busy'} until ${clock(state.lockedUntil)}${camp ? ': a night at camp holds you eight hours; wait, and you will wake' : '; wait until then'}`;
    }
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
    const def = c.activities[u.activityId];
    if (u.activityId === 'walk') return u.placeId !== undefined && w.places[u.placeId] ? null : 'No such place';
    if (!def) return 'No such activity';
    const own = (c.occupations[actor.occupationId]?.schedule ?? []).flatMap((b) => [b.activity, b.fallback]);
    if (
      def.tags.includes('labor') &&
      !own.includes(def.id) &&
      !def.tags.includes('chore') &&
      !def.tags.includes('wild_production')
    )
      return `${def.name} is not your trade`;
    if (activity.resolveActivityPlace(w, sim, pc, u.activityId, u.placeId) === null)
      return `There is nowhere to ${def.name.toLowerCase()} from here`;
    return `${def.name} is not something you can do here and now`;
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
    const name = stack ? (c.items[stack.defId]?.name ?? stack.defId) : 'that';
    if (!stack || items.rootOf(w, stack).kind !== 'actor' || !provisions.accessibleStack(w, pc, stack))
      return 'You are not carrying that';
    if (d.qty > stack.qty) return `You have only ${stack.qty} ${name}`;
    const shop = w.provisions.stores[d.placeId];
    if (d.placeId !== actor.placeId || !shop) return 'Nobody buys goods here; try a store';
    if (!provisions.storeOpen(w, c, d.placeId)) return closedText(sim, d.placeId);
    if (stack.partial || stack.foodPartialPm) return `Partly used ${name} cannot be sold`;
    const quote = provisions.saleQuote(w, c, d.placeId, d.itemId);
    if (quote === null) return `The store does not buy ${name}`;
    const cash =
      shop.ownerHouseholdId == null ? shop.tillCents : (w.provisions.households[shop.ownerHouseholdId]?.cashCents ?? 0);
    if (quote * d.qty > cash)
      return `The store has only ${money(Math.max(0, cash))} to pay out just now; ${d.qty} ${name} would be ${money(quote * d.qty)}`;
    return null;
  }
  if (command.kind === 'provisions.buy') {
    const d = command.data;
    const store = w.provisions.stores[d.placeId];
    const name = c.items[d.defId]?.name ?? d.defId;
    if (d.placeId !== actor.placeId || !store) return 'Nothing is sold here';
    if (!provisions.storeOpen(w, c, d.placeId)) return closedText(sim, d.placeId);
    const price = provisions.priceAt(w, c, d.placeId, d.defId);
    if (price === null) return `${name} is not sold here`;
    const here = items.stacksAt(w, items.atPlace(d.placeId)).filter((s) => s.defId === d.defId);
    const stock = here
      .filter((s) => !s.partial && !s.foodPartialPm && s.condition > 0 && s.spoilage < 1000)
      .reduce((n, s) => n + s.qty, 0);
    if (stock === 0)
      return here.length ? `The only ${name} left here is broken open or spoiled` : `${name} is sold out here`;
    if (d.qty > stock) return `Only ${stock} ${name} in stock`;
    const cash =
      (w.provisions.purses[pc] ?? 0) + Math.max(0, w.provisions.households[actor.householdId]?.cashCents ?? 0);
    const credit = Math.max(0, store.creditLimitCents - (store.tabs[pc] ?? 0));
    const funds = cash + (d.onCredit ? credit : 0);
    if (d.qty * price > funds)
      return `You cannot afford ${d.qty} ${name} at ${money(price)} (${money(d.qty * price)}); you have ${money(cash)}${!d.onCredit && credit > 0 && d.qty * price <= cash + credit ? '. The keeper would put it on account' : ''}`;
    if (Number.isSafeInteger(d.qty) && d.qty > 0 && typeof d.onCredit === 'boolean') return null;
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
    if (!s || !provisions.accessibleStack(w, pc, s)) return 'You are not carrying that';
    // Say why it will not go in: full by weight or bulk, holds water, or not a container.
    if (box !== null && box !== undefined && box.id !== s.id) {
      if (!provisions.accessibleStack(w, pc, box)) return 'That container is not at hand';
      const fit = items.fitsInContainer(w, c, s, Math.max(1, Math.min(d.qty, s.qty)), box);
      if (!fit.ok)
        return `${c.items[s.defId]?.name ?? 'That'} will not go into the ${c.items[box.defId]?.name ?? 'container'}: ${fit.reason}`;
    }
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
