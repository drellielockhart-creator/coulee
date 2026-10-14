/**
 * Belief cross-module API. OWNER: module:belief.
 * social calls transmit() for every gossip; psyche calls formProjection() for projection.
 */

import { occupants } from '../activity/api.ts';
import { abilityMod } from '../actor.ts';
// The forms of address are a leaf (no chronicle runtime): importing chronicle/api here would
// close an import cycle through the sifting code.
import { argForm, householdForms, itemSubjectName } from '../chronicle/names.ts';
import type { ContentBundle, PredicateId } from '../content.ts';
import { type Bias, directorFocus, favours, liveBiases, noteNudge } from '../director/api.ts';
import { term } from '../explain.ts';
import {
  type ActorId,
  asPropId,
  asRumorId,
  type BeliefId,
  type EventId,
  nextId,
  type PlaceId,
  type PropId,
  type RumorId,
  rowsOf,
  sortedKeys,
} from '../ids.ts';
import { addAnxiety } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { addMemory, areKin, familiarityOf, opinionOf } from '../social/api.ts';
import { yearsBetween } from '../time.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { applyEvidence, colorOpinion, ensureBelief, formula, noveltyQ8 } from './evidence.ts';
import { grudgesHeldBy } from './grudges.ts';
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
    case 'item':
      return `i:${a.id}`;
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

/**
 * Render a proposition with its predicate template: "Loveday Trevenna is a witch". `person`
 * renders it in the teller's own mouth ('self': "I owe ...") or to its subject's face ('you':
 * "you owe ...") when the predicate has that form (`text_self`, `text_you`); otherwise the
 * third person.
 */
export function propText(world: World, content: ContentBundle, propId: PropId, person?: 'self' | 'you'): string {
  const p: Prop | undefined = world.belief.props[propId];
  if (!p) return `#${propId}`;
  const def = content.predicates[p.pred];
  const tpl =
    (person === 'self' ? def?.text_self : person === 'you' ? def?.text_you : undefined) ??
    def?.text ??
    `${p.pred}({0})`;
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
      case 'item':
        return itemSubjectName(world, content, a.id);
    }
  });
}

/** Whether the predicate has a form for the teller's own mouth ('self') or the subject's face. */
export function hasPersonForm(world: World, content: ContentBundle, propId: PropId, person: 'self' | 'you'): boolean {
  const def = content.predicates[world.belief.props[propId]?.pred ?? ''];
  return person === 'self' ? def?.text_self !== undefined : def?.text_you !== undefined;
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
  /**
   * What kind of telling (interactions.toml `rumor_mode`): the freshest `news`, a `warning`
   * (ill news first), or a `confidence` (a private matter the hearer then keeps close).
   */
  mode?: 'news' | 'warning' | 'confidence' | 'charge';
  /**
   * A deliberate telling: the hearer asked, or the teller set out to tell. The teller comes out
   * with the best thing they have if it is worth the telling, without the roll for whether the
   * talk turns that way.
   */
  deliberate?: boolean;
  /**
   * The hearer asked for the news (social `ask_about`; playtest r2: asking went 0 for 4 while the
   * speaker held news). Anything tellable counts, not only what clears the worth-telling floor:
   * asked, people say what they have, freshest first. Concealed beliefs are still never told.
   */
  asked?: boolean;
}

export interface TransmitResult {
  /** False if the speaker had nothing worth telling this listener. */
  told: boolean;
  rumorId: RumorId | null;
  propId: PropId | null;
  mutation: string | null;
  /** Listener's credence after hearing (0..100). */
  listenerCredence: number;
  /** Additive: the proposition as said (third person), '' when nothing was told. */
  text?: string;
  /** Additive: the `belief.transmitted` event, when something was told. */
  eventId?: EventId | null;
}

