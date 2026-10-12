/**
 * Interaction preconditions and Comme-il-Faut volition (04 §10). OWNER: module:social.
 *
 * Volition drivers are the vocabulary documented on VOLITION_DRIVER_PREFIXES in
 * packages/content/src/schema/social.ts; every contribution is integer math and becomes a
 * named ExplainTerm, so the choice is legible (P1).
 */
import { type ActorCore, abilityMod, hasCondition, type Place, shortName } from '../actor.ts';
import { hasRumorFor, isShunning } from '../belief/api.ts';
import type { ContentBundle, InteractionDef, ValueId } from '../content.ts';
import { VALUES } from '../content.ts';
import { type ExplainTerm, signed, term } from '../explain.ts';
import type { ActorId, PlaceId } from '../ids.ts';
import { needValue } from '../needs/api.ts';
import { effectiveTraits, psycheOf } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import { MINUTES_PER_DAY } from '../time.ts';
import type { World } from '../world.ts';
import { type MemoryDigest, memoryDigest } from './memory.ts';
import { clampInt, floorDiv } from './model.ts';
import { grievance, isAcquainted, opinionOf, opinionRecord, owedCents, owedFavors } from './opinion.ts';
import type { OpinionDims } from './state.ts';
import { isEstranged, wearinessTerm } from './strife.ts';
import { ageYears, tuningOf, valueView } from './tuning.ts';

/** Everything a volition/precondition evaluation reads about one (initiator, target) pair. */
export interface Pair {
  world: World;
  ctx: SimContext;
  content: ContentBundle;
  initiator: ActorCore;
  target: ActorCore;
  placeId: PlaceId | null;
  place: Place | undefined;
  /** Others present besides the pair (audience size). */
  onlookers: number;
  /** Lazily computed and cached. */
  cache: {
    opinion?: OpinionDims;
    targetOpinion?: OpinionDims;
    digest?: MemoryDigest;
    /** Shared lazy batch for a read-only proposal pass. */
    digests?: () => Map<ActorId, MemoryDigest>;
    rumor?: boolean;
    grudge?: number;
    kin?: boolean;
    eligible?: boolean;
  };
}

export function makePair(
  world: World,
  ctx: SimContext,
  initiatorId: ActorId,
  targetId: ActorId,
  placeId: PlaceId | null,
  onlookers: number,
): Pair | null {
  const initiator = world.actors[initiatorId];
  const target = world.actors[targetId];
  if (!initiator || !target) return null;
  return {
    world,
    ctx,
    content: ctx.content,
    initiator,
    target,
    placeId,
    place: placeId !== null ? world.places[placeId] : undefined,
    onlookers,
    cache: {},
  };
}

export const pairOpinion = (p: Pair): OpinionDims =>
  (p.cache.opinion ??= opinionOf(p.world, p.initiator.id, p.target.id));
export const pairTargetOpinion = (p: Pair): OpinionDims =>
  (p.cache.targetOpinion ??= opinionOf(p.world, p.target.id, p.initiator.id));
export const pairDigest = (p: Pair): MemoryDigest =>
  (p.cache.digest ??= p.cache.digests
    ? (p.cache.digests().get(p.target.id) ?? { done: {}, did: {}, negative: 0 })
    : memoryDigest(p.world, p.content, p.initiator.id, p.target.id));
const pairRumor = (p: Pair): boolean =>
  (p.cache.rumor ??= hasRumorFor(p.world, p.initiator.id, p.target.id, p.content));
export const pairGrudge = (p: Pair): number =>
  (p.cache.grudge ??= grievance(p.world, p.content, p.initiator.id, p.target.id, pairDigest(p)));

/** Kin per `kin_kinds` (structural edges), either direction. */
export function areKinBy(world: World, content: ContentBundle, a: ActorId, b: ActorId): boolean {
  const kinds = tuningOf(content).kin_kinds;
  for (const r of world.social.relationships) {
    if (kinds.includes(r.kind) && ((r.a === a && r.b === b) || (r.a === b && r.b === a))) return true;
  }
  return false;
}
const pairKin = (p: Pair): boolean => (p.cache.kin ??= areKinBy(p.world, p.content, p.initiator.id, p.target.id));

function edge(world: World, a: ActorId, b: ActorId, kind: string) {
  return world.social.relationships.find(
    (r) => r.kind === kind && ((r.a === a && r.b === b) || (r.a === b && r.b === a)),
  );
}

