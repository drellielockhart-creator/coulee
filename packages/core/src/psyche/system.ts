/**
 * Psyche system: runs SECOND each hour (after needs). OWNER: module:psyche.
 * Design: design-docs/10-psyche.md §4–§8, §14; contract: docs/impl/MODULES.md module:psyche.
 *
 * For each living actor (ascending id):
 *   1. Gather proposals: needs/activity/social/belief/provisions `propose*Urges`, `core.urge`
 *      commands (voice 'command'), and psyche's own thought rules (fallbacks fill gaps the
 *      other modules leave). Weight them into Thoughts (trait voice_pct/urge_bias, appetite,
 *      strictness, drive weights, norm strengths), merge by key, voice norm prohibitions, cap.
 *   2. Ego arbitration (arbitrate.ts) → ChosenUrge with an Explain (kind 'arbitration',
 *      knowledge 'self', children = every option with its score). A command always wins.
 *   3. Compromise (template + ego check) or sublimation (drive frustrated 3+ hours, E ≥ 55).
 *   4. Anxiety: accrual from frustrated thoughts by pool, persona strain, hourly discharge.
 *   5. Defense at anxiety ≥ Θ = 250 + 3E (once an hour at most): emit 'psyche.defense';
 *      projection calls belief.formProjection; displacement, projection and reaction
 *      formation set `chosen` to a { kind: 'defense' } urge that social executes (unless a
 *      command holds the hour: P2, the player's will is never overridden).
 *   6. End-of-hour thought decay.
 *
 * Reaction formation (resolving psyche vs. social content): psyche follows 10 §7.2, the
 * forbidden wish flips into a superego-voiced CRUSADE against its object (preach at,
 * slight), never into ostentatious kindness. Social executes the defense urge with the
 * interactions of its `defense_interactions` row, which must name hostile/exposing acts.
 */
import { currentActivity, minuteBudget, walkMinutes } from '../activity/api.ts';
import { formProjection, suspicionOf } from '../belief/api.ts';
import type { ContentBundle, DefenseId } from '../content.ts';
import type { Explain } from '../explain.ts';
import { type ActorId, idsOf } from '../ids.ts';
import { campContext, campSleepActivity, loadReport, withInventoryPass } from '../items/api.ts';
import { needValue } from '../needs/api.ts';
import { isWaterSource, lodgingPlace } from '../provisions/api.ts';
import { processesActor } from '../region/processing.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { addDefenseReason, areKin, familiarityOf, opinionOf, strifeCount, wearinessPermille } from '../social/api.ts';
import { addMinutes, yearsBetween } from '../time.ts';
import type { ChoiceVoice, ChosenUrge, Urge } from '../urge.ts';
import { sameUrge, urgeLabel } from '../urge.ts';
import type { World } from '../world.ts';
import {
  applyStandingOrders,
  authorizationExplain,
  authorizeAct,
  commandBasis,
  standingOrders,
  standingUrge,
} from './agency.ts';
import {
  accrueAnxiety,
  addToPools,
  anxietyBand,
  defenseThreshold,
  dischargeAmount,
  drainPools,
  egoMod,
  type Frustration,
} from './anxiety.ts';
import {
  type ArbitrationResult,
  arbitrate,
  arbitrationExplain,
  dominantVoice,
  type OptionInput,
  opposes,
  optionsFromThoughts,
  type ScoredOption,
  supports,
} from './arbitrate.ts';
import {
  candidateExplains,
  type DefenseCandidate,
  type DefenseSituation,
  defenseCandidates,
  displacementFit,
  pickDefense,
  projectionFit,
} from './defenses.ts';
import { evalWhen, isPresent, type Mind, mindFor, nameOf, powerOver, presentedTraits } from './mind.ts';
import { type ActorPsyche, clamp, refreshShadowList, type Thought } from './state.ts';
import { buildTagIndex, cmpStr, intersects, optionName, type TagIndex, urgeKey, urgeTags } from './tags.ts';
import {
  type Candidate,
  capThoughts,
  commandProposals,
  decayThoughts,
  externalProposals,
  fillLine,
  mergeCandidate,
  nextThoughtId,
  pickLine,
  prohibitionCandidates,
  proposalCandidate,
  ruleCandidates,
} from './thoughts.ts';

export const SALT_ARB = 0x50a1;
export const SALT_COMPROMISE = 0x50a2;
export const SALT_SUBLIMATE = 0x50a3;
export const SALT_DEFENSE = 0x50a4;

/** Thoughts at or above this intensity surface as 'psyche.thought' events when notable. */
const NOTABLE_MIN = 300;
/** Defenses remembered per actor: enough for a week at the refractory rate (repeat penalties). */
const RECENT_DEFENSES = 24;
/** Displacement pays this share of its relief at once; the rest only when the act lands (10 §7.2). */
const DISPLACE_UPFRONT_PCT = 25;
/** Hours the stored displaced anger waits for its act before it sours (relief lost). */
const DISPLACE_WINDOW_MIN = 24 * 60;
/** DF ×50% per displacement onto the same person in the last week (10 §7.3: it stops working). */
const DF_REPEAT_PCT = 50;
const DF_REPEAT_WINDOW_MIN = 7 * 24 * 60;
/** Familiarity at which someone is a daily face (met within the day; DF Avail 40). */
const DF_DAILY_FAMILIARITY = 500;
/** Youngest a displaced anger may land on. */
const DF_MIN_AGE = 8;
/** Compromise window: the top two within this many points (10 §5.3 "within 20", ×10). */
const COMPROMISE_WINDOW = 200;
/** Satisfaction of a thought passed over for another demand of the same agency (percent). */
const SAME_AGENCY_F = 75;
/** Displacement fit needed for a safer target (10 §7.2 DF). */
const DF_MIN = 30;
/** Drive weight at which frustration alone turns to anger (displacement trigger). */
const CHOLERIC = 60;
/**
 * Style gained per firing (10 §7.1 says +2 at the doc's rarer firing rate; T1 actors near Θ
 * fire several times a week, so +1 keeps habits from swamping temperament within a month).
 */
const STYLE_GAIN = 1;

export function psycheSystem(world: World, ctx: SimContext): void {
  // Proposals read the same inventory throughout this synchronous pass. The item API
  // checks deletions live and invalidates creations/moves; nothing survives the call.
  withInventoryPass(world, () => psychePass(world, ctx));
}

function psychePass(world: World, ctx: SimContext): void {
  for (const cmd of ctx.commands) {
    if (cmd.kind !== 'core.standing_orders') continue;
    applyStandingOrders(world, cmd.actorId, cmd.data);
  }
  const idx = buildTagIndex(ctx.content);
  for (const id of idsOf<ActorId>(world.psyche.byActor)) {
    if (!processesActor(world, id)) continue;
    const p = world.psyche.byActor[id];
    const actor = world.actors[id];
    if (!p) continue;
    if (!actor?.alive) {
      p.chosen = null;
      continue;
    }
    // A daily batch still resolves the routine at each canonical hour. Skipping arbitration
    // makes the calendar win sleep unconditionally and leaves thoughts/anxiety unaged;
    // physiology then correctly accounts for the wrong activity. Use the same decision
    // clock as the shared hourly ledger, water and meal kernels.
    psycheHour(world, ctx, id, idx);
  }
  if (ctx.isNewDay) psycheDaily(world, ctx);
}

