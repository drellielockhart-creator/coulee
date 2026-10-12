/**
 * Psyche content: traits (with psyche weights), drives, norms, thought generators, defenses,
 * compromise and sublimation templates, urge tags; plus per-actor psyche scenario seeds.
 * OWNER: module:psyche (see docs/impl/MODULES.md; design: design-docs/10-psyche.md).
 *
 * Scales (10 §14.5 divergences): psyche numbers 0..100, anxiety 0..1000, thought intensity
 * 0..1000 (the doc's 0..100 intensities read ×10). Norm strengths and drive weights 0..100.
 * Traits are discrete tags (04 §3.2) that shift those numbers, the 04 §3.1 Values, voice
 * loudness, urge biases and preferred defenses.
 */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import {
  checkRefs,
  defineDomain,
  type Issue,
  id,
  int,
  pct,
  ratePct,
  ref,
  valueId,
  valuesBlock,
  weekday,
} from './common.ts';

export const DEFENSE_IDS = [
  'repression',
  'projection',
  'displacement',
  'rationalization',
  'sublimation',
  'denial',
  'reaction_formation',
] as const;
export type DefenseId = (typeof DEFENSE_IDS)[number];

/** Defense maturity tiers (10 §7.1): gates by ego strength; Insight reveals by tier (10 §8.5). */
export const DEFENSE_TIERS = ['immature', 'neurotic', 'mature'] as const;
export type DefenseTier = (typeof DEFENSE_TIERS)[number];

/** Freud's three anxieties (10 §6): the pools that sum to `anxiety`. */
export const ANXIETY_POOLS = ['real', 'neur', 'moral'] as const;
export type AnxietyPool = (typeof ANXIETY_POOLS)[number];

/** Signed shifts to drive weights / norm strengths, keyed by drive or norm id. */
const shifts = () => z.record(id(), int().min(-50).max(50)).default({});

export const TraitSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  /** Period-flavored label for the UI (P7 framing), e.g. "Of a Sanguine Temper". */
  period_label: z.string().optional(),
  description: z.string().default(''),
  /** Additive shifts to the psyche numbers (clamped 0..100 after summing). */
  psyche: z
    .strictObject({
      ego: int().min(-50).max(50).default(0),
      superego: int().min(-50).max(50).default(0),
      id_appetite: int().min(-50).max(50).default(0),
    })
    .default({ ego: 0, superego: 0, id_appetite: 0 }),
  /** Additive shifts to 04 Values (clamped −3..+3). */
  values: valuesBlock(),
  /** Loudness multipliers for each voice's thoughts, percent. */
  voice_pct: z
    .strictObject({ id: ratePct().default(100), superego: ratePct().default(100) })
    .default({ id: 100, superego: 100 }),
  /** Biases on specific urges: multiply proposal intensity by pct. */
  urge_bias: z
    .array(
      z.strictObject({
        kind: z.enum(['activity', 'interaction']),
        id: id(),
        pct: ratePct(),
      }),
    )
    .default([]),
  /** Defense preference weights (percent, 100 = neutral). style = 10 × pct / 100 (10 §14.5 #6). */
  defenses: z.partialRecord(z.enum(DEFENSE_IDS), ratePct()).default({}),
  /** Additive shifts to drive weights (10 §3.2), e.g. `{ rage = 20 }`. */
  drives: shifts(),
  /** Additive shifts to norm strengths (10 §3.3), e.g. `{ temperance = 30 }`. */
  norms: shifts(),
  /** Traits that cannot co-occur. A persona trait that excludes a real trait masks it (10 §8.1). */
  excludes: z.array(id()).default([]),
  tags: z.array(id()).default([]),
});
export type TraitDef = z.output<typeof TraitSchema>;

// ---------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------

/** A concrete urge reference (activity or interaction id). */
export const UrgeRefSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('activity'), id: ref() }),
  z.strictObject({ kind: z.literal('interaction'), id: ref() }),
]);
export type UrgeRef = z.output<typeof UrgeRefSchema>;

/**
 * Situation conditions (10 §4.2 "situations as data"). Every present field must hold.
 * Hours are [from, to) with wrap past midnight, like schedule blocks.
 */
