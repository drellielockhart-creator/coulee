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
import { term } from '../explain.ts';
import { type ActorId, idsOf, type PlaceId } from '../ids.ts';
import { needValue } from '../needs/api.ts';
import { autonomous } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { sampleCandidates } from './encounter.ts';
import { type MemoryDigest, memoryDigests } from './memory.ts';
import { clampInt, floorDiv } from './model.ts';
import { opinionOf } from './opinion.ts';
import { ageYears, tuningOf } from './tuning.ts';
import { makePair, requiresFail, volition } from './volition.ts';

const SALT_URGE = 0x0e6e;

let urgeDefsCache: { content: unknown; defs: InteractionDef[] } | null = null;
function urgeDefs(ctx: SimContext): InteractionDef[] {
  if (urgeDefsCache && urgeDefsCache.content === ctx.content) return urgeDefsCache.defs;
  const defs = Object.keys(ctx.content.interactions)
    .sort()
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

function companyUrge(world: World, ctx: SimContext, actorId: ActorId): UrgeProposal | null {
  const t = tuningOf(ctx.content);
  const company = needValue(world, actorId, 'company');
  if (company >= t.company_seek_below || t.seek_company.length === 0) return null;
  let best: { activityId: string; placeId: PlaceId; friends: number; tag: string } | null = null;
  for (const s of t.seek_company) {
    const act = ctx.content.activities[s.activity];
    if (!act || !activityFits(world, ctx, actorId, act)) continue;
    for (const pid of idsOf<PlaceId>(world.places)) {
      const p = world.places[pid];
      if (!p?.tags.includes(s.tag)) continue;
      let friends = 0;
      for (const o of occupants(world, pid)) {
        if (o !== actorId && opinionOf(world, actorId, o).affection > 0) friends++;
      }
      if (!best || friends > best.friends) best = { activityId: s.activity, placeId: pid, friends, tag: s.tag };
    }
  }
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
  const repay = Object.keys(ctx.content.interactions)
    .sort()
    .find((k) => ctx.content.interactions[k]?.success.settle === 'initiator_debt');
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
  const out: UrgeProposal[] = [...dueDebtDuties(world, ctx, actorId)];
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
  let digests: Map<ActorId, MemoryDigest> | undefined;
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
