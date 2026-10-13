import { createSim, director, findNonIntegers, needs, provisions, restoreSim, runHours, stateHash } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { EMA_ALPHA_Q16, emaQ16 } from '../../core/src/director/fixed.ts';
import { pacingStep } from '../../core/src/director/system.ts';
import { measureTension, WEIGHTS } from '../../core/src/director/tension.ts';
import { recordProjection, scoreThread, updateThreads } from '../../core/src/director/threads.ts';
import { packJson } from '../../core/src/serialization.ts';
import { makeContext } from '../../core/src/sim/sim.ts';
import { observation } from '../../play/src/observation.ts';
import { baseContent, simFor } from './helpers.ts';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing test fixture');
  return value;
}

function stripped(world: ReturnType<typeof simFor>['world']) {
  const { director: _director, ...rest } = world;
  return rest;
}

describe('Director D0 is observational', () => {
  it('preserves every other slice, log ID and chronicle while following the fixture PC', () => {
    const a = simFor({ seed: 42, fullLog: false }),
      b = simFor({ seed: 42, fullLog: false });
    delete b.world.director;
    b.wrapSystem = (id, run) => {
      if (id !== 'director') run();
    };
    runHours(a, 72);
    runHours(b, 72);
    expect(stateHash(stripped(a.world))).toBe(stateHash(b.world));
    expect(a.world.meta.playerId).toBeNull();
    expect(a.world.director?.focus).toBe(
      a.world.index.actorByKey[required(required(baseContent().scenarios.iron_ford).player)],
    );
    for (const th of a.world.chronicle.threads) {
      const projected = a.world.director?.threads[th.id];
      if (projected?.closed_at === null)
        expect(projected.level).toBeGreaterThanOrEqual(Math.max(th.emitted.pub, th.emitted.pc, th.emitted.all));
    }
    expect(a.world.director?.event_seq).toBe(72);
    expect(a.world.director?.ledger).toHaveLength(3);
    expect(a.world.director?.ledger.every((l) => l.cost === 0 && !l.foresaw && l.knowledge === 'omniscient')).toBe(
      true,
    );
    expect(findNonIntegers(a.world)).toEqual([]);
  }, 60_000);

  it('uses all seven bounded terms and exposes the exact weighted total without mutation', () => {
    const sim = simFor({ seed: 42 });
    const before = stateHash(sim.world);
    const m = measureTension(sim.world, makeContext(sim.world, sim.content, []), required(sim.world.director).focus);
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(Object.values(m.terms).every((v) => Number.isInteger(v) && v >= 0 && v <= 1000)).toBe(true);
    expect(m.tau).toBe(
      Math.floor(Object.entries(WEIGHTS).reduce((s, [k, w]) => s + w * m.terms[k as keyof typeof WEIGHTS], 0) / 100),
    );
    expect(m.explain.terms.reduce((s, t) => s + t.value, 0)).toBe(m.tau);
    expect(m.explain.knowledge).toBe('omniscient');
    expect(stateHash(sim.world)).toBe(before);
  });

  it('prunes food projection only when it cannot change the survival maximum', () => {
    const sim = simFor({ seed: 42 });
    const pc = required(required(sim.world.director).focus);
    for (let hour = 0; hour < 48; hour++) {
      const w = sim.world,
        c = sim.content;
      const floor = needs.tensionNeeds(w, c, pc).survival;
      const full = provisions.tensionProvisions(w, c, pc, w.time);
      const bounded = provisions.tensionProvisions(w, c, pc, w.time, floor);
      expect(Math.max(floor, full.scurvy, full.food)).toBe(Math.max(floor, bounded.scurvy, bounded.food));
      runHours(sim, 1);
    }
  }, 60_000);

  it('retains subpoint EMA movement and follows each pacing transition', () => {
    let slow = 0;
    for (let i = 0; i < 24 * 30; i++) slow = emaQ16(slow, 10, EMA_ALPHA_Q16.slow);
    expect(Math.floor(slow / 65536)).toBeGreaterThanOrEqual(9);
    let fast = 0;
    for (let i = 0; i < 6; i++) fast = emaQ16(fast, 1000, EMA_ALPHA_Q16.fast);
    expect(Math.floor(fast / 65536)).toBeGreaterThanOrEqual(631);
    expect(Math.floor(fast / 65536)).toBeLessThanOrEqual(633);
    const st = director.createDirectorState(),
      curve = { relax_days: 1, peak_threshold: 700, peak_hours: 6 };
    pacingStep(st, 1440, curve);
    expect(st.pacing).toBe('BUILD');
    st.tau_fast = 750;
    pacingStep(st, 1500, curve);
    expect(st.pacing).toBe('PEAK');
    pacingStep(st, 1860, curve);
    expect(st.pacing).toBe('FADE');
    st.tau_fast = 299;
    for (let i = 0; i < 12; i++) pacingStep(st, 1920 + i * 60, curve);
    expect(st.pacing).toBe('RELAX');
  });

  it('persists, fires, learns and expires guns independently of log retention', () => {
    const sim = simFor(),
      st = required(sim.world.director),
      pc = required(st.focus);
    const p = {
      id: 900,
      pattern: 'debt',
      actors: { debtor: pc },
      places: [],
      opened_at: 0,
      last_advanced: 0,
      stakes_pm: 600,
      state: 'Latent' as const,
      level: 0,
      open_questions: ['Pay?'],
      guns: [{ event: 999999, at: 0, salience: 700, window: [1, 3] as [number, number] }],
      firedAt: null,
    };
    recordProjection(sim.world, p);
    updateThreads(sim.world, 60, new Set([999999]), true);
    expect(st.threads[900]?.state).toBe('Foreshadowed');
    expect(st.threads[900]?.guns[0]?.seen_by_player).toBe(true);
    recordProjection(sim.world, { ...p, state: 'Resolved', last_advanced: 2880, firedAt: 2880 });
    expect(st.guns).toMatchObject({ planted: 1, seen: 1, fired: 1, expired: 0 });
    expect(st.patterns.debt).toEqual({ opened: 1, resolved: 1, abandoned: 0 });
    recordProjection(sim.world, { ...p, id: 901, guns: [{ event: 999998, at: 0, salience: 700, window: [1, 3] }] });
    updateThreads(sim.world, 4 * 1440, new Set(), true);
    expect(st.guns.expired_unseen).toBe(1);
    const th = required(st.threads[901]);
    th.callbacks = [{ owner: pc, memory: 123, salience: 800 }];
    scoreThread(st, th, 4 * 1440);
    const charged = th.interest;
    th.callbacks = [];
    scoreThread(st, th, 4 * 1440);
    expect(charged - th.interest).toBe(1200);
    expect(findNonIntegers(sim.world)).toEqual([]);
  });

  it('save/restore continues identically, migrates absent slices, and rejects active personalities', () => {
    const a = simFor({ seed: 42 });
    runHours(a, 25);
    const b = restoreSim(a.content, packJson(a.world));
    runHours(a, 24);
    runHours(b, 24);
    expect(stateHash(a.world)).toBe(stateHash(b.world));
    const legacy = JSON.parse(JSON.stringify(stripped(a.world)));
    const migrated = restoreSim(a.content, legacy);
    expect(migrated.world.director?.settings).toEqual({ personality: 'land_itself', foresight: 'tiltable' });
    expect(() => director.directorSettings({ personality: 'almanac' as 'land_itself' })).toThrow('land_itself');
    expect(Object.keys(baseContent().directorPersonalities)).toHaveLength(7);
    for (const foresight of ['off', 'tiltable', 'full'] as const) {
      const s = createSim(baseContent(), { scenarioId: 'iron_ford', seed: 1, director: { foresight } });
      expect(s.world.director?.settings.foresight).toBe(foresight);
    }
  }, 60_000);

  it('keeps fair observations unchanged while god observations expose measurement', () => {
    const sim = createSim(baseContent(), { scenarioId: 'iron_ford', seed: 42, withPlayer: true });
    runHours(sim, 1);
    const pc = required(sim.world.meta.playerId);
    const fair = observation(sim, pc, [], 'fair');
    expect('director' in fair).toBe(false);
    expect(observation(sim, pc, [], 'god').director?.tau).toBe(sim.world.director?.tau);
    const slice = sim.world.director;
    delete sim.world.director;
    expect(observation(sim, pc, [], 'fair')).toEqual(fair);
    sim.world.director = slice;
  }, 60_000);
});