/** Drives whose frustration books realistic anxiety (fear). */
function realDrives(content: ContentBundle): Set<string> {
  const s = new Set<string>();
  for (const d of Object.keys(content.drives ?? {}).sort()) if (content.drives[d]?.anxiety_pool === 'real') s.add(d);
  return s;
}

// ---------------------------------------------------------------------------------------------
// One actor-hour
// ---------------------------------------------------------------------------------------------

export function psycheHour(world: World, ctx: SimContext, actorId: ActorId, idx?: TagIndex, minutes?: number): void {
  const m = mindFor(world, ctx, actorId, idx);
  if (!m) return;
  const { p, content } = m;
  const fearDrives = realDrives(content);
  const prevChosen = p.chosen;

  // 1. Thoughts.
  const external = minutes === undefined ? externalProposals(m) : [];
  const commands = commandProposals(m, ctx.commands);
  const candidates: Candidate[] = [
    ...external.map((e) => proposalCandidate(e, 'ext')),
    ...commands.map((c) => proposalCandidate(c, 'cmd')),
    ...(minutes === undefined ? ruleCandidates(m, external) : []),
  ];
  for (const c of candidates) {
    const r = mergeCandidate(world, m, c, ctx.now);
    if (r?.isNew && c.notable && r.thought.intensity >= NOTABLE_MIN) emitThought(m, r.thought);
  }
  for (const c of prohibitionCandidates(m, p.thoughts)) mergeCandidate(world, m, c, ctx.now);
  capThoughts(p);

  // 2. Arbitration.
  const options: OptionInput[] = optionsFromThoughts(p.thoughts).map((u) => ({
    urge: u,
    name: optionName(content, u),
    tags: urgeTags(m.idx, u),
    reality: realityOf(m, u),
  }));
  const lastCmd = commands.length > 0 ? commands[commands.length - 1] : undefined;
  const commandKey = lastCmd ? urgeKey(lastCmd.urge) : undefined;
  const noiseOf = (key: string, amp: number) =>
    ctx.rng('psyche', mixKey(actorId, SALT_ARB, hashString32(key))).int(-amp, amp);
  const res = arbitrate(actorId, p.ego, p.thoughts, options, noiseOf, commandKey);

  let chosenUrge: Urge | null = null;
  let mode = 'plain';
  const sat = new Map<Thought, number>();
  if (res) {
    const held = !authorizeAct(world, actorId, { kind: 'consequential' }, { kind: 'own' }).ok && !lastCmd;
    const allowed = held ? res.ranked.find((o) => standingUrge(world, ctx, actorId, o.urge)) : undefined;
    const out = decide(m, held ? { ...res, winner: allowed ?? res.winner, command: true } : res);
    if (held) {
      out.mode = 'standing';
      out.satisfaction.clear();
      out.urge = allowed?.urge ?? { kind: 'activity', activityId: 'idle_at_home', placeId: m.actor.placeId };
      if (out.urge.kind === 'activity') {
        const camp = campContext(world, content, actorId);
        const campId = campSleepActivity(content);
        const def = content.activities[out.urge.activityId];
        const here = m.actor.placeId;
        // The standing sleep order is entitled to a bed at one's lodgings, paid on arrival; a
        // camper with bedding afield sleeps where they are instead of walking back to pay.
        const payable = !(camp.afield && camp.bedding);
        const bed = standingOrders(world, actorId).lodging
          ? lodgingPlace(world, content, actorId, ctx.now, payable)
          : null;
        const speed = def?.asleep ? loadReport(world, content, actorId).band.speedPct : 100;
        const minutes =
          bed === null || speed === 0 ? 1440 : Math.ceil((walkMinutes(world, content, here, bed) * 100) / speed);
        const reachableBed =
          bed !== null && minutes <= 60 && lodgingPlace(world, content, actorId, ctx.now + minutes, payable) === bed;
        // An urge that already names its place for a reason (water at a spring, a plate waiting
        // at the table) keeps it; only placeless home chores are redirected afield.
        const placed =
          out.urge.placeId !== undefined &&
          ((out.urge.activityId === 'fetch_water' && isWaterSource(world, content, out.urge.placeId)) ||
            def?.tags.includes('meal'));
        if (placed) {
          // keep
        } else if (def?.asleep && reachableBed) out.urge = { ...out.urge, placeId: bed };
        else if (camp.afield && def?.asleep && campId !== null && out.urge.activityId !== campId)
          out.urge = camp.bedding
            ? { kind: 'activity', activityId: campId, placeId: here }
            : { kind: 'activity', activityId: 'idle_at_home', placeId: here };
        else if (camp.afield && def?.at === 'home' && !def.tags.includes('meal'))
          out.urge = { kind: 'activity', activityId: 'idle_at_home', placeId: here };
        else if (camp.afield || !standingOrders(world, actorId).lodging) out.urge = { ...out.urge, placeId: here };
      }
      out.explain = arbitrationExplain(
        actorId,
        'Held for your order; routine standing orders only',
        res,
        allowed?.key ?? '',
        'held for your order',
      );
    }
    chosenUrge = out.urge;
    mode = out.mode;
    for (const [t, f] of out.satisfaction) sat.set(t, f);
    const voice: ChoiceVoice =
      mode === 'command'
        ? 'command'
        : mode === 'compromise' || mode === 'sublimation' || mode === 'standing'
          ? 'ego'
          : ((v) => (v === 'none' ? 'ego' : v))(dominantVoice(out.winner));
    const supporter = [...p.thoughts]
      .filter((t) => supports(t, out.urge))
      .sort((a, b) => b.intensity - a.intensity || a.id - b.id)[0];
    const chosen: ChosenUrge = {
      urge: out.urge,
      voice,
      ...(supporter ? { thoughtId: supporter.id } : {}),
      compromise: mode === 'compromise' || mode === 'sublimation',
      at: ctx.now,
      explain: out.explain,
    };
    if (lastCmd) {
      chosen.explain.children = [
        ...(chosen.explain.children ?? []),
        authorizationExplain(world, actorId, { kind: out.urge.kind }, commandBasis(ctx, actorId, ['core.urge'])),
      ];
    } else if (held && allowed && out.urge.kind === 'activity') {
      const activity = out.urge.activityId;
      const capability = standingOrders(world, actorId).activities.includes(activity)
        ? activity
        : content.activities[activity]?.asleep
          ? 'sleep'
          : activity === 'take_meal'
            ? 'eat_own_stores'
            : activity === 'fetch_water'
              ? 'drink'
              : 'keep_warm';
      chosen.explain.children = [
        ...(chosen.explain.children ?? []),
        authorizationExplain(world, actorId, { kind: capability }, { kind: 'standing', capability }),
      ];
    }
    p.chosen = chosen;
    p.lastMode = mode;
    const ctr = world.psyche.counters;
    if (mode === 'command') ctr.commands = (ctr.commands ?? 0) + 1;
    if (mode === 'compromise') ctr.compromises = (ctr.compromises ?? 0) + 1;
    if (mode === 'sublimation') ctr.sublimations = (ctr.sublimations ?? 0) + 1;
    if (mode === 'impulse') ctr.impulses = (ctr.impulses ?? 0) + 1;
    if (shouldLogArbitration(res, out.winner, mode, prevChosen?.urge ?? null, out.urge)) {
      ctx.emit({
        kind: 'psyche.arbitrated',
        data: {
          actorId,
          urge: urgeLabel(out.urge),
          voice,
          compromise: chosen.compromise,
          rejected: res.ranked.filter((o) => !sameUrge(o.urge, out.urge)).map((o) => urgeLabel(o.urge)),
          mode,
          label: out.explain.label,
        },
        roles: [{ actor: actorId, role: 'agent' }],
        visibility: 'inner',
        ...(mode === 'impulse' ? { importance: 20 } : {}),
        explain: out.explain,
      });
    }
  } else if (!authorizeAct(world, actorId, { kind: 'consequential' }, { kind: 'own' }).ok) {
    chosenUrge = { kind: 'activity', activityId: 'idle_at_home', placeId: m.actor.placeId };
    p.chosen = {
      urge: chosenUrge,
      voice: 'ego',
      compromise: false,
      at: ctx.now,
      explain: {
        kind: 'arbitration',
        label: 'Held for your order',
        subjects: [actorId],
        knowledge: 'self',
        terms: [],
        total: 0,
        outcome: 'held for your order',
      },
    };
    p.lastMode = 'standing';
  } else {
    p.chosen = null;
    p.lastMode = 'none';
  }

  // Short orders hear the current voices; only their fraction of override anxiety accrues.
  // Decay, defenses, habituation and discharge remain on the single hourly pass.
  if (minutes !== undefined) {
    const frustrated = p.thoughts
      .filter((t) => !supports(t, chosenUrge ?? { kind: 'activity', activityId: 'idle_at_home' }))
      .map((thought) => ({ thought, f: 0 }));
    const liveFear = p.thoughts.filter((t) => t.voice === 'id' && t.drive !== undefined && fearDrives.has(t.drive));
    const acc = accrueAnxiety(p, frustrated, fearDrives, liveFear);
    addToPools(p, {
      real: Math.round((acc.add.real * minutes) / 60),
      neur: Math.round((acc.add.neur * minutes) / 60),
      moral: Math.round((acc.add.moral * minutes) / 60),
    });
    return;
  }

  // 3. Frustration and anxiety.
  bookFrustration(m, chosenUrge, sat, fearDrives, res);
  personaStrain(m);
  discharge(m, mode);

  // 4. Defenses.
  maybeDefend(
    m,
    fearDrives,
    mode === 'command' || !authorizeAct(world, actorId, { kind: 'consequential' }, { kind: 'own' }).ok,
  );

  // 5. End of hour.
  decayThoughts(p);
}

