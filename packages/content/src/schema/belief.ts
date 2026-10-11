/**
 * Belief content: proposition predicates (04 §5.1), rumor channels (04 §8.4), evidence base
 * weights (04 §5.2–5.3), misfortune kinds (04 §3.3, §5.4), concealed-people tells (12 §7.2),
 * the persecution ladder rungs (04 §9.2), grudge aims (04 §6.3, §9.4), and belief scenario
 * seeds (beliefs, secrets, figures, grudges, past misfortunes).
 * OWNER: module:belief (see docs/impl/MODULES.md).
 *
 * Everything here is integer data. Multipliers are integer percents; evidence base weights
 * are Q8 (256 = ×1.0); probabilities are per mille.
 */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import { defineDomain, type Issue, id, int, nonNegInt, ratePct, ref } from './common.ts';

/**
 * Argument kinds. `agent` = an actor or a Figure (who did it: "Ottilie Kass" or "the Bluff
 * Witch"); `misfortune` = a runtime misfortune record (the Brandt cows).
 */
export const ARG_KINDS = ['actor', 'household', 'figure', 'place', 'item', 'text', 'number', 'agent', 'misfortune'] as const;
export type ArgKind = (typeof ARG_KINDS)[number];

export const PredicateSchema = z.strictObject({
  id: id(),
  /** Argument kinds, in order. The subject (whom the claim is about) is arg 0. */
  args: z.array(z.enum(ARG_KINDS)).min(1).max(4),
  /** Rendering template with positional slots: "{0} is a witch". */
  text: z.string().min(1),
  description: z.string().default(''),
  /** Base juiciness 0..100 as gossip (04 §8.1); ×10 to per mille at runtime. */
  juiciness: int().min(0).max(100).default(20),
  /** How the subject ({0}) is valued if believed: −100 damning .. +100 praising. */
  valence: int().min(-100).max(100).default(0),
  /** Witchcraft/fae props get the Superstition multiplier (04 §5.3). */
  supernatural: z.boolean().default(false),
  tags: z.array(id()).default([]),
  /**
   * Starting credence 0..100 of a listener who has never considered the claim, before the
   * first evidence lands (04 §5.3). Kind predicates use the 12 §7.4 prior instead.
   */
  prior: int().min(1).max(99).default(20),
  /** A damaging claim that opens a persecution process on its subject (04 §9.2 charge set). */
  charge: z.boolean().default(false),
  /** The claim is an ACT (Caused, Did), not an identity: lifts the identity-only cap (04 §9.2). */
  act: z.boolean().default(false),
  /**
   * People id this predicate asserts the subject belongs to: `Is(x, kind:<people>)` (04 §5.8).
   * Data, never code: sim logic reads this field, not a people id.
   */
  kind_of: ref().optional(),
  /** Counts as "known magic" in attribution (04 §5.4 KM term). */
  magic: z.boolean().default(false),
  /** Mutation links (04 §8.5). Exaggeration: same args, a stronger predicate. */
  exaggerates_to: ref().optional(),
  /** Supernaturalization: same args, an uncanny reading ("caused" -> "cursed"). */
  supernaturalizes_to: ref().optional(),
  /** Moralization: one-arg sins that get attached to the subject ("...and she drinks"). */
  moralizes_to: z.array(ref()).default([]),
  /** Truncation: same subject, a vaguer predicate (args must be a prefix of these). */
  truncates_to: ref().optional(),
  /** Trait/drive ids a projection defense maps onto this predicate (10 §7.2; 04 §9.6). */
  projects: z.array(id()).default([]),
});
export type PredicateDef = z.output<typeof PredicateSchema>;

/** The rumor channels core knows (04 §8.4). Keep in sync with belief/api.ts `Channel`. */
export const CHANNEL_IDS = [
  'tavern',
  'church',
  'church_steps',
  'store',
  'bee',
  'mill',
  'household',
  'letter',
  'newspaper',
  'peddler',
  'landing',
  'fae_whisper',
  'street',
] as const;

export const ChannelSchema = z.strictObject({
  id: z.enum(CHANNEL_IDS),
  name: z.string().min(1),
  /** Credibility multiplier on Statement evidence heard here, percent (04 §8.4). */
  credibility_pct: ratePct().default(100),
  /** Mutation multiplier, percent (04 §8.4/§8.5). Newspaper = 0 freezes a variant. */
  mutation_pct: ratePct().default(100),
  /** venue_norm for damaging (valence < 0) topics, percent: church 30 inside, 150 on the steps. */
  scandal_pct: ratePct().default(100),
  /** Place tags that make a place this channel (first channel matching wins, in id order). */
  venue_tags: z.array(id()).default([]),
  description: z.string().default(''),
});
export type ChannelDef = z.output<typeof ChannelSchema>;