/** What a teller is about to say (planTransmit); commitTransmit makes it so. */
export interface TransmitPlan {
  req: TransmitRequest;
  beliefId: BeliefId;
  /** The proposition said (after any mutation in the telling). */
  propId: PropId;
  mutation: string | null;
  score: number;
  probability: number;
  roll: number;
  mutRate: number;
  mutationRoll: number;
  /** Novelty to the teller, per mille (rumor saturation). */
  freshness: number;
  /** N4 carrier weight applied to the chosen topic (Director; omniscient in the Explain). */
  director?: { biasId: number; pm: number; flipped: boolean; plainBeliefId: number | null };
}

/**
 * May the Director weight talk of this predicate (N4)? Not if it, or anything a telling can
 * mutate it into (exaggeration, supernaturalization, moralization, truncation, transitively),
 * is a charge, a kind (people) claim, supernatural or magic, or concerns who holds a thing (a
 * charm): a weighted rumor must never become a witch or faekin rumor in the mouth (05 §8.3).
 */
export function nudgeablePredicate(content: ContentBundle, predId: PredicateId): boolean {
  const seen = new Set<string>();
  const stack: string[] = [predId];
  while (stack.length) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const pred = content.predicates[id];
    if (!pred) return false;
    if (pred.charge || pred.kind_of !== undefined || pred.supernatural || pred.magic) return false;
    // Talk of who holds what thing (a charm) is the road to suspicion: never weighted.
    if (pred.args.includes('item')) return false;
    for (const next of [pred.exaggerates_to, pred.supernaturalizes_to, pred.truncates_to, ...pred.moralizes_to])
      if (next !== undefined) stack.push(next);
  }
  return true;
}

/** N4's plausibility envelope: at most +50% on a topic score the carrier already rates worth telling. */
export const CARRIER_WEIGHT_MAX_PM = 500;

/**
 * Director hook N4 (05 §8.3): `carrierWeight(rumor, carrier)` for the carrier's own topic
 * selection. Only facts the carrier already holds can be weighted (the caller iterates the
 * carrier's beliefs), never a kind/people predicate or a charge, and never a telling the PC
 * could perceive. Returns a lookup by prop, or null (no bias: the default).
 */
export function carrierWeight(
  world: World,
  content: ContentBundle,
  speakerId: ActorId,
  listenerId: ActorId,
  placeId: PlaceId | null,
): ((propId: PropId) => { pm: number; bias: Bias } | null) | null {
  const live = liveBiases(world, {
    hook: 'carrier',
    process: 'gossip',
    subject: speakerId,
    actors: [speakerId, listenerId],
    places: placeId === null ? [] : [placeId],
  });
  if (live.length === 0) return null;
  const pc = directorFocus(world);
  return (propId) => {
    const prop = world.belief.props[propId];
    if (!prop || !nudgeablePredicate(content, prop.pred)) return null;
    // Never talk about the PC on the Director's account.
    if (prop.args.some((a) => a.kind === 'actor' && a.id === pc)) return null;
    const b = live.find((x) => favours(world, x, propId, 'key'));
    return b ? { pm: Math.min(CARRIER_WEIGHT_MAX_PM, Math.max(0, b.amount)), bias: b } : null;
  };
}

/** How a telling landed: what social's talk lines need to voice it. */
export interface TellOutcome {
  speakerId: ActorId;
  listenerId: ActorId;
  propId: PropId;
  /** The claim in the words the teller uses (first person about themselves, second to the subject). */
  said: string;
  /** The claim in the third person. */
  text: string;
  subjectId: ActorId | null;
  /** 'self' when the teller is the subject, 'you' when the hearer is. */
  person: 'self' | 'you' | 'other';
  speakerCredence: number;
  listenerBefore: number;
  listenerAfter: number;
  /** The hearer had heard this, or a variant of it, before. */
  heardBefore: boolean;
  /** Whom the teller had it from (null: their own eyes, or their own secret). */
  sourceId: ActorId | null;
  kind: 'scandal' | 'uncanny' | 'kind' | 'plain';
  mutation: string | null;
  mode: 'news' | 'warning' | 'confidence' | 'charge';
}