export const WhenSchema = z.strictObject({
  /** Fires while the need is below `at`; the deficit sets the base intensity (10 §4.2 #1). */
  need_below: z.strictObject({ need: ref(), at: int().min(1).max(1000) }).optional(),
  hours: z.strictObject({ from: int().min(0).max(23), to: int().min(1).max(24) }).optional(),
  weekdays: z.array(weekday()).optional(),
  sabbath: z.boolean().optional(),
  /** Was asleep last hour. */
  asleep: z.boolean().optional(),
  /** The schedule block now names an activity carrying one of these urge tags. */
  scheduled_tags: z.array(id()).optional(),
  /** No schedule block applies now. */
  unscheduled: z.boolean().optional(),
  value_min: z.partialRecord(valueId(), int().min(-3).max(3)).optional(),
  value_max: z.partialRecord(valueId(), int().min(-3).max(3)).optional(),
  drive_min: z.record(id(), pct()).optional(),
  norm_min: z.record(id(), pct()).optional(),
  norm_max: z.record(id(), pct()).optional(),
  anxiety_min: int().min(0).max(1000).optional(),
  /** At least this many non-household actors share the place (an audience, 10 §4.2 #4). */
  audience_min: int().min(0).max(100).optional(),
  /** The actor's current place has one of these tags. */
  place_tags: z.array(id()).optional(),
  /** The actor owes someone (a `creditor` relationship points at them). */
  debtor: z.boolean().optional(),
  /** The actor holds (innately or acquired) at least one of these traits. */
  traits_any: z.array(id()).optional(),
});
export type WhenDef = z.output<typeof WhenSchema>;

/**
 * Whom a targeted thought is about (10 §4.2 #2–#3, 04 §3.6): picked from the actor's
 * opinions, relationships and memories. The best-scoring candidate wins (ties by id).
 */
export const TargetSchema = z.strictObject({
  /**
   * hostile: Affection at or below `affection_max`. fond: Affection at or above `affection_min`.
   * envied: Respect ≥ `respect_min` with Affection ≤ `affection_max`. feared: Fear ≥ `fear_min`.
   * creditor: someone the actor owes. memory: the other party of a salient memory whose
   * emotion is in `emotions`.
   */
  pick: z.enum(['hostile', 'fond', 'envied', 'feared', 'creditor', 'memory']),
  /** yes: target must share the place; no: must be elsewhere; any: either (absent ×absent_pct). */
  present: z.enum(['yes', 'no', 'any']).default('any'),
  affection_min: int().min(-100).max(100).optional(),
  affection_max: int().min(-100).max(100).optional(),
  respect_min: int().min(-100).max(100).optional(),
  fear_min: int().min(0).max(100).optional(),
  emotions: z.array(id()).default([]),
  /** Memory salience floor (0..1000) for pick = 'memory'. */
  salience_min: int().min(0).max(1000).default(300),
  /** Intensity per opinion point past the threshold (or per 10 salience for memories). */
  per_point: int().min(0).max(100).default(10),
  /** Intensity multiplier when the target is not here (brooding), percent. */
  absent_pct: pct().default(50),
  not_kin: z.boolean().default(false),
  /** Each point of the 04 Temper value lowers a hostile threshold by this much (10 §3.3). */
  temper_slack: int().min(0).max(30).default(0),
});
export type TargetDef = z.output<typeof TargetSchema>;

// ---------------------------------------------------------------------------------------------
// Drives (the Id's voices, 10 §3.2) and norms (the Superego's content, 10 §3.3)
// ---------------------------------------------------------------------------------------------

