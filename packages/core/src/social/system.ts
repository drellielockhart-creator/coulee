/**
 * Social system: runs FOURTH each hour (after activity). OWNER: module:social.
 *
 * Each hour:
 *   1. Daily (00:00): memory decay/forgetting, weekly consolidation, opinion upkeep
 *      (volatile fade, "other" bucket fade, dead Reasons dropped, familiarity fade), label
 *      refresh, cooldown pruning; reset the daily tallies.
 *   2. Chosen urges (psyche/api chosenUrge, made this hour): `interaction` urges run with
 *      their target (or the best one present); `defense` urges discharge through ordinary
 *      interactions (psyche's `acts` for the defense, else social_tuning) at the defense's
 *      target, or the safest person present (displacement, 10 §7).
 *   3. Encounters (04 §11.2): per venue pool from activity/api venues(), every awake actor
 *      draws k initiations from λ‰ = rate × sociability% × venue% / 10000; partners come
 *      from encounter.ts (top ties present + 1 stranger slot; O(n·k)); the interaction is
 *      the best by volition + noise over its threshold.
 */
import { currentActivity, isAsleep, venues } from '../activity/api.ts';
import { hasCondition } from '../actor.ts';
import type { DefenseId, InteractionDef } from '../content.ts';
import type { Explain } from '../explain.ts';
import type { ActorId, PlaceId } from '../ids.ts';
import { needValue } from '../needs/api.ts';
import { autonomous, chosenUrge, defenseActLanded, storedDisplacement } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import type { ChosenUrge } from '../urge.ts';
import type { World } from '../world.ts';
import { sampleCandidates } from './encounter.ts';
import { type InteractionVia, resolveInteraction } from './interact.ts';
import { consolidateMemories, decayMemoriesDaily } from './memory.ts';
import { clampInt, floorDiv } from './model.ts';
import { dailyOpinionUpkeep, opinionOf, pruneCooldowns, refreshLabel, repointReasons } from './opinion.ts';
import { emptyDaily } from './state.ts';
import { dailyStrife, mediationHour } from './strife.ts';
import { tuningOf, valueView } from './tuning.ts';
import { makePair, requiresFail, volition } from './volition.ts';

const SALT_ENCOUNTER = 0xe7c0;
const SALT_PARTNER = 0x9a47;
const SALT_NOISE = 0x701e;

/** Interactions eligible for spontaneous choice, in id order (cached per content bundle). */
let spontaneousCache: { content: unknown; defs: InteractionDef[] } | null = null;
function spontaneousDefs(ctx: SimContext): InteractionDef[] {
  if (spontaneousCache && spontaneousCache.content === ctx.content) return spontaneousCache.defs;
  const defs = Object.keys(ctx.content.interactions)
    .sort()
    .map((k) => ctx.content.interactions[k] as InteractionDef)
    .filter((d) => d !== undefined && !d.urge_only);
  spontaneousCache = { content: ctx.content, defs };
  return defs;
}

interface HourState {
  participations: Map<number, number>;
  initiations: Map<number, number>;
  poolOf: Map<number, { placeId: PlaceId; pool: ActorId[]; present: Set<number> }>;
}

