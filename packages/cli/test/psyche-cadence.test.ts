/**
 * Psyche cadence for idle minds (psyche/cadence.ts): a sleeper whose situation is unchanged
 * idles (no proposal gathering); anything that happens to them forces the full pass that same
 * hour, and a save taken mid-night resumes exactly as the uninterrupted run.
 */
import {
  type ActorId,
  type Command,
  createSim,
  makeContext,
  psyche,
  restoreSim,
  type Sim,
  stateHash,
  step,
  sumTerms,
  type World,
} from '@coulee/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { baseContent } from './helpers.ts';

const content = baseContent();
const make = (): Sim => createSim(content, { scenarioId: 'iron_ford', seed: 42, withPlayer: true });
const fork = (sim: Sim): Sim => restoreSim(content, JSON.parse(JSON.stringify(sim.world)) as World);
const asleep = (w: World, id: ActorId) => content.activities[w.activity.byActor[id]?.activityId ?? '']?.asleep === true;

/** Actors who idled in the hour just stepped (pace recorded, `chosen` decided earlier). */
function idlers(w: World): ActorId[] {
  const hour = w.time - 60;
  return Object.keys(w.psyche.byActor)
    .map(Number)
    .filter((id) => {
      const p = w.psyche.byActor[id];
      return p?.pace?.at === hour && p.chosen !== null && p.chosen.at < hour && asleep(w, id as ActorId);
    }) as ActorId[];
}

/** A night in Iron Ford with an NPC who idled last hour and would idle again this hour. */
function nightWithIdler(): { sim: Sim; sleeper: ActorId; other: ActorId } {
  const sim = make();
  for (let h = 0; h < 24 * 3 + 21; h++) {
    step(sim);
    if (sim.world.time % 1440 < 60 || sim.world.time % 1440 > 4 * 60) continue;
    for (const id of idlers(sim.world)) {
      if (id === sim.world.meta.playerId) continue;
      const probe = fork(sim);
      step(probe);
      if (!idlers(probe.world).includes(id)) continue;
      const other = Object.values(sim.world.actors).find(
        (a) =>
          a.alive &&
          a.id !== id &&
          a.id !== sim.world.meta.playerId &&
          a.householdId !== sim.world.actors[id]?.householdId,
      );
      if (other) return { sim, sleeper: id, other: other.id };
    }
  }
  throw new Error('no idle sleeper found');
}

/** Step one hour with `extra` happening first; did the sleeper's mind run its full pass? */
function fullPassAfter(sim: Sim, sleeper: ActorId, extra: (s: Sim) => readonly Command[]): boolean {
  const s = fork(sim);
  const commands = extra(s);
  const hour = s.world.time;
  step(s, commands);
  return s.world.psyche.byActor[sleeper]?.chosen?.at === hour;
}

beforeEach(() => psyche.setIdleCadence(true));
afterEach(() => psyche.setIdleCadence(false));

describe('psyche cadence for idle minds', () => {
  it('a sleeper idles while nothing changes, and reacts the same hour when spoken to, attacked, or a fire is lit by the bed', () => {
    const { sim, sleeper, other } = nightWithIdler();
    const place = sim.world.actors[sleeper]?.placeId ?? (0 as never);
    expect(fullPassAfter(sim, sleeper, () => [])).toBe(false);

    const interaction = (s: Sim, interactionId: string, hostile: boolean) => {
      const ctx = makeContext(s.world, content, []);
      ctx.emit({
        kind: 'social.interaction',
        data: {
          interactionId,
          initiatorId: other,
          targetId: sleeper,
          placeId: place,
          success: true,
          label: interactionId,
        },
        roles: [
          { actor: other, role: 'agent' },
          { actor: sleeper, role: hostile ? 'victim' : 'listener' },
        ],
        place,
        visibility: 'witnessed',
      } as never);
      return [];
    };
    // Spoken to (an NPC's words, or the player's order naming them) and struck.
    expect(fullPassAfter(sim, sleeper, (s) => interaction(s, 'chat', false))).toBe(true);
    expect(fullPassAfter(sim, sleeper, (s) => interaction(s, 'shove', true))).toBe(true);
    const pc = sim.world.meta.playerId;
    if (pc !== null) {
      const order: Command = {
        kind: 'core.urge',
        actorId: pc,
        data: { urge: { kind: 'interaction', interactionId: 'chat', targetId: sleeper } },
      } as Command;
      expect(fullPassAfter(sim, sleeper, () => [order])).toBe(true);
    }
    // A fire by the bed: a public event at the sleeper's place, naming no one.
    expect(
      fullPassAfter(sim, sleeper, (s) => {
        makeContext(s.world, content, []).emit({
          kind: 'provisions.fire',
          data: { placeId: place, lit: true, fuelMinutes: 60, ignition: 'flint' },
          place,
          visibility: 'public',
        } as never);
        return [];
      }),
    ).toBe(true);
    // A fright booked from outside (psyche.addAnxiety) is a full pass too.
    expect(
      fullPassAfter(sim, sleeper, (s) => {
        psyche.addAnxiety(s.world, makeContext(s.world, content, []), sleeper, 50);
        return [];
      }),
    ).toBe(true);
  });

  it('a commanded actor asleep is handled the hour the order arrives', () => {
    const sim = make();
    const pc = sim.world.meta.playerId;
    expect(pc).not.toBeNull();
    for (let h = 0; h < 24 * 2 + 2; h++) step(sim);
    const id = pc as ActorId;
    const hour = sim.world.time;
    step(sim, [
      { kind: 'core.urge', actorId: id, data: { urge: { kind: 'activity', activityId: 'idle_at_home' } } } as Command,
    ]);
    const chosen = sim.world.psyche.byActor[id]?.chosen;
    expect(chosen?.at).toBe(hour);
    expect(chosen?.voice).toBe('command');
  });

  it('idle hours keep every thought legible (reasons sum to intensity) and chosen truthful', () => {
    const sim = make();
    let idle = 0;
    for (let h = 0; h < 24 * 4; h++) {
      step(sim);
      const ids = idlers(sim.world);
      idle += ids.length;
      for (const id of ids) {
        const p = sim.world.psyche.byActor[id];
        for (const t of p?.thoughts ?? []) expect(sumTerms(t.reasons)).toBe(t.intensity);
        // The standing choice is the sleep the actor is in, decided at an earlier full pass.
        expect(p?.chosen?.urge.kind).toBe('activity');
      }
    }
    expect(idle).toBeGreaterThan(50);
  });

  it('a save taken mid-night resumes exactly as the uninterrupted run', () => {
    const sim = make();
    for (let h = 0; h < 24 + 2; h++) step(sim);
    expect(idlers(sim.world).length).toBeGreaterThan(0);
    const resumed = fork(sim);
    for (let h = 0; h < 30; h++) {
      step(sim);
      step(resumed);
      expect(stateHash(resumed.world), `hour ${h}`).toBe(stateHash(sim.world));
    }
  });

  it('off (the default) every mind runs its full pass every hour and nothing is recorded', () => {
    psyche.setIdleCadence(false);
    const sim = make();
    for (let h = 0; h < 24 + 3; h++) step(sim);
    expect(idlers(sim.world)).toEqual([]);
    // Off is inert: no pace records and no event watermark (hash-identical to the code before it).
    expect(Object.values(sim.world.psyche.byActor).some((p) => p.pace !== undefined)).toBe(false);
    expect(sim.world.psyche.seenEventId).toBeUndefined();
  });
});
