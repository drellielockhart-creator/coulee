/**
 * Belief cross-module API. OWNER: module:belief.
 * social calls transmit() for every gossip; psyche calls formProjection() for projection.
 */

import { occupants } from '../activity/api.ts';
import { abilityMod } from '../actor.ts';
// The forms of address are a leaf (no chronicle runtime): importing chronicle/api here would
// close an import cycle through the sifting code.
import { argForm, householdForms } from '../chronicle/names.ts';
import type { ContentBundle, PredicateId } from '../content.ts';
import {
  type ActorId,
  asPropId,
  asRumorId,
  type EventId,
  nextId,
  type PlaceId,
  type PropId,
  type RumorId,
  rowsOf,
} from '../ids.ts';
import { addAnxiety } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { addMemory, areKin, opinionOf } from '../social/api.ts';
import { yearsBetween } from '../time.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { applyEvidence, colorOpinion, ensureBelief, formula } from './evidence.ts';
import { clamp, sigmoidPermille, view3 } from './intmath.ts';
import { indexedBelief } from './lookup.ts';
import { targetLabel } from './misfortune.ts';
import type { Belief, Evidence, EvidenceType, Prop, PropArg } from './state.ts';
import { makeGrudge } from './state.ts';

function argKey(a: PropArg): string {
  switch (a.kind) {
    case 'actor':
      return `a:${a.id}`;
    case 'household':
      return `h:${a.id}`;
    case 'figure':
      return `f:${a.id}`;
    case 'place':
      return `p:${a.id}`;
    case 'text':
      return `t:${JSON.stringify(a.value)}`;
    case 'number':
      return `n:${a.value}`;
    case 'misfortune':
      return `m:${a.id}`;
  }
}

export function propKey(pred: PredicateId, args: readonly PropArg[]): string {
  return `${pred}(${args.map(argKey).join(',')})`;
}

/** Intern a proposition (idempotent). */
export function internProp(world: World, pred: PredicateId, args: PropArg[]): PropId {
  const key = propKey(pred, args);
  const existing = world.belief.propByKey[key];
  if (existing !== undefined) return existing;
  const id = asPropId(nextId(world.belief.counters, 'prop'));
  world.belief.props[id] = { id, pred, args, key };
  world.belief.propByKey[key] = id;
  return id;
}

/** Render a proposition with its predicate template: "Loveday Trevenna is a witch". */
export function propText(world: World, content: ContentBundle, propId: PropId): string {
  const p: Prop | undefined = world.belief.props[propId];
  if (!p) return `#${propId}`;
  const tpl = content.predicates[p.pred]?.text ?? `${p.pred}({0})`;
  return tpl.replace(/\{(\d)(?:\.([a-z]+))?\}/g, (_m, i: string, form: string | undefined) => {
    const a = p.args[Number(i)];
    if (!a) return '?';
    const formed = argForm(world, content, a as never, form, (id) => {
      const act = world.actors[id as ActorId];
      return act ? `${act.name.given} ${act.name.family}`.trim() : `#${id}`;
    });
    if (formed !== null) return formed;
    switch (a.kind) {
      case 'actor': {
        const act = world.actors[a.id];
        return act ? `${act.name.given} ${act.name.family}`.trim() : `#${a.id}`;
      }
      case 'household':
        return world.households[a.id]?.name ?? `#${a.id}`;
      case 'figure':
        return world.belief.figures[a.id]?.name ?? `#${a.id}`;
      case 'place':
        return world.places[a.id]?.name ?? `#${a.id}`;
      case 'text':
        // A projected trait reads as its name ("hot-tempered"), not its content id.
        return content.traits[a.value]?.name.toLowerCase() ?? a.value.replaceAll('_', ' ');
      case 'number':
        return String(a.value);
      case 'misfortune': {
        const m = world.belief.misfortunes[a.id];
        const def = m && content.misfortunes[m.kindId];
        if (!def || !m) return `misfortune #${a.id}`;
        const forms = householdForms(world, m.householdId);
        return def.text
          .replace('{0.poss}', forms.poss)
          .replace('{0}', forms.family)
          .replace('{1}', m.victimId === null ? 'a child' : (world.actors[m.victimId]?.name.given ?? '?'));
      }
    }
  });
}

