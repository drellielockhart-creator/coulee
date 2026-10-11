/**
 * Traits (with psyche weights) and psyche scenario seeds.
 * OWNER: module:psyche (see docs/impl/MODULES.md).
 *
 * Psyche-lite per ADR 0001: egoStrength, superegoStrictness, idAppetite are 0..100.
 * Traits are discrete tags (04 §3.2) that shift those numbers, the 04 §3.1 Values, voice
 * loudness, urge biases and preferred defenses.
 */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import { checkRefs, defineDomain, type Issue, id, int, ratePct, valuesBlock } from './common.ts';

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
  /** Defense preference weights (percent, 100 = neutral). */
  defenses: z.partialRecord(z.enum(DEFENSE_IDS), ratePct()).default({}),
  /** Traits that cannot co-occur. */
  excludes: z.array(id()).default([]),
  tags: z.array(id()).default([]),
});
export type TraitDef = z.output<typeof TraitSchema>;

export const psycheDomains = {
  traits: defineDomain({ dir: 'traits', key: 'trait', schema: TraitSchema }),
};

/** Per-actor scenario fields owned by psyche. */
export const psycheActorFields = {
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
  /** Jungian shadow: trait ids the actor disowns (they still act, but are projected). */
  shadow: z.array(id()).default([]),
  /** Starting anxiety 0..1000. */
  anxiety: int().min(0).max(1000).default(0),
};

export function psycheRefs(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  for (const t of Object.values(b.traits)) {
    checkRefs(issues, `traits:${t.id}`, 'excludes', t.excludes, b.traits, 'trait');
    for (const u of t.urge_bias) {
      const table = u.kind === 'activity' ? b.activities : b.interactions;
      checkRefs(issues, `traits:${t.id}`, 'urge_bias', [u.id], table, u.kind);
    }
  }
  for (const s of Object.values(b.scenarios)) {
    for (const a of s.actors) {
      checkRefs(issues, `scenarios:${s.id}/actors:${a.key}`, 'shadow', a.shadow, b.traits, 'trait');
    }
  }
  return issues;
}