export const DriveSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  /** 1855 label (10 §12): "Appetite", "Choler", "the Flesh". */
  period_label: z.string().min(1),
  description: z.string().default(''),
  /** The Superego disowns this drive: it can be repressed into the Shadow and projected. */
  forbidden: z.boolean().default(false),
  /** Frustration books this anxiety pool (fear → realistic anxiety, 10 §6). */
  anxiety_pool: z.enum(['neur', 'real']).default('neur'),
  /** Its targeted urges can be displaced onto a safer target (10 §7.2 displacement). */
  displaceable: z.boolean().default(false),
  /** Drive weight = 50 + Σ value × coefficient (04 §3.1 folds Temper/Ambition into drives). */
  values: z.partialRecord(valueId(), int().min(-20).max(20)).default({}),
  /** Trait ids that stand for this drive in the Shadow and in projected beliefs ("hot_tempered"). */
  shadow_traits: z.array(ref()).default([]),
  /** Urge tags whose options relieve this drive's needs (the ego's reality appraisal, 10 §5.2). */
  relief_tags: z.array(id()).default([]),
  /** Needs that feed this drive and their thought thresholds (10 §3.4 registry). */
  needs: z.array(z.strictObject({ need: ref(), at: int().min(1).max(1000) })).default([]),
});
export type DriveDef = z.output<typeof DriveSchema>;

export const NormSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  period_label: z.string().min(1),
  description: z.string().default(''),
  /** Who speaks it in the Inner Voices panel (10 §4.3): "Mother", "the Pastor", "the neighbors". */
  speaker: z.string().min(1),
  source: z.enum(['parent', 'community', 'church', 'self', 'pact', 'law']),
  /** Strength before Values: 0..100. */
  base: pct().default(50),
  /** Strength += Σ value × coefficient (10 §3.3, migration `strength = 50 + 15 × value`). */
  values: z.partialRecord(valueId(), int().min(-20).max(20)).default({}),
  /** Public norms grow louder with an audience: +min(300, 50 × onlookers) (10 §4.2 #4). */
  public: z.boolean().default(false),
  /**
   * Prohibitions: options carrying any of `tags` draw a Superego thought against them, at
   * base = relevance × 10 before strength/strictness weighting.
   */
  forbids: z
    .array(
      z.strictObject({
        tags: z.array(id()).min(1),
        relevance: pct(),
        when: WhenSchema.default({}),
      }),
    )
    .default([]),
  /** Lines for its prohibitions; `{option}` is replaced by the option's name. */
  lines: z.array(z.string().min(1)).min(1),
});
export type NormDef = z.output<typeof NormSchema>;

// ---------------------------------------------------------------------------------------------
// Thought generators (10 §4.2, §14.3)
// ---------------------------------------------------------------------------------------------

export const ThoughtRuleSchema = z
  .strictObject({
    id: id(),
    voice: z.enum(['id', 'superego']),
    drive: ref().optional(),
    norm: ref().optional(),
    when: WhenSchema.default({}),
    /** What the thought wants. Exactly one of `urge`, `scheduled`, `against_tags`. */
    urge: UrgeRefSchema.optional(),
    /** The activity of the current schedule block; base = the block's duty (10 §14.5 #8). */
    scheduled: z.boolean().default(false),
    /** A thought AGAINST the strongest option carrying one of these tags ("let the forge wait"). */
    against_tags: z.array(id()).default([]),
    target: TargetSchema.optional(),
    /** Base intensity 0..1000 before weighting (ignored when `need_below` or `scheduled` set it). */
    base: int().min(0).max(1000).default(0),
    decay_per_hour: int().min(1).max(1000).default(150),
    /**
     * Psyche fills gaps: skip this rule when another module already proposes for the same
     * drive/norm (or the same urge and voice) this hour.
     */
    fallback: z.boolean().default(true),
    /** Short summary for lists: "Appetite: eat something". `{target}` is substituted. */
    label: z.string().min(1),
    /** Voiced lines (Id: first person; Superego: the speaker's words). `{target}`, `{option}`. */
    lines: z.array(z.string().min(1)).min(1),
    /** Log a psyche.thought event when it first surfaces (chronicle-worthy). */
    notable: z.boolean().default(false),
  })
  .superRefine((t, c) => {
    const n = (t.urge ? 1 : 0) + (t.scheduled ? 1 : 0) + (t.against_tags.length > 0 ? 1 : 0);
    if (n !== 1) c.addIssue({ code: 'custom', message: 'exactly one of urge, scheduled, against_tags' });
    if (t.voice === 'id' && !t.drive) c.addIssue({ code: 'custom', message: "voice 'id' needs a drive" });
    if (t.voice === 'superego' && !t.norm) c.addIssue({ code: 'custom', message: "voice 'superego' needs a norm" });
    if (t.target && t.scheduled) c.addIssue({ code: 'custom', message: 'a scheduled thought takes no target' });
  });
