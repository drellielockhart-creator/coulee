import type { ActorId, HouseholdId, ItemId, PlaceId } from '../ids.ts';
import { nextId, rowsOf } from '../ids.ts';
import { satisfyNeed } from '../needs/api.ts';
import { addAnxiety, psycheOf } from '../psyche/api.ts';
import type { InitContext, SimContext } from '../sim/context.ts';
import { addMemory, opinionOf, relationshipsOf } from '../social/api.ts';
import { asGameMinute } from '../time.ts';
import type { World } from '../world.ts';
import { beliefOf, internProp, observe, propText, suspicionOf } from './api.ts';
import { ensureBelief, formula } from './evidence.ts';
import { clamp, view3 } from './intmath.ts';
import { type GrudgeTarget, type Misfortune, makeGrudge } from './state.ts';

export interface MisfortuneRequest {
  kindId: string;
  householdId: HouseholdId;
  victimId?: ActorId | null;
  placeId?: PlaceId | null;
  culpritId?: ActorId | null;
  daysAgo?: number;
  /** The object behind it, for the epilogue only (13 §5.2); attribution never reads it. */
  causeItemId?: ItemId | null;
}

export function registerMisfortune(
  world: World,
  ctx: InitContext | SimContext,
  req: MisfortuneRequest,
): Misfortune | null {
  const def = ctx.content.misfortunes[req.kindId];
  const household = world.households[req.householdId];
  if (!def || !household || !ctx.content.predicates.befell) return null;
  const id = nextId(world.belief.counters, 'misfortune');
  const propId = internProp(world, 'befell', [
    { kind: 'household', id: req.householdId },
    { kind: 'misfortune', id },
  ]);
  const m: Misfortune = {
    id,
    kindId: req.kindId,
    householdId: req.householdId,
    victimId: req.victimId ?? null,
    at: asGameMinute(ctx.now - (req.daysAgo ?? 0) * 1440),
    placeId: req.placeId ?? household.homePlaceId,
    culpritId: req.culpritId ?? null,
    propId,
    eventId: null,
    attributions: [],
    ...(req.causeItemId !== undefined && req.causeItemId !== null ? { causeItemId: req.causeItemId } : {}),
  };
  world.belief.misfortunes[id] = m;
  world.belief.misfortune = clamp(world.belief.misfortune + def.severity, 0, 1000);
  m.eventId = ctx.emit({
    kind: 'belief.misfortune',
    ...(m.placeId === null ? {} : { place: m.placeId }),
    importance: def.memory_intensity,
    roles: household.memberIds.map((actor) => ({ actor, role: 'victim' as const })),
    data: { misfortuneId: id, kindId: def.id, text: propText(world, ctx.content, propId) },
    explain: formula(
      'Misfortune pressure',
      household.memberIds,
      world.belief.misfortune,
      { Severity: def.severity },
      'public',
    ),
  });
  for (const holderId of household.memberIds) {
    const b = ensureBelief(world, ctx, holderId, propId);
    b.credence = 100;
    b.formed = true;
    b.evidence.push({
      type: 'observation',
      dir: 1,
      memoryId: null,
      sourceId: null,
      weight: 640,
      at: m.at,
      rumorId: null,
    });
    const g = makeGrudge(world, {
      holderId,
      target: { kind: 'unknown', misfortuneId: id },
      founding: [{ kind: 'misfortune', id, label: propText(world, ctx.content, propId) }],
      intensity: def.memory_intensity,
      aim: def.aim,
      public: false,
      since: ctx.now,
    });
    ctx.emit({
      kind: 'belief.grudge_formed',
      visibility: 'inner',
      roles: [{ actor: holderId, role: 'victim' }],
      data: { holderId, target: 'an unknown hand', intensity: g.intensity, aim: g.aim },
      explain: formula('Grievance without a culprit', [holderId], g.intensity, {
        'Misfortune intensity': def.memory_intensity,
      }),
    });
  }
  return m;
}

