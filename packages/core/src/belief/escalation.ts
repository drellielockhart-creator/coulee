import type { ActorCore } from '../actor.ts';
import { nextId, rowsOf } from '../ids.ts';
import { addAnxiety, chosenUrge, psycheOf } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { opinionOf } from '../social/api.ts';
import { yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import { beliefOf } from './api.ts';
import { formula } from './evidence.ts';
import { targetKey, targetLabel } from './misfortune.ts';
import type { GrudgeTarget, Persecution } from './state.ts';

function weight(world: World, actor: ActorCore): number {
  if (yearsBetween(actor.born, world.time) < 16) return 5;
  return world.households[actor.householdId]?.headId === actor.id ? 20 : 10;
}

function advance(world: World, ctx: SimContext, p: Persecution, rung: number, catalyst: ActorCore | undefined): void {
  const from = p.rung;
  const eventId = ctx.emit({
    kind: 'belief.escalation',
    importance: 40 + rung * 15,
    roles: [
      ...(catalyst ? [{ actor: catalyst.id, role: 'agent' as const }] : []),
      ...(p.target.kind === 'actor' ? [{ actor: p.target.id, role: 'target' as const }] : []),
    ],
    data: {
      target: targetLabel(world, p.target),
      ...(p.target.kind === 'actor' ? { targetId: p.target.id } : {}),
      ...(catalyst ? { catalystId: catalyst.id } : {}),
      from,
      to: rung,
      heat: p.heat,
      consensus: p.consensus,
    },
    explain: formula(
      rung > from ? 'Persecution advances' : 'Persecution loses momentum',
      catalyst ? [catalyst.id] : [],
      rung,
      {
        Heat: p.heat,
        'Consensus per mille': p.consensus,
        'Minutes at rung': ctx.now - p.since,
        'Minutes without fuel': ctx.now - p.lastFuelAt,
      },
      'public',
    ),
  });
  p.rung = rung;
  p.since = ctx.now;
  p.pending = null;
  p.history.push({ rung, at: ctx.now, catalystId: catalyst?.id ?? null, eventId });
  if (catalyst && !p.leaderIds.includes(catalyst.id)) p.leaderIds.push(catalyst.id);
  if (catalyst && rung >= 2) {
    for (const prop of p.charges) {
      const b = beliefOf(world, catalyst.id, prop);
      if (b) b.voiced = true;
    }
    for (const g of rowsOf(world.belief.grudges))
      if (g.holderId === catalyst.id && targetKey(g.target) === targetKey(p.target)) g.public = true;
  }
  if (rung < 3) p.shunnerIds = [];
}

/** Public anger and agreement are distinct; secret beliefs alone are not public revelation. */
export function updatePersecutions(world: World, ctx: SimContext): void {
  const adults = rowsOf(world.actors).filter((a) => a.alive && yearsBetween(a.born, ctx.now) >= 16);
  const totalWeight = Math.max(
    1,
    adults.reduce((n, a) => n + weight(world, a), 0),
  );
  const anxiety = Math.floor(
    adults.reduce((n, a) => n + (psycheOf(world, a.id)?.anxiety ?? 0), 0) / Math.max(1, adults.length),
  );
  for (const b of rowsOf(world.belief.beliefs)) {
    const prop = world.belief.props[b.propId];
    const pred = prop && ctx.content.predicates[prop.pred];
    const subject = prop?.args[0];
    if (
      !pred?.charge ||
      b.conceal ||
      b.credence <= 40 ||
      !subject ||
      (subject.kind !== 'actor' && subject.kind !== 'household' && subject.kind !== 'figure')
    )
      continue;
    const target: GrudgeTarget = subject;
    let p = world.belief.persecutions.find((row) => targetKey(row.target) === targetKey(target));
    if (!p) {
      p = {
        id: nextId(world.belief.counters, 'process'),
        target,
        rung: 0,
        since: ctx.now,
        heat: 0,
        consensus: 0,
        leaderIds: [],
        charges: [],
        actAttributed: false,
        holdersOver40: 0,
        history: [],
        lastFuelAt: ctx.now,
        pending: null,
        shunnerIds: [],
        revealed: false,
        lastFallbackDay: -1,
      };
      world.belief.persecutions.push(p);
    }
    if (!p.charges.includes(b.propId)) {
      p.charges.push(b.propId);
      p.lastFuelAt = ctx.now;
    }
  }
  const rungs = Object.values(ctx.content.persecutionRungs).sort(
    (a, b) => a.rung - b.rung || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const p of world.belief.persecutions) {
    let over40 = 0;
    let agrees = 0;
    let heat = 0;
    p.actAttributed = false;
    for (const a of adults) {
      let strongest = 0;
      for (const id of p.charges) {
        const b = beliefOf(world, a.id, id);
        if (!b || b.conceal) continue;
        strongest = Math.max(strongest, b.credence);
        if (b.credence > 50 && ctx.content.predicates[world.belief.props[id]?.pred ?? '']?.act) p.actAttributed = true;
      }
      if (strongest > 40) over40++;
      if (strongest > 50) agrees += weight(world, a);
      if (p.target.kind === 'actor')
        heat += Math.floor(
          (20 * weight(world, a) * opinionOf(world, a.id, p.target.id).fear * world.belief.misfortune) / 1000000,
        );
    }
    for (const g of rowsOf(world.belief.grudges)) {
      if (targetKey(g.target) !== targetKey(p.target)) continue;
      const holder = world.actors[g.holderId];
      if (!holder?.alive) continue;
      const voiced = p.charges.some((id) => beliefOf(world, holder.id, id)?.voiced);
      heat += Math.floor(
        (g.intensity * weight(world, holder) * (g.public ? 100 : voiced ? 70 : 30) * (g.viaDefense ? 125 : 100)) /
          100000,
      );
    }
    if (over40 > p.holdersOver40 || heat > p.heat) p.lastFuelAt = ctx.now;
    p.holdersOver40 = over40;
    p.heat = heat;
    p.consensus = Math.floor((1000 * agrees) / totalWeight);
    if (p.rung >= 3)
      p.shunnerIds = adults
        .filter(
          (a) =>
            a.values.neighborliness <= 1 &&
            p.charges.some((id) => {
              const b = beliefOf(world, a.id, id);
              return b && !b.conceal && b.credence > 50;
            }),
        )
        .map((a) => a.id);
    const current = rungs.find((r) => r.rung === p.rung);
    const next = rungs.find((r) => r.rung === p.rung + 1 && r.rung <= 3);
    if (ctx.isNewDay && p.target.kind === 'actor' && current)
      addAnxiety(world, ctx, p.target.id, current.target_anxiety_per_day);
    if (p.rung > 0 && ctx.now - Math.max(p.since, p.lastFuelAt) >= (current?.dwell_days ?? 3) * 2880) {
      advance(world, ctx, p, p.rung - 1, undefined);
      continue;
    }
    const threshold = (n: number) =>
      Math.floor((n * (1000 - Math.floor((350 * world.belief.misfortune) / 1000)) * (4000 - anxiety)) / 4000000);
    if (
      !next ||
      p.heat < threshold(next.heat) ||
      p.consensus < threshold(next.consensus_permille) ||
      over40 < next.holders_over_40 ||
      (p.rung > 0 && ctx.now - p.since < (current?.dwell_days ?? 3) * 1440) ||
      p.lastFuelAt < p.since
    ) {
      p.pending = null;
      continue;
    }
    const candidates = adults
      .map((a) => {
        let grudge = 0;
        for (const g of rowsOf(world.belief.grudges))
          if (g.holderId === a.id && targetKey(g.target) === targetKey(p.target))
            grudge = Math.max(grudge, g.intensity);
        const credence = Math.max(
          0,
          ...p.charges.map((id) => {
            const b = beliefOf(world, a.id, id);
            return b && !b.conceal ? b.credence : 0;
          }),
        );
        const score =
          Math.floor(grudge / 2) +
          10 * a.values.temper +
          10 * a.values.rancor +
          Math.floor(credence / 4) -
          (p.target.kind === 'actor' ? Math.floor(opinionOf(world, a.id, p.target.id).fear / 2) : 0);
        return { actor: a, score, credence };
      })
      .filter((c) => c.credence > 40)
      .sort((a, b) => b.score - a.score || a.actor.id - b.actor.id);
    const catalyst = candidates[0];
    if (!catalyst) continue;
    if (next.rung === 1) {
      advance(world, ctx, p, 1, catalyst.actor);
      continue;
    }
    if (catalyst.score < next.catalyst_threshold) continue;
    p.pending = {
      rung: next.rung,
      catalystId: catalyst.actor.id,
      score: catalyst.score,
      since: p.pending?.since ?? ctx.now,
    };
    const chosenRec = chosenUrge(world, catalyst.actor.id);
    const chosen = chosenRec?.at === ctx.now ? chosenRec.urge : undefined;
    // The step happened this hour: the Catalyst's ego chose the rung's interaction (an accusation
    // to the accused's face; shunning lobbied to a neighbor). belief proposes it only when
    // someone is there to hear it, and social has just executed it.
    const chosenStep =
      chosen?.kind === 'interaction' &&
      chosen.interactionId === next.step_interaction &&
      p.target.kind === 'actor' &&
      (next.rung >= 3 ? chosen.targetId !== p.target.id : chosen.targetId === p.target.id);
    // Until social supplies the step interaction, a daily individual volition check is explicit.
    const fallback = !next.step_interaction || !ctx.content.interactions[next.step_interaction];
    let takesStep = chosenStep;
    if (fallback && p.lastFallbackDay !== ctx.cal.dayIndex) {
      p.lastFallbackDay = ctx.cal.dayIndex;
      const roll = ctx.rng('belief', mixKey(p.id, catalyst.actor.id, next.rung, 711)).int(1, 100);
      takesStep = roll <= Math.min(85, Math.max(5, catalyst.score - next.catalyst_threshold + 20));
      ctx.emit({
        kind: 'belief.catalyst',
        visibility: 'inner',
        roles: [{ actor: catalyst.actor.id, role: 'agent' }],
        data: { actorId: catalyst.actor.id, rung: next.rung, takesStep },
        explain: {
          ...formula('Resolve catalyst volition', [catalyst.actor.id], catalyst.score, {
            Score: catalyst.score,
            Threshold: next.catalyst_threshold,
          }),
          roll: { die: 100, natural: roll },
          outcome: takesStep ? 'chosen' : 'rejected',
        },
      });
    }
    if (takesStep) advance(world, ctx, p, next.rung, catalyst.actor);
    if (p.rung >= 3)
      p.shunnerIds = adults
        .filter(
          (a) =>
            p.charges.some((id) => (beliefOf(world, a.id, id)?.credence ?? 0) > 50) && a.values.neighborliness <= 1,
        )
        .map((a) => a.id);
  }
}
