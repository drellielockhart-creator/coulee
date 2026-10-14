/** Whole generated towns, forced isolated owners as in the year calibration.
 * node --import tsx .../region-dormant-town-fidelity.ts output
 * No LOD admission/Chronicle/occupied-site work: this is a livelihood fidelity control. */
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { asGameMinute, createSim, findNonIntegers, makeContext, region } from '@coulee/core';
import { GEN_VERSION, generateTown, townContent } from '@coulee/worldgen';
import { baseContent } from '../helpers.ts';
import { dormantFidelityGate } from './region-dormant-bands.ts';
import { required } from './region-fixture.ts';

const base = baseContent(),
  results = [];
const output = process.argv[2] ?? 'runs/scratch/t3-town-fidelity.json';
for (const seed of [7, 42, 131]) {
  const town = generateTown(base, { genVersion: GEN_VERSION, seed });
  const content = townContent(base, town);
  const pair = [];
  for (const dormant of [false, true]) {
    const sim = createSim(content, { scenarioId: town.scenario.id, seed });
    const w = sim.world,
      site = town.scenario.site;
    w.region = {
      version: 1,
      worldSeed: seed,
      definition: { ...required(base.regions.iron_ford_neighbors), nodes: [], edges: [] },
      sites: {},
      transit: {},
      knownNodes: {},
      processing: { version: 1, householdEconomy: {}, sites: { [site]: { since: 0, through: 0 } } },
      lod: {
        version: 1,
        focusActorId: null,
        relevance: {},
        evaluatedAt: 0,
        actors: Object.fromEntries(
          Object.values(w.actors).map((a) => [
            a.id,
            {
              selected: 'T2' as const,
              processing: 'T2' as const,
              belowSince: 0,
              distanceMinutes: 1800,
              relevance: 0,
              pinned: false,
              reasons: ['isolated owner fidelity control'],
            },
          ]),
        ),
      },
    };
    const snap = () => ({
      population: Object.values(w.actors).filter((a) => a.alive).length,
      deaths: Object.values(w.actors).filter((a) => !a.alive).length,
      cash: Object.values(w.provisions.households).reduce((n, h) => n + h.cashCents, 0),
      pantry: Object.values(w.items.stacks).reduce((n, s) => {
        const f = content.items[s.defId]?.food;
        return n + (f ? ((s.qty * f.servings - s.partial - (s.foodPartialPm ?? 0) / 1000) * f.kcal) / f.servings : 0);
      }, 0),
      grudges: Object.values(w.belief.grudges).filter((g) => g.intensity > 0).length,
    });
    const initial = snap();
    if (dormant) {
      region.configureDormancy(w, { dwellMinutes: 0 });
      region.updateDormantOwners(w, makeContext(w, content, []), new Set([site]));
      if (!w.region.dormant?.sites[site]) throw new Error('Dormant owner not installed');
    }
    const start = performance.now();
    for (let day = 1; day <= 60; day++) {
      w.time = asGameMinute(day * 1440);
      const ctx = makeContext(w, content, []);
      if (dormant) {
        if (ctx.cal.day === 1) region.settleDormantSites(w, ctx);
      } else region.settleDailySites(w, ctx);
    }
    if (dormant) region.wakeDormantSite(w, makeContext(w, content, []), site);
    const result = {
      dormant,
      initial,
      final: snap(),
      msHour: (performance.now() - start) / 1440,
      integerErrors: findNonIntegers(w).length,
    };
    pair.push(result);
    console.log(seed, result);
  }
  const t2 = required(pair[0]),
    t3 = required(pair[1]);
  const gate = dormantFidelityGate(t2.initial, t2.final, t3.final);
  results.push({ seed, pair, gate });
  console.log('gate', seed, gate);
  if (!gate.pass) process.exitCode = 1;
  writeFileSync(output, JSON.stringify(results, null, 2));
}
