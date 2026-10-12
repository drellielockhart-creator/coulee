/**
 * Scenarios: the starting situation of a run (households, actors, relationships, pantries,
 * seeded tensions). OWNER: module:content-world.
 *
 * COMPOSITION: per-module fields are imported from the owning module's schema file, so a
 * module can extend what a scenario may seed without editing this file:
 *   - actor fields:     psycheActorFields, needsActivitiesActorFields, provisionsActorFields
 *   - household fields: provisionsHouseholdFields
 *   - top-level fields: socialScenarioFields, beliefScenarioFields, provisionsScenarioFields
 *
 * A scenario is a 'document' domain: content/base/scenarios/<id>.toml, or a directory
 * content/base/scenarios/<id>/ whose files are merged (arrays concatenated).
 * Actor/household references inside a scenario use the scenario-local `key`.
 */
import { z } from 'zod';
import { beliefScenarioFields } from './belief.ts';
import type { ContentBundle } from './bundle.ts';
import { abilities, checkRefs, defineDomain, type Issue, id, int, ref, valuesBlock } from './common.ts';
import { faeScenarioFields } from './fae.ts';
import { provisionsActorFields, provisionsHouseholdFields, provisionsScenarioFields } from './items.ts';
import { needsActivitiesActorFields } from './needs-activities.ts';
import { psycheActorFields } from './psyche.ts';
import { socialScenarioFields } from './social.ts';

export const ScenarioHouseholdSchema = z.strictObject({
  key: id(),
  name: z.string().min(1),
  /** Place id of the household's home. */
  home: ref(),
  /** Actor key of the head of household. */
  head: z.string().min(1),
  note: z.string().optional(),
  ...provisionsHouseholdFields,
});
export type ScenarioHousehold = z.output<typeof ScenarioHouseholdSchema>;

export const ScenarioActorSchema = z.strictObject({
  key: id(),
  given: z.string().min(1),
  family: z.string().default(''),
  nickname: z.string().optional(),
  sex: z.enum(['female', 'male']),
  age: int().min(0).max(130),
  /** True people id (ground truth). */
  ancestry: ref(),
  /** People the actor publicly presents as; defaults to ancestry, or passes_as[0] if concealed. */
  presents_as: ref().optional(),
  occupation: ref(),
  household: id(),
  /** Starting place; defaults to the household home. */
  place: ref().optional(),
  abilities: abilities(),
  /** Skill id -> ranks. */
  skills: z.record(id(), int().min(0).max(23)).default({}),
  traits: z.array(id()).default([]),
  values: valuesBlock(),
  languages: z.array(id()).default([]),
  literate: z.boolean().default(true),
  /** Culture id (content/base/cultures): language, literacy, foodways, naming. */
  culture: ref().optional(),
  /** Display house-name for elves ("of Sølvklokke Hall", 12 §5.4). */
  house_name: z.string().optional(),
  /** Private name (elven sealed name, goblin deep-name, faekin dusk-name): fills `true_name` (01 §4.5). */
  true_name: z.string().optional(),
  /** Designer notes (from 01 §8.3): never read by the sim. */
  notes: z.string().optional(),
  ...psycheActorFields,
  ...needsActivitiesActorFields,
  ...provisionsActorFields,
});
export type ScenarioActor = z.output<typeof ScenarioActorSchema>;

export const ScenarioSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  description: z.string().default(''),
  site: ref(),
  /** Start date 'YYYY-MM-DD' (the epoch is 1855-04-01; later starts fast-forward the clock). */
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default('1855-04-01'),
  /** Actor key the player controls by default (web); the CLI runs everyone as AI. */
  player: z.string().optional(),
  /** Designer-facing list of seeded tensions (01 §8.3), referenced by chronicle/director. */
  tensions: z
    .array(
      z.strictObject({
        key: id(),
        summary: z.string().min(1),
        actors: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  households: z.array(ScenarioHouseholdSchema).default([]),
  actors: z.array(ScenarioActorSchema).default([]),
  ...socialScenarioFields,
  ...beliefScenarioFields,
  ...provisionsScenarioFields,
  ...faeScenarioFields,
});
export type ScenarioDef = z.output<typeof ScenarioSchema>;

export const scenarioDomains = {
  scenarios: defineDomain({ dir: 'scenarios', key: 'scenario', mode: 'document', schema: ScenarioSchema }),
};

export function scenarioRefs(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  for (const s of Object.values(b.scenarios)) {
    const where = `scenarios:${s.id}`;
    checkRefs(issues, where, 'site', [s.site], b.sites, 'site');
    const actorKeys: Record<string, true> = {};
    const householdKeys: Record<string, true> = {};
    const figureKeys: Record<string, true> = {};
    for (const a of s.actors) {
      if (actorKeys[a.key]) issues.push({ where, message: `duplicate actor key '${a.key}'` });
      actorKeys[a.key] = true;
    }
    for (const h of s.households) {
      if (householdKeys[h.key]) issues.push({ where, message: `duplicate household key '${h.key}'` });
      householdKeys[h.key] = true;
      checkRefs(issues, `${where}/households:${h.key}`, 'home', [h.home], b.places, 'place');
      checkRefs(issues, `${where}/households:${h.key}`, 'head', [h.head], actorKeys, 'actor key');
    }
    for (const f of s.figures) figureKeys[f.key] = true;
    for (const a of s.actors) {
      const w = `${where}/actors:${a.key}`;
      checkRefs(issues, w, 'ancestry', [a.ancestry, a.presents_as], b.peoples, 'people');
      checkRefs(issues, w, 'occupation', [a.occupation], b.occupations, 'occupation');
      checkRefs(issues, w, 'culture', [a.culture], b.cultures, 'culture');
      checkRefs(issues, w, 'household', [a.household], householdKeys, 'household key');
      checkRefs(issues, w, 'place', [a.place], b.places, 'place');
      checkRefs(issues, w, 'skills', Object.keys(a.skills), b.skills, 'skill');
      checkRefs(issues, w, 'traits', a.traits, b.traits, 'trait');
    }
    checkRefs(issues, where, 'player', [s.player], actorKeys, 'actor key');
    for (const t of s.tensions)
      checkRefs(issues, `${where}/tensions:${t.key}`, 'actors', t.actors, actorKeys, 'actor key');
    for (const r of s.relationships)
      checkRefs(issues, `${where}/relationships`, 'a/b', [r.a, r.b], actorKeys, 'actor key');
    for (const o of s.opinions)
      checkRefs(issues, `${where}/opinions`, 'from/to', [o.from, o.to], actorKeys, 'actor key');
    const anyKey = { ...actorKeys, ...householdKeys, ...figureKeys };
    for (const f of s.figures)
      checkRefs(issues, `${where}/figures:${f.key}`, 'truly', [f.truly], actorKeys, 'actor key');
    for (const x of s.beliefs) checkRefs(issues, `${where}/beliefs`, 'holder', [x.holder], actorKeys, 'actor key');
    for (const x of s.secrets) {
      checkRefs(issues, `${where}/secrets`, 'holder', [x.holder], actorKeys, 'actor key');
      checkRefs(issues, `${where}/secrets`, 'known_by', x.known_by, actorKeys, 'actor key');
    }
    for (const g of s.grudges) {
      checkRefs(issues, `${where}/grudges`, 'holder', [g.holder], actorKeys, 'actor key');
      checkRefs(issues, `${where}/grudges`, 'target', [g.target], anyKey, 'actor/household/figure key');
    }
  }
  return issues;
}
