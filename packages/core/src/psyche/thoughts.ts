/**
 * Thoughts (10 §4): gathering proposals from every module, psyche's own thought rules
 * (content/base/psyche/thoughts.toml), trait/temperament weighting, norm prohibitions,
 * merging, decay and caps. OWNER: module:psyche.
 *
 * Every weighting step is a named integer Explain term, so a thought's `reasons` always sum
 * to its intensity (P1: the UI can show why a voice is as loud as it is).
 */
import type { ThoughtRuleDef } from '@coulee/content/schema';
import { proposeActivityUrges } from '../activity/api.ts';
import { proposeBeliefUrges } from '../belief/api.ts';
import type { Command } from '../command.ts';
import type { ExplainTerm } from '../explain.ts';
import { sumTerms } from '../explain.ts';
import { type ActorId, asThoughtId, type ThoughtId } from '../ids.ts';
import { proposeNeedUrges } from '../needs/api.ts';
import { proposeProvisionUrges } from '../provisions/api.ts';
import { hashString32, mixKey } from '../rng.ts';
import { proposeSocialUrges, strifeCount, wearinessPermille } from '../social/api.ts';
import type { OpinionDims } from '../social/state.ts';
import { dayIndex } from '../time.ts';
import { sameUrge, type Urge, type UrgeProposal, urgeLabel } from '../urge.ts';
import type { World } from '../world.ts';
import { anxietyBand } from './anxiety.ts';
import { evalWhen, type Mind, nameOf, pickTarget } from './mind.ts';
import type { ActorPsyche, Thought } from './state.ts';
import { cmpStr, intersects, optionName, optionVerb, urgeKey, urgeTags } from './tags.ts';

/** Live thoughts kept per actor at T1 (10 §4.2 caps). */
export const THOUGHT_CAP = 12;
/** Prohibitions quieter than this are not voiced. */
export const PROHIBITION_MIN = 50;

/** A thought-to-be: a proposal with psyche bookkeeping. */
export interface Candidate {
  key: string;
  proposal: UrgeProposal;
  stance: 'for' | 'against';
  against?: string[];
  targetId?: Thought['targetId'];
  decayPerHour: number;
  line?: string;
  notable: boolean;
}

// ---------------------------------------------------------------------------------------------
// Weighting (10 §4.2)
// ---------------------------------------------------------------------------------------------

const pctTerm = (label: string, before: number, pct: number): { v: number; term: ExplainTerm } => {
  const v = Math.floor((before * pct) / 100);
  return { v, term: { source: 'psyche', label: `${label} ×${pct}%`, value: v - before } };
};

/**
 * Weighted intensity of a proposal for this mind. Id: × (50 + idAppetite)% × drive/50 ×
 * trait voice_pct × urge_bias. Superego: × (50 + strictness)% × norm/50 × voice_pct × bias,
 * + min(300, 50 × onlookers) for public norms. Commands are not weighted: they always win.
 */