export function socialSystem(world: World, ctx: SimContext): void {
  if (ctx.isNewDay) {
    dailySocial(world, ctx);
    world.social.daily = emptyDaily();
  }
  const t = tuningOf(ctx.content);
  const awake = (id: ActorId): boolean => {
    const a = world.actors[id];
    return a?.alive === true && !isAsleep(world, ctx, id);
  };
  const hs: HourState = { participations: new Map(), initiations: new Map(), poolOf: new Map() };
  const pools: Array<{ placeId: PlaceId; pool: ActorId[]; present: Set<number> }> = [];
  for (const v of venues(world)) {
    const pool = v.actorIds.filter(awake);
    if (pool.length === 0) continue;
    const entry = { placeId: v.placeId, pool, present: new Set<number>(pool) };
    pools.push(entry);
    for (const id of pool) hs.poolOf.set(id, entry);
  }
  // A third party fond of both may talk an estranged pair round (strife.ts).
  mediationHour(world, ctx, pools, hs.poolOf);
  const free = (id: ActorId): boolean => (hs.participations.get(id) ?? 0) < t.max_participations_per_hour;
  const take = (a: ActorId, b: ActorId): void => {
    hs.participations.set(a, (hs.participations.get(a) ?? 0) + 1);
    hs.participations.set(b, (hs.participations.get(b) ?? 0) + 1);
    hs.initiations.set(a, (hs.initiations.get(a) ?? 0) + 1);
  };

  // ---- 2. chosen urges (interaction / defense), ascending actor ids
  const urgeActors = ([...hs.poolOf.keys()] as ActorId[]).sort(
    (a, b) =>
      Number(chosenUrge(world, b)?.voice === 'command') - Number(chosenUrge(world, a)?.voice === 'command') || a - b,
  ) as ActorId[];
  for (const id of urgeActors) {
    const chosen = chosenUrge(world, id);
    if (!chosen || chosen.at !== ctx.now) continue;
    if (chosen.urge.kind !== 'interaction' && chosen.urge.kind !== 'defense') continue;
    if (!free(id)) continue;
    const venue = hs.poolOf.get(id);
    if (!venue) continue;
    runUrge(world, ctx, id, chosen, venue, free, take);
  }

  // ---- 2b. displaced anger stored for someone not there at the time lands when they meet
  // (10 §7.2): within the day, at the first venue they share, before the encounters.
  for (const id of urgeActors) {
    if (!autonomous(world, id)) continue;
    const stored = storedDisplacement(world, id, ctx.now);
    if (!stored || !free(id) || !free(stored.targetId)) continue;
    const venue = hs.poolOf.get(id);
    if (!venue?.present.has(stored.targetId)) continue;
    runStoredDisplacement(world, ctx, id, stored, venue, take);
  }

  // ---- 3. spontaneous encounters per venue
  let work = 0;
  for (const v of pools) {
    if (v.pool.length < 2) continue;
    const place = world.places[v.placeId];
    let venuePct = 100;
    let matched = false;
    for (const vp of t.venue_pct) {
      if (place?.tags.includes(vp.tag) && (!matched || vp.pct > venuePct)) {
        venuePct = vp.pct;
        matched = true;
      }
    }
    for (const id of v.pool) {
      if (!autonomous(world, id)) continue;
      const actor = world.actors[id];
      if (!actor) continue;
      const r = ctx.rng('social', mixKey(id, SALT_ENCOUNTER));
      const lambda = floorDiv(t.encounter_rate_permille * sociabilityPct(world, ctx, id) * venuePct, 10000);
      let k = floorDiv(lambda, 1000) + (r.chancePermille(lambda % 1000) ? 1 : 0);
      k = Math.min(k, t.max_initiations_per_hour - (hs.initiations.get(id) ?? 0));
      for (let n = 0; n < k; n++) {
        if (!free(id)) break;
        const pr = r.fork(SALT_PARTNER + n);
        const sample = sampleCandidates(
          id,
          world.social.opinions[id],
          v.pool,
          v.present,
          free,
          pr,
          t.tie_sample,
          t.stranger_attempts,
        );
        work += sample.work;
        const partner = pr.weighted(sample.candidates, (c) => c.weight);
        if (!partner) break;
        const choice = chooseInteraction(world, ctx, id, partner.id, v, pr.fork(SALT_NOISE));
        if (!choice) continue;
        take(id, partner.id);
        resolveInteraction(world, ctx, {
          def: choice.def,
          initiatorId: id,
          targetId: partner.id,
          placeId: v.placeId,
          present: v.pool.filter((x) => x !== id && x !== partner.id),
          mode: 'spontaneous',
          via: 'encounter',
          choice: choice.explain,
        });
      }
    }
  }
  world.social.daily.encounterWork += work;
  world.social.totals.encounterWork += work;
}

/** Sociability % (04 §11.2): Neighborliness, Company want, drink, the activity's pull. */
export function sociabilityPct(world: World, ctx: SimContext, id: ActorId): number {
  const t = tuningOf(ctx.content);
  const actor = world.actors[id];
  if (!actor) return 0;
  const deficit = floorDiv(1000 - needValue(world, id, 'company'), 100);
  const actId = currentActivity(world, id)?.activityId;
  const actSoc = actId ? (ctx.content.activities[actId]?.sociability ?? 30) : 30;
  const pct =
    100 +
    t.sociability_per_neighborliness * valueView(actor, 'neighborliness') +
    t.sociability_per_company_deficit * deficit +
    (hasCondition(actor, 'drunk') ? t.sociability_drunk : 0) +
    (actSoc - 30) * t.activity_sociability_pct;
  return clampInt(pct, 0, 1000);
}

