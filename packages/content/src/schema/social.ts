/**
 * Social interactions catalog (04 §10), memory kinds (04 §4.3), social tuning (04 §3.1,
 * §6, §11.2), and social scenario seeds (relationships, opinions, memories).
 * OWNER: module:social (see docs/impl/MODULES.md).
 *
 * Every interaction is data: preconditions (`requires`), Comme-il-Faut volition terms,
 * a check, and success/failure effects. The core interprets the volition driver names
 * listed in VOLITION_DRIVER_PREFIXES; unknown drivers fail content validation.
 */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import {
  checkRefs,
  defineDomain,
  type Issue,
  id,
  int,
  nonNegInt,
  pct,
  ratePct,
  ref,
  VALUE_IDS,
  valueId,
} from './common.ts';

/** Opinion dimension deltas (04 §6.1). Affection/Respect/Trust −100..100, Fear 0..100. */
export const OpinionDeltaSchema = z
  .strictObject({
    affection: int().min(-100).max(100).default(0),
    respect: int().min(-100).max(100).default(0),
    trust: int().min(-100).max(100).default(0),
    fear: int().min(-100).max(100).default(0),
  })
  .default({ affection: 0, respect: 0, trust: 0, fear: 0 });

export const MEMORY_KINDS = [
  'chat',
  'gossip',
  'kindness',
  'insult',
  'fight',
  'help',
  'gift',
  'debt',
  'theft',
  'courtship',
  'accusation',
  'threat',
  'lie',
  'confession',
  'misfortune',
  'curse_symptom',
  'sermon',
  'other',
  // module:social additions (additive)
  'slight',
  'mockery',
  'humiliation',
  'flattery',
  'confidence',
  'apology',
  'forgiveness',
  'rejection',
  'betrothal',
  'loan',
  'repayment',
  'dunning',
  'warning',
  'comfort',
  'prayer',
  'toast',
  'tale',
  'introduction',
  'snub',
] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const EMOTIONS = ['anger', 'fear', 'shame', 'grief', 'gratitude', 'joy', 'disgust', 'awe', 'none'] as const;

/** Structural relationship kinds (04 §7.1). Directed kinds read "a is <kind> of b". */
export const RELATIONSHIP_KINDS = [
  'parent',
  'sibling',
  'spouse',
  'courting',
  'betrothed',
  'cousin',
  'in_law',
  'employer',
  'creditor',
  'patron',
  'neighbor',
  'lodger',
  'congregant_with',
  'friend',
  'rival',
] as const;
export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

/**
 * Volition driver vocabulary (04 §10, Comme il Faut). A driver is `prefix` or `prefix:arg`.
 * Each yields a signal; the contribution is documented per driver (all integer math):
 *   need:<need>          initiator's deficit 0..100 (= (1000 − value) / 10) × weight / 100
 *   target_need:<need>   the target's visible deficit, same scale
 *   value:<value>        initiator's Value view −3..+3 × weight
 *   target_value:<value> target's (publicly evident) Value view −3..+3 × weight
 *   opinion:<dim>        initiator's opinion of target (−100..100) × weight / 100
 *   trait:<trait>        weight if the initiator has the trait
 *   condition:<cond>     weight if the initiator has the condition (e.g. drunk)
 *   venue:<tag>          weight if the place has the tag
 *   remembers:<kind>     max salience (0..1000) of the initiator's memories of <kind> done by target × weight / 1000
 *   did:<kind>           max salience of the initiator's memories of <kind> it did to target × weight / 1000
 *   grudge               grievance 0..100 (negative memories + dislike) × weight / 100
 *   rumor                weight if belief says the initiator has a rumor for the target
 *   kin                  weight if the two are kin
 *   household            weight if the two share a household
 *   stranger             weight if the initiator has no opinion record of the target yet
 *   familiarity          familiarity 0..1000 × weight / 1000
 *   owed_cents           min(100, cents the target owes the initiator / 10) × weight / 100
 *   owes                 weight if the initiator owes the target money or favors
 *   favors_owed          favors the initiator owes the target (capped 5) × weight
 *   anxiety              initiator's anxiety 0..1000 × weight / 1000
 *   target_anxiety       target's anxiety 0..1000 × weight / 1000
 *   attraction           courtship attraction 0..100 (0 if not eligible) × weight / 100
 *   sabbath              weight on the Sabbath
 *   audience             onlookers present (capped 10) × weight / 10
 */
