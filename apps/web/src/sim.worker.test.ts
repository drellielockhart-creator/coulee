import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FromWorker, ToWorker } from './protocol.ts';

const core = vi.hoisted(() => ({
  createSim: vi.fn(() => ({ world: { time: 0, meta: { playerId: 7 } } })),
  step: vi.fn((sim: { world: { time: number } }, _commands: unknown[]) => {
    sim.world.time += 60;
  }),
  toViewModel: vi.fn((world: { time: number }, _content: unknown, options: unknown) => ({
    time: { t: world.time },
    options,
  })),
  readinessOf: vi.fn(() => ({ daysOfFoodTenths: 24, warnings: ['Bring a kettle'] })),
}));
vi.mock('@coulee/core', () => ({
  ...core,
  DEFAULT_VIEW_OPTIONS: { omniscient: false, perspective: null },
  provisions: { readinessOf: core.readinessOf },
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
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    messages = [];
    worker = { onmessage: null, postMessage: (m) => messages.push(m) };
    vi.stubGlobal('self', worker);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ meta: { hash: 'test' }, scenarios: {}, items: {}, activities: {}, interactions: {} }),
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
    expect(messages.at(-1)).toMatchObject({ type: 'snapshot', pending: 0, stepped: 2, vm: { time: { t: 120 } } });
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
