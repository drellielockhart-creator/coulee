/**
 * Call candidates (perf wave 13): a caller weighs the people they know and their kin, plus a
 * bounded neighbourly allowance (strangers in the nearest households of their site, and in
 * households new to it), never every adult in the county. A household the town does not know
 * still gets welcome calls in its first week (P2: the same rule for a newly arrived PC).
 */
import { type ActorId, activity, createSim, type Event, type HouseholdId, runHours } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { baseContent } from './helpers.ts';

/** Make a household strangers to the town: no opinion records or ties either way. */
function arrive(world: ReturnType<typeof createSim>['world'], hid: HouseholdId): Set<number> {
  const mine = new Set<number>(world.households[hid]?.memberIds ?? []);
  for (const [holder, rec] of Object.entries(world.social.opinions))
    for (const k of Object.keys(rec ?? {}))
      if (mine.has(Number(holder)) !== mine.has(Number(k))) delete (rec as Record<string, unknown>)[k];
  world.social.relationships = world.social.relationships.filter((r) => mine.has(r.a) === mine.has(r.b));
  return mine;
}

describe('call candidates', () => {
  it('a household new to Iron Ford (seed 42) gets a welcome call within its first week', () => {
    const content = baseContent();
    const sim = createSim(content, { scenarioId: 'iron_ford', seed: 42 });
    runHours(sim, 14 * 24);
    const w = sim.world;
    const h = Object.values(w.households).find((x) => /Hatches/.test(x.name));
    if (!h) throw new Error('no ferry household');
    const mine = arrive(w, h.id);
    // Nobody outside knows them now, yet the nearest neighbours may call on them.
    const outsider = Object.values(w.actors).find(
      (a) => a.alive && !mine.has(a.id) && activity.callCandidates(w, a.id).some((c) => mine.has(c.targetId)),
    );
    expect(outsider).toBeDefined();
    const calls: Event[] = [];
    sim.sink = (e) => {
      if (
        e.kind === 'activity.started' &&
        e.data.activityId === 'visit_kin' &&
        e.data.placeId === h.homePlaceId &&
        !mine.has(e.data.actorId)
      )
        calls.push(e);
    };
    runHours(sim, 7 * 24);
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it('weighs only acquaintances, kin and a few neighbouring households, not the whole town', () => {
    const content = baseContent();
    const sim = createSim(content, { scenarioId: 'iron_ford', seed: 42 });
    runHours(sim, 30 * 24);
    const w = sim.world;
    for (const a of Object.values(w.actors)) {
      if (!a.alive) continue;
      const known = new Set(Object.keys(w.social.opinions[a.id] ?? {}).map(Number));
      const strangerHouseholds = new Set<number>();
      for (const c of activity.callCandidates(w, a.id)) {
        if (known.has(c.targetId)) continue;
        strangerHouseholds.add(w.actors[c.targetId as ActorId]?.householdId ?? -1);
      }
      // Nearest three, plus at most three newcomer households.
      expect(strangerHouseholds.size).toBeLessThanOrEqual(6);
    }
  });
});
