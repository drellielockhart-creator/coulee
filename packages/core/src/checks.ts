/**
 * Checks: d20 + modifiers vs DC, with Explain (02 §3). FOUNDATION-OWNED.
 *
 * - Skill/ability checks: ties succeed; no auto-success on 20 / auto-fail on 1.
 * - Saves and attacks: natural 1 fails, natural 20 succeeds (3.5 behavior).
 * - Opposed: both roll, higher wins, DEFENDER wins ties; a passive side uses 10 + mod.
 * - Time policies (02 §3.4) are how take-10/take-20 work in a sim: they trade time for
 *   reliability, and the result says how much time was spent.
 *
 * Everything returns an Explain; callers attach it to the event they emit (P1).
 */
import type { ActorCore } from './actor.ts';
import { abilityMod } from './actor.ts';
import type { AbilityId, ContentBundle, SkillId } from './content.ts';
import { type Explain, type ExplainKnowledge, type ExplainTerm, signed, sumTerms, term } from './explain.ts';
import type { Rng } from './rng.ts';

export type TimePolicy = 'rush' | 'normal' | 'careful' | 'steady' | 'work_it_through';

export interface PolicyRule {
  /** Time multiplier in percent of the base time. */
  timePct: number;
  /** Flat modifier to the result. */
  mod: number;
  /** Fixed die result instead of rolling (take 10 / take 20). */
  fixedDie?: number;
  label: string;
}

export const TIME_POLICIES: Record<TimePolicy, PolicyRule> = {
  rush: { timePct: 50, mod: -5, label: 'Rushed' },
  normal: { timePct: 100, mod: 0, label: 'Normal' },
  careful: { timePct: 200, mod: 2, label: 'Careful' },
  steady: { timePct: 100, mod: 0, fixedDie: 10, label: 'Steady (take 10)' },
  work_it_through: { timePct: 2000, mod: 0, fixedDie: 20, label: 'Work it through (take 20)' },
};

/**
 * Whether a policy is allowed (02 §3.4): Steady needs no threat and no stressor; Work It
 * Through needs failure to cost nothing but time; Careful is not allowed in combat.
 */
export function policyAllowed(
  policy: TimePolicy,
  situation: { threat: boolean; stressed: boolean; failureCostsOnlyTime: boolean; inCombat: boolean },
): boolean {
  switch (policy) {
    case 'rush':
    case 'normal':
      return true;
    case 'careful':
      return !situation.inCombat;
    case 'steady':
      return !situation.threat && !situation.stressed;
    case 'work_it_through':
      return !situation.threat && situation.failureCostsOnlyTime;
  }
}

export type CheckKind = 'skill' | 'ability' | 'save' | 'attack' | 'flat';

export interface CheckResult {
  success: boolean;
  /** total - dc (can be negative). Margins in steps of 5 matter (02 §3.5). */
  margin: number;
  total: number;
  natural: number;
  /** Fail by 5+ (02 §3.5). */
  badFailure: boolean;
  /** Beat by 10+ (02 §3.5). */
  exceptional: boolean;
  /** Time actually spent, percent of base time, from the policy. */
  timePct: number;
  explain: Explain;
}

export interface ResolveSpec {
  label: string;
  kind: CheckKind;
  /** Modifier terms (ability, ranks, conditions, tools...). */
  terms: ExplainTerm[];
  /** DC base and named DC modifiers (02 §3.3 world-state DCs). */
  dc: number;
  dcTerms?: ExplainTerm[];
  policy?: TimePolicy;
  subjects?: Explain['subjects'];
  knowledge?: ExplainKnowledge;
}

/** Low-level: resolve terms vs DC with one d20 from `r` (or a fixed die from the policy). */
export function resolveCheck(spec: ResolveSpec, r: Rng): CheckResult {
  const policy = TIME_POLICIES[spec.policy ?? 'normal'];
  const natural = policy.fixedDie ?? r.d20();
  const terms = [...spec.terms];
  if (policy.mod !== 0) terms.push(term('policy', `${policy.label} ${signed(policy.mod)}`, policy.mod));
  const total = natural + sumTerms(terms);
  const dcTerms = spec.dcTerms ?? [];
  const dc = spec.dc + sumTerms(dcTerms);
  let success = total >= dc;
  const naturalRule = spec.kind === 'save' || spec.kind === 'attack';
  if (naturalRule && policy.fixedDie === undefined) {
    if (natural === 1) success = false;
    if (natural === 20) success = true;
  }
  const margin = total - dc;
  return {
    success,
    margin,
    total,
    natural,
    badFailure: !success && margin <= -5,
    exceptional: success && margin >= 10,
    timePct: policy.timePct,
    explain: {
      kind: 'check',
      label: spec.label,
      subjects: spec.subjects ?? [],
      knowledge: spec.knowledge ?? 'participants',
      terms,
      roll: { die: 20, natural },
      total,
      dc: { total: dc, terms: [term('base', `DC ${spec.dc}`, spec.dc), ...dcTerms] },
      outcome: success ? 'success' : 'failure',
      margin,
      ...(policy.fixedDie !== undefined ? { note: policy.label } : {}),
    },
  };
}

const ABILITY_LABEL: Record<AbilityId, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

