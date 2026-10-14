/**
 * Social urges proposed to the psyche each hour (04 §3.4; MODULES §1.4).
 * OWNER: module:social.
 *
 * - Company seeking (Id, drive `longing`): when Company is below `company_seek_below`, go
 *   to a sociable venue from `seek_company` — the one where the most acquaintances are
 *   right now (last hour's occupancy), else the first that exists.
 * - Targeted interactions: for interactions with an `urge` block, the top ties present
 *   whose volition clears `urge.min_score` (insult, threaten, fight, borrow, repay, dun,
 *   apologize, court, propose). Intensity = score × intensity_pct / 10.
 */
import { isAsleep, occupants } from '../activity/api.ts';
import { shortName } from '../actor.ts';
import type { ActivityDef, InteractionDef } from '../content.ts';
import { type Bias, hasLiveBias, noteNudge, optionTiltFor } from '../director/api.ts';
import { term } from '../explain.ts';
import { type ActorId, idsOf, type PlaceId, sortedKeys } from '../ids.ts';
import { needValue } from '../needs/api.ts';
import { autonomous } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { sampleCandidates } from './encounter.ts';
import { type MemoryDigest, memoryDigests } from './memory.ts';
import { clampInt, floorDiv } from './model.ts';
import { opinionOf } from './opinion.ts';
import { reliefUrges } from './relief.ts';
import { desperationUrges } from './theft.ts';
import { ageYears, tuningOf } from './tuning.ts';
import { makePair, requiresFail, volition } from './volition.ts';

const SALT_URGE = 0x0e6e;

let urgeDefsCache: { content: unknown; defs: InteractionDef[] } | null = null;
function urgeDefs(ctx: SimContext): InteractionDef[] {
  if (urgeDefsCache && urgeDefsCache.content === ctx.content) return urgeDefsCache.defs;
  const defs = sortedKeys(ctx.content.interactions)
    .map((k) => ctx.content.interactions[k] as InteractionDef)
    .filter((d) => d?.urge !== undefined);
  urgeDefsCache = { content: ctx.content, defs };
  return defs;
}

function activityFits(world: World, ctx: SimContext, actorId: ActorId, act: ActivityDef): boolean {
  const a = world.actors[actorId];
  if (!a) return false;
  // Worship happens on the Sabbath; outside it, church is no place to seek company.
  if (act.tags.includes('worship') && !ctx.cal.isSabbath) return false;
  // Children do not go out seeking company on their own (they have the household).
  if (act.at === 'venue' && ageYears(a, ctx.now) < tuningOf(ctx.content).courtship_min_age) return false;
  return true;
}

type Venue = { activityId: string; placeId: PlaceId; friends: number; tag: string };
function friendsAt(world: World, actorId: ActorId, pid: PlaceId): number {
  let friends = 0;
  for (const o of occupants(world, pid)) if (o !== actorId && opinionOf(world, actorId, o).affection > 0) friends++;
  return friends;
}
/** The undirected choice: the venue with the most friends (ties: seek_company order, place id). */
function plainVenue(world: World, ctx: SimContext, actorId: ActorId): Venue | null {
  const t = tuningOf(ctx.content);
  let best: Venue | null = null;
  for (const s of t.seek_company) {
    const act = ctx.content.activities[s.activity];
    if (!act || !activityFits(world, ctx, actorId, act)) continue;
    for (const pid of idsOf<PlaceId>(world.places)) {
      const p = world.places[pid];
      if (!p?.tags.includes(s.tag)) continue;
      const friends = friendsAt(world, actorId, pid);
      if (!best || friends > best.friends) best = { activityId: s.activity, placeId: pid, friends, tag: s.tag };
    }
  }
  return best;
}
/**
 * N8 (Director route crossing): a favoured venue whose company score is within 15% of the best
 * (ties included) is chosen instead. Pure: consulted only when a bias is live for this actor and
 * the PC cannot see the choice. The urge's reasons are unchanged; the Ledger explains it once
 * the activity is committed (`settleVenueNudge`).
 */
