/** node --import tsx .../region-dormant-calibration.ts output [T1|T2]
 * T2 forces the existing daily kernel over the generated town, without LOD admission
 * or Chronicle. This is an owner-rate calibration, not county release coverage. */
import { writeFileSync } from 'node:fs';
import { asGameMinute, createSim, makeContext, region, runHours, stateHash } from '@coulee/core';
import { GEN_VERSION, generateTown, townContent } from '@coulee/worldgen';
import { baseContent } from '../helpers.ts';
import { required } from './region-fixture.ts';

const base = baseContent(),
  results = [];
const output = process.argv[2] ?? 'runs/scratch/t3-calibration.json';
const daily = process.argv[3] === 'T2';
if (!daily) {
  const sim = createSim(base, { scenarioId: 'iron_ford', seed: 42 });
  runHours(sim, 240);
  results.push({ legacy: 'iron_ford', hash: stateHash(sim.world) });
}
for (const seed of [7, 42, 131]) {
  const town = generateTown(base, { genVersion: GEN_VERSION, seed });
  const content = townContent(base, town);
  const sim = createSim(content, { scenarioId: town.scenario.id, seed });
  const w = sim.world;
  if (daily)
    w.region = {
      version: 1,
      worldSeed: seed,
      definition: { ...required(base.regions.iron_ford_neighbors), nodes: [], edges: [] },
      sites: {},
      transit: {},
      knownNodes: {},
      processing: { version: 1, householdEconomy: {}, sites: { [town.scenario.site]: { since: 0, through: 0 } } },
    };
  const snap = () => ({
    day: w.time / 1440,
    population: Object.values(w.actors).filter((a) => a.alive).length,
    deaths: Object.values(w.actors).filter((a) => !a.alive).length,
    cash: Object.values(w.provisions.households).reduce((n, h) => n + h.cashCents, 0),
    pantry: Object.values(w.items.stacks).reduce((n, s) => {
      const f = content.items[s.defId]?.food;
      return n + (f ? ((s.qty * f.servings - s.partial - (s.foodPartialPm ?? 0) / 1000) * f.kcal) / f.servings : 0);
    }, 0),
    grudges: Object.values(w.belief.grudges).filter((g) => g.intensity > 0).length,
    burn: Object.values(w.provisions.nutrition)
      .flatMap((n) => n.history)
      .filter((d) => d.burnHours === 24)
      .map((d) => d.burnKcal),
    intake: Object.values(w.provisions.nutrition)
      .flatMap((n) => n.history)
      .map((d) => d.kcal),
  });
  const snapshots = [snap()];
  let hash = '';
  for (let day = 1; day <= 365; day++) {
    if (daily) {
      w.time = asGameMinute(day * 1440);
      region.settleDailySites(w, makeContext(w, content, []));
    } else runHours(sim, 24);
    if (day === 3) hash = stateHash(w);
    if (day % 30 === 0 || day === 365) {
      snapshots.push(snap());
      console.log(daily ? 'T2' : 'T1', seed, day);
    }
  }
  results.push({ seed, hash, snapshots });
  writeFileSync(output, JSON.stringify(results, null, 2));
}
