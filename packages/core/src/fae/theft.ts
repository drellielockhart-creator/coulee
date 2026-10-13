/** Possession changes at the taking; knowledge changes at an ordinary check. OWNER: module:fae. */
import { isAsleep } from '../activity/api.ts';
import { internProp, observe, reportMisfortune } from '../belief/api.ts';
import { skillCheck } from '../checks.ts';
import { term } from '../explain.ts';
import { type ActorId, type EventId, type ItemId, idsOf } from '../ids.ts';
import { carriedBy, rootOf } from '../items/api.ts';
import { canAct } from '../needs/api.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { charmIds, holdingOf, transact } from './charms.ts';
import { actorArg, credence, itemArg } from './desire.ts';
import type { CharmTheft } from './state.ts';

/** Only the generic social theft executor moves goods; the fae probe audits that move. */
export function auditCharmTheft<T>(world: World, itemId: ItemId, actorId: ActorId, move: () => T): T {
  const stack = world.items.stacks[itemId];
  if (!world.fae.charms?.[itemId] || !stack) return move();
  return transact(world, 'charm theft', [{ loc: rootOf(world, stack) }, { loc: carriedBy(actorId) }], move);
}

/** Called after a successful social.attemptTheft. Returns true when discovery belongs to fae. */
export function recordCharmTheft(
  world: World,
  ctx: SimContext,
  req: {
    itemId: ItemId;
    actorId: ActorId;
    victimId: ActorId;
    eventId: EventId;
    witnesses: ActorId[];
  },
): boolean {
  const c = world.fae.charms?.[req.itemId];
  const victim = world.actors[req.victimId];
  const thief = world.actors[req.actorId];
  if (!c || !victim || !thief) return false;
  c.thefts ??= [];
  c.thefts.push({
    at: ctx.now,
    thiefId: req.actorId,
    victimId: req.victimId,
    householdId: victim.householdId,
    placeId: thief.placeId,
    eventId: req.eventId,
    witnesses: req.witnesses,
    discoveredAt: null,
    misfortuneId: null,
    lastCheckDay: -1,
    refused: Object.keys(c.refusals ?? {})
      .map(Number)
      .sort((a, b) => a - b)
      .filter(
        (id) => (c.refusals?.[id]?.n ?? 0) > 0 && (c.refusals?.[id]?.by ?? c.custodianId) === req.victimId,
      ) as ActorId[],
  });
  // Possession is not right. Neither boundTo nor anyone's owns claim changes. A theft also
  // gives the former keeper no relief from the conscience of refusing to lend.
  c.custodianId = req.actorId;
  c.tie = null;
  const eventId = ctx.emit({
    kind: 'fae.charm_stolen',
    visibility: req.witnesses.length ? 'witnessed' : 'secret',
    place: thief.placeId,
    causes: [req.eventId],
    importance: 45,
    roles: [
      { actor: req.actorId, role: 'agent' },
      ...req.witnesses.map((actor) => ({ actor, role: 'witness' as const })),
    ],
    data: {
      itemId: req.itemId,
      actorId: req.actorId,
      victimId: req.victimId,
      text: `${thief.name.given} took the sack from ${victim.name.given}'s keeping; possession gave no right to it.`,
    },
    explain: {
      kind: 'formula',
      label: 'Keeper by possession',
      subjects: [req.actorId],
      knowledge: 'participants',
      terms: [term('item', 'The existing sack changed hands', 1)],
      total: 1,
      outcome: 'taken, not granted',
    },
  });
  for (const observer of [req.actorId, ...req.witnesses]) {
    observe(world, ctx, observer, internProp(world, 'has', [actorArg(req.actorId), itemArg(req.itemId)]), {
      type: 'observation',
      dir: 1,
      sourceId: null,
      eventId,
    });
    observe(world, ctx, observer, internProp(world, 'has', [actorArg(req.victimId), itemArg(req.itemId)]), {
      type: 'observation',
      dir: -1,
      sourceId: null,
      eventId,
    });
  }
  return true;
}

/** Evidence first: witnesses or a known new possessor; otherwise the keeper's refused askers. */
function suspectOf(
  world: World,
  observer: ActorId,
  itemId: ItemId,
  loss: CharmTheft,
): { id: ActorId; seen: boolean } | null {
  if (loss.witnesses.includes(observer)) return { id: loss.thiefId, seen: true };
  const candidates = idsOf<ActorId>(world.actors);
  let best: { id: ActorId; score: number } | null = null;
  for (const id of candidates) {
    const a = world.actors[id];
    if (!a?.alive || a.householdId === loss.householdId) continue;
    const possession = credence(world, observer, 'has', [actorArg(id), itemArg(itemId)]);
    const priorCharge = credence(world, observer, 'took_goods', [actorArg(id), actorArg(loss.victimId)]);
    const refused = observer === loss.victimId && loss.refused.includes(id) ? 60 : 0;
    const score = (possession >= 50 ? possession + 80 : 0) + priorCharge + refused;
    if (score > (best?.score ?? 0)) best = { id, score };
  }
  return best ? { id: best.id, seen: false } : null;
}

