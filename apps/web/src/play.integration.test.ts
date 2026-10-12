/**
 * ADR 0002 UI parity, end to end with real content: a scripted web session (the real worker
 * module, driven by the same messages the UI sends) exports its command log, and that log
 * replays headlessly, exactly as `coulee play --replay commands.jsonl` reads it, to the same
 * state hash at every step.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContentOrThrow } from '@coulee/content';
import { PlaySession, type ReplayLog } from '@coulee/play';
import { afterEach, expect, it, vi } from 'vitest';
import type { ActOutcome, FromWorker, PlayState, QueryResult, ToWorker } from './protocol.ts';

afterEach(() => vi.unstubAllGlobals());

it('a web session’s command log replays headlessly to the same hash', async () => {
  const base = loadContentOrThrow(['base']);
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
  let id = 0;
  const play = (): PlayState => {
    const m = messages.findLast((x) => x.type === 'play');
    if (m?.type !== 'play') throw new Error('no play state posted');
    return m.play;
  };
  const acted = async (data: ToWorker): Promise<ActOutcome> => {
    await send(data);
    const m = messages.findLast((x) => x.type === 'acted');
    if (m?.type !== 'acted') throw new Error('no outcome');
    return m.outcome;
  };
  const ask = async (query: Extract<ToWorker, { type: 'query' }>['query']): Promise<QueryResult> => {
    const qid = ++id;
    await send({ type: 'query', id: qid, query });
    const m = messages.findLast((x) => x.type === 'query_result' && x.id === qid);
    if (m?.type !== 'query_result') throw new Error('no query result');
    return m.result;
  };
  const action = (test: (a: PlayState['observation']['actions'][number]) => boolean) => {
    const a = play().observation.actions.find(test);
    if (!a) throw new Error('action not offered');
    return a;
  };

  await send({ type: 'init', scenarioId: 'iron_ford', seed: 42, withPlayer: true });
  expect(messages.some((m) => m.type === 'error')).toBe(false);
  // The clock runs two hours (two logged one-hour advances).
  await send({ type: 'step', hours: 2 });
  // Wait for the counter to open, through the REPL's own wait grammar; waits stop on interrupts
  // (an arrival, a summons), so ask again until morning, as a player would.
  for (let tries = 0; play().observation.time.hour < 8 && tries < 8; tries++)
    expect((await acted({ type: 'wait', text: 'wait until 08:00', id: ++id })).ok).toBe(true);
  // Walk to the outfitter (the offered move action, as the Go menu sends it).
  const go = action((a) => a.id.startsWith('go:') && /Pratt/.test(a.label));
  expect((await acted({ type: 'command', command: go.command, id: ++id, label: go.label })).ok).toBe(true);
  expect(play().observation.place.name).toMatch(/Pratt/);
  // Buy two of a food the storefront lists, confirming the preview's own Command.
  const front = await ask({ kind: 'storefront' });
  if (front.kind !== 'storefront' || !front.storefront) throw new Error('no storefront at Pratt’s');
  const line = front.storefront.lines.find((l) => l.food && l.actionId && l.maxQty >= 2);
  if (!line) throw new Error('no food to buy');
  const preview = await ask({ kind: 'trade_preview', order: { kind: 'buy', defId: line.defId, qty: 2 } });
  if (preview.kind !== 'trade_preview') throw new Error('no preview');
  expect(preview.preview.ok).toBe(true);
  expect(preview.preview.after.weightG).toBeGreaterThan(preview.preview.before.weightG);
  // Previews run the store's own kernel on a copy: the world is untouched...
  const hashBefore = await ask({ kind: 'log' });
  await ask({ kind: 'trade_preview', order: { kind: 'buy', defId: line.defId, qty: 5, onCredit: true } });
  const hashAfter = await ask({ kind: 'log' });
  if (hashBefore.kind !== 'log' || hashAfter.kind !== 'log') throw new Error('no log');
  expect(hashAfter.hash).toBe(hashBefore.hash);
  expect((await acted({ type: 'command', command: preview.preview.command, id: ++id, label: 'buy' })).ok).toBe(true);
  // ...and the price it quoted is the one the purchase charged.
  const paid = play().digest.money.reduce((n, m) => n + m.purse + m.household, 0);
  expect(paid).toBe(-preview.preview.totalCents);
  // A refused order costs no time and never enters the log.
  const steps = play().steps;
  const refused = await acted({
    type: 'command',
    command: { ...preview.preview.command, data: { ...preview.preview.command.data, qty: 99_999 } } as never,
    id: ++id,
    label: 'too many',
  });
  expect(refused.ok).toBe(false);
  expect(refused.elapsedMinutes).toBe(0);
  expect(play().steps).toBe(steps);
  // Eat, talk if anyone is offered, set rations, read the journal (a zero-time query).
  const eat = action((a) => a.id.startsWith('eat:'));
  expect((await acted({ type: 'command', command: eat.command, id: ++id, label: eat.label })).ok).toBe(true);
  const talk = play().observation.actions.find((a) => a.id.startsWith('talk:'));
  if (talk) await acted({ type: 'command', command: talk.command, id: ++id, label: talk.label });
  const rations = action((a) => a.id === 'rations:75');
  expect((await acted({ type: 'command', command: rations.command, id: ++id, label: rations.label })).ok).toBe(true);
  const journal = action((a) => a.id === 'journal');
  const read = await acted({ type: 'command', command: journal.command, id: ++id, label: 'journal' });
  expect(read.elapsedMinutes).toBe(0);
  expect(Array.isArray(read.detail)).toBe(true);
  await send({ type: 'step', hours: 3 });
  expect(messages.some((m) => m.type === 'error')).toBe(false);

  // Export the log as the Ledger's download does, then replay it as the CLI reads commands.jsonl.
  const exported = await ask({ kind: 'log' });
  if (exported.kind !== 'log') throw new Error('no log');
  const kinds = exported.log.slice(1).map((e) => (e.type === 'command' ? e.command.kind : ''));
  for (const kind of ['activity.wait', 'core.urge', 'provisions.buy', 'provisions.eat', 'activity.observe'])
    expect(kinds).toContain(kind);
  const file = join(mkdtempSync(join(tmpdir(), 'coulee-web-')), 'commands.jsonl');
  writeFileSync(file, `${exported.log.map((x) => JSON.stringify(x)).join('\n')}\n`);
  const log = readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l)) as ReplayLog;
  const replayed = PlaySession.replay(loadContentOrThrow(['base']), log);
  expect(replayed.hash).toBe(exported.hash);
  expect(replayed.observe().time.t).toBe(play().observation.time.t);
});