export type ThoughtRuleDef = z.output<typeof ThoughtRuleSchema>;

// ---------------------------------------------------------------------------------------------
// Defenses (10 §7.2, §14.3)
// ---------------------------------------------------------------------------------------------

export const DefenseSchema = z.strictObject({
  id: z.enum(DEFENSE_IDS),
  name: z.string().min(1),
  /** 1855 label (10 §12): "Laying it at another's door". */
  period_label: z.string().min(1),
  description: z.string().default(''),
  tier: z.enum(DEFENSE_TIERS),
  /** Ego strength needed (neurotic 25, mature 55: 10 §7.1). */
  min_ego: pct().default(0),
  /** Anxiety discharged, 0..1000 (taken from the triggering pool first). */
  relief: int().min(0).max(1000),
  /** Pools it answers; a pool with charge here makes the defense a candidate. */
  pools: z.array(z.enum(ANXIETY_POOLS)).min(1),
  /** Shadow charge needed on the projected trait (projection: 30). */
  needs_shadow: pct().default(0),
  /** Interactions social may execute for this defense's act, first that exists wins. */
  acts: z.array(ref()).default([]),
  /** Chronicle notability of its psyche.defense event (≥ 30). */
  importance: int().min(30).max(100).default(30),
  /** Trait it grants once its style reaches 70 (10 §7.1 characterization). */
  acquired_trait: ref().optional(),
  /** Lines for the masked thought it leaves; `{target}` and `{trait}` substituted. */
  lines: z.array(z.string().min(1)).min(1),
});
export type DefenseDef = z.output<typeof DefenseSchema>;

// ---------------------------------------------------------------------------------------------
// Compromise and sublimation templates (10 §5.3)
// ---------------------------------------------------------------------------------------------

const SideSchema = z
  .strictObject({
    drives: z.array(ref()).default([]),
    norms: z.array(ref()).default([]),
    tags: z.array(id()).default([]),
  })
  .default({ drives: [], norms: [], tags: [] });

export const CompromiseSchema = z.strictObject({
  id: id(),
  /** The ego's verdict line: "Eat at the bench, then back to the forge". */
  label: z.string().min(1),
  /** Matches the Id-dominated option: any of its drives, or any of its tags. */
  id_side: SideSchema,
  /** Matches the Superego-dominated option (or the conscience against the Id's option). */
  superego_side: SideSchema,
  /** The resulting urge: one side's option, or a third urge. */
  result: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('side'), side: z.enum(['id', 'superego']) }),
    z.strictObject({ kind: z.literal('activity'), id: ref() }),
    z.strictObject({
      kind: z.literal('interaction'),
      id: ref(),
      target: z.enum(['none', 'id_target']).default('none'),
    }),
  ]),
  /** Satisfaction granted to the frustrated thoughts of each side, percent (10 §6 `f`). */
  id_pct: pct(),
  superego_pct: pct(),
});
export type CompromiseDef = z.output<typeof CompromiseSchema>;

export const SublimationSchema = z.strictObject({
  id: id(),
  drive: ref(),
  urge: UrgeRefSchema,
  when: WhenSchema.default({}),
  /** "Splitting rails till the anger's out of his arms." */
  label: z.string().min(1),
});
export type SublimationDef = z.output<typeof SublimationSchema>;

/**
 * Psyche's reading of activities and interactions: tags that norms forbid and drives seek.
 * Merged with the activity/interaction's own `tags`.
 */
export const UrgeTagSchema = z.strictObject({
  id: id(),
  kind: z.enum(['activity', 'interaction']),
  ref: ref(),
  tags: z.array(id()).min(1),
});
export type UrgeTagDef = z.output<typeof UrgeTagSchema>;