function emitThought(m: Mind, t: Thought): void {
  m.ctx.emit({
    kind: 'psyche.thought',
    data: {
      actorId: m.actorId,
      thoughtId: t.id,
      voice: t.voice,
      label: t.label,
      intensity: t.intensity,
      ...(t.line !== undefined ? { line: t.line } : {}),
      ...(t.targetId !== undefined ? { targetId: t.targetId } : {}),
    },
    roles: [
      { actor: m.actorId, role: 'agent' },
      ...(t.targetId !== undefined ? [{ actor: t.targetId, role: 'subject' as const }] : []),
    ],
    visibility: 'inner',
    explain: {
      kind: 'formula',
      label: t.label,
      subjects: [m.actorId],
      knowledge: 'self',
      terms: t.reasons.map((term) => ({ ...term })),
      total: t.intensity,
      outcome: 'surfaced',
    },
  });
}

/**
 * R(o), the reality appraisal (10 §5.2), −1000..1000:
 *   relieves a need below its threshold   + floor((at − value) × 300 / at)
 *   the schedule's call this hour          + 100
 *   already doing it                       + 50
 *   the other person is here / isn't       + 50 / − 300
 */
/** Midnight to this hour, the sleep-pressure term applies when the calendar says bed. */
const NIGHT_END_HOUR = 5;
/** Base weight of sleep pressure in the small hours (plus half the rest deficit). */
const NIGHT_BASE = 300;

export function realityOf(m: Mind, u: Urge): Array<{ source: string; label: string; value: number }> {
  const terms: Array<{ source: string; label: string; value: number }> = [];
  const tags = urgeTags(m.idx, u);
  if (u.kind === 'activity') {
    const act = m.content.activities[u.activityId];
    const at = new Map<string, number>();
    const driveRelief = new Set<string>();
    for (const did of Object.keys(m.content.drives ?? {}).sort()) {
      const d = m.content.drives[did];
      if (!d) continue;
      const relieves = intersects(d.relief_tags, tags);
      for (const n of d.needs) {
        at.set(n.need, Math.max(at.get(n.need) ?? 0, n.at));
        if (relieves) driveRelief.add(n.need);
      }
    }
    for (const nid of Object.keys(m.content.needs ?? {}).sort()) {
      const thr = at.get(nid) ?? 500;
      const v = needValue(m.world, m.actorId, nid);
      if (v >= thr) continue;
      const direct = (act?.needs[nid] ?? 0) > 0;
      if (!direct && !driveRelief.has(nid)) continue;
      const add = Math.floor(((thr - v) * 300) / thr);
      if (add > 0) terms.push({ source: 'need', label: `Relieves ${m.content.needs[nid]?.name ?? nid}`, value: add });
    }
    if (m.block?.activity === u.activityId) terms.push({ source: 'policy', label: 'The hour for it', value: 100 });
    // The small hours (05 §6.4): when one's own calendar says bed and it is past midnight, sleep
    // pressure outweighs most wants. Getting up needs a strong reason (a command always wins).
    const bedtime = m.block !== null && m.content.activities[m.block.activity]?.asleep === true;
    if (bedtime && m.cal.hour < NIGHT_END_HOUR) {
      const rest = needValue(m.world, m.actorId, 'rest');
      const pressure = NIGHT_BASE + Math.floor(Math.max(0, 1000 - rest) / 2);
      if (act?.asleep) terms.push({ source: 'need', label: 'The dead of night: bed', value: Math.floor(pressure / 2) });
      else terms.push({ source: 'need', label: 'The dead of night: stay abed', value: -pressure });
    }
    if (currentActivity(m.world, m.actorId)?.activityId === u.activityId) {
      terms.push({ source: 'psyche', label: 'Already at it', value: 50 });
    }
  } else if (u.targetId !== undefined) {
    const t = m.world.actors[u.targetId];
    if (!t?.alive) terms.push({ source: 'place', label: 'Gone', value: -1000 });
    else if (isPresent(m, u.targetId))
      terms.push({ source: 'place', label: `${nameOf(m, u.targetId)} is here`, value: 50 });
    else terms.push({ source: 'place', label: `${nameOf(m, u.targetId)} isn't here`, value: -300 });
  }
  return terms;
}

interface Decision {
  urge: Urge;
  mode: string;
  winner: ScoredOption;
  explain: Explain;
  /** Satisfaction (f, percent) granted to thoughts by a compromise or sublimation. */
  satisfaction: Map<Thought, number>;
}

