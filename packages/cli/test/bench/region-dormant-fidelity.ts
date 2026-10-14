/** Manual remote-settlement gate: the T2 control calls the unchanged 2e batch kernel. */
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { asGameMinute, createSim, findNonIntegers, items, makeContext, region } from '@coulee/core';
import { baseContent } from '../helpers.ts';
import { dormantFidelityGate } from './region-dormant-bands.ts';
import { countyBenchContent, required } from './region-fixture.ts';

const content = countyBenchContent(baseContent(), 1, 1);
if (process.argv[4] === 'ample')
  for (const h of required(content.scenarios.iron_ford_county_bench).households)
    if (h.key.startsWith('bench_'))
      h.pantry = [
        { item: 'hardtack', qty: 240, worn: false },
        { item: 'pemmican', qty: 160, worn: false },
        { item: 'dried_apples', qty: 160, worn: false },
      ];
const output = process.argv[2] ?? 'runs/scratch/t3-fidelity.json';
const count = Number(process.argv[3] ?? 50);
const rows = [];
for (let seed = 1; seed <= count; seed++) {
  const pair = [];
  for (const dormant of [false, true]) {
    const sim = createSim(content, { scenarioId: 'iron_ford_county_bench', seed, withPlayer: true });
    const w = sim.world;
    const r = required(w.region);
    r.definition = structuredClone(r.definition);
    for (const e of r.definition.edges) e.cost_minutes = { ab: 1800, ba: 1800 };
    region.configureDormancy(w, { enabled: dormant, dwellMinutes: 0 });
    region.selectRegionTiers(w);
    w.time = asGameMinute(1440);
    region.regionSystem(w, makeContext(w, content, []));
    const hid = required(w.index.householdByKey.bench_0_0);
    const ids = [...required(w.households[hid]).memberIds];
    const pantry = () =>
      items.stacksDeep(w, items.pantryOf(hid)).reduce((n, { stack: s }) => {
        const f = content.items[s.defId]?.food;
        return n + (f ? ((s.qty * f.servings - s.partial - (s.foodPartialPm ?? 0) / 1000) * f.kcal) / f.servings : 0);
      }, 0);
    const initialPantry = pantry(),
      initialCash = required(w.provisions.households[hid]).cashCents;
    const start = performance.now();
    // Isolate the absent settlement; no unmeasured 40-actor T0 control cost in this gate.
    for (let day = 2; day <= 61; day++) {
      w.time = asGameMinute(day * 1440);
      const ctx = makeContext(w, content, []);
      if (dormant) {
        if (ctx.cal.day === 1) region.settleDormantSites(w, ctx);
      } else region.settleDailySites(w, ctx);
    }
    region.promoteCensusActor(w, makeContext(w, content, []), required(ids[0]));
    pair.push({
      dormant,
      msHour: (performance.now() - start) / (60 * 24),
      population: required(w.households[hid]).memberIds.filter((id) => w.actors[id]?.alive).length,
      deaths: ids.filter((id) => !w.actors[id]?.alive).length,
      cash: required(w.provisions.households[hid]).cashCents,
      pantry: pantry(),
      initialCash,
      initialPantry,
      grudges: Object.values(w.belief.grudges).filter((g) => ids.includes(g.holderId) && g.intensity > 0).length,
      integerErrors: findNonIntegers(w).length,
      facts: r.dormant?.facts.map((f) => f.kind),
    });
  }
  const t2 = required(pair[0]),
    t3 = required(pair[1]);
  const gate = dormantFidelityGate(
    { population: 2, deaths: 0, cash: t2.initialCash, pantry: t2.initialPantry, grudges: 0 },
    t2,
    t3,
  );
  rows.push({ seed, pair, gate });
  if (!gate.pass) process.exitCode = 1;
  writeFileSync(output, JSON.stringify(rows, null, 2));
  console.log(
    seed,
    pair.map((p) => ({ mode: p.dormant, pop: p.population, deaths: p.deaths, pantry: p.pantry, ms: p.msHour })),
  );
}