function tiltVenue(world: World, ctx: SimContext, actorId: ActorId, best: Venue): { venue: Venue; bias: Bias } | null {
  const here = world.actors[actorId]?.placeId;
  const tilt = optionTiltFor(world, 'company_venue', actorId, 'place', here === undefined ? [] : [here]);
  if (!tilt) return null;
  for (const s of tuningOf(ctx.content).seek_company) {
    const act = ctx.content.activities[s.activity];
    if (!act || !activityFits(world, ctx, actorId, act)) continue;
    for (const pid of idsOf<PlaceId>(world.places)) {
      if (pid === best.placeId || !world.places[pid]?.tags.includes(s.tag)) continue;
      const b = tilt(pid);
      if (!b) continue;
      const friends = friendsAt(world, actorId, pid);
      if (friends * 1000 + floorDiv(best.friends * 1000 * b.amount, 1000) < best.friends * 1000) continue;
      return { venue: { activityId: s.activity, placeId: pid, friends, tag: s.tag }, bias: b.bias };
    }
  }
  return null;
}
/**
 * While a Director bias is live for this actor, one already keeping company at a fitting venue
 * stays there rather than leaving the moment the fair gate (the PC now present) hides the bias.
 * Without a live bias this never applies, so undirected runs are unchanged.
 */
function stayingVenue(world: World, ctx: SimContext, actorId: ActorId): Venue | null {
  if (!hasLiveBias(world, 'option', 'company_venue', actorId)) return null;
  const state = world.activity.byActor[actorId];
  const here = world.actors[actorId]?.placeId;
  if (!state || here === undefined || state.placeId !== here || state.travel) return null;
  for (const s of tuningOf(ctx.content).seek_company) {
    if (state.activityId !== s.activity || !world.places[here]?.tags.includes(s.tag)) continue;
    const act = ctx.content.activities[s.activity];
    if (!act || !activityFits(world, ctx, actorId, act)) continue;
    return { activityId: s.activity, placeId: here, friends: friendsAt(world, actorId, here), tag: s.tag };
  }
  return null;
}
/** Where a lonely actor would seek company, with any Director tilt applied (pure; no Ledger). */
export function seekCompanyVenue(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
): { venue: Venue; plain: Venue; bias: Bias | null } | null {
  const plain = plainVenue(world, ctx, actorId);
  if (!plain) return null;
  const stay = stayingVenue(world, ctx, actorId);
  if (stay) return { venue: stay, plain, bias: null };
  const tilted = tiltVenue(world, ctx, actorId, plain);
  return tilted ? { venue: tilted.venue, plain, bias: tilted.bias } : { venue: plain, plain, bias: null };
}
/** The activity system committed `activityId` at `placeId`: record an N8 venue change, if any. */
export function settleVenueNudge(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  activityId: string,
  placeId: PlaceId,
): void {
  if (!hasLiveBias(world, 'option', 'company_venue', actorId)) return;
  const r = seekCompanyVenue(world, ctx, actorId);
  if (!r?.bias || r.venue.activityId !== activityId || r.venue.placeId !== placeId) return;
  if (r.plain.placeId !== placeId) noteNudge(world, r.bias, actorId, r.plain.placeId, placeId);
}

function companyUrge(world: World, ctx: SimContext, actorId: ActorId): UrgeProposal | null {
  const t = tuningOf(ctx.content);
  const company = needValue(world, actorId, 'company');
  if (company >= t.company_seek_below || t.seek_company.length === 0) return null;
  const best = seekCompanyVenue(world, ctx, actorId)?.venue;
  if (!best) return null;
  const intensity = clampInt(floorDiv((t.company_seek_below - company) * 1000, t.company_seek_below), 50, 900);
  const place = world.places[best.placeId];
  return {
    urge: { kind: 'activity', activityId: best.activityId, placeId: best.placeId },
    voice: 'id',
    intensity,
    label:
      best.friends > 0 ? `Lonesome: there's company at the ${place?.name ?? best.tag}` : 'Lonesome: go where folk are',
    source: 'social',
    reasons: [term('need', `Company ${company} (wants company below ${t.company_seek_below})`, intensity)],
    drive: 'longing',
  };
}

/**
 * A debt that has come due is a duty on the debtor's conscience. An actor who settles up by her
 * own volition gets it through the ordinary targeted urge below; one held for orders is never
 * moved to repay by that urge, so the due debt is put to her as a standing duty thought (she may
 * order it) whether or not the creditor is in the room.
 */