/** The words of a telling (social composes them; belief carries them on its private event). */
export interface TellWords {
  line: string;
  lines: Array<{ speaker: string; speakerId: ActorId; text: string }>;
}

/** Map venues to authored channels. */
export function channelForPlace(world: World, content: ContentBundle, placeId: PlaceId | null): Channel {
  const tags = placeId === null ? [] : (world.places[placeId]?.tags ?? []);
  for (const key of sortedKeys(content.rumorChannels)) {
    const c = content.rumorChannels[key];
    if (c?.venue_tags.some((tag) => tags.includes(tag))) return c.id;
  }
  return 'street';
}

/**
 * Below this topic score a thing is not worth the telling: a stale or saturated rumor drops out
 * of conversation instead of being retold to everyone forever (playtest 2026-10-11: one rumor
 * was told 1,555 times in a year).
 */
export const WORTH_TELLING = 80;

/**
 * Saturation half-points: the teller's interest halves after telling `toldHalf` people, after
 * hearing it `heardHalf` times, and `ageHalfDays` days after it began going round.
 */
const FRESH = { toldHalf: 8, heardHalf: 4, ageHalfDays: 14 } as const;

/** Freshness floor (per mille) of the town's news told on purpose to someone who cannot have heard it. */
const NEWS_TO_A_STRANGER = 700;

/**
 * Novelty to the teller, per mille (rumor saturation): people stop retelling what everyone
 * already knows. It falls with how many the teller has told (8 → ½), how often they have heard
 * its lineage (4 echoes → ½), how long it has gone round (14 days → ½), and, for a hearer the
 * teller knows well, how common the belief already is in town (a newcomer still gets the old
 * news: they cannot be assumed to have heard).
 */
export function freshnessOf(
  world: World,
  now: number,
  b: Belief,
  listenerId: ActorId,
): { pm: number; told: number; heard: number; age: number; common: number } {
  const told = Math.floor((FRESH.toldHalf * 1000) / (FRESH.toldHalf + b.toldTo.length));
  const echoes = b.rumorId !== null ? (b.echoes[b.rumorId] ?? 0) : 0;
  const heard = Math.min(1000, Math.floor((FRESH.heardHalf * 1000) / (FRESH.heardHalf - 1 + Math.max(1, echoes))));
  const rumor = b.rumorId !== null ? world.belief.rumors[b.rumorId] : undefined;
  const since = rumor ? Math.max(rumor.bornAt, b.firstHeard) : now;
  const days = Math.max(0, Math.floor((now - since) / 1440));
  const age = Math.floor((FRESH.ageHalfDays * 1000) / (FRESH.ageHalfDays + days));
  const prevalence = world.belief.commons[b.propId]?.prevalence ?? 0;
  const common = familiarityOf(world, b.holderId, listenerId) >= 200 ? 1000 - Math.floor((prevalence * 3) / 4) : 1000;
  const pm = Math.floor((Math.floor((Math.floor((told * heard) / 1000) * age) / 1000) * common) / 1000);
  return { pm, told, heard, age, common };
}

/** May this belief be told in this mode at all (a confidence draws on private matters only)? */
function tellable(
  content: ContentBundle,
  world: World,
  b: Belief,
  mode: NonNullable<TransmitRequest['mode']>,
  listenerId: ActorId,
): boolean {
  const prop = world.belief.props[b.propId];
  const pred = prop && content.predicates[prop.pred];
  if (mode === 'charge') {
    // What one holds against the hearer: a damaging claim about them, said to their face.
    const subject = prop?.args[0];
    return (
      !b.conceal &&
      b.credence >= 20 &&
      pred !== undefined &&
      pred.valence < 0 &&
      subject?.kind === 'actor' &&
      subject.id === listenerId
    );
  }
  if (mode !== 'confidence') return !b.conceal && b.credence >= 20;
  if (!pred || b.credence < 30 || b.voiced) return false;
  // What one is (a concealed people) is never confided: it is the household's to keep.
  if (pred.kind_of !== undefined && b.conceal) return false;
  // A private matter about oneself needs words for one's own mouth.
  const subject = prop.args[0];
  if (subject?.kind === 'actor' && subject.id === b.holderId && pred.text_self === undefined) return false;
  return true;
}