function boundElsewhere(world: World, x: ActorId, other: ActorId): boolean {
  for (const r of world.social.relationships) {
    if (r.kind !== 'spouse' && r.kind !== 'betrothed') continue;
    if (r.a === x && r.b !== other) return true;
    if (r.b === x && r.a !== other) return true;
  }
  return false;
}

/** Courtship eligibility (social_tuning: ages, sexes, unattached, not kin). */
export function eligible(p: Pair): boolean {
  if (p.cache.eligible !== undefined) return p.cache.eligible;
  const t = tuningOf(p.content);
  const now = p.ctx.now;
  let ok =
    ageYears(p.initiator, now) >= t.courtship_min_age &&
    ageYears(p.target, now) >= t.courtship_min_age &&
    (!t.courtship_opposite_sex || p.initiator.sex !== p.target.sex) &&
    !pairKin(p);
  if (
    ok &&
    (boundElsewhere(p.world, p.initiator.id, p.target.id) || boundElsewhere(p.world, p.target.id, p.initiator.id))
  )
    ok = false;
  // Already promised to each other: courtship moves are over.
  if (
    ok &&
    (edge(p.world, p.initiator.id, p.target.id, 'betrothed') || edge(p.world, p.initiator.id, p.target.id, 'spouse'))
  )
    ok = false;
  p.cache.eligible = ok;
  return ok;
}

/** Courtship attraction 0..100 (0 if not eligible). */
export function attraction(p: Pair): number {
  if (!eligible(p)) return 0;
  const op = pairOpinion(p);
  const fam = opinionRecord(p.world, p.initiator.id, p.target.id)?.familiarity ?? 0;
  const cha = abilityMod(p.target.sheet.abilities.cha);
  const courting = edge(p.world, p.initiator.id, p.target.id, 'courting') ? 10 : 0;
  return clampInt(20 + floorDiv(op.affection, 2) + floorDiv(fam, 50) + 5 * cha + courting, 0, 100);
}

/** Does `debtor` owe `creditor` the given kind of debt? */
export function owesBy(world: World, creditor: ActorId, debtor: ActorId, debt: 'any' | 'cents' | 'favors'): boolean {
  const c = owedCents(world, creditor, debtor) > 0;
  const f = owedFavors(world, creditor, debtor) > 0;
  return debt === 'cents' ? c : debt === 'favors' ? f : c || f;
}

const anxietyOf = (world: World, id: ActorId): number => clampInt(psycheOf(world, id)?.anxiety ?? 0, 0, 1000);

export type RequireMode = 'spontaneous' | 'urge' | 'forced';

/**
 * Preconditions (04 §10). Structural ones always hold; opinion gates (affection, trust,
 * respect, fear, familiarity, grudge) apply only to spontaneous choices and are waived by
 * `waive_opinion_if` conditions. Cooldowns apply unless `forced` (escalation).
 * Returns null when it may happen, else a short reason.
 */
