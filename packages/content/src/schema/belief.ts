/**
 * Belief content: proposition predicates (04 §5.1), and belief scenario seeds (beliefs,
 * secrets, figures, grudges).
 * OWNER: module:belief (see docs/impl/MODULES.md).
 */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import { defineDomain, type Issue, id, int } from './common.ts';

export const ARG_KINDS = ['actor', 'household', 'figure', 'place', 'item', 'text', 'number'] as const;

export const PredicateSchema = z.strictObject({
  id: id(),
  /** Argument kinds, in order. */
  args: z.array(z.enum(ARG_KINDS)).min(1).max(4),
  /** Rendering template with positional slots: "{0} is a witch". */
  text: z.string().min(1),
  description: z.string().default(''),
  /** Base juiciness 0..100 as gossip (04 §8.1). */
  juiciness: int().min(0).max(100).default(20),
  /** How the subject ({0}) is valued if believed: −100 damning .. +100 praising. */
  valence: int().min(-100).max(100).default(0),
  /** Witchcraft/fae props get the Superstition multiplier (04 §5.3). */
  supernatural: z.boolean().default(false),
  tags: z.array(id()).default([]),
});
export type PredicateDef = z.output<typeof PredicateSchema>;

export const beliefDomains = {
  predicates: defineDomain({ dir: 'beliefs', key: 'predicate', schema: PredicateSchema }),
};

/** Proposition seed: predicate + args. Actor args are scenario actor keys; figure args are figure keys. */
export const PropSeedSchema = z.strictObject({
  pred: id(),
  args: z
    .array(z.union([z.string(), z.number().int()]))
    .min(1)
    .max(4),
});

export const GRUDGE_AIMS = ['restitution', 'apology', 'humiliation', 'expulsion', 'harm', 'death'] as const;

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
};

export function beliefRefs(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  for (const s of Object.values(b.scenarios)) {
    const props = [...s.beliefs.map((x) => x.prop), ...s.secrets.map((x) => x.prop)];
    for (const p of props) {
      const pred = b.predicates[p.pred];
      if (!pred) {
        issues.push({ where: `scenarios:${s.id}`, message: `unknown predicate '${p.pred}'` });
      } else if (pred.args.length !== p.args.length) {
        issues.push({
          where: `scenarios:${s.id}`,
          message: `predicate '${p.pred}' takes ${pred.args.length} args, got ${p.args.length}`,
        });
      }
    }
  }
  return issues;
}