/** 04 §5.2 evidence types (+ `dream`, `defense` from this revision). Mirror of core `EvidenceType`. */
export const EVIDENCE_TYPE_IDS = [
  'observation',
  'overheard',
  'statement',
  'document',
  'physical',
  'inference',
  'confession',
  'ordeal',
  'lie_received',
  'confabulation',
  'implant',
  'seed',
  'dream',
  'defense',
] as const;

export const EvidenceTypeSchema = z.strictObject({
  id: z.enum(EVIDENCE_TYPE_IDS),
  name: z.string().min(1),
  /** Base weight in Q8 (256 = 1.0): Observation 640, Statement 205 ... (04 §5.3). */
  base_q8: nonNegInt().max(2048),
  /** Extra Q8 per point of the holder's Superstition view (Ordeal, Dream). */
  superstition_q8: int().min(-512).max(512).default(0),
  /** Extra Q8 per point of the holder's Piety view (Ordeal). */
  piety_q8: int().min(-512).max(512).default(0),
  /** How the holder perceives it (defense -> 'inference'): P1, provenance is omniscient. */
  perceived_as: z.enum(EVIDENCE_TYPE_IDS).optional(),
  description: z.string().default(''),
});
export type EvidenceTypeDef = z.output<typeof EvidenceTypeSchema>;

export const GRUDGE_AIMS = ['restitution', 'apology', 'humiliation', 'expulsion', 'harm', 'death'] as const;

/** A kind of misfortune (04 §3.3 misfortune pressure M; §5.4 attribution). */
export const MisfortuneSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  /** Event text; {0} = the stricken household's name, {1} = the victim's name if any. */
  text: z.string().min(1),
  /** Read as uncanny: attribution yields `cursed` (supernatural) instead of `caused`. */
  uncanny: z.boolean().default(false),
  /** Added to settlement misfortune pressure M (per mille, 0..1000). */
  severity: int().min(0).max(1000),
  /** Ambient chance per household per day, per mille (0 = only when reported). 05 owns the real physics later. */
  base_permille_per_household_day: int().min(0).max(1000).default(0),
  /** Gossip juiciness of the news, 0..100. */
  juiciness: int().min(0).max(100).default(40),
  /** Real anxiety for each stricken household member (0..1000), before Superstition scaling. */
  anxiety: int().min(0).max(1000).default(100),
  /** Security need delta for household members (if a `security` need exists). */
  security_delta: int().min(-1000).max(0).default(-150),
  /** Memory intensity 0..100 of the misfortune for the stricken (04 §4.2). */
  memory_intensity: int().min(0).max(100).default(60),
  /** Trait/drive ids whose projection supplies a motive for this misfortune (10 §7.2 map). */
  motive_traits: z.array(id()).default([]),
  /** Default grudge aim when a culprit is blamed. */
  aim: z.enum(GRUDGE_AIMS).default('restitution'),
  description: z.string().default(''),
});
export type MisfortuneDef = z.output<typeof MisfortuneSchema>;

const CheckRefSchema = z.strictObject({
  /** 'skill' = a skill id; 'save' = fortitude/reflex/will. */
  kind: z.enum(['skill', 'save']),
  id: id(),
  dc: int().min(0).max(60),
});