/** Best spontaneous interaction for the pair by volition + noise, over its threshold. */
function chooseInteraction(
  world: World,
  ctx: SimContext,
  initiator: ActorId,
  target: ActorId,
  venue: { placeId: PlaceId; pool: ActorId[] },
  noise: ReturnType<SimContext['rng']>,
): { def: InteractionDef; explain: Explain } | null {
  const t = tuningOf(ctx.content);
  const pair = makePair(world, ctx, initiator, target, venue.placeId, venue.pool.length - 2);
  if (!pair) return null;
  let best: { def: InteractionDef; score: number; explain: Explain } | null = null;
  const children: Explain[] = [];
  for (const def of spontaneousDefs(ctx)) {
    if (requiresFail(pair, def, 'spontaneous') !== null) continue;
    const v = volition(pair, def);
    const jitter = t.volition_noise > 0 ? noise.int(0, t.volition_noise) : 0;
    const score = v.score + jitter;
    if (score < def.threshold) continue;
    const terms = jitter > 0 ? [...v.terms, { source: 'other', label: 'Whim', value: jitter }] : v.terms;
    const explain: Explain = {
      kind: 'choice',
      label: `${def.name}: why`,
      subjects: [initiator],
      knowledge: 'self',
      terms,
      total: score,
      dc: {
        total: def.threshold,
        terms: [{ source: 'base', label: `Threshold ${def.threshold}`, value: def.threshold }],
      },
      outcome: 'candidate',
    };
    children.push(explain);
    if (!best || score > best.score) best = { def, score, explain };
  }
  if (!best) return null;
  const chosen: Explain = { ...best.explain, outcome: 'chosen' };
  if (children.length > 1) chosen.note = `${children.length} interactions were in the running`;
  return { def: best.def, explain: chosen };
}

function runUrge(
  world: World,
  ctx: SimContext,
  id: ActorId,
  chosen: ChosenUrge,
  venue: { placeId: PlaceId; pool: ActorId[]; present: Set<number> },
  free: (id: ActorId) => boolean,
  take: (a: ActorId, b: ActorId) => void,
): void {
  const t = tuningOf(ctx.content);
  const urge = chosen.urge;
  const others = venue.pool.filter((x) => x !== id && free(x));
  if (others.length === 0) return;
  const presentTarget = (tid: ActorId | undefined): ActorId | null =>
    tid !== undefined && tid !== id && venue.present.has(tid) && free(tid) ? tid : null;
  const go = (
    def: InteractionDef,
    target: ActorId,
    via: InteractionVia,
    extra: Partial<Parameters<typeof resolveInteraction>[2]> = {},
  ): boolean => {
    const pair = makePair(world, ctx, id, target, venue.placeId, venue.pool.length - 2);
    if (!pair || requiresFail(pair, def, 'urge') !== null) return false;
    take(id, target);
    resolveInteraction(world, ctx, {
      def,
      initiatorId: id,
      targetId: target,
      placeId: venue.placeId,
      present: venue.pool.filter((x) => x !== id && x !== target),
      mode: 'urge',
      via,
      choice: plainExplain(chosen.explain),
      ...extra,
    });
    return true;
  };

  if (urge.kind === 'interaction') {
    const def = ctx.content.interactions[urge.interactionId];
    if (!def) return;
    const extra = urge.topic !== undefined ? { topic: urge.topic } : {};
    const target = presentTarget(urge.targetId);
    if (target !== null) {
      go(def, target, 'urge', extra);
      return;
    }
    if (urge.targetId !== undefined) return; // the one they meant is not here
    // Untargeted: the present acquaintance with the highest volition for it.
    let best: { id: ActorId; score: number } | null = null;
    for (const o of others.slice(0, 32)) {
      const pair = makePair(world, ctx, id, o, venue.placeId, venue.pool.length - 2);
      if (!pair || requiresFail(pair, def, 'urge') !== null) continue;
      const s = volition(pair, def).score;
      if (!best || s > best.score) best = { id: o, score: s };
    }
    if (best) go(def, best.id, 'urge', extra);
    return;
  }

  if (urge.kind !== 'defense') return;
  const defense: DefenseId = urge.defense;
  const acts = ctx.content.defenses?.[defense]?.acts ?? [];
  const entry = t.defense_interactions.find((d) => d.defense === defense);
  const list = acts.length > 0 ? acts : (entry?.interactions ?? []);
  if (list.length === 0) return;
  let target = presentTarget(urge.targetId);
  if (target === null) {
    // A defense aimed at someone in particular (projection's suspect, reaction formation's
    // object) does nothing while they are elsewhere: its masked thought waits for a meeting.
    // Only displacement, whose point is a safer substitute, takes it out on someone here.
    if (urge.targetId !== undefined && defense !== 'displacement') return;
    // Displacement onto someone safer: least feared, then least respected, then lowest id.
    let best: { id: ActorId; fear: number; respect: number } | null = null;
    for (const o of others.slice(0, 32)) {
      const op = opinionOf(world, id, o);
      if (!best || op.fear < best.fear || (op.fear === best.fear && op.respect < best.respect)) {
        best = { id: o, fear: op.fear, respect: op.respect };
      }
    }
    target = best?.id ?? null;
  }
  if (target === null) return;
  const defenseReason = entry?.reason ? { label: entry.reason, delta: entry.reason_delta } : undefined;
  for (const iid of list) {
    const def = ctx.content.interactions[iid];
    if (!def) continue;
    if (go(def, target, 'defense', { viaDefense: defense, ...(defenseReason ? { defenseReason } : {}) })) {
      defenseActLanded(world, ctx, id, defense);
      return;
    }
  }
}