export function beliefOf(world: World, holderId: ActorId, propId: PropId): Belief | undefined {
  return indexedBelief(world, holderId, propId);
}

/** Credence 0..100 that `holderId` gives `propId` (0 if no belief). */
export function credenceOf(world: World, holderId: ActorId, propId: PropId): number {
  return beliefOf(world, holderId, propId)?.credence ?? 0;
}

export type Channel =
  | 'tavern'
  | 'church'
  | 'church_steps'
  | 'store'
  | 'bee'
  | 'mill'
  | 'household'
  | 'letter'
  | 'newspaper'
  | 'peddler'
  | 'landing'
  | 'fae_whisper'
  | 'street';

export interface TransmitRequest {
  speakerId: ActorId;
  listenerId: ActorId;
  placeId: PlaceId | null;
  channel: Channel;
  /** The social.interaction event this happens inside (for causes / memory links). */
  interactionEventId: EventId | null;
  /** Force a topic (player choosing what to say); otherwise topic selection per 04 §8.3. */
  topic?: PropId;
}

export interface TransmitResult {
  /** False if the speaker had nothing worth telling this listener. */
  told: boolean;
  rumorId: RumorId | null;
  propId: PropId | null;
  mutation: string | null;
  /** Listener's credence after hearing (0..100). */
  listenerCredence: number;
}

/** Map venues to authored channels. */
export function channelForPlace(world: World, content: ContentBundle, placeId: PlaceId | null): Channel {
  const tags = placeId === null ? [] : (world.places[placeId]?.tags ?? []);
  for (const key of Object.keys(content.rumorChannels).sort()) {
    const c = content.rumorChannels[key];
    if (c?.venue_tags.some((tag) => tags.includes(tag))) return c.id;
  }
  return 'street';
}

export function hasRumorFor(world: World, speakerId: ActorId, listenerId: ActorId): boolean {
  if (speakerId === listenerId) return false;
  return (world.belief.beliefsByHolder[speakerId] ?? []).some((id) => {
    const b = world.belief.beliefs[id];
    return b !== undefined && !b.conceal && b.credence >= 20;
  });
}