/**
 * Has the speaker anything worth telling this listener (social's `rumor_available`): a belief
 * they hold, have not told them, and that is still fresh enough to be worth the breath.
 */
export function hasRumorFor(world: World, speakerId: ActorId, listenerId: ActorId, content?: ContentBundle): boolean {
  if (speakerId === listenerId) return false;
  for (const id of world.belief.beliefsByHolder[speakerId] ?? []) {
    const b = world.belief.beliefs[id];
    if (!b || b.conceal || b.credence < 20 || b.toldTo.includes(listenerId)) continue;
    const prop = world.belief.props[b.propId];
    const juicy = content && prop ? (content.predicates[prop.pred]?.juiciness ?? 20) * 10 : 500;
    if (Math.floor((juicy * freshnessOf(world, world.time, b, listenerId).pm) / 1000) >= WORTH_TELLING) return true;
  }
  return false;
}

/** Does the speaker hold any news at all (fresh or not)? "Only the same old talk" needs some. */
export function holdsNews(world: World, speakerId: ActorId): boolean {
  return (world.belief.beliefsByHolder[speakerId] ?? []).some((id) => {
    const b = world.belief.beliefs[id];
    return b !== undefined && !b.conceal && b.credence >= 20;
  });
}

function kindOf(content: ContentBundle, world: World, propId: PropId): TellOutcome['kind'] {
  const pred = content.predicates[world.belief.props[propId]?.pred ?? ''];
  if (!pred) return 'plain';
  if (pred.supernatural) return 'uncanny';
  if (pred.valence <= -20) return 'scandal';
  return pred.valence > 0 ? 'kind' : 'plain';
}

/**
 * Choose what the speaker will say (04 §8.3 topic selection, damped by saturation), roll
 * whether the talk turns that way (skipped for a deliberate telling), and roll the mutation in
 * the telling. Returns null when the speaker has nothing worth telling this listener. A plan is
 * meant to be committed at once (it may open the rumor's lineage record).
 */