/** Run the displaced act a stored anger owes (psyche `displaced`), at its target, here. */
function runStoredDisplacement(
  world: World,
  ctx: SimContext,
  id: ActorId,
  stored: { targetId: ActorId; amount: number; line: string },
  venue: { placeId: PlaceId; pool: ActorId[] },
  take: (a: ActorId, b: ActorId) => void,
): void {
  const t = tuningOf(ctx.content);
  const acts = ctx.content.defenses?.displacement?.acts ?? [];
  const entry = t.defense_interactions.find((d) => d.defense === 'displacement');
  const list = acts.length > 0 ? acts : (entry?.interactions ?? []);
  const defenseReason = entry?.reason ? { label: entry.reason, delta: entry.reason_delta } : undefined;
  const choice: Explain = {
    kind: 'choice',
    label: stored.line || 'Kicking the dog',
    subjects: [id],
    knowledge: 'omniscient',
    terms: [{ source: 'psyche', label: 'Anger stored for this meeting', value: stored.amount }],
    total: stored.amount,
    outcome: 'defense',
  };
  for (const iid of list) {
    const def = ctx.content.interactions[iid];
    if (!def) continue;
    const pair = makePair(world, ctx, id, stored.targetId, venue.placeId, venue.pool.length - 2);
    if (!pair || requiresFail(pair, def, 'urge') !== null) continue;
    take(id, stored.targetId);
    resolveInteraction(world, ctx, {
      def,
      initiatorId: id,
      targetId: stored.targetId,
      placeId: venue.placeId,
      present: venue.pool.filter((x) => x !== id && x !== stored.targetId),
      mode: 'urge',
      via: 'defense',
      choice,
      viaDefense: 'displacement',
      ...(defenseReason ? { defenseReason } : {}),
    });
    defenseActLanded(world, ctx, id, 'displacement');
    return;
  }
}

/**
 * A copy of another module's Explain for embedding in our event, with −0 normalized to 0
 * (JSON cannot carry −0, so a save/load would otherwise not round-trip exactly).
 */
function plainExplain(e: Explain): Explain {
  const fix = (v: unknown): unknown => {
    if (typeof v === 'number') return v === 0 ? 0 : v;
    if (Array.isArray(v)) return v.map(fix);
    if (v !== null && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      for (const k of Object.keys(v)) o[k] = fix((v as Record<string, unknown>)[k]);
      return o;
    }
    return v;
  };
  return fix(e) as Explain;
}

/** 00:00 bookkeeping (04 §4.3, §6.2). Consolidation runs weekly, on Sundays. */
function dailySocial(world: World, ctx: SimContext): void {
  const content = ctx.content;
  decayMemoriesDaily(world, content);
  if (ctx.cal.weekday === 'sun') repointReasons(world, consolidateMemories(world, content));
  dailyOpinionUpkeep(world, content);
  pruneCooldowns(world, ctx.now);
  dailyStrife(world, ctx);
  for (const from of Object.keys(world.social.opinions)
    .map(Number)
    .sort((a, b) => a - b) as ActorId[]) {
    const table = world.social.opinions[from] ?? {};
    for (const k of Object.keys(table)
      .map(Number)
      .sort((a, b) => a - b) as ActorId[]) {
      refreshLabel(world, ctx, from, k);
    }
  }
}
