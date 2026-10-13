/** Want is learned, food is finite, and relief is an office's judgment (04 §8). */
import { currentActivity, isAsleep } from '../activity/api.ts';
import { credenceOf, formGrudge, internProp, observe, propKey } from '../belief/api.ts';
import type { ContentBundle, InteractionDef } from '../content.ts';
import { type Explain, term } from '../explain.ts';
import {
  type ActorId,
  type EventId,
  type HouseholdId,
  type ItemId,
  mustGet,
  type PlaceId,
  type PropId,
  rowsOf,
} from '../ids.ts';
import { atPlace, carriedBy, movableRoomG, moveStack, pantryOf, rootOf, withInventoryPass } from '../items/api.ts';
import { canAct, needValue } from '../needs/api.ts';
import {
  cashOf,
  dailyKcal,
  type FoodParcel,
  householdFoodDays,
  type ReliefPlanningMemo,
  reliefParcel,
} from '../provisions/api.ts';
import { authorizeAct, type Basis, chosenUrge, effectiveTraits } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { areKin } from './api.ts';
import { interactionAvailability } from './availability.ts';
import { opinionOf } from './opinion.ts';
import { ageYears, valueView } from './tuning.ts';

export interface ReliefOffice {
  id: string;
  ruleId: string;
  faith?: boolean;
  keeperId: ActorId;
  placeId: PlaceId;
  members: HouseholdId[];
  pantry: ItemId[];
  favors: Record<number, number>;
}
export interface Want {
  propId: PropId;
  days: number;
  active: boolean;
  noticed: Record<number, number>;
  since: number;
}
export interface ReliefState {
  wants: Record<number, Want>;
  offices: ReliefOffice[];
  attempts: Record<string, number>;
  offers: Record<number, { targetId: ActorId; interactionId: string; at: number; packed?: ItemId }>;
}
export function reliefRules(content: ContentBundle) {
  return content.reliefRules?.poor_relief;
}
function state(world: World): ReliefState {
  world.social.relief ??= { wants: {}, offices: [], attempts: {}, offers: {} };
  return world.social.relief;
}
function sameFaith(world: World, a: ActorId, b: ActorId): boolean {
  return (
    world.social.relationships.some(
      (r) => r.kind === 'congregant_with' && ((r.a === a && r.b === b) || (r.b === a && r.a === b)),
    ) ||
    reliefOffices(world).some(
      (o) =>
        o.faith &&
        o.members.includes(world.actors[a]?.householdId as HouseholdId) &&
        o.members.includes(world.actors[b]?.householdId as HouseholdId),
    )
  );
}
export function reliefOffices(world: World): readonly ReliefOffice[] {
  return world.social.relief?.offices ?? [];
}
function initOffices(world: World, ctx: SimContext): void {
  const st = state(world);
  if (st.offices.length) return;
  const scenario = ctx.content.scenarios[world.meta.scenarioId];
  const explicit = scenario?.relief_offices ?? [];
  for (const rule of Object.values(ctx.content.reliefOffices ?? {}).sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )) {
    const seeds = explicit.filter((s) => s.office === rule.id);
    const keepers = seeds.length
      ? seeds.flatMap((s) => {
          const id = world.index.actorByKey[s.keeper];
          return id === undefined ? [] : [id];
        })
      : rowsOf(world.actors)
          .filter((a) => ctx.content.occupations[a.occupationId]?.roles.includes(rule.role))
          .map((a) => a.id);
    for (const keeperId of keepers) {
      const keeper = world.actors[keeperId];
      if (!keeper) continue;
      const seed = seeds.find((s) => world.index.actorByKey[s.keeper] === keeperId);
      const members = seed
        ? seed.members.flatMap((k) => {
            const h = world.index.householdByKey[k];
            return h === undefined ? [] : [h];
          })
        : rowsOf(world.households)
            .filter(
              (h) =>
                h.id === keeper.householdId ||
                h.memberIds.some((id) =>
                  world.social.relationships.some(
                    (r) =>
                      r.kind === rule.member_relationship &&
                      ((r.a === keeperId && r.b === id) || (r.b === keeperId && r.a === id)),
                  ),
                ),
            )
            .map((h) => h.id);
      st.offices.push({
        id: `${rule.id}:${keeperId}`,
        ruleId: rule.id,
        faith: rule.attendance_membership,
        keeperId,
        placeId:
          currentActivity(world, keeperId)?.workplaceId ??
          mustGet(world.households, keeper.householdId, 'relief keeper household').homePlaceId,
        members,
        pantry: [],
        favors: {},
      });
    }
  }
}
export function officeOf(world: World, keeperId: ActorId): ReliefOffice | undefined {
  return reliefOffices(world).find((o) => o.keeperId === keeperId);
}
export function knowsWant(world: World, content: ContentBundle, observer: ActorId, household: HouseholdId): boolean {
  const want = world.social.relief?.wants[household];
  return !!want && credenceOf(world, observer, want.propId) >= (reliefRules(content)?.credence ?? 50);
}
/** Observation is bounded to meetings and account books; gossip uses belief.transmit unchanged. */
function notice(world: World, ctx: SimContext, observer: ActorId, household: HouseholdId, channel: string) {
  const w = state(world).wants[household];
  if (!w || ctx.now - (w.noticed[observer] ?? -100000) < 3 * 1440) return;
  if (!w.active && !((w.noticed[observer] ?? -1) >= 0)) return;
  w.noticed[observer] = ctx.now;
  const before = credenceOf(world, observer, w.propId);
  if ((w.active && before >= 80) || (!w.active && before <= 20)) return;
  observe(world, ctx, observer, w.propId, {
    type: 'observation',
    dir: w.active ? 1 : -1,
    sourceId: null,
    eventId: null,
    scalePct: 200,
  });
  if (w.active && before < 50 && credenceOf(world, observer, w.propId) >= 50) {
    ctx.emit({
      kind: 'social.want_known',
      data: {
        householdId: household,
        observerId: observer,
        propId: w.propId,
        daysOfFoodTenths: w.days,
        rationPct: world.provisions.households[household]?.rationPct ?? 100,
        channel,
      },
      roles: [
        { actor: observer, role: 'witness' },
        ...(world.households[household]?.memberIds ?? []).map((actor) => ({ actor, role: 'subject' as const })),
      ],
      visibility: 'private',
      importance: 25,
      explain: {
        kind: 'observation',
        label: `Want known through ${channel}`,
        subjects: [observer],
        knowledge: 'self',
        terms: [term('belief', 'Credence', credenceOf(world, observer, w.propId))],
        total: credenceOf(world, observer, w.propId),
        outcome: 'in want',
      },
    });
  }
}
export function reliefHour(world: World, ctx: SimContext): void {
  const rule = reliefRules(ctx.content);
  if (!rule) return;
  if (ctx.cal.hour !== 7 && ctx.cal.hour !== 10 && ctx.cal.hour !== 12 && ctx.cal.hour !== 19) return;
  withInventoryPass(world, () => {
    const parcels: ReliefPlanningMemo = { parcels: new Map(), reserves: new Map() };
    const st = state(world);
    initOffices(world, ctx);
    if (ctx.cal.isSabbath && ctx.cal.hour === 10) {
      for (const office of st.offices) {
        if (!ctx.content.reliefOffices[office.ruleId]?.attendance_membership) continue;
        for (const a of rowsOf(world.actors))
          if (
            a.alive &&
            a.placeId === office.placeId &&
            ctx.content.activities[currentActivity(world, a.id)?.activityId ?? '']?.tags.includes('worship') &&
            !office.members.includes(a.householdId)
          )
            office.members.push(a.householdId);
        office.members.sort((a, b) => a - b);
      }
    }
    if (ctx.cal.hour === 7) {
      for (const [id, o] of Object.entries(st.offers)) if (ctx.now - o.at > 2 * 1440) delete st.offers[Number(id)];
      for (const [k, t] of Object.entries(st.attempts)) if (t < ctx.now - 7 * 1440) delete st.attempts[k];
      for (const h of rowsOf(world.households)) {
        const alive = h.memberIds.filter((id) => world.actors[id]?.alive);
        if (!alive.length) continue;
        const poor = cashOf(world, h.headId) <= rule.want_cash_cents;
        const days = poor
          ? householdFoodDays(world, ctx.content, h.id, ctx.now, rule.want_days + 1)
          : (rule.want_days + 1) * 10;
        const active = poor && days < rule.want_days * 10;
        if (!active && !st.wants[h.id]) continue;
        st.wants[h.id] ??= {
          propId: internProp(world, 'in_want', [{ kind: 'household', id: h.id }]),
          days,
          active,
          noticed: {},
          since: ctx.now,
        };
        Object.assign(mustGet(st.wants, h.id, 'want'), { days, active });
        for (const id of alive) notice(world, ctx, id, h.id, 'the household table');
      }
    }
    const actors = rowsOf(world.actors).filter((a) => a.alive && canAct(world, a.id) && !isAsleep(world, ctx, a.id));
    for (const h of rowsOf(world.households)) {
      const want = st.wants[h.id];
      if (!want) continue;
      for (const a of actors) {
        if (h.memberIds.some((id) => world.actors[id]?.alive && world.actors[id]?.placeId === a.placeId))
          notice(
            world,
            ctx,
            a.id,
            h.id,
            world.places[a.placeId]?.tags.includes('church') ? 'church attendance' : 'a visit',
          );
      }
      for (const store of rowsOf(world.provisions.stores)) {
        const keeper = store.ownerHouseholdId === null ? undefined : world.households[store.ownerHouseholdId]?.headId;
        if (
          keeper !== undefined &&
          h.memberIds.some((id) => (store.tabs[id] ?? 0) >= store.creditLimitCents && store.creditLimitCents > 0)
        )
          notice(world, ctx, keeper, h.id, 'the unpaid tab ledger');
      }
    }
    // Plan an errand in the morning and at Sunday collection. Observations above
    // still follow meetings; existing intentions and requests arbitrate each hour.
    if (!rule.offer_hours.includes(ctx.cal.hour) && !(ctx.cal.isSabbath && ctx.cal.hour === 10)) return;
    for (const a of actors) {
      if (ageYears(a, ctx.now) < 16) continue;
      let best: { targetId: ActorId; interactionId: string; score: number } | undefined;
      if (st.offers[a.id]) continue;
      for (const b of actors) {
        if (
          a.id === b.id ||
          ageYears(b, ctx.now) < 16 ||
          (a.householdId === b.householdId && !officeOf(world, a.id) && !officeOf(world, b.id))
        )
          continue;
        const key = `${a.id}:${b.id}`;
        if ((st.attempts[key] ?? -100000) > ctx.now - 24 * 60) continue;
        if (knowsWant(world, ctx.content, a.id, b.householdId)) {
          const score = charityScore(world, a.id, b.id, ctx.content);
          if (
            score > 300 &&
            (a.placeId === b.placeId
              ? reliefPlan(world, ctx, a.id, b.id, 'give', parcels)
              : reliefParcel(
                  world,
                  ctx.content,
                  a.id,
                  b.id,
                  rule.reserve_days,
                  rule.parcel_days,
                  ctx.now,
                  undefined,
                  false,
                  parcels,
                ))
          )
            if (!best || score > best.score) best = { targetId: b.id, interactionId: 'give_relief', score };
        }
        // Weekly collection from a willing member with a real surplus.
        const office = officeOf(world, b.id);
        if (
          !best &&
          ctx.cal.weekday === 'sun' &&
          office?.members.includes(a.householdId) &&
          collecting(world, ctx, office) &&
          reliefParcel(
            world,
            ctx.content,
            a.id,
            b.id,
            rule.reserve_days,
            rule.parcel_days,
            ctx.now,
            undefined,
            true,
            parcels,
          )
        )
          best = { targetId: b.id, interactionId: 'collect_relief', score: 550 };
      }
      if (best) st.offers[a.id] = { targetId: best.targetId, interactionId: best.interactionId, at: ctx.now };
    }
  });
}
export function charityScore(world: World, giver: ActorId, recipient: ActorId, content: ContentBundle): number {
  const a = world.actors[giver];
  if (!a) return 0;
  const op = opinionOf(world, giver, recipient);
  const traits = effectiveTraits(world, giver);
  return (
    (reliefRules(content)?.duty_base ?? 620) +
    valueView(a, 'neighborliness') * 65 -
    valueView(a, 'thrift') * 35 +
    op.affection * 3 +
    op.trust * 2 +
    (areKin(world, giver, recipient) ? 180 : 0) +
    (sameFaith(world, giver, recipient) ? 100 : 0) +
    (traits.includes('generous') ? 80 : 0)
  );
}
export function reliefUrges(world: World, ctx: SimContext, id: ActorId): UrgeProposal[] {
  const st = world.social.relief,
    a = world.actors[id];
  if (!st || !a || ctx.cal.hour < 7 || ctx.cal.hour > 20 || ageYears(a, ctx.now) < 16) return [];
  const out: UrgeProposal[] = [];
  const offer = st.offers[id];
  const target = offer ? world.actors[offer.targetId] : undefined;
  const destination = target
    ? offer?.interactionId === 'collect_relief'
      ? officeOf(world, target.id)?.placeId
      : world.households[target.householdId]?.homePlaceId
    : undefined;
  if (
    offer &&
    target &&
    destination !== undefined &&
    (target.placeId === a.placeId || target.placeId === destination) &&
    ctx.now - offer.at <= 2 * 1440 &&
    (st.attempts[`${id}:${offer.targetId}`] ?? -100000) <= ctx.now - 1440
  ) {
    const intensity = Math.max(0, Math.min(950, charityScore(world, id, offer.targetId, ctx.content)));
    out.push({
      urge:
        world.actors[offer.targetId]?.placeId === a.placeId
          ? { kind: 'interaction', interactionId: offer.interactionId, targetId: offer.targetId }
          : {
              kind: 'activity',
              activityId: 'walk',
              placeId: destination,
            },
      voice: 'superego',
      intensity,
      label: 'There is food to spare; a neighbor is in want',
      source: 'social',
      norm: 'duty',
      reasons: [term('belief', 'Known want and a safe pantry reserve', intensity)],
    });
  }
  const want = st.wants[a.householdId];
  if (
    want?.active &&
    knowsWant(world, ctx.content, id, a.householdId) &&
    (world.households[a.householdId]?.headId === id || !canAct(world, world.households[a.householdId]?.headId ?? id))
  ) {
    const candidates = rowsOf(world.actors)
      .filter(
        (b) =>
          b.alive &&
          b.id !== id &&
          (b.householdId !== a.householdId || officeOf(world, b.id)) &&
          ageYears(b, ctx.now) >= 16 &&
          (officeOf(world, b.id) || world.social.opinions[id]?.[b.id]) &&
          (st.attempts[`${id}:${b.id}`] ?? -100000) <= ctx.now - 2 * 1440,
      )
      .sort(
        (x, y) =>
          Number(!!officeOf(world, y.id)) - Number(!!officeOf(world, x.id)) ||
          opinionOf(world, id, y.id).trust - opinionOf(world, id, x.id).trust ||
          x.id - y.id,
      );
    const b = candidates[0];
    if (b)
      out.push({
        urge:
          a.placeId === b.placeId
            ? { kind: 'interaction', interactionId: 'ask_relief', targetId: b.id }
            : { kind: 'activity', activityId: 'walk', placeId: b.placeId },
        voice: 'id',
        intensity: Math.min(960, 700 + Math.max(0, 300 - needValue(world, id, 'hunger'))),
        label: `Ask ${b.name.given} for food`,
        source: 'social',
        drive: 'hunger',
        reasons: [term('belief', 'Our household is in want', 800)],
      });
  }
  return out;
}
export interface ReliefPlan {
  giver: ActorId;
  recipient: ActorId;
  parcel: FoodParcel;
  office?: ReliefOffice;
  collection: boolean;
}
export function reliefPlan(
  world: World,
  ctx: SimContext,
  i: ActorId,
  t: ActorId,
  act: NonNullable<InteractionDef['relief']>,
  memo?: ReliefPlanningMemo,
): ReliefPlan | null {
  const rule = reliefRules(ctx.content);
  if (!rule) return null;
  const giver = act === 'ask' ? t : i,
    recipient = act === 'ask' ? i : t;
  const a = world.actors[giver],
    b = world.actors[recipient];
  if (!a?.alive || !b?.alive || a.placeId !== b.placeId || !canAct(world, giver)) return null;
  const office = officeOf(world, act === 'collect' ? recipient : giver);
  if (act === 'collect' && (!office || a.placeId !== office.placeId || !collecting(world, ctx, office))) return null;
  if (office && act !== 'collect') {
    const def = ctx.content.reliefOffices[office.ruleId];
    if (def?.members_only && !office.members.includes(b.householdId)) return null;
    // Members first: outsiders wait while a member is known to need the pantry.
    if (
      !office.members.includes(b.householdId) &&
      office.members.some((h) => knowsWant(world, ctx.content, giver, h) && world.social.relief?.wants[h]?.active)
    )
      return null;
    const deserving = world.belief.propByKey[propKey('deserving_relief', [{ kind: 'actor', id: recipient }])];
    if ((deserving === undefined ? 20 : credenceOf(world, giver, deserving)) < (def?.deserving_credence ?? 40))
      return null;
    if (a.placeId === office.placeId) {
      const parcel = reliefParcel(
        world,
        ctx.content,
        giver,
        recipient,
        0,
        rule.parcel_days,
        ctx.now,
        officeItems(world, office),
        false,
        memo,
      );
      if (parcel) return { giver, recipient, parcel, office, collection: false };
    }
  }
  const parcel = reliefParcel(
    world,
    ctx.content,
    giver,
    recipient,
    rule.reserve_days,
    rule.parcel_days,
    ctx.now,
    undefined,
    act === 'collect',
    memo,
  );
  return parcel ? { giver, recipient, parcel, ...(office ? { office } : {}), collection: act === 'collect' } : null;
}
export function reliefDecision(
  world: World,
  ctx: SimContext,
  i: ActorId,
  t: ActorId,
  act: NonNullable<InteractionDef['relief']>,
  accepted: boolean,
): { plan: ReliefPlan | null; explain: Explain } {
  const st = state(world);
  st.attempts[`${i}:${t}`] = ctx.now;
  delete st.offers[i];
  const giver = act === 'ask' ? t : i,
    recipient = act === 'ask' ? i : t;
  // Deservingness is a fallible social inference, never an objective actor tag.
  if (act !== 'collect' && officeOf(world, giver)) {
    const prop = internProp(world, 'deserving_relief', [{ kind: 'actor', id: recipient }]);
    observe(world, ctx, giver, prop, {
      type: 'inference',
      dir: opinionOf(world, giver, recipient).trust >= 0 ? 1 : -1,
      sourceId: null,
      eventId: null,
      scalePct: 200,
    });
  }
  let plan = reliefPlan(world, ctx, i, t, act);
  const pride = effectiveTraits(world, recipient).includes('proud') ? 3 : 0;
  const prideRoll =
    !accepted && act === 'give' && pride >= 2 && needValue(world, recipient, 'hunger') > 300
      ? ctx.rng('social', mixKey(i, t, 0xfee1)).int(1, 20)
      : null;
  const refusal = prideRoll !== null && prideRoll <= pride * 3;
  if (refusal || (act === 'ask' && charityScore(world, giver, recipient, ctx.content) < 300)) plan = null;
  if (!plan && act === 'ask')
    formGrudge(world, ctx, {
      holderId: i,
      target: { kind: 'actor', id: t },
      aim: 'restitution',
      intensity: 20,
      label: 'Turned away in want',
    });
  return {
    plan,
    explain: {
      kind: 'choice',
      label: 'Relief: means and norms',
      subjects: [giver],
      knowledge: 'self',
      terms: [
        term('opinion', 'Willingness to help', charityScore(world, giver, recipient, ctx.content)),

        term('food', 'Donor reserve days', reliefRules(ctx.content)?.reserve_days ?? 4),
      ],
      total: plan ? plan.parcel.qty : 0,
      outcome: plan ? 'food offered' : refusal ? 'pride refused' : 'no eligible surplus',
      ...(prideRoll === null
        ? {}
        : {
            children: [
              {
                kind: 'check',
                label: 'Accept charity despite pride',
                subjects: [recipient],
                knowledge: 'self',
                terms: [term('roll', 'Pride roll', prideRoll)],
                total: prideRoll,
                dc: { total: pride * 3, terms: [term('trait', 'Pride threshold', pride * 3)] },
                outcome: refusal ? 'refused' : 'accepted',
              } as Explain,
            ],
          }),
    },
  };
}
export function deliverRelief(
  world: World,
  ctx: SimContext,
  plan: ReliefPlan,
  eventId: EventId,
  giverBasis: Basis = { kind: 'own' },
  recipientBasis: Basis = { kind: 'own' },
): void {
  const { giver, recipient, parcel, office, collection } = plan;
  if (
    !authorizeAct(world, giver, { kind: 'give_food', targetId: recipient }, giverBasis).ok ||
    !authorizeAct(world, recipient, { kind: 'accept_favor', targetId: giver }, recipientBasis).ok
  )
    return;
  const b = world.actors[recipient];
  if (!b) return;
  const moved = moveStack(
    world,
    ctx,
    parcel.itemId,
    parcel.qty,
    collection && office ? atPlace(office.placeId) : pantryOf(b.householdId),
  );
  if (moved === null) return;
  if (collection && office && !office.pantry.includes(moved)) office.pantry.push(moved);
  if (office) office.pantry = officeItems(world, office);
  const favors = collection ? 0 : office ? (ctx.content.reliefOffices[office.ruleId]?.favors ?? 1) : 1;
  if (office && !collection) office.favors[b.householdId] = (office.favors[b.householdId] ?? 0) + favors;
  ctx.emit({
    kind: 'social.relief',
    data: {
      giverId: giver,
      recipientId: recipient,
      itemId: moved,
      qty: parcel.qty,
      ...(office ? { officeId: office.id } : {}),
      collection,
      favors,
    },
    causes: [eventId],
    roles: [
      { actor: giver, role: 'agent' },
      { actor: recipient, role: 'target' },
    ],
    visibility: 'private',
    importance: 30,
    explain: {
      kind: 'transfer',
      label: collection ? 'Collected for the poor pantry' : 'Food given in relief',
      subjects: [giver, recipient],
      knowledge: 'participants',
      terms: [term('food', 'Units transferred', parcel.qty), term('obligation', 'Favors owed', favors)],
      total: parcel.qty,
      outcome: 'delivered',
    },
  });
}

