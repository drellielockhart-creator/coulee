/** Host-only timing and editable TOML export. No generation decisions live here. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentBundle } from '@coulee/content/schema';
import { type GeneratedTown, generateTownStages, type TownRecipe } from '@coulee/worldgen';

export function generateTimedTown(content: ContentBundle, recipe: TownRecipe): GeneratedTown {
  const stages = generateTownStages(content, recipe);
  const times = new Map<string, number>();
  let start = performance.now();
  let next = stages.next();
  while (!next.done) {
    times.set(next.value, Math.round(performance.now() - start));
    start = performance.now();
    next = stages.next();
  }
  for (const layer of next.value.report.layers) layer.elapsedMs = times.get(layer.layer) ?? null;
  return next.value;
}

// The scenario format needs only strings, integers, booleans, arrays and inline tables.
// Quoted keys preserve arbitrary content IDs. JSON escaping is also valid for these TOML strings.
function tomlValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(tomlValue).join(', ')}]`;
  if (value !== null && typeof value === 'object')
    return `{ ${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${JSON.stringify(k)} = ${tomlValue(v)}`)
      .join(', ')} }`;
  if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isInteger(value)))
    return JSON.stringify(value);
  throw new Error(`Unsupported TOML value: ${String(value)}`);
}
const fields = (value: object) =>
  Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .map(
      ([k, v]) =>
        `${JSON.stringify(k)} = ${Array.isArray(v) && v.length > 1 && typeof v[0] === 'object' ? `[\n${v.map((x) => `  ${tomlValue(x)},`).join('\n')}\n]` : tomlValue(v)}`,
    )
    .join('\n');
const tables = (key: string, values: readonly object[]) => values.map((v) => `[[${key}]]\n${fields(v)}\n`).join('\n');

export function renderGenReport(town: GeneratedTown): string {
  const r = town.report;
  return [
    `# ${town.scenario.name} — world seed ${r.recipe.seed}`,
    '',
    `Recipe: \`${JSON.stringify(r.recipe)}\``,
    '',
    ...r.decisions.map((d) => `- ${d}`),
    '',
    '## Layers',
    '',
    '| Layer | Milliseconds |',
    '| --- | ---: |',
    ...r.layers.map((l) => `| ${l.layer} | ${l.elapsedMs ?? 'unmeasured (pure API)'} |`),
    '',
    '## QA',
    '',
    ...r.qa.map((q) => `- ${q.pass ? 'PASS' : 'FAIL'} **${q.check}**: ${q.detail}`),
    '',
    ...(r.playtest
      ? [
          `30-day QA hash: \`${r.playtest.hash}\`. Shortage events: ${r.playtest.shortages}. Individual hardship is reported, not rejected.`,
          '',
        ]
      : []),
    '## Pin and edit',
    '',
    'This directory is a content mod: places/*.toml and scenarios/<id>/*.toml. Load it after base, or copy those files into an authored content mod. No generator-specific schema is needed.',
    '',
    'The current renderer infers elevation and stream shape from footprints and tags. Contact geology is place description/tag data, not a simulated heightfield. No history pre-roll in this slice.',
    '',
  ].join('\n');
}

export function writeGeneratedTown(dir: string, town: GeneratedTown): void {
  const { scenario: s, site, places } = town;
  const scenarios = join(dir, 'scenarios', s.id);
  mkdirSync(scenarios, { recursive: true });
  mkdirSync(join(dir, 'places'), { recursive: true });
  const {
    households,
    actors,
    relationships,
    opinions,
    memories,
    figures,
    beliefs,
    secrets,
    grudges,
    misfortunes,
    stocks,
    ...header
  } = s;
  const files: Record<string, string> = {
    '00-scenario.toml': fields(header),
    '10-households.toml': tables('households', households),
    '20-actors.toml': tables('actors', actors),
    '30-social.toml':
      tables('relationships', relationships) + tables('opinions', opinions) + tables('memories', memories),
    '40-belief.toml':
      tables('figures', figures) +
      tables('beliefs', beliefs) +
      tables('secrets', secrets) +
      tables('grudges', grudges) +
      tables('misfortunes', misfortunes),
    '50-stocks.toml': tables('stocks', stocks),
  };
  for (const [name, body] of Object.entries(files)) writeFileSync(join(scenarios, name), `${body}\n`);
  writeFileSync(join(dir, 'places', `${site.id}.toml`), tables('site', [site]) + tables('place', places));
  writeFileSync(join(dir, 'report.md'), renderGenReport(town));
  writeFileSync(join(dir, 'recipe.json'), `${JSON.stringify(town.report.recipe, null, 2)}\n`);
}