export function transmit(world: World, ctx: SimContext, req: TransmitRequest): TransmitResult {
  const empty: TransmitResult = { told: false, rumorId: null, propId: null, mutation: null, listenerCredence: 0 };
  const speaker = world.actors[req.speakerId];
  const listener = world.actors[req.listenerId];
  if (!speaker || !listener || speaker.id === listener.id) return empty;
  const channel = ctx.content.rumorChannels[req.channel];
  let selected: Belief | undefined;
  let score = -1;
  for (const id of world.belief.beliefsByHolder[speaker.id] ?? []) {
    const b = world.belief.beliefs[id];
    if (!b || (req.topic !== undefined ? b.propId !== req.topic : b.conceal || b.credence < 20)) continue;
    const prop = world.belief.props[b.propId];
    const pred = prop && ctx.content.predicates[prop.pred];
    if (!pred) continue;
    const subject = prop.args[0];
    const target = subject?.kind === 'actor' ? subject.id : null;
    const relevant =
      target !== null &&
      (target === listener.id ||
        areKin(world, listener.id, target) ||
        world.actors[target]?.placeId === listener.placeId ||
        opinionOf(world, listener.id, target).affection < -20);
    const safety =
      target !== null &&
      pred.valence < 0 &&
      (areKin(world, listener.id, target) || opinionOf(world, listener.id, target).affection > 40)
        ? 10
        : 100;
    let next = pred.juiciness * 10;
    for (const pct of [
      clamp(100 - 40 * view3(speaker.values.discretion), 10, 220),
      relevant ? 200 : 100,
      b.toldTo.includes(listener.id) ? 25 : 100,
      safety,
      pred.valence < 0 ? (channel?.scandal_pct ?? 100) : 100,
    ])
      next = Math.floor((next * pct) / 100);
    if (b.evidence.some((e) => e.defense === 'projection')) next = Math.floor((next * 130) / 100);
    if (world.belief.persecutions.some((p) => p.rung >= 1 && p.charges.includes(b.propId)))
      next = Math.floor((next * 150) / 100);
    if (next > score || (next === score && b.id < (selected?.id ?? b.id))) {
      selected = b;
      score = next;
    }
  }
  if (!selected) return empty;
  const probability = sigmoidPermille(Math.floor(((score - 500) * 1024) / 1000));
  const roll = ctx
    .rng('gossip', mixKey(speaker.id, listener.id, selected.id, req.interactionEventId ?? 0, 701))
    .int(1, 1000);
  if (req.topic === undefined && roll > probability) return empty;
  const sourceProp = world.belief.props[selected.propId];
  if (!sourceProp) return empty;
  const pred = ctx.content.predicates[sourceProp.pred];
  if (!pred) return empty;
  if (selected.rumorId === null) {
    const id = asRumorId(nextId(world.belief.counters, 'rumor'));
    world.belief.rumors[id] = {
      id,
      rootPropId: selected.propId,
      originId: speaker.id,
      bornAt: ctx.now,
      variants: [{ propId: selected.propId, parentPropId: null, mutation: null, firstCarrierId: speaker.id }],
      juiciness: pred.juiciness * 10,
      tellings: 0,
      lastToldAt: ctx.now,
    };
    selected.rumorId = id;
    selected.echoes[id] = 1;
  }
  const rumor = world.belief.rumors[selected.rumorId];
  if (!rumor) return empty;
  let propId = selected.propId;
  let mutation: string | null = null;
  const mutRate = clamp(
    Math.floor(
      (120 *
        (channel?.mutation_pct ?? 100) *
        (100 + 10 * view3(speaker.values.superstition)) *
        (100 - 5 * abilityMod(speaker.sheet.abilities.int))) /
        1000000,
    ),
    0,
    1000,
  );
  const r = ctx.rng('rumor', mixKey(speaker.id, listener.id, rumor.id, rumor.tellings, 702));
  const mutationRoll = r.int(1, 1000);
  if (mutationRoll <= mutRate) {
    const options: Array<{ pred: string; args: PropArg[]; name: string }> = [];
    for (const [name, next] of [
      ['exaggeration', pred.exaggerates_to],
      ['supernaturalization', pred.supernaturalizes_to],
      ['truncation', pred.truncates_to],
    ] as const) {
      const def = next && ctx.content.predicates[next];
      if (next && def) options.push({ pred: next, args: sourceProp.args.slice(0, def.args.length), name });
    }
    if (sourceProp.args[0]?.kind === 'actor') {
      for (const next of pred.moralizes_to)
        options.push({ pred: next, args: sourceProp.args.slice(0, 1), name: 'moralization' });
    }
    if (pred.act && sourceProp.args[0]?.kind === 'actor') {
      const candidates = rowsOf(world.actors).filter(
        (a) =>
          a.id !== speaker.id &&
          a.id !== (sourceProp.args[0] as { id: ActorId }).id &&
          opinionOf(world, speaker.id, a.id).affection < -20,
      );
      const target = r.pick(candidates);
      if (target)
        options.push({
          pred: pred.id,
          args: [{ kind: 'actor', id: target.id }, ...sourceProp.args.slice(1)],
          name: 'attribution_drift',
        });
    }
    const subject = sourceProp.args[0];
    if (subject?.kind === 'figure' && pred.args[0] === 'agent') {
      const identities = (world.belief.beliefsByHolder[speaker.id] ?? [])
        .flatMap((id) => {
          const b = world.belief.beliefs[id];
          const p = b && world.belief.props[b.propId];
          if (
            !b ||
            !p ||
            p.pred !== 'is_figure' ||
            b.credence < 25 ||
            p.args[0]?.kind !== 'actor' ||
            p.args[1]?.kind !== 'figure' ||
            p.args[1].id !== subject.id
          )
            return [];
          return [{ actorId: p.args[0].id, credence: b.credence }];
        })
        .sort((a, b) => b.credence - a.credence || a.actorId - b.actorId);
      const identity = identities[0];
      if (identity)
        options.push({
          pred: pred.id,
          args: [{ kind: 'actor', id: identity.actorId }, ...sourceProp.args.slice(1)],
          name: 'specification',
        });
      // No name in mind: the teller fits the tale to someone it suits (04 §8.5), weighted by
      // how well they fit, the teller's suspicion and dislike. The figure acquires a face.
      const fig = world.belief.figures[subject.id];
      if (!identity && fig?.fits && ctx.content.predicates.is_figure) {
        const fits = fig.fits;
        const cands = rowsOf(world.actors)
          .filter((a) => {
            if (!a.alive || a.id === speaker.id || a.id === listener.id) return false;
            if (fits.sex !== undefined && a.sex !== fits.sex) return false;
            if (yearsBetween(a.born, ctx.now) < fits.min_age) return false;
            return true;
          })
          .map((a) => {
            const roles = ctx.content.occupations[a.occupationId]?.roles ?? [];
            const suits =
              (fits.traits_any.some((t) => a.traits.includes(t)) ? 30 : 0) +
              (fits.roles_any.some((x) => roles.includes(x)) ? 30 : 0);
            const w =
              10 +
              suits +
              2 * suspicionOf(world, speaker.id, a.id) +
              Math.max(0, -opinionOf(world, speaker.id, a.id).affection);
            return { a, w };
          });
        const pick = r.weighted(cands, (c) => c.w);
        if (pick) {
          options.push({
            pred: pred.id,
            args: [{ kind: 'actor', id: pick.a.id }, ...sourceProp.args.slice(1)],
            name: 'specification',
          });
          options.push({
            pred: 'is_figure',
            args: [
              { kind: 'actor', id: pick.a.id },
              { kind: 'figure', id: subject.id },
            ],
            name: 'specification',
          });
        }
      }
    }
    const choice = r.pick(options);
    if (choice) {
      propId = internProp(world, choice.pred, choice.args);
      mutation = choice.name;
      if (!rumor.variants.some((v) => v.propId === propId))
        rumor.variants.push({ propId, parentPropId: selected.propId, mutation, firstCarrierId: speaker.id });
    }
  }
  rumor.tellings++;
  rumor.lastToldAt = ctx.now;
  selected.voiced = true;
  if (req.topic !== undefined) selected.conceal = false;
  if (!selected.toldTo.includes(listener.id)) {
    selected.toldTo.push(listener.id);
    if (selected.toldTo.length > 128) selected.toldTo.shift();
  }
  const { belief: b, applied } = receive(world, ctx, listener.id, propId, {
    type: req.channel === 'newspaper' ? 'document' : 'statement',
    dir: 1,
    sourceId: speaker.id,
    eventId: req.interactionEventId,
    rumorId: rumor.id,
    scalePct: channel?.credibility_pct ?? 100,
  });
  const eventId = ctx.emit({
    kind: 'belief.transmitted',
    ...(req.placeId === null ? {} : { place: req.placeId }),
    roles: [
      { actor: speaker.id, role: 'agent' },
      { actor: listener.id, role: 'listener' },
    ],
    visibility: 'private',
    importance: mutation ? 35 : 15,
    causes: req.interactionEventId === null ? [] : [req.interactionEventId],
    data: {
      speakerId: speaker.id,
      listenerId: listener.id,
      rumorId: rumor.id,
      propId,
      mutation,
      accepted: b.credence >= 50,
    },
    explain: {
      ...formula(
        'Choose a rumor to tell',
        [speaker.id, listener.id],
        score,
        { 'Topic score': score, 'Tell probability per mille': probability, 'Mutation probability per mille': mutRate },
        'participants',
      ),
      roll: { die: 1000, natural: roll },
      children: [
        {
          kind: 'check',
          label: 'Rumor mutation',
          subjects: [speaker.id],
          knowledge: 'omniscient',
          terms: [],
          roll: { die: 1000, natural: mutationRoll },
          total: mutationRoll,
          dc: { total: mutRate, terms: [] },
          outcome: mutation ?? 'unchanged',
          note: 'A roll at or below the mutation rate permits a content-defined variant.',
        },
      ],
    },
  });
  const memoryId = addMemory(world, ctx, {
    ownerId: listener.id,
    eventId,
    kind: 'gossip',
    at: ctx.now,
    placeId: req.placeId,
    roles: [{ who: speaker.id, role: 'agent', conf: 100 }],
    source: { kind: 'told', by: speaker.id, rumorId: rumor.id },
    emotion: pred.valence < 0 ? 'fear' : 'none',
    intensity: Math.max(20, pred.juiciness),
    salience: 600,
    confidence: b.credence * 10,
    rehearsals: 0,
    pinned: false,
    aboutId: null,
    did: false,
    count: 1,
    since: ctx.now,
    summary: propText(world, ctx.content, propId),
  });
  applied.memoryId = memoryId;
  if (pred.supernatural && b.credence > 40) addAnxiety(world, ctx, listener.id, Math.floor(b.credence / 5));
  for (const g of rowsOf(world.belief.grudges)) {
    const subject = sourceProp.args[0];
    if (
      g.holderId !== speaker.id ||
      subject?.kind !== g.target.kind ||
      !('id' in subject) ||
      !('id' in g.target) ||
      subject.id !== g.target.id
    )
      continue;
    if (
      req.channel === 'household' &&
      yearsBetween(listener.born, ctx.now) < 16 &&
      listener.values.rancor >= 0 &&
      areKin(world, speaker.id, listener.id) &&
      !rowsOf(world.belief.grudges).some((other) => other.holderId === listener.id && other.inheritedFrom === g.id)
    ) {
      const inherited = makeGrudge(world, {
        holderId: listener.id,
        target: g.target,
        founding: [{ kind: 'memory', id: memoryId, label: propText(world, ctx.content, propId) }],
        intensity: Math.floor((g.intensity * 60) / 100),
        aim: g.aim,
        public: false,
        since: ctx.now,
        inheritedFrom: g.id,
      });
      ctx.emit({
        kind: 'belief.grudge_formed',
        visibility: 'inner',
        roles: [
          { actor: listener.id, role: 'listener' },
          ...(inherited.target.kind === 'actor' ? [{ actor: inherited.target.id, role: 'target' as const }] : []),
        ],
        data: {
          holderId: listener.id,
          target: targetLabel(world, inherited.target),
          ...(inherited.target.kind === 'actor' ? { targetId: inherited.target.id } : {}),
          intensity: inherited.intensity,
          aim: inherited.aim,
        },
        explain: formula('A family grievance is inherited', [listener.id], inherited.intensity, {
          'Parent intensity': g.intensity,
          'Transfer percent': 60,
        }),
      });
    }
    const before = g.intensity;
    // Rehearsal once a day, not once per repeated conversation.
    if (ctx.now - g.lastRehearsedAt >= 1440) {
      g.intensity = Math.min(100, g.intensity + 5);
      g.lastRehearsedAt = ctx.now;
      ctx.emit({
        kind: 'belief.grudge_changed',
        visibility: 'inner',
        data: { grudgeId: g.id, before, intensity: g.intensity, reason: 'rehearsal' },
        explain: formula('Rehearse grievance', [speaker.id], g.intensity, { Before: before, Rehearsal: 5 }),
      });
    }
  }
  return { told: true, rumorId: rumor.id, propId, mutation, listenerCredence: b.credence };
}