/** Plain win, command, compromise (10 §5.3), sublimation (10 §5.3), or impulse (10 §5.4). */
function decide(m: Mind, res: ArbitrationResult): Decision {
  const { p, actorId, ctx, content } = m;
  const satisfaction = new Map<Thought, number>();
  const w = res.winner;
  if (res.command) {
    const explain = arbitrationExplain(
      actorId,
      `Resolved: ${w.name}`,
      res,
      w.key,
      'command',
      [],
      'A command holds the hour: the voices are heard, and overruled.',
    );
    return { urge: w.urge, mode: 'command', winner: w, explain, satisfaction };
  }
  const band = anxietyBand(p.anxiety);
  const em = egoMod(p.ego);

  // Compromise: the top two within the window and voiced by opposite agencies, or the winner
  // opposed by the other agency; a template links them; d20 + egoMod − band ≥ 10 + tension/100.
  const second = res.ranked[1];
  let idOpt: ScoredOption | null = null;
  let seOpt: ScoredOption | null = null;
  if (second && w.score - second.score <= COMPROMISE_WINDOW) {
    const vw = dominantVoice(w);
    const vs = dominantVoice(second);
    if (vw === 'id' && vs === 'superego') [idOpt, seOpt] = [w, second];
    else if (vw === 'superego' && vs === 'id') [idOpt, seOpt] = [second, w];
  }
  if (!idOpt && dominantVoice(w) === 'id' && w.superegoOpposition >= 150) idOpt = w;
  if (idOpt) {
    const idDrives = new Set(idOpt.supporters.filter((t) => t.voice === 'id').map((t) => t.drive ?? ''));
    const seNorms = new Set<string>();
    for (const t of seOpt?.supporters ?? []) if (t.voice === 'superego' && t.norm) seNorms.add(t.norm);
    for (const t of idOpt.opposers) if (t.voice === 'superego' && t.norm) seNorms.add(t.norm);
    const idTags = urgeTags(m.idx, idOpt.urge);
    const seTags = seOpt ? urgeTags(m.idx, seOpt.urge) : [];
    for (const cid of Object.keys(content.compromises ?? {}).sort()) {
      const c = content.compromises[cid];
      if (!c) continue;
      const idHit = c.id_side.drives.some((d) => idDrives.has(d)) || intersects(c.id_side.tags, idTags);
      const seHit = c.superego_side.norms.some((n) => seNorms.has(n)) || intersects(c.superego_side.tags, seTags);
      if (!idHit || !seHit) continue;
      let urge: Urge | null = null;
      if (c.result.kind === 'side') urge = c.result.side === 'id' ? idOpt.urge : (seOpt?.urge ?? null);
      else if (c.result.kind === 'activity') urge = { kind: 'activity', activityId: c.result.id };
      else {
        const tid = idOpt.urge.kind !== 'activity' ? idOpt.urge.targetId : undefined;
        urge = {
          kind: 'interaction',
          interactionId: c.result.id,
          ...(c.result.target === 'id_target' && tid !== undefined ? { targetId: tid } : {}),
        };
      }
      if (!urge) continue;
      const tension = Math.min(idOpt.idSupport, (seOpt?.superegoSupport ?? 0) + idOpt.superegoOpposition);
      const dc = 10 + Math.floor(tension / 100);
      const roll = ctx.rng('psyche', mixKey(actorId, SALT_COMPROMISE)).d20();
      const total = roll + em - band;
      const check: Explain = {
        kind: 'check',
        label: `Self-Command: ${c.label}`,
        subjects: [actorId],
        knowledge: 'self',
        roll: { die: 20, natural: roll },
        terms: [
          { source: 'psyche', label: `Self-Command (ego ${p.ego})`, value: em },
          { source: 'psyche', label: `Nerves (band ${band})`, value: 0 - band },
        ],
        total,
        dc: {
          total: dc,
          terms: [
            { source: 'base', label: 'Base', value: 10 },
            { source: 'psyche', label: `Tension ${tension}`, value: dc - 10 },
          ],
        },
        margin: total - dc,
        outcome: total >= dc ? 'success' : 'failure',
      };
      if (total < dc) {
        const explain = arbitrationExplain(actorId, `${w.name}`, res, w.key, 'chosen', [check]);
        return { urge: w.urge, mode: 'plain', winner: w, explain, satisfaction };
      }
      for (const t of p.thoughts) {
        if (t.voice === 'id') satisfaction.set(t, c.id_pct);
        else if (t.voice === 'superego') satisfaction.set(t, c.superego_pct);
      }
      const explain = arbitrationExplain(actorId, c.label, res, urgeKey(urge), 'compromise', [check]);
      return { urge, mode: 'compromise', winner: w, explain, satisfaction };
    }
  }

  // Sublimation: a drive this choice frustrates has been frustrated 3+ hours; E ≥ 55 (or a
  // sublimating temperament); a template fits; d20 + egoMod ≥ 12.
  const frustratedDrives = new Set<string>();
  for (const t of p.thoughts) {
    if (t.voice !== 'id' || t.drive === undefined || t.intensity < 150) continue;
    if (!supports(t, w.urge)) frustratedDrives.add(t.drive);
  }
  const ready = [...frustratedDrives]
    .filter((d) => (p.frustration[d] ?? 0) + 1 >= 3)
    .sort((a, b) => (p.frustration[b] ?? 0) - (p.frustration[a] ?? 0) || cmpStr(a, b));
  const canSublimate = p.ego >= 55 || (p.defenseStyle.sublimation ?? 0) >= 15;
  if (canSublimate) {
    for (const d of ready) {
      const tpl = sublimationFor(m, d);
      if (!tpl) continue;
      const roll = ctx.rng('psyche', mixKey(actorId, SALT_SUBLIMATE, hashString32(d))).d20();
      const total = roll + em;
      const check: Explain = {
        kind: 'check',
        label: `Putting it to work: ${tpl.label}`,
        subjects: [actorId],
        knowledge: 'self',
        roll: { die: 20, natural: roll },
        terms: [{ source: 'psyche', label: `Self-Command (ego ${p.ego})`, value: em }],
        total,
        dc: { total: 12, terms: [{ source: 'base', label: 'Base', value: 12 }] },
        margin: total - 12,
        outcome: total >= 12 ? 'success' : 'failure',
      };
      if (total < 12) continue;
      const urge = tpl.urge;
      for (const t of p.thoughts) if (t.drive === d) satisfaction.set(t, 100);
      p.frustration[d] = 0;
      const explain = arbitrationExplain(actorId, tpl.label, res, urgeKey(urge), 'sublimation', [check]);
      return { urge, mode: 'sublimation', winner: w, explain, satisfaction };
    }
  }

  const mode = res.impulse ? 'impulse' : 'plain';
  const explain = arbitrationExplain(
    actorId,
    mode === 'impulse' ? `Something came over them: ${w.name}` : w.name,
    res,
    w.key,
    'chosen',
  );
  return { urge: w.urge, mode, winner: w, explain, satisfaction };
}

function sublimationFor(m: Mind, drive: string): { label: string; urge: Urge; id: string } | null {
  for (const sid of Object.keys(m.content.sublimations ?? {}).sort()) {
    const s = m.content.sublimations[sid];
    if (!s || s.drive !== drive) continue;
    if (!evalWhen(m, s.when).ok) continue;
    const urge: Urge =
      s.urge.kind === 'activity'
        ? { kind: 'activity', activityId: s.urge.id }
        : { kind: 'interaction', interactionId: s.urge.id };
    return { label: s.label, urge, id: sid };
  }
  return null;
}

/** Log only real conflicts or changes of course (keep the log lean). */
function shouldLogArbitration(
  res: ArbitrationResult,
  winner: ScoredOption,
  mode: string,
  prev: Urge | null,
  next: Urge,
): boolean {
  if (mode !== 'plain') return true;
  const changed = prev === null || !sameUrge(prev, next);
  if (!changed) return false;
  const second = res.ranked[1];
  const close = second !== undefined && winner.score - second.score <= 300;
  const opposedVoices = second !== undefined && dominantVoice(second) !== dominantVoice(winner);
  return (close && opposedVoices) || winner.superegoOpposition + winner.idOpposition >= 150;
}

// ---------------------------------------------------------------------------------------------
// Frustration, anxiety, persona
// ---------------------------------------------------------------------------------------------

