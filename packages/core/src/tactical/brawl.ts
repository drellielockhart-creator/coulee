import { leaveTactical } from '../activity/api.ts';
import { displayName, setCondition } from '../actor.ts';
import { skillCheck } from '../checks.ts';
import { recordFight } from '../chronicle/api.ts';
import type { ContentBundle } from '../content.ts';
import { type ActorId, idsOf } from '../ids.ts';
import { applyHit, canAct, combatUnconscious, healthOf, maxVigor, stabilize } from '../needs/api.ts';
import { brawlFear, brawlIntent, endBrawlFear } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import { instantOf } from '../sim/clock.ts';
import type { SimContext } from '../sim/context.ts';
import { recordCombatOutcome } from '../social/api.ts';
import type { World } from '../world.ts';
import { startAction } from './api.ts';
import { grappleCheck, meleeCheck } from './rules.ts';
import { adjacent, closeStep, fleeStep, sceneExit } from './spatial.ts';
import type { Action, Brawl } from './state.ts';

const name = (w: World, id: ActorId) => (w.actors[id] ? displayName(w.actors[id]) : 'Someone');
export function activeBrawls(w: World, id?: ActorId): Brawl[] {
  return (w.tactical?.brawls ?? []).filter(
    (b) => b.endedAt === undefined && (id === undefined || b.a === id || b.b === id),
  );
}
export function restrained(w: World, id: ActorId): boolean {
  return !!w.tactical?.grapples?.some((g) => g.target === id || g.holder === id);
}
function syncGrapples(w: World): void {
  for (const id of idsOf<ActorId>(w.tactical?.participants ?? {})) {
    const a = w.actors[id];
    if (!a) continue;
    const g = w.tactical?.grapples?.find((x) => x.target === id);
    setCondition(a, 'grabbed', g?.stage === 1);
    setCondition(a, 'held', g?.stage === 2);
    setCondition(a, 'pinned', g?.stage === 3);
  }
}
export function brawlCheck(
  w: World,
  c: ContentBundle,
  id: ActorId,
  kind: Action['kind'],
  target?: ActorId,
): string | null {
  const p = w.tactical?.participants[id];
  if (!canAct(w, id)) return 'You cannot act while unconscious or Dying';
  if (p?.fled) return 'You have crossed the door; wait for recovery, then Breathe';
  if ((kind === 'move' || kind === 'flee') && restrained(w, id)) return 'Break the grapple or yield first';
  if (kind === 'flee' && !fleeStep(w, c, id)) return 'No reachable door; move around the obstruction or yield';
  if (kind === 'escape' && !restrained(w, id)) return 'You are not grappling';
  if (kind === 'yield' && (!activeBrawls(w, id).length || p?.submitted)) return 'No ongoing brawl to yield';
  if (kind === 'parley' && !activeBrawls(w).length) return 'No brawl to break up';
  if (['attack', 'grapple', 'accept', 'stabilize'].includes(kind)) {
    if (
      target === undefined ||
      !w.tactical?.participants[target] ||
      (kind !== 'accept' && !adjacent(w, id, target)) ||
      w.actors[id]?.placeId !== w.actors[target]?.placeId
    )
      return 'Choose an adjacent participant';
    const tg = w.tactical.participants[target];
    if (kind === 'stabilize') return healthOf(w, target)?.dying ? null : 'That person is not Dying';
    if (kind === 'accept')
      return tg?.submitted && activeBrawls(w, id).some((b) => b.a === target || b.b === target)
        ? null
        : 'No offered surrender from that person';
    if (p?.submitted || tg?.submitted || !canAct(w, target)) return 'Nonlethal blows stop at submission or incapacity';
    if (w.actors[id]?.sheet.conditions.includes('pinned')) return 'Pinned: break free or yield';
    if (
      kind === 'grapple' &&
      w.tactical.grapples?.some(
        (g) =>
          (g.target === id || g.holder === id || g.target === target || g.holder === target) &&
          !(g.holder === id && g.target === target),
      )
    )
      return 'Break the existing grapple first';
    if (kind === 'grapple' && w.tactical.grapples?.some((g) => g.holder === id && g.target === target && g.stage === 3))
      return 'Already pinned; accept a yield or release with escape';
  }
  return null;
}
export function beginBrawl(w: World, ctx: SimContext, a: ActorId, b: ActorId): void {
  const s = w.tactical;
  if (!s || activeBrawls(w, a).some((x) => x.a === b || x.b === b)) return;
  s.brawls ??= [];
  const episode: Brawl = {
    id: ++s.seq,
    a,
    b,
    startedAt: instantOf(w),
    attempts: 0,
    witnesses: idsOf<ActorId>(w.actors).filter((id) => w.actors[id]?.placeId === s.placeId && canAct(w, id)),
  };
  s.brawls.push(episode);
  s.quietSince = instantOf(w);
  const eventId = ctx.emit({
    kind: 'tactical.danger',
    data: {
      sceneId: s.sceneId,
      actorIds: [a, b],
      text: `${name(w, a)} squares up to ${name(w, b)}. A nonlethal brawl begins.`,
    },
    place: s.placeId,
    roles: [
      { actor: a, role: 'agent' },
      { actor: b, role: 'target' },
    ],
    visibility: 'witnessed',
    importance: 80,
  });
  s.pause = { instant: instantOf(w), eventId };
  decideBrawl(w, ctx, b);
}
function end(w: World, ctx: SimContext, b: Brawl, outcome: NonNullable<Brawl['outcome']>): void {
  const s = w.tactical;
  if (!s || b.endedAt !== undefined) return;
  b.endedAt = instantOf(w);
  b.outcome = outcome;
  s.quietSince = instantOf(w);
  const endings = {
    submission: 'submission accepted; the blows stop',
    knockout: 'a knockout; the blows stop',
    flight: 'one fighter crossing the tavern door',
    peace: 'words breaking up the fight',
    incapacity: 'a fighter unable to continue',
  };
  const text = `${name(w, b.a)} and ${name(w, b.b)}: the brawl ends with ${endings[outcome]}.`;
  const eventId = ctx.emit({
    kind: 'tactical.outcome',
    data: { episodeId: b.id, actorId: b.a, targetId: b.b, outcome, text },
    place: s.placeId,
    roles: [
      { actor: b.a, role: 'agent' },
      { actor: b.b, role: 'target' },
    ],
    visibility: 'witnessed',
    importance: 55,
  });
  s.grapples = (s.grapples ?? []).filter(
    (g) => !((g.holder === b.a && g.target === b.b) || (g.holder === b.b && g.target === b.a)),
  );
  syncGrapples(w);
  for (const id of [b.a, b.b]) endBrawlFear(w, id, activeBrawls(w, id).length ? b.id : undefined);
  if (
    b.attempts > 0 &&
    !s.brawls?.some(
      (prior) =>
        prior !== b && prior.stamped && ((prior.a === b.a && prior.b === b.b) || (prior.a === b.b && prior.b === b.a)),
    ) &&
    recordCombatOutcome(w, ctx, {
      key: `${s.sceneId}:${s.enteredAt}:${Math.min(b.a, b.b)}:${Math.max(b.a, b.b)}`,
      a: b.a,
      b: b.b,
      eventId,
      text,
      outcome,
      witnesses: b.witnesses,
    })
  ) {
    b.stamped = true;
    recordFight(w, ctx, { actors: [b.a, b.b], witnesses: b.witnesses, eventId, placeId: s.placeId, text });
  }
}
export function settleBrawls(w: World, ctx: SimContext): void {
  for (const b of activeBrawls(w)) {
    if ([b.a, b.b].some((id) => !canAct(w, id)))
      end(
        w,
        ctx,
        b,
        [b.a, b.b].some((id) => combatUnconscious(w, id) && !healthOf(w, id)?.dying) ? 'knockout' : 'incapacity',
      );
    else if ([b.a, b.b].some((id) => w.tactical?.participants[id]?.fled)) end(w, ctx, b, 'flight');
    else if ([b.a, b.b].every((id) => w.tactical?.participants[id]?.submitted)) end(w, ctx, b, 'peace');
  }
}
/** Starts one owned action after a real trigger, never during a view or a query-sized tick. */
export function decideBrawl(w: World, ctx: SimContext, id: ActorId): void {
  const s = w.tactical,
    p = s?.participants[id];
  if (!s || !p || p.action || p.submitted || p.fled || !canAct(w, id)) return;
  const b = activeBrawls(w, id)[0];
  if (!b) return;
  const target = b.a === id ? b.b : b.a;
  if (s.participants[target]?.submitted) {
    startAction(w, ctx, id, 'accept', { kind: 'own' }, undefined, target);
    return;
  }
  const intent = brawlIntent(w, ctx, id, {
    hurt: (healthOf(w, id)?.nonlethal ?? 0) * 2 >= maxVigor(w, ctx.content, id),
    pinned: restrained(w, id),
    canFlee: !!fleeStep(w, ctx.content, id),
  });
  if (!intent) return;
  if (intent === 'attack' && !adjacent(w, id, target)) {
    const step = closeStep(w, ctx.content, id, target);
    startAction(w, ctx, id, step ? 'move' : 'guard', { kind: 'own' }, step ?? undefined);
  } else startAction(w, ctx, id, intent, { kind: 'own' }, undefined, intent === 'attack' ? target : undefined);
}
export function commitBrawl(w: World, ctx: SimContext, id: ActorId, action: Action): void {
  const s = w.tactical,
    p = s?.participants[id],
    target = action.targetId;
  if (!s || !p) return;
  const now = instantOf(w);
  if ((action.kind === 'attack' || action.kind === 'grapple') && target !== undefined) {
    const b = activeBrawls(w, id).find((x) => x.a === target || x.b === target);
    if (!b || brawlCheck(w, ctx.content, id, action.kind, target)) return;
    b.attempts++;
    s.quietSince = now;
    if (action.kind === 'attack') {
      const result = meleeCheck(w, ctx, id, target, action.token);
      ctx.emit({
        kind: 'tactical.blow',
        data: {
          actorId: id,
          targetId: target,
          hit: result.hit,
          damage: result.damage,
          text: `${name(w, id)} ${result.hit ? 'lands a nonlethal blow on' : 'misses'} ${name(w, target)}.`,
        },
        roles: [
          { actor: id, role: 'agent' },
          { actor: target, role: 'target' },
        ],
        place: s.placeId,
        visibility: 'witnessed',
        explain: result.explain,
      });
      if (result.hit) {
        applyHit(w, ctx, target, result.damage, { nonlethal: true, critical: result.critical });
        brawlFear(
          w,
          ctx,
          target,
          b.id,
          'first blow',
          (healthOf(w, target)?.nonlethal ?? 0) * 2 >= maxVigor(w, ctx.content, target) ? ['half stamina'] : [],
        );
      }
    } else {
      const result = grappleCheck(w, ctx, id, target, action.token);
      s.grapples ??= [];
      const g = s.grapples.find((x) => x.holder === id && x.target === target);
      if (result.success) {
        if (g) g.stage = Math.min(3, g.stage + 1) as 1 | 2 | 3;
        else s.grapples.push({ holder: id, target, stage: 1 });
      }
      syncGrapples(w);
      const stage = s.grapples.find((x) => x.holder === id && x.target === target)?.stage;
      ctx.emit({
        kind: 'tactical.grapple',
        data: {
          actorId: id,
          targetId: target,
          text: `${name(w, id)} ${result.success ? (stage === 3 ? 'pins' : stage === 2 ? 'holds' : 'grabs') : 'fails to restrain'} ${name(w, target)}.`,
        },
        roles: [
          { actor: id, role: 'agent' },
          { actor: target, role: 'target' },
        ],
        place: s.placeId,
        visibility: 'witnessed',
        explain: result.explain,
      });
      if (result.success) brawlFear(w, ctx, target, b.id, 'restrained');
    }
    settleBrawls(w, ctx);
    decideBrawl(w, ctx, target);
  } else if (action.kind === 'escape') {
    const g = s.grapples?.find((x) => x.target === id || x.holder === id);
    if (!g) return;
    const other = g.holder === id ? g.target : g.holder;
    const result = grappleCheck(w, ctx, id, other, action.token);
    // Releasing your own hold is automatic but costs the same action interval.
    if (g.holder === id || result.success) s.grapples = s.grapples?.filter((x) => x !== g);
    syncGrapples(w);
    ctx.emit({
      kind: 'tactical.grapple',
      data: {
        actorId: id,
        targetId: other,
        text: `${name(w, id)} ${restrained(w, id) ? 'cannot break free' : 'leaves the grapple'}.`,
      },
      roles: [
        { actor: id, role: 'agent' },
        { actor: other, role: 'target' },
      ],
      place: s.placeId,
      visibility: 'witnessed',
      explain: result.explain,
    });
  } else if (action.kind === 'yield') {
    p.submitted = true;
    ctx.emit({
      kind: 'tactical.submission',
      data: { actorId: id, text: `${name(w, id)} yields. Accept the surrender; nonlethal blows have stopped.` },
      roles: [{ actor: id, role: 'subject' }],
      place: s.placeId,
      visibility: 'witnessed',
      importance: 75,
    });
    settleBrawls(w, ctx);
    for (const b of activeBrawls(w, id)) decideBrawl(w, ctx, b.a === id ? b.b : b.a);
  } else if (action.kind === 'accept' && target !== undefined && s.participants[target]?.submitted) {
    for (const b of activeBrawls(w, id)) if (b.a === target || b.b === target) end(w, ctx, b, 'submission');
  } else if (action.kind === 'parley') {
    const a = w.actors[id];
    if (!a) return;
    const result = skillCheck(
      ctx.content,
      a,
      {
        label: activeBrawls(w, id).length ? 'Offer peace' : 'Break up the brawl',
        skill: 'persuade',
        dc: 12,
        knowledge: 'self',
      },
      ctx.rng('combat', mixKey(id, action.token, now, 0xface)),
    );
    ctx.emit({
      kind: 'tactical.action',
      data: {
        actorId: id,
        action: 'parley',
        phase: 'spoken',
        text: result.success ? 'Your call for peace is heard.' : 'Your call for peace fails to carry.',
      },
      roles: [{ actor: id, role: 'agent' }],
      place: s.placeId,
      visibility: 'witnessed',
      explain: result.explain,
    });
    if (result.success)
      for (const b of activeBrawls(w)) {
        // The speaker offers peace; every other fighter must independently want to withdraw.
        if (
          [b.a, b.b].every(
            (x) =>
              x === id ||
              s.participants[x]?.submitted ||
              ['yield', 'flee'].includes(
                brawlIntent(w, ctx, x, {
                  hurt: (healthOf(w, x)?.nonlethal ?? 0) * 2 >= maxVigor(w, ctx.content, x),
                  pinned: restrained(w, x),
                  canFlee: !!fleeStep(w, ctx.content, x),
                }) ?? '',
              ),
          )
        )
          end(w, ctx, b, 'peace');
      }
  } else if (action.kind === 'flee') {
    const exit = sceneExit(w, ctx.content),
      pos = action.destination;
    if (exit && pos?.x === exit.x && pos.y === exit.y && leaveTactical(w, id, exit.placeId)) {
      p.fled = true;
      ctx.emit({
        kind: 'tactical.action',
        data: { actorId: id, action: 'flee', phase: 'crossed', text: 'You cross the tavern door and leave the brawl.' },
        roles: [{ actor: id, role: 'agent' }],
        visibility: 'private',
      });
      settleBrawls(w, ctx);
    }
  } else if (action.kind === 'stabilize' && target !== undefined) stabilize(w, ctx, id, target, action.token);
  else if (action.kind === 'reaction')
    p.reaction = {
      remaining: action.reactionCount ?? 1,
      until: now + 600,
      nextAt: p.reactionAt ?? 0,
      basis: action.basis,
    };
}
/** One explicitly granted reaction per six seconds; declaration/cancel never refunds it. */
export function movementReactions(w: World, ctx: SimContext, mover: ActorId): void {
  const s = w.tactical;
  if (!s) return;
  for (const id of idsOf<ActorId>(s.participants)) {
    const p = s.participants[id],
      order = p?.reaction;
    if (
      !p ||
      p.action ||
      !order ||
      order.remaining <= 0 ||
      order.until < instantOf(w) ||
      (p.reactionAt ?? 0) > instantOf(w) ||
      !adjacent(w, id, mover) ||
      !activeBrawls(w, mover).some((b) => b.a === id || b.b === id)
    )
      continue;
    if (startAction(w, ctx, id, 'attack', order.basis, undefined, mover, undefined, true)) {
      order.remaining--;
      p.reactionAt = instantOf(w) + (ctx.content.combat_rules.brawl?.reaction_ticks ?? 60);
    }
  }
}