export interface Observation {
  type: EvidenceType;
  dir: 1 | -1;
  sourceId: ActorId | null;
  eventId: EventId | null;
  rumorId?: RumorId | null;
  scalePct?: number;
}

function receive(
  world: World,
  ctx: SimContext,
  observerId: ActorId,
  propId: PropId,
  evidence: Observation,
): { belief: Belief; applied: Evidence } {
  const applied: Evidence = {
    type: evidence.type,
    dir: evidence.dir,
    sourceId: evidence.sourceId,
    memoryId: null,
    weight: 0,
    at: ctx.now,
    rumorId: evidence.rumorId ?? null,
  };
  const b = applyEvidence(world, ctx, observerId, propId, applied, evidence.scalePct ?? 100);
  if (!b.formed && b.credence >= 50) {
    b.formed = true;
    colorOpinion(world, ctx, b);
    ctx.emit({
      kind: 'belief.formed',
      visibility: 'inner',
      roles: [{ actor: observerId, role: 'witness' }],
      data: {
        holderId: observerId,
        beliefId: b.id,
        propId,
        credence: b.credence,
        text: propText(world, ctx.content, propId),
      },
      explain: formula('Belief takes hold', [observerId], b.credence, { Credence: b.credence }),
    });
  }
  return { belief: b, applied };
}

