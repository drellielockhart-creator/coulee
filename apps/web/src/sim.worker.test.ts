import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FromWorker, ToWorker } from './protocol.ts';

/** A stand-in PlaySession: the worker's contract with @coulee/play, without a world. */
const play = vi.hoisted(() => {
  type Cmd = { kind: string; actorId?: number; data?: Record<string, unknown> };
  const state = {
    time: 0,
    log: [] as Cmd[],
    modes: [] as string[],
    /** Interrupts the next time-taking act raises (tests set this to force an auto-pause). */
    nextInterrupts: [] as Array<{ category: string; reason: string; score: number; eventId?: number; pause: true }>,
  };
  const observation = (mode: string) => ({
    time: { t: state.time, hour: (state.time / 60) % 24, minute: 0, stamp: `t${state.time}` },
    mode,
    ending: null,
    place: { id: 1, name: 'Store' },
    events: [{ id: state.time + 1, t: state.time, kind: 'x', summary: `hour ${state.time / 60}`, explain: null }],
    said: [],
    changes: { elapsed: 60, money: [], needs: [], events: [], skipped: 0 },
    actions: [
      { id: 'wait', label: 'Wait 1 hour', command: { kind: 'activity.wait', actorId: 7, data: { minutes: 60 } } },
    ],
    truth: { huge: true },
  });
  class FakeSession {
    static create = (() => new FakeSession()) as (...a: unknown[]) => FakeSession;
    static load = ((_content: unknown, json: string) => {
      if (json === 'BAD') throw new Error('Save format/content mismatch');
      return new FakeSession();
    }) as (...a: unknown[]) => FakeSession;
    playerId = 7;
    sim = { world: { time: 0 }, content: { items: {}, activities: {}, interactions: {} } };
    get hash() {
      return `h${state.time}`;
    }
    get commandLog() {
      return [{ type: 'session' }, ...state.log.map((command) => ({ type: 'command', command }))];
    }
    observe(mode = 'fair') {
      return observation(mode);
    }
    save() {
      return 'SAVED';
    }
    act(command: Cmd, mode = 'fair') {
      state.modes.push(mode);
      if (command.kind === 'refused')
        return { ok: false, reason: 'Not here', elapsedMinutes: 0, interrupts: [], observation: observation(mode) };
      state.log.push(command);
      const takes = command.kind === 'activity.observe' ? 0 : 60;
      state.time += takes;
      this.sim.world.time = state.time;
      return {
        ok: true,
        elapsedMinutes: takes,
        interrupts: takes ? state.nextInterrupts.splice(0) : [],
        observation: observation(mode),
        ...(command.kind === 'activity.observe' ? { detail: [{ text: 'an entry' }] } : {}),
      };
    }
    advance(minutes: number, mode = 'fair') {
      return this.act({ kind: 'activity.wait', actorId: 7, data: { minutes } }, mode);
    }
  }
  return { state, FakeSession };
});

const core = vi.hoisted(() => ({
  toViewModel: vi.fn((world: { time: number }, _content: unknown, options: unknown) => ({
    time: { t: world.time },
    actors: [{ id: 7, name: 'Ada North', t: world.time }],
    places: [{ id: 1, name: 'Store' }],
    options,
  })),
  readinessOf: vi.fn(() => ({ daysOfFoodTenths: 24, daysOfFuelTenths: null, warnings: ['Bring a kettle'] })),
}));
vi.mock('@coulee/core', () => ({
  DEFAULT_VIEW_OPTIONS: { omniscient: false, perspective: null },
  toViewModel: core.toViewModel,
  provisions: { readinessOf: core.readinessOf },
  timeView: (t: number) => ({ stamp: `t${t}` }),
}));
vi.mock('@coulee/play', () => ({
  PlaySession: play.FakeSession,
  sessionSimOf: (s: { sim: unknown }) => s.sim,
  sessionKnowledgeOf: () => [],
  playViewModel: core.toViewModel,
  // The REPL grammar, reduced: "wait Nh" or a refusal in words.
  parseText: (text: string) => {
    const m = /^wait (\d+)h$/.exec(text);
    return m ? { kind: 'activity.wait', actorId: 7, data: { minutes: Number(m[1]) * 60 } } : 'Use wait 8h';
  },
  renderDetail: () => 'an entry',
  renderInterrupts: () => [],
  storefront: () => null,
  tradePreview: () => null,
  foodLedger: () => null,
}));

