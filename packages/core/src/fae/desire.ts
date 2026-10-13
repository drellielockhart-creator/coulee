/**
 * Item beliefs, desire and attachment (13 §5.3, §5.6). OWNER: module:fae.
 *
 * Desire reads the BELIEVED function (claim credences); harm reads the true one. D is evaluated
 * on triggers (a witnessed result, a claim learned, a shortage), never by an hourly scan:
 *   D = clamp(0, 100, floor((3U + A + L + E − 2R) / 4))
 * U: per claim group, the best weight × credence / 100 (output only adds utility), ×3 when the
 * household is short (the hungry want it most), capped at 100. A: attachment. L: allure, as far as
 * the thing is known of. E: envy of a keeper seen to have it. R: believed danger and theft.
 */
import { credenceOf, internProp, propKey } from '../belief/api.ts';
import type { PropArg } from '../belief/state.ts';
import type { ContentBundle } from '../content.ts';
import { type ExplainTerm, term } from '../explain.ts';
import type { ActorId, HouseholdId, ItemId, PropId } from '../ids.ts';
import { asItemId, rowsOf } from '../ids.ts';
import type { World } from '../world.ts';
import { charmDefOf, claimPredicateOf } from './charms.ts';
import type { CharmState } from './state.ts';

export const itemArg = (id: ItemId | number): PropArg => ({ kind: 'item', id: asItemId(id) });
export const actorArg = (id: ActorId): PropArg => ({ kind: 'actor', id });
export const householdArg = (id: HouseholdId): PropArg => ({ kind: 'household', id });

/** A proposition's id if it was ever interned (read-only: no new props for a lookup). */
export function knownProp(world: World, pred: string, args: PropArg[]): PropId | undefined {
  return world.belief.propByKey[propKey(pred, args)];
}
export function credence(world: World, holder: ActorId, pred: string, args: PropArg[]): number {
  const p = knownProp(world, pred, args);
  return p === undefined ? 0 : credenceOf(world, holder, p);
}
/** Interned claim prop for one of a charm's claims. */
export function claimProp(world: World, c: CharmState, claimId: string): PropId {
  return internProp(world, claimPredicateOf(c.defId, claimId), [itemArg(c.itemId)]);
}

/** The household is short: its rations are cut or it had a shortage notice in the last 3 days. */
export function householdShort(world: World, hid: HouseholdId | undefined): boolean {
  if (hid === undefined) return false;
  const h = world.provisions.households[hid];
  if (!h) return false;
  return (
    h.rationPct < 100 ||
    h.shortageStep > 0 ||
    (h.lastShortageDay !== null && h.lastShortageDay >= Math.floor(world.time / 1440) - 3)
  );
}

/** Highest credence the actor gives any claim about the charm (how well they know of it). */
export function bestClaimCredence(world: World, content: ContentBundle, actorId: ActorId, c: CharmState): number {
  const def = charmDefOf(content, c.defId);
  let best = 0;
  for (const x of def?.claims ?? []) {
    const cr = credence(world, actorId, claimPredicateOf(c.defId, x.id), [itemArg(c.itemId)]);
    if (cr > best) best = cr;
  }
  return best;
}

/** Believed theft: the actor holds that the charm draws from someone (any known source). */
export function believesDraws(world: World, actorId: ActorId, c: CharmState, min = 50): HouseholdId[] {
  const out: HouseholdId[] = [];
  for (const h of rowsOf(world.households))
    if (credence(world, actorId, 'draws_from', [itemArg(c.itemId), householdArg(h.id)]) >= min) out.push(h.id);
  return out;
}

/** Strongest believed keeper; ties break by actor id, never by physical custody. */
export function believedKeeper(world: World, actorId: ActorId, itemId: ItemId): ActorId | null {
  let best: ActorId | null = null;
  let strength = 49;
  for (const a of rowsOf(world.actors)) {
    const cr = credence(world, actorId, 'has', [actorArg(a.id), itemArg(itemId)]);
    if (cr > strength) {
      best = a.id;
      strength = cr;
    }
  }
  return best;
}

export interface Desire {
  d: number;
  terms: ExplainTerm[];
}

export function desireOf(world: World, content: ContentBundle, actorId: ActorId, c: CharmState): Desire {
  const def = charmDefOf(content, c.defId);
  const a = world.actors[actorId];
  if (!def || !a) return { d: 0, terms: [] };
  let u = 0;
  let r = 0;
  let known = 0;
  for (const x of def.claims) {
    const cr = credence(world, actorId, claimPredicateOf(c.defId, x.id), [itemArg(c.itemId)]);
    if (cr > known) known = cr;
    const v = Math.floor((x.weight * cr) / 100);
    if (x.group === 'output') u = Math.max(u, v);
    else if (x.group === 'danger') r = Math.max(r, v);
  }
  // Believing it draws flour from someone's bins is believing it yields flour (13 §5.6: utility
  // reads the believed function, whichever way it was learned).
  let drawsCred = 0;
  for (const h of rowsOf(world.households))
    drawsCred = Math.max(drawsCred, credence(world, actorId, 'draws_from', [itemArg(c.itemId), householdArg(h.id)]));
  const seed = def.claims.find((x) => x.group === 'output' && x.from === undefined);
  if (seed && drawsCred > 0) u = Math.max(u, Math.floor((seed.weight * drawsCred) / 100));
  known = Math.max(known, drawsCred);
  if (known < 20) return { d: 0, terms: [term('belief', 'Has not heard enough of it', known)] };
  const short = householdShort(world, a.householdId);
  if (short) u = Math.min(100, u * 3);
  const att = c.attachment[actorId] ?? 0;
  const allure = Math.floor((def.allure * known) / 100);
  const keeper = believedKeeper(world, actorId, c.itemId);
  const keeperOther = keeper !== null && world.actors[keeper]?.householdId !== a.householdId;
  const seenHas =
    keeperOther && keeper !== null ? credence(world, actorId, 'has', [actorArg(keeper), itemArg(c.itemId)]) : 0;
  const envy = seenHas >= 50 ? 20 + (short ? 20 : 0) : 0;
  const bane = credence(world, actorId, 'bane', [itemArg(c.itemId)]);
  // Theft weighs as the actor's honesty makes it weigh: the honest recoil, the hungry less so.
  const honesty = world.psyche.byActor[actorId]?.norms.honesty ?? 50;
  const theft = drawsCred >= 50 ? Math.floor((honesty * 6) / 10) : 0;
  r = Math.min(100, r + (bane >= 50 ? 30 : 0) + theft);
  const d = Math.max(0, Math.min(100, Math.floor((3 * u + att + allure + envy - 2 * r) / 4)));
  return {
    d,
    terms: [
      term('belief', `Believed use${short ? ' (×3: the household is short)' : ''}`, u),
      term('psyche', 'Attachment', att),
      term('item', 'Allure, as far as known', allure),
      term('opinion', 'Envy of the keeper', envy),
      term('belief', 'Believed danger or theft, by honesty (×2, against)', -r),
    ],
  };
}

/** Re-evaluate and store D (on a trigger). */
export function evaluateDesire(world: World, content: ContentBundle, actorId: ActorId, c: CharmState): number {
  const { d } = desireOf(world, content, actorId, c);
  if (d > 0) c.desire[actorId] = d;
  else delete c.desire[actorId];
  return d;
}