function bookFrustration(
  m: Mind,
  chosen: Urge | null,
  sat: Map<Thought, number>,
  fearDrives: ReadonlySet<string>,
  res: ArbitrationResult | null,
): void {
  const { p, content, ctx } = m;
  const frustrated: Frustration[] = [];
  const satisfiedDrives = new Set<string>();
  const frustratedDrives = new Set<string>();
  const chosenTags = chosen ? urgeTags(m.idx, chosen) : [];
  // Anxiety comes from conflict BETWEEN the agencies (10 §0, §6): a duty passed over for
  // another duty, or one appetite for another, is mostly placated (f ≥ 75).
  let chosenBySuperego = false;
  let chosenById = false;
  if (chosen) {
    for (const t of p.thoughts) {
      if (!supports(t, chosen)) continue;
      if (t.voice === 'superego') chosenBySuperego = true;
      else if (t.voice === 'id') chosenById = true;
    }
  }
  for (const t of p.thoughts) {
    if ((t.stance ?? 'for') === 'aside') continue;
    let f = sat.get(t) ?? 0;
    if ((t.stance ?? 'for') === 'for') {
      if (t.voice === 'superego' && chosenBySuperego) f = Math.max(f, SAME_AGENCY_F);
      if (t.voice === 'id' && chosenById) f = Math.max(f, SAME_AGENCY_F);
    }
    let lost: boolean;
    if ((t.stance ?? 'for') === 'for') lost = chosen === null || !supports(t, chosen);
    else lost = chosen !== null && opposes(t, chosen, chosenTags);
    if (lost && f < 100) {
      frustrated.push({ thought: t, f });
      if (t.voice === 'id' && t.drive !== undefined && t.intensity >= 150) frustratedDrives.add(t.drive);
    } else if (t.voice === 'id' && t.drive !== undefined) satisfiedDrives.add(t.drive);
  }
  // Only arbitrations with a real contest book anxiety; with no options nothing was refused.
  if (res) {
    const liveFear = p.thoughts.filter((t) => t.voice === 'id' && t.drive !== undefined && fearDrives.has(t.drive));
    const acc = accrueAnxiety(p, frustrated, fearDrives, liveFear);
    const remaining = minuteBudget(m.world, m.actorId).remaining;
    addToPools(p, {
      real: Math.round((acc.add.real * remaining) / 60),
      neur: Math.round((acc.add.neur * remaining) / 60),
      moral: Math.round((acc.add.moral * remaining) / 60),
    });
  }
  // Habituation counters, after accrual (it reads the previous count).
  const lostSet = new Set(frustrated.map((x) => x.thought));
  for (const t of p.thoughts) t.frustrated = lostSet.has(t) ? Math.min(999, (t.frustrated ?? 0) + 1) : 0;

  // Drive streaks (sublimation, defenses).
  for (const d of Object.keys(p.frustration).sort()) {
    if (!frustratedDrives.has(d)) delete p.frustration[d];
  }
  for (const d of [...frustratedDrives].sort()) {
    if (satisfiedDrives.has(d)) delete p.frustration[d];
    else p.frustration[d] = Math.min(999, (p.frustration[d] ?? 0) + 1);
  }

  // Forbidden wishes toward one person (reaction formation), and the Shadow they charge
  // (each drive counts once an hour).
  const counted = new Set<string>();
  for (const x of frustrated) {
    const t = x.thought;
    if (t.voice !== 'id' || t.drive === undefined || t.intensity < 150 || counted.has(t.drive)) continue;
    const drive = content.drives[t.drive];
    if (!drive?.forbidden) continue;
    counted.add(t.drive);
    if (t.targetId !== undefined) {
      const cur = p.wishes[t.drive];
      if (!cur || cur.targetId !== t.targetId) p.wishes[t.drive] = { targetId: t.targetId, count: 1 };
      else cur.count = Math.min(999, cur.count + 1);
    }
    // The Shadow grows slowly (+1 per 6 hours of a 3+ hour streak) on a trait the actor does
    // not show the world: high Id activity a strict conscience will not own (10 §8.2).
    const streak = p.frustration[t.drive] ?? 0;
    if (streak >= 3 && streak % 6 === 0 && p.superego >= 50) {
      const trait = drive.shadow_traits[0];
      if (trait !== undefined && !presentedTraits(m.world, m.actorId).includes(trait)) {
        p.shadowCharge[trait] = clamp((p.shadowCharge[trait] ?? 0) + 1, 0, 100);
        refreshShadowList(p);
      }
    }
  }
  for (const d of [...satisfiedDrives].sort()) delete p.wishes[d];

  // Acts against conscience (rationalization's trigger): the chosen option defied a voiced
  // prohibition, or a strong duty went undone.
  if (chosen) {
    const defied = frustrated
      .filter(
        (x) =>
          x.thought.voice === 'superego' &&
          x.thought.intensity >= 150 &&
          ((x.thought.stance ?? 'for') === 'against' || x.thought.intensity >= 300),
      )
      .sort((a, b) => b.thought.intensity - a.thought.intensity || a.thought.id - b.thought.id)[0];
    if (defied && defied.thought.norm !== undefined) {
      const tid = chosen.kind !== 'activity' ? (chosen.targetId ?? null) : null;
      p.lastTransgression = { at: ctx.now, norm: defied.thought.norm, targetId: tid };
    }
  }
}

/**
 * Persona strain (10 §8.1): wearing a mask in public costs moral anxiety,
 * floor(strain × (100 − control) / 400) an hour; strain = 20 per masked difference (≤ 100).
 */
function personaStrain(m: Mind): void {
  const { p, actor, content } = m;
  if (p.personaTraits.length === 0 || m.audience === 0) return;
  let diff = 0;
  for (const t of p.personaTraits) if (!actor.traits.includes(t)) diff++;
  for (const t of actor.traits) {
    if (p.personaTraits.includes(t)) continue;
    const excluded = p.personaTraits.some(
      (pt) => content.traits[pt]?.excludes.includes(t) || content.traits[t]?.excludes.includes(pt),
    );
    if (excluded) diff++;
  }
  const strain = Math.min(100, 20 * diff);
  const add = Math.floor((strain * (100 - p.personaControl)) / 400);
  if (add > 0) addToPools(p, { moral: add });
}

/**
 * Hourly discharge (10 §6), rate r (per mille) by what the actor is doing: base 10, sleep 40,
 * company 20, prayer 25 (piety ≥ 40), drink 50, sublimated work 30.
 */
function discharge(m: Mind, mode: string): void {
  const { p, content, world, actorId } = m;
  const act = currentActivity(world, actorId)?.activityId;
  const def = act ? content.activities[act] : undefined;
  const tags = act ? (m.idx.activity.get(act) ?? []) : [];
  let r = 10;
  if (def?.asleep) r = Math.max(r, 40);
  if ((def?.sociability ?? 0) >= 40 || tags.includes('company')) r = Math.max(r, 20);
  if (tags.includes('worship') && (p.norms.piety ?? 50) >= 40) r = Math.max(r, 25);
  if (tags.includes('drink')) r = Math.max(r, 50);
  if (mode === 'sublimation') r = Math.max(r, 30);
  drainPools(p, dischargeAmount(p.anxiety, p.ego, r));
}

// ---------------------------------------------------------------------------------------------
// Defenses (10 §7)
// ---------------------------------------------------------------------------------------------