/** Called by activity before departure, after psyche has selected the errand. */
export function prepareReliefTravel(world: World, ctx: SimContext): void {
  const rule = reliefRules(ctx.content);
  if (!rule) return;
  // Pack only after the delivery/collection errand wins psyche arbitration.
  for (const [key, offer] of Object.entries(world.social.relief?.offers ?? {})) {
    const id = Number(key) as ActorId,
      a = world.actors[id],
      b = world.actors[offer.targetId];
    const chosen = chosenUrge(world, id);
    if (
      !a ||
      !b ||
      offer.packed !== undefined ||
      chosen?.at !== ctx.now ||
      chosen.urge.kind !== 'activity' ||
      chosen.urge.activityId !== 'walk' ||
      !authorizeAct(world, id, { kind: 'give_food' }, { kind: 'own' }).ok
    )
      continue;
    const destination =
      offer.interactionId === 'collect_relief'
        ? officeOf(world, b.id)?.placeId
        : world.households[b.householdId]?.homePlaceId;
    if (chosen.urge.placeId !== destination || a.placeId !== world.households[a.householdId]?.homePlaceId) continue;
    const parcel = reliefParcel(world, ctx.content, id, b.id, rule.reserve_days, rule.parcel_days, ctx.now);
    if (parcel) {
      const stack = world.items.stacks[parcel.itemId];
      const unit = stack ? (ctx.content.items[stack.defId]?.weight_g ?? 0) : 0;
      const qty = unit > 0 ? Math.min(parcel.qty, Math.floor(movableRoomG(world, ctx.content, id) / unit)) : parcel.qty;
      if (qty > 0) offer.packed = moveStack(world, ctx, parcel.itemId, qty, carriedBy(id));
    } else delete world.social.relief?.offers[id];
  }
}

