/** node --expose-gc --import tsx .../region-scale.ts [output] [sites=14] [households/site=100] [hours=48] [pairs=3] [T1|T2] */
import { writeFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import { createSim, packJson, region, step } from '@coulee/core';
import { baseContent } from '../helpers.ts';
import { countyBenchContent, required } from './region-fixture.ts';

const output = process.argv[2] ?? 'runs/scratch/region-scale.json';
const content = countyBenchContent(baseContent(), Number(process.argv[3] ?? 14), Number(process.argv[4] ?? 100));
const hours = Number(process.argv[5] ?? 48),
  pairs = Number(process.argv[6] ?? 3);
const results = [];
for (let pair = 0; pair < pairs; pair++) {
  const row = [];
  const order = pair % 2 ? [true, false] : [false, true];
  for (const coarse of order.filter((daily) => !process.argv[7] || process.argv[7] === (daily ? 'T2' : 'T1'))) {
    global.gc?.();
    const sim = createSim(content, { scenarioId: 'iron_ford_county_bench', seed: 41 + pair, withPlayer: true });
    if (!coarse)
      for (const a of Object.values(sim.world.actors))
        region.setRegionRelevance(sim.world, a.id, 0, true, 'benchmark T1 control');
    // Full 24-hour grace, then a complete daily batch as warmup. Measure complete days.
    for (let h = 0; h < 48; h++) {
      step(sim);
      if (h % 1 === 0) console.log('warm', pair, coarse, h + 1);
    }
    const systems: Record<string, number> = {};
    sim.wrapSystem = (id, run) => {
      const start = performance.now();
      run();
      systems[id] = (systems[id] ?? 0) + performance.now() - start;
    };
    let elapsed = 0;
    const inspector = new Session();
    inspector.connect();
    await inspector.post('Profiler.enable');
    const profileCosts = new Map<string, number>();
    for (let h = 0; h < hours; h++) {
      const profiling = process.env.REGION_PROFILE === '1' && coarse && (sim.world.time + 60) % 1440 === 0;
      if (profiling) await inspector.post('Profiler.start');
      const start = performance.now();
      step(sim);
      elapsed += performance.now() - start;
      if (profiling) {
        const { profile } = await inspector.post('Profiler.stop');
        writeFileSync(`${output}.${pair}.${h}.cpuprofile`, JSON.stringify(profile));
        const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
        const within = new Set<number>();
        const visit = (id: number, daily: boolean) => {
          const n = required(nodes.get(id));
          const here = daily || n.callFrame.functionName === 'settleDailySites';
          if (here) within.add(id);
          for (const child of n.children ?? []) visit(child, here);
        };
        visit(required(profile.nodes[0]).id, false);
        profile.samples?.forEach((id, i) => {
          if (!within.has(id)) return;
          const f = required(nodes.get(id)).callFrame;
          const key = `${f.functionName || '(anonymous)'} ${f.url.split('/').slice(-3).join('/')}:${f.lineNumber + 1}`;
          profileCosts.set(key, (profileCosts.get(key) ?? 0) + (profile.timeDeltas?.[i] ?? 0));
        });
      }
      if (h % 12 === 11) console.log('measure', pair, coarse, h + 1, elapsed / (h + 1));
    }
    inspector.disconnect();
    global.gc?.();
    // Absolute post-GC process heap, before serialization. A per-iteration delta can
    // subtract the preceding world's still-live heap and falsely suggest a tiny T2 world.
    const heapMB = process.memoryUsage().heapUsed / 1e6;
    const counts = { T0: 0, T1: 0, T2: 0 };
    for (const a of Object.values(required(required(sim.world.region).lod).actors)) counts[a.processing]++;
    const packed = JSON.stringify(packJson(sim.world));
    const totalProfile = [...profileCosts.values()].reduce((a, b) => a + b, 0);
    row.push({
      coarse,
      counts,
      msHour: elapsed / hours,
      heapMB,
      serializationHeapMB: process.memoryUsage().heapUsed / 1e6,
      packedMB: Buffer.byteLength(packed) / 1e6,
      gzipMB: gzipSync(packed).length / 1e6,
      systemsMsHour: Object.fromEntries(Object.entries(systems).map(([id, ms]) => [id, ms / hours])),
      outsideSystemsMsHour: (elapsed - Object.values(systems).reduce((a, b) => a + b, 0)) / hours,
      profileTop10: [...profileCosts]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([fn, us]) => ({ fn, ms: us / 1000, pct: (100 * us) / totalProfile })),
    });
    console.log(JSON.stringify(row.at(-1)));
  }
  results.push({ pair, seed: 41 + pair, row });
  writeFileSync(output, JSON.stringify(results, null, 2));
}