export function defenseSituation(m: Mind, fearDrives: ReadonlySet<string>): DefenseSituation {
  const { p, content, world, actorId, actor } = m;
  const now = m.ctx.now;
  // Projection: the most charged disowned trait, onto the best-fitting acquaintance.
  let projection: DefenseSituation['projection'] = null;
  const needShadow = content.defenses?.projection?.needs_shadow ?? 30;
  const traits = Object.keys(p.shadowCharge)
    .filter((t) => (p.shadowCharge[t] ?? 0) >= needShadow)
    .sort((a, b) => (p.shadowCharge[b] ?? 0) - (p.shadowCharge[a] ?? 0) || cmpStr(a, b));
  const trait = traits[0];
  if (trait !== undefined) {
    let drive: string | null = null;
    for (const did of Object.keys(content.drives ?? {}).sort()) {
      if (content.drives[did]?.shadow_traits.includes(trait) && (p.frustration[did] ?? 0) >= 1) {
        drive = did;
        break;
      }
    }
    const hidden =
      p.personaTraits.length > 0 &&
      (!p.personaTraits.includes(trait) ||
        p.personaTraits.some((pt) => content.traits[pt]?.excludes.includes(trait) === true));
    let best: { id: ActorId; pf: number } | null = null;
    for (const c of m.known) {
      const shows = presentedTraits(world, c);
      const H = shows.includes(trait)
        ? 100
        : shows.some((s) => content.traits[s]?.excludes.includes(trait) || content.traits[trait]?.excludes.includes(s))
          ? 0
          : 30;
      const other = world.actors[c];
      if (!other) continue;
      const Out =
        other.presentsAsId !== actor.presentsAsId
          ? 100
          : areKin(world, actorId, c)
            ? 0
            : other.householdId !== actor.householdId
              ? 30
              : 0;
      const op = opinionOf(world, actorId, c);
      const pf = projectionFit({
        H,
        Odd: clamp(suspicionOf(world, actorId, c), 0, 100),
        Out,
        Dis: op.affection < 0 ? 100 : 0,
        Weak: 100 - powerOver(m, c, op),
      });
      if (pf < 30) continue;
      if (!best || pf > best.pf || (pf === best.pf && c < best.id)) best = { id: c, pf };
    }
    if (best) projection = { targetId: best.id, trait, drive, pf: best.pf, hidden };
  }

  // Displacement: anger at a blocked object, out on someone safer who is here.
  const displaceableDrives = Object.keys(content.drives ?? {})
    .sort()
    .filter((d) => content.drives[d]?.displaceable);
  // Frustration itself feeds Choler (10 §3.2): a choleric temper (rage weight ≥ 60) with
  // neurotic anxiety banked is ready to kick the dog even without a named grievance.
  const choleric = displaceableDrives.some(
    (d) => (p.drives[d] ?? 50) >= CHOLERIC && content.drives[d]?.anxiety_pool !== 'real',
  );
  // Stored anger that found no one to land on within the day has soured (its relief is lost).
  if (p.displaced?.until !== undefined && p.displaced.until < now) p.displaced = null;
  const displaceable =
    displaceableDrives.some((d) => (p.frustration[d] ?? 0) >= 1) ||
    (p.displaced?.amount ?? 0) > 0 ||
    (choleric && p.anxSrc.neur >= 100);
  let blockedId: ActorId | null = p.displaced?.objectId ?? null;
  const angry = p.thoughts
    .filter(
      (t) =>
        t.voice === 'id' &&
        t.drive !== undefined &&
        displaceableDrives.includes(t.drive) &&
        t.targetId !== undefined &&
        (t.frustrated ?? 0) >= 1,
    )
    .sort((a, b) => b.intensity - a.intensity || a.id - b.id)[0];
  if (angry?.targetId !== undefined) {
    const pw = powerOver(m, angry.targetId);
    if (pw >= 50 || !isPresent(m, angry.targetId)) blockedId = angry.targetId;
  }
  let displacement: DefenseSituation['displacement'] = null;
  if (displaceable) {
    const ceiling = blockedId !== null ? Math.max(1, powerOver(m, blockedId)) : 60;
    const blocked = blockedId !== null ? world.actors[blockedId] : undefined;
    let best: { id: ActorId; df: number; rank: number } | null = null;
    // Anyone known who is here now (Avail 100) or under the same roof (60, met by evening);
    // others are skipped (10 §7.2). An absent housemate stores the grievance for the meeting.
    for (const c of m.known) {
      if (c === blockedId) continue;
      // Hard words need someone old enough to take them (no slighting the baby).
      const cAct = world.actors[c];
      if (!cAct || yearsBetween(cAct.born, now) < DF_MIN_AGE) continue;
      const op = opinionOf(world, actorId, c);
      const pw = powerOver(m, c, op);
      if (pw > ceiling) continue; // no stronger than the true object (the son for the wife)
      const other = world.actors[c];
      if (!other) continue;
      const Sim = !blocked
        ? 50
        : other.householdId === blocked.householdId || other.occupationId === blocked.occupationId
          ? 100
          : 0;
      // Here now 100; under the same roof 60 (met by evening); a workmate or a daily face 40
      // (met tomorrow at the latest); anyone else 0. Anger stored for someone not met within the
      // day sours unspent (its relief is lost), so the near and the daily are the usual marks.
      const work = world.activity.byActor[actorId]?.workplaceId ?? null;
      const Avail = isPresent(m, c)
        ? 100
        : other.householdId === actor.householdId
          ? 60
          : (work !== null && world.activity.byActor[c]?.workplaceId === work) ||
              familiarityOf(world, actorId, c) >= DF_DAILY_FAMILIARITY
            ? 40
            : 0;
      const df = displacementFit({ Sim, Weak: 100 - pw, Avail, Dis: op.affection < 0 ? 100 : 0 });
      // Kin at home qualify (Weak 50 + Avail): harsh words at home are the classic case.
      if (df < DF_MIN) continue;
      // Choosing among the fit: the same scapegoat wears thin (×50% per use this week), and so
      // does a live quarrel (social strife weariness). Fit decides whether; this decides whom.
      // An absent mark is a poor one: anger kept for someone not met within the day sours unspent.
      let rank = Math.floor((df * (40 + (60 * Avail) / 100)) / 100);
      for (const r of p.recentDefenses) {
        if (r.defense === 'displacement' && r.targetId === c && now - r.at < DF_REPEAT_WINDOW_MIN) {
          rank = Math.floor((rank * DF_REPEAT_PCT) / 100);
        }
      }
      const n = strifeCount(world, content, actorId, c, now);
      if (n > 0) rank = Math.floor((rank * wearinessPermille(content, n)) / 1000);
      if (!best || rank > best.rank || (rank === best.rank && c < best.id)) best = { id: c, df, rank };
    }
    if (best) displacement = { targetId: best.id, blockedId, df: best.df, choleric };
  }

  // Reaction formation: a forbidden wish toward one person, repeated.
  let wish: DefenseSituation['wish'] = null;
  for (const d of Object.keys(p.wishes).sort()) {
    const w = p.wishes[d];
    if (!w || w.count < 3 || world.actors[w.targetId]?.alive !== true) continue;
    if (!wish || w.count > wish.count) wish = { targetId: w.targetId, drive: d, count: w.count };
  }
  const forbiddenStreak =
    Object.keys(p.frustration)
      .sort((a, b) => (p.frustration[b] ?? 0) - (p.frustration[a] ?? 0) || cmpStr(a, b))
      .find((d) => content.drives[d]?.forbidden === true && (p.frustration[d] ?? 0) >= 3) ?? null;

  let sublimation: DefenseSituation['sublimation'] = null;
  for (const d of Object.keys(p.frustration).sort()) {
    if ((p.frustration[d] ?? 0) < 1) continue;
    const tpl = sublimationFor(m, d);
    if (tpl) {
      sublimation = { drive: d, templateId: tpl.id };
      break;
    }
  }
  const fearLive = p.thoughts.some(
    (t) => t.voice === 'id' && t.drive !== undefined && fearDrives.has(t.drive) && t.intensity >= 150,
  );
  return { now, projection, displacement, wish, forbiddenStreak, sublimation, displaceable, fearLive };
}