export const psycheDomains = {
  standingCapabilities: defineDomain({
    dir: 'psyche',
    key: 'standing',
    schema: z.strictObject({
      id: id(),
      default: z.boolean(),
      act: id(),
      legacy: id().optional(),
      max_cents: int().min(0).optional(),
      period_minutes: int().min(1).default(10080),
      item_tags: z.array(id()).default([]),
    }),
  }),
  traits: defineDomain({ dir: 'traits', key: 'trait', schema: TraitSchema }),
  drives: defineDomain({ dir: 'psyche', key: 'drive', schema: DriveSchema }),
  norms: defineDomain({ dir: 'psyche', key: 'norm', schema: NormSchema }),
  thoughts: defineDomain({ dir: 'psyche', key: 'thought', schema: ThoughtRuleSchema }),
  defenses: defineDomain({ dir: 'psyche', key: 'defense', schema: DefenseSchema }),
  compromises: defineDomain({ dir: 'psyche', key: 'compromise', schema: CompromiseSchema }),
  sublimations: defineDomain({ dir: 'psyche', key: 'sublimation', schema: SublimationSchema }),
  urge_tags: defineDomain({ dir: 'psyche', key: 'urge_tag', schema: UrgeTagSchema }),
};

/** Per-actor scenario fields owned by psyche. */
export const psycheActorFields = {
  /** Missing means psyche, retaining legacy serialized NPC defaults. */
  agency_mode: z.enum(['psyche', 'commanded']).optional(),
  standing_orders: z
    .strictObject({
      sleep: z.boolean(),
      eat: z.boolean(),
      drink: z.boolean(),
      warmth: z.boolean(),
      lodging: z.boolean(),
      activities: z.array(id()),
    })
    .optional(),
  /** Base psyche numbers before trait shifts. Defaults 50/50/50. */
  psyche: z
    .strictObject({
      ego: int().min(0).max(100).default(50),
      superego: int().min(0).max(100).default(50),
      id_appetite: int().min(0).max(100).default(50),
    })
    .default({ ego: 50, superego: 50, id_appetite: 50 }),
  /** Jungian persona: how the actor presents (free text label for UI, e.g. "the pious widow"). */
  persona: z.string().optional(),
  /** Traits the Persona presents in public (the mask), which may differ from `traits` (10 §8.1). */
  persona_traits: z.array(id()).default([]),
  /** Persona control 0..100 (mask discipline); default 50 + 15 × Discretion. */
  persona_control: pct().optional(),
  /** Jungian shadow: trait ids the actor disowns (they still act, but are projected). Charge 60. */
  shadow: z.array(id()).default([]),
  /**
   * Starting anxiety 0..1000. Without `anxiety_pools` it splits by temperament:
   * real 50 : neur id_appetite : moral superego (after trait shifts).
   */
  anxiety: int().min(0).max(1000).default(0),
  /** Optional split of the starting anxiety by pool (must sum to `anxiety` when given). */
  anxiety_pools: z
    .strictObject({ real: int().min(0).max(1000), neur: int().min(0).max(1000), moral: int().min(0).max(1000) })
    .optional(),
  /** Drive weight overrides, 0..100 (before trait shifts). */
  drives: z.record(id(), pct()).default({}),
  /** Norm strength overrides, 0..100 (before trait shifts). */
  norms: z.record(id(), pct()).default({}),
  /** Defense style overrides, 0..100 (10 §7.1; default 10 × trait pct / 100). */
  defense_style: z.partialRecord(z.enum(DEFENSE_IDS), pct()).default({}),
  /** Insight tier 0..3 (10 §8.5): reveals the actor's own defenses up to this maturity tier. */
  insight: int().min(0).max(3).default(0),
};

