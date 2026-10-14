/**
 * Discovery of draws (13 §5.2). A draw is physical at once and known later: only other people's
 * ordinary acts find it, through `checkShortfall` (a stock count, a shortage at a meal or a sale,
 * or a witnessed trace). The check is Perception or the relevant trade vs DC 15 − 2 per 10% of
 * stock missing (minimum 5). The first find reports one milder misfortune, `stock_short`, linked
 * to the case; later finds add bounded evidence at most weekly. An informed, agreeing household
 * records nothing new. OWNER: module:fae.
 */
import { isAsleep } from '../activity/api.ts';
import { internProp, observe, reportMisfortune } from '../belief/api.ts';
import { skillCheck } from '../checks.ts';
import { noteNudge, thresholdTiltFor } from '../director/bias.ts';
import { term } from '../explain.ts';
import type { ActorId, HouseholdId, PlaceId } from '../ids.ts';
import { pantryOf, stacksDeep } from '../items/api.ts';
import type { ItemLocation } from '../items/state.ts';
import { addAnxiety } from '../psyche/api.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { charmDefOf, keeperOf, knownRecord } from './charms.ts';
import type { DrawCase } from './state.ts';
import { checkCharmLoss } from './theft.ts';

const SALT_COUNT = 0xc0a7;
const SALT_TRACE = 0x7ace;
const EVIDENCE_EVERY = 7 * 1440;
const SALT_BACK = 0xbac7;

function sourceLoc(dc: Pick<DrawCase, 'source'>): ItemLocation {
  return dc.source.kind === 'household' ? pantryOf(dc.source.id) : { kind: 'place', placeId: dc.source.id };
}
function unitsAt(world: World, loc: ItemLocation, def: string): number {
  let n = 0;
  for (const { stack } of stacksDeep(world, loc)) if (stack.defId === def) n += stack.qty;
  return n;
}
/** Open, unaccepted cases for a household's stores, optionally at one place. */
export function casesOf(world: World, hid: HouseholdId, placeId?: PlaceId): DrawCase[] {
  return Object.keys(world.fae.drawCases ?? {})
    .sort()
    .map((k) => world.fae.drawCases?.[k])
    .filter(
      (dc): dc is DrawCase =>
        !!dc &&
        dc.householdId === hid &&
        !dc.accepted &&
        (placeId === undefined ||
          dc.placeId === placeId ||
          Object.values(dc.bins ?? {}).some((b) => b.placeId === placeId)),
    );
}

/**
 * One actor's chance to find what is missing from a household's stores. Returns the units found.
 * Callers: the stocktake activity and `fae.count` (trigger 'count'), the shortage and trace
 * passes below.
 */