export const VOLITION_DRIVER_PREFIXES = [
  'need',
  'target_need',
  'value',
  'target_value',
  'opinion',
  'trait',
  'condition',
  'venue',
  'remembers',
  'did',
  'grudge',
  'rumor',
  // v0 alias of `rumor` (kept so the M0 seed stays valid).
  'rumor:juiciness',
  'kin',
  'household',
  'stranger',
  'familiarity',
  'owed_cents',
  'owes',
  'favors_owed',
  'anxiety',
  'target_anxiety',
  'attraction',
  'sabbath',
  'audience',
] as const;

const DIMS = ['affection', 'respect', 'trust', 'fear'] as const;

/** Check that a volition driver name is in the vocabulary (with a valid argument). */
export function volitionDriverIssue(driver: string): string | null {
  if (driver === 'rumor:juiciness') return null;
  const [prefix, arg, extra] = driver.split(':');
  if (extra !== undefined) return `bad driver '${driver}'`;
  const needsArg = new Set([
    'need',
    'target_need',
    'value',
    'target_value',
    'opinion',
    'trait',
    'condition',
    'venue',
    'remembers',
    'did',
  ]);
  if (!(VOLITION_DRIVER_PREFIXES as readonly string[]).includes(prefix ?? '')) return `unknown driver '${driver}'`;
  if (needsArg.has(prefix ?? '') && !arg) return `driver '${prefix}' needs an argument ('${prefix}:<x>')`;
  if (!needsArg.has(prefix ?? '') && arg) return `driver '${prefix}' takes no argument`;
  if ((prefix === 'value' || prefix === 'target_value') && !(VALUE_IDS as readonly string[]).includes(arg ?? ''))
    return `unknown value '${arg}'`;
  if (prefix === 'opinion' && !(DIMS as readonly string[]).includes(arg ?? '')) return `unknown opinion dim '${arg}'`;
  if ((prefix === 'remembers' || prefix === 'did') && !(MEMORY_KINDS as readonly string[]).includes(arg ?? ''))
    return `unknown memory kind '${arg}'`;
  return null;
}

/** A thought the effect injects into a participant's psyche (04 §3.6: memories cue thoughts). */
const ThoughtSchema = z.strictObject({
  voice: z.enum(['id', 'superego']),
  /** Interaction the thought urges, aimed back at the other party (e.g. insult -> 'fight'). */
  interaction: ref(),
  /** 0..1000 intensity before psyche weighting. */
  intensity: int().min(0).max(1000),
  /** Thought label; `{other}` is the other party's short name. */
  label: z.string().min(1),
  drive: id().optional(),
  norm: id().optional(),
  /** Superego speaker: the other party ("Mrs. Pratt:") when true. */
  spoken_by_other: z.boolean().default(false),
});

const EMPTY_DELTA = { affection: 0, respect: 0, trust: 0, fear: 0 };

