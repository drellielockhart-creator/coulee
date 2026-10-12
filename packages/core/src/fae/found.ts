/**
 * Arrival by Found (13 §6.3): a reservoir charm lies at a place; each eligible actor-hour there
 * (gathering, or an activity carrying one of its tags) is a hazard of `findPermille`, then a
 * Perception check. At most one find per charm per season. The Director never creates one.
 * OWNER: module:fae.
 */
import { isAsleep } from '../activity/api.ts';
import { internProp, observe } from '../belief/api.ts';
import { skillCheck } from '../checks.ts';
import type { ActorId } from '../ids.ts';
import { asItemId } from '../ids.ts';
import { carriedBy, moveStack } from '../items/api.ts';
import { newStack } from '../items/state.ts';
import { authorizeAct, type Basis } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import type { InitContext, SimContext } from '../sim/context.ts';
import { calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { charmDefOf, charmIds, ensureCharm } from './charms.ts';
import { isProtectedSite } from './sites.ts';
import type { CharmState } from './state.ts';

const SALT_FIND = 0xf0dd;

/** Seed the scenario's reservoir (after every other module's init). Protected sites never hold one. */
export function seedReservoir(world: World, ctx: InitContext): void {
  for (const r of ctx.scenario.fae_reservoir ?? []) {
    const placeId = world.index.placeByDef[r.place];
    const place = placeId !== undefined ? world.places[placeId] : undefined;
    if (!place || placeId === undefined || isProtectedSite(place) || !charmDefOf(ctx.content, r.item)) continue;
    const id = newStack(world, r.item, 1, { kind: 'place', placeId }, ctx.now);
    const c = ensureCharm(world, ctx.content, id);
    if (!c) continue;
    const def = charmDefOf(ctx.content, r.item);
    if (r.virtue !== undefined && def) c.virtue = Math.min(def.virtue.max, r.virtue);
    c.reservoir = {
      placeId,
      from: ctx.now + r.from_day * 1440,
      findPermille: r.find_permille,
      noticeDc: r.notice_dc,
      gathering: r.gathering,
      tags: [...r.activity_tags],
      lastFindSeason: -1,
    };
  }
}

function seasonIndex(t: number): number {
  const c = calendarAt(t as never);
  return c.year * 4 + ['spring', 'summer', 'autumn', 'winter'].indexOf(c.season);
}

/** An actor working the ground there this hour: gathering at a venue, or a tagged activity. */
function eligible(world: World, ctx: SimContext, actorId: ActorId, c: CharmState): boolean {
  const r = c.reservoir;
  const a = world.actors[actorId];
  const st = world.activity.byActor[actorId];
  if (!r || !a?.alive || !st?.activityId || st.travel || a.placeId !== r.placeId) return false;
  if (isAsleep(world, ctx, actorId)) return false;
  const def = ctx.content.activities[st.activityId];
  if (!def) return false;
  if (r.gathering && def.at === 'venue' && def.yields.length > 0) return true;
  return def.tags.some((t) => r.tags.includes(t));
}

export function findHour(world: World, ctx: SimContext): void {
  for (const id of charmIds(world)) {
    const c = world.fae.charms?.[id];
    const r = c?.reservoir;
    if (!c || !r || ctx.now < r.from) continue;
    const season = seasonIndex(ctx.now);
    if (r.lastFindSeason === season) continue;
    const here = (world.activity.occupancy[r.placeId] ?? []).filter((a) => eligible(world, ctx, a, c));
    here.sort((a, b) => mixKey(id, a) - mixKey(id, b) || a - b);
    for (const actorId of here) {
      if (!ctx.rng('fae', mixKey(id, actorId, SALT_FIND)).chancePermille(r.findPermille)) continue;
      const a = world.actors[actorId];
      if (!a) continue;
      const check = skillCheck(
        ctx.content,
        a,
        { label: 'Something lying in the grass', skill: 'perception', dc: r.noticeDc, knowledge: 'self' },
        ctx.rng('checks', mixKey(id, actorId, SALT_FIND + 1)),
      );
      if (!check.success) continue;
      r.lastFindSeason = season;
      found(world, ctx, actorId, c, { kind: 'own' });
      break;
    }
  }
}

/**
 * The find: the finder sees it. An actor whose agency authorizes picking it up takes it; one held
 * for orders (a commanded PC) leaves it lying there until a `fae.take` Command. Either way the
 * finder knows where it is.
 */
export function found(world: World, ctx: SimContext, finderId: ActorId, c: CharmState, basis: Basis): void {
  const r = c.reservoir;
  const stack = world.items.stacks[c.itemId];
  const a = world.actors[finderId];
  if (!r || !stack || !a) return;
  const def = charmDefOf(ctx.content, c.defId);
  const witnesses = (world.activity.occupancy[r.placeId] ?? []).filter(
    (x) => x !== finderId && world.actors[x]?.alive && !isAsleep(world, ctx, x),
  );
  ctx.emit({
    kind: 'fae.charm_arrived',
    place: r.placeId,
    visibility: 'witnessed',
    importance: 25,
    roles: [
      { actor: finderId, role: 'agent' },
      ...witnesses.slice(0, 4).map((w) => ({ actor: w, role: 'witness' as const })),
    ],
    data: {
      itemId: c.itemId,
      charm: c.defId,
      finderId,
      placeId: r.placeId,
      text: `Something lies in the grass at ${world.places[r.placeId]?.name ?? 'the place'}: ${ctx.content.items[c.defId]?.name.toLowerCase() ?? 'a strange thing'}, clean and dry as if just set down.${def?.saying ? ` A saying comes with it: "${def.saying}"` : ''}`,
    },
  });
  c.noticedBy = [...(c.noticedBy ?? []).filter((x) => x !== finderId), finderId];
  if (authorizeAct(world, finderId, { kind: 'pick_up', itemId: c.itemId }, basis).ok)
    takeFound(world, ctx, finderId, c);
}

/** Pick a found charm up: it becomes the finder's (finder claim 70, 13 §6.4). */
export function takeFound(world: World, ctx: SimContext, actorId: ActorId, c: CharmState): void {
  const r = c.reservoir;
  if (!r) return;
  moveStack(world, ctx, c.itemId, 1, carriedBy(actorId));
  c.reservoir = null;
  c.found = { at: ctx.now, by: actorId, placeId: r.placeId };
  c.boundTo ??= actorId;
  c.custodianId = actorId;
  c.noticedBy = [];
  const item = { kind: 'item' as const, id: asItemId(c.itemId) };
  const taker = { kind: 'actor' as const, id: actorId };
  observe(world, ctx, actorId, internProp(world, 'has', [taker, item]), {
    type: 'observation',
    dir: 1,
    sourceId: null,
    eventId: null,
  });
  observe(world, ctx, actorId, internProp(world, 'owns', [taker, item]), {
    type: 'inference',
    dir: 1,
    sourceId: null,
    eventId: null,
    scalePct: 70,
  });
}