export function requiresFail(p: Pair, def: InteractionDef, mode: RequireMode): string | null {
  const q = def.requires;
  const w = p.world;
  const i = p.initiator.id;
  const tg = p.target.id;
  const now = p.ctx.now;
  if (i === tg) return 'self';
  if (mode !== 'forced') {
    const until = opinionRecord(w, i, tg)?.cooldowns[def.id];
    if (until !== undefined && until > now) return 'cooldown';
    // Not on speaking terms (strife.ts): only amends pass between them.
    if (isEstranged(w, i, tg) && !def.tags.some((x) => tuningOf(p.content).estranged_allow_tags.includes(x)))
      return 'not speaking';
  }
  const acquainted = isAcquainted(w, i, tg);
  if (q.acquainted && !acquainted) return 'not acquainted';
  if (q.stranger && acquainted) return 'already acquainted';
  if (q.min_age > 0 && ageYears(p.initiator, now) < q.min_age) return 'too young';
  if (q.target_min_age > 0 && ageYears(p.target, now) < q.target_min_age) return 'target too young';
  const tags = p.place?.tags ?? [];
  if (q.venue_tags.length > 0 && !q.venue_tags.some((x) => tags.includes(x))) return 'wrong venue';
  if (q.not_venue_tags.some((x) => tags.includes(x))) return 'not here';
  if (q.role) {
    const occ = p.content.occupations[p.initiator.occupationId];
    if (!occ?.roles.includes(q.role)) return 'no office';
  }
  for (const v of VALUES) {
    const min = q.initiator_values[v as ValueId];
    if (min !== undefined && valueView(p.initiator, v) < min) return `${v} too low`;
  }
  if (q.kin && !pairKin(p)) return 'not kin';
  if (q.not_kin && pairKin(p)) return 'kin';
  if (q.relationship) {
    const e = edge(w, i, tg, q.relationship);
    if (!e) return `no ${q.relationship}`;
    if (q.relationship_min_days > 0 && now - e.since < q.relationship_min_days * MINUTES_PER_DAY) return 'too soon';
  }
  if (q.no_relationship && edge(w, i, tg, q.no_relationship)) return `already ${q.no_relationship}`;
  if (q.eligible && !eligible(p)) return 'not eligible';
  if (q.target_owes && !owesBy(w, i, tg, q.debt)) return 'owed nothing';
  if (q.initiator_owes && !owesBy(w, tg, i, q.debt)) return 'owes nothing';
  if (q.initiator_remembers.length > 0) {
    const d = pairDigest(p).done;
    if (!q.initiator_remembers.some((k) => (d[k] ?? 0) >= 100)) return 'nothing to answer';
  }
  if (q.initiator_did.length > 0) {
    const d = pairDigest(p).did;
    if (!q.initiator_did.some((k) => (d[k] ?? 0) >= 100)) return 'nothing to atone for';
  }
  if (q.target_min_anxiety > 0 && anxietyOf(w, tg) < q.target_min_anxiety) return 'target at ease';
  if (mode !== 'spontaneous') return null;
  // hasRumorFor is belief's cheap estimate; a chosen gossip urge goes to transmit(), which
  // decides for real (and may answer told: false).
  if (q.rumor_available && !pairRumor(p)) return 'no news';
  if (q.waive_opinion_if.some((c) => hasCondition(p.initiator, c))) return null;
  const op = pairOpinion(p);
  if (q.min_affection !== undefined && op.affection < q.min_affection) return 'not fond enough';
  if (q.max_affection !== undefined && op.affection > q.max_affection) return 'too fond';
  if (q.min_trust !== undefined && op.trust < q.min_trust) return 'not trusted';
  if (q.max_trust !== undefined && op.trust > q.max_trust) return 'too trusting';
  if (q.min_respect !== undefined && op.respect < q.min_respect) return 'no respect';
  if (q.min_fear !== undefined && op.fear < q.min_fear) return 'not afraid';
  if (q.max_fear !== undefined && op.fear > q.max_fear) return 'too afraid';
  if (q.min_familiarity > 0 && (opinionRecord(w, i, tg)?.familiarity ?? 0) < q.min_familiarity)
    return 'barely know them';
  if (q.min_grudge > 0 && pairGrudge(p) < q.min_grudge) return 'no grudge';
  return null;
}

const DIM_LABEL: Record<string, string> = { affection: 'Affection', respect: 'Respect', trust: 'Trust', fear: 'Fear' };

