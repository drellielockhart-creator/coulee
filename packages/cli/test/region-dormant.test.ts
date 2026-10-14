import {
  asGameMinute,
  createSim,
  findNonIntegers,
  makeContext,
  region,
  restoreSim,
  social,
  stateHash,
  step,
} from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { countyBenchContent, required } from './bench/region-fixture.ts';
import { baseContent } from './helpers.ts';

function fixture(seed = 1, beforeEntry?: (sim: ReturnType<typeof createSim>) => void) {
  const content = countyBenchContent(baseContent(), 2, 1);
  const sim = createSim(content, { scenarioId: 'iron_ford_county_bench', seed, withPlayer: true });
  const w = sim.world;
  const r = required(w.region);
  r.definition = structuredClone(r.definition);
  for (const edge of r.definition.edges) edge.cost_minutes = { ab: 1800, ba: 1800 };
  region.configureDormancy(w, { dwellMinutes: 0 });
  beforeEntry?.(sim);
  region.selectRegionTiers(w);
  w.time = asGameMinute(1440);
  region.regionSystem(w, makeContext(w, content, []));
  return sim;
}
function later(sim: ReturnType<typeof fixture>, days: number, hydrate = false) {
  sim.world.time = asGameMinute(days * 1440);
  region.settleDormantSites(sim.world, makeContext(sim.world, sim.content, []), hydrate);
}

