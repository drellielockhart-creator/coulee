/**
 * Culpability is inferred, never implied (13 §5.3). Daily, from each holder's own beliefs:
 *   - benefited_from(actor, H): the holder believes the charm draws from H (≥ 50) and that the
 *     actor has it (≥ 50): a mild restitution grievance, not a theft verdict.
 *   - kept_drawing(actor, H): the above, plus the holder warned that actor and found more loss
 *     after the warning.
 *   - Refutation, separate from accusation: a holder who believes the draw (≥ 60) covering a
 *     misfortune gives counter-evidence to each earlier attribution of it to an actor, and a
 *     grudge founded on that misfortune loses its founding weight. Clearing the hired man does
 *     not depend on blaming the keeper. Item predicates never open a persecution.
 * OWNER: module:fae (writes only through belief/api).
 */
import { beliefOf, formGrudge, internProp, observe } from '../belief/api.ts';
import type { ActorId, HouseholdId } from '../ids.ts';
import { rowsOf } from '../ids.ts';
import { processingActors } from '../region/processing.ts';
import type { SimContext } from '../sim/context.ts';
import { yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import { charmIds } from './charms.ts';
import { actorArg, credence, householdArg, itemArg, knownProp } from './desire.ts';
import type { DrawCase } from './state.ts';

export function culpabilityDaily(world: World, ctx: SimContext): void {
  if (!world.fae.drawCases) return;
  const adults = processingActors(world).filter((a) => a.alive && yearsBetween(a.born, ctx.now) >= 14);
  for (const id of charmIds(world)) {
    const c = world.fae.charms?.[id];
    if (!c) continue;
    const table = world.fae.drawCases;
    const cases: DrawCase[] = Object.keys(table)
      .sort()
      .map((k) => table[k])
      .filter((dc): dc is DrawCase => !!dc && dc.itemId === id && dc.householdId !== null);
    const sources: HouseholdId[] = [...new Set(cases.map((dc) => dc.householdId as HouseholdId))].sort((a, b) => a - b);
    if (!sources.length) continue;
    // Who could be thought to have it: anyone some holder believes has it.
    const hasProps = adults
      .map((x) => ({ x: x.id, p: knownProp(world, 'has', [actorArg(x.id), itemArg(id)]) }))
      .filter((r): r is { x: ActorId; p: NonNullable<typeof r.p> } => r.p !== undefined);
    for (const h of adults) {
      readings(world, ctx, h.id, c, sources);
      for (const hid of sources) {
        const believes = credence(world, h.id, 'draws_from', [itemArg(id), householdArg(hid)]);
        if (believes < 50) continue;
        for (const { x, p } of hasProps) {
          if (x === h.id || world.actors[x]?.householdId === hid) continue;
          if ((beliefOf(world, h.id, p)?.credence ?? 0) < 50) continue;
          const bf = internProp(world, 'benefited_from', [actorArg(x), householdArg(hid)]);
          if ((beliefOf(world, h.id, bf)?.credence ?? 0) < 50) {
            observe(world, ctx, h.id, bf, { type: 'inference', dir: 1, sourceId: null, eventId: null, scalePct: 80 });
            if (h.householdId === hid && (beliefOf(world, h.id, bf)?.credence ?? 0) >= 50)
              formGrudge(world, ctx, {
                holderId: h.id,
                target: { kind: 'actor', id: x },
                aim: 'restitution',
                intensity: 20,
                label: `Ate bread out of our bins`,
              });
          }
          // Warned, and the loss went on after (13 §5.3 kept_drawing).
          const warned = c.warned?.[x];
          const later =
            warned !== undefined &&
            warned.by === h.id &&
            cases.some(
              (dc) =>
                dc.householdId === hid &&
                dc.lastAt > warned.at &&
                dc.lastEvidenceAt !== null &&
                dc.lastEvidenceAt > warned.at,
            );
          if (later) {
            const kd = internProp(world, 'kept_drawing', [actorArg(x), householdArg(hid)]);
            if ((beliefOf(world, h.id, kd)?.credence ?? 0) < 50)
              observe(world, ctx, h.id, kd, { type: 'inference', dir: 1, sourceId: null, eventId: null, scalePct: 90 });
          }
        }
        if (believes < 60) continue;
        // Refutation: the misfortunes the draw explains, as this holder attributed them.
        for (const dc of cases) {
          if (dc.householdId !== hid || dc.misfortuneId === null) continue;
          const m = world.belief.misfortunes[dc.misfortuneId];
          if (!m) continue;
          c.refuted ??= {};
          const key = `${h.id}:${m.id}`;
          if (c.refuted[key]) continue;
          c.refuted[key] = ctx.now;
          for (const pred of ['caused', 'cursed'])
            for (const other of adults) {
              const p = knownProp(world, pred, [actorArg(other.id), { kind: 'misfortune', id: m.id }]);
              if (p === undefined || (beliefOf(world, h.id, p)?.credence ?? 0) <= 0) continue;
              observe(world, ctx, h.id, p, { type: 'physical', dir: -1, sourceId: null, eventId: null });
            }
          for (const g of rowsOf(world.belief.grudges)) {
            if (g.holderId !== h.id || !g.founding.some((f) => f.kind === 'misfortune' && f.id === m.id)) continue;
            g.intensity = Math.floor(g.intensity / 2);
          }
        }
      }
    }
  }
}

/**
 * How someone reads the thing (13 §6.2, §6.4): a source that believes the draw has a claim on it
 * (owns, at that credence); the believed output with no theft reads as a blessing (boon), the
 * Devil's sack or a thief as a curse (bane), weighted by piety and superstition. Inference only.
 */
function readings(
  world: World,
  ctx: SimContext,
  holderId: ActorId,
  c: import('./state.ts').CharmState,
  sources: HouseholdId[],
): void {
  const h = world.actors[holderId];
  if (!h) return;
  const item = itemArg(c.itemId);
  const own = sources.includes(h.householdId)
    ? credence(world, holderId, 'draws_from', [item, householdArg(h.householdId)])
    : 0;
  if (own >= 50) {
    const p = internProp(world, 'owns', [actorArg(holderId), item]);
    if ((beliefOf(world, holderId, p)?.credence ?? 0) < own - 10)
      observe(world, ctx, holderId, p, { type: 'inference', dir: 1, sourceId: null, eventId: null, scalePct: own });
  }
  let output = 0;
  let devil = 0;
  for (const x of ctx.content.charms?.[c.defId]?.claims ?? []) {
    const cr = credence(world, holderId, `claim.${c.defId}.${x.id}`, [item]);
    if (x.group === 'output') output = Math.max(output, cr);
    else devil = Math.max(devil, cr);
  }
  const theft = sources.some((hid) => credence(world, holderId, 'draws_from', [item, householdArg(hid)]) >= 50);
  const piety = psycheNorm(world, holderId, 'piety');
  const sup = h.values.superstition ?? 0;
  const bane = internProp(world, 'bane', [item]);
  const boon = internProp(world, 'boon', [item]);
  if ((devil >= 50 || theft) && (beliefOf(world, holderId, bane)?.credence ?? 0) < 50)
    observe(world, ctx, holderId, bane, {
      type: 'inference',
      dir: 1,
      sourceId: null,
      eventId: null,
      scalePct: Math.max(30, Math.min(100, 40 + piety / 2 + sup * 10)),
    });
  else if (output >= 50 && !theft && devil < 30 && (beliefOf(world, holderId, boon)?.credence ?? 0) < 50)
    observe(world, ctx, holderId, boon, {
      type: 'inference',
      dir: 1,
      sourceId: null,
      eventId: null,
      scalePct: Math.max(30, Math.min(100, 70 - sup * 10)),
    });
}

function psycheNorm(world: World, id: ActorId, norm: string): number {
  return world.psyche.byActor[id]?.norms[norm] ?? 50;
}