export function checkShortfall(
  world: World,
  ctx: SimContext,
  householdId: HouseholdId,
  actorId: ActorId,
  trigger: 'count' | 'shortage' | 'trace',
  placeId?: PlaceId,
): number {
  const a = world.actors[actorId];
  if (!a) return 0;
  let found = 0;
  for (const dc of casesOf(world, householdId, placeId)) {
    if (dc.undiscovered <= 0) continue;
    const bins = Object.values(dc.bins ?? {}).filter((b) => placeId === undefined || b.placeId === placeId);
    const missing = dc.bins ? bins.reduce((n, b) => n + b.undiscovered, 0) : dc.undiscovered;
    if (missing <= 0) continue;
    const stock = dc.bins
      ? bins.reduce((n, b) => n + unitsAt(world, sourceLoc(b), dc.def), 0)
      : unitsAt(world, sourceLoc(dc), dc.def);
    const missingPct = Math.floor((missing * 100) / Math.max(1, stock + missing));
    const dcValue = Math.max(5, 15 - 2 * Math.floor(missingPct / 10));
    // N9 (Director discovery steer): at most DC −2, off-screen only (the shortfall, never a person).
    const tilt = thresholdTiltFor(world, 'fae.shortfall', householdId, 'household', [actorId], [a.placeId]);
    const skill = ['perception', 'trade_milling', 'bargain'].sort(
      (x, y) => (a.sheet.skills[y] ?? 0) - (a.sheet.skills[x] ?? 0) || (x < y ? -1 : 1),
    )[0] as string;
    const res = skillCheck(
      ctx.content,
      a,
      {
        label:
          trigger === 'count'
            ? 'The stock count'
            : trigger === 'shortage'
              ? 'Short at the bin'
              : 'A dusting on the sill',
        skill,
        dc: 15,
        dcTerms: [
          term('item', `${missingPct}% of the ${dc.def} missing`, dcValue - 15),
          ...(tilt ? [term('director', 'Director discovery steer (N9)', -tilt.amount)] : []),
        ],
        knowledge: 'self',
      },
      ctx.rng(
        'checks',
        mixKey(hashString32(dc.id), actorId, SALT_COUNT, trigger === 'count' ? 1 : trigger === 'shortage' ? 2 : 3),
      ),
    );
    if (!res.success) continue;
    if (tilt && res.margin < tilt.amount) noteNudge(world, tilt.bias, actorId, 'missed', 'found', true);
    const units = missing;
    for (const bin of bins) {
      bin.discovered += bin.undiscovered;
      bin.undiscovered = 0;
    }
    dc.tracedBy ??= {};
    const first = dc.misfortuneId === null;
    dc.discovered += units;
    dc.undiscovered -= units;
    found += units;
    // Witnesses who already connected the loss to this charm learn the new count, too.
    for (const id of [actorId, ...(world.households[householdId]?.memberIds ?? [])]) {
      const known = world.fae.known?.[id]?.[dc.itemId];
      if (!known?.sources?.includes(householdId)) continue;
      known.losses ??= {};
      known.losses[householdId] = Math.max(0, dc.discovered - (dc.restituted ?? 0));
    }
    if (first) {
      dc.misfortuneId = reportMisfortune(world, ctx, {
        kindId: 'stock_short',
        householdId,
        placeId: dc.placeId,
        causeItemId: dc.itemId,
      });
      dc.lastEvidenceAt = ctx.now;
    } else if (dc.lastEvidenceAt === null || ctx.now - dc.lastEvidenceAt >= EVIDENCE_EVERY) {
      // Another count is new evidence, at most weekly, with bounded worry (another debit is not).
      dc.lastEvidenceAt = ctx.now;
      const m = dc.misfortuneId !== null ? world.belief.misfortunes[dc.misfortuneId] : undefined;
      for (const mid of world.households[householdId]?.memberIds ?? []) {
        if (m)
          observe(world, ctx, mid, m.propId, { type: 'physical', dir: 1, sourceId: null, eventId: null, scalePct: 50 });
        addAnxiety(world, ctx, mid, 15);
      }
    } else continue;
    const total = dc.discovered;
    ctx.emit({
      kind: 'fae.shortfall',
      place: dc.placeId,
      visibility: 'witnessed',
      importance: first ? 30 : 15,
      roles: [
        { actor: actorId, role: 'agent' },
        ...(world.households[householdId]?.memberIds ?? [])
          .filter((m) => m !== actorId)
          .slice(0, 5)
          .map((m) => ({ actor: m, role: 'witness' as const })),
      ],
      data: {
        householdId,
        actorId,
        def: dc.def,
        units,
        first,
        trigger,
        misfortuneId: dc.misfortuneId,
        text: first
          ? `The ${dc.def} comes up ${units} lb short of the book, and nobody can say where it went.`
          : `Short again: ${total} lb of ${dc.def} gone since the first count.`,
      },
      explain: res.explain,
    });
    traceBack(world, ctx, dc, actorId);
  }
  // A count of stores already known to be short is another chance to follow the loss back.
  if (trigger === 'count')
    for (const dc of casesOf(world, householdId, placeId)) if (dc.discovered > 0) traceBack(world, ctx, dc, actorId);
  return found;
}

/**
 * Tracing a discovered loss back (13 §5.3: "Trade (Milling) or Bargain traces a discovered case
 * back"): DC 15 + 2·tier, at most once a week per case per actor. Success follows the dusting to
 * where it goes: the tracer learns that the charm draws from them (physical evidence) and who
 * has it. It does not tell them whose fault it is: culpability is inferred (13 §5.3).
 */