export function observe(
  world: World,
  ctx: SimContext,
  observerId: ActorId,
  propId: PropId,
  evidence: Observation,
): void {
  if (!world.actors[observerId] || !world.belief.props[propId]) return;
  const { belief: b, applied } = receive(world, ctx, observerId, propId, evidence);
  const memoryId = addMemory(world, ctx, {
    ownerId: observerId,
    eventId: evidence.eventId,
    kind: 'observation',
    at: ctx.now,
    placeId: world.actors[observerId]?.placeId ?? null,
    roles: [],
    source:
      evidence.type === 'dream'
        ? { kind: 'dreamt' }
        : evidence.type === 'inference' || evidence.type === 'defense' || evidence.type === 'confabulation'
          ? { kind: 'inferred' }
          : evidence.sourceId !== null
            ? { kind: 'told', by: evidence.sourceId, rumorId: evidence.rumorId ?? null }
            : { kind: 'witnessed' },
    emotion: 'none',
    intensity: 40,
    salience: 600,
    confidence: b.credence * 10,
    rehearsals: 0,
    pinned: false,
    aboutId: null,
    did: false,
    count: 1,
    since: ctx.now,
    summary: propText(world, ctx.content, propId),
  });
  applied.memoryId = memoryId;
}

/**
 * Projection (10 §7.2): the holder sees their own disowned trait in the target. `traitId` is a
 * trait id ('hot_tempered', 'envious', 'amorous'...): a predicate whose `projects` lists it (or
 * the drive it belongs to) carries it, else Is(target, trait) via `has_trait`. Credence is
 * 5 + PF/2 with the psyche's projection fit when given (else recomputed here), and the belief
 * colors the holder's opinion of the target through a Reason that cites it.
 */