export function weighProposal(
  m: Pick<Mind, 'content' | 'actor' | 'p' | 'audience'>,
  prop: UrgeProposal,
): { intensity: number; reasons: ExplainTerm[] } {
  const base = Math.max(0, Math.min(1000, Math.round(prop.intensity)));
  const reasons: ExplainTerm[] = prop.reasons.map((r) => ({ ...r, value: Math.round(r.value) }));
  const diff = base - sumTerms(reasons);
  if (reasons.length === 0) reasons.push({ source: prop.source, label: prop.label, value: base });
  else if (diff !== 0) reasons.push({ source: 'other', label: 'rounding', value: diff });
  if (prop.voice === 'command') return { intensity: base, reasons };

  const { p, content } = m;
  let v = base;
  const step = (label: string, pct: number) => {
    if (pct === 100) return;
    const r = pctTerm(label, v, pct);
    v = r.v;
    reasons.push(r.term);
  };
  if (prop.voice === 'id') {
    step(`Appetite (Id ${p.idAppetite})`, 50 + p.idAppetite);
    if (prop.drive !== undefined && content.drives[prop.drive]) {
      const w = p.drives[prop.drive] ?? 50;
      step(`${content.drives[prop.drive]?.period_label ?? prop.drive} ${w}`, w * 2);
    }
  } else {
    step(`Conscience (strictness ${p.superego})`, 50 + p.superego);
    const norm = prop.norm !== undefined ? content.norms[prop.norm] : undefined;
    if (prop.norm !== undefined && norm) {
      const s = p.norms[prop.norm] ?? norm.base;
      step(`${norm.period_label} ${s}`, s * 2);
    }
  }
  // Innate plus acquired traits (a habitual projector turns Suspicious, 10 §7.1).
  const traits =
    m.p.acquired.length > 0
      ? [...m.actor.traits, ...m.p.acquired.filter((x) => !m.actor.traits.includes(x))]
      : m.actor.traits;
  for (const tid of traits) {
    const t = content.traits[tid];
    if (!t) continue;
    const vp = prop.voice === 'id' ? t.voice_pct.id : t.voice_pct.superego;
    step(t.name, vp);
    for (const b of t.urge_bias) {
      const hit =
        (b.kind === 'activity' && prop.urge.kind === 'activity' && prop.urge.activityId === b.id) ||
        (b.kind === 'interaction' && prop.urge.kind === 'interaction' && prop.urge.interactionId === b.id);
      if (hit) step(`${t.name} (${b.id})`, b.pct);
    }
  }
  if (prop.voice === 'superego' && prop.norm !== undefined && content.norms[prop.norm]?.public && m.audience > 0) {
    const add = Math.min(300, 50 * m.audience);
    v += add;
    reasons.push({ source: 'place', label: `Onlookers ${m.audience}`, value: add });
  }
  if (prop.voice === 'id' && prop.drive !== undefined && content.drives[prop.drive]?.anxiety_pool === 'real') {
    if (anxietyBand(p.anxiety) >= 2) {
      v += 100;
      reasons.push({ source: 'psyche', label: 'Nerves', value: 100 });
    }
  }
  if (v > 1000) {
    reasons.push({ source: 'psyche', label: 'ceiling', value: 1000 - v });
    v = 1000;
  }
  return { intensity: v, reasons };
}

// ---------------------------------------------------------------------------------------------
// Gathering
// ---------------------------------------------------------------------------------------------

/** Proposals from the five module APIs (§1.4), in fixed module order. Stubs return []. */
export function externalProposals(m: Mind): UrgeProposal[] {
  const { world, ctx, actorId } = m;
  return [
    ...proposeNeedUrges(world, ctx, actorId),
    ...proposeActivityUrges(world, ctx, actorId),
    ...proposeSocialUrges(world, ctx, actorId),
    ...proposeBeliefUrges(world, ctx, actorId),
    ...proposeProvisionUrges(world, ctx, actorId),
  ].filter((pr) => pr.voice !== 'command');
}

/** `core.urge` commands for this actor, as 'command' proposals (P2: same pipeline). */
export function commandProposals(m: Pick<Mind, 'actorId' | 'content'>, commands: readonly Command[]): UrgeProposal[] {
  const out: UrgeProposal[] = [];
  for (const c of commands) {
    if (c.kind !== 'core.urge' || c.actorId !== m.actorId) continue;
    out.push({
      urge: c.data.urge,
      voice: 'command',
      intensity: 1000,
      label: `Resolved: ${optionName(m.content, c.data.urge)}`,
      source: 'core',
      reasons: [{ source: 'command', label: 'Your will', value: 1000 }],
    });
  }
  return out;
}

/** Deterministic line choice: rotates by day so voices don't repeat the same words forever. */
export function pickLine(lines: readonly string[], actorId: number, salt: string, t: number): string {
  if (lines.length === 0) return '';
  const i = mixKey(actorId, dayIndex(t as never), hashString32(salt)) % lines.length;
  return lines[i] ?? lines[0] ?? '';
}