export function planTransmit(world: World, ctx: SimContext, req: TransmitRequest): TransmitPlan | null {
  const speaker = world.actors[req.speakerId];
  const listener = world.actors[req.listenerId];
  if (!speaker || !listener || speaker.id === listener.id) return null;
  const mode = req.mode ?? 'news';
  const channel = ctx.content.rumorChannels[req.channel];
  let selected: Belief | undefined;
  let score = -1;
  let freshness = 1000;
  // N4: a deliberate or forced telling is the teller's (or PC's) own choice, never weighted.
  const weigh =
    req.topic === undefined && !req.deliberate
      ? carrierWeight(world, ctx.content, speaker.id, listener.id, req.placeId)
      : null;
  let plain: { b: Belief; score: number } | null = null;
  let tilt: { pm: number; bias: Bias } | null = null;
  for (const id of world.belief.beliefsByHolder[speaker.id] ?? []) {
    const b = world.belief.beliefs[id];
    if (!b) continue;
    if (req.topic !== undefined ? b.propId !== req.topic : !tellable(ctx.content, world, b, mode, listener.id))
      continue;
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
    const pcts =
      mode === 'charge'
        ? [b.credence >= 50 ? 150 : 100]
        : mode === 'confidence'
          ? [b.conceal ? 150 : 100, target === speaker.id ? 150 : 100, b.toldTo.includes(listener.id) ? 0 : 100]
          : [
              clamp(100 - 40 * view3(speaker.values.discretion), 10, 220),
              relevant ? 200 : 100,
              b.toldTo.includes(listener.id) ? 25 : 100,
              safety,
              pred.valence < 0 ? (channel?.scandal_pct ?? 100) : 100,
              mode === 'warning' ? (pred.valence < 0 || pred.supernatural ? 150 : 20) : 100,
            ];
    for (const pct of pcts) next = Math.floor((next * pct) / 100);
    if (b.evidence.some((e) => e.defense === 'projection')) next = Math.floor((next * 130) / 100);
    if (world.belief.persecutions.some((p) => p.rung >= 1 && p.charges.includes(b.propId)))
      next = Math.floor((next * 150) / 100);
    // Saturation: news grows stale; a private confidence or a charge to one's face does not.
    // Asked by someone who cannot have heard (a stranger, a newcomer), old news is still news.
    const unheard = req.deliberate === true && familiarityOf(world, speaker.id, listener.id) < 200;
    const fresh =
      mode === 'confidence' || mode === 'charge'
        ? 1000
        : Math.max(unheard ? NEWS_TO_A_STRANGER : 0, freshnessOf(world, ctx.now, b, listener.id).pm);
    next = Math.floor((next * fresh) / 1000);
    if (req.topic === undefined && next < WORTH_TELLING && req.asked !== true) continue;
    let weighted = next;
    let w: { pm: number; bias: Bias } | null = null;
    if (weigh) {
      w = next >= WORTH_TELLING ? weigh(b.propId) : null;
      if (w) weighted = next + Math.floor((next * w.pm) / 1000);
      if (!plain || next > plain.score || (next === plain.score && b.id < plain.b.id)) plain = { b, score: next };
    }
    if (weighted > score || (weighted === score && b.id < (selected?.id ?? b.id))) {
      selected = b;
      score = weighted;
      freshness = fresh;
      tilt = w;
    }
  }
  if (!selected) return null;
  const probability = sigmoidPermille(Math.floor(((score - 500) * 1024) / 1000));
  const roll = ctx
    .rng('gossip', mixKey(speaker.id, listener.id, selected.id, req.interactionEventId ?? 0, 701))
    .int(1, 1000);
  if (req.topic === undefined && !req.deliberate && roll > probability) return null;
  const sourceProp = world.belief.props[selected.propId];
  if (!sourceProp) return null;
  const pred = ctx.content.predicates[sourceProp.pred];
  if (!pred) return null;
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
  if (!rumor) return null;
  let propId = selected.propId;
  let mutation: string | null = null;
  const mutRate =
    mode === 'confidence' || mode === 'charge'
      ? 0
      : clamp(
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
  return {
    req,
    beliefId: selected.id,
    propId,
    mutation,
    score,
    probability,
    roll,
    mutRate,
    mutationRoll,
    freshness,
    ...(tilt ? { director: carrierEffect(ctx, req, speaker.id, listener.id, selected, tilt, plain) } : {}),
  };
}

function tellTerms(plan: TransmitPlan) {
  return [
    term('belief', 'Topic score', plan.score),
    term('belief', 'Freshness per mille', plan.freshness),
    term('belief', 'Tell probability per mille', plan.req.deliberate ? 1000 : plan.probability),
    term('belief', 'Mutation probability per mille', plan.mutRate),
  ];
}
/** The N4 term on an off-screen telling (the fair-dice gate keeps it out of the PC's view). */
function directorCarrierTerm(plan: TransmitPlan) {
  return term('director', 'Director carrier weight (N4), per mille on the topic score', plan.director?.pm ?? 0);
}

/** Would the unweighted pick have told the same thing (same topic, and the talk still turned)? */
function carrierEffect(
  ctx: SimContext,
  req: TransmitRequest,
  speakerId: ActorId,
  listenerId: ActorId,
  selected: Belief,
  tilt: { pm: number; bias: Bias },
  plain: { b: Belief; score: number } | null,
): NonNullable<TransmitPlan['director']> {
  let plainTold = false;
  if (plain) {
    const p = sigmoidPermille(Math.floor(((plain.score - 500) * 1024) / 1000));
    const r = ctx
      .rng('gossip', mixKey(speakerId, listenerId, plain.b.id, req.interactionEventId ?? 0, 701))
      .int(1, 1000);
    plainTold = r <= p;
  }
  return {
    biasId: tilt.bias.id,
    pm: tilt.pm,
    flipped: plain?.b.id !== selected.id || !plainTold,
    plainBeliefId: plainTold && plain ? plain.b.id : null,
  };
}

/**
 * Tell it: the listener weighs the statement, the telling is logged (`belief.transmitted`,
 * private: teller and hearer), the hearer remembers who told them. `words` (social's talk lines)
 * voices how it was said and taken; its result rides on the event.
 */
export function commitTransmit(
  world: World,
  ctx: SimContext,
  plan: TransmitPlan,
  interactionEventId: EventId | null,
  words?: (outcome: TellOutcome) => TellWords | null,
): TransmitResult {
  const empty: TransmitResult = { told: false, rumorId: null, propId: null, mutation: null, listenerCredence: 0 };
  const req = plan.req;
  const mode = req.mode ?? 'news';
  const speaker = world.actors[req.speakerId];
  const listener = world.actors[req.listenerId];
  const selected = world.belief.beliefs[plan.beliefId];
  const rumor = selected?.rumorId !== null && selected ? world.belief.rumors[selected.rumorId] : undefined;
  const sourceProp = selected ? world.belief.props[selected.propId] : undefined;
  const pred = sourceProp ? ctx.content.predicates[sourceProp.pred] : undefined;
  if (!speaker || !listener || !selected || !rumor || !pred) return empty;
  const nudged = plan.director;
  if (nudged?.flipped) {
    const b = world.director?.plan?.biases.find((x) => x.id === nudged.biasId);
    if (b) noteNudge(world, b, speaker.id, nudged.plainBeliefId ?? 'nothing told', selected.id);
  }
  const channel = ctx.content.rumorChannels[req.channel];
  const propId = plan.propId;
  const mutation = plan.mutation;
  rumor.tellings++;
  rumor.lastToldAt = ctx.now;
  // A confidence is not an assertion in public; anything else said aloud is.
  if (mode !== 'confidence') selected.voiced = true;
  if (req.topic !== undefined) selected.conceal = false;
  if (!selected.toldTo.includes(listener.id)) {
    selected.toldTo.push(listener.id);
    if (selected.toldTo.length > 128) selected.toldTo.shift();
  }
  const prior = beliefOf(world, listener.id, propId);
  const listenerBefore = prior?.credence ?? 0;
  // Heard before: this claim, or any variant of its lineage (the novelty discount says so).
  const heardBefore = noveltyQ8(world, listener.id, rumor.id) < 256 || (prior?.credence ?? 0) >= 50;
  const { belief: b, applied } = receive(world, ctx, listener.id, propId, {
    type: req.channel === 'newspaper' ? 'document' : 'statement',
    dir: 1,
    sourceId: speaker.id,
    eventId: interactionEventId,
    rumorId: rumor.id,
    scalePct: channel?.credibility_pct ?? 100,
  });
  // Told in confidence, the hearer keeps it close, unless keeping things close is not in them.
  if (mode === 'confidence' && view3(listener.values.discretion) >= 0) b.conceal = true;
  const prop = world.belief.props[propId];
  const subject = prop?.args[0];
  const subjectId = subject?.kind === 'actor' ? subject.id : null;
  const person: TellOutcome['person'] =
    subjectId === speaker.id && hasPersonForm(world, ctx.content, propId, 'self')
      ? 'self'
      : subjectId === listener.id && hasPersonForm(world, ctx.content, propId, 'you')
        ? 'you'
        : 'other';
  const text = propText(world, ctx.content, propId);
  const outcome: TellOutcome = {
    speakerId: speaker.id,
    listenerId: listener.id,
    propId,
    said: person === 'other' ? text : propText(world, ctx.content, propId, person),
    text,
    subjectId,
    person,
    speakerCredence: selected.credence,
    listenerBefore,
    listenerAfter: b.credence,
    heardBefore,
    sourceId: selected.firstSourceId !== speaker.id ? selected.firstSourceId : null,
    kind: kindOf(ctx.content, world, propId),
    mutation,
    mode,
  };
  const voiced = words?.(outcome) ?? null;
  const eventId = ctx.emit({
    kind: 'belief.transmitted',
    ...(req.placeId === null ? {} : { place: req.placeId }),
    roles: [
      { actor: speaker.id, role: 'agent' },
      { actor: listener.id, role: 'listener' },
    ],
    visibility: 'private',
    importance: mutation ? 35 : 15,
    causes: interactionEventId === null ? [] : [interactionEventId],
    data: {
      speakerId: speaker.id,
      listenerId: listener.id,
      rumorId: rumor.id,
      propId,
      mutation,
      accepted: b.credence >= 50,
      text,
      credence: b.credence,
      sourceId: outcome.sourceId,
      mode,
      ...(voiced ? { line: voiced.line, lines: voiced.lines } : {}),
    },
    explain: {
      ...formula(
        'Choose a rumor to tell',
        [speaker.id, listener.id],
        plan.score,
        {
          'Topic score': plan.score,
          'Freshness per mille': plan.freshness,
          'Tell probability per mille': req.deliberate ? 1000 : plan.probability,
          'Mutation probability per mille': plan.mutRate,
        },
        'participants',
      ),
      ...(plan.director ? { terms: [...tellTerms(plan), directorCarrierTerm(plan)] } : {}),
      roll: { die: 1000, natural: plan.roll },
      ...(req.deliberate ? { note: 'Told on purpose: no roll for whether the talk turned that way.' } : {}),
      children: [
        {
          kind: 'check',
          label: 'Rumor mutation',
          subjects: [speaker.id],
          knowledge: 'omniscient',
          terms: [],
          roll: { die: 1000, natural: plan.mutationRoll },
          total: plan.mutationRoll,
          dc: { total: plan.mutRate, terms: [] },
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
    summary: text,
  });
  applied.memoryId = memoryId;
  if (pred.supernatural && b.credence > 40) addAnxiety(world, ctx, listener.id, Math.floor(b.credence / 5));
  for (const g of rowsOf(world.belief.grudges)) {
    const subject = sourceProp?.args[0];
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
        founding: [{ kind: 'memory', id: memoryId, label: text }],
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
  return { told: true, rumorId: rumor.id, propId, mutation, listenerCredence: b.credence, text, eventId };
}

/** Plan and commit in one go (callers outside an interaction: letters, the paper, tests). */
export function transmit(world: World, ctx: SimContext, req: TransmitRequest): TransmitResult {
  const plan = planTransmit(world, ctx, req);
  if (!plan) return { told: false, rumorId: null, propId: null, mutation: null, listenerCredence: 0 };
  return commitTransmit(world, ctx, plan, req.interactionEventId);
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
  const drives = sortedKeys(ctx.content.drives).filter((d) => ctx.content.drives[d]?.shadow_traits.includes(traitId));
  const pred =
    sortedKeys(ctx.content.predicates).find((key) => {
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

/** `suspicionOf` for every target at once, ascending target id (only targets with any suspicion). */
function suspicionsHeld(world: World, observerId: ActorId): Map<ActorId, number> {
  const byTarget = new Map<ActorId, number>();
  for (const id of world.belief.beliefsByHolder[observerId] ?? []) {
    const b = world.belief.beliefs[id];
    const p = b && world.belief.props[b.propId];
    const arg = p?.args[0];
    if (p?.suspicious && arg?.kind === 'actor')
      byTarget.set(arg.id as ActorId, Math.max(byTarget.get(arg.id as ActorId) ?? 0, b?.credence ?? 0));
  }
  return new Map([...byTarget].sort((x, y) => x[0] - y[0]));
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
  for (const g of grudgesHeldBy(world, actorId)) {
    if (g.target.kind !== 'actor') continue;
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
    // Only actors this holder suspects (credence >= 40) can matter: visit them in ascending id
    // order (the order a full actor scan gives) instead of scanning every actor per actor-hour.
    const suspected = suspicionsHeld(world, actorId);
    for (const id of suspected.keys()) {
      const target = world.actors[id];
      if (!target || target.id === actorId || target.placeId !== actor.placeId) continue;
      const suspicion = suspected.get(id) ?? 0;
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

export { registerMisfortune, reportMisfortune } from './misfortune.ts';
export { noveltyQ8 };

/** Cross-module shunning query: institutions can apply their own service/price effects. */
/**
 * Form a grudge from another module's evidence (13 §6.2: a knowingly broken loan gives a
 * restitution grudge). Emits `belief.grudge_formed` (inner). Returns the grudge id.
 */
export function formGrudge(
  world: World,
  ctx: SimContext,
  g: {
    holderId: ActorId;
    target: import('./state.ts').GrudgeTarget;
    aim: import('./state.ts').GrudgeAim;
    intensity: number;
    label: string;
    founding?: import('./state.ts').Grudge['founding'];
  },
): number {
  const row = makeGrudge(world, {
    holderId: g.holderId,
    target: g.target,
    founding: g.founding ?? [{ kind: 'belief', id: null, label: g.label }],
    intensity: g.intensity,
    aim: g.aim,
    public: false,
    since: ctx.now,
  });
  ctx.emit({
    kind: 'belief.grudge_formed',
    visibility: 'inner',
    roles: [
      { actor: g.holderId, role: 'subject' },
      ...(g.target.kind === 'actor' ? [{ actor: g.target.id, role: 'target' as const }] : []),
    ],
    data: {
      holderId: g.holderId,
      target: targetLabel(world, row.target),
      ...(g.target.kind === 'actor' ? { targetId: g.target.id } : {}),
      intensity: row.intensity,
      aim: row.aim,
    },
  });
  return row.id;
}

export function isShunning(world: World, holderId: ActorId, targetId: ActorId): boolean {
  return world.belief.persecutions.some(
    (p) => p.rung >= 3 && p.target.kind === 'actor' && p.target.id === targetId && p.shunnerIds.includes(holderId),
  );
}

export { grudgeTargetsOf } from './grudges.ts';

export { beliefSystem as regionBeliefHour } from './system.ts';
/** Ground-truth observer query, including Figures attached to the actor. No attribution changes. */
export function tensionBelief(world: World, id: ActorId) {
  const matches = (target: import('./state.ts').GrudgeTarget): boolean =>
    target.kind === 'actor'
      ? target.id === id
      : target.kind === 'household'
        ? target.id === world.actors[id]?.householdId
        : target.kind === 'figure'
          ? (world.belief.figures[target.id]?.attachedIds.includes(id) ?? false)
          : false;
  const grudges = rowsOf(world.belief.grudges).filter((g) => matches(g.target));
  const processes = world.belief.persecutions.filter((p) => matches(p.target));
  const rung = Math.max(0, ...processes.map((p) => p.rung));
  const rungPm = [0, 50, 150, 300, 500, 800, 1000][Math.min(6, rung)] ?? 0;
  const heat = Math.max(0, ...processes.map((p) => p.heat));
  return {
    social: Math.min(1000, grudges.reduce((sum, g) => sum + g.intensity * 10, 0) + rungPm),
    pursuit: Math.min(1000, rungPm + Math.floor((rungPm * Math.min(1000, heat)) / 1000)),
    hostileIds: [...new Set(grudges.filter((g) => g.intensity >= 40).map((g) => g.holderId))].sort((a, b) => a - b),
  };
}