/**
 * A discharged mind needs time before it reaches for another defense (10 §7.1 tuning): without a
 * refractory hour count, an anxious actor defended every other hour and the village was all
 * displaced insults. Defenses still fire on a bad day; they no longer fire all day.
 */
const DEFENSE_REFRACTORY_MINUTES = 8 * 60;

function maybeDefend(m: Mind, fearDrives: ReadonlySet<string>, commandHolds: boolean): void {
  const { p, ctx, actorId, content } = m;
  const theta = defenseThreshold(p.ego);
  if (p.anxiety < theta) return;
  if (p.lastDefenseAt !== null && ctx.now - p.lastDefenseAt < DEFENSE_REFRACTORY_MINUTES) return;
  const sit = defenseSituation(m, fearDrives);
  const cands = defenseCandidates(content, p, sit);
  const pick = pickDefense(cands, ctx.rng('psyche', mixKey(actorId, SALT_DEFENSE)));
  if (!pick) return;
  fireDefense(m, pick, cands, sit, theta, commandHolds);
}

/** The norm that most strongly forbids what a drive seeks (for reaction formation's crusade). */
function opposingNorm(m: Mind, drive: string): string | undefined {
  const d = m.content.drives[drive];
  let best: { id: string; s: number } | undefined;
  for (const nid of Object.keys(m.content.norms ?? {}).sort()) {
    const n = m.content.norms[nid];
    if (!n) continue;
    const hit = n.forbids.some((f) => intersects(f.tags, d?.relief_tags ?? []));
    if (!hit) continue;
    const s = m.p.norms[nid] ?? n.base;
    if (!best || s > best.s) best = { id: nid, s };
  }
  return best?.id;
}