/** Volition score and its named terms (no noise). */
export function volition(p: Pair, def: InteractionDef): { score: number; terms: ExplainTerm[] } {
  const terms: ExplainTerm[] = [];
  const w = p.world;
  const i = p.initiator.id;
  const tg = p.target.id;
  for (const v of def.volition) {
    const [prefix, arg] = v.driver.split(':') as [string, string | undefined];
    const wt = v.weight;
    let value = 0;
    let label = v.driver;
    let source = 'other';
    switch (prefix) {
      case 'need': {
        const deficit = floorDiv(1000 - needValue(w, i, arg ?? ''), 10);
        value = floorDiv(deficit * wt, 100);
        label = `${arg} want ${deficit}`;
        source = 'need';
        break;
      }
      case 'target_need': {
        const deficit = floorDiv(1000 - needValue(w, tg, arg ?? ''), 10);
        value = floorDiv(deficit * wt, 100);
        label = `their ${arg} want ${deficit}`;
        source = 'need';
        break;
      }
      case 'value': {
        const view = valueView(p.initiator, arg as ValueId);
        value = view * wt;
        label = `${arg} ${signed(view)}`;
        source = 'value';
        break;
      }
      case 'target_value': {
        const view = valueView(p.target, arg as ValueId);
        value = view * wt;
        label = `their ${arg} ${signed(view)}`;
        source = 'value';
        break;
      }
      case 'opinion': {
        const d = pairOpinion(p)[arg as keyof OpinionDims] ?? 0;
        value = floorDiv(d * wt, 100);
        label = `${DIM_LABEL[arg ?? ''] ?? arg} ${signed(d)}`;
        source = 'opinion';
        break;
      }
      case 'trait':
        if (effectiveTraits(p.world, p.initiator.id).includes(arg ?? '')) value = wt;
        label = `trait ${arg}`;
        source = 'trait';
        break;
      case 'condition':
        if (hasCondition(p.initiator, arg ?? '')) value = wt;
        label = `${arg}`;
        source = 'condition';
        break;
      case 'venue':
        if ((p.place?.tags ?? []).includes(arg ?? '')) value = wt;
        label = `at the ${arg}`;
        source = 'place';
        break;
      case 'remembers': {
        const s = pairDigest(p).done[arg ?? ''] ?? 0;
        value = floorDiv(s * wt, 1000);
        label = `remembers ${arg} (${s})`;
        source = 'memory';
        break;
      }
      case 'did': {
        const s = pairDigest(p).did[arg ?? ''] ?? 0;
        value = floorDiv(s * wt, 1000);
        label = `did ${arg} (${s})`;
        source = 'memory';
        break;
      }
      case 'grudge': {
        const g = pairGrudge(p);
        value = floorDiv(g * wt, 100);
        label = `grievance ${g}`;
        source = 'memory';
        break;
      }
      case 'rumor':
        if (pairRumor(p)) value = wt;
        label = 'has news';
        source = 'belief';
        break;
      case 'kin':
        if (pairKin(p)) value = wt;
        label = 'kin';
        source = 'other';
        break;
      case 'household':
        if (p.initiator.householdId === p.target.householdId) value = wt;
        label = 'same household';
        break;
      case 'stranger':
        if (!isAcquainted(w, i, tg)) value = wt;
        label = 'a stranger';
        break;
      case 'familiarity': {
        const f = opinionRecord(w, i, tg)?.familiarity ?? 0;
        value = floorDiv(f * wt, 1000);
        label = `familiarity ${f}`;
        break;
      }
      case 'owed_cents': {
        const c = owedCents(w, i, tg);
        value = floorDiv(Math.min(100, floorDiv(c, 10)) * wt, 100);
        label = `owed ${c}¢`;
        break;
      }
      case 'owes':
        if (owedCents(w, tg, i) > 0 || owedFavors(w, tg, i) > 0) value = wt;
        label = 'in their debt';
        break;
      case 'favors_owed': {
        const f = Math.min(5, owedFavors(w, tg, i));
        value = f * wt;
        label = `owes ${f} favors`;
        break;
      }
      case 'anxiety': {
        const a = anxietyOf(w, i);
        value = floorDiv(a * wt, 1000);
        label = `anxiety ${a}`;
        source = 'psyche';
        break;
      }
      case 'target_anxiety': {
        const a = anxietyOf(w, tg);
        value = floorDiv(a * wt, 1000);
        label = `their anxiety ${a}`;
        source = 'psyche';
        break;
      }
      case 'attraction': {
        const a = attraction(p);
        value = floorDiv(a * wt, 100);
        label = `attraction ${a}`;
        break;
      }
      case 'sabbath':
        if (p.ctx.cal.isSabbath) value = wt;
        label = 'the Sabbath';
        break;
      case 'audience': {
        const n = Math.min(10, p.onlookers);
        value = floorDiv(n * wt, 10);
        label = `${n} looking on`;
        break;
      }
      default:
        value = 0;
    }
    if (value !== 0) terms.push(term(source, `${label} ×${wt}`, value));
  }
  // Shunning (04 §9.2 rung 3): whoever shuns the accused withholds every ordinary kindness.
  if (!def.tags.includes('hostile') && isShunning(w, i, tg)) {
    const pen = tuningOf(p.content).shun_volition_penalty;
    if (pen > 0) terms.push(term('belief', 'Shunning them', -pen));
  }
  let score = 0;
  for (const t of terms) score += t.value;
  // A quarrel tires (strife.ts): each hostile act between them lately scales the wish down.
  if (def.tags.includes('hostile')) {
    const weary = wearinessTerm(w, p.content, i, tg, p.ctx.now, score);
    if (weary) {
      terms.push(weary);
      score += weary.value;
    }
  }
  return { score, terms };
}

export const targetLabel = (p: Pair): string => shortName(p.target);
