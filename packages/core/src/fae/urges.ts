/**
 * Fae urge proposals (13 §6.1 step 3, §6.6): `proposeFaeUrges` is read by psyche each hour like
 * the other modules' proposers. Proposals are item-specific (`itemId`, loan `terms`) and voiced
 * by data-declared drives and norms; arbitration decides. Nothing here acts. Cheap: a few charms,
 * a few lookups per actor-hour; desire itself is stored on triggers (desire.ts).
 * OWNER: module:fae.
 */
import { isAsleep } from '../activity/api.ts';
import { internProp } from '../belief/api.ts';
import { type ExplainTerm, term } from '../explain.ts';
import type { ActorId, HouseholdId, ItemId, PlaceId } from '../ids.ts';
import { pantryOf, stacksDeep } from '../items/api.ts';
import { driveWeight, normStrength } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import { itemPreflight, loanUrges, openLoanOf } from '../social/api.ts';
import { yearsBetween } from '../time.ts';
import type { Terms, UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { restitutionOwed } from './arc.ts';
import { charmDefOf, charmIds, feetBetween, type Holding, holdingOf, knowledgeOf } from './charms.ts';
import {
  actorArg,
  believedKeeper,
  believesDraws,
  bestClaimCredence,
  credence,
  householdArg,
  householdShort,
  itemArg,
} from './desire.ts';
import { drawEffectOf } from './draws.ts';
import { charmGuilt, refusedHousehold } from './refusal.ts';
import type { CharmState } from './state.ts';
import { offeringBlocked, tieWindow } from './tend.ts';

const SUNDAY = 0;

/** Next Sunday noon at least three days off: the usual term of a neighbor's loan. */
export function nextSundayNoon(now: number): number {
  const day = Math.floor(now / 1440);
  let d = day + 3;
  while (((d % 7) + 7) % 7 !== SUNDAY) d++;
  return d * 1440 + 720;
}
export function loanTerms(now: number): Terms {
  return { kind: 'loan', dueAt: nextSundayNoon(now) as never, use: 'household', depositCents: 0, rechargeDuty: true };
}

/** An item interaction worth proposing only if it would pass validation now (no refused loops). */
function feasible(
  world: World,
  ctx: SimContext,
  interactionId: string,
  actorId: ActorId,
  targetId: ActorId,
  itemId: ItemId,
  terms?: Terms,
): boolean {
  const def = ctx.content.interactions[interactionId];
  return !!def && itemPreflight(world, def, actorId, targetId, itemId, terms, ctx.now) === null;
}

function proposal(
  urge: UrgeProposal['urge'],
  voice: 'id' | 'superego',
  intensity: number,
  label: string,
  reasons: ExplainTerm[],
  voiceOf: { drive?: string; norm?: string },
): UrgeProposal {
  return {
    urge,
    voice,
    intensity: Math.max(0, Math.min(1000, Math.round(intensity))),
    label,
    source: 'fae',
    reasons,
    ...(voiceOf.drive ? { drive: voiceOf.drive } : {}),
    ...(voiceOf.norm ? { norm: voiceOf.norm } : {}),
  };
}

/** An adult present at the place, awake, of the given household (head first). */
function presentOf(world: World, ctx: SimContext, placeId: PlaceId, hid: HouseholdId): ActorId | null {
  const head = world.households[hid]?.headId;
  const here = (world.activity.occupancy[placeId] ?? []).filter((x) => {
    const a = world.actors[x];
    return a?.alive && a.householdId === hid && !isAsleep(world, ctx, x) && yearsBetween(a.born, ctx.now) >= 14;
  });
  if (head !== undefined && here.includes(head)) return head;
  return here[0] ?? null;
}

function inPantry(world: World, a: { householdId: HouseholdId }, itemId: ItemId): boolean {
  const s = world.items.stacks[itemId];
  return !!s && s.location.kind === 'household' && s.location.householdId === a.householdId;
}

function hasIngredients(world: World, hid: HouseholdId, defs: readonly { def: string; qty: number }[]): boolean {
  for (const need of defs) {
    let n = 0;
    for (const { stack } of stacksDeep(world, pantryOf(hid))) if (stack.defId === need.def) n += stack.qty;
    if (n < need.qty) return false;
  }
  return true;
}

export function proposeFaeUrges(world: World, ctx: SimContext, actorId: ActorId): UrgeProposal[] {
  if (!world.fae?.charms) return [];
  const a = world.actors[actorId];
  if (!a?.alive || isAsleep(world, ctx, actorId) || yearsBetween(a.born, ctx.now) < 12) return [];
  const out: UrgeProposal[] = [...loanUrges(world, ctx, actorId)];
  for (const id of charmIds(world)) {
    const c = world.fae.charms[id];
    const stack = world.items.stacks[id];
    if (!c || !stack || c.disposed !== null || c.reservoir !== null) continue;
    const h = holdingOf(world, stack);
    const mine = h.actorId === actorId || (h.actorId === null && h.householdId === a.householdId);
    if (mine) out.push(...keeperUrges(world, ctx, actorId, c, h));
    else out.push(...outsiderUrges(world, ctx, actorId, c, h));
  }
  return out;
}

/** What a disposal-minded keeper would do with it, if anything (13 §6.6). */
function disposalWish(
  world: World,
  actorId: ActorId,
  c: CharmState,
): { activity: string; intensity: number; label: string; norm: string } | null {
  const devilish = Math.max(
    credence(world, actorId, 'bane', [itemArg(c.itemId)]),
    credence(world, actorId, 'claim.never_empty_sack.devils', [itemArg(c.itemId)]),
  );
  const piety = normStrength(world, actorId, 'piety');
  const honesty = normStrength(world, actorId, 'honesty');
  const theft = believesDraws(world, actorId, c, 70).length > 0 && honesty >= 70;
  if (devilish < 50 && !theft) return null;
  const att = c.attachment[actorId] ?? 0;
  const superstition = world.actors[actorId]?.values.superstition ?? 0;
  const intensity = 150 + Math.max(devilish, theft ? 60 : 0) * 3 + piety * 2 - att * 4;
  if (intensity < 200) return null;
  if (piety >= 60)
    return { activity: 'destroy_charm', intensity, label: 'Take it to the forge and be done with it', norm: 'piety' };
  if (superstition >= 2)
    return { activity: 'return_charm', intensity, label: 'Give it back where it came from', norm: 'piety' };
  return {
    activity: 'bury_charm',
    intensity,
    label: 'Bury it under the sill with iron on it',
    norm: theft ? 'honesty' : 'piety',
  };
}

function keeperUrges(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, h: Holding): UrgeProposal[] {
  const out: UrgeProposal[] = [];
  const a = world.actors[actorId];
  const def = charmDefOf(ctx.content, c.defId);
  if (!a || !def) return out;
  const item = c.itemId;
  const home = world.households[a.householdId]?.homePlaceId;
  const atHome = a.placeId === home;
  const loan = openLoanOf(world, item);
  const borrowing = loan !== undefined && loan.borrowerHouseholdId === a.householdId;
  // The duty to bring it back is the borrower's own: only they fetch it for the trip.
  const due = borrowing && loan !== undefined && loan.borrowerId === actorId && ctx.now >= loan.dueAt - 720;
  const dispose = borrowing ? null : disposalWish(world, actorId, c);
  const carried = h.actorId === actorId;
  // Take it out of the house when it has to go somewhere: back to its lender, or to be got rid of.
  if (atHome && inPantry(world, a, item) && (due || dispose)) {
    const why = due ? 'It is due back; take it along' : (dispose?.label ?? '');
    out.push(
      proposal(
        { kind: 'activity', activityId: 'fetch_charm', placeId: a.placeId, itemId: item },
        'superego',
        due ? 500 : (dispose?.intensity ?? 0),
        why,
        [term('fae', why, 1)],
        {
          norm: due ? 'duty' : (dispose?.norm ?? 'piety'),
        },
      ),
    );
  }
  if (dispose && carried) {
    const placeId = dispose.activity === 'bury_charm' ? home : undefined;
    out.push(
      proposal(
        { kind: 'activity', activityId: dispose.activity, ...(placeId !== undefined ? { placeId } : {}), itemId: item },
        'superego',
        dispose.intensity,
        dispose.label,
        [term('belief', 'It is a bad thing to keep', dispose.intensity)],
        { norm: dispose.norm },
      ),
    );
  }
  // Restitution (13 §6.6): an honest keeper who believes it drew from a household repays it.
  if (!borrowing && normStrength(world, actorId, 'honesty') >= 50)
    for (const hid of believesDraws(world, actorId, c, 50)) {
      if (restitutionOwed(world, item, hid, actorId) <= 0 || hid === a.householdId) continue;
      const hon = normStrength(world, actorId, 'honesty');
      const intensity = 150 + hon * 5 - (c.attachment[actorId] ?? 0) * 2;
      const there = presentOf(world, ctx, a.placeId, hid);
      const theirHome = world.households[hid]?.homePlaceId;
      if (there !== null && feasible(world, ctx, 'make_restitution', actorId, there, item))
        out.push(
          proposal(
            { kind: 'interaction', interactionId: 'make_restitution', targetId: there, itemId: item },
            'superego',
            intensity,
            'Make it right with them for what it took',
            [term('psyche', 'Honesty', hon * 5)],
            { norm: 'honesty' },
          ),
        );
      else if (theirHome !== undefined && ctx.cal.hour >= 9 && ctx.cal.hour < 19)
        out.push(
          proposal(
            { kind: 'activity', activityId: 'visit_kin', placeId: theirHome },
            'superego',
            intensity - 80,
            'Go and make it right with them',
            [term('psyche', 'Honesty', hon * 5)],
            { norm: 'honesty' },
          ),
        );
    }
  // Lend it unasked (neighborliness against keeping): to a hungry neighbor present, or, when its
  // virtue is spent and this house cannot feed it, to a neighbor who can (the loan's recharge
  // duty: it comes back fed, 13 §6.1 Terms).
  const spent =
    c.virtue <= 1 && !def.recharge.some((r) => r.kind === 'offering' && hasIngredients(world, a.householdId, r.items));
  if (!borrowing && !loan && carried === false && atHome) {
    const neighborly = normStrength(world, actorId, 'neighborliness');
    const keep = (c.attachment[actorId] ?? 0) * 4;
    for (const x of world.activity.occupancy[a.placeId] ?? []) {
      const n = world.actors[x];
      if (!n?.alive || n.householdId === a.householdId || isAsleep(world, ctx, x) || yearsBetween(n.born, ctx.now) < 14)
        continue;
      const theyCanFeed =
        spent && def.recharge.some((r) => r.kind === 'offering' && hasIngredients(world, n.householdId, r.items));
      // Refusal costs (wave 6): a neighbor once turned away is owed it, as the conscience weighs.
      const refused = refusedHousehold(world, c, n.householdId);
      const guilt = refused ? charmGuilt(world, actorId, item) : 0;
      if (!householdShort(world, n.householdId) && !theyCanFeed && !refused) continue;
      const intensity = neighborly * 5 + 150 - keep + (theyCanFeed ? 250 : 0) + guilt;
      if (intensity > 250 && feasible(world, ctx, 'share_out', actorId, x, item, loanTerms(ctx.now)))
        out.push(
          proposal(
            { kind: 'interaction', interactionId: 'share_out', targetId: x, itemId: item, terms: loanTerms(ctx.now) },
            'superego',
            intensity,
            refused ? `I turned ${n.name.given} away before` : `${n.name.given}'s children have had nothing warm`,
            [
              term('psyche', 'Neighborliness', neighborly * 5),
              term('psyche', 'Keep it', -keep),
              ...(guilt > 0 ? [term('psyche', 'Guilt over turning them away', guilt)] : []),
            ],
            { norm: refused ? 'duty' : 'neighborliness' },
          ),
        );
      break;
    }
  }
  // Tending: stow it at home, tie it for the night, feed it when its virtue runs low.
  const eff = drawEffectOf(def);
  if (eff && !due && !dispose) {
    const short = householdShort(world, a.householdId);
    const att = c.attachment[actorId] ?? 0;
    const evening = tieWindow(ctx) && ctx.cal.hour >= 17 && ctx.cal.hour <= 22;
    // Tying and feeding are done by one's own hearth: in hand, or in the house's stores, it is
    // within reach of an evening errand home (the activity below is placed at home).
    const reach = home !== undefined && (carried || inPantry(world, a, item));
    const stow = carried && atHome;
    const tie = evening && reach && !(c.tie && c.tie.at > ctx.now - 720);
    const offering = def.recharge.find((r) => r.kind === 'offering');
    const feed =
      evening &&
      reach &&
      c.virtue <= 2 &&
      offering?.kind === 'offering' &&
      offeringBlocked(world, ctx, c) === null &&
      hasIngredients(world, a.householdId, offering.items);
    // A borrower who promised to bring it back fed (13 §6.1 Terms: recharge duty) feeds it as a
    // kept promise weighs, not as a want: the same `duty` norm as bringing it back on the day.
    const owed = borrowing && loan?.rechargeDuty === true;
    const promise = owed ? 200 + normStrength(world, actorId, 'duty') * 5 : 0;
    // No porridge makings in the house: an errand to a store that has them (a real purchase).
    if (
      !evening &&
      c.virtue <= 2 &&
      offering?.kind === 'offering' &&
      ctx.cal.hour >= 9 &&
      ctx.cal.hour < 17 &&
      offeringBlocked(world, ctx, c) === null
    ) {
      const missing = offering.items.find((need) => !hasIngredients(world, a.householdId, [need]));
      const store = missing ? storeWith(world, ctx, a.placeId, missing.def) : null;
      if (store !== null && store !== a.placeId)
        out.push(
          proposal(
            { kind: 'activity', activityId: 'go_to_market', placeId: store, itemId: item },
            owed ? 'superego' : 'id',
            250 + (short ? 150 : 0) + att * 2 + promise,
            `Fetch ${missing?.def ?? 'makings'} for the porridge it wants`,
            [
              term('fae', 'Its virtue is spent', 250),
              ...(owed ? [term('psyche', 'Promised to bring it back fed', promise)] : []),
            ],
            owed ? { norm: 'duty' } : { drive: short ? 'hunger' : 'greed' },
          ),
        );
    }
    if (stow || tie || feed) {
      const kept = feed && owed;
      const intensity = (tie ? 300 : 150) + (feed ? 150 : 0) + (short ? 200 : 0) + att * 2 + (kept ? promise : 0);
      out.push(
        proposal(
          { kind: 'activity', activityId: 'tend_charm', placeId: home ?? a.placeId, itemId: item },
          kept ? 'superego' : 'id',
          intensity,
          kept
            ? 'Feed it, as promised, before it goes back'
            : tie
              ? 'Tie the sack for the night'
              : feed
                ? 'Set out porridge for the Good Neighbors'
                : 'Put it away with the stores',
          [
            term('need', 'Bread for the house', short ? 200 : 0),
            term('psyche', 'Attachment', att * 2),
            ...(kept ? [term('psyche', 'Promised to bring it back fed', promise)] : []),
          ],
          kept ? { norm: 'duty' } : { drive: short ? 'hunger' : 'greed' },
        ),
      );
    }
  }
  return out;
}

function outsiderUrges(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, _h: Holding): UrgeProposal[] {
  const out: UrgeProposal[] = [];
  const a = world.actors[actorId];
  if (!a) return out;
  const item = c.itemId;
  const keeper = believedKeeper(world, actorId, item);
  const k = keeper !== null ? world.actors[keeper] : undefined;
  const keeperHere = !!k && k.placeId === a.placeId && !isAsleep(world, ctx, k.id);
  const day = ctx.cal.hour >= 9 && ctx.cal.hour < 19;
  const keeperHome = k ? world.households[k.householdId]?.homePlaceId : undefined;
  const honesty = normStrength(world, actorId, 'honesty');
  const scholar = Math.max(a.sheet.skills.spellcraft ?? 0, a.sheet.skills.lore_fae ?? 0);
  const known = knowledgeOf(world, actorId, item);
  // Study (13 §6.1 inspect/study): the honest or curious who can read such things, given a look.
  if (scholar >= 1 && !known?.effects) {
    const heard = bestClaimCredence(world, ctx.content, actorId, c);
    if (heard >= 40) {
      const intensity = 150 + honesty * 3 + scholar * 20;
      if ((c.access?.[actorId] ?? -1) >= ctx.now && keeperHere)
        out.push(
          proposal(
            { kind: 'activity', activityId: 'study_charm', placeId: a.placeId, itemId: item },
            'superego',
            intensity + 100,
            'Look at it properly and see what it really does',
            [term('psyche', 'Honesty', honesty * 3), term('skill', 'Can read such things', scholar * 20)],
            { norm: 'honesty' },
          ),
        );
      else if (
        keeperHere &&
        keeper !== null &&
        feasible(world, ctx, 'ask_to_see', actorId, keeper, item) &&
        (c.asked?.[actorId] ?? -1e9) <= ctx.now - 3 * 1440
      )
        out.push(
          proposal(
            { kind: 'interaction', interactionId: 'ask_to_see', targetId: keeper, itemId: item },
            'superego',
            intensity,
            'Ask to look at it',
            [term('psyche', 'Honesty', honesty * 3)],
            { norm: 'honesty' },
          ),
        );
      else if (day && keeperHome !== undefined && heard >= 60)
        out.push(
          proposal(
            { kind: 'activity', activityId: 'visit_kin', placeId: keeperHome },
            'superego',
            intensity - 100,
            'Call on them and see this thing',
            [term('psyche', 'Honesty', honesty * 3)],
            { norm: 'honesty' },
          ),
        );
    }
  }
  // Tell what was found (13 §6.9 day 20): a studier tells the household it draws from; a studier
  // or a source that traced its own loss tells the keeper (a warning: 13 §5.3 kept_drawing).
  const tracedOwn = (known?.sources ?? []).includes(a.householdId as number);
  if (known?.effects || tracedOwn) {
    c.told ??= {};
    const told = c.told[actorId] ?? [];
    const sources = known?.effects ? believesDraws(world, actorId, c, 80) : [];
    for (const hid of sources) {
      const target = presentOf(world, ctx, a.placeId, hid);
      if (target === null || told.includes(hid) || hid === a.householdId) continue;
      const topic = internProp(world, 'draws_from', [itemArg(item), householdArg(hid)]);
      out.push(
        proposal(
          { kind: 'interaction', interactionId: 'tell_what_found', targetId: target, topic, itemId: item },
          'superego',
          250 + honesty * 4,
          'They should know where their flour has been going',
          [term('psyche', 'Honesty', honesty * 4)],
          { norm: 'honesty' },
        ),
      );
    }
    const theirs = (known?.sources ?? []).find((h) =>
      believesDraws(world, actorId, c, 50).includes(h as HouseholdId),
    ) as HouseholdId | undefined;
    if (
      k &&
      keeper !== null &&
      theirs !== undefined &&
      !told.includes(k.householdId) &&
      k.householdId !== a.householdId
    ) {
      const topic = internProp(world, 'draws_from', [itemArg(item), householdArg(theirs)]);
      const label = tracedOwn
        ? 'That sack of theirs has been taking our flour; they should hear it from me'
        : 'They should know what their sack does';
      const intensity = 250 + honesty * 3 + (tracedOwn ? 150 : 0);
      if (keeperHere)
        out.push(
          proposal(
            { kind: 'interaction', interactionId: 'tell_what_found', targetId: keeper, topic, itemId: item },
            'superego',
            intensity,
            label,
            [term('psyche', 'Honesty', honesty * 3), term('need', 'Our own loss', tracedOwn ? 150 : 0)],
            { norm: 'honesty' },
          ),
        );
      else if (day && keeperHome !== undefined && k.placeId === keeperHome)
        out.push(
          proposal(
            { kind: 'activity', activityId: 'visit_kin', placeId: keeperHome },
            'superego',
            intensity - 100,
            label,
            [term('psyche', 'Honesty', honesty * 3)],
            { norm: 'honesty' },
          ),
        );
    }
  }
  // Covet (13 §5.6): desire, voiced by hunger or greed; conscience speaks against theft and the Devil.
  const d = c.desire[actorId] ?? 0;
  if (d < 20 || keeper === null || !k || k.householdId === a.householdId) return out;
  // Desperation theft is not proposed here: a generic theft act in module:social (wave 6 relief)
  // can read `charmCovetPressure` (fae/refusal.ts) for a refused, short household (the hook).
  // Its own house does not covet what it has lent out: getting it back is the loan's business.
  if (openLoanOf(world, item)?.lenderHouseholdId === a.householdId) return out;
  if ((c.asked?.[actorId] ?? -1e9) > ctx.now - 3 * 1440) return out;
  const piety = normStrength(world, actorId, 'piety');
  const devilish = Math.max(
    credence(world, actorId, 'bane', [itemArg(item)]),
    credence(world, actorId, 'claim.never_empty_sack.devils', [itemArg(item)]),
  );
  const thief = believesDraws(world, actorId, c).length > 0;
  const conscience = (thief ? honesty * 4 : 0) + (devilish >= 50 ? piety * 4 : 0);
  const short = householdShort(world, a.householdId);
  const intensity = Math.min(700, 10 * d) - conscience;
  if (intensity <= 120) return out;
  const reasons = [term('fae', 'Desire (×10)', Math.min(700, 10 * d)), term('psyche', 'Conscience', -conscience)];
  const voice = { drive: short ? 'hunger' : d >= 60 ? 'envy' : 'greed' };
  const label = short
    ? 'One turn with that sack would put bread in our cupboard'
    : 'That sack of theirs would be a fine thing to have';
  if (keeperHere) {
    const takeIt =
      honesty < 30 &&
      driveWeight(world, actorId, 'greed') >= 60 &&
      credence(world, actorId, 'has', [actorArg(keeper), itemArg(item)]) >= 50;
    const seen = (known?.construction ?? null) !== null || (c.access?.[actorId] ?? -1) >= 0;
    const urge: UrgeProposal['urge'] = takeIt
      ? { kind: 'interaction', interactionId: 'take', targetId: keeper, itemId: item }
      : d >= 40 || seen
        ? { kind: 'interaction', interactionId: 'beg_loan', targetId: keeper, itemId: item, terms: loanTerms(ctx.now) }
        : { kind: 'interaction', interactionId: 'ask_to_see', targetId: keeper, itemId: item };
    if (urge.kind === 'interaction' && feasible(world, ctx, urge.interactionId, actorId, keeper, item, urge.terms))
      out.push(proposal(urge, 'id', intensity, label, reasons, voice));
  } else if (day && keeperHome !== undefined && d >= 30)
    out.push(
      proposal(
        { kind: 'activity', activityId: 'visit_kin', placeId: keeperHome },
        'id',
        intensity - 100,
        `Call on the ${k.name.family || k.name.given}s about that sack`,
        reasons,
        voice,
      ),
    );
  return out;
}

/** The nearest open store place with stock of a def (for an offering errand). */
export function storeWith(world: World, ctx: SimContext, from: PlaceId, defId: string): PlaceId | null {
  let best: { id: PlaceId; feet: number } | null = null;
  for (const key of Object.keys(world.provisions.stores).sort((x, y) => Number(x) - Number(y))) {
    const pid = Number(key) as PlaceId;
    if (!world.places[pid]) continue;
    let have = 0;
    for (const { stack } of stacksDeep(world, { kind: 'place', placeId: pid }))
      if (stack.defId === defId) have += stack.qty;
    if (have <= 0) continue;
    const feet = feetBetween(world, ctx.content, from, pid);
    if (!best || feet < best.feet) best = { id: pid, feet };
  }
  return best?.id ?? null;
}
