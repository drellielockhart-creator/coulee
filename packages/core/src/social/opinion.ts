/**
 * Opinions (04 §6): base priors, Reasons weighted by what they cite, the reason cap with an
 * "other" bucket, volatile mood, familiarity, the obligation ledger, and derived labels.
 * OWNER: module:social.
 *
 *   value(dim) = clamp(base + Σ floorDiv(reason.delta × strength(reason), 1000) + volatile)
 *   strength   = salience of the cited memory (0..1000) | 10 × credence of the cited belief
 *                | 1000 for a live relationship edge or a scenario seed | the bucket's strength
 *
 * Nothing here writes an opinion value: callers add Reasons, and the cited memories and
 * beliefs change on their own (decay, softening, credence updates).
 */
import { credenceOf } from '../belief/api.ts';
import type { ContentBundle } from '../content.ts';
import { VALUES } from '../content.ts';
import type { ActorId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import { calendarAt, type GameMinute } from '../time.ts';
import type { World } from '../world.ts';
import type { ConsolidationMerge, MemoryDigest } from './memory.ts';
import { memoryDigest } from './memory.ts';
import {
  addDims,
  ceilDiv,
  clampDims,
  clampInt,
  dimsMagnitude,
  emptyOpinion,
  floorDiv,
  weightDims,
  ZERO_DIMS,
} from './model.ts';
import type { Opinion, OpinionDims, OpinionReason, Relationship } from './state.ts';
import { tuningOf, valueView } from './tuning.ts';

// ---------------------------------------------------------------- reading

export function opinionRecord(world: World, from: ActorId, to: ActorId): Opinion | undefined {
  return world.social.opinions[from]?.[to];
}

/** Acquainted = the holder has an opinion record of the target. */
export function isAcquainted(world: World, from: ActorId, to: ActorId): boolean {
  return opinionRecord(world, from, to) !== undefined;
}

function hasEdge(world: World, a: ActorId, b: ActorId, kind: string): boolean {
  for (const r of world.social.relationships) {
    if (r.kind === kind && ((r.a === a && r.b === b) || (r.a === b && r.b === a))) return true;
  }
  return false;
}

/** Weight 0..1000 of a reason held by `from` about `to` (04 §6.2). */
export function reasonStrength(world: World, from: ActorId, to: ActorId, r: OpinionReason): number {
  const c = r.cites;
  switch (c.kind) {
    case 'memory': {
      const m = world.social.memories[c.id];
      return m && m.ownerId === from ? clampInt(m.salience, 0, 1000) : 0;
    }
    case 'belief':
      // Without the prop id the credence cannot be read through belief/api: full weight.
      return c.propId !== undefined ? clampInt(10 * credenceOf(world, from, c.propId), 0, 1000) : 1000;
    case 'relationship':
      return hasEdge(world, from, to, c.rel) ? 1000 : 0;
    case 'seed':
      return 1000;
    case 'other':
    case 'defense':
      return clampInt(c.strength, 0, 1000);
  }
}

/** The reason's current contribution (weighted delta). */
export function reasonContribution(world: World, from: ActorId, to: ActorId, r: OpinionReason): OpinionDims {
  return weightDims(r.delta, reasonStrength(world, from, to, r));
}

/** Unclamped sum base + Σ weighted reasons + volatile (for tests and the dossier). */
export function opinionSum(world: World, from: ActorId, to: ActorId): OpinionDims {
  const op = opinionRecord(world, from, to);
  if (!op) return { ...ZERO_DIMS };
  let sum = { ...op.base };
  for (const r of op.reasons) sum = addDims(sum, reasonContribution(world, from, to, r));
  return addDims(sum, op.volatile);
}

/** Current opinion of `from` toward `to`, clamped (Fear 0..100, others −100..100). */
export function opinionOf(world: World, from: ActorId, to: ActorId): OpinionDims {
  return clampDims(opinionSum(world, from, to));
}

/**
 * Derived label (04 §6.1): Friend, Enemy, Cowed, Rival, Admirer, or '' — labels on numbers.
 * With `prev`, Friend and Enemy hold with hysteresis (enter Friend at Affection > 40 and Trust
 * > 20, leave below 25 or 10; enter Enemy below −40, leave above −25), so a label does not
 * flicker with the day's mood.
 */
export function opinionLabel(d: OpinionDims, prev?: string): string {
  if (prev === 'Friend' && d.affection >= 25 && d.trust >= 10) return 'Friend';
  if (prev === 'Enemy' && d.affection <= -25) return 'Enemy';
  if (d.affection > 40 && d.trust > 20) return 'Friend';
  if (d.affection < -40) return 'Enemy';
  if (d.fear > 50 && d.affection < 0) return 'Cowed';
  if (d.respect > 20 && d.affection < -20) return 'Rival';
  if (d.respect > 50) return 'Admirer';
  return '';
}

/** The settled opinion: base + Reasons, without the day's volatile mood (labels read this). */
export function settledOpinion(world: World, from: ActorId, to: ActorId): OpinionDims {
  const op = opinionRecord(world, from, to);
  if (!op) return { ...ZERO_DIMS };
  let sum = { ...op.base };
  for (const r of op.reasons) sum = addDims(sum, reasonContribution(world, from, to, r));
  return clampDims(sum);
}

// ---------------------------------------------------------------- base priors

/** 04 §3.1 compatibility on Affection: clamp(−cap, cap, offset − Σ w·|a.v − b.v|). */
export function compatibility(world: World, content: ContentBundle, a: ActorId, b: ActorId): number {
  const t = tuningOf(content);
  const x = world.actors[a];
  const y = world.actors[b];
  if (!x || !y) return 0;
  let s = 0;
  for (const v of VALUES) {
    const w = t.compat_weights[v] ?? 0;
    if (w !== 0) s += w * Math.abs(valueView(x, v) - valueView(y, v));
  }
  return clampInt(t.compat_offset - s, -t.compat_cap, t.compat_cap);
}

/** Base opinion from compatibility, structural edges (04 §7.1) and the household prior. */
export function computeBase(world: World, content: ContentBundle, from: ActorId, to: ActorId): OpinionDims {
  const t = tuningOf(content);
  let base: OpinionDims = { ...ZERO_DIMS, affection: compatibility(world, content, from, to) };
  let kin = false;
  for (const r of world.social.relationships) {
    const fwd = r.a === from && r.b === to;
    const back = r.a === to && r.b === from;
    if (!fwd && !back) continue;
    if (t.kin_kinds.includes(r.kind)) kin = true;
    const prior = t.relationship_priors.find((p) => p.kind === r.kind);
    if (!prior) continue;
    base = addDims(base, fwd ? prior.a_to_b : prior.b_to_a);
  }
  const fa = world.actors[from];
  const ta = world.actors[to];
  if (!kin && fa && ta && fa.householdId === ta.householdId) base = addDims(base, t.household_prior);
  return clampDims(base);
}

/** Recompute both directions' bases after a structural change (a new or ended edge). */
export function refreshBase(world: World, content: ContentBundle, a: ActorId, b: ActorId): void {
  const ab = opinionRecord(world, a, b);
  if (ab) ab.base = computeBase(world, content, a, b);
  const ba = opinionRecord(world, b, a);
  if (ba) ba.base = computeBase(world, content, b, a);
}

function evictable(world: World, from: ActorId, op: Opinion): boolean {
  if (op.reasons.length > 0) return false;
  if (op.obligation.cents !== 0 || op.obligation.favors !== 0) return false;
  for (const r of world.social.relationships) {
    if ((r.a === from && r.b === op.targetId) || (r.b === from && r.a === op.targetId)) return false;
  }
  return true;
}

/**
 * The holder's opinion record of `to`, created (with its base) if missing. Creating past
 * `max_opinions` evicts the least familiar record that holds nothing (04 §13.2 Dunbar cap).
 */
export function ensureOpinion(world: World, content: ContentBundle, from: ActorId, to: ActorId): Opinion {
  const table = world.social.opinions[from] ?? {};
  world.social.opinions[from] = table;
  const have = table[to];
  if (have) return have;
  const cap = tuningOf(content).max_opinions;
  const keys = Object.keys(table)
    .map(Number)
    .sort((x, y) => x - y);
  if (keys.length >= cap) {
    let worst: Opinion | null = null;
    for (const k of keys) {
      const op = table[k];
      if (!op || !evictable(world, from, op)) continue;
      if (worst === null || op.familiarity < worst.familiarity) worst = op;
    }
    if (worst) delete table[worst.targetId];
  }
  const op = emptyOpinion(to);
  op.base = computeBase(world, content, from, to);
  op.label = opinionLabel(clampDims(addDims(op.base, op.volatile)));
  table[to] = op;
  return op;
}

// ---------------------------------------------------------------- reasons

const isBucket = (r: OpinionReason): boolean => r.cites.kind === 'other';

/** The folded buckets by valence (04 §6.2 "other reasons", named for what they hold). */
const BUCKET_GRIEF = 'Old quarrels';
const BUCKET_KIND = 'Old kindnesses';
/** "(5 times since May 20)" appended to a merged Reason's label. */
const COUNT_RE = / \((\d+) times since [A-Z][a-z]+ \d+\)$/;

function monthDayOf(t: number): string {
  const c = calendarAt(t as GameMinute);
  return `${c.monthName} ${c.day}`;
}

/**
 * Two Reasons with the same label (the same wrong, again) fold into one counted Reason before
 * anything is evicted: "Came at me with fists at Hurd House (5 times since May 20)". It cites
 * the newer memory, with the delta scaled so the pair's current weight is kept. Returns true
 * if a merge happened.
 */
function mergeDuplicate(world: World, from: ActorId, to: ActorId, op: Opinion): boolean {
  const base = (r: OpinionReason) => r.label.replace(COUNT_RE, '');
  for (let i = op.reasons.length - 1; i >= 0; i--) {
    const a = op.reasons[i] as OpinionReason;
    if (isBucket(a) || a.cites.kind !== 'memory') continue;
    for (let j = 0; j < i; j++) {
      const b = op.reasons[j] as OpinionReason;
      if (isBucket(b) || b.cites.kind !== 'memory' || base(b) !== base(a)) continue;
      const [older, newer] = b.since <= a.since ? [b, a] : [a, b];
      const s = Math.max(1, reasonStrength(world, from, to, newer));
      const sum = addDims(reasonContribution(world, from, to, a), reasonContribution(world, from, to, b));
      const scale = (v: number) => clampInt(Math.round((v * 1000) / s), -100, 100);
      const n = (Number(COUNT_RE.exec(a.label)?.[1] ?? 1) || 1) + (Number(COUNT_RE.exec(b.label)?.[1] ?? 1) || 1);
      const first = older.since;
      const merged: OpinionReason = {
        label: `${base(a)} (${n} times since ${monthDayOf(first)})`,
        cites: newer.cites,
        delta: {
          affection: scale(sum.affection),
          respect: scale(sum.respect),
          trust: scale(sum.trust),
          fear: scale(sum.fear),
        },
        since: first,
        ...(newer.viaDefense !== undefined ? { viaDefense: newer.viaDefense } : {}),
      };
      op.reasons.splice(i, 1);
      op.reasons[j] = merged;
      return true;
    }
  }
  return false;
}

/**
 * Add a Reason (the only way opinions change, 04 §6.2). Past `max_reasons` the weakest
 * reason (by current contribution, then oldest) folds into the "other reasons" bucket at
 * its current weighted value; the bucket then fades with `bucket_tau_days`.
 */
export function addReason(
  world: World,
  content: ContentBundle,
  from: ActorId,
  to: ActorId,
  reason: OpinionReason,
  now: GameMinute,
): void {
  const op = ensureOpinion(world, content, from, to);
  op.reasons.push(reason);
  enforceReasonCap(world, content, from, to, op, now);
}

export function enforceReasonCap(
  world: World,
  content: ContentBundle,
  from: ActorId,
  to: ActorId,
  op: Opinion,
  now: GameMinute,
): void {
  const cap = tuningOf(content).max_reasons;
  for (;;) {
    const regular = op.reasons.filter((r) => !isBucket(r));
    if (regular.length <= cap) return;
    if (mergeDuplicate(world, from, to, op)) continue;
    let weakestIdx = -1;
    let weakestMag = 0;
    for (let i = 0; i < op.reasons.length; i++) {
      const r = op.reasons[i] as OpinionReason;
      if (isBucket(r)) continue;
      const mag = dimsMagnitude(reasonContribution(world, from, to, r));
      const w = weakestIdx >= 0 ? (op.reasons[weakestIdx] as OpinionReason) : null;
      if (w === null || mag < weakestMag || (mag === weakestMag && r.since < w.since)) {
        weakestIdx = i;
        weakestMag = mag;
      }
    }
    if (weakestIdx < 0) return;
    const weakest = op.reasons[weakestIdx] as OpinionReason;
    const folded = reasonContribution(world, from, to, weakest);
    op.reasons.splice(weakestIdx, 1);
    // Fold by kind: grievances into "Old quarrels", kindnesses into "Old kindnesses".
    const weight = folded.affection + folded.respect + folded.trust - folded.fear;
    const label = weight < 0 ? BUCKET_GRIEF : BUCKET_KIND;
    const bucketIdx = op.reasons.findIndex((r) => isBucket(r) && (r.label === label || r.label === 'Other reasons'));
    const prev =
      bucketIdx >= 0 ? reasonContribution(world, from, to, op.reasons[bucketIdx] as OpinionReason) : ZERO_DIMS;
    const sum = addDims(prev, folded);
    const delta: OpinionDims = {
      affection: clampInt(sum.affection, -100, 100),
      respect: clampInt(sum.respect, -100, 100),
      trust: clampInt(sum.trust, -100, 100),
      fear: clampInt(sum.fear, -100, 100),
    };
    const bucket: OpinionReason = {
      label,
      cites: { kind: 'other', strength: 1000 },
      delta,
      since: now,
    };
    if (bucketIdx >= 0) op.reasons[bucketIdx] = bucket;
    else op.reasons.push(bucket);
  }
}

/** Short-term mood toward someone (chat): goes to `volatile`, capped, fades daily. */
export function addVolatile(world: World, content: ContentBundle, from: ActorId, to: ActorId, d: OpinionDims): void {
  const op = ensureOpinion(world, content, from, to);
  const cap = tuningOf(content).volatile_cap;
  op.volatile = {
    affection: clampInt(op.volatile.affection + d.affection, -cap, cap),
    respect: clampInt(op.volatile.respect + d.respect, -cap, cap),
    trust: clampInt(op.volatile.trust + d.trust, -cap, cap),
    fear: clampInt(op.volatile.fear + d.fear, -cap, cap),
  };
}

/** Re-point Reasons that cited memories merged by consolidation to the Summary memory. */
export function repointReasons(world: World, merges: readonly ConsolidationMerge[]): void {
  for (const mg of merges) {
    if (mg.aboutId === null) continue;
    const op = opinionRecord(world, mg.ownerId, mg.aboutId);
    if (!op) continue;
    const gone = new Set<number>(mg.merged as number[]);
    const citing: number[] = [];
    for (let i = 0; i < op.reasons.length; i++) {
      const c = (op.reasons[i] as OpinionReason).cites;
      if (c.kind === 'memory' && (gone.has(c.id as number) || c.id === mg.into)) citing.push(i);
    }
    if (citing.length === 0) continue;
    const first = op.reasons[citing[0] as number] as OpinionReason;
    let delta = { ...first.delta };
    let since = first.since;
    for (const i of citing.slice(1)) {
      const r = op.reasons[i] as OpinionReason;
      delta = addDims(delta, r.delta);
      if (r.since < since) since = r.since;
    }
    const summary = world.social.memories[mg.into]?.summary ?? first.label;
    const merged: OpinionReason = {
      label: citing.length > 1 ? summary : first.label,
      cites: { kind: 'memory', id: mg.into },
      delta: {
        affection: clampInt(delta.affection, -100, 100),
        respect: clampInt(delta.respect, -100, 100),
        trust: clampInt(delta.trust, -100, 100),
        fear: clampInt(delta.fear, -100, 100),
      },
      since,
      ...(first.viaDefense !== undefined ? { viaDefense: first.viaDefense } : {}),
    };
    const keep = op.reasons.filter((_, i) => !citing.includes(i));
    keep.push(merged);
    op.reasons = keep;
  }
}

// ---------------------------------------------------------------- ledger, familiarity, grievance

/**
 * Obligation ledger (04 §6.1), mirrored: `delta` positive = the target now owes the
 * initiator. The initiator's record gains it; the target's record loses it.
 */
export function adjustLedger(
  world: World,
  content: ContentBundle,
  initiator: ActorId,
  target: ActorId,
  delta: { favors: number; cents: number },
): void {
  if (delta.favors === 0 && delta.cents === 0) return;
  const a = ensureOpinion(world, content, initiator, target);
  const b = ensureOpinion(world, content, target, initiator);
  a.obligation = { favors: a.obligation.favors + delta.favors, cents: a.obligation.cents + delta.cents };
  b.obligation = { favors: b.obligation.favors - delta.favors, cents: b.obligation.cents - delta.cents };
}

/** Cents `debtor` owes `creditor` (0 if none). */
export function owedCents(world: World, creditor: ActorId, debtor: ActorId): number {
  return Math.max(0, opinionRecord(world, creditor, debtor)?.obligation.cents ?? 0);
}

export function owedFavors(world: World, creditor: ActorId, debtor: ActorId): number {
  return Math.max(0, opinionRecord(world, creditor, debtor)?.obligation.favors ?? 0);
}

/**
 * Clear what `debtor` owes `creditor` (repay / forgive). Ends a `creditor` edge between
 * them once nothing is owed, and refreshes the bases. Returns the cents cleared.
 */
export function settleDebt(
  world: World,
  content: ContentBundle,
  debtor: ActorId,
  creditor: ActorId,
  debt: 'any' | 'cents' | 'favors' = 'any',
): number {
  const cents = debt === 'favors' ? 0 : owedCents(world, creditor, debtor);
  const favors = debt === 'cents' ? 0 : owedFavors(world, creditor, debtor);
  if (cents === 0 && favors === 0) return 0;
  adjustLedger(world, content, creditor, debtor, { favors: -favors, cents: -cents });
  if (owedCents(world, creditor, debtor) > 0) return cents;
  const before = world.social.relationships.length;
  world.social.relationships = world.social.relationships.filter(
    (r: Relationship) => !(r.kind === 'creditor' && r.a === creditor && r.b === debtor),
  );
  if (world.social.relationships.length !== before) refreshBase(world, content, creditor, debtor);
  return cents;
}

export function bumpFamiliarity(world: World, content: ContentBundle, a: ActorId, b: ActorId): void {
  const step = tuningOf(content).familiarity_per_encounter;
  const ab = ensureOpinion(world, content, a, b);
  ab.familiarity = Math.min(1000, ab.familiarity + step);
  const ba = ensureOpinion(world, content, b, a);
  ba.familiarity = Math.min(1000, ba.familiarity + step);
}

/**
 * Grievance 0..100 `holder` bears `target` (the `grudge` volition driver): half the
 * dislike plus 1 point per 25 salience of remembered wrongs (the worst counts fully, the
 * rest a quarter: see MemoryDigest.negative).
 */
export function grievance(
  world: World,
  content: ContentBundle,
  holder: ActorId,
  target: ActorId,
  digest?: MemoryDigest,
): number {
  const d = digest ?? memoryDigest(world, content, holder, target);
  const aff = opinionOf(world, holder, target).affection;
  return clampInt(floorDiv(Math.max(0, -aff), 2) + floorDiv(d.negative, 25), 0, 100);
}

// ---------------------------------------------------------------- labels

/** Re-derive the label; emit `social.label_changed` on a change. */
export function refreshLabel(world: World, ctx: Pick<SimContext, 'emit'>, from: ActorId, to: ActorId): void {
  const op = opinionRecord(world, from, to);
  if (!op) return;
  // Labels follow the settled opinion (no volatile mood), with hysteresis on Friend and Enemy.
  const label = opinionLabel(settledOpinion(world, from, to), op.label);
  if (label === op.label) return;
  const prev = op.label;
  op.label = label;
  const big = label === 'Friend' || label === 'Enemy' || prev === 'Enemy' || prev === 'Friend';
  ctx.emit({
    kind: 'social.label_changed',
    roles: [
      { actor: from, role: 'agent' },
      { actor: to, role: 'target' },
    ],
    visibility: 'private',
    importance: big ? 30 : 10,
    data: { holderId: from, targetId: to, from: prev, to: label },
  });
}

// ---------------------------------------------------------------- daily upkeep

/**
 * Daily (04 §6.2, §11.2): volatile mood keeps `volatile_keep_pct`; the "other" bucket
 * fades with `bucket_tau_days`; Reasons whose memory was forgotten drop out; familiarity
 * fades for people not met.
 */
export function dailyOpinionUpkeep(world: World, content: ContentBundle): void {
  const t = tuningOf(content);
  const keep = (v: number) => Math.trunc((v * t.volatile_keep_pct) / 100) + 0;
  const tau = Math.max(1, t.bucket_tau_days);
  for (const from of Object.keys(world.social.opinions)
    .map(Number)
    .sort((a, b) => a - b) as ActorId[]) {
    const table = world.social.opinions[from] ?? {};
    for (const k of Object.keys(table)
      .map(Number)
      .sort((a, b) => a - b)) {
      const op = table[k];
      if (!op) continue;
      op.volatile = {
        affection: keep(op.volatile.affection),
        respect: keep(op.volatile.respect),
        trust: keep(op.volatile.trust),
        fear: keep(op.volatile.fear),
      };
      op.familiarity = Math.max(0, op.familiarity - t.familiarity_decay_per_day);
      const next: OpinionReason[] = [];
      for (const r of op.reasons) {
        if (r.cites.kind === 'other' || r.cites.kind === 'defense') {
          const s = r.cites.strength - ceilDiv(r.cites.strength, tau);
          if (s <= t.forget_below) continue;
          next.push({ ...r, cites: { ...r.cites, strength: s } });
          continue;
        }
        if (r.cites.kind === 'memory' && reasonStrength(world, from, op.targetId, r) === 0) continue;
        next.push(r);
      }
      op.reasons = next;
    }
  }
}

/** Drop expired cooldowns (called daily with the current minute). */
export function pruneCooldowns(world: World, now: GameMinute): void {
  for (const from of Object.keys(world.social.opinions)) {
    const table = world.social.opinions[Number(from)] ?? {};
    for (const k of Object.keys(table)) {
      const op = table[Number(k)];
      if (!op) continue;
      for (const c of Object.keys(op.cooldowns)) if ((op.cooldowns[c] ?? 0) <= now) delete op.cooldowns[c];
    }
  }
}
