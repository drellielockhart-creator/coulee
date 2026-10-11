/** Real Iron Ford schedules and physiology, robust to unrelated module stubs. */
import {
  activity,
  createSim,
  findNonIntegers,
  idsOf,
  needs,
  restoreSim,
  stateHash,
  step,
  yearsBetween,
} from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { makeContext } from '../../core/src/sim/sim.ts';
import { runScenario, toCsv } from '../src/harness.ts';
import { baseContent, simFor } from './helpers.ts';

function attendance(sim: ReturnType<typeof simFor>, execute: () => void) {
  const counters = new Map<
    number,
    { work: number; atWork: number; night: number; asleep: number; church: number; atChurch: number }
  >();
  for (const id of idsOf(sim.world.actors))
    counters.set(id, { work: 0, atWork: 0, night: 0, asleep: 0, church: 0, atChurch: 0 });
  for (let hour = 0; hour < 14 * 24; hour++) {
    const ctx = makeContext(sim.world, sim.content, []);
    execute();
    for (const id of idsOf(sim.world.actors)) {
      const actor = sim.world.actors[id];
      const state = sim.world.activity.byActor[id];
      const count = counters.get(id);
      if (!actor || !state || !count || yearsBetween(actor.born, ctx.now) < 18) continue;
      const block = activity.scheduledRoutine(sim.world, ctx, id);
      if (
        !ctx.cal.isSabbath &&
        block &&
        block.duty > 0 &&
        sim.content.activities[block.activityId]?.at === 'workplace'
      ) {
        count.work++;
        if (actor.placeId === (state.workplaceId ?? sim.world.households[actor.householdId]?.homePlaceId))
          count.atWork++;
      }
      if (block && sim.content.activities[block.activityId]?.asleep) {
        count.night++;
        // At home, or where a confined actor (the missing chainmen) is held.
        const bed = sim.content.occupations[actor.occupationId]?.confined
          ? state.workplaceId
          : sim.world.households[actor.householdId]?.homePlaceId;
        if (sim.content.activities[state.activityId ?? '']?.asleep && actor.placeId === bed) count.asleep++;
      }
      if (
        ctx.cal.isSabbath &&
        ctx.cal.hour >= 10 &&
        ctx.cal.hour < 12 &&
        (actor.values.piety >= 0 || actor.traits.includes('pious')) &&
        sim.content.occupations[actor.occupationId]?.schedule.some(
          (b) => b.activity === 'attend_church' && b.days?.includes('sun'),
        )
      ) {
        count.church++;
        if (sim.world.places[actor.placeId]?.tags.includes('church')) count.atChurch++;
      }
    }
    for (const pid of idsOf(sim.world.places))
      expect(sim.world.activity.occupancy[pid] ?? []).toEqual(
        idsOf(sim.world.actors).filter(
          (id) =>
            sim.world.actors[id]?.alive &&
            !sim.world.activity.byActor[id]?.travel &&
            sim.world.actors[id]?.placeId === pid,
        ),
      );
  }
  const workers = [...counters.values()].filter((c) => c.work > 0);
  expect(workers.length).toBeGreaterThan(0);
  for (const [id, count] of counters)
    if (count.work > 0) expect(count.atWork / count.work, sim.world.actors[id]?.key).toBeGreaterThan(0.5);
  // Schedule fallback should preserve nearly all planned sleep hours.
  for (const [id, count] of counters)
    if (count.night > 0) expect(count.asleep / count.night, sim.world.actors[id]?.key).toBeGreaterThan(0.85);
  const church = [...counters.values()].reduce((sum, c) => sum + c.church, 0);
  const atChurch = [...counters.values()].reduce((sum, c) => sum + c.atChurch, 0);
  expect(church).toBeGreaterThan(0);
  expect(atChurch / church).toBeGreaterThan(0.5);
  expect(findNonIntegers(sim.world)).toEqual([]);
}

describe('needs-activities in Iron Ford', () => {
  it('seed 42 / 14 days wires activities, meals and occupancy into the real hourly sim', () => {
    const sim = simFor({ seed: 42 });
    for (let hour = 0; hour < 14 * 24; hour++) {
      step(sim);
      for (const pid of idsOf(sim.world.places))
        expect(sim.world.activity.occupancy[pid] ?? []).toEqual(
          idsOf(sim.world.actors).filter(
            (id) =>
              sim.world.actors[id]?.alive &&
              !sim.world.activity.byActor[id]?.travel &&
              sim.world.actors[id]?.placeId === pid,
          ),
        );
    }
    const events = sim.world.log.events;
    expect(events.some((e) => e.kind === 'activity.gathering')).toBe(true);
    expect(events.some((e) => e.kind === 'needs.band_changed')).toBe(true);
    expect(events.some((e) => e.kind === 'needs.fed')).toBe(true);
    for (const activityId of ['sleep', 'work', 'attend_church', 'go_to_market'])
      expect(events.some((e) => e.kind === 'activity.started' && e.data.activityId === activityId)).toBe(true);
    expect(findNonIntegers(sim.world)).toEqual([]);
  });
  it('seed 42 / 14 days: schedule attendance fractions and nightly sleep with no psyche choice', () => {
    const sim = simFor({ seed: 42 });
    attendance(sim, () => {
      const ctx = makeContext(sim.world, sim.content, []);
      needs.needsSystem(sim.world, ctx);
      for (const id of idsOf(sim.world.actors)) {
        const p = sim.world.psyche.byActor[id];
        if (p) p.chosen = null;
      }
      activity.activitySystem(sim.world, ctx);
      sim.world.time = (sim.world.time + 60) as typeof sim.world.time;
    });
  });
  it('a directly injected command choice moves an ordinary actor to the tavern this hour', () => {
    const sim = simFor({ seed: 42 });
    const id = idsOf(sim.world.actors)[0];
    if (id === undefined) throw new Error('No actor');
    const p = sim.world.psyche.byActor[id];
    if (!p) throw new Error('No psyche');
    p.chosen = {
      urge: { kind: 'activity', activityId: 'drink_at_tavern' },
      voice: 'command',
      compromise: false,
      at: sim.world.time,
      explain: {
        kind: 'arbitration',
        label: 'Command',
        subjects: [id],
        knowledge: 'self',
        terms: [],
        total: 1000,
        outcome: 'chosen',
      },
    };
    activity.activitySystem(sim.world, makeContext(sim.world, sim.content, []));
    expect(sim.world.places[sim.world.actors[id]?.placeId ?? 0]?.tags).toContain('tavern');
  });
  it('writes contracted stats columns and remains deterministic through save/load', () => {
    const content = baseContent();
    const a = runScenario(content, { scenarioId: 'iron_ford', seed: 42, hours: 48 });
    const b = runScenario(content, { scenarioId: 'iron_ford', seed: 42, hours: 48 });
    expect(a.hash).toBe(b.hash);
    expect(a.sim.world.log.events).toEqual(b.sim.world.log.events);
    const csv = toCsv(a.stats);
    for (const key of Object.keys(content.needs)) expect(csv.split('\n')[0]).toContain(`needs_${key}_mean`);
    const resumed = restoreSim(content, JSON.parse(JSON.stringify(a.sim.world)));
    for (let h = 0; h < 24; h++) step(resumed);
    const straight = createSim(content, { scenarioId: 'iron_ford', seed: 42 });
    for (let h = 0; h < 72; h++) step(straight);
    expect(stateHash(resumed.world)).toBe(stateHash(straight.world));
  });
});
