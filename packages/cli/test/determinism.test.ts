/**
 * Determinism (ADR 0001 invariant 1; 07 §3.6). These must pass after every module lands.
 */
import { createSim, findNonIntegers, restoreSim, runHours, stateHash, toViewModel, type World } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { collectingSink, eventsJsonl, runScenario } from '../src/harness.ts';
import { baseContent } from './helpers.ts';

const content = baseContent();
const SCENARIO = 'iron_ford';

describe('determinism', () => {
  it('same seed -> same state hash and identical event log', () => {
    const a = runScenario(content, { scenarioId: SCENARIO, seed: 42, hours: 24 * 7 });
    const b = runScenario(content, { scenarioId: SCENARIO, seed: 42, hours: 24 * 7 });
    expect(a.hash).toBe(b.hash);
    expect(eventsJsonl(a.sim.world.log.events)).toBe(eventsJsonl(b.sim.world.log.events));
    expect(a.stats).toEqual(b.stats);
  });

  it('bounded log: the World keeps a rolling window while the sink sees every event in order', () => {
    const a = collectingSink();
    const b = collectingSink();
    const ra = runScenario(content, { scenarioId: SCENARIO, seed: 11, hours: 24 * 5 }, { sink: a.sink });
    const rb = runScenario(content, { scenarioId: SCENARIO, seed: 11, hours: 24 * 5 }, { sink: b.sink });
    const log = ra.sim.world.log;
    expect(a.events.length).toBe(log.lastId);
    expect(a.events.map((e) => e.id)).toEqual(a.events.map((_, i) => i + 1));
    expect(eventsJsonl(a.events)).toBe(eventsJsonl(b.events));
    expect(ra.hash).toBe(rb.hash);
    expect(log.events.length).toBeLessThan(log.lastId);
    expect((log.dropped ?? 0) + log.events.length).toBe(log.lastId);
    // What is retained is exactly the tail of the full stream that the policy keeps.
    const retained = new Set(log.events.map((e) => e.id));
    for (const e of a.events) if (retained.has(e.id)) expect(e).toEqual(log.events.find((x) => x.id === e.id));
  });

  it('different seeds diverge', () => {
    const a = runScenario(content, { scenarioId: SCENARIO, seed: 1, hours: 24 });
    const b = runScenario(content, { scenarioId: SCENARIO, seed: 2, hours: 24 });
    expect(a.hash).not.toBe(b.hash);
  });

  it('save/load mid-run (JSON round-trip) does not change the outcome', () => {
    const straight = runScenario(content, { scenarioId: SCENARIO, seed: 7, hours: 24 * 6 });
    const sim = createSim(content, { scenarioId: SCENARIO, seed: 7 });
    runHours(sim, 24 * 3);
    const saved = JSON.parse(JSON.stringify(sim.world)) as World;
    const resumed = restoreSim(content, saved);
    runHours(resumed, 24 * 3);
    expect(stateHash(resumed.world)).toBe(straight.hash);
  });

  it('world state holds only integers (invariant 2) and is plain JSON', () => {
    const { sim } = runScenario(content, { scenarioId: SCENARIO, seed: 3, hours: 24 * 3 });
    expect(findNonIntegers(sim.world)).toEqual([]);
    expect(JSON.parse(JSON.stringify(sim.world))).toEqual(sim.world);
  });

  it('view model builds for every actor and is structured-clone-able', () => {
    const { sim } = runScenario(content, { scenarioId: SCENARIO, seed: 3, hours: 24 });
    const vm = toViewModel(sim.world, content, { perspective: null, includeExplain: true });
    expect(vm.actors.length).toBe(Object.keys(sim.world.actors).length);
    expect(structuredClone(vm)).toEqual(vm);
  });
});