/** A chosen relief conversation reserves its present participants just like a Command. */
export function reliefReservations(world: World, ctx: SimContext): ActorId[] {
  const out: ActorId[] = [];
  for (const a of rowsOf(world.actors)) {
    const c = chosenUrge(world, a.id),
      u = c?.urge;
    if (
      c?.at !== ctx.now ||
      u?.kind !== 'interaction' ||
      u.targetId === undefined ||
      !ctx.content.interactions[u.interactionId]?.relief
    )
      continue;
    if (!authorizeAct(world, a.id, { kind: 'interaction' }, { kind: 'own' }).ok && c.voice !== 'command') continue;
    if (interactionAvailability(world, ctx.content, a.id, u.targetId, u.interactionId).ok) {
      out.push(a.id);
      if (authorizeAct(world, u.targetId, { kind: 'interaction' }, { kind: 'own' }).ok) out.push(u.targetId);
    }
  }
  return out;
}

/** A moved-out or spoiled-away stack is no longer the office's property. */
function officeItems(world: World, office: ReliefOffice): ItemId[] {
  return office.pantry.filter((id) => {
    const stack = world.items.stacks[id];
    if (!stack || stack.qty <= 0) return false;
    const root = rootOf(world, stack);
    return root.kind === 'place' && root.placeId === office.placeId;
  });
}

