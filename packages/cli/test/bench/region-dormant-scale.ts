/** Fresh process per cap: node --expose-gc --import tsx .../region-dormant-scale.ts output cap [seed] */
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import { asGameMinute, createSim, makeContext, packJson, region, step } from '@coulee/core';
import { baseContent } from '../helpers.ts';
import { countyBenchContent, required } from './region-fixture.ts';

const output = process.argv[2] ?? 'runs/scratch/t3-scale.json';
const cap = Number(process.argv[3] ?? 400),
  seed = Number(process.argv[4] ?? 41);
const content = countyBenchContent(baseContent(), 14, 100);
const sim = createSim(content, { scenarioId: 'iron_ford_county_bench', seed, withPlayer: true });
region.configureDormancy(sim.world, { enterMinutes: 600, exitMinutes: 480, dwellMinutes: 0, hourlySoftCap: cap });
for (let h = 0; h < 48; h++) {
  step(sim);
  if (h % 12 === 11) console.log('warm', h + 1);
}
let ms = 0;
const systems: Record<string, number> = {};
sim.wrapSystem = (id, run) => {
  const start = performance.now();
  run();
  systems[id] = (systems[id] ?? 0) + performance.now() - start;
};
for (let h = 0; h < 24; h++) {
  const start = performance.now();
  step(sim);
  ms += performance.now() - start;
}
sim.wrapSystem = undefined;
global.gc?.();
const counts = { T0: 0, T1: 0, T2: 0, T3: 0 };
for (const row of Object.values(required(required(sim.world.region).lod).actors)) counts[row.processing]++;
const heapMB = process.memoryUsage().heapUsed / 1e6;
const packed = JSON.stringify(packJson(sim.world));
const packedMB = Buffer.byteLength(packed) / 1e6,
  gzipMB = gzipSync(packed).length / 1e6;
const result = {
  seed,
  cap,
  radiusMinutes: 360,
  counts,
  msHour: ms / 24,
  heapMB,
  packedMB,
  gzipMB,
  systemsMsHour: Object.fromEntries(Object.entries(systems).map(([id, n]) => [id, n / 24])),
  boundaryMsHour: (ms - Object.values(systems).reduce((a, b) => a + b, 0)) / 24,
  monthlyMs: 0,
  monthlyAmortizedMsHour: 0,
  monthlyAfterHeapMB: 0,
};
writeFileSync(output, JSON.stringify(result, null, 2));
console.log(result);
// Separate component cost: frozen far settlements alone, 30 further days; active sites
// are not advanced. Do not mislabel this as a full month county benchmark.
// Flush the warmup's unfinished prefix before timing exactly 30 further days.
region.settleDormantSites(sim.world, makeContext(sim.world, content, []));
const old = sim.world.time;
sim.world.time = asGameMinute(old + 30 * 1440);
const start = performance.now();
region.settleDormantSites(sim.world, makeContext(sim.world, content, []));
result.monthlyMs = performance.now() - start;
result.monthlyAmortizedMsHour = result.monthlyMs / (30 * 24);
result.monthlyAfterHeapMB = process.memoryUsage().heapUsed / 1e6;
writeFileSync(output, JSON.stringify(result, null, 2));
console.log('monthly component', result.monthlyMs, result.monthlyAmortizedMsHour);
