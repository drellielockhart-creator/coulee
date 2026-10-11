/**
 * Resolve one social interaction (04 §10, §11.2): the check (with its Explain), witnesses,
 * the `social.interaction` event, memories, opinion Reasons, needs, anxiety, the ledger,
 * relationship edges, injected thoughts, gossip through belief.transmit, and escalation.
 * OWNER: module:social.
 */
import { shortName } from '../actor.ts';
import { type Channel, transmit } from '../belief/api.ts';
import { opposedCheck, resolveCheck, type SaveId, saveTerms, skillCheck, skillTerms } from '../checks.ts';
import type { DefenseId, InteractionDef } from '../content.ts';
import { type Explain, type ExplainTerm, signed, term } from '../explain.ts';
import type { ActorId, EventId, MemoryId, PlaceId, PropId } from '../ids.ts';
import { satisfyNeed } from '../needs/api.ts';
import { transferCash } from '../provisions/api.ts';
import { addAnxiety, addThought } from '../psyche/api.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { encodeSalience, insertMemory, isNegativeKind, softenMemories } from './memory.ts';
import { clampInt, floorDiv, formatCents, isZeroDims, scaleDimsPct } from './model.ts';
import {
  addReason,
  addVolatile,
  adjustLedger,
  bumpFamiliarity,
  opinionRecord,
  owedCents,
  refreshBase,
  refreshLabel,
  settleDebt,
} from './opinion.ts';
import type { MemorySource, OpinionDims, OpinionReason } from './state.ts';
import { tuningOf, valueView } from './tuning.ts';
import { areKinBy, makePair, pairTargetOpinion, type RequireMode, requiresFail } from './volition.ts';

const SALT_CHECK = 0x50c1a1;
const SALT_WITNESS = 0x317e55;
const SALT_ESCALATE = 0xe5ca1a;

export type InteractionVia = 'encounter' | 'urge' | 'defense' | 'escalation';

export interface InteractionRequest {
  def: InteractionDef;
  initiatorId: ActorId;
  targetId: ActorId;
  placeId: PlaceId | null;
  /** Others present and awake at the venue, excluding the pair (ascending ids). */
  present: readonly ActorId[];
  mode: RequireMode;
  via: InteractionVia;
  /** Why it was chosen (volition terms, the psyche's arbitration, an escalation save). */
  choice?: Explain;
  viaDefense?: DefenseId;
  /** A defense-made Reason the initiator adds about the target (04 §6.2 viaDefense). */
  defenseReason?: { label: string; delta: OpinionDims };
  topic?: PropId;
  causes?: EventId[];
  /** Escalation depth guard. */
  depth?: number;
}

export interface InteractionOutcome {
  eventId: EventId;
  success: boolean;
  /** Gossip only: what belief.transmit reported. */
  told: boolean | null;
  escalatedEventId: EventId | null;
}

function fill(tpl: string, vars: Record<string, string>): string {
  let s = tpl;
  for (const k of Object.keys(vars)) s = s.replaceAll(`{${k}}`, vars[k] ?? '');
  return s;
}

function channelFor(world: World, ctx: SimContext, placeId: PlaceId | null): Channel {
  const tags = placeId !== null ? (world.places[placeId]?.tags ?? []) : [];
  for (const c of tuningOf(ctx.content).channels) if (tags.includes(c.tag)) return c.channel as Channel;
  return 'street';
}

/** The cents an interaction is about ({cents}): the loan, or the debt being dunned/repaid. */
function centsAt(world: World, def: InteractionDef, i: ActorId, t: ActorId, ledgerCents: number): number {
  if (ledgerCents !== 0) return Math.abs(ledgerCents);
  if (def.requires.target_owes && def.requires.debt !== 'favors') return owedCents(world, i, t);
  if (def.requires.initiator_owes && def.requires.debt !== 'favors') return owedCents(world, t, i);
  return 0;
}

interface CheckOutcome {
  success: boolean;
  explain: Explain;
  checked: boolean;
}

