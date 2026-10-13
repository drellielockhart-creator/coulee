import { loadContentOrThrow } from '@coulee/content';
import { type Command, instantOf } from '@coulee/core';
import { PlaySession, sessionSimOf } from '@coulee/play';
import { afterEach, expect, it, vi } from 'vitest';
import type { FromWorker, ToWorker } from './protocol.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('real worker and fair headless session stop on danger and recovery at the same exact instant', async () => {
  const content = loadContentOrThrow(['base']);
  const messages: FromWorker[] = [];
  const worker: {
    onmessage: ((event: { data: ToWorker }) => Promise<void>) | null;
    postMessage: (m: FromWorker) => void;
  } = { onmessage: null, postMessage: (m) => messages.push(m) };
  vi.stubGlobal('self', worker);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => content })),
  );
  await import('./sim.worker.ts');
  const send = async (data: ToWorker) => {
    await worker.onmessage?.({ data });
  };
  await send({ type: 'init', scenarioId: 'tavern_instant', seed: 42, withPlayer: true });
  const headless = PlaySession.create(content, { source: 'tavern_instant', seed: 42 });
  const commands: Command[] = [
    { kind: 'activity.wait' as const, actorId: headless.playerId, data: { minutes: 60 } },
    { kind: 'tactical.guard' as const, actorId: headless.playerId, data: {} },
    { kind: 'tactical.advance' as const, actorId: headless.playerId, data: { ticks: 100 } },
  ];
  for (const command of commands) {
    const result = headless.act(command);
    await send({ type: 'command', command });
    const play = messages.findLast((m) => m.type === 'play');
    expect(play?.type).toBe('play');
    if (play?.type === 'play') {
      expect(play.play.observation.tactical).toEqual(result.observation.tactical);
      if (result.interrupts.length) expect(JSON.stringify(play.play)).toContain(result.interrupts[0]?.reason);
    }
    if (result.interrupts.length) expect(messages.some((m) => m.type === 'paused')).toBe(true);
    await send({ type: 'query', id: 99, query: { kind: 'save' } });
    const saved = messages.findLast((m) => m.type === 'query_result');
    if (saved?.type !== 'query_result' || saved.result?.kind !== 'save') throw Error('No worker save');
    const restored = PlaySession.load(content, saved.result.json);
    expect(restored.hash).toBe(headless.hash);
    expect(instantOf(sessionSimOf(restored).world)).toBe(instantOf(sessionSimOf(headless).world));
    expect(PlaySession.replay(content, restored.commandLog).hash).toBe(headless.hash);
  }
}, 30000);