describe('M5 dormant T3', () => {
  it('keeps unconfigured regional worlds on their existing T2 owner', () => {
    const content = countyBenchContent(baseContent(), 2, 1);
    const sim = createSim(content, { scenarioId: 'iron_ford_county_bench', seed: 1, withPlayer: true });
    const w = sim.world;
    for (const edge of required(w.region).definition.edges) edge.cost_minutes = { ab: 1800, ba: 1800 };
    region.selectRegionTiers(w);
    w.time = asGameMinute(1440);
    region.regionSystem(w, makeContext(w, content, []));
    expect(w.region?.dormant).toBeUndefined();
    expect(region.processingBuckets(w).daily.actors).toHaveLength(4);
  });
  it('creates persistent birth identities, structural marriages and retained news on canonical dates', () => {
    const sim = fixture(9, (sim) => {
      for (const household of Object.values(sim.world.households)) {
        if (!household.key.startsWith('bench_')) continue;
        const [a, b] = household.memberIds;
        if (a === undefined || b === undefined) continue;
        for (const [from, to] of [
          [a, b],
          [b, a],
        ] as const)
          social.addOpinionReason(sim.world, makeContext(sim.world, sim.content, []), from, to, {
            label: 'Established affection',
            cites: { kind: 'seed' },
            delta: { affection: 60, trust: 30, respect: 0, fear: 0 },
            since: sim.world.time,
          });
      }
    });
    region.configureDormancy(sim.world, {
      birthsPerThousand: 365000,
      marriagesPerThousand: 365000,
      movesPerThousand: 365000,
      deathsPerThousand: 0,
    });
    later(sim, 3, true);
    const facts = required(sim.world.region?.dormant).facts;
    expect(facts.filter((f) => f.kind === 'birth')).toHaveLength(2);
    for (const f of facts.filter((f) => f.kind === 'birth')) {
      const child = required(f.actors[1]);
      expect(sim.world.actors[child]?.born).toBe(f.at);
      expect(sim.world.needs.byActor[child]).toBeDefined();
      expect(sim.world.psyche.byActor[child]).toBeDefined();
    }
    expect(facts.some((f) => f.kind === 'marriage')).toBe(true);
    step(sim);
    for (const f of facts.filter((f) => f.kind === 'birth'))
      expect(sim.world.region?.lod?.actors[required(f.actors[1])]?.processing).toBe('T3');
    expect(findNonIntegers(sim.world)).toEqual([]);
  });

  it('retains identities and canonical complete state under reversed contact order for 50 seeds', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const a = fixture(seed),
        b = restoreSim(a.content, JSON.parse(JSON.stringify(a.world)));
      const sites = Object.values(required(a.world.region?.dormant).sites);
      expect(sites).toHaveLength(2);
      const ids = sites.map((s) => required(s.actors[0]));
      later(a, 61);
      later(b, 61);
      for (const id of ids) region.promoteCensusActor(a.world, makeContext(a.world, a.content, []), id);
      for (const id of [...ids].reverse()) region.promoteCensusActor(b.world, makeContext(b.world, b.content, []), id);
      expect(stateHash(a.world), `seed ${seed}`).toBe(stateHash(b.world));
      expect(findNonIntegers(a.world)).toEqual([]);
      for (const id of ids) expect(a.world.actors[id]?.key).toBe(b.world.actors[id]?.key);
    }
  }, 120000);
  it('restores mid-dormancy and consumes/hydrates exactly once', () => {
    const a = fixture(42),
      uninterrupted = fixture(42);
    later(a, 31 + 14 / 24);
    const b = restoreSim(a.content, JSON.parse(JSON.stringify(a.world)));
    later(a, 61, true);
    later(b, 61, true);
    later(uninterrupted, 61, true);
    expect(stateHash(a.world)).toBe(stateHash(uninterrupted.world));
    expect(stateHash(a.world)).toBe(stateHash(b.world));
    const before = stateHash(b.world);
    later(b, 61, true);
    expect(stateHash(b.world)).toBe(before);
    const id = required(Object.values(required(b.world.region?.dormant).sites)[0]?.actors[0]);
    region.promoteCensusActor(b.world, makeContext(b.world, b.content, []), id);
    const promoted = stateHash(b.world);
    region.promoteCensusActor(b.world, makeContext(b.world, b.content, []), id);
    expect(stateHash(b.world)).toBe(promoted);
  });
  it('keeps future aggregate eligibility independent of when another visit hydrates minds', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const a = fixture(seed, (sim) => {
        region.configureDormancy(sim.world, {
          birthsPerThousand: 0,
          deathsPerThousand: 0,
          marriagesPerThousand: 0,
          feudsPerThousand: 0,
        });
        for (const household of Object.values(sim.world.households)) {
          if (!household.key.startsWith('bench_')) continue;
          for (const from of household.memberIds)
            for (const to of household.memberIds) {
              const op = sim.world.social.opinions[from]?.[to];
              if (op) {
                op.base.affection = 0;
                op.reasons = [];
                op.volatile.affection = 60;
              }
            }
        }
      });
      const b = restoreSim(a.content, JSON.parse(JSON.stringify(a.world)));
      later(a, 31, true);
      later(b, 31);
      for (const sim of [a, b]) {
        region.configureDormancy(sim.world, { marriagesPerThousand: 365000 });
        later(sim, 32, true);
      }
      const facts = (sim: typeof a) => required(sim.world.region?.dormant).facts;
      expect(facts(a)).toEqual(facts(b));
      expect(facts(a).filter((f) => f.kind === 'marriage')).toHaveLength(2);
      // Observation-time band-change log ordering may differ; saved facts, sheets,
      // inventories, minds and cursors must agree after both have caught up.
      expect(stateHash({ ...a.world, log: b.world.log }), `hydration seed ${seed}`).toBe(stateHash(b.world));
    }
  });
  it('freezes named minds and excludes all dormant consumers from hourly processing', () => {
    const sim = fixture();
    const ids = region.processingBuckets(sim.world).dormant.actors;
    const before = ids.map((id) => structuredClone(sim.world.psyche.byActor[id]));
    const inventory = structuredClone(sim.world.items.stacks);
    for (let h = 0; h < 8; h++) step(sim);
    expect(ids.map((id) => sim.world.psyche.byActor[id])).toEqual(before);
    const all = region.processingBuckets(sim.world);
    expect(new Set([...all.hourly.actors, ...all.daily.actors, ...all.dormant.actors]).size).toBe(
      Object.keys(sim.world.actors).length,
    );
    for (const id of ids) expect(all.hourly.actors).not.toContain(id);
    for (const stack of Object.values(inventory))
      if (stack.location.kind === 'household' && all.dormant.households.includes(stack.location.householdId))
        expect(sim.world.items.stacks[stack.id]).toEqual(stack);
  });
  it('promotes pins immediately, respects distance hysteresis and rejects broken cursors', () => {
    const sim = fixture();
    const w = sim.world;
    const id = required(region.processingBuckets(w).dormant.actors[0]);
    for (const edge of required(w.region).definition.edges) edge.cost_minutes = { ab: 1300, ba: 1300 };
    region.regionSystem(w, makeContext(w, sim.content, []));
    expect(w.region?.lod?.actors[id]?.processing).toBe('T3');
    region.setRegionRelevance(w, id, 1, true, 'test pin');
    region.regionSystem(w, makeContext(w, sim.content, []));
    expect(w.region?.lod?.actors[id]?.processing).toBe('T1');
    const row = required(Object.values(required(w.region?.dormant).sites)[0]);
    row.through = w.time + 60;
    expect(() => restoreSim(sim.content, JSON.parse(JSON.stringify(w)))).toThrow('cursor');
    row.through = w.time;
    for (const edge of required(w.region).definition.edges) edge.cost_minutes = { ab: 1200, ba: 1200 };
    region.regionSystem(w, makeContext(w, sim.content, []));
    expect(region.processingBuckets(w).dormant.actors).toEqual([]);
  });
  it('keeps private settlement news out of a distant observer view', () => {
    const sim = fixture(7);
    later(sim, 61, true);
    const pc = required(sim.world.meta.playerId ?? undefined);
    expect(region.dormantNews(sim.world, 'bench_0', pc)).toEqual([]);
  });
});
