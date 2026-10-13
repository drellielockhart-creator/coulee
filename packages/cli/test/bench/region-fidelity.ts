/** Manual gate: node --import tsx packages/cli/test/bench/region-fidelity.ts [output] [seeds] */
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import {
  createSim,
  findNonIntegers,
  items,
  makeContext,
  region,
  restoreSim,
  social,
  stateHash,
  step,
} from '@coulee/core';
import { actorByKey, baseContent } from '../helpers.ts';
import { required } from './region-fixture.ts';

const content = baseContent();
const output = process.argv[2] ?? 'runs/scratch/region-fidelity.json';
const count = Number(process.argv[3] ?? 50);
const results = [];
for (let seed = 1; seed <= count; seed++) {
  const pair = [];
  for (const coarse of [false, true]) {
    let sim = createSim(content, { scenarioId: 'iron_ford_neighbors', seed, withPlayer: true });
    const w = sim.world;
    if (!w.region) throw new Error('No region');
    w.region.definition = structuredClone(w.region.definition);
    for (const edge of w.region.definition.edges) edge.cost_minutes = { ab: 600, ba: 700 };
    if (!coarse) for (const a of Object.values(w.actors)) region.setRegionRelevance(w, a.id, 0, true, 'control');
    region.regionSystem(w, makeContext(w, content, []));
    const ids = ['cedar_farm_martha', 'cedar_farm_jonas'].map((key) => actorByKey(sim, key));
    const household = required(w.actors[required(ids[0])]).householdId;
    const pantry = () =>
      items.stacksDeep(sim.world, items.pantryOf(household)).reduce((sum, { stack }) => {
        const food = content.items[stack.defId]?.food;
        return (
          sum +
          (food
            ? ((stack.qty * food.servings - stack.partial - (stack.foodPartialPm ?? 0) / 1000) * food.kcal) /
              food.servings
            : 0)
        );
      }, 0);
    const initial = pantry();
    // Whole-unit stock diagnostic alongside actual remaining kcal (including fractional servings).
    const wholePantry = () =>
      items
        .stacksDeep(sim.world, items.pantryOf(household))
        .reduce((sum, { stack }) => sum + stack.qty * (content.items[stack.defId]?.food?.kcal ?? 0), 0);
    const initialWhole = wholePantry();
    let interactions = 0;
    const sink: NonNullable<typeof sim.sink> = (event) => {
      if (event.kind === 'social.interaction' && event.roles.some((r) => ids.includes(r.actor))) interactions++;
    };
    sim.sink = sink;
    const start = performance.now();
    for (let hour = 0; hour < 336; hour++) step(sim);
    const msHour = (performance.now() - start) / 336;
    if (seed === 1 && coarse) {
      const restored = restoreSim(content, JSON.parse(JSON.stringify(sim.world)));
      if (stateHash(restored.world) !== stateHash(sim.world)) throw new Error('Restore differs');
      sim = restored;
    }
    if (findNonIntegers(sim.world).length) throw new Error('Noninteger state');
    pair.push({
      coarse,
      msHour,
      daily: region.processingBuckets(sim.world).daily.actors.length,
      hunger: ids.map((id) => required(required(sim.world.needs.byActor[id]).values.hunger)),
      rest: ids.map((id) => required(required(sim.world.needs.byActor[id]).values.rest)),
      warmth: ids.map((id) => required(required(sim.world.needs.byActor[id]).values.warmth)),
      thirst: ids.map((id) => required(required(sim.world.needs.byActor[id]).values.thirst)),
      affection: ids.map((id, i) => social.opinionOf(sim.world, id, required(ids[1 - i])).affection),
      interactions: [interactions],
      cash: [required(sim.world.provisions.households[household]).cashCents],
      depletion: [((initial - pantry()) * 100) / initial],
      wholeDepletion: [((initialWhole - wholePantry()) * 100) / initialWhole],
    });
  }
  results.push({ seed, pair });
  writeFileSync(output, JSON.stringify(results, null, 2));
  console.log(
    seed,
    pair.map((p) => ({ rest: p.rest, thirst: p.thirst, depletion: p.depletion, msHour: p.msHour })),
  );
}