/** A tell (12 §7.2): an event that is evidence for a kind predicate, with mundane lookalikes. */
export const TellSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  /** Event text: {0} = the actor showing the tell. */
  text: z.string().min(1),
  /** The kind predicate this tell is evidence for (must have `kind_of`). */
  predicate: ref(),
  /** Strength 0..100: Observation base × s/100 (04 §5.8). */
  strength: int().min(0).max(100),
  /** Hourly chance per mille, for an actor truly of the predicate's people while conditions hold. */
  true_permille_per_hour: int().min(0).max(1000),
  /** Hourly chance per mille of a lookalike for anyone else under the same conditions. */
  lookalike_permille_per_hour: int().min(0).max(1000),
  /** What the lookalikes are, for the Explain (P1: ordeals and tells are bad evidence). */
  lookalikes: z.string().default(''),
  /** Conditions (all must hold). Empty place_tags_any = any place. */
  place_tags_any: z.array(id()).default([]),
  min_fae_intensity: int().min(0).max(10).default(0),
  /** Hour window [from, to), wrapping past midnight. */
  hours: z.strictObject({ from: int().min(0).max(23), to: int().min(0).max(24) }).optional(),
  sabbath_only: z.boolean().default(false),
  /** true: only while asleep; false: only while awake. */
  asleep: z.boolean().default(false),
  /** Suppression check by the actor (where one exists). */
  suppress: CheckRefSchema.optional(),
  /** Observation check for each nearby observer. */
  observe: z.strictObject({
    skill: ref(),
    dc: int().min(0).max(60),
    /** Add the shower's Disguise ranks to the DC (practiced concealment, 12 §7.3). */
    add_disguise: z.boolean().default(false),
  }),
  /** Only observers in the same household (dream speech: "anyone sharing the room"). */
  household_only: z.boolean().default(false),
  description: z.string().default(''),
});
export type TellDef = z.output<typeof TellSchema>;

/** One rung of the escalation ladder (04 §9.2). M1 implements rungs 0..3. */
export const RungSchema = z.strictObject({
  id: id(),
  rung: int().min(0).max(6),
  name: z.string().min(1),
  /** Entry thresholds (scaled down by M and community anxiety, 04 §9.1). */
  heat: nonNegInt().default(0),
  consensus_permille: int().min(0).max(1000).default(0),
  /** Distinct holders of a charge with credence > 40. */
  holders_over_40: nonNegInt().default(0),
  /** Momentum (04 §9.2): without fuel the process steps down after 2 × dwell. */
  dwell_days: int().min(1).max(60),
  /** The interaction a Catalyst takes to climb onto this rung (proposed as an urge). */
  step_interaction: id().optional(),
  /** Catalyst score a candidate needs to propose the step. */
  catalyst_threshold: int().min(0).max(200).default(40),
  /** Rumor juiciness about the target while at or above this rung, percent. */
  juiciness_pct: ratePct().default(100),
  /** Daily real anxiety for the target while at this rung. */
  target_anxiety_per_day: int().min(0).max(1000).default(0),
  description: z.string().default(''),
});
export type RungDef = z.output<typeof RungSchema>;

/** What a grudge with this aim makes its holder want to do (04 §9.4). */
export const GrudgeAimSchema = z.strictObject({
  id: z.enum(GRUDGE_AIMS),
  name: z.string().min(1),
  /** Direct interactions toward the target when present (gated by Fear). */
  direct: z.array(id()).default([]),
  /** Covert interaction toward a third party (spread rumor about the target). */
  covert: id().optional(),
  /** Grudge intensity needed before the holder acts on it. */
  min_intensity: int().min(0).max(100).default(40),
  description: z.string().default(''),
});
export type GrudgeAimDef = z.output<typeof GrudgeAimSchema>;

export const beliefDomains = {
  predicates: defineDomain({ dir: 'beliefs', key: 'predicate', schema: PredicateSchema }),
  rumorChannels: defineDomain({ dir: 'beliefs', key: 'channel', schema: ChannelSchema }),
  evidenceTypes: defineDomain({ dir: 'beliefs', key: 'evidence_type', schema: EvidenceTypeSchema }),
  misfortunes: defineDomain({ dir: 'beliefs', key: 'misfortune', schema: MisfortuneSchema }),
  suspicionTells: defineDomain({ dir: 'beliefs', key: 'tell', schema: TellSchema }),
  persecutionRungs: defineDomain({ dir: 'beliefs', key: 'rung', schema: RungSchema }),
  grudgeAims: defineDomain({ dir: 'beliefs', key: 'grudge_aim', schema: GrudgeAimSchema }),
};

/**
 * Proposition seed: predicate + args. Actor args are scenario actor keys; household args are
 * household keys; figure args are figure keys; `agent` args are actor or figure keys;
 * `misfortune` args are scenario misfortune keys; place args are place ids.
 */
export const PropSeedSchema = z.strictObject({
  pred: id(),
  args: z
    .array(z.union([z.string(), z.number().int()]))
    .min(1)
    .max(4),
});