/** A collection target limits accumulation; it does not certify a balanced or cookable pantry. */
function collecting(world: World, ctx: SimContext, office: ReliefOffice): boolean {
  const rule = ctx.content.reliefOffices[office.ruleId];
  const days = rule?.pantry_target_days ?? 7;
  const daily = (hid: HouseholdId) =>
    (world.households[hid]?.memberIds ?? []).reduce(
      (n, id) => n + (world.actors[id]?.alive ? dailyKcal(world, ctx.content, id, ctx.now) : 0),
      0,
    );
  let knownNeed = 0;
  for (const h of rowsOf(world.households))
    if ((!rule?.members_only || office.members.includes(h.id)) && knowsWant(world, ctx.content, office.keeperId, h.id))
      knownNeed += daily(h.id);
  // Keep a modest reserve even before want is reported. Collect for known want,
  // not a week's food for every prosperous congregant as well as the poor.
  const keeperHouse = world.actors[office.keeperId]?.householdId;
  const target = Math.max(knownNeed, keeperHouse === undefined ? 0 : daily(keeperHouse)) * days;
  let stored = 0;
  for (const id of officeItems(world, office)) {
    const stack = world.items.stacks[id];
    if (stack && stack.spoilage < 500 && stack.condition > 0)
      stored += (ctx.content.items[stack.defId]?.food?.kcal ?? 0) * stack.qty;
  }
  return stored < target;
}
