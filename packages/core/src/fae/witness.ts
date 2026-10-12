/**
 * Step 1 of the causal chain (13 §6.1): a witnessed use or result gives each witness an
 * observation on the charm's seed claim; desire is evaluated on that trigger. Plus the daily
 * upkeep: attachment (13 §5.6), iron souring (13 §5.4), and desire for those who heard of it.
 * OWNER: module:fae.
 */
import { isAsleep } from '../activity/api.ts';
import { internProp, observe } from '../belief/api.ts';
import type { ActorId } from '../ids.ts';
import { asEventId } from '../ids.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import { charmDefOf, charmIds, charmLive, claimPredicateOf, holdingOf, ironOn, keeperOf, learn } from './charms.ts';
import { actorArg, believesDraws, bestClaimCredence, evaluateDesire, householdShort, itemArg } from './desire.ts';
import { drawEffectOf } from './draws.ts';
import type { CharmState } from './state.ts';
import { thankCharm } from './tend.ts';

const SALT_THANK = 0x7ba6;

/** The seed claim of a charm's output group: what a plain witness says it does. */
export function seedClaimId(_world: World, ctx: Pick<SimContext, 'content'>, c: CharmState): string | null {
  const def = charmDefOf(ctx.content, c.defId);
  return def?.claims.find((x) => x.group === 'output' && x.from === undefined)?.id ?? null;
}

/** Each hour: whoever is awake where a sack stands full this morning sees it, once a day. */
export function witnessHour(world: World, ctx: SimContext): void {
  const today = ctx.cal.dayIndex;
  for (const id of charmIds(world)) {
    const c = world.fae.charms?.[id];
    if (!c || !charmLive(c) || c.lastDrawDay !== today) continue;
    const def = charmDefOf(ctx.content, c.defId);
    const stack = world.items.stacks[id];
    if (!def || !drawEffectOf(def) || !stack) continue;
    if (world.fae.ablation?.noWitnesses) continue;
    const h = holdingOf(world, stack);
    if (h.placeId === null) continue;
    const keeper = keeperOf(world, c);
    const fresh = (world.activity.occupancy[h.placeId] ?? []).filter((a) => {
      const actor = world.actors[a];
      return (
        actor?.alive &&
        c.witnessed[a] !== today &&
        !world.activity.byActor[a]?.travel &&
        !isAsleep(world, ctx, a) &&
        yearsBetween(actor.born, ctx.now) >= 8
      );
    });
    if (!fresh.length) continue;
    const seed = seedClaimId(world, ctx, c);
    const first = Object.values(c.witnessed).every((d) => d !== today);
    const eventId = first
      ? ctx.emit({
          kind: 'fae.charm_used',
          place: h.placeId,
          visibility: 'witnessed',
          importance: 15,
          roles: fresh.slice(0, 6).map((a) => ({ actor: a, role: 'witness' as const })),
          data: {
            itemId: c.itemId,
            charm: c.defId,
            keeperId: keeper,
            placeId: h.placeId,
            witnesses: fresh,
            text:
              c.lastUseAt !== null && Object.keys(c.witnessed).length > 0
                ? 'The flour sack stands full again this morning, though nobody went to the mill.'
                : 'The flour sack stands full this morning, though nobody went to the mill.',
          },
        })
      : null;
    for (const a of fresh) {
      const firstTime = c.witnessed[a] === undefined;
      c.witnessed[a] = today;
      const own = h.householdId !== null && world.actors[a]?.householdId === h.householdId;
      if (seed)
        observe(world, ctx, a, internProp(world, claimPredicateOf(c.defId, seed), [itemArg(id)]), {
          type: 'observation',
          dir: 1,
          sourceId: null,
          eventId: eventId === null ? null : asEventId(eventId),
          scalePct: own ? 100 : 60,
        });
      if (keeper !== null && keeper !== a)
        observe(world, ctx, a, internProp(world, 'has', [actorArg(keeper), itemArg(id)]), {
          type: 'observation',
          dir: 1,
          sourceId: null,
          eventId: eventId === null ? null : asEventId(eventId),
        });
      evaluateDesire(world, ctx.content, a, c);
      // Seeing it stand full in one's own house is seeing it work (13 §5.3 a controlled result).
      if (own) learn(world, a, id, 'observed', ctx.now);
      if (own) helpAttach(world, ctx, a, c);
      if (own && a === keeper) maybeThank(world, ctx, a, c, firstTime);
    }
  }
}