/** Top-level scenario fields owned by belief. */
export const beliefScenarioFields = {
  /** Figures (rumor identities) that exist at start, e.g. "the Bluff Witch". */
  figures: z
    .array(
      z.strictObject({
        key: id(),
        name: z.string().min(1),
        description: z.string().default(''),
        /** Actor key this figure truly is, if any (ground truth; hidden from actors). */
        truly: z.string().optional(),
        notoriety: int().min(0).max(100).default(10),
      }),
    )
    .default([]),
  beliefs: z
    .array(
      z.strictObject({
        holder: z.string().min(1),
        prop: PropSeedSchema,
        /** 0..100 */
        credence: int().min(0).max(100),
        voiced: z.boolean().default(false),
        note: z.string().optional(),
      }),
    )
    .default([]),
  /** True propositions about the holder that the holder conceals (04 §3.5). */
  secrets: z
    .array(
      z.strictObject({
        holder: z.string().min(1),
        prop: PropSeedSchema,
        /** Actor keys who already know. */
        known_by: z.array(z.string()).default([]),
        note: z.string().optional(),
      }),
    )
    .default([]),
  grudges: z
    .array(
      z.strictObject({
        holder: z.string().min(1),
        /** Actor key, household key, or figure key. */
        target: z.string().min(1),
        intensity: int().min(0).max(100),
        aim: z.enum(GRUDGE_AIMS),
        founding: z.string().min(1),
        public: z.boolean().default(false),
      }),
    )
    .default([]),
  /** Misfortunes that happened before the scenario starts (they feed M and attribution). */
  misfortunes: z
    .array(
      z.strictObject({
        key: id(),
        kind: ref(),
        /** Household key of the stricken household. */
        household: z.string().min(1),
        /** Actor key of the victim within it, if any. */
        victim: z.string().optional(),
        days_ago: int().min(0).max(3650).default(0),
        /** Ground truth: actor key who really caused it (hidden; epilogue only). */
        culprit: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .default([]),
};

/** Shape-only helper so cross-ref checks can read a scenario without importing scenario.ts. */
interface ScenarioLike {
  id: string;
  actors: Array<{ key: string }>;
  households: Array<{ key: string }>;
  figures: Array<{ key: string }>;
  beliefs: Array<{ prop: { pred: string; args: Array<string | number> } }>;
  secrets: Array<{ prop: { pred: string; args: Array<string | number> } }>;
  misfortunes: Array<{ key: string; kind: string; household: string; victim?: string | undefined; culprit?: string | undefined }>;
}

function checkSeedArgs(
  b: ContentBundle,
  s: ScenarioLike,
  where: string,
  p: { pred: string; args: Array<string | number> },
  issues: Issue[],
): void {
  const pred = b.predicates[p.pred];
  if (!pred) {
    issues.push({ where, message: `unknown predicate '${p.pred}'` });
    return;
  }
  if (pred.args.length !== p.args.length) {
    issues.push({ where, message: `predicate '${p.pred}' takes ${pred.args.length} args, got ${p.args.length}` });
    return;
  }
  const actors = new Set(s.actors.map((a) => a.key));
  const households = new Set(s.households.map((h) => h.key));
  const figures = new Set(s.figures.map((f) => f.key));
  const misfortunes = new Set(s.misfortunes.map((m) => m.key));
  pred.args.forEach((kind, i) => {
    const v = p.args[i];
    const str = typeof v === 'string' ? v : null;
    const bad = (what: string) =>
      issues.push({ where, message: `predicate '${p.pred}' arg ${i}: '${String(v)}' is not a ${what}` });
    switch (kind) {
      case 'actor':
        if (str === null || !actors.has(str)) bad('scenario actor key');
        break;
      case 'household':
        if (str === null || !households.has(str)) bad('scenario household key');
        break;
      case 'figure':
        if (str === null || !figures.has(str)) bad('scenario figure key');
        break;
      case 'agent':
        if (str === null || !(actors.has(str) || figures.has(str))) bad('scenario actor or figure key');
        break;
      case 'misfortune':
        if (str === null || !misfortunes.has(str)) bad('scenario misfortune key');
        break;
      case 'place':
        if (str === null || !b.places[str]) bad('place id');
        break;
      case 'number':
        if (typeof v !== 'number') bad('number');
        break;
      case 'item':
      case 'text':
        if (str === null) bad('string');
        break;
    }
  });
}

export function beliefRefs(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  const predRef = (where: string, field: string, v: string | undefined) => {
    if (v !== undefined && !b.predicates[v]) issues.push({ where, path: field, message: `unknown predicate '${v}'` });
  };
  for (const p of Object.values(b.predicates)) {
    const where = `predicates:${p.id}`;
    predRef(where, 'exaggerates_to', p.exaggerates_to);
    predRef(where, 'supernaturalizes_to', p.supernaturalizes_to);
    predRef(where, 'truncates_to', p.truncates_to);
    for (const m of p.moralizes_to) {
      predRef(where, 'moralizes_to', m);
      const mp = b.predicates[m];
      if (mp && mp.args.length !== 1) issues.push({ where, path: 'moralizes_to', message: `'${m}' must take one arg` });
    }
    for (const [field, target] of [
      ['exaggerates_to', p.exaggerates_to],
      ['supernaturalizes_to', p.supernaturalizes_to],
    ] as const) {
      const t = target !== undefined ? b.predicates[target] : undefined;
      if (t && t.args.join(',') !== p.args.join(','))
        issues.push({ where, path: field, message: `'${target}' must take the same args (${p.args.join(', ')})` });
    }
    if (p.truncates_to !== undefined) {
      const t = b.predicates[p.truncates_to];
      if (t && t.args.join(',') !== p.args.slice(0, t.args.length).join(','))
        issues.push({ where, path: 'truncates_to', message: `'${p.truncates_to}' args must be a prefix of ${p.args.join(', ')}` });
    }
    if (p.kind_of !== undefined) {
      if (!b.peoples[p.kind_of]) issues.push({ where, path: 'kind_of', message: `unknown people '${p.kind_of}'` });
      if (p.args.length !== 1 || p.args[0] !== 'actor')
        issues.push({ where, path: 'kind_of', message: 'kind predicates take exactly one actor arg' });
    }
  }
  for (const t of Object.values(b.suspicionTells)) {
    const where = `suspicionTells:${t.id}`;
    const p = b.predicates[t.predicate];
    if (!p) issues.push({ where, path: 'predicate', message: `unknown predicate '${t.predicate}'` });
    else if (p.kind_of === undefined)
      issues.push({ where, path: 'predicate', message: `'${t.predicate}' has no kind_of (tells are kind evidence)` });
    if (!b.skills[t.observe.skill]) issues.push({ where, path: 'observe.skill', message: `unknown skill '${t.observe.skill}'` });
    if (t.suppress?.kind === 'skill' && !b.skills[t.suppress.id])
      issues.push({ where, path: 'suppress.id', message: `unknown skill '${t.suppress.id}'` });
    if (t.suppress?.kind === 'save' && !['fortitude', 'reflex', 'will'].includes(t.suppress.id))
      issues.push({ where, path: 'suppress.id', message: `unknown save '${t.suppress.id}'` });
  }
  const rungs = Object.values(b.persecutionRungs).map((r) => r.rung);
  if (rungs.length > 0) {
    for (let r = 0; r <= Math.max(...rungs); r++)
      if (!rungs.includes(r)) issues.push({ where: 'persecutionRungs', message: `missing rung ${r}` });
    if (new Set(rungs).size !== rungs.length) issues.push({ where: 'persecutionRungs', message: 'duplicate rung numbers' });
  }
  for (const s of Object.values(b.scenarios) as unknown as ScenarioLike[]) {
    const where = `scenarios:${s.id}`;
    for (const x of s.beliefs) checkSeedArgs(b, s, `${where}/beliefs`, x.prop, issues);
    for (const x of s.secrets) checkSeedArgs(b, s, `${where}/secrets`, x.prop, issues);
    const actors = new Set(s.actors.map((a) => a.key));
    const households = new Set(s.households.map((h) => h.key));
    const seen = new Set<string>();
    for (const m of s.misfortunes) {
      const w = `${where}/misfortunes:${m.key}`;
      if (seen.has(m.key)) issues.push({ where: w, message: `duplicate misfortune key '${m.key}'` });
      seen.add(m.key);
      if (!b.misfortunes[m.kind]) issues.push({ where: w, path: 'kind', message: `unknown misfortune '${m.kind}'` });
      if (!households.has(m.household))
        issues.push({ where: w, path: 'household', message: `unknown household key '${m.household}'` });
      for (const [field, v] of [
        ['victim', m.victim],
        ['culprit', m.culprit],
      ] as const)
        if (v !== undefined && !actors.has(v)) issues.push({ where: w, path: field, message: `unknown actor key '${v}'` });
    }
  }
  return issues;
}