const EffectSchema = z
  .strictObject({
    /** Change to the TARGET's opinion of the initiator. */
    target_opinion: OpinionDeltaSchema,
    /** Change to the INITIATOR's opinion of the target. */
    initiator_opinion: OpinionDeltaSchema,
    /** Need deltas for initiator / target (e.g. company +60). */
    initiator_needs: z.record(id(), int().min(-1000).max(1000)).default({}),
    target_needs: z.record(id(), int().min(-1000).max(1000)).default({}),
    /** Interaction id this may escalate into (e.g. insult -> fight), resolved by social. */
    escalates_to: id().optional(),
    // ---- module:social additions (all optional with defaults) ----
    /** Put the opinion deltas into the fast-decaying `volatile` bucket instead of a Reason (chat). */
    volatile: z.boolean().default(false),
    /**
     * Opinion Reason labels (04 §6.2), from the holder's side. Placeholders: {initiator},
     * {target}, {place}, {cents}. Defaults to the memory summary.
     */
    target_reason: z.string().optional(),
    initiator_reason: z.string().optional(),
    /** Memory gists (04 §4.1). Same placeholders. */
    target_memory: z.string().optional(),
    initiator_memory: z.string().optional(),
    witness_memory: z.string().optional(),
    /** Override the interaction's memory kind/emotions for this outcome. */
    memory_kind: z.enum(MEMORY_KINDS).optional(),
    target_emotion: z.enum(EMOTIONS).optional(),
    initiator_emotion: z.enum(EMOTIONS).optional(),
    /** Scales the interaction's base memory intensity for this outcome. */
    intensity_pct: ratePct().default(100),
    /** Who besides the pair is affected: sampled witnesses, or everyone present (capped). */
    audience: z.enum(['none', 'witnesses', 'all_present']).default('witnesses'),
    /** Change to each audience member's opinion of the initiator. */
    audience_opinion: OpinionDeltaSchema,
    audience_needs: z.record(id(), int().min(-1000).max(1000)).default({}),
    /** Obligation ledger (04 §6.1): positive = the target now owes the initiator. */
    ledger: z
      .strictObject({ favors: int().min(-10).max(10).default(0), cents: int().min(-100_000).max(100_000).default(0) })
      .default({ favors: 0, cents: 0 }),
    /** Clear a debt: the initiator's debt to the target (repay) or the target's to the initiator (forgive). */
    settle: z.enum(['none', 'initiator_debt', 'target_debt']).default('none'),
    add_relationship: z.enum(RELATIONSHIP_KINDS).optional(),
    remove_relationship: z.enum(RELATIONSHIP_KINDS).optional(),
    /** Anxiety change (0..1000 scale) for each party: confession relieves, threats frighten. */
    target_anxiety: int().min(-1000).max(1000).default(0),
    initiator_anxiety: int().min(-1000).max(1000).default(0),
    target_thought: ThoughtSchema.optional(),
    /** Percent by which the TARGET's negative memories of the initiator lose salience (apology). */
    soften_target_memories_pct: pct().default(0),
    /** Percent by which the INITIATOR's negative memories of the target lose salience (forgiveness). */
    soften_initiator_memories_pct: pct().default(0),
    /** Kin of the target who witness it take this share (percent) of the target's opinion change. */
    kin_share_pct: pct().default(50),
  })
  .default({
    target_opinion: EMPTY_DELTA,
    initiator_opinion: EMPTY_DELTA,
    initiator_needs: {},
    target_needs: {},
    volatile: false,
    intensity_pct: 100,
    audience: 'witnesses',
    audience_opinion: EMPTY_DELTA,
    audience_needs: {},
    ledger: { favors: 0, cents: 0 },
    settle: 'none',
    target_anxiety: 0,
    initiator_anxiety: 0,
    soften_target_memories_pct: 0,
    soften_initiator_memories_pct: 0,
    kin_share_pct: 50,
  });
export type InteractionEffect = z.output<typeof EffectSchema>;

