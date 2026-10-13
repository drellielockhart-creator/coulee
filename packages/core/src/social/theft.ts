/** Generic theft, reusable for any physical goods. Knowledge follows detection, not truth. */

import { formGrudge, internProp, observe, reportMisfortune } from '../belief/api.ts';
import type { ContentBundle } from '../content.ts';
import { term } from '../explain.ts';
import { type ActorId, type EventId, type ItemId, mustGet, rowsOf } from '../ids.ts';
import { atPlace, carriedBy, moveStack, pantryOf, rootOf, stacksDeep } from '../items/api.ts';
import { canAct, needValue } from '../needs/api.ts';
import { addAnxiety, addThought, authorizeAct, type Basis, normStrength } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { addMemory, areKin } from './api.ts';
import { addReason } from './opinion.ts';
import { reliefRules } from './relief.ts';
import { noteStrife } from './strife.ts';
import { ageYears } from './tuning.ts';

export interface TheftRequest {
  actorId: ActorId;
  victimId: ActorId;
  itemId?: ItemId;
  qty?: number;
  basis?: Basis;
  interactionId?: string;
}
export interface TheftOutcome {
  eventId: EventId;
  success: boolean;
  detected: boolean;
  movedId: ItemId | null;
}
function reachable(world: World, actor: ActorId, victim: ActorId, item: ItemId): boolean {
  const a = world.actors[actor],
    v = world.actors[victim],
    s = world.items.stacks[item];
  if (!a || !v || !s || a.householdId === v.householdId || s.condition <= 0 || s.qty <= 0) return false;
  const root = rootOf(world, s);
  if (root.kind === 'actor') return root.actorId === victim && v.placeId === a.placeId;
  if (root.kind === 'household')
    return root.householdId === v.householdId && world.households[v.householdId]?.homePlaceId === a.placeId;
  return (
    root.kind === 'place' &&
    root.placeId === a.placeId &&
    world.provisions.stores[root.placeId]?.ownerHouseholdId === v.householdId
  );
}
function foodToTake(
  world: World,
  ctx: Pick<SimContext, 'content'>,
  id: ActorId,
): { victimId: ActorId; itemId: ItemId } | null {
  const a = world.actors[id];
  if (!a) return null;
  // Local inventories only; no global stack scan per hungry actor-hour.
  const store = world.provisions.stores[a.placeId];
  const home = rowsOf(world.households).find((h) => h.homePlaceId === a.placeId && h.id !== a.householdId);
  const victim = store?.ownerHouseholdId ? world.households[store.ownerHouseholdId]?.headId : home?.headId;
  if (victim === undefined) return null;
  const loc = store ? atPlace(a.placeId) : pantryOf(mustGet(world.actors, victim, 'victim').householdId);
  for (const { stack: s } of stacksDeep(world, loc))
    if (ctx.content.items[s.defId]?.food && s.spoilage < 500 && reachable(world, id, victim, s.id))
      return { victimId: victim, itemId: s.id };
  return null;
}
/** Supplied item wins; default selection is food at the actor's present location. */
export function attemptTheft(world: World, ctx: SimContext, req: TheftRequest): TheftOutcome {
  const { actorId, victimId } = req;
  const itemId = req.itemId ?? foodToTake(world, ctx, actorId)?.itemId;
  const qty = req.qty ?? 1;
  const basis = req.basis ?? { kind: 'own' };
  const permission = authorizeAct(
    world,
    actorId,
    { kind: 'theft', targetId: victimId, ...(itemId === undefined ? {} : { itemId }) },
    basis,
  );
  const cooldown = world.social.relief?.attempts[`theft:${actorId}`] ?? -100000;
  const valid =
    permission.ok &&
    canAct(world, actorId) &&
    itemId !== undefined &&
    Number.isSafeInteger(qty) &&
    qty > 0 &&
    reachable(world, actorId, victimId, itemId) &&
    ctx.now - cooldown >= 1440;
  if (!valid || itemId === undefined) {
    const eventId = ctx.emit({
      kind: 'social.act_refused',
      data: {
        actorId,
        reason: !permission.ok ? permission.reason : 'Goods are not reachable, or the attempt must wait',
      },
      roles: [{ actor: actorId, role: 'agent' }],
      visibility: 'private',
      explain: {
        kind: 'authorization',
        label: 'Theft preflight',
        subjects: [actorId],
        knowledge: 'self',
        terms: [],
        total: 0,
        outcome: 'refused',
      },
    });
    return { eventId, success: false, detected: false, movedId: null };
  }
  world.social.relief ??= { wants: {}, offices: [], attempts: {}, offers: {} };
  world.social.relief.attempts[`theft:${actorId}`] = ctx.now;
  const a = mustGet(world.actors, actorId, 'thief'),
    v = mustGet(world.actors, victimId, 'victim');
  const rng = ctx.rng('social', mixKey(actorId, victimId, itemId, 0x7ef7));
  const skill = (a.sheet.skills.stealth ?? 0) + Math.floor((a.sheet.abilities.dex - 10) / 2);
  const roll = rng.int(1, 20),
    spot = rng.int(1, 20);
  const rule = reliefRules(ctx.content);
  const dc = rule?.theft_dc ?? 13;
  const witnesses = rowsOf(world.actors).filter(
    (o) => o.id !== actorId && o.alive && o.placeId === a.placeId && canAct(world, o.id),
  );
  const detected = witnesses.length > 0 && spot + skill < (rule?.detection_dc ?? 12) + Math.min(5, witnesses.length);
  const success = roll + skill >= dc;
  const s = mustGet(world.items.stacks, itemId, 'stolen goods');
  const amount = Math.min(qty, s.qty);
  const eventId = ctx.emit({
    kind: 'social.theft',
    data: { actorId, victimId, itemId, qty: success ? amount : 0, success, detected },
    roles: [
      { actor: actorId, role: 'agent' },
      ...(detected
        ? [
            ...(v.placeId === a.placeId ? [{ actor: victimId, role: 'victim' as const }] : []),
            ...witnesses.map((o) => ({ actor: o.id, role: 'witness' as const })),
          ]
        : []),
    ],
    visibility: detected ? 'witnessed' : 'secret',
    place: a.placeId,
    importance: detected ? 45 : 10,
    explain: {
      kind: 'check',
      label: 'Taking goods unseen',
      subjects: [actorId],
      knowledge: 'self',
      terms: [term('skill', 'Stealth and dexterity', skill), term('roll', 'Effort roll', roll)],
      total: roll + skill,
      dc: { total: dc, terms: [term('base', 'Theft difficulty', dc)] },
      outcome: success ? 'taken' : 'failed',
      note: detected ? 'Someone saw the attempt' : 'No witness identified the taker',
      children: [
        {
          kind: 'check',
          label: 'Detection',
          subjects: [actorId],
          knowledge: 'self',
          terms: [term('roll', 'Concealment roll', spot), term('skill', 'Stealth and dexterity', skill)],
          total: spot + skill,
          dc: {
            total: (rule?.detection_dc ?? 12) + Math.min(5, witnesses.length),
            terms: [
              term('base', 'Detection difficulty', rule?.detection_dc ?? 12),
              term('audience', 'Watchful people', Math.min(5, witnesses.length)),
            ],
          },
          outcome: detected ? 'detected' : 'unseen',
        },
      ],
    },
  });
  ctx.emit({
    kind: 'social.interaction',
    data: {
      interactionId: req.interactionId ?? 'steal_goods',
      initiatorId: actorId,
      targetId: victimId,
      placeId: a.placeId,
      success,
      label: success ? 'Goods taken' : 'The attempt failed',
      itemId,
    },
    causes: [eventId],
    roles: [
      { actor: actorId, role: 'agent' },
      ...(detected ? witnesses.map((o) => ({ actor: o.id, role: 'witness' as const })) : []),
    ],
    visibility: detected ? 'witnessed' : 'secret',
    place: a.placeId,
    explain: {
      kind: 'check',
      label: 'Take goods',
      subjects: [actorId],
      knowledge: 'self',
      terms: [term('roll', 'Effort roll', roll), term('skill', 'Stealth and dexterity', skill)],
      total: roll + skill,
      dc: { total: dc, terms: [] },
      outcome: success ? 'success' : 'failure',
    },
  });
  world.social.totals.interactions += 1;
  world.social.daily.interactions += 1;
  world.social.daily.checks += 1;
  const movedId = success ? moveStack(world, ctx, itemId, amount, carriedBy(actorId)) : null;
  const cost = 30 + Math.floor(normStrength(world, actorId, 'duty') / 5);
  addAnxiety(world, ctx, actorId, cost, 'moral');
  addThought(world, ctx, actorId, {
    urge: { kind: 'interaction', interactionId: 'apologize', targetId: victimId },
    voice: 'superego',
    intensity: Math.min(950, 400 + cost * 3),
    label: 'Those goods were not yours',
    source: 'social',
    norm: 'duty',
    reasons: [term('norm', 'Moral cost of theft', cost)],
  });
  if (success)
    reportMisfortune(world, ctx, {
      kindId: 'goods_missing',
      householdId: v.householdId,
      victimId,
      placeId: a.placeId,
      culpritId: actorId,
    });
  if (detected) {
    const prop = internProp(world, 'took_goods', [
      { kind: 'actor', id: actorId },
      { kind: 'actor', id: victimId },
    ]);
    for (const o of success ? witnesses : [])
      observe(world, ctx, o.id, prop, { type: 'observation', dir: 1, sourceId: null, eventId });
    if (v.placeId !== a.placeId) return { eventId, success, detected, movedId };
    noteStrife(world, ctx, actorId, victimId, false, eventId, areKin(world, actorId, victimId));
    const memory = addMemory(world, ctx, {
      ownerId: victimId,
      eventId,
      kind: 'theft',
      at: ctx.now,
      placeId: a.placeId,
      roles: [{ who: actorId, role: 'agent', conf: 1000 }],
      source:
        v.placeId === a.placeId
          ? { kind: 'witnessed' }
          : { kind: 'told', by: witnesses[0]?.id ?? victimId, rumorId: null },
      emotion: 'anger',
      intensity: 65,
      salience: 800,
      confidence: 1000,
      rehearsals: 0,
      pinned: false,
      summary: `${a.name.given} ${success ? 'took' : 'tried to take'} our goods`,
      aboutId: actorId,
    });
    if (memory !== null)
      addReason(
        world,
        ctx.content,
        victimId,
        actorId,
        {
          label: 'Took our goods',
          cites: { kind: 'memory', id: memory },
          delta: { affection: -15, trust: -25, respect: -10, fear: 5 },
          since: ctx.now,
        },
        ctx.now,
      );
    formGrudge(world, ctx, {
      holderId: victimId,
      target: { kind: 'actor', id: actorId },
      aim: 'restitution',
      intensity: 55,
      label: 'Goods taken before witnesses',
    });
  }
  return { eventId, success, detected, movedId };
}
export function desperationUrges(world: World, ctx: SimContext, id: ActorId): UrgeProposal[] {
  const a = world.actors[id],
    r = reliefRules(ctx.content);
  if (
    !r ||
    !a ||
    needValue(world, id, 'hunger') >= r.theft_hunger ||
    ageYears(a, ctx.now) < 12 ||
    ctx.cal.hour < 7 ||
    ctx.cal.hour > 20 ||
    ctx.now - (world.social.relief?.attempts[`theft:${id}`] ?? -100000) < 1440
  )
    return [];
  const target = foodToTake(world, ctx, id);
  if (!target) return [];
  const intensity = Math.min(990, 800 + (r.theft_hunger - needValue(world, id, 'hunger')));
  const restraint: UrgeProposal = {
    urge: { kind: 'interaction', interactionId: 'ask_relief', targetId: target.victimId },
    voice: 'superego',
    intensity: Math.min(950, 350 + normStrength(world, id, 'piety') * 4),
    label: 'Ask for bread; taking it is wrong',
    source: 'social',
    norm: 'piety',
    reasons: [term('norm', 'Conscience against theft', normStrength(world, id, 'piety'))],
  };
  return [
    restraint,
    {
      urge: { kind: 'interaction', interactionId: 'steal_goods', targetId: target.victimId, itemId: target.itemId },
      voice: 'id',
      intensity,
      label: 'Take food; we cannot go hungry again',
      source: 'social',
      drive: 'hunger',
      reasons: [term('need', 'Hunger and desperate want', intensity)],
    },
  ];
}

/** Read-only host preflight; an explicit item can be any goods, the default is food. */
export function theftPreflight(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  victimId: ActorId,
  itemId?: ItemId,
): string | null {
  const item = itemId ?? foodToTake(world, { content }, actorId)?.itemId;
  if (item === undefined || !reachable(world, actorId, victimId, item))
    return 'There are no reachable goods belonging to that person';
  if (world.time - (world.social.relief?.attempts[`theft:${actorId}`] ?? -100000) < 1440)
    return 'Wait before risking another attempt';
  return null;
}
