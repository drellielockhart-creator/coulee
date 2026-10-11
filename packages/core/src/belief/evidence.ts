/** Shared evidence accounting for observation, gossip, and authored history. */
import type { ContentBundle } from '../content.ts';
import { type Explain, term } from '../explain.ts';
import { type ActorId, asBeliefId, nextId, type PropId, type RumorId } from '../ids.ts';
import type { InitContext, SimContext } from '../sim/context.ts';
import { addOpinionReason, opinionOf, reasonsOf } from '../social/api.ts';
import type { World } from '../world.ts';
import { propText } from './api.ts';
import { clamp, logitStep, mulQ8, view3 } from './intmath.ts';
import type { Belief, Evidence } from './state.ts';

export function formula(
  label: string,
  subjects: ActorId[],
  total: number,
  values: Record<string, number>,
  knowledge: Explain['knowledge'] = 'self',
): Explain {
  return {
    kind: 'formula',
    label,
    subjects,
    knowledge,
    terms: Object.entries(values).map(([label, value]) => term('belief', label, value)),
    total,
    outcome: 'applied',
  };
}

export function ensureBelief(
  world: World,
  ctx: Pick<InitContext, 'content' | 'now'>,
  holderId: ActorId,
  propId: PropId,
): Belief {
  world.belief.beliefsByHolder[holderId] ??= [];
  const ids = world.belief.beliefsByHolder[holderId] ?? [];
  for (const id of ids) {
    const b = world.belief.beliefs[id];
    if (b?.propId === propId) return b;
  }
  const prop = world.belief.props[propId];
  const pred = prop && ctx.content.predicates[prop.pred];
  if (prop && pred) prop.suspicious = pred.supernatural || pred.kind_of !== undefined;
  let prior = pred?.prior ?? 20;
  if (pred?.kind_of) {
    const sup = view3(world.actors[holderId]?.values.superstition);
    prior = clamp(2 + 2 * sup + Math.floor(world.belief.misfortune / 50), 1, 40);
  }
  const id = asBeliefId(nextId(world.belief.counters, 'belief'));
  const b: Belief = {
    id,
    holderId,
    propId,
    credence: prior,
    evidence: [],
    firstHeard: ctx.now,
    firstSourceId: null,
    voiced: false,
    conceal: false,
    carry: 0,
    rumorId: null,
    echoes: {},
    toldTo: [],
    lastEvidenceAt: ctx.now,
    formed: false,
  };
  world.belief.beliefs[id] = b;
  ids.push(id);
  return b;
}

/** Shared ancestry includes OTHER variants of the same lineage, not just this proposition. */
export function noveltyQ8(world: World, holderId: ActorId, rumorId: RumorId | null): number {
  if (rumorId === null) return 256;
  let shared = 0;
  for (const id of world.belief.beliefsByHolder[holderId] ?? [])
    shared += world.belief.beliefs[id]?.echoes[rumorId] ?? 0;
  return Math.floor(512 / (2 + shared));
}

export function plausibilityQ8(world: World, content: ContentBundle, holderId: ActorId, propId: PropId): number {
  const prop = world.belief.props[propId];
  const pred = prop && content.predicates[prop.pred];
  if (!pred) return 256;
  const subject = prop.args[0];
  let p = 256;
  if (subject?.kind === 'actor') {
    const op = opinionOf(world, holderId, subject.id);
    const sign = pred.valence < 0 ? -1 : pred.valence > 0 ? 1 : 0;
    p = Math.floor((p * (100 + clamp(Math.floor((op.affection * sign) / 2), -50, 50))) / 100);
    if (sign < 0) p = Math.floor((p * (150 - Math.max(0, op.respect))) / 150);
  }
  if (pred.supernatural) p = Math.floor((p * (10 + 3 * view3(world.actors[holderId]?.values.superstition))) / 10);
  return clamp(p, 26, 640);
}