export function fillLine(
  text: string,
  vars: { target?: string; option?: string; verb?: string; trait?: string },
): string {
  const out = text
    .replaceAll('{target}', vars.target ?? 'them')
    .replaceAll('{option}', vars.option ?? 'that')
    .replaceAll('{verb}', vars.verb ?? 'at it')
    .replaceAll('{trait}', vars.trait ?? 'not right');
  // A line that opens on a fallback ("someone had it coming.") is still a sentence.
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Psyche's own thought rules for this hour, skipping fallbacks other modules already cover. */
export function ruleCandidates(m: Mind, external: readonly UrgeProposal[]): Candidate[] {
  // Scoped to gathering: defenses later in the hour can change opinions.
  const opinions = new Map<ActorId, OpinionDims>();
  const out: Candidate[] = [];
  for (const id of Object.keys(m.content.thoughts ?? {}).sort()) {
    const rule = m.content.thoughts[id];
    if (!rule) continue;
    const c = ruleCandidate(m, rule, opinions);
    if (!c) continue;
    if (rule.fallback) {
      const covered = external.some(
        (e) =>
          (rule.voice === 'id' && rule.drive !== undefined && e.drive === rule.drive) ||
          (rule.voice === 'superego' && rule.norm !== undefined && e.norm === rule.norm) ||
          (e.voice === rule.voice && sameUrge(e.urge, c.proposal.urge)),
      );
      if (covered) continue;
    }
    out.push(c);
  }
  return out;
}

function ruleCandidate(m: Mind, rule: ThoughtRuleDef, opinions: Map<ActorId, OpinionDims>): Candidate | null {
  const w = evalWhen(m, rule.when);
  if (!w.ok) return null;
  const reasons: ExplainTerm[] = [];
  let base = rule.base;
  let urge: Urge | null = null;
  let stance: 'for' | 'against' = 'for';
  let against: string[] | undefined;
  let norm = rule.norm;
  if (rule.scheduled) {
    if (!m.block) return null;
    urge = { kind: 'activity', activityId: m.block.activity };
    base = m.block.duty;
    reasons.push({ source: 'policy', label: `The hour for ${optionName(m.content, urge).toLowerCase()}`, value: base });
    const actNorm = m.content.activities[m.block.activity]?.norm;
    if (actNorm !== undefined && m.content.norms[actNorm]) norm = actNorm;
  } else if (rule.urge) {
    urge =
      rule.urge.kind === 'activity'
        ? { kind: 'activity', activityId: rule.urge.id }
        : { kind: 'interaction', interactionId: rule.urge.id };
  } else if (rule.against_tags.length > 0) {
    // Against the option of the hour carrying one of these tags (the schedule's call).
    if (!m.block) return null;
    const tags = m.idx.activity.get(m.block.activity) ?? [];
    if (!intersects(tags, rule.against_tags)) return null;
    urge = { kind: 'activity', activityId: m.block.activity };
    stance = 'against';
    against = [...rule.against_tags];
  }
  if (!urge) return null;
  if (w.needBase !== undefined) {
    base = w.needBase;
    reasons.push({ source: 'need', label: w.needLabel ?? 'need', value: base });
  } else if (!rule.scheduled && base > 0) {
    reasons.push({ source: 'base', label: rule.label.replace('{target}', '…'), value: base });
  }
  let targetId: Thought['targetId'];
  if (rule.target) {
    const pick = pickTarget(m, rule.target, opinions);
    if (!pick) return null;
    targetId = pick.targetId;
    if (pick.add > 0) {
      base += pick.add;
      reasons.push({ source: 'opinion', label: `${nameOf(m, pick.targetId)}: ${pick.label}`, value: pick.add });
    }
    if (!pick.present && pick.pct !== 100 && base > 0) {
      const v = Math.floor((base * pick.pct) / 100);
      reasons.push({
        source: 'place',
        label: `${nameOf(m, pick.targetId)} is elsewhere ×${pick.pct}%`,
        value: v - base,
      });
      base = v;
    }
    if (urge.kind === 'interaction') urge = { ...urge, targetId: pick.targetId };
    // A quarrel tires (social strife): each hostile act between them lately scales it down.
    if (
      urge.kind === 'interaction' &&
      m.content.interactions[urge.interactionId]?.tags.includes('hostile') &&
      base > 0
    ) {
      const n = strifeCount(m.world, m.content, m.actorId, pick.targetId, m.ctx.now);
      if (n > 0) {
        const v = Math.floor((base * wearinessPermille(m.content, n)) / 1000);
        reasons.push({
          source: 'memory',
          label: `Weary of it: ${n} quarrels with ${nameOf(m, pick.targetId)} lately`,
          value: v - base,
        });
        base = v;
      }
    }
  }
  base = Math.max(0, Math.min(1000, base));
  if (base <= 0) return null;
  const vars = {
    target: nameOf(m, targetId),
    option: optionName(m.content, urge),
    verb: optionVerb(m.content, urge),
  };
  const normDef = norm !== undefined ? m.content.norms[norm] : undefined;
  const proposal: UrgeProposal = {
    urge,
    voice: rule.voice,
    intensity: base,
    label: fillLine(rule.label, vars),
    source: 'psyche',
    reasons,
    ...(rule.drive !== undefined ? { drive: rule.drive } : {}),
    ...(norm !== undefined ? { norm } : {}),
    ...(normDef ? { speaker: normDef.speaker } : {}),
  };
  return {
    key: `rule:${rule.id}`,
    proposal,
    stance,
    ...(against ? { against } : {}),
    ...(targetId !== undefined ? { targetId } : {}),
    decayPerHour: rule.decay_per_hour,
    line: fillLine(pickLine(rule.lines, m.actorId, rule.id, m.ctx.now), vars),
    notable: rule.notable,
  };
}

export function proposalCandidate(prop: UrgeProposal, prefix: string): Candidate {
  const targetId = prop.urge.kind !== 'activity' ? prop.urge.targetId : undefined;
  return {
    key: `${prefix}:${prop.source}:${prop.voice}:${urgeKey(prop.urge)}`,
    proposal: prop,
    stance: 'for',
    ...(targetId !== undefined ? { targetId } : {}),
    decayPerHour: prop.voice === 'command' ? 1000 : 200,
    notable: false,
  };
}

/**
 * Norm prohibitions (10 §5.2): for each option someone wants, each norm whose `forbids`
 * matches its tags (and whose `when` holds) voices a Superego thought against it, at
 * relevance × 10 before strength/strictness weighting.
 */
export function prohibitionCandidates(m: Mind, thoughts: readonly Thought[]): Candidate[] {
  const wanted = new Map<string, { urge: Urge; support: number }>();
  for (const t of thoughts) {
    if ((t.stance ?? 'for') !== 'for' || t.urge.kind === 'defense') continue;
    const k = urgeKey(t.urge);
    const cur = wanted.get(k);
    wanted.set(k, { urge: t.urge, support: (cur?.support ?? 0) + t.intensity });
  }
  if (wanted.size === 0) return [];
  const options = [...wanted.entries()].sort((a, b) => b[1].support - a[1].support || cmpStr(a[0], b[0]));
  const out: Candidate[] = [];
  for (const nid of Object.keys(m.content.norms ?? {}).sort()) {
    const norm = m.content.norms[nid];
    if (!norm) continue;
    norm.forbids.forEach((f, i) => {
      const hit = options.find(([, o]) => intersects(urgeTags(m.idx, o.urge), f.tags));
      if (!hit) return;
      if (!evalWhen(m, f.when).ok) return;
      const option = hit[1].urge;
      const vars = { option: optionName(m.content, option), verb: optionVerb(m.content, option) };
      const proposal: UrgeProposal = {
        urge: option,
        voice: 'superego',
        intensity: f.relevance * 10,
        label: `${norm.period_label}: not ${vars.option.toLowerCase()}`,
        source: 'psyche',
        reasons: [{ source: 'policy', label: `${norm.name} forbids ${f.tags.join('/')}`, value: f.relevance * 10 }],
        norm: nid,
        speaker: norm.speaker,
      };
      out.push({
        key: `forbid:${nid}:${i}`,
        proposal,
        stance: 'against',
        against: [...f.tags],
        // Renewed (max) while the temptation stands; lingers a little after it passes, so a
        // conscience that keeps losing habituates (10 §6) instead of starting fresh each hour.
        decayPerHour: 300,
        line: fillLine(pickLine(norm.lines, m.actorId, `${nid}:${i}`, m.ctx.now), vars),
        notable: false,
      });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Merge, decay, cap
// ---------------------------------------------------------------------------------------------

export function nextThoughtId(world: World): ThoughtId {
  world.psyche.counters.thought += 1;
  return asThoughtId(world.psyche.counters.thought);
}

/**
 * Merge a weighted candidate into the live thoughts: a same-key thought takes the louder
 * intensity (renewal); otherwise a new thought is born. Returns the thought and whether it is new.
 */
export function mergeCandidate(
  world: World,
  m: Pick<Mind, 'content' | 'actor' | 'p' | 'audience'>,
  c: Candidate,
  now: number,
): { thought: Thought; isNew: boolean } | null {
  const { intensity, reasons } = weighProposal(m, c.proposal);
  if (intensity <= 0) return null;
  const p = m.p;
  const existing = p.thoughts.find((t) => t.key === c.key);
  if (existing) {
    if (intensity >= existing.intensity) {
      existing.intensity = intensity;
      existing.reasons = reasons;
      existing.label = c.proposal.label;
      existing.urge = c.proposal.urge;
      if (c.line !== undefined) existing.line = c.line;
      if (c.targetId !== undefined) existing.targetId = c.targetId;
    }
    existing.decayPerHour = c.decayPerHour;
    return { thought: existing, isNew: false };
  }
  const t: Thought = {
    id: nextThoughtId(world),
    voice: c.proposal.voice,
    urge: c.proposal.urge,
    intensity,
    label: c.proposal.label,
    source: c.proposal.source,
    bornAt: now as Thought['bornAt'],
    decayPerHour: c.decayPerHour,
    reasons,
    key: c.key,
    stance: c.stance,
    frustrated: 0,
    ...(c.proposal.drive !== undefined ? { drive: c.proposal.drive } : {}),
    ...(c.proposal.norm !== undefined ? { norm: c.proposal.norm } : {}),
    ...(c.proposal.speaker !== undefined ? { speaker: c.proposal.speaker } : {}),
    ...(c.against ? { against: c.against } : {}),
    ...(c.targetId !== undefined ? { targetId: c.targetId } : {}),
    ...(c.line !== undefined ? { line: c.line } : {}),
  };
  p.thoughts.push(t);
  return { thought: t, isNew: true };
}

/** Total order for thoughts: intensity desc, then key, then id. */
export function cmpThought(a: Thought, b: Thought): number {
  return b.intensity - a.intensity || cmpStr(a.key ?? '', b.key ?? '') || a.id - b.id;
}

/** Keep the loudest THOUGHT_CAP thoughts (commands and defense-masked thoughts always stay). */
export function capThoughts(p: ActorPsyche): void {
  if (p.thoughts.length <= THOUGHT_CAP) return;
  const keep = new Set<Thought>();
  for (const t of p.thoughts) if (t.voice === 'command' || t.maskedBy !== undefined) keep.add(t);
  for (const t of [...p.thoughts].sort(cmpThought)) {
    if (keep.size >= THOUGHT_CAP) break;
    keep.add(t);
  }
  p.thoughts = p.thoughts.filter((t) => keep.has(t));
}

/** End-of-hour decay (fixed integer step); thoughts at 0 are forgotten. */
export function decayThoughts(p: ActorPsyche): void {
  for (const t of p.thoughts) {
    const next = Math.max(0, t.intensity - t.decayPerHour);
    if (next === t.intensity) continue;
    // Keep the reasons summing to the intensity (P1): one running 'Fading' term.
    const fade = t.reasons.find((r) => r.source === 'decay');
    if (fade) fade.value += next - t.intensity;
    else t.reasons.push({ source: 'decay', label: 'Fading', value: next - t.intensity });
    t.intensity = next;
  }
  p.thoughts = p.thoughts.filter((t) => t.intensity > 0);
}

/** "Appetite: eat something" → urge label for logs. */
export const describeUrge = (u: Urge): string => urgeLabel(u);