/** The modifier terms an actor brings to a skill (ability mod + ranks), with labels. */
export function skillTerms(content: ContentBundle, actor: ActorCore, skillId: SkillId): ExplainTerm[] {
  const skill = content.skills[skillId];
  if (!skill) throw new Error(`unknown skill '${skillId}'`);
  let ability: AbilityId = skill.ability;
  if (skill.alt_ability) {
    const alt = skill.alt_ability;
    if (abilityMod(actor.sheet.abilities[alt]) > abilityMod(actor.sheet.abilities[ability])) ability = alt;
  }
  const mod = abilityMod(actor.sheet.abilities[ability]);
  const ranks = actor.sheet.skills[skillId] ?? 0;
  const out: ExplainTerm[] = [term('ability', `${ABILITY_LABEL[ability]} ${signed(mod)}`, mod)];
  if (ranks !== 0) out.push(term('ranks', `${skill.name} ranks ${signed(ranks)}`, ranks));
  return out;
}

export interface ActorCheckSpec {
  label: string;
  skill: SkillId;
  dc: number;
  dcTerms?: ExplainTerm[];
  /** Situational modifiers (conditions, tools, help, light...). */
  modifiers?: ExplainTerm[];
  policy?: TimePolicy;
  knowledge?: ExplainKnowledge;
}

/**
 * High-level skill check for an actor. Trained-only skills at 0 ranks fail automatically
 * above DC 10 (02 §4.1), with an Explain that says so.
 */
export function skillCheck(content: ContentBundle, actor: ActorCore, spec: ActorCheckSpec, r: Rng): CheckResult {
  const skill = content.skills[spec.skill];
  const terms = [...skillTerms(content, actor, spec.skill), ...(spec.modifiers ?? [])];
  const res = resolveCheck(
    {
      label: spec.label,
      kind: 'skill',
      terms,
      dc: spec.dc,
      ...(spec.dcTerms ? { dcTerms: spec.dcTerms } : {}),
      ...(spec.policy ? { policy: spec.policy } : {}),
      subjects: [actor.id],
      knowledge: spec.knowledge ?? 'participants',
    },
    r,
  );
  const untrained = skill?.trained_only === true && (actor.sheet.skills[spec.skill] ?? 0) === 0;
  if (untrained && res.explain.dc && res.explain.dc.total > 10 && res.success) {
    res.success = false;
    res.exceptional = false;
    res.explain.outcome = 'failure';
    res.explain.note = `${skill?.name ?? spec.skill} is trained-only; untrained use fails above DC 10`;
  }
  return res;
}

export type SaveId = 'fortitude' | 'reflex' | 'will';
const SAVE_ABILITY: Record<SaveId, AbilityId> = { fortitude: 'con', reflex: 'dex', will: 'wis' };

/** Save bonus terms (class base saves arrive with classes; M0 uses the ability only). */
export function saveTerms(actor: ActorCore, save: SaveId): ExplainTerm[] {
  const ab = SAVE_ABILITY[save];
  const mod = abilityMod(actor.sheet.abilities[ab]);
  return [term('ability', `${ABILITY_LABEL[ab]} ${signed(mod)}`, mod)];
}

export interface OpposedSide {
  label: string;
  terms: ExplainTerm[];
  /** Passive opposition uses 10 + mod instead of rolling (02 §3.6). */
  passive?: boolean;
  subject?: Explain['subjects'][number];
}

export interface OpposedResult {
  /** True if the active side (initiator) wins. Defender wins ties. */
  initiatorWins: boolean;
  initiatorTotal: number;
  defenderTotal: number;
  margin: number;
  explain: Explain;
}

/** Opposed check (02 §3.6): higher total wins; the defender wins ties. */
export function opposedCheck(
  label: string,
  initiator: OpposedSide,
  defender: OpposedSide,
  r: Rng,
  knowledge: ExplainKnowledge = 'participants',
): OpposedResult {
  const roll = (s: OpposedSide): { natural: number; total: number; e: Explain } => {
    const natural = s.passive ? 10 : r.d20();
    const total = natural + sumTerms(s.terms);
    return {
      natural,
      total,
      e: {
        kind: 'check',
        label: s.label,
        subjects: s.subject !== undefined ? [s.subject] : [],
        knowledge,
        terms: s.terms,
        roll: { die: 20, natural },
        total,
        outcome: s.passive ? 'passive' : 'rolled',
        ...(s.passive ? { note: 'passive: 10 + modifiers' } : {}),
      },
    };
  };
  const a = roll(initiator);
  const d = roll(defender);
  const initiatorWins = a.total > d.total;
  const subjects = [initiator.subject, defender.subject].filter((x) => x !== undefined);
  return {
    initiatorWins,
    initiatorTotal: a.total,
    defenderTotal: d.total,
    margin: a.total - d.total,
    explain: {
      kind: 'opposed',
      label,
      subjects,
      knowledge,
      terms: [],
      total: a.total,
      dc: { total: d.total, terms: [term('other', `${defender.label} ${d.total}`, d.total)] },
      outcome: initiatorWins ? 'success' : a.total === d.total ? 'tie_defender' : 'failure',
      margin: a.total - d.total,
      children: [a.e, d.e],
    },
  };
}
