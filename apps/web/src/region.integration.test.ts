/** The real worker must post only geography in the PC's fair observation. */
import { loadContentOrThrow } from '@coulee/content';
import { PlaySession, sessionSimOf } from '@coulee/play';
import { afterEach, expect, it, vi } from 'vitest';
import type { FromWorker, PlayState, ToWorker } from './protocol.ts';

afterEach(() => vi.unstubAllGlobals());

async function workerFor(save?: string) {
  const content = loadContentOrThrow(['base']);
  const messages: FromWorker[] = [];
  const worker = {
    onmessage: null as ((e: { data: ToWorker }) => Promise<void>) | null,
    postMessage: (m: FromWorker) => messages.push(structuredClone(m)),
  };
  vi.stubGlobal('self', worker);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => content })),
  );
  vi.resetModules();
  await import('./sim.worker.ts');
  const send = async (data: ToWorker) => worker.onmessage?.({ data });
  await send({
    type: 'init',
    scenarioId: 'iron_ford_neighbors',
    seed: 42,
    withPlayer: true,
    ...(save ? { save } : {}),
  });
  const play = (): PlayState => {
    const m = messages.findLast((m) => m.type === 'play');
    if (m?.type !== 'play') throw new Error(`No worker play payload: ${JSON.stringify(messages)}`);
    return m.play;
  };
  return { messages, send, play, content };
}

it('excludes hidden sites and their unknown roads from the entire fair worker payload', async () => {
  const content = loadContentOrThrow(['base']);
  const session = PlaySession.create(content, { source: 'iron_ford_neighbors', seed: 42 });
  const { world } = sessionSimOf(session);
  if (!world.region) throw new Error('No fixture region');
  world.region.knownNodes[session.playerId] = ['iron_ford'];
  const { messages, play } = await workerFor(session.save());
  expect(messages.some((m) => m.type === 'error')).toBe(false);
  const region = play().observation.region;
  expect(region?.destinations.map((n) => n.id)).toEqual(['iron_ford']);
  expect(region?.map?.sites.map((n) => n.id)).toEqual(['iron_ford']);
  expect(region?.map?.roads).toEqual([]);
  const payload = JSON.stringify(messages.filter((m) => m.type === 'play' || m.type === 'snapshot'));
  for (const hidden of ['cedar_farm', 'Cedar Farm', 'cedar_ridge', 'Cedar Ridge Road'])
    expect(payload).not.toContain(hidden);
});

it('posts fair leg progress and direction through departure, stop and turn-back, with headless replay parity', async () => {
  const { messages, send, play, content } = await workerFor();
  const map = () => play().observation.region?.map;
  expect(map()?.sites).toHaveLength(2);
  expect(map()?.roads).toHaveLength(1);
  const act = async (id: string) => {
    const action = play().observation.actions.find((a) => a.id === id);
    if (!action) throw new Error(`Not offered: ${id}`);
    await send({ type: 'command', command: action.command, label: action.label, id: messages.length });
    const result = messages.findLast((m) => m.type === 'acted');
    expect(result?.type === 'acted' && result.outcome.ok).toBe(true);
  };
  await act('route:cedar_farm');
  expect(play().last?.routePreview).toMatchObject({
    nodeId: 'cedar_farm',
    destination: 'Cedar Farm',
    distanceFt: 60000,
    legs: [{ from: 'Iron Ford', to: 'Cedar Farm', name: 'Cedar Ridge Road' }],
    checks: [{ id: 'food' }, { id: 'water' }, { id: 'warmth' }, { id: 'load' }, { id: 'light' }],
  });
  expect(play().observation.time.t).toBe(0);
  await act('travel:cedar_farm');
  await send({ type: 'step', hours: 1 });
  const outbound = map()?.position;
  expect(outbound?.direction).toBe('ab');
  expect(outbound?.towardNodeId).toBe('cedar_farm');
  expect(outbound?.progressPermille).toBeGreaterThan(0);
  expect(outbound?.progressPermille).toBeLessThan(1000);
  await act('journey:stop');
  expect(map()?.position?.status).toBe('stopped');
  await act('journey:turn_back');
  expect(map()?.position?.direction).toBe('ba');
  expect(map()?.position?.towardNodeId).toBe('iron_ford');
  await send({ type: 'query', id: 999, query: { kind: 'log' } });
  const exported = messages.findLast((m) => m.type === 'query_result');
  if (exported?.type !== 'query_result' || exported.result.kind !== 'log') throw new Error('No replay log');
  expect(PlaySession.replay(content, exported.result.log).hash).toBe(exported.result.hash);
});