export function formProjection(
  world: World,
  ctx: SimContext,
  holderId: ActorId,
  targetId: ActorId,
  traitId: string,
  pf?: number,
): void {
  if (!world.actors[holderId] || !world.actors[targetId]) return;
  const drives = Object.keys(ctx.content.drives ?? {})
    .sort()
    .filter((d) => ctx.content.drives[d]?.shadow_traits.includes(traitId));
  const pred =
    Object.keys(ctx.content.predicates)
      .sort()
      .find((key) => {
        const projects = ctx.content.predicates[key]?.projects ?? [];
        return projects.includes(traitId) || drives.some((d) => projects.includes(d));
      }) ?? 'has_trait';
  if (!ctx.content.predicates[pred]) return;
  const args: PropArg[] = [{ kind: 'actor', id: targetId }];
  if (ctx.content.predicates[pred]?.args.length === 2) args.push({ kind: 'text', value: traitId });
  const propId = internProp(world, pred, args);
  const b = ensureBelief(world, ctx, holderId, propId);
  const op = opinionOf(world, holderId, targetId);
  const holder = world.actors[holderId];
  const target = world.actors[targetId];
  const outsider = holder && target && holder.presentsAsId !== target.presentsAsId ? 50 : 0;
  const oddness = suspicionOf(world, holderId, targetId);
  const fit =
    pf !== undefined
      ? clamp(Math.round(pf), 0, 100)
      : clamp(
          Math.floor((30 * b.credence + 20 * oddness + 20 * outsider) / 100) +
            (op.affection < 0 ? 15 : 0) +
            Math.floor(((100 - Math.max(op.respect, op.fear, areKin(world, holderId, targetId) ? 50 : 0)) * 15) / 100),
          0,
          100,
        );
  const before = b.credence;
  b.credence = Math.max(before, 5 + Math.floor(fit / 2));
  b.lastEvidenceAt = ctx.now;
  b.evidence.push({
    type: 'defense',
    dir: 1,
    memoryId: null,
    sourceId: null,
    weight: 128,
    at: ctx.now,
    rumorId: null,
    defense: 'projection',
  });
  if (b.evidence.length > 16) b.evidence.shift();
  colorOpinion(world, ctx, b);
  ctx.emit({
    kind: 'belief.evidence',
    visibility: 'inner',
    roles: [{ actor: holderId, role: 'subject' }],
    data: { holderId, propId, before, credence: b.credence },
    explain: formula(
      'Projection supplies a trait',
      [holderId],
      b.credence,
      { Before: before, 'Projection fit': fit, 'Perceived oddness': oddness, 'Perceived outsider': outsider },
      'omniscient',
    ),
  });
}

