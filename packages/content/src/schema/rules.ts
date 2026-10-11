/**
 * Core rules content: skills (02 §4.1). FOUNDATION-OWNED.
 */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import { abilityId, defineDomain, type Issue, id } from './common.ts';

export const SkillSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  /** Key ability. Skills like Riverwork that use "STR or WIS" list the default here. */
  ability: abilityId(),
  /** Alternate ability the actor may use instead when better (02 §4.1 footnotes). */
  alt_ability: abilityId().optional(),
  /** (T) trained only: unusable at 0 ranks except at DC <= 10. */
  trained_only: z.boolean().default(false),
  /** Family for Trade (X) / Lore (X) / Perform (X) skills, e.g. 'trade'. */
  family: z.enum(['trade', 'lore', 'perform']).optional(),
  description: z.string().default(''),
});
export type SkillDef = z.output<typeof SkillSchema>;

export const rulesDomains = {
  skills: defineDomain({ dir: 'skills', key: 'skill', schema: SkillSchema }),
};

export function rulesRefs(_b: ContentBundle): Issue[] {
  return [];
}