function fireDefense(
  m: Mind,
  pick: DefenseCandidate,
  cands: readonly DefenseCandidate[],
  sit: DefenseSituation,
  theta: number,
  commandHolds: boolean,
): void {
  const { p, ctx, actorId, content, world } = m;
  const def = pick.def;
  const id: DefenseId = pick.id;
  const before = p.anxiety;
  let targetId: ActorId | null = null;
  let trait: string | undefined;
  let act: Urge | null = null;
  /** A defense urge kept for later (displacement onto someone not here yet). */
  let stored: Urge | null = null;
  const voiceOf: Record<string, 'id' | 'superego'> = {
    projection: 'superego',
    reaction_formation: 'superego',
    rationalization: 'superego',
  };
  let masked: { stance: 'for' | 'against' | 'aside'; intensity: number; norm?: string; against?: string[] } = {
    stance: 'aside',
    intensity: def.relief,
  };
  const scale = (pred: (t: Thought) => boolean, num: number, den: number) => {
    for (const t of p.thoughts) {
      if (!pred(t)) continue;
      const next = Math.floor((t.intensity * num) / den);
      t.reasons.push({ source: 'psyche', label: def.period_label, value: next - t.intensity });
      t.intensity = next;
    }
    p.thoughts = p.thoughts.filter((t) => t.intensity > 0);
  };
  const charge = (tr: string | undefined, n: number) => {
    // Only a trait the actor does not show the world can be disowned (10 §8.2).
    if (tr === undefined || presentedTraits(world, actorId).includes(tr)) return;
    p.shadowCharge[tr] = clamp((p.shadowCharge[tr] ?? 0) + n, 0, 100);
    refreshShadowList(p);
  };

  switch (id) {
    case 'repression': {
      // Push down the loudest thought of the troubling pool's voice.
      const voice = pick.pool === 'moral' ? 'superego' : 'id';
      const victim = p.thoughts
        .filter((t) => t.voice === voice && t.maskedBy === undefined)
        .sort((a, b) => b.intensity - a.intensity || a.id - b.id)[0];
      if (victim) {
        p.thoughts = p.thoughts.filter((t) => t !== victim);
        const drive = victim.drive !== undefined ? content.drives[victim.drive] : undefined;
        if (drive?.forbidden) charge(drive.shadow_traits[0], 10);
        targetId = victim.targetId ?? null;
      }
      if (voice === 'superego') p.lastTransgression = null;
      break;
    }
    case 'denial':
      scale((t) => t.voice === 'id' && t.drive !== undefined && content.drives[t.drive]?.anxiety_pool === 'real', 1, 4);
      break;
    case 'projection': {
      const pr = sit.projection;
      if (pr) {
        targetId = pr.targetId;
        trait = pr.trait;
        formProjection(world, ctx, actorId, pr.targetId, pr.trait, pr.pf);
        if (pr.drive !== null) scale((t) => t.drive === pr.drive, 1, 2);
        charge(pr.trait, 5);
        if (isPresent(m, pr.targetId)) act = { kind: 'defense', defense: 'projection', targetId: pr.targetId };
      }
      break;
    }
    case 'displacement': {
      const dp = sit.displacement;
      if (dp) {
        targetId = dp.targetId;
        const urge: Urge = { kind: 'defense', defense: 'displacement', targetId: dp.targetId };
        const dd = new Set(Object.keys(content.drives ?? {}).filter((d) => content.drives[d]?.displaceable === true));
        scale((t) => t.voice === 'id' && t.drive !== undefined && dd.has(t.drive), 1, 2);
        // The relief is mostly owed until the act lands on someone (10 §7.2): a quarter now, the
        // rest when social reports the displaced act within the day (psyche/api defenseActLanded).
        const drive = [...dd].sort((a, b) => (p.drives[b] ?? 50) - (p.drives[a] ?? 50) || cmpStr(a, b))[0] ?? '';
        const owed = def.relief - Math.floor((def.relief * DISPLACE_UPFRONT_PCT) / 100);
        p.displaced = {
          amount: owed,
          objectId: dp.blockedId,
          drive,
          until: addMinutes(ctx.now, DISPLACE_WINDOW_MIN),
          targetId: dp.targetId,
        };
        if (isPresent(m, dp.targetId)) {
          act = urge;
        } else {
          // Stored for when they meet: a masked Id thought that wins once the target is here.
          masked = { stance: 'for', intensity: clamp(def.relief * 2, 1, 1000) };
          stored = urge;
        }
      }
      break;
    }
    case 'rationalization': {
      const tr = p.lastTransgression;
      if (tr) {
        targetId = tr.targetId;
        scale((t) => t.voice === 'superego' && t.norm === tr.norm, 1, 2);
      }
      p.lastTransgression = null;
      break;
    }
    case 'reaction_formation': {
      const drive = sit.wish?.drive ?? sit.forbiddenStreak ?? undefined;
      if (drive !== undefined) {
        const orig = p.thoughts
          .filter((t) => t.voice === 'id' && t.drive === drive)
          .reduce((mx, t) => Math.max(mx, t.intensity), 0);
        const norm = opposingNorm(m, drive);
        p.thoughts = p.thoughts.filter((t) => !(t.voice === 'id' && t.drive === drive));
        charge(content.drives[drive]?.shadow_traits[0], 5);
        delete p.frustration[drive];
        const intensity = clamp(Math.floor(((orig > 0 ? orig : def.relief) * 3) / 2), 1, 1000);
        if (sit.wish) {
          targetId = sit.wish.targetId;
          delete p.wishes[drive];
          masked = { stance: 'for', intensity, ...(norm !== undefined ? { norm } : {}) };
          if (isPresent(m, sit.wish.targetId)) {
            act = { kind: 'defense', defense: 'reaction_formation', targetId: sit.wish.targetId };
          }
        } else {
          masked = {
            stance: 'against',
            intensity,
            ...(norm !== undefined ? { norm } : {}),
            against: [...(content.drives[drive]?.relief_tags ?? [])],
          };
        }
      }
      break;
    }
    case 'sublimation': {
      const sb = sit.sublimation;
      if (sb) {
        const tpl = sublimationFor(m, sb.drive);
        if (tpl) act = tpl.urge;
        scale((t) => t.drive === sb.drive, 0, 1);
        delete p.frustration[sb.drive];
      }
      break;
    }
  }

  const upfront =
    id === 'displacement' && sit.displacement ? Math.floor((def.relief * DISPLACE_UPFRONT_PCT) / 100) : def.relief;
  const relief = drainPools(p, upfront, pick.pool);
  p.defenseStyle[id] = clamp((p.defenseStyle[id] ?? 10) + STYLE_GAIN, 0, 100);
  const acquired = def.acquired_trait;
  let gained: string | undefined;
  if (acquired !== undefined && (p.defenseStyle[id] ?? 0) >= 70 && !p.acquired.includes(acquired)) {
    p.acquired.push(acquired);
    gained = acquired;
  }
  p.lastDefenseAt = ctx.now;

  const traitName = trait !== undefined ? (content.traits[trait]?.name ?? trait).toLowerCase() : undefined;
  const line = fillLine(pickLine(def.lines, actorId, `defense:${id}`, ctx.now), {
    target: nameOf(m, targetId),
    ...(traitName !== undefined ? { trait: traitName } : {}),
  });
  if (id === 'displacement' && p.displaced && p.displaced.targetId === targetId) p.displaced.line = line;
  const maskedUrge: Urge =
    act ?? stored ?? ({ kind: 'defense', defense: id, ...(targetId !== null ? { targetId } : {}) } as Urge);
  const t: Thought = {
    id: nextThoughtId(world),
    voice: voiceOf[id] ?? 'id',
    urge: maskedUrge,
    intensity: masked.intensity,
    label: line,
    source: 'psyche',
    bornAt: ctx.now,
    decayPerHour: 50,
    reasons: [{ source: 'psyche', label: def.period_label, value: masked.intensity }],
    key: `defense:${id}`,
    stance: masked.stance,
    line,
    frustrated: 0,
    maskedBy: id,
    ...(masked.norm !== undefined ? { norm: masked.norm, speaker: content.norms[masked.norm]?.speaker ?? '' } : {}),
    ...(masked.against ? { against: masked.against } : {}),
    ...(targetId !== null ? { targetId } : {}),
  };
  p.thoughts = p.thoughts.filter((x) => x.key !== t.key);
  p.thoughts.push(t);

  // The act the defense demands takes the hour, unless the player's command holds it (P2).
  if (act && !commandHolds && p.chosen) {
    p.chosen = {
      urge: act,
      voice: 'ego',
      thoughtId: t.id,
      compromise: false,
      at: ctx.now,
      explain: {
        ...p.chosen.explain,
        note: `${p.chosen.explain.note ? `${p.chosen.explain.note} ` : ''}Then something else took the hour.`,
      },
    };
  } else if (act && !commandHolds && !p.chosen) {
    p.chosen = {
      urge: act,
      voice: 'ego',
      thoughtId: t.id,
      compromise: false,
      at: ctx.now,
      explain: {
        kind: 'arbitration',
        label: line,
        subjects: [actorId],
        knowledge: 'self',
        terms: [],
        total: 0,
        outcome: 'defense',
      },
    };
  }

  const explain: Explain = {
    kind: 'defense',
    label: `${def.period_label}${targetId !== null ? `: ${nameOf(m, targetId)}` : ''}`,
    subjects: [actorId],
    knowledge: 'omniscient',
    terms: [{ source: 'psyche', label: `Anxiety (${pick.pool} ${p.anxSrc[pick.pool] + 0})`, value: before }],
    total: before,
    dc: {
      total: theta,
      terms: [
        { source: 'base', label: 'Base', value: 250 },
        { source: 'psyche', label: `Self-Command ${p.ego} ×3`, value: theta - 250 },
      ],
    },
    margin: before - theta,
    outcome: id,
    children: candidateExplains(actorId, cands, id),
    note: `Relief ${relief} from ${pick.pool}${upfront < def.relief ? `; ${def.relief - upfront} more if the anger lands on someone within the day` : ''}${gained !== undefined ? `; becomes ${gained}` : ''}`,
  };
  const eventId = ctx.emit({
    kind: 'psyche.defense',
    data: {
      actorId,
      defense: id,
      targetId,
      label: line,
      anxietyBefore: before,
      anxietyAfter: p.anxiety,
      pool: pick.pool,
      relief,
      ...(trait !== undefined ? { trait } : {}),
      ...(act ? { act: urgeLabel(act) } : {}),
      ...(gained !== undefined ? { acquiredTrait: gained } : {}),
    },
    roles: [
      { actor: actorId, role: 'agent' },
      ...(targetId !== null ? [{ actor: targetId, role: 'target' as const }] : []),
    ],
    visibility: 'inner',
    importance: def.importance,
    explain,
  });
  // Rationalization leaves its excuse behind as a Reason about the wronged party ("had it coming").
  if (id === 'rationalization' && targetId !== null) addDefenseReason(world, ctx, actorId, targetId, id, eventId);
  p.recentDefenses.push({ defense: id, at: ctx.now, targetId, eventId });
  if (p.recentDefenses.length > RECENT_DEFENSES) p.recentDefenses.splice(0, p.recentDefenses.length - RECENT_DEFENSES);
  world.psyche.counters.defenses = (world.psyche.counters.defenses ?? 0) + 1;
}

// ---------------------------------------------------------------------------------------------
// Daily bookkeeping
// ---------------------------------------------------------------------------------------------

function psycheDaily(world: World, ctx: SimContext): void {
  const weekly = ctx.cal.weekday === 'sun';
  for (const id of idsOf<ActorId>(world.psyche.byActor)) {
    if (!processesActor(world, id)) continue;
    const p = world.psyche.byActor[id] as ActorPsyche;
    // Forbidden wishes fade a step a day: "repeated" means recently repeated.
    for (const d of Object.keys(p.wishes).sort()) {
      const w = p.wishes[d];
      if (!w) continue;
      w.count -= 1;
      if (w.count <= 0) delete p.wishes[d];
    }
    // Style relaxes toward the trait baseline by 1 a week (10 §7.1).
    if (weekly) {
      for (const d of Object.keys(p.defenseStyle).sort() as DefenseId[]) {
        const cur = p.defenseStyle[d] ?? 10;
        const base = p.styleBase[d] ?? 10;
        if (cur > base) p.defenseStyle[d] = cur - 1;
        else if (cur < base) p.defenseStyle[d] = cur + 1;
      }
    }
  }
}
