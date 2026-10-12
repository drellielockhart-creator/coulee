/**
 * ADR 0002 §3 parity, with real content: the web worker's auto-pause and a headless `wait`
 * stop on the same events. Both run the same seed-42 Iron Ford session; the worker lets the
 * clock run hour by hour, headless waits an hour at a time, and the pausing alerts must match
 * one for one.
 */
import { loadContentOrThrow } from '@coulee/content';
import { PlaySession, type SessionSpec } from '@coulee/play';
import { afterEach, expect, it, vi } from 'vitest';
import type { FromWorker, ToWorker } from './protocol.ts';

afterEach(() => vi.unstubAllGlobals());

it('pocket auto-pause and headless wait stop on the same perceived events', async () => {
  const base = loadContentOrThrow();
  const spec: SessionSpec = { source: 'iron_ford', seed: 42 };
  const HOURS = 30;

  // Headless: wait an hour at a time, recording every pausing interrupt and when it fired.
  const session = PlaySession.create(base, spec);
  const headless: string[] = [];
  for (let h = 0; h < HOURS; h++) {
    const r = session.advance(60);
    for (const i of r.interrupts) headless.push(`${r.observation.time.t} ${i.category} ${i.reason} ${i.eventId ?? ''}`);
  }

  // Worker: the real module, real core and its own PlaySession, fed the same base content.
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
  await send({ type: 'init', scenarioId: 'iron_ford', seed: spec.seed, withPlayer: true });
  const pocket: string[] = [];
  for (let h = 0; h < HOURS; h++) {
    const before = messages.length;
    await send({ type: 'step', hours: 1 });
    for (const m of messages.slice(before))
      if (m.type === 'snapshot')
        for (const a of m.alerts ?? []) pocket.push(`${a.t} ${a.category} ${a.reason} ${a.eventId ?? ''}`);
  }
  expect(messages.some((m) => m.type === 'error')).toBe(false);
  expect(headless.length).toBeGreaterThan(0);
  expect(pocket).toEqual(headless);
});
