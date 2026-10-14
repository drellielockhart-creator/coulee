/** E1: the worker's dialogue panel has the same per-command exchanges as headless play. */
import { loadContentOrThrow } from '@coulee/content';
import { PlaySession, parseText } from '@coulee/play';
import { afterEach, expect, it, vi } from 'vitest';
import type { FromWorker, PlayState, ToWorker } from './protocol.ts';

afterEach(() => vi.unstubAllGlobals());
it('Socialite short chat chains replace the web dialogue with the newest command’s lines', async () => {
  const base = loadContentOrThrow(['base']);
  const session = PlaySession.create(base, { source: 'gen:town', seed: 7 });
  // As in play-ux-r3: start at 08:00 so the chain crosses into 09:00 before the Kvales leave for church.
  while (session.observe().time.t < 480) session.advance(60);
  const messages: FromWorker[] = [];
  const self = {
    onmessage: null as ((e: { data: ToWorker }) => Promise<void>) | null,
    postMessage: (m: FromWorker) => messages.push(m),
  };
  vi.stubGlobal('self', self);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => base })),
  );
  vi.resetModules();
  await import('./sim.worker.ts');
  const send = async (data: ToWorker) => self.onmessage?.({ data });
  const play = (): PlayState => {
    const m = messages.findLast((m) => m.type === 'play');
    if (m?.type !== 'play') throw new Error('No worker play state');
    return m.play;
  };
  await send({ type: 'init', scenarioId: 'iron_ford', seed: 7, withPlayer: true, save: session.save() });
  const seen = new Set<number>();
  let id = 0;
  for (const line of [
    'go 22',
    'talk:introduce:1',
    'talk:introduce:2',
    'talk:ask_about:1',
    "go Kvale's Smithy",
    'talk:introduce:7',
    'talk:ask_about:7',
    'talk:chat:7',
  ]) {
    const command = parseText(line, session.observe());
    if (typeof command === 'string') throw new Error(command);
    const headless = session.act(command);
    expect(headless.ok, headless.reason).toBe(true);
    await send({ type: 'command', command, id: ++id, label: line });
    const web = play();
    expect(web.observation.said).toEqual(headless.observation.said);
    expect(web.digest.said).toEqual(headless.observation.said);
    for (const e of web.digest.said) {
      expect(seen.has(e.id), line).toBe(false);
      seen.add(e.id);
    }
  }
  expect(play().digest.said.some((e) => e.hearerId === 7 || e.speakerId === 7)).toBe(true);
});