/** Other modules report the event, never an inferred culprit. culpritId is epilogue-only. */
export function reportMisfortune(world: World, ctx: SimContext, req: MisfortuneRequest): number | null {
  const m = registerMisfortune(world, ctx, req);
  const def = ctx.content.misfortunes[req.kindId];
  if (!m || !def) return null;
  for (const holderId of world.households[m.householdId]?.memberIds ?? []) {
    addAnxiety(world, ctx, holderId, def.anxiety);
    satisfyNeed(world, ctx, holderId, 'security', def.security_delta, { label: def.name });
    addMemory(world, ctx, {
      ownerId: holderId,
      eventId: m.eventId,
      kind: 'misfortune',
      at: ctx.now,
      placeId: m.placeId,
      roles: [],
      source: { kind: 'witnessed' },
      emotion: 'fear',
      intensity: def.memory_intensity,
      salience: 900,
      confidence: 1000,
      rehearsals: 0,
      pinned: false,
      aboutId: null,
      did: false,
      count: 1,
      since: ctx.now,
      summary: propText(world, ctx.content, m.propId),
    });
  }
  return m.id;
}

export function targetKey(target: GrudgeTarget): string {
  return target.kind === 'unknown' ? `unknown:${target.misfortuneId}` : `${target.kind}:${target.id}`;
}
export function targetLabel(world: World, target: GrudgeTarget): string {
  if (target.kind === 'actor') {
    const a = world.actors[target.id];
    return a ? `${a.name.given} ${a.name.family}` : '?';
  }
  if (target.kind === 'figure') return world.belief.figures[target.id]?.name ?? '?';
  if (target.kind === 'household') return world.households[target.id]?.name ?? '?';
  return 'an unknown hand';
}

/** Misfortunes are re-weighed for this many days after they happen. */
export const ATTRIBUTION_WINDOW_DAYS = 90;