export const InteractionSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  /** Speech-bubble label (04 §11.1), e.g. "Gossip", "Dun", "Accuse!". */
  label: z.string().min(1),
  description: z.string().default(''),
  /** Preconditions on the initiator's view of the target (04 §10 "Preconditions"). */
  requires: z
    .strictObject({
      min_affection: int().min(-100).max(100).optional(),
      max_affection: int().min(-100).max(100).optional(),
      min_trust: int().min(-100).max(100).optional(),
      acquainted: z.boolean().default(false),
      rumor_available: z.boolean().default(false),
      not_kin: z.boolean().default(false),
      venue_tags: z.array(id()).default([]),
      /** Office/role tag the initiator must hold (04 §9.3), e.g. 'preacher'. */
      role: id().optional(),
      // ---- module:social additions ----
      max_trust: int().min(-100).max(100).optional(),
      min_respect: int().min(-100).max(100).optional(),
      min_fear: int().min(0).max(100).optional(),
      max_fear: int().min(0).max(100).optional(),
      /** The pair must be kin (parent, sibling, spouse...). */
      kin: z.boolean().default(false),
      /** Place tags where this may NOT happen (no fistfights in church). */
      not_venue_tags: z.array(id()).default([]),
      /** Initiator conditions that waive the opinion preconditions ("Aff < −20 or drunk"). */
      waive_opinion_if: z.array(id()).default([]),
      /** Courtship eligibility (ages, unmarried, not kin, sexes per social_tuning). */
      eligible: z.boolean().default(false),
      /** The pair must share this relationship edge (either direction). */
      relationship: z.enum(RELATIONSHIP_KINDS).optional(),
      /** The pair must NOT share this relationship edge. */
      no_relationship: z.enum(RELATIONSHIP_KINDS).optional(),
      /** Minimum age in days of the `relationship` edge (propose after weeks of courting). */
      relationship_min_days: nonNegInt().default(0),
      /** The target owes the initiator (cents or favors). */
      target_owes: z.boolean().default(false),
      /** The initiator owes the target (cents or favors). */
      initiator_owes: z.boolean().default(false),
      /** Which debts `target_owes` / `initiator_owes` (and `settle`) count: money, favors, or either. */
      debt: z.enum(['any', 'cents', 'favors']).default('any'),
      /** The initiator remembers the target doing one of these (salience >= 100). */
      initiator_remembers: z.array(z.enum(MEMORY_KINDS)).default([]),
      /** The initiator remembers doing one of these to the target (salience >= 100). */
      initiator_did: z.array(z.enum(MEMORY_KINDS)).default([]),
      min_age: nonNegInt().default(0),
      target_min_age: nonNegInt().default(0),
      /** Minimum Value views of the initiator, e.g. { piety = 2 } for preaching at people. */
      initiator_values: z.partialRecord(valueId(), int().min(-3).max(3)).default({}),
      min_familiarity: int().min(0).max(1000).default(0),
      /** Only between people who have not met (no opinion record). */
      stranger: z.boolean().default(false),
      /** Grievance (0..100) the initiator holds against the target. */
      min_grudge: int().min(0).max(100).default(0),
      /** Target anxiety (0..1000) at least this (comfort the frightened). */
      target_min_anxiety: int().min(0).max(1000).default(0),
    })
    .default({
      acquainted: false,
      rumor_available: false,
      not_kin: false,
      venue_tags: [],
      kin: false,
      not_venue_tags: [],
      waive_opinion_if: [],
      eligible: false,
      relationship_min_days: 0,
      target_owes: false,
      initiator_owes: false,
      debt: 'any',
      initiator_remembers: [],
      initiator_did: [],
      min_age: 0,
      target_min_age: 0,
      initiator_values: {},
      min_familiarity: 0,
      stranger: false,
      min_grudge: 0,
      target_min_anxiety: 0,
    }),
  /**
   * Volition terms (04 §10, Comme il Faut): named drivers with integer weights. See
   * VOLITION_DRIVER_PREFIXES for the vocabulary and scales.
   */
  volition: z.array(z.strictObject({ driver: z.string().min(1), weight: int() })).default([]),
  /** Minimum volition score to be chosen spontaneously (urges chosen by the psyche skip it). */
  threshold: int().default(0),
  check: z
    .discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('none') }),
      z.strictObject({
        kind: z.literal('dc'),
        skill: ref(),
        dc: nonNegInt(),
        /** Adjust the DC by the target's regard for the initiator (Affection, Trust). */
        attitude: z.boolean().default(false),
      }),
      z.strictObject({
        kind: z.literal('opposed'),
        skill: ref(),
        /** Opposing skill id, or a save: 'will' | 'fortitude' | 'reflex'. */
        vs: z.string().min(1),
      }),
    ])
    .default({ kind: 'none' }),
  success: EffectSchema,
  failure: EffectSchema,
  memory: z
    .strictObject({
      kind: z.enum(MEMORY_KINDS),
      emotion: z.enum(EMOTIONS).default('none'),
      /** 0..100 encoding intensity at base stakes (04 §4.2). */
      intensity: int().min(0).max(100),
    })
    .optional(),
  /** Juiciness 0..100 of the resulting event as gossip (04 §8.1). */
  juiciness: int().min(0).max(100).default(0),
  /** Whether this interaction carries a rumor (gossip) through belief.transmit(). */
  rumor_speaker: z.enum(['initiator', 'target']).optional(),
  transmits_rumor: z.boolean().default(false),
  /** Flag for chronicle/director: big events (04 §11.2). */
  notable: z.boolean().default(false),
  /** Game-minutes the interaction takes. */
  minutes: int().min(1).max(240).default(10),
  tags: z.array(id()).default([]),
  // ---- module:social additions ----
  /** Event importance 0..100 (0 = from `notable`: 40 if notable). */
  importance: int().min(0).max(100).default(0),
  /** Event visibility; 'auto' = public if notable, else witnessed. */
  visibility: z.enum(['auto', 'public', 'witnessed', 'private']).default('auto'),
  /** Hours before the same initiator may do this to the same target again. */
  cooldown_hours: nonNegInt().default(0),
  /** Never picked spontaneously at a venue: only as an urge (psyche/command), defense, or escalation. */
  urge_only: z.boolean().default(false),
  /**
   * If present, social proposes this as a targeted urge to the psyche (04 §3.4) when the
   * target is co-located and the volition score reaches `min_score`.
   */
  urge: z
    .strictObject({
      voice: z.enum(['id', 'superego']),
      min_score: int().default(40),
      /** Urge intensity = score × intensity_pct / 10 (score 100 at 100% = 1000). */
      intensity_pct: ratePct().default(100),
      label: z.string().min(1),
      drive: id().optional(),
      norm: id().optional(),
      /** Superego speaker: the target ("Mrs. Pratt:") when true. */
      spoken_by_target: z.boolean().default(false),
    })
    .optional(),
});
export type InteractionDef = z.output<typeof InteractionSchema>;

