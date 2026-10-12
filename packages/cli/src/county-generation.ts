import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CountyRecipe, GeneratedCounty } from '@coulee/worldgen';
import { generateCountyStages, renderCountySvg } from '@coulee/worldgen';
export function generateTimedCounty(recipe: CountyRecipe) {
  const stages = generateCountyStages(recipe),
    layers: Record<string, number> = {};
  const start = performance.now();
  let mark = start,
    next = stages.next();
  while (!next.done) {
    const now = performance.now();
    layers[next.value] = Math.round(now - mark);
    mark = now;
    next = stages.next();
  }
  layers.hashingAndQa = Math.round(performance.now() - mark);
  const desktopMs = Math.round(performance.now() - start);
  return { county: next.value, timing: { desktopMs, estimatedPhoneMs: desktopMs * 4, layers, preRollIncluded: false } };
}
export function writeGeneratedCounty(
  dir: string,
  c: GeneratedCounty,
  timing?: ReturnType<typeof generateTimedCounty>['timing'],
): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'county.json'), `${JSON.stringify(c)}\n`);
  writeFileSync(join(dir, 'map.svg'), renderCountySvg(c));
  if (timing) writeFileSync(join(dir, 'timing.json'), `${JSON.stringify(timing, null, 2)}\n`);
  writeFileSync(
    join(dir, 'report.md'),
    [
      `# County ${c.recipe.seed} (${c.recipe.preset})`,
      '',
      `Hash: ${c.report.hash}`,
      '',
      JSON.stringify(c.report.stats),
      '',
      ...c.report.qa.map((q) => `- ${q.pass ? 'PASS' : 'FAIL'} ${q.check}: ${q.detail}`),
      '',
      ...c.report.deferred,
      '',
      timing
        ? `Desktop ${timing.desktopMs} ms; phone estimate ×4 ${timing.estimatedPhoneMs} ms. Excludes town QA and history pre-roll.`
        : 'Unmeasured pure generation.',
    ].join('\n'),
  );
}