/** A count/check finds absence, never the hidden thief. Once per loss; truth survives log retention. */
export function checkCharmLoss(world: World, ctx: SimContext, actorId: ActorId): number {
  const a = world.actors[actorId];
  if (!a?.alive || !canAct(world, actorId) || isAsleep(world, ctx, actorId)) return 0;
  let found = 0;
  for (const itemId of charmIds(world)) {
    const c = world.fae.charms?.[itemId];
    const stack = world.items.stacks[itemId];
    if (!c) continue;
    for (const loss of c.thefts ?? []) {
      if (loss.discoveredAt !== null || loss.householdId !== a.householdId || loss.placeId !== a.placeId) continue;
      // A sack returned before it was missed is no fresh accusation.
      if (stack && holdingOf(world, stack).householdId === loss.householdId) {
        loss.discoveredAt = ctx.now;
        continue;
      }
      const roll = skillCheck(
        ctx.content,
        a,
        { label: 'Check the sack against the stores', skill: 'perception', dc: 8, knowledge: 'self' },
        ctx.rng('checks', mixKey(itemId, actorId, loss.at, 0x5ac7)),
      );
      if (!roll.success) continue;
      loss.discoveredAt = ctx.now;
      found++;
      loss.misfortuneId = reportMisfortune(world, ctx, {
        kindId: 'goods_missing',
        householdId: a.householdId,
        victimId: loss.victimId,
        placeId: loss.placeId,
        culpritId: loss.thiefId,
        causeItemId: itemId,
      });
      const eventId = ctx.emit({
        kind: 'fae.charm_missing',
        visibility: 'public',
        place: a.placeId,
        importance: 50,
        roles: [{ actor: actorId, role: 'agent' }],
        data: {
          itemId,
          actorId,
          householdId: a.householdId,
          misfortuneId: loss.misfortuneId,
          text: 'The sack is missing from its place. Somebody has taken it; the count does not say who.',
        },
        explain: roll.explain,
      });
      observe(world, ctx, actorId, internProp(world, 'has', [actorArg(loss.victimId), itemArg(itemId)]), {
        type: 'physical',
        dir: -1,
        sourceId: null,
        eventId,
      });
      for (const observer of new Set([actorId, loss.victimId, ...loss.witnesses])) {
        const suspect = suspectOf(world, observer, itemId, loss);
        if (!suspect) continue;
        const evidence = {
          type: suspect.seen ? ('observation' as const) : ('inference' as const),
          dir: 1 as const,
          sourceId: null,
          eventId,
          scalePct: suspect.seen ? 100 : 60,
        };
        // The existing charge, attribution, strife and law machinery carries this belief on.
        observe(
          world,
          ctx,
          observer,
          internProp(world, 'took_goods', [actorArg(suspect.id), actorArg(loss.victimId)]),
          evidence,
        );
        if (loss.misfortuneId !== null)
          observe(
            world,
            ctx,
            observer,
            internProp(world, 'caused', [actorArg(suspect.id), { kind: 'misfortune', id: loss.misfortuneId }]),
            evidence,
          );
      }
    }
  }
  return found;
}

/** Looking for the sack at a meal or counting it is ordinary discovery, not telepathy. */
export function theftDiscoveryHour(world: World, ctx: SimContext): void {
  if (![7, 12, 18].includes(ctx.cal.hour)) return;
  for (const itemId of charmIds(world)) {
    const c = world.fae.charms?.[itemId];
    for (const loss of c?.thefts ?? []) {
      if (loss.discoveredAt !== null || loss.at >= ctx.now || loss.lastCheckDay === ctx.cal.dayIndex) continue;
      const observer = [loss.victimId, ...(world.households[loss.householdId]?.memberIds ?? [])].find((id) => {
        const a = world.actors[id];
        return a?.alive && a.placeId === loss.placeId && canAct(world, id) && !isAsleep(world, ctx, id);
      });
      if (observer === undefined) continue;
      loss.lastCheckDay = ctx.cal.dayIndex;
      checkCharmLoss(world, ctx, observer);
    }
  }
}