/** Memory kinds as data (04 §4.3): decay time constants, floors, valence, gist templates. */
export const MemoryKindSchema = z.strictObject({
  id: z.enum(MEMORY_KINDS),
  name: z.string().min(1),
  /** Negative memories decay with Rancor; positive ones with Neighborliness (04 §4.3). */
  valence: z.enum(['negative', 'neutral', 'positive']),
  /** τ_kind in days (before the intensity and disposition factors). */
  tau_days: int().min(1).max(36_500),
  /** Salience floor at intensity 100 (scaled by intensity): "a dead child never drops below 300". */
  floor: int().min(0).max(1000).default(0),
  /** Weekly consolidation into Summary memories (04 §4.3). */
  consolidate: z.boolean().default(true),
  /** Summary memory gist: {other}, {count}, {since}. */
  summary: z.string().default('{other}: {count} times since {since}'),
});
export type MemoryKindDef = z.output<typeof MemoryKindSchema>;

const DimsBlock = z
  .strictObject({
    affection: int().min(-100).max(100).default(0),
    respect: int().min(-100).max(100).default(0),
    trust: int().min(-100).max(100).default(0),
    fear: int().min(0).max(100).default(0),
  })
  .default(EMPTY_DELTA);

/** Social tuning (one record, id "default"). Every number the social system uses lives here. */
export const SocialTuningSchema = z.strictObject({
  id: id(),
  /** 04 §3.1 compatibility: weights per Value of |a.v − b.v|, and the cap. */
  compat_weights: z.partialRecord(valueId(), int().min(0).max(10)).default({}),
  compat_cap: int().min(0).max(100).default(15),
  /** Added before clamping: the doc's formula is never positive, so like minds start a little warm. */
  compat_offset: int().min(-100).max(100).default(5),
  /** Base opinion priors from structural edges (04 §7.1): how a regards b, and b regards a. */
  relationship_priors: z
    .array(z.strictObject({ kind: z.enum(RELATIONSHIP_KINDS), a_to_b: DimsBlock, b_to_a: DimsBlock }))
    .default([]),
  /** Prior for members of the same household with no closer edge. */
  household_prior: DimsBlock,
  /** Relationship kinds that count as kin. */
  kin_kinds: z.array(z.enum(RELATIONSHIP_KINDS)).default([]),
  // ---- encounters (04 §11.2) ----
  /** Expected initiations per awake actor-hour at sociability 100% and venue 100%, per mille. */
  encounter_rate_permille: int().min(0).max(5000).default(300),
  /** Venue factors by place tag (highest matching wins); default 100. */
  venue_pct: z.array(z.strictObject({ tag: id(), pct: ratePct() })).default([]),
  /** Activity sociability (0..100) adds this many percent per point; null activity counts as 30. */
  activity_sociability_pct: int().min(0).max(10).default(1),
  /** Sociability: 100 + per Neighborliness point, + per 100 Company deficit, + if drunk. */
  sociability_per_neighborliness: int().default(15),
  sociability_per_company_deficit: int().default(8),
  sociability_drunk: int().default(40),
  /** Hard caps (budget): initiations and participations per actor per hour. */
  max_initiations_per_hour: int().min(0).max(10).default(2),
  max_participations_per_hour: int().min(1).max(20).default(3),
  /** Top-N ties sampled plus one stranger slot (no all-pairs scan). */
  tie_sample: int().min(0).max(20).default(4),
  stranger_attempts: int().min(0).max(10).default(3),
  /** Witnesses sampled per interaction (04 §11.2: 0–2) and audience cap for 'all_present'. */
  max_witnesses: int().min(0).max(10).default(2),
  audience_cap: int().min(0).max(50).default(12),
  /** Uniform volition noise 0..n added to spontaneous choices. */
  volition_noise: int().min(0).max(100).default(15),
  // ---- memory (04 §4) ----
  salience_base: int().min(0).max(1000).default(300),
  salience_per_intensity: int().min(0).max(10).default(7),
  initiator_intensity_pct: ratePct().default(60),
  witness_intensity_pct: ratePct().default(40),
  /** +percent intensity per onlooker of a public act, and its cap (04 §4.2: +20 per 10, max +40). */
  audience_intensity_per_onlooker: int().min(0).max(100).default(2),
  audience_intensity_cap: int().min(0).max(100).default(40),
  /** Surprise bonus percent when a liked actor does something negative. */
  surprise_pct: int().min(0).max(200).default(30),
  forget_below: int().min(0).max(1000).default(50),
  consolidate_below: int().min(0).max(1000).default(250),
  max_memories: int().min(10).max(5000).default(300),
  // ---- opinion (04 §6) ----
  max_reasons: int().min(1).max(64).default(8),
  /** τ in days of the folded "other reasons" bucket. */
  bucket_tau_days: int().min(1).max(3650).default(60),
  /** Volatile opinion: percent kept each day, and the cap. */
  volatile_keep_pct: pct().default(40),
  volatile_cap: int().min(0).max(100).default(20),
  familiarity_per_encounter: int().min(0).max(1000).default(40),
  familiarity_decay_per_day: int().min(0).max(1000).default(2),
  max_opinions: int().min(10).max(1000).default(150),
  // ---- courtship eligibility ----
  courtship_min_age: int().min(0).max(100).default(16),
  courtship_opposite_sex: z.boolean().default(true),
  // ---- escalation (insult -> fight) ----
  escalation_dc: int().min(0).max(40).default(12),
  /** DC points per Temper view point of the target (hot heads lose it more). */
  escalation_per_temper: int().min(0).max(10).default(2),
  // ---- urges (proposeSocialUrges) ----
  /** Company below this makes the lonely seek a friend's venue. */
  company_seek_below: int().min(0).max(1000).default(450),
  /** Sociable activities to seek company at, by place tag (first matching existing activity). */
  seek_company: z.array(z.strictObject({ tag: id(), activity: ref() })).default([]),
  max_targeted_urges: int().min(0).max(10).default(2),
  /**
   * P1 publicity: a 'witnessed' interaction becomes public knowledge at a public venue (with
   * anyone else there to see it) or before at least `public_audience_min` onlookers anywhere.
   */
  public_venue_tags: z.array(id()).default(['tavern', 'store', 'church', 'street', 'landing']),
  public_audience_min: int().min(1).max(100).default(4),
  /** Volition penalty on every non-hostile interaction toward someone the initiator shuns (04 §9.2). */
  shun_volition_penalty: int().min(0).max(200).default(60),
  /** Defense → interactions it discharges through (10 §7), in preference order. */
  defense_interactions: z
    .array(
      z.strictObject({
        defense: id(),
        interactions: z.array(ref()).default([]),
        /** A defense-made opinion Reason (04 §6.2 viaDefense) the initiator adds about the target. */
        reason: z.string().optional(),
        reason_delta: DimsBlock,
      }),
    )
    .default([]),
  /** Place tag → belief channel for gossip (belief/api.ts Channel); default 'street'. */
  channels: z.array(z.strictObject({ tag: id(), channel: id() })).default([]),
});
export type SocialTuningDef = z.output<typeof SocialTuningSchema>;

