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
  'omen',
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
  /** module:social addition: the two are not on speaking terms (a household or kin quarrel's rupture). */
  'estranged',
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
    /** Hand one unit of the initiator's gift item (see requires.gift_item) to the target. */
    give_item: z.boolean().default(false),
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
    give_item: false,
  });
export type InteractionEffect = z.output<typeof EffectSchema>;

export const InteractionSchema = z.strictObject({
  id: id(),
  relief: z.enum(['give', 'ask', 'collect']).optional(),
  theft: z.boolean().optional(),
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
      /**
       * How well the TARGET must know the initiator (their familiarity 0..1000). Structural: it
       * holds for commands and urges too (nobody walks out with a near stranger on one word).
       */
      target_min_familiarity: int().min(0).max(1000).default(0),
      /**
       * The initiator must have something to give (an item of a `gift_sections` section, from
       * their own kit, else their household's stores): no gift is made of thin air.
       */
      gift_item: z.boolean().default(false),
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
      target_min_familiarity: 0,
      gift_item: false,
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
        /**
         * The target's Affection for the initiator below which the answer is no whatever is said:
         * the check fails outright, with the shortfall as a named term (module:social addition).
         */
        min_regard: int().min(-100).max(100).optional(),
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
  /**
   * What kind of telling it is: `news` (the teller's freshest news), `warning` (ill news first:
   * scandal, the uncanny), `confidence` (a private matter: the teller's unvoiced or secret
   * beliefs, which the hearer then keeps close), or `charge` (what the teller holds against the
   * hearer, said to their face).
   */
  rumor_mode: z.enum(['news', 'warning', 'confidence', 'charge']).default('news'),
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
  /**
   * An item-specific interaction (13 §6.1, §6.2): the urge carries `itemId` (and `terms`), and
   * social validates possession, room and terms before any time is spent, then moves the item.
   */
  item: z
    .strictObject({
      act: z.enum(['show', 'loan', 'return', 'demand', 'take', 'share', 'restitution']),
      /** Who must hold the item for the act to be valid. */
      holder: z.enum(['initiator', 'target']),
      /** What the target undertakes by agreeing; a commanded target answers it as a pending request. */
      response: z.enum(['show_item', 'lend_item', 'return_item', 'accept_item']).optional(),
      /** After the check, the holder decides by their own arbitration (keep vs. lend). */
      decision: z.boolean().default(false),
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
  /** Below this age (years) a person is not yet in conversation: no talk to or from an infant. */
  min_social_age: int().min(0).max(18).default(3),
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
  /** Hours after a retaliation before the same target loses their temper with the same initiator again. */
  escalation_cooldown_hours: nonNegInt().default(48),
  /** DC adjustments to losing one's temper with someone under the same roof / kin (negative = keeps it). */
  escalation_household_dc: int().min(-20).max(20).default(-4),
  escalation_kin_dc: int().min(-20).max(20).default(-3),
  /** DC per hostile act between the pair inside `strife_window_days` (weariness, negative). */
  escalation_weary_dc: int().min(-10).max(10).default(-2),
  // ---- strife: weariness and the way out of a loop ----
  /**
   * Pair weariness: each hostile act between two people in the last `strife_window_days`
   * multiplies further hostile volition, urges, retaliation and displaced acts between them
   * by `strife_weariness_pct` percent (a quarrel tires; it does not feed on itself forever).
   */
  strife_window_days: int().min(1).max(365).default(14),
  strife_weariness_pct: pct().default(60),
  /**
   * Rupture: `rupture_fights` fights within `rupture_window_days` between people of one
   * household or kin, and the two stop speaking (an `estranged` edge) for `estrangement_days`,
   * or until a third party fond of both mediates.
   */
  rupture_window_days: int().min(1).max(365).default(30),
  rupture_fights: int().min(1).max(50).default(4),
  estrangement_days: int().min(1).max(365).default(28),
  mediation_min_affection: int().min(-100).max(100).default(15),
  mediation_min_age: nonNegInt().default(16),
  mediation_skill: id().default('persuade'),
  mediation_dc: nonNegInt().default(12),
  /** Percent by which each party's negative memories of the other lose salience when mediated. */
  mediation_soften_pct: pct().default(50),
  /** Interactions still possible between estranged people (amends: an apology may break the silence). */
  estranged_allow_tags: z.array(id()).default(['amends']),
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
  // ---- availability: talk with people at work (playtest r2) ----
  /**
   * Someone at work (a 'labor' activity) can spare this many minutes of talk without stopping:
   * a greeting, a chat, a debt settled, the news asked. Longer exchanges wait for the end of work.
   */
  work_talk_minutes: int().min(0).max(240).default(15),
  /** Work at least this sociable (keeping the tavern, the shop counter) is done while talking: any exchange, no cost. */
  work_talk_sociability: int().min(0).max(100).default(50),
  /**
   * Holding someone in talk on purpose during their working hours (at less sociable work) costs a
   * little of their regard: a Reason citing their memory of the exchange, so it fades with it.
   */
  kept_from_work: z
    .strictObject({ reason: z.string().min(1), delta: DimsBlock })
    .default({ reason: 'Kept me from my work', delta: { affection: -2, respect: 0, trust: 0, fear: 0 } }),
  // ---- requests (offers and asks that wait on an answer) ----
  /** Hours before the same asker puts the same request to the same person again. */
  request_cooldown_hours: nonNegInt().default(72),
  /** ...and after it was refused or went unanswered. */
  refused_request_cooldown_hours: nonNegInt().default(168),
  /** A money debt settled within this many hours of being taken on earns the creditor's trust nothing. */
  repay_trust_min_hours: nonNegInt().default(24),
  // ---- gifts ----
  /** Item catalog sections a gift may be drawn from (trade goods, provisions, a book...). */
  gift_sections: z.array(id()).default(['trade_goods', 'provisions', 'books', 'medicine', 'wild_food']),
  /** The value (cents) of a usual small gift: the giver hands over the item nearest it. */
  gift_value_cents: nonNegInt().default(10),
});
export type SocialTuningDef = z.output<typeof SocialTuningSchema>;

// ---- talk: what is said (playtest 2026-10-11: social verbs returned no content) ----

/** Relationship label of one party's view of the other (opinion.ts labels, plus the unlabeled). */
export const TALK_LABELS = ['friend', 'enemy', 'rival', 'admirer', 'cowed', 'acquaintance', 'stranger'] as const;

/**
 * Moods a speaker's psyche can lend a line: the drive or norm of their loudest live thought
 * (Appetite: hunger, lust, rage, sloth, greed, fear, envy, longing; Conscience: duty, piety,
 * sabbath, temperance, propriety, shame, neighborliness, thrift, honesty, our_own), or a state
 * that colors everything said ('anxious', 'drunk', 'hungry', 'weary', 'easy').
 */
export const TALK_STATES = ['anxious', 'drunk', 'hungry', 'weary', 'easy'] as const;

/** One id or a list of them (`occupation = "ferryman"` or `["ferryman", "boatman"]`). */
const TalkIds = z.union([id(), z.array(id()).min(1)]).transform((v) => (Array.isArray(v) ? v : [v]));

/**
 * Who a speaker is, for lines that belong to a person or to a kind of person (wave 5, group D;
 * additive). A story with a teller (`initiator = { actor = "amos_whitcomb" }`) is only ever told
 * by that person; a rib about it (`target = { actor = "amos_whitcomb" }`) is only said to them. A
 * kind of person works in generated towns, where nobody has an authored key: a riverman's yarn
 * is `{ occupation = ["ferryman", "boatman"] }`, a grandmother's `{ sex = "female", age = "elder" }`.
 * Every field listed must hold (ids within a field are alternatives).
 */
export const TalkWhoSchema = z.strictObject({
  /** Scenario actor key(s) (the `key` of a scenario `[[actors]]`). */
  actor: TalkIds.optional(),
  occupation: TalkIds.optional(),
  /** Culture the speaker was raised in (content/base/cultures). */
  culture: TalkIds.optional(),
  trait: TalkIds.optional(),
  sex: z.enum(['female', 'male']).optional(),
  /** young: 13–24, prime: 25–49, elder: 50 and over. */
  age: z.enum(['young', 'prime', 'elder']).optional(),
});
export type TalkWho = z.output<typeof TalkWhoSchema>;

/**
 * Conditions a talk line needs, all read from the live world at the moment it is said (P1:
 * nothing is claimed the sim did not feel). Omitted = any. "Initiator" is whoever opened the
 * exchange; `target_*` reads the other side.
 */
const TalkWhenSchema = z
  .strictObject({
    /** The sky this hour: falling rain, falling snow, or dry. */
    weather: z.enum(['rain', 'snow', 'dry']).optional(),
    /** Air temperature band: freezing ≤ 32°F, cold < 50, mild < 70, warm < 85, hot. */
    temp: z.enum(['freezing', 'cold', 'mild', 'warm', 'hot']).optional(),
    season: z.enum(['spring', 'summer', 'autumn', 'winter']).optional(),
    /** Part of the day: morning 5–11, midday 11–14, afternoon 14–18, evening 18–22, night. */
    part: z.enum(['morning', 'midday', 'afternoon', 'evening', 'night']).optional(),
    sabbath: z.boolean().optional(),
    /** A calendar observance active today (activities/calendar.toml: market_day, christmas...). */
    observance: id().optional(),
    /** A tag of the place where it is said (tavern, church, store, smithy...). */
    venue: id().optional(),
    /** The initiator's settled view of the target, and the target's of the initiator. */
    label: z.enum(TALK_LABELS).optional(),
    target_label: z.enum(TALK_LABELS).optional(),
    kin: z.boolean().optional(),
    household: z.boolean().optional(),
    /** The two are courting or betrothed. */
    courting: z.boolean().optional(),
    /** Mood of the initiator / target (a drive, a norm, or a TALK_STATES entry). */
    mood: id().optional(),
    target_mood: id().optional(),
    /** The initiator remembers the target doing this (salience ≥ 200), and the reverse. */
    remembers: z.enum(MEMORY_KINDS).optional(),
    target_remembers: z.enum(MEMORY_KINDS).optional(),
    /** Money owed between them, by whom (binds {owed}). */
    owes: z.enum(['initiator', 'target']).optional(),
    /** The initiator has heard of (and credits) a misfortune of the last fortnight (binds {misfortune}). */
    misfortune: z.boolean().optional(),
    /** A store in town is open for trade (binds {price_item}, {price}, {store}). */
    price: z.boolean().optional(),
    /** For news-carrying acts: something was told (true) or the teller had nothing (false). */
    told: z.boolean().optional(),
    /** Nothing told, though the teller does hold news: only old talk everyone has had. */
    stale: z.boolean().optional(),
    /** The kind of thing told: scandal (ill of someone), uncanny (fae, curses), kind, or plain news. */
    rumor: z.enum(['scandal', 'uncanny', 'kind', 'plain']).optional(),
    /** The hearer already had it, credits it (credence ≥ 50 after), or doubts it. */
    heard: z.enum(['already', 'credits', 'doubts']).optional(),
    /** The teller had it from someone else (binds {source}) rather than knowing it first-hand. */
    secondhand: z.boolean().optional(),
    /** Whom the news is about: the teller themselves, the hearer (to their face), or another. */
    about: z.enum(['self', 'you', 'other']).optional(),
    /**
     * The initiator / target is a child (under 13). When a child is party to an exchange, lines
     * that name `child` or `target_child` are preferred over grown-up talk.
     */
    child: z.boolean().optional(),
    target_child: z.boolean().optional(),
    /** Who the initiator / target is (a teller who owns a story; a kind of person). See TalkWhoSchema. */
    initiator: TalkWhoSchema.optional(),
    target: TalkWhoSchema.optional(),
  })
  .default({});

/** One turn of an exchange: who speaks and the words (alternatives {a|b}, slots, #words#). */
const TalkTurnSchema = z.strictObject({
  by: z.enum(['initiator', 'target']),
  text: z.string().min(1),
});

/**
 * A talk line: a 1–3 turn exchange voiced for an interaction and outcome, picked by the
 * conditions it meets (more specific lines weigh more), never repeated between the same pair
 * within a week. `part = "said"` lines carry the news itself on the private `belief.transmitted`
 * event (only teller and hearer know the words); `part = "act"` lines (the default) go on the
 * `social.interaction` event, which witnesses may overhear.
 */
export const TalkLineSchema = z.strictObject({
  id: id(),
  /** Interaction ids this line can voice. */
  on: z.array(id()).default([]),
  /** ...or any interaction carrying one of these tags (friendly, hostile, talk, amends...). */
  on_tags: z.array(id()).default([]),
  part: z.enum(['act', 'said']).default('act'),
  outcome: z.enum(['success', 'failure', 'any']).default('any'),
  when: TalkWhenSchema,
  /** `repeat_aware`: a listener's response, eligible only after hearing repeated words. */
  tags: z.array(id()).optional(),
  /** Relative weight among the lines that fit (scaled up by how many conditions it names). */
  weight: int().min(1).max(100).default(10),
  lines: z.array(TalkTurnSchema).min(1).max(3),
});
export type TalkLineDef = z.output<typeof TalkLineSchema>;

/**
 * A word or phrase in a speaker's own idiom: `#hello#` in a line becomes one of `words`, or of
 * `by_culture[<speaker's culture>]` when the speaker was raised in it. Light flavor only: a
 * greeting, an oath, a thank-you; never dialect spelling or caricature.
 */
export const TalkWordSchema = z.strictObject({
  id: id(),
  words: z.array(z.string().min(1)).min(1),
  by_culture: z.record(id(), z.array(z.string().min(1)).min(1)).default({}),
});
export type TalkWordDef = z.output<typeof TalkWordSchema>;

export const ReliefRuleSchema = z.strictObject({
  id: id(),
  offer_hours: z.array(int().min(0).max(23)).min(1).default([7]),
  reserve_days: int().min(1).max(14).default(4),
  parcel_days: int().min(1).max(7).default(2),
  want_days: int().min(1).max(7).default(2),
  want_cash_cents: nonNegInt().default(100),
  credence: int().min(1).max(100).default(50),
  duty_base: nonNegInt().default(620),
  theft_hunger: int().min(0).max(1000).default(180),
  theft_dc: int().min(1).max(30).default(13),
  detection_dc: int().min(1).max(30).default(12),
  credit_bonus_cents: nonNegInt().default(1500),
  credit_respect: int().min(-100).max(100).default(20),
  credit_min_trust: int().min(-100).max(100).default(-10),
  starvation_band_permille: int().min(0).max(1000).default(20),
});
export const ReliefOfficeSchema = z.strictObject({
  id: id(),
  name: z.string(),
  role: id(),
  members_only: z.boolean(),
  attendance_membership: z.boolean().default(false),
  member_relationship: z.enum(RELATIONSHIP_KINDS).default('congregant_with'),
  favors: nonNegInt().max(10).default(1),
  pantry_target_days: int().min(1).max(30).default(7),
  deserving_credence: int().min(0).max(100).default(40),
});

export const socialDomains = {
  reliefRules: defineDomain({ dir: 'social', key: 'relief_rules', schema: ReliefRuleSchema }),
  reliefOffices: defineDomain({ dir: 'social', key: 'relief_office', schema: ReliefOfficeSchema }),
  interactions: defineDomain({ dir: 'interactions', key: 'interaction', schema: InteractionSchema }),
  memory_kinds: defineDomain({ dir: 'social', key: 'memory_kind', schema: MemoryKindSchema }),
  social_tuning: defineDomain({ dir: 'social', key: 'social_tuning', schema: SocialTuningSchema }),
  talk_lines: defineDomain({ dir: 'social', key: 'talk', schema: TalkLineSchema }),
  talk_words: defineDomain({ dir: 'social', key: 'talk_word', schema: TalkWordSchema }),
};

/** Top-level scenario fields owned by social. Actor references are scenario actor keys. */
export const socialScenarioFields = {
  relief_offices: z
    .array(
      z.strictObject({
        office: id(),
        keeper: z.string(),
        members: z.array(z.string()),
      }),
    )
    .default([]),
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
    const householdKeys = Object.fromEntries(s.households.map((h) => [h.key, true]));
    for (const o of s.relief_offices ?? []) {
      checkRefs(issues, `scenarios:${s.id}/relief_offices`, 'office', [o.office], b.reliefOffices, 'relief office');
      checkRefs(issues, `scenarios:${s.id}/relief_offices`, 'keeper', [o.keeper], actorKeys, 'actor key');
      checkRefs(issues, `scenarios:${s.id}/relief_offices`, 'members', o.members, householdKeys, 'household key');
    }
    for (const m of s.memories ?? []) {
      checkRefs(issues, `scenarios:${s.id}/memories`, 'owner/about', [m.owner, m.about], actorKeys, 'actor key');
      if (Object.keys(b.memory_kinds).length > 0)
        checkRefs(issues, `scenarios:${s.id}/memories`, 'kind', [m.kind], b.memory_kinds, 'memory_kind');
    }
  }
  // Talk lines: known interactions, observances and cultures; #words# that exist; every
  // interaction has at least one line for each outcome it can have (no exchange left empty).
  const words = b.talk_words ?? {};
  for (const l of Object.values(b.talk_lines ?? {})) {
    const where = `talk_lines:${l.id}`;
    checkRefs(issues, where, 'on', l.on, b.interactions, 'interaction');
    if (l.when.observance !== undefined)
      checkRefs(issues, where, 'when.observance', [l.when.observance], b.observances ?? {}, 'observance');
    if (l.on.length === 0 && l.on_tags.length === 0)
      issues.push({ where, path: 'on', message: 'a talk line needs `on` or `on_tags`' });
    for (const mood of [l.when.mood, l.when.target_mood]) {
      if (
        mood !== undefined &&
        !(TALK_STATES as readonly string[]).includes(mood) &&
        !Object.hasOwn(b.drives ?? {}, mood) &&
        !Object.hasOwn(b.norms ?? {}, mood)
      )
        issues.push({
          where,
          path: 'when.mood',
          message: `unknown mood '${mood}' (a drive, a norm, or ${TALK_STATES.join('/')})`,
        });
    }
    // `initiator` / `target` blocks: occupations, cultures and traits exist; an actor key is a
    // scenario actor's key in some scenario (the line belongs to that person).
    for (const [side, who] of [
      ['initiator', l.when.initiator],
      ['target', l.when.target],
    ] as const) {
      if (!who) continue;
      const path = `when.${side}`;
      checkRefs(issues, where, `${path}.occupation`, who.occupation ?? [], b.occupations ?? {}, 'occupation');
      checkRefs(issues, where, `${path}.culture`, who.culture ?? [], b.cultures ?? {}, 'culture');
      checkRefs(issues, where, `${path}.trait`, who.trait ?? [], b.traits ?? {}, 'trait');
      for (const key of who.actor ?? [])
        if (!Object.values(b.scenarios ?? {}).some((s) => s.actors.some((a) => a.key === key)))
          issues.push({ where, path: `${path}.actor`, message: `no scenario actor has the key '${key}'` });
    }
    for (const turn of l.lines) {
      for (const m of turn.text.matchAll(/#([a-z][a-z0-9_]*)#/g))
        if (!Object.hasOwn(words, m[1] as string))
          issues.push({ where, path: 'lines', message: `unknown talk word '#${m[1]}#'` });
    }
  }
  for (const w of Object.values(words))
    checkRefs(issues, `talk_words:${w.id}`, 'by_culture', Object.keys(w.by_culture), b.cultures ?? {}, 'culture');
  if (Object.keys(b.talk_lines ?? {}).length > 0) {
    for (const i of Object.values(b.interactions)) {
      const covers = (outcome: 'success' | 'failure') =>
        Object.values(b.talk_lines).some(
          (l) =>
            l.part === 'act' &&
            (l.outcome === 'any' || l.outcome === outcome) &&
            (l.on.includes(i.id) || l.on_tags.some((t) => i.tags.includes(t))),
        );
      if (!covers('success')) issues.push({ where: `interactions:${i.id}`, message: 'no talk line for success' });
      if (i.check.kind !== 'none' && !covers('failure'))
        issues.push({ where: `interactions:${i.id}`, message: 'no talk line for failure' });
    }
  }
  for (const t of Object.values(b.social_tuning)) {
    const where = `social_tuning:${t.id}`;
    for (const s of t.seek_company) checkRefs(issues, where, 'seek_company', [s.activity], b.activities, 'activity');
    checkRefs(issues, where, 'mediation_skill', [t.mediation_skill], b.skills, 'skill');
    for (const d of t.defense_interactions)
      checkRefs(issues, where, 'defense_interactions', d.interactions, b.interactions, 'interaction');
  }
  return issues;
}
