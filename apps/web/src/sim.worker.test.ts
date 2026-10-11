import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FromWorker, ToWorker } from './protocol.ts';

type MockWorld = {
  time: number;
  meta: { playerId: number };
  actors: Record<number, { placeId: number; name: { given: string; family: string } }>;
  places: Record<number, { name: string }>;
  log: { lastId: number; events: Array<{ id: number; kind: string; data: Record<string, unknown> }> };
};

const core = vi.hoisted(() => ({
  /** Events the next step appends (tests set this to raise alerts). */
  nextEvents: [] as Array<{ kind: string; data: Record<string, unknown> }>,
  createSim: vi.fn(() => ({
    world: {
      time: 0,
      meta: { playerId: 7 },
      actors: { 7: { placeId: 1, name: { given: 'Ada', family: 'North' } } },
      places: { 1: { name: 'Store' } },
      log: { lastId: 0, events: [] },
    } as MockWorld,
  })),
  step: vi.fn((sim: { world: MockWorld }, _commands: unknown[]) => {
    sim.world.time += 60;
    for (const e of core.nextEvents.splice(0)) {
      sim.world.log.lastId += 1;
      sim.world.log.events.push({ id: sim.world.log.lastId, ...e });
    }
  }),
  eventsSince: vi.fn((log: MockWorld['log'], after: number) => log.events.filter((e) => e.id > after)),
  toViewModel: vi.fn((world: { time: number }, _content: unknown, options: unknown) => ({
    time: { t: world.time },
    actors: [{ id: 7, name: 'Ada North', t: world.time }],
    places: [{ id: 1, name: 'Store' }],
    options,
  })),
  readinessOf: vi.fn(() => ({ daysOfFoodTenths: 24, daysOfFuelTenths: null, warnings: ['Bring a kettle'] })),
}));
vi.mock('@coulee/core', () => ({
  ...core,
  DEFAULT_VIEW_OPTIONS: { omniscient: false, perspective: null },
  provisions: { readinessOf: core.readinessOf },
}));
// The shared policy is exercised for real in packages/play; here every perceived 'summons' pauses.
vi.mock('@coulee/play', () => ({
  perceivedEvents: (events: Array<{ kind: string }>) => events,
  alertForEvent: (_w: unknown, _c: unknown, _pc: number, e: { id: number; kind: string }) => ({
    category: e.kind === 'test.summons' ? 'summons' : 'notable',
    reason: e.kind,
    score: 0,
    eventId: e.id,
    pause: e.kind === 'test.summons',
  }),
  provisionsAlert: () => null,
}));

describe('worker protocol execution', () => {
  let messages: FromWorker[];
  let worker: {
    onmessage: ((event: { data: ToWorker }) => Promise<void>) | null;
    postMessage: (message: FromWorker) => void;
  };
  const send = async (data: ToWorker) => {
    await worker.onmessage?.({ data });
  };
  const snapshots = () => messages.filter((m) => m.type === 'snapshot');
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    core.nextEvents = [];
    messages = [];
    worker = { onmessage: null, postMessage: (m) => messages.push(m) };
    vi.stubGlobal('self', worker);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          meta: { hash: 'test' },
          scenarios: {},
          items: {},
          activities: {},
          interactions: {},
          needs: {},
        }),
      })),
    );
    await import('./sim.worker.ts');
    await send({ type: 'init', scenarioId: 'iron_ford', seed: 42, withPlayer: true });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it('queues a UI Command without mutating, then applies it exactly once at the next hour', async () => {
    const command = {
      kind: 'core.urge' as const,
      actorId: 7 as never,
      data: { urge: { kind: 'activity' as const, activityId: 'sleep' } },
    };
    await send({ type: 'command', command });
    expect(core.step).not.toHaveBeenCalled();
    expect(messages.at(-1)).toMatchObject({ type: 'snapshot', pending: 1, stepped: 0 });
    await send({ type: 'step', hours: 2 });
    expect(core.step.mock.calls.map((c) => c[1])).toEqual([[command], []]);
    expect(snapshots().at(-1)).toMatchObject({ pending: 0, stepped: 2, patch: { time: { t: 120 } } });
  });
  it('posts the whole view model once, then only the slices that changed', async () => {
    expect(snapshots()[0]).toMatchObject({ vm: { time: { t: 0 } } });
    await send({ type: 'step', hours: 1 });
    const patch = snapshots().at(-1);
    expect(patch?.type === 'snapshot' && patch.vm).toBeFalsy();
    // The actor row changed (its `t`), the place did not: only the actor travels.
    expect(patch).toMatchObject({ patch: { actorIds: [7], actors: [{ id: 7, t: 60 }], placeIds: [1], places: [] } });
    // A perspective change resends everything.
    await send({ type: 'set_view', options: { omniscient: true } });
    expect(snapshots().at(-1)).toMatchObject({ vm: { time: { t: 60 } } });
  });
  it('each speed advances the same hourly system; pause stops it', async () => {
    for (const [speed, ms] of [
      ['x1', 40_000],
      ['x2', 20_000],
      ['x3', 13_350],
      ['ultra', 500],
    ] as const) {
      core.step.mockClear();
      await send({ type: 'set_speed', speed });
      await vi.advanceTimersByTimeAsync(ms + 50);
      expect(core.step).toHaveBeenCalled();
      await send({ type: 'set_speed', speed: 'paused' });
      core.step.mockClear();
      await vi.advanceTimersByTimeAsync(1000);
      expect(core.step).not.toHaveBeenCalled();
    }
  });
  it('reports display-only progress through the hour while running', async () => {
    await send({ type: 'set_speed', speed: 'x1' });
    await vi.advanceTimersByTimeAsync(10_050);
    const progress = messages.filter((m) => m.type === 'progress');
    expect(progress.length).toBeGreaterThan(10);
    const last = progress.at(-1);
    expect(last?.type === 'progress' && last.frac).toBeGreaterThan(0.2);
    expect(core.step).not.toHaveBeenCalled();
  });
  it('auto-pauses on a perceived summons: stops mid-Ultra and reports why (ADR 0002 §3)', async () => {
    core.nextEvents = [{ kind: 'test.summons', data: {} }];
    await send({ type: 'set_speed', speed: 'ultra' });
    await vi.advanceTimersByTimeAsync(3_000);
    // Ultra would have stepped 6 hours in 3 s; the alert stopped it after the first.
    expect(core.step).toHaveBeenCalledTimes(1);
    expect(snapshots().at(-1)).toMatchObject({
      stepped: 1,
      alerts: [{ category: 'summons', reason: 'test.summons', t: 60 }],
    });
  });
  it('readiness is answered by the core API and snapshots preserve player perspective', async () => {
    await send({ type: 'query', id: 12, query: { kind: 'readiness', holder: { actorId: 7 as never } } });
    expect(core.readinessOf).toHaveBeenCalled();
    expect(messages.at(-1)).toMatchObject({
      type: 'query_result',
      id: 12,
      result: { kind: 'readiness', readiness: { daysOfFoodTenths: 24, warnings: ['Bring a kettle'] } },
    });
    expect(core.toViewModel.mock.calls[0]?.[2]).toMatchObject({
      perspective: 7,
      omniscient: false,
      includeExplain: true,
    });
  });
});