function runCheck(world: World, ctx: SimContext, req: InteractionRequest): CheckOutcome {
  const { def } = req;
  const content = ctx.content;
  const init = world.actors[req.initiatorId];
  const tgt = world.actors[req.targetId];
  const r = ctx.rng('social', mixKey(req.initiatorId, req.targetId, hashString32(def.id), SALT_CHECK));
  const label = `${def.name}: ${init ? shortName(init) : req.initiatorId} → ${tgt ? shortName(tgt) : req.targetId}`;
  const children = req.choice ? [req.choice] : [];
  if (!init || !tgt || def.check.kind === 'none') {
    const explain: Explain = req.choice
      ? { ...req.choice }
      : {
          kind: 'choice',
          label,
          subjects: [req.initiatorId],
          knowledge: 'self',
          terms: [],
          total: 0,
          outcome: 'chosen',
        };
    return { success: true, explain, checked: false };
  }
  if (def.check.kind === 'dc') {
    const dcTerms: ExplainTerm[] = [];
    if (def.check.attitude) {
      const op = pairTargetOpinionOf(world, ctx, req);
      const adj = -floorDiv(op.affection, 20) - floorDiv(op.trust, 25);
      if (adj !== 0)
        dcTerms.push(
          term('opinion', `Their regard (Affection ${signed(op.affection)}, Trust ${signed(op.trust)})`, adj),
        );
    }
    const res = skillCheck(content, init, { label, skill: def.check.skill, dc: def.check.dc, dcTerms }, r);
    const explain: Explain = { ...res.explain, subjects: [req.initiatorId, req.targetId], children };
    return { success: res.success, explain, checked: true };
  }
  const vs = def.check.vs;
  const isSave = vs === 'will' || vs === 'fortitude' || vs === 'reflex';
  const res = opposedCheck(
    label,
    {
      label: `${shortName(init)} ${def.check.skill}`,
      terms: skillTerms(content, init, def.check.skill),
      subject: init.id,
    },
    {
      label: `${shortName(tgt)} ${vs}`,
      terms: isSave ? saveTerms(tgt, vs as SaveId) : skillTerms(content, tgt, vs),
      subject: tgt.id,
    },
    r,
  );
  const explain: Explain = { ...res.explain, children: [...(res.explain.children ?? []), ...children] };
  return { success: res.initiatorWins, explain, checked: true };
}

function pairTargetOpinionOf(world: World, ctx: SimContext, req: InteractionRequest): OpinionDims {
  const p = makePair(world, ctx, req.initiatorId, req.targetId, req.placeId, req.present.length);
  return p ? pairTargetOpinion(p) : { affection: 0, respect: 0, trust: 0, fear: 0 };
}