export function traceBack(world: World, ctx: SimContext, dc: DrawCase, actorId: ActorId): boolean {
  const a = world.actors[actorId];
  const c = world.fae.charms?.[dc.itemId];
  const def = charmDefOf(ctx.content, c?.defId);
  if (!a || !c || !def || dc.householdId === null) return false;
  dc.tracedBy ??= {};
  const last = dc.tracedBy[actorId];
  if (last !== undefined && (last < 0 || ctx.now - last < EVIDENCE_EVERY)) return false;
  const skill = ['trade_milling', 'bargain', 'perception'].sort(
    (x, y) => (a.sheet.skills[y] ?? 0) - (a.sheet.skills[x] ?? 0) || (x < y ? -1 : 1),
  )[0] as string;
  const res = skillCheck(
    ctx.content,
    a,
    { label: 'Follow the loss back', skill, dc: 15 + 2 * def.tier, knowledge: 'self' },
    ctx.rng('checks', mixKey(hashString32(dc.id), actorId, SALT_BACK, Math.floor(ctx.now / 1440))),
  );
  if (!res.success) {
    dc.tracedBy[actorId] = ctx.now;
    return false;
  }
  dc.tracedBy[actorId] = -1;
  const item = { kind: 'item' as const, id: dc.itemId };
  const draws = internProp(world, 'draws_from', [item, { kind: 'household', id: dc.householdId }]);
  // They followed the dusting with their own eyes.
  observe(world, ctx, actorId, draws, { type: 'observation', dir: 1, sourceId: null, eventId: null });
  const keeper = keeperOf(world, c);
  // A skeptic who will not credit a fae sack still saw where the flour went: the keeper took it.
  // Wrong about witchcraft, right about the door (13 §6.5); attribution weighs it as evidence.
  const believed =
    world.belief.beliefs[
      (world.belief.beliefsByHolder[actorId] ?? []).find((id) => world.belief.beliefs[id]?.propId === draws) as never
    ];
  if (keeper !== null && dc.misfortuneId !== null && (believed?.credence ?? 0) < 50)
    observe(
      world,
      ctx,
      actorId,
      internProp(world, 'caused', [
        { kind: 'actor', id: keeper },
        { kind: 'misfortune', id: dc.misfortuneId },
      ]),
      {
        type: 'inference',
        dir: 1,
        sourceId: null,
        eventId: null,
        scalePct: 70,
      },
    );
  if (keeper !== null)
    observe(world, ctx, actorId, internProp(world, 'has', [{ kind: 'actor', id: keeper }, item]), {
      type: 'physical',
      dir: 1,
      sourceId: null,
      eventId: null,
      scalePct: 60,
    });
  const k = knownRecord(world, actorId, dc.itemId);
  k.sources = [...new Set([...(k.sources ?? []), dc.householdId])];
  k.losses ??= {};
  k.losses[dc.householdId] = Math.max(0, dc.discovered - (dc.restituted ?? 0));
  const keeperName = keeper !== null ? world.actors[keeper] : undefined;
  ctx.emit({
    kind: 'fae.charm_revealed',
    place: dc.placeId,
    visibility: 'private',
    importance: 30,
    roles: [{ actor: actorId, role: 'agent' }],
    data: {
      itemId: dc.itemId,
      charm: c.defId,
      actorId,
      facts: ['source'],
      householdId: dc.householdId,
      text: `The dusting goes out of the door and away${keeperName ? ` toward the ${keeperName.name.family || keeperName.name.given} place, where they keep a flour sack that is always full` : ''}. Whatever is taking the flour, it is that sack.`,
    },
    explain: res.explain,
  });
  return true;
}

/** A count that finds nothing amiss says so to the counter (no evidence, no worry). */
export function countStock(world: World, ctx: SimContext, actorId: ActorId): number {
  const a = world.actors[actorId];
  if (!a) return 0;
  const found =
    checkShortfall(world, ctx, a.householdId, actorId, 'count', a.placeId) + checkCharmLoss(world, ctx, actorId);
  world.fae.counts ??= {};
  world.fae.counts[a.householdId] = ctx.now;
  if (!found)
    ctx.emit({
      kind: 'fae.stock_counted',
      place: a.placeId,
      visibility: 'private',
      roles: [{ actor: actorId, role: 'agent' }],
      data: {
        householdId: a.householdId,
        actorId,
        placeId: a.placeId,
        text: 'The count tallies with the book, as near as anyone can weigh it.',
      },
    });
  return found;
}

/**
 * Hourly: a visible trace after a draw (13 §5.2): household members at the source, awake, roll
 * once a draw-day (Perception DC 18) to notice the dusting and the low bin. At meal hours a bin
 * found below a day's need while a case is open is a shortage that may be noticed.
 */
export function discoveryHour(world: World, ctx: SimContext): void {
  if (!world.fae.drawCases) return;
  const meal = ctx.cal.hour === 7 || ctx.cal.hour === 12 || ctx.cal.hour === 18;
  for (const key of Object.keys(world.fae.drawCases).sort()) {
    const dc = world.fae.drawCases[key];
    if (!dc || dc.accepted || dc.undiscovered <= 0 || dc.householdId === null) continue;
    const hid = dc.householdId;
    for (const bin of Object.values(dc.bins ?? { legacy: dc })) {
      if (bin.undiscovered <= 0) continue;
      const here = (world.activity.occupancy[bin.placeId] ?? []).filter((x) => {
        const a = world.actors[x];
        return a?.alive && a.householdId === hid && !isAsleep(world, ctx, x);
      });
      if (!here.length) continue;
      if (dc.traceUntil > ctx.now) {
        // One look per draw: whoever of the household first comes to the bin after it.
        const day = Math.floor(dc.lastAt / 1440);
        const x = here[0] as ActorId;
        if (dc.traceRolls[0] !== day) {
          dc.traceRolls[0] = day;
          const a = world.actors[x];
          if (a) {
            const r = skillCheck(
              ctx.content,
              a,
              { label: 'Something not right at the bin', skill: 'perception', dc: 18, knowledge: 'self' },
              ctx.rng('checks', mixKey(hashString32(dc.id), x, SALT_TRACE, day)),
            );
            if (r.success) checkShortfall(world, ctx, hid, x, 'trace', bin.placeId);
          }
        }
      }
      if (meal && dc.undiscovered > 0) {
        const need = Math.max(1, world.households[hid]?.memberIds.length ?? 1);
        if (unitsAt(world, sourceLoc(bin), dc.def) < need)
          checkShortfall(world, ctx, hid, here[0] as ActorId, 'shortage', bin.placeId);
      }
    }
  }
}
