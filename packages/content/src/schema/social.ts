/**
 * Social interactions catalog (04 §10) and social scenario seeds (relationships, opinions).
 * OWNER: module:social (see docs/impl/MODULES.md).
 */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import { checkRefs, defineDomain, type Issue, id, int, nonNegInt, ref } from './common.ts';

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
] as const;

export const EMOTIONS = ['anger', 'fear', 'shame', 'grief', 'gratitude', 'joy', 'disgust', 'awe', 'none'] as const;

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
  })
  .default({
    target_opinion: { affection: 0, respect: 0, trust: 0, fear: 0 },
    initiator_opinion: { affection: 0, respect: 0, trust: 0, fear: 0 },
    initiator_needs: {},
    target_needs: {},
  });

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
    })
    .default({ acquainted: false, rumor_available: false, not_kin: false, venue_tags: [] }),
  /**
   * Volition terms (04 §10, Comme il Faut): named drivers with integer weights. Driver names
   * are interpreted by the social module, e.g. 'need:company', 'value:temper',
   * 'opinion:affection', 'trait:gossip', 'grudge', 'drunk'.
   */
  volition: z.array(z.strictObject({ driver: z.string().min(1), weight: int() })).default([]),
  /** Minimum volition score to be chosen. */
  threshold: int().default(0),
  check: z
    .discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('none') }),
      z.strictObject({ kind: z.literal('dc'), skill: ref(), dc: nonNegInt() }),
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
  transmits_rumor: z.boolean().default(false),
  /** Flag for chronicle/director: big events (04 §11.2). */
  notable: z.boolean().default(false),
  /** Game-minutes the interaction takes. */
  minutes: int().min(1).max(240).default(10),
  tags: z.array(id()).default([]),
});
export type InteractionDef = z.output<typeof InteractionSchema>;

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

export const socialDomains = {
  interactions: defineDomain({ dir: 'interactions', key: 'interaction', schema: InteractionSchema }),
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
};

export function socialRefs(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  for (const i of Object.values(b.interactions)) {
    const where = `interactions:${i.id}`;
    if (i.check.kind !== 'none') checkRefs(issues, where, 'check.skill', [i.check.skill], b.skills, 'skill');
    for (const eff of [i.success, i.failure]) {
      checkRefs(issues, where, 'escalates_to', [eff.escalates_to], b.interactions, 'interaction');
      checkRefs(issues, where, 'initiator_needs', Object.keys(eff.initiator_needs), b.needs, 'need');
      checkRefs(issues, where, 'target_needs', Object.keys(eff.target_needs), b.needs, 'need');
    }
  }
  return issues;
}