export const socialDomains = {
  interactions: defineDomain({ dir: 'interactions', key: 'interaction', schema: InteractionSchema }),
  memory_kinds: defineDomain({ dir: 'social', key: 'memory_kind', schema: MemoryKindSchema }),
  social_tuning: defineDomain({ dir: 'social', key: 'social_tuning', schema: SocialTuningSchema }),
};

/** Top-level scenario fields owned by social. Actor references are scenario actor keys. */
export const socialScenarioFields = {
  relationships: z
    .array(
      z.strictObject({
        a: z.string().min(1),
        b: z.string().min(1),
        kind: z.enum(RELATIONSHIP_KINDS),
        /** Amount owed for creditor edges, in cents. */
        amount_cents: nonNegInt().optional(),
        note: z.string().optional(),
        /** How long the edge has existed, in days before the start (courting for weeks). */
        days: nonNegInt().optional(),
      }),
    )
    .default([]),
  /** Seed opinion reasons: "from" holds an opinion of "to" because of `reason`. */
  opinions: z
    .array(
      z.strictObject({
        from: z.string().min(1),
        to: z.string().min(1),
        reason: z.string().min(1),
        affection: int().min(-100).max(100).default(0),
        respect: int().min(-100).max(100).default(0),
        trust: int().min(-100).max(100).default(0),
        fear: int().min(0).max(100).default(0),
      }),
    )
    .default([]),
  /**
   * Seed memories (backstory, 04 §4.1): `owner` remembers `about` doing `kind`. With any
   * opinion delta, the memory is also cited by an opinion Reason (so it fades as it fades).
   */
  memories: z
    .array(
      z.strictObject({
        owner: z.string().min(1),
        about: z.string().min(1),
        kind: z.enum(MEMORY_KINDS),
        summary: z.string().min(1),
        emotion: z.enum(EMOTIONS).default('none'),
        intensity: int().min(0).max(100),
        days_ago: nonNegInt().default(0),
        /** Reason label; defaults to the summary. */
        reason: z.string().optional(),
        affection: int().min(-100).max(100).default(0),
        respect: int().min(-100).max(100).default(0),
        trust: int().min(-100).max(100).default(0),
        fear: int().min(0).max(100).default(0),
      }),
    )
    .default([]),
};