/** Reconsider only on new evidence; the same inference is not fresh evidence every hour. */
export function attributeMisfortunes(world: World, ctx: SimContext): void {
  for (const m of rowsOf(world.belief.misfortunes)) {
    const def = ctx.content.misfortunes[m.kindId];
    if (!def) continue;
    // After a season the matter is settled in people's minds: stop re-weighing old misfortunes.
    if (ctx.now - m.at > ATTRIBUTION_WINDOW_DAYS * 1440) continue;
    for (const holder of rowsOf(world.actors)) {
      if (!holder.alive || (beliefOf(world, holder.id, m.propId)?.credence ?? 0) < 40) continue;
      const previous = m.attributions.find((a) => a.holderId === holder.id);
      const beliefs = (world.belief.beliefsByHolder[holder.id] ?? []).flatMap((id) =>
        (world.belief.beliefs[id] ? [world.belief.beliefs[id]] : []).filter((b) => b !== undefined),
      );
      if (previous && !beliefs.some((b) => b.lastEvidenceAt > previous.at)) continue;
      const known = new Set<ActorId>();
      for (const r of relationshipsOf(world, holder.id)) known.add(r.a === holder.id ? r.b : r.a);
      for (const b of beliefs)
        for (const a of world.belief.props[b.propId]?.args ?? []) if (a.kind === 'actor') known.add(a.id);
      for (const a of rowsOf(world.actors)) if (a.placeId === holder.placeId) known.add(a.id);
      const candidates: Array<{ target: GrudgeTarget | null; weight: number; order: number }> = [];
      const natural = Math.max(
        50,
        300 -
          150 * view3(holder.values.superstition) -
          Math.floor(world.belief.misfortune / 10) -
          50 * Math.floor((psycheOf(world, holder.id)?.anxiety ?? 0) / 250),
      );
      candidates.push({ target: null, weight: natural, order: 0 });
      for (const id of [...known].sort((a, b) => a - b).slice(0, 30)) {
        const actor = world.actors[id];
        if (!actor || actor.id === holder.id || actor.householdId === m.householdId) continue;
        const op = opinionOf(world, holder.id, id);
        let magic = 0;
        let motive = 0;
        let evidence = 0;
        let accused = 0;
        for (const b of beliefs) {
          const p = world.belief.props[b.propId];
          const pred = p && ctx.content.predicates[p.pred];
          if (!p || !pred || p.args[0]?.kind !== 'actor' || p.args[0].id !== id) continue;
          if (pred.magic) magic = Math.max(magic, b.credence);
          if (pred.charge) accused = Math.max(accused, b.credence);
          if (pred.projects.some((t) => def.motive_traits.includes(t))) motive = Math.max(motive, b.credence);
          if (pred.act && p.args.some((a) => a.kind === 'misfortune' && a.id === m.id))
            evidence = Math.max(evidence, b.credence);
        }
        // Public presentation only; hidden ancestry never informs attribution.
        const outsider =
          actor.presentsAsId !== holder.presentsAsId ? 20 * Math.max(0, view3(holder.values.parochialism)) : 0;
        const weight =
          100 +
          outsider +
          2 * magic +
          accused +
          Math.floor((150 * motive) / 100) +
          3 * evidence +
          2 * Math.max(0, -op.affection) +
          (def.uncanny ? 2 * suspicionOf(world, holder.id, id) : 0);
        candidates.push({ target: { kind: 'actor', id }, weight, order: id });
      }
      // A figure of local legend is the superstitious mind's first suspect for an uncanny harm
      // (soured milk, a dead cow): "the Bluff Witch did it" is how a figure enters the talk, and
      // Specification (belief/api transmit) is how it later finds a face.
      for (const f of rowsOf(world.belief.figures))
        candidates.push({
          target: { kind: 'figure', id: f.id },
          weight:
            Math.floor((f.notoriety * Math.max(0, 2 + view3(holder.values.superstition))) / 10) +
            (def.uncanny ? 40 * Math.max(0, view3(holder.values.superstition)) : 0),
          order: 1000000 + f.id,
        });
      candidates.sort((a, b) => b.weight - a.weight || a.order - b.order);
      const lead = candidates[0];
      if (!lead) continue;
      const share = Math.floor(
        (1000 * lead.weight) /
          Math.max(
            1,
            candidates.reduce((n, c) => n + c.weight, 0),
          ),
      );
      const winner = share >= 350 && lead.weight * 2 >= (candidates[1]?.weight ?? 0) * 3 ? lead.target : null;
      const result = { holderId: holder.id, leader: winner, sharePermille: share, at: ctx.now };
      const changed =
        !previous ||
        (previous.leader === null ? 'natural' : targetKey(previous.leader)) !==
          (winner === null ? 'natural' : targetKey(winner));
      if (previous) Object.assign(previous, result);
      else m.attributions.push(result);
      // Re-weighing that changes nothing is not news: log first attributions and changes of mind.
      if (changed)
        ctx.emit({
          kind: 'belief.attributed',
          visibility: 'inner',
          roles: [{ actor: holder.id, role: 'witness' }],
          data: {
            misfortuneId: m.id,
            holderId: holder.id,
            target: winner ? targetLabel(world, winner) : 'unresolved or natural',
            sharePermille: share,
          },
          explain: formula(
            'Weigh possible causes',
            [holder.id],
            share,
            Object.fromEntries(candidates.map((c) => [c.target ? targetKey(c.target) : 'Natural', c.weight])),
          ),
        });
      // The superstitious also say the uncanny thing out loud: "the Bluff Witch did it". A
      // half-belief in the figure (whatever else they suspect) is how a figure enters the talk;
      // Specification later gives it a face (belief/api transmit).
      if (!previous && def.uncanny && view3(holder.values.superstition) >= 2 && ctx.content.predicates.cursed) {
        const fig = [...rowsOf(world.belief.figures)].sort((a, b) => b.notoriety - a.notoriety || a.id - b.id)[0];
        if (fig) {
          const figProp = internProp(world, 'cursed', [
            { kind: 'figure', id: fig.id },
            { kind: 'misfortune', id: m.id },
          ]);
          if (!beliefOf(world, holder.id, figProp)) {
            const b = ensureBelief(world, ctx, holder.id, figProp);
            b.credence = clamp(10 * view3(holder.values.superstition) + Math.floor(fig.notoriety / 2), 0, 100);
            observe(world, ctx, holder.id, figProp, { type: 'inference', dir: 1, sourceId: null, eventId: m.eventId });
          }
        }
      }
      if (!winner || winner.kind === 'unknown' || winner.kind === 'household') continue;
      const pred = def.uncanny && holder.values.superstition > 0 ? 'cursed' : 'caused';
      if (!ctx.content.predicates[pred]) continue;
      const propId = internProp(world, pred, [winner, { kind: 'misfortune', id: m.id }]);
      if (!beliefOf(world, holder.id, propId)) {
        const b = ensureBelief(world, ctx, holder.id, propId);
        b.credence = Math.floor(share / 10);
        observe(world, ctx, holder.id, propId, { type: 'inference', dir: 1, sourceId: null, eventId: m.eventId });
      }
      for (const g of rowsOf(world.belief.grudges)) {
        if (g.holderId !== holder.id || !g.founding.some((f) => f.kind === 'misfortune' && f.id === m.id)) continue;
        if (targetKey(g.target) === targetKey(winner)) continue;
        g.target = winner;
        g.retargetedFrom = m.id;
        g.founding.push({ kind: 'belief', id: propId, label: propText(world, ctx.content, propId) });
      }
    }
  }
}