function dueDebtDuties(world: World, ctx: SimContext, actorId: ActorId): UrgeProposal[] {
  if (autonomous(world, actorId)) return [];
  const repay = sortedKeys(ctx.content.interactions).find(
    (k) => ctx.content.interactions[k]?.success.settle === 'initiator_debt',
  );
  if (repay === undefined) return [];
  const graceMinutes = (ctx.content.chroniclePatterns?.debt?.params.overdue_days ?? 30) * 1440;
  const out: UrgeProposal[] = [];
  for (const r of world.social.relationships) {
    if (r.kind !== 'creditor' || r.b !== actorId || !r.amountCents || r.amountCents <= 0) continue;
    const late = ctx.now - (r.since + graceMinutes);
    const creditor = world.actors[r.a];
    if (late < 0 || !creditor?.alive) continue;
    const intensity = clampInt(300 + floorDiv(late, 1440) * 20, 300, 700);
    out.push({
      urge: { kind: 'interaction', interactionId: repay, targetId: r.a },
      voice: 'superego',
      intensity,
      label: `Pay what you owe ${shortName(creditor)}`,
      source: 'social',
      reasons: [term('memory', `A debt of ${r.amountCents} cents, due ${floorDiv(late, 1440)} days ago`, intensity)],
      norm: 'duty',
    });
  }
  return out;
}

/** Urges to seek company / confront / repay / court... (proposed to psyche each hour). */
export function proposeSocialUrges(world: World, ctx: SimContext, actorId: ActorId): UrgeProposal[] {
  const actor = world.actors[actorId];
  if (!actor?.alive || isAsleep(world, ctx, actorId)) return [];
  const t = tuningOf(ctx.content);
  const out: UrgeProposal[] = [
    ...dueDebtDuties(world, ctx, actorId),
    ...reliefUrges(world, ctx, actorId),
    ...desperationUrges(world, ctx, actorId),
  ];
  const company = companyUrge(world, ctx, actorId);
  if (company) out.push(company);
  if (t.max_targeted_urges <= 0) return out;
  const here = occupants(world, actor.placeId).filter((o) => o !== actorId && world.actors[o]?.alive === true);
  if (here.length === 0) return out;
  const present = new Set<number>(here);
  const sample = sampleCandidates(
    actorId,
    world.social.opinions[actorId],
    here,
    present,
    (id) => !isAsleep(world, ctx, id),
    ctx.rng('social', SALT_URGE + actorId),
    t.tie_sample,
    0,
  );
  const found: Array<UrgeProposal & { _t: number; _i: string }> = [];
  let digests: ReadonlyMap<ActorId, MemoryDigest> | undefined;
  const getDigests = () => (digests ??= memoryDigests(world, ctx.content, actorId));
  for (const c of sample.candidates) {
    const pair = makePair(world, ctx, actorId, c.id, actor.placeId, here.length - 1);
    if (!pair) continue;
    pair.cache.digests = getDigests;
    for (const def of urgeDefs(ctx)) {
      const u = def.urge;
      if (!u || requiresFail(pair, def, 'spontaneous') !== null) continue;
      const v = volition(pair, def);
      if (v.score < u.min_score) continue;
      const intensity = clampInt(floorDiv(v.score * u.intensity_pct, 10), 0, 1000);
      const tName = shortName(pair.target);
      found.push({
        urge: { kind: 'interaction', interactionId: def.id, targetId: c.id },
        voice: u.voice,
        intensity,
        label: u.label.replaceAll('{target}', tName),
        source: 'social',
        reasons: v.terms,
        ...(u.drive !== undefined ? { drive: u.drive } : {}),
        ...(u.norm !== undefined ? { norm: u.norm } : {}),
        ...(u.spoken_by_target ? { speaker: tName } : {}),
        _t: c.id,
        _i: def.id,
      });
    }
  }
  found.sort((a, b) => b.intensity - a.intensity || a._t - b._t || (a._i < b._i ? -1 : a._i > b._i ? 1 : 0));
  for (const f of found.slice(0, t.max_targeted_urges)) {
    const { _t, _i, ...p } = f;
    out.push(p);
  }
  return out;
}