export function socialRefs(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  for (const i of Object.values(b.interactions)) {
    const where = `interactions:${i.id}`;
    if (i.check.kind !== 'none') checkRefs(issues, where, 'check.skill', [i.check.skill], b.skills, 'skill');
    if (i.check.kind === 'opposed' && !['will', 'fortitude', 'reflex'].includes(i.check.vs)) {
      checkRefs(issues, where, 'check.vs', [i.check.vs], b.skills, 'skill or save');
    }
    for (const eff of [i.success, i.failure]) {
      checkRefs(issues, where, 'escalates_to', [eff.escalates_to], b.interactions, 'interaction');
      checkRefs(issues, where, 'initiator_needs', Object.keys(eff.initiator_needs), b.needs, 'need');
      checkRefs(issues, where, 'target_needs', Object.keys(eff.target_needs), b.needs, 'need');
      checkRefs(issues, where, 'audience_needs', Object.keys(eff.audience_needs), b.needs, 'need');
      checkRefs(
        issues,
        where,
        'target_thought.interaction',
        [eff.target_thought?.interaction],
        b.interactions,
        'interaction',
      );
    }
    for (const v of i.volition) {
      const problem = volitionDriverIssue(v.driver);
      if (problem) issues.push({ where, path: 'volition', message: problem });
      const [prefix, arg] = v.driver.split(':');
      if (prefix === 'need' || prefix === 'target_need') checkRefs(issues, where, 'volition', [arg], b.needs, 'need');
      if (prefix === 'trait') checkRefs(issues, where, 'volition', [arg], b.traits, 'trait');
    }
    if (i.memory && Object.keys(b.memory_kinds).length > 0) {
      const kinds = [i.memory.kind, i.success.memory_kind, i.failure.memory_kind];
      checkRefs(issues, where, 'memory.kind', kinds, b.memory_kinds, 'memory_kind');
    }
  }
  // Scenario backstory memories name scenario actor keys (relationships/opinions are
  // checked by scenarioRefs).
  for (const s of Object.values(b.scenarios ?? {})) {
    const actorKeys: Record<string, true> = {};
    for (const a of s.actors) actorKeys[a.key] = true;
    for (const m of s.memories ?? []) {
      checkRefs(issues, `scenarios:${s.id}/memories`, 'owner/about', [m.owner, m.about], actorKeys, 'actor key');
      if (Object.keys(b.memory_kinds).length > 0)
        checkRefs(issues, `scenarios:${s.id}/memories`, 'kind', [m.kind], b.memory_kinds, 'memory_kind');
    }
  }
  for (const t of Object.values(b.social_tuning)) {
    const where = `social_tuning:${t.id}`;
    for (const s of t.seek_company) checkRefs(issues, where, 'seek_company', [s.activity], b.activities, 'activity');
    for (const d of t.defense_interactions)
      checkRefs(issues, where, 'defense_interactions', d.interactions, b.interactions, 'interaction');
  }
  return issues;
}