export function suspicionOf(world: World, observerId: ActorId, targetId: ActorId): number {
  let suspicion = 0;
  for (const id of world.belief.beliefsByHolder[observerId] ?? []) {
    const b = world.belief.beliefs[id];
    const p = b && world.belief.props[b.propId];
    if (p?.suspicious && p.args[0]?.kind === 'actor' && p.args[0].id === targetId)
      suspicion = Math.max(suspicion, b?.credence ?? 0);
  }
  return suspicion;
}

export function proposeBeliefUrges(world: World, ctx: SimContext, actorId: ActorId): UrgeProposal[] {
  const out: UrgeProposal[] = [];
  const me = world.actors[actorId];
  // A concealed actor who showed a tell at the Sabbath bell keeps away from the next ones (the
  // absence is its own tell: tells.toml kept_from_meeting). Psyche weighs it against Piety.
  const wary = world.belief.wary?.[actorId];
  if (wary && wary.until > ctx.now && ctx.cal.isSabbath && ctx.cal.hour >= 8 && ctx.cal.hour < 12) {
    const tell = ctx.content.suspicionTells[wary.tellId];
    if (ctx.content.activities.idle_at_home) {
      out.push({
        urge: { kind: 'activity', activityId: 'idle_at_home' },
        voice: 'id',
        intensity: 600,
        label: 'Keep away from the bell',
        source: 'belief',
        reasons: [{ source: 'belief', label: `Last time: ${tell?.name ?? wary.tellId}`, value: 600 }],
        drive: 'fear',
      });
    }
  }
  for (const p of world.belief.persecutions) {
    if (p.pending?.catalystId !== actorId || p.target.kind !== 'actor' || !me) continue;
    const def = Object.values(ctx.content.persecutionRungs).find((r) => r.rung === p.pending?.rung);
    if (!def?.step_interaction || !ctx.content.interactions[def.step_interaction]) continue;
    const accused = p.target.id;
    // Rung 2 is said to the accused's face; rung 3 is lobbying a neighbor to cut them off.
    // Either way it needs someone here to say it to, and it carries the charge as its topic.
    const here = occupants(world, me.placeId).filter((id) => id !== actorId && world.actors[id]?.alive);
    const targetId =
      def.rung >= 3
        ? here.find((id) => {
            const a = world.actors[id];
            return id !== accused && a !== undefined && yearsBetween(a.born, ctx.now) >= 16;
          })
        : here.includes(accused)
          ? accused
          : undefined;
    if (targetId === undefined) continue;
    const topic = strongestCharge(world, actorId, p.charges);
    out.push({
      urge: {
        kind: 'interaction',
        interactionId: def.step_interaction,
        targetId,
        ...(topic !== undefined ? { topic } : {}),
      },
      voice: 'superego',
      intensity: clamp(p.pending.score * 10, 0, 1000),
      label: def.name,
      source: 'belief',
      reasons: [{ source: 'belief', label: 'Community pressure', value: p.heat }],
    });
  }
  for (const g of rowsOf(world.belief.grudges)) {
    if (g.holderId !== actorId || g.target.kind !== 'actor') continue;
    const def = ctx.content.grudgeAims[g.aim];
    if (g.intensity < (def?.min_intensity ?? 40)) continue;
    const fear = opinionOf(world, actorId, g.target.id).fear;
    const interactionId = fear >= 50 ? def?.covert : def?.direct.find((id) => ctx.content.interactions[id]);
    if (!interactionId || !ctx.content.interactions[interactionId]) continue;
    const targetId =
      fear >= 50
        ? rowsOf(world.actors).find(
            (a) =>
              a.id !== actorId &&
              a.id !== (g.target as { id: ActorId }).id &&
              a.placeId === world.actors[actorId]?.placeId,
          )?.id
        : g.target.id;
    if (targetId === undefined) continue;
    out.push({
      urge: { kind: 'interaction', interactionId, targetId },
      voice: 'id',
      intensity: g.intensity * 8,
      label: `Seek ${g.aim}`,
      source: 'belief',
      reasons: [{ source: 'belief', label: 'Grudge', value: g.intensity }],
    });
  }
  const actor = world.actors[actorId];
  if (actor) {
    for (const target of rowsOf(world.actors)) {
      if (target.id === actorId || target.placeId !== actor.placeId) continue;
      const suspicion = suspicionOf(world, actorId, target.id);
      if (suspicion < 40) continue;
      const fear = opinionOf(world, actorId, target.id).fear;
      if (fear >= 40 && ctx.content.activities.idle_at_home) {
        out.push({
          urge: { kind: 'activity', activityId: 'idle_at_home' },
          voice: 'id',
          intensity: Math.min(850, suspicion * 5 + fear * 3),
          label: 'Keep away from the suspected neighbor',
          source: 'belief',
          reasons: [{ source: 'belief', label: 'Suspicion', value: suspicion }],
        });
      } else if (ctx.content.interactions.gossip) {
        const confidant = rowsOf(world.actors).find(
          (a) => a.id !== actorId && a.id !== target.id && a.placeId === actor.placeId,
        );
        if (confidant)
          out.push({
            urge: { kind: 'interaction', interactionId: 'gossip', targetId: confidant.id },
            voice: 'id',
            intensity: suspicion * 5,
            label: 'Ask what the neighbors have heard',
            source: 'belief',
            reasons: [{ source: 'belief', label: 'Suspicion', value: suspicion }],
          });
      }
    }
  }
  return out;
}

/** The charge (of a persecution) the holder believes most strongly: what they would say aloud. */
function strongestCharge(world: World, holderId: ActorId, charges: readonly PropId[]): PropId | undefined {
  let best: { id: PropId; c: number } | undefined;
  for (const id of charges) {
    const c = beliefOf(world, holderId, id)?.credence ?? 0;
    if (!best || c > best.c) best = { id, c };
  }
  return best?.id;
}

export { noveltyQ8 } from './evidence.ts';
export { reportMisfortune } from './misfortune.ts';

/** Cross-module shunning query: institutions can apply their own service/price effects. */
export function isShunning(world: World, holderId: ActorId, targetId: ActorId): boolean {
  return world.belief.persecutions.some(
    (p) => p.rung >= 3 && p.target.kind === 'actor' && p.target.id === targetId && p.shunnerIds.includes(holderId),
  );
}

export { grudgeTargetsOf } from './grudges.ts';