export function psycheRefs(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  const urgeTable = (k: 'activity' | 'interaction') => (k === 'activity' ? b.activities : b.interactions);
  const checkWhen = (where: string, w: WhenDef | undefined) => {
    if (!w) return;
    if (w.need_below) checkRefs(issues, where, 'when.need_below', [w.need_below.need], b.needs, 'need');
    checkRefs(issues, where, 'when.drive_min', Object.keys(w.drive_min ?? {}), b.drives, 'drive');
    checkRefs(issues, where, 'when.norm_min', Object.keys(w.norm_min ?? {}), b.norms, 'norm');
    checkRefs(issues, where, 'when.norm_max', Object.keys(w.norm_max ?? {}), b.norms, 'norm');
    checkRefs(issues, where, 'when.traits_any', w.traits_any ?? [], b.traits, 'trait');
  };
  for (const t of Object.values(b.traits)) {
    const where = `traits:${t.id}`;
    checkRefs(issues, where, 'excludes', t.excludes, b.traits, 'trait');
    for (const u of t.urge_bias) checkRefs(issues, where, 'urge_bias', [u.id], urgeTable(u.kind), u.kind);
    checkRefs(issues, where, 'drives', Object.keys(t.drives), b.drives, 'drive');
    checkRefs(issues, where, 'norms', Object.keys(t.norms), b.norms, 'norm');
  }
  for (const d of Object.values(b.drives)) {
    const where = `drives:${d.id}`;
    checkRefs(issues, where, 'shadow_traits', d.shadow_traits, b.traits, 'trait');
    checkRefs(
      issues,
      where,
      'needs',
      d.needs.map((n) => n.need),
      b.needs,
      'need',
    );
  }
  for (const n of Object.values(b.norms)) {
    n.forbids.forEach((f, i) => {
      checkWhen(`norms:${n.id}/forbids[${i}]`, f.when);
    });
  }
  for (const t of Object.values(b.thoughts)) {
    const where = `thoughts:${t.id}`;
    checkRefs(issues, where, 'drive', [t.drive], b.drives, 'drive');
    checkRefs(issues, where, 'norm', [t.norm], b.norms, 'norm');
    if (t.urge) checkRefs(issues, where, 'urge', [t.urge.id], urgeTable(t.urge.kind), t.urge.kind);
    checkWhen(where, t.when);
  }
  for (const d of Object.values(b.defenses)) {
    const where = `defenses:${d.id}`;
    checkRefs(issues, where, 'acts', d.acts, b.interactions, 'interaction');
    checkRefs(issues, where, 'acquired_trait', [d.acquired_trait], b.traits, 'trait');
  }
  for (const c of Object.values(b.compromises)) {
    const where = `compromises:${c.id}`;
    checkRefs(issues, where, 'id_side.drives', c.id_side.drives, b.drives, 'drive');
    checkRefs(issues, where, 'superego_side.norms', c.superego_side.norms, b.norms, 'norm');
    if (c.result.kind !== 'side') {
      checkRefs(issues, where, 'result', [c.result.id], urgeTable(c.result.kind), c.result.kind);
    }
  }
  for (const s of Object.values(b.sublimations)) {
    const where = `sublimations:${s.id}`;
    checkRefs(issues, where, 'drive', [s.drive], b.drives, 'drive');
    checkRefs(issues, where, 'urge', [s.urge.id], urgeTable(s.urge.kind), s.urge.kind);
    checkWhen(where, s.when);
  }
  for (const u of Object.values(b.urge_tags)) {
    checkRefs(issues, `urge_tags:${u.id}`, 'ref', [u.ref], urgeTable(u.kind), u.kind);
  }
  for (const s of Object.values(b.scenarios)) {
    for (const a of s.actors) {
      const where = `scenarios:${s.id}/actors:${a.key}`;
      checkRefs(issues, where, 'shadow', a.shadow, b.traits, 'trait');
      checkRefs(issues, where, 'persona_traits', a.persona_traits, b.traits, 'trait');
      checkRefs(issues, where, 'drives', Object.keys(a.drives), b.drives, 'drive');
      checkRefs(issues, where, 'norms', Object.keys(a.norms), b.norms, 'norm');
      if (a.anxiety_pools) {
        const sum = a.anxiety_pools.real + a.anxiety_pools.neur + a.anxiety_pools.moral;
        if (sum !== a.anxiety) {
          issues.push({ where, path: 'anxiety_pools', message: `pools sum to ${sum}, anxiety is ${a.anxiety}` });
        }
      }
    }
  }
  return issues;
}