describe('worker protocol over a PlaySession', () => {
  let messages: FromWorker[];
  let worker: {
    onmessage: ((event: { data: ToWorker }) => Promise<void>) | null;
    postMessage: (message: FromWorker) => void;
  };
  const send = async (data: ToWorker) => {
    await worker.onmessage?.({ data });
  };
  const snapshots = () => messages.filter((m) => m.type === 'snapshot');
  const lastPlay = () => {
    const m = messages.findLast((x) => x.type === 'play');
    return m?.type === 'play' ? m.play : null;
  };
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    play.state.time = 0;
    play.state.log = [];
    play.state.modes = [];
    play.state.nextInterrupts = [];
    messages = [];
    worker = { onmessage: null, postMessage: (m) => messages.push(m) };
    vi.stubGlobal('self', worker);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ meta: { hash: 'test' }, scenarios: {} }) })),
    );
    await import('./sim.worker.ts');
    await send({ type: 'init', scenarioId: 'iron_ford', seed: 42, withPlayer: true });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it('an order goes through the session at once; a refusal costs nothing and says why', async () => {
    const command = { kind: 'core.urge', actorId: 7, data: { urge: { kind: 'activity', activityId: 'sleep' } } };
    await send({ type: 'command', command: command as never, id: 1, label: 'Sleep' });
    expect(play.state.log).toEqual([command]);
    expect(messages.find((m) => m.type === 'acted')).toMatchObject({ id: 1, outcome: { ok: true, label: 'Sleep' } });
    expect(lastPlay()?.observation.time.t).toBe(60);
    expect(lastPlay()?.steps).toBe(1);
    // The god-only bulk never travels to the play panels.
    expect(JSON.stringify(lastPlay()?.observation)).not.toContain('huge');
    await send({ type: 'command', command: { kind: 'refused' } as never, id: 2, label: 'Buy' });
    expect(messages.findLast((m) => m.type === 'acted')).toMatchObject({
      id: 2,
      outcome: { ok: false, reason: 'Not here', elapsedMinutes: 0 },
    });
    expect(play.state.log).toHaveLength(1);
    expect(lastPlay()?.last).toMatchObject({ ok: false, reason: 'Not here' });
  });
  it('a time-taking order starts a fresh "since your last order" digest; the clock adds to it', async () => {
    await send({ type: 'step', hours: 2 });
    expect(lastPlay()?.digest.elapsed).toBe(120);
    await send({ type: 'command', command: { kind: 'core.urge', actorId: 7 } as never, id: 3, label: 'Go' });
    expect(lastPlay()?.digest).toMatchObject({ from: 120, elapsed: 60 });
    await send({ type: 'step', hours: 1 });
    expect(lastPlay()?.digest).toMatchObject({ from: 120, elapsed: 120 });
    await send({ type: 'seen' });
    expect(lastPlay()?.digest.elapsed).toBe(0);
  });
  it('a quiet read keeps the last outcome and sends no new view model', async () => {
    await send({ type: 'command', command: { kind: 'core.urge', actorId: 7 } as never, id: 4, label: 'Go' });
    const before = snapshots().length;
    await send({
      type: 'command',
      command: { kind: 'activity.observe', actorId: 7 } as never,
      id: 5,
      label: 'Journal',
    });
    expect(messages.findLast((m) => m.type === 'acted')).toMatchObject({
      id: 5,
      outcome: { detail: [{ text: 'an entry' }] },
    });
    expect(lastPlay()?.last?.label).toBe('Go');
    expect(snapshots()).toHaveLength(before);
  });
  it('wait phrases use the REPL grammar; one it cannot read is a refusal', async () => {
    await send({ type: 'wait', text: 'wait 3h', id: 6 });
    expect(play.state.log.at(-1)).toMatchObject({ kind: 'activity.wait', data: { minutes: 180 } });
    await send({ type: 'wait', text: 'wait for Godot', id: 7 });
    expect(messages.findLast((m) => m.type === 'acted')).toMatchObject({
      id: 7,
      outcome: { ok: false, reason: 'Use wait 8h' },
    });
  });
  it('posts the whole view model once, then only the slices that changed', async () => {
    expect(snapshots()[0]).toMatchObject({ vm: { time: { t: 0 } } });
    await send({ type: 'step', hours: 1 });
    const patch = snapshots().at(-1);
    expect(patch?.type === 'snapshot' && patch.vm).toBeFalsy();
    expect(patch).toMatchObject({ patch: { actorIds: [7], actors: [{ id: 7, t: 60 }], placeIds: [1], places: [] } });
    // God view resends everything and switches the observation mode (ADR 0002 §2).
    await send({ type: 'set_view', options: { omniscient: true, perspective: null } });
    expect(snapshots().at(-1)).toMatchObject({ vm: { time: { t: 60 } } });
    expect(lastPlay()?.mode).toBe('god');
    await send({ type: 'step', hours: 1 });
    expect(play.state.modes.at(-1)).toBe('god');
  });
  it('each speed advances the session an hour at a time; pause stops it', async () => {
    for (const [speed, ms] of [
      ['x1', 40_000],
      ['x2', 20_000],
      ['x3', 13_350],
      ['ultra', 500],
    ] as const) {
      const before = play.state.log.length;
      await send({ type: 'set_speed', speed });
      await vi.advanceTimersByTimeAsync(ms + 50);
      expect(play.state.log.length).toBeGreaterThan(before);
      expect(play.state.log.at(-1)).toMatchObject({ kind: 'activity.wait', data: { minutes: 60 } });
      await send({ type: 'set_speed', speed: 'paused' });
      const paused = play.state.log.length;
      await vi.advanceTimersByTimeAsync(1000);
      expect(play.state.log.length).toBe(paused);
    }
  });
  it('reports display-only progress through the hour while running', async () => {
    await send({ type: 'set_speed', speed: 'x1' });
    await vi.advanceTimersByTimeAsync(10_050);
    const progress = messages.filter((m) => m.type === 'progress');
    expect(progress.length).toBeGreaterThan(10);
    const last = progress.at(-1);
    expect(last?.type === 'progress' && last.frac).toBeGreaterThan(0.2);
    expect(play.state.log).toHaveLength(0);
  });
  it('auto-pauses on a session interrupt: stops mid-Ultra and reports why (ADR 0002 §3)', async () => {
    play.state.nextInterrupts = [
      { category: 'summons', reason: 'Gussie Pratt turns to you', score: 400, eventId: 9, pause: true },
    ];
    await send({ type: 'set_speed', speed: 'ultra' });
    await vi.advanceTimersByTimeAsync(3_000);
    // Ultra would have run 6 hours in 3 s; the interrupt stopped it after the first.
    expect(play.state.log).toHaveLength(1);
    expect(snapshots().at(-1)).toMatchObject({
      stepped: 1,
      alerts: [{ category: 'summons', text: 'Gussie Pratt turns to you', t: 60 }],
    });
  });
  it('answers queries: readiness from core, the save and the replay log from the session', async () => {
    await send({ type: 'query', id: 12, query: { kind: 'readiness', holder: { actorId: 7 as never } } });
    expect(core.readinessOf).toHaveBeenCalled();
    expect(messages.at(-1)).toMatchObject({
      type: 'query_result',
      id: 12,
      result: { kind: 'readiness', readiness: { daysOfFoodTenths: 24, warnings: ['Bring a kettle'] } },
    });
    await send({ type: 'step', hours: 1 });
    await send({ type: 'query', id: 13, query: { kind: 'save' } });
    expect(messages.at(-1)).toMatchObject({ result: { kind: 'save', json: 'SAVED', stamp: 't60' } });
    await send({ type: 'query', id: 14, query: { kind: 'log' } });
    expect(messages.at(-1)).toMatchObject({ result: { kind: 'log', hash: 'h60' } });
    expect(core.toViewModel.mock.calls[0]?.[2]).toMatchObject({
      perspective: 7,
      omniscient: false,
      includeExplain: true,
    });
  });
  it('another household’s larder is not answered in fair play; God view sees it (P1)', async () => {
    await send({ type: 'query', id: 21, query: { kind: 'readiness', holder: { actorId: 99 as never } } });
    expect(core.readinessOf).not.toHaveBeenCalled();
    expect(messages.at(-1)).toMatchObject({
      result: { kind: 'readiness', readiness: { warnings: ['These provisions are not known to your character.'] } },
    });
    await send({ type: 'set_view', options: { omniscient: true, perspective: null } });
    await send({ type: 'query', id: 22, query: { kind: 'readiness', holder: { actorId: 99 as never } } });
    expect(core.readinessOf).toHaveBeenCalled();
  });
  it('a read keeps the running hour’s progress; an order that took its hour starts it afresh', async () => {
    await send({ type: 'set_speed', speed: 'x1' });
    await vi.advanceTimersByTimeAsync(20_050);
    const frac = () => {
      const m = messages.findLast((x) => x.type === 'progress');
      return m?.type === 'progress' ? m.frac : 0;
    };
    expect(frac()).toBeGreaterThan(0.45);
    await send({
      type: 'command',
      command: { kind: 'activity.observe', actorId: 7 } as never,
      id: 30,
      label: 'Journal',
    });
    await vi.advanceTimersByTimeAsync(400);
    expect(frac()).toBeGreaterThan(0.45);
    await send({ type: 'command', command: { kind: 'core.urge', actorId: 7 } as never, id: 31, label: 'Go' });
    await vi.advanceTimersByTimeAsync(400);
    expect(frac()).toBeLessThan(0.1);
  });
  it('tells the UI whenever it stops its own clock, even when no dispatch is shown', async () => {
    const pauses = () => messages.filter((m) => m.type === 'paused').length;
    const before = pauses();
    // Her own arrival: the policy pauses the clock, but the order's outcome already says it.
    play.state.nextInterrupts = [{ category: 'arrival', reason: 'You arrive at the store', score: 250, pause: true }];
    await send({ type: 'command', command: { kind: 'core.urge', actorId: 7 } as never, id: 40, label: 'Go' });
    expect(pauses()).toBe(before + 1);
    expect(snapshots().at(-1)).not.toHaveProperty('alerts');
  });
  it('a save that will not load is refused, and the running session carries on', async () => {
    await send({ type: 'step', hours: 2 });
    await send({ type: 'init', scenarioId: 'iron_ford', seed: 42, withPlayer: true, save: 'BAD' });
    expect(messages.at(-1)).toMatchObject({ type: 'load_failed', message: 'Save format/content mismatch' });
    expect(messages.some((m) => m.type === 'error')).toBe(false);
    await send({ type: 'step', hours: 1 });
    expect(lastPlay()?.observation.time.t).toBe(180);
  });
});
