import { type ContentBundle, ScenarioSchema } from '@coulee/content/schema';
import { settlement, terrain } from './layout.ts';
import { populate } from './population.ts';
import { checkTown, playtestTown, townContent } from './qa.ts';
import { seedTensions } from './tensions.ts';
import { GEN_VERSION, type GeneratedTown, type TownRecipe } from './types.ts';

export { checkTown, townContent } from './qa.ts';
export * from './types.ts';

/** Stage boundaries permit host timing without injecting a clock or IO into generation. */
export function* generateTownStages(content: ContentBundle, recipe: TownRecipe): Generator<string, GeneratedTown> {
  if (recipe.genVersion !== GEN_VERSION)
    throw new Error(`Unsupported genVersion ${recipe.genVersion}; expected ${GEN_VERSION}`);
  if (!Number.isSafeInteger(recipe.seed) || recipe.seed < 0 || recipe.seed > 0xffffffff)
    throw new Error('World seed must be a uint32 integer');
  if (recipe.preset !== undefined && !['coulee', 'river'].includes(recipe.preset))
    throw new Error(`Unknown town preset ${recipe.preset}`);
  const farms = recipe.constraints?.farmsteads;
  if (farms !== undefined && (!Number.isInteger(farms) || farms < 3 || farms > 5))
    throw new Error('farmsteads constraint must be 3..5');
  if (recipe.constraints?.townName !== undefined && !recipe.constraints.townName.trim())
    throw new Error('townName must not be empty');
  const t = terrain(recipe);
  yield 'terrain';
  const homes = settlement(recipe, t);
  yield 'settlement';
  const scenario = ScenarioSchema.parse({
    id: t.site.id,
    site: t.site.id,
    name: t.site.name,
    description: t.site.description,
  });
  populate(content, recipe, scenario, homes);
  yield 'population';
  const decisions = seedTensions(content, recipe, scenario);
  yield 'tensions';
  const town: GeneratedTown = {
    scenario: ScenarioSchema.parse(scenario),
    site: t.site,
    places: t.places,
    report: {
      recipe: { ...recipe, constraints: recipe.constraints ? { ...recipe.constraints } : undefined },
      layers: ['terrain', 'settlement', 'population', 'tensions', 'qa'].map((layer) => ({ layer, elapsedMs: null })),
      decisions: [
        `Creek x=${t.creek}; ford y=${t.ford}; ${t.onRiver ? 'river landing' : 'inland coulee'}.`,
        `${scenario.actors.length} people in ${scenario.households.length} households; ${Object.keys(homes).filter((k) => k.startsWith('farm')).length} farmsteads.`,
        ...decisions,
      ],
      qa: [],
      playtest: null,
    },
  };
  town.report.qa = checkTown(content, town);
  if (town.report.qa.every((q) => q.pass)) playtestTown(townContent(content, town), town);
  yield 'qa';
  const failures = town.report.qa.filter((q) => !q.pass);
  if (failures.length)
    throw new Error(`Town seed ${recipe.seed} failed QA: ${failures.map((q) => `${q.check}: ${q.detail}`).join('\n')}`);
  return town;
}
export function generateTown(content: ContentBundle, recipe: TownRecipe): GeneratedTown {
  const stages = generateTownStages(content, recipe);
  let next = stages.next();
  while (!next.done) next = stages.next();
  return next.value;
}