export function applyEvidence(
  world: World,
  ctx: InitContext | SimContext,
  holderId: ActorId,
  propId: PropId,
  evidence: Evidence,
  scalePct = 100,
): Belief {
  const b = ensureBelief(world, ctx, holderId, propId);
  const def = ctx.content.evidenceTypes[evidence.type];
  const actor = world.actors[holderId];
  const base = clamp(
    (def?.base_q8 ?? 128) +
      (def?.superstition_q8 ?? 0) * view3(actor?.values.superstition) +
      (def?.piety_q8 ?? 0) * view3(actor?.values.piety),
    0,
    1024,
  );
  const trust =
    evidence.sourceId === null || evidence.sourceId === holderId
      ? 256
      : 51 + Math.floor(((opinionOf(world, holderId, evidence.sourceId).trust + 100) * 333) / 200);
  const plausibility = plausibilityQ8(world, ctx.content, holderId, propId);
  const novelty = noveltyQ8(world, holderId, evidence.rumorId);
  let weight = Math.floor((mulQ8(mulQ8(mulQ8(base, trust), plausibility), novelty) * scalePct) / 100);
  if (b.clamp && b.clamp.until > ctx.now && evidence.dir > 0) {
    b.clamp.banked += weight;
    weight = Math.floor((weight * b.clamp.pct) / 100);
  }
  const before = b.credence;
  // Certain self-knowledge is not eroded by hearsay.
  if (before !== 0 && before !== 100) Object.assign(b, logitStep(before, b.carry, evidence.dir * weight));
  evidence.weight = weight;
  if (b.evidence.length === 0) b.firstSourceId = evidence.sourceId;
  b.evidence.push(evidence);
  if (b.evidence.length > 16) {
    let weakest = 0;
    for (let i = 1; i < b.evidence.length; i++)
      if ((b.evidence[i]?.weight ?? 0) < (b.evidence[weakest]?.weight ?? 0)) weakest = i;
    b.evidence.splice(weakest, 1);
  }
  b.lastEvidenceAt = ctx.now;
  if (evidence.rumorId !== null) {
    b.echoes[evidence.rumorId] = (b.echoes[evidence.rumorId] ?? 0) + 1;
    b.rumorId ??= evidence.rumorId;
  }
  if (b.credence > before && !b.conceal) {
    for (const p of world.belief.persecutions) if (p.charges.includes(propId)) p.lastFuelAt = ctx.now;
  }
  const explain = formula(
    'Weigh evidence',
    [holderId],
    b.credence,
    {
      'Prior credence': before,
      'Base Q8': base,
      'Trust Q8': trust,
      'Plausibility Q8': plausibility,
      'Novelty Q8': novelty,
      'Evidence Q8': weight,
      Direction: evidence.dir,
    },
    evidence.type === 'defense' || evidence.rumorId !== null ? 'omniscient' : 'self',
  );
  ctx.emit({
    kind: 'belief.evidence',
    roles: [{ actor: holderId, role: 'witness' }],
    visibility: 'inner',
    data: { holderId, propId, before, credence: b.credence },
    explain,
  });
  return b;
}

/**
 * A held claim about a person colors how the holder regards them (04 §6.2: opinions move only
 * through Reasons). Adds one Reason citing the belief, so its weight follows the credence
 * (social weighs a belief cite by 10 x credence) and fades as the belief does. The predicate's
 * valence sets the size: affection and trust follow it, and supernatural or chargeable claims
 * about a person add fear. Idempotent per belief.
 */
export function colorOpinion(world: World, ctx: SimContext, b: Belief): void {
  const prop = world.belief.props[b.propId];
  const pred = prop && ctx.content.predicates[prop.pred];
  const subject = prop?.args[0];
  if (!pred || !subject || subject.kind !== 'actor' || subject.id === b.holderId || pred.valence === 0) return;
  if (!world.actors[subject.id] || !world.actors[b.holderId]) return;
  if (reasonsOf(world, b.holderId, subject.id).some((r) => r.cites.kind === 'belief' && r.cites.id === b.id)) return;
  const v = pred.valence;
  const affection = clamp(Math.trunc((v * 3) / 10), -30, 30) + 0;
  const trust = v < 0 ? clamp(Math.trunc((v * 4) / 10), -35, 0) + 0 : clamp(Math.trunc(v / 5), 0, 15) + 0;
  const respect = v > 0 ? clamp(Math.trunc(v / 5), 0, 15) + 0 : 0;
  const fear = v < 0 && (pred.supernatural || pred.charge) ? clamp(Math.trunc(-v / 5), 0, 20) : 0;
  addOpinionReason(world, ctx, b.holderId, subject.id, {
    label: propText(world, ctx.content, b.propId),
    cites: { kind: 'belief', id: b.id, propId: b.propId },
    delta: { affection, respect, trust, fear },
    since: ctx.now,
  });
}