/** Resolve and apply one interaction. Callers check `requiresFail` first. */
export function resolveInteraction(world: World, ctx: SimContext, req: InteractionRequest): InteractionOutcome {
  const { def } = req;
  const content = ctx.content;
  const t = tuningOf(content);
  const i = req.initiatorId;
  const tg = req.targetId;
  const init = world.actors[i];
  const tgt = world.actors[tg];
  const iName = init ? shortName(init) : `#${i}`;
  const tName = tgt ? shortName(tgt) : `#${tg}`;
  const place = req.placeId !== null ? world.places[req.placeId] : undefined;

  const check = runCheck(world, ctx, req);
  const success = check.success;
  const eff = success ? def.success : def.failure;

  // Witnesses and audience: sampled from those present (04 §11.2: 0–2 witnesses).
  const declared = def.visibility === 'auto' ? (def.notable ? 'public' : 'witnessed') : def.visibility;
  // P1: what is done at a public venue with others about, or before a crowd, is public knowledge.
  const atPublicVenue = place?.tags.some((x) => t.public_venue_tags.includes(x)) === true;
  const visibility =
    declared === 'witnessed' &&
    ((atPublicVenue && req.present.some((x) => world.actors[x]?.householdId !== init?.householdId)) ||
      req.present.length >= t.public_audience_min)
      ? 'public'
      : declared;
  let witnesses: ActorId[] = [];
  let audience: ActorId[] = [];
  if (visibility !== 'private' && req.present.length > 0) {
    const wr = ctx.rng('social', mixKey(i, tg, hashString32(def.id), SALT_WITNESS));
    const shuffled = wr.shuffleByKey(req.present, (a) => a as number);
    witnesses = shuffled.slice(0, t.max_witnesses).sort((a, b) => a - b);
    if (eff.audience === 'all_present') audience = shuffled.slice(0, t.audience_cap).sort((a, b) => a - b);
    else if (eff.audience === 'witnesses') audience = witnesses;
  }

  const ledgerCents = eff.ledger.cents;
  const cents = centsAt(world, def, i, tg, ledgerCents);
  const vars = {
    initiator: iName,
    target: tName,
    place: place?.name ?? 'the road',
    cents: formatCents(cents),
  };
  const bubble = cents > 0 ? `${def.label} ▸ ${formatCents(cents)}` : `${def.label} ▸ ${tName}`;
  const importance = def.importance > 0 ? def.importance : def.notable ? 40 : undefined;
  const eventId = ctx.emit({
    kind: 'social.interaction',
    roles: [
      { actor: i, role: 'agent' },
      { actor: tg, role: 'target' },
      ...witnesses.map((w) => ({ actor: w, role: 'witness' as const })),
    ],
    visibility,
    ...(req.placeId !== null ? { place: req.placeId } : {}),
    ...(importance !== undefined ? { importance } : {}),
    ...(req.causes && req.causes.length > 0 ? { causes: req.causes } : {}),
    explain: check.explain,
    data: { interactionId: def.id, initiatorId: i, targetId: tg, placeId: req.placeId, success, label: bubble },
  });

  const daily = world.social.daily;
  daily.interactions += 1;
  world.social.totals.interactions += 1;
  if (check.checked) daily.checks += 1;
  if (def.tags.includes('hostile')) daily.hostile += 1;
  if (req.via === 'defense') daily.defenses += 1;

  // Meeting makes acquaintance; cooldown on the initiator's side.
  bumpFamiliarity(world, content, i, tg);
  const rec = opinionRecord(world, i, tg);
  if (rec && def.cooldown_hours > 0) rec.cooldowns[def.id] = ctx.now + def.cooldown_hours * 60;

  // ---- memories (04 §4.1-4.2)
  const memKind = eff.memory_kind ?? def.memory?.kind;
  const negative = memKind !== undefined && isNegativeKind(content, memKind);
  let targetMem: MemoryId | null = null;
  let initMem: MemoryId | null = null;
  const audienceMem = new Map<ActorId, MemoryId>();
  if (def.memory && memKind !== undefined) {
    let base = floorDiv(def.memory.intensity * eff.intensity_pct, 100);
    const onlookers = audience.length > 0 ? audience.length : witnesses.length;
    if (def.tags.includes('public') || visibility === 'public') {
      base = floorDiv(
        base * (100 + Math.min(t.audience_intensity_cap, t.audience_intensity_per_onlooker * onlookers)),
        100,
      );
    }
    const targetRegard = pairTargetOpinionOf(world, ctx, req).affection;
    const surprise = negative && targetRegard > 20 ? t.surprise_pct : 0;
    const tI = clampInt(floorDiv(base * (100 + surprise), 100), 0, 100);
    const iI = clampInt(floorDiv(base * t.initiator_intensity_pct, 100), 0, 100);
    const wI = clampInt(floorDiv(base * t.witness_intensity_pct, 100), 0, 100);
    const roles = [
      { who: i, role: 'agent' as const, conf: 100 },
      { who: tg, role: negative ? ('victim' as const) : ('target' as const), conf: 100 },
    ];
    const mk = (
      owner: ActorId,
      intensity: number,
      emotion: string,
      summary: string,
      about: ActorId,
      did: boolean,
      source: MemorySource,
      extraRole: boolean,
    ): MemoryId =>
      insertMemory(world, ctx, {
        ownerId: owner,
        eventId,
        kind: memKind,
        at: ctx.now,
        placeId: req.placeId,
        roles: extraRole ? [...roles, { who: owner, role: 'witness', conf: 100 }] : roles,
        source,
        emotion,
        intensity,
        salience: encodeSalience(content, intensity),
        confidence: source.kind === 'overheard' ? 700 : 1000,
        rehearsals: 0,
        pinned: false,
        summary,
        aboutId: about,
        did,
      });
    targetMem = mk(
      tg,
      tI,
      eff.target_emotion ?? def.memory.emotion,
      fill(eff.target_memory ?? `${def.name} with {initiator}`, vars),
      i,
      false,
      { kind: 'witnessed' },
      false,
    );
    initMem = mk(
      i,
      iI,
      eff.initiator_emotion ?? def.memory.emotion,
      fill(eff.initiator_memory ?? `${def.name} with {target}`, vars),
      tg,
      true,
      { kind: 'witnessed' },
      false,
    );
    if (eff.witness_memory) {
      for (const a of audience) {
        audienceMem.set(
          a,
          mk(a, wI, def.memory.emotion, fill(eff.witness_memory, vars), i, false, { kind: 'overheard' }, true),
        );
      }
    }
  }

  // ---- opinions: Reasons citing the holder's memory (04 §6.2), or volatile mood
  const reasonFor = (memId: MemoryId | null, label: string, delta: OpinionDims): OpinionReason => ({
    label,
    cites: memId !== null ? { kind: 'memory', id: memId } : { kind: 'seed' },
    delta,
    since: ctx.now,
  });
  const targetLabel = fill(eff.target_reason ?? eff.target_memory ?? def.name, vars);
  if (!isZeroDims(eff.target_opinion)) {
    if (eff.volatile) addVolatile(world, content, tg, i, eff.target_opinion);
    else addReason(world, content, tg, i, reasonFor(targetMem, targetLabel, eff.target_opinion), ctx.now);
  }
  if (!isZeroDims(eff.initiator_opinion)) {
    const label = fill(eff.initiator_reason ?? eff.initiator_memory ?? def.name, vars);
    if (eff.volatile) addVolatile(world, content, i, tg, eff.initiator_opinion);
    else addReason(world, content, i, tg, reasonFor(initMem, label, eff.initiator_opinion), ctx.now);
  }
  if (req.defenseReason && !isZeroDims(req.defenseReason.delta)) {
    const r = reasonFor(initMem, req.defenseReason.label, req.defenseReason.delta);
    if (req.viaDefense !== undefined) r.viaDefense = req.viaDefense;
    addReason(world, content, i, tg, r, ctx.now);
  }
  for (const a of audience) {
    if (a === i || a === tg) continue;
    const m = audienceMem.get(a) ?? null;
    if (!isZeroDims(eff.audience_opinion)) {
      const label = fill(eff.witness_memory ?? targetLabel, vars);
      if (m === null) addVolatile(world, content, a, i, eff.audience_opinion);
      else addReason(world, content, a, i, reasonFor(m, label, eff.audience_opinion), ctx.now);
    }
    // Kin of the target take a share of the target's grievance or gratitude.
    if (!eff.volatile && eff.kin_share_pct > 0 && !isZeroDims(eff.target_opinion) && areKinBy(world, content, a, tg)) {
      const share = scaleDimsPct(eff.target_opinion, eff.kin_share_pct);
      if (!isZeroDims(share)) {
        addReason(world, content, a, i, reasonFor(m, `${targetLabel} (to my kin, ${tName})`, share), ctx.now);
      }
    }
  }

  // ---- needs (via needs/api), anxiety (via psyche/api)
  const cause = { label: `${def.name}: ${iName} → ${tName}`, eventId };
  for (const [need, d] of Object.entries(eff.initiator_needs)) satisfyNeed(world, ctx, i, need, d, cause);
  for (const [need, d] of Object.entries(eff.target_needs)) satisfyNeed(world, ctx, tg, need, d, cause);
  for (const a of audience) {
    if (a === i || a === tg) continue;
    for (const [need, d] of Object.entries(eff.audience_needs)) satisfyNeed(world, ctx, a, need, d, cause);
  }
  if (eff.initiator_anxiety !== 0) addAnxiety(world, ctx, i, eff.initiator_anxiety);
  if (eff.target_anxiety !== 0) addAnxiety(world, ctx, tg, eff.target_anxiety);

  // ---- obligation ledger (04 §6.1) and creditor edges (04 §7.1)
  // A loan is real money (provisions moves it, purse first): the debt is what actually changed hands.
  let ledger = eff.ledger;
  if (ledger.cents !== 0) {
    const lender = ledger.cents > 0 ? i : tg;
    const borrower = lender === i ? tg : i;
    const moved = transferCash(world, ctx, lender, borrower, Math.abs(ledger.cents), def.name, eventId);
    ledger = { favors: ledger.favors, cents: ledger.cents > 0 ? moved : -moved };
  }
  if (ledger.favors !== 0 || ledger.cents !== 0) {
    adjustLedger(world, content, i, tg, ledger);
    if (ledger.cents !== 0) {
      const creditor = ledger.cents > 0 ? i : tg;
      const debtor = creditor === i ? tg : i;
      const e = world.social.relationships.find((r) => r.kind === 'creditor' && r.a === creditor && r.b === debtor);
      if (e) e.amountCents = (e.amountCents ?? 0) + Math.abs(ledger.cents);
      else {
        world.social.relationships.push({
          a: creditor,
          b: debtor,
          kind: 'creditor',
          since: ctx.now,
          amountCents: Math.abs(ledger.cents),
        });
        refreshBase(world, content, creditor, debtor);
      }
    }
  }
  if (eff.settle === 'initiator_debt') {
    // Repaying hands over what the debtor can: all of it settles the debt, part of it reduces it.
    const owed = def.requires.debt === 'favors' ? 0 : owedCents(world, tg, i);
    const paid = owed > 0 ? transferCash(world, ctx, i, tg, owed, def.name, eventId) : 0;
    if (owed === 0 || paid >= owed) settleDebt(world, content, i, tg, def.requires.debt);
    else if (paid > 0) {
      adjustLedger(world, content, tg, i, { favors: 0, cents: -paid });
      const e = world.social.relationships.find((r) => r.kind === 'creditor' && r.a === tg && r.b === i);
      if (e) e.amountCents = Math.max(0, (e.amountCents ?? 0) - paid);
    }
  }
  if (eff.settle === 'target_debt') settleDebt(world, content, tg, i, def.requires.debt);

  // ---- structural edges (courting, betrothed)
  if (eff.remove_relationship) {
    const kind = eff.remove_relationship;
    world.social.relationships = world.social.relationships.filter(
      (r) => !(r.kind === kind && ((r.a === i && r.b === tg) || (r.a === tg && r.b === i))),
    );
    refreshBase(world, content, i, tg);
  }
  if (eff.add_relationship) {
    const kind = eff.add_relationship;
    const has = world.social.relationships.some(
      (r) => r.kind === kind && ((r.a === i && r.b === tg) || (r.a === tg && r.b === i)),
    );
    if (!has) world.social.relationships.push({ a: i, b: tg, kind, since: ctx.now, amountCents: null });
    refreshBase(world, content, i, tg);
  }

  // ---- amends act on memories, so the Reasons citing them weaken (04 §6.2)
  if (eff.soften_target_memories_pct > 0) softenMemories(world, content, tg, i, eff.soften_target_memories_pct);
  if (eff.soften_initiator_memories_pct > 0) softenMemories(world, content, i, tg, eff.soften_initiator_memories_pct);

  // ---- a thought for the target's psyche (04 §3.6: memories cue thoughts)
  if (eff.target_thought) {
    const th = eff.target_thought;
    addThought(world, ctx, tg, {
      urge: { kind: 'interaction', interactionId: th.interaction, targetId: i },
      voice: th.voice,
      intensity: th.intensity,
      label: fill(th.label, { other: iName }),
      source: 'social',
      reasons: [term('memory', fill(eff.target_memory ?? def.name, vars), th.intensity)],
      ...(th.drive !== undefined ? { drive: th.drive } : {}),
      ...(th.norm !== undefined ? { norm: th.norm } : {}),
      ...(th.spoken_by_other ? { speaker: iName } : {}),
    });
  }

  // ---- gossip: belief.transmit is the ONLY gossip path; exactly one call per gossip act
  let told: boolean | null = null;
  if (def.transmits_rumor && success) {
    daily.gossip += 1;
    const res = transmit(world, ctx, {
      speakerId: i,
      listenerId: tg,
      placeId: req.placeId,
      channel: channelFor(world, ctx, req.placeId),
      interactionEventId: eventId,
      ...(req.topic !== undefined ? { topic: req.topic } : {}),
    });
    told = res.told === true;
    if (told) daily.told += 1;
  }

  // ---- escalation (insult -> fight): the target keeps their temper with a Will save
  let escalatedEventId: EventId | null = null;
  const depth = req.depth ?? 0;
  if (success && eff.escalates_to && depth < 1 && tgt && init) {
    const next = content.interactions[eff.escalates_to];
    if (next) {
      const temper = valueView(tgt, 'temper');
      const er = ctx.rng('social', mixKey(i, tg, hashString32(def.id), SALT_ESCALATE));
      const save = resolveCheck(
        {
          label: `Will: ${tName} keeps their temper`,
          kind: 'save',
          terms: saveTerms(tgt, 'will'),
          dc: t.escalation_dc,
          dcTerms: temper !== 0 ? [term('value', `Temper ${signed(temper)}`, temper * t.escalation_per_temper)] : [],
          subjects: [tg],
          knowledge: 'participants',
        },
        er,
      );
      if (!save.success) {
        const pair = makePair(world, ctx, tg, i, req.placeId, req.present.length);
        if (pair && requiresFail(pair, next, 'forced') === null) {
          const present = req.present;
          const out = resolveInteraction(world, ctx, {
            def: next,
            initiatorId: tg,
            targetId: i,
            placeId: req.placeId,
            present,
            mode: 'forced',
            via: 'escalation',
            choice: save.explain,
            causes: [eventId],
            depth: depth + 1,
          });
          escalatedEventId = out.eventId;
        }
      }
    }
  }

  // ---- derived labels (Friend/Enemy transitions are chronicle-worthy)
  refreshLabel(world, ctx, tg, i);
  refreshLabel(world, ctx, i, tg);
  for (const a of audience) if (a !== i && a !== tg) refreshLabel(world, ctx, a, i);

  return { eventId, success, told, escalatedEventId };
}