/** Material help a day: +3 (cap +15 a week); a real emergency (the household short) +10 once a week. */
function helpAttach(world: World, ctx: SimContext, a: ActorId, c: CharmState): void {
  const week = Math.floor(ctx.cal.dayIndex / 7);
  const book =
    c.attachWeek[a]?.week === week
      ? (c.attachWeek[a] as { week: number; gained: number; lastBenefitDay: number })
      : { week, gained: 0, lastBenefitDay: ctx.cal.dayIndex };
  let gain = Math.min(3, 15 - book.gained);
  if (householdShort(world, world.actors[a]?.householdId) && book.gained < 15) gain += 10;
  gain = Math.max(0, gain);
  book.gained += gain;
  book.lastBenefitDay = ctx.cal.dayIndex;
  c.attachWeek[a] = book;
  c.attachment[a] = Math.min(100, (c.attachment[a] ?? 0) + gain);
}

/**
 * A keeper who does not know the old rule may thank it aloud at supper, as one thanks anyone who
 * fed the house (13 §5.5 `unthanked`): Lore (Fae) 1+ knows better; otherwise 1 in 10, once, on the
 * first morning that keeper finds it full.
 */
function maybeThank(world: World, ctx: SimContext, a: ActorId, c: CharmState, firstTime: boolean): void {
  if (!firstTime || c.thankedAt !== null || (world.actors[a]?.sheet.skills.lore_fae ?? 0) >= 1) return;
  if (!ctx.rng('fae', mixKey(c.itemId, a, SALT_THANK)).chancePermille(100)) return;
  thankCharm(world, ctx, a, c, { kind: 'own' });
}

/**
 * Daily: attachment fades a point a day after a week without contact or benefit; iron in contact
 * sours a charm (below its floor it stops recharging, at 0 it is ordinary forever); and desire is
 * re-evaluated for everyone who has heard of a charm (a claim learned is a trigger).
 */
export function charmDaily(world: World, ctx: SimContext): void {
  const today = ctx.cal.dayIndex;
  for (const id of charmIds(world)) {
    const c = world.fae.charms?.[id];
    const def = charmDefOf(ctx.content, c?.defId);
    const stack = world.items.stacks[id];
    if (!c || !def) continue;
    for (const key of Object.keys(c.attachment)) {
      const a = Number(key);
      const last = c.attachWeek[a]?.lastBenefitDay ?? -1;
      if (today - last > 7) {
        const v = (c.attachment[a] ?? 0) - 1;
        if (v <= 0) delete c.attachment[a];
        else c.attachment[a] = v;
      }
    }
    if (stack && !c.inert && def.iron.sour_per_day > 0 && ironOn(world, ctx.content, stack, def).suppressed) {
      c.vigor = Math.max(0, c.vigor - def.iron.sour_per_day);
      if (c.vigor === 0) c.inert = true;
    }
    if (!charmLive(c)) continue;
    for (const a of Object.values(world.actors)) {
      if (!a.alive || yearsBetween(a.born, ctx.now) < 14) continue;
      if (
        bestClaimCredence(world, ctx.content, a.id, c) >= 20 ||
        c.desire[a.id] !== undefined ||
        believesDraws(world, a.id, c, 20).length > 0
      )
        evaluateDesire(world, ctx.content, a.id, c);
    }
  }
}
