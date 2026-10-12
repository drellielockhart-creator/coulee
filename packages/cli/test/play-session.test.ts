import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stateHash } from '@coulee/core';
import { type AvailableAction, PlaySession, parseText, type ReplayLog } from '@coulee/play';
import { afterEach, describe, expect, it } from 'vitest';
import { baseContent } from './helpers.ts';

const temporary: string[] = [];
function directory() {
  const dir = mkdtempSync(join(tmpdir(), 'coulee-session-'));
  temporary.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function cli(...args: string[]) {
  // File descriptors also work in sandboxes that restrict child-process pipes.
  const capture = directory();
  const stdout = openSync(join(capture, 'stdout'), 'w');
  const stderr = openSync(join(capture, 'stderr'), 'w');
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'packages/cli/src/main.ts', 'play', ...args], {
    stdio: ['ignore', stdout, stderr],
    timeout: 120000,
  });
  closeSync(stdout);
  closeSync(stderr);
  expect(result.error).toBeUndefined();
  return { code: result.status, out: read(capture, 'stdout'), err: read(capture, 'stderr') };
}
function ok(...args: string[]) {
  const result = cli(...args);
  expect(result.code, result.err || result.out).toBe(0);
  return result.out;
}
const read = (dir: string, file: string) => readFileSync(join(dir, file), 'utf8');
const saved = (dir: string) => JSON.parse(read(dir, 'save.json'));
const log = (dir: string) =>
  read(dir, 'commands.jsonl')
    .trim()
    .split('\n')
    .map((row) => JSON.parse(row)) as ReplayLog;

describe('stateless play CLI (a new process per call)', () => {
  it('matches text commands and --replay, persists files, and verifies all hashes', () => {
    const dir = directory();
    const first = ok('--session', dir, '--new', '--seed', '42');
    expect(first).toContain('FAIR');
    expect(JSON.parse(read(dir, 'session.json'))).toMatchObject({
      format: 1,
      mode: 'fair',
      spec: { source: 'iron_ford', seed: 42, pc: { name: 'Ellis Wayfarer', kit: 'newcomer', lodging: 'tavern' } },
    });
    const reference = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
    for (const line of [
      ...Array.from({ length: 6 }, () => 'wait 1h'),
      'go Pratt',
      'wait 1h', // Carrying the newcomer kit slows this trip.
      'buy hardtack 3',
      'eat hardtack',
      'wait 2h',
      'wait until 08:00',
      'plan',
      'journal',
      'inspect Ellis',
    ]) {
      ok('--session', dir, line);
      const command = parseText(line, reference.observe());
      if (typeof command === 'string') throw new Error(command);
      expect(reference.act(command).ok).toBe(true);
      expect(saved(dir).finalHash).toBe(reference.hash);
    }
    expect(PlaySession.replay(baseContent(), log(dir)).hash).toBe(saved(dir).finalHash);
    const replay = ok('--replay', join(dir, 'commands.jsonl'), '--jsonl');
    expect(JSON.parse(replay)).toEqual(reference.observe());
    expect(ok('--session', dir, '--verify')).toContain(`final hash ${reference.hash}`);
    expect(
      read(dir, 'metrics.jsonl')
        .trim()
        .split('\n')
        .map((row) => JSON.parse(row)),
    ).toEqual(reference.telemetry);
    expect(read(dir, 'transcript.txt')).toContain('> buy hardtack 3\n');
    const before = read(dir, 'save.json');
    expect(ok('--session', dir, '--look')).toContain('FAIR');
    expect(read(dir, 'save.json')).toBe(before);
  }, 120000);

  it('uses the previous paginated menu, including after a rejected command', () => {
    const dir = directory();
    ok('--session', dir, '--new');
    const printed = ok('--session', dir, 'actions 2');
    const menu = saved(dir).cli.menu as AvailableAction[];
    expect(printed).toContain(`1. ${menu[0]?.label} [${menu[0]?.id}]`);
    const before = read(dir, 'save.json');
    const commands = read(dir, 'commands.jsonl');
    for (const line of [
      '99999',
      'definitely-not-a-command',
      'wait nonsense',
      'rations 999',
      'explain 999999',
      'actions 9999',
      'look\nwait 1h',
    ]) {
      const result = cli('--session', dir, line);
      expect(result.code, result.err || result.out).toBe(2);
      expect(result.out).toContain(`1. ${menu[0]?.label} [${menu[0]?.id}]`);
      expect(read(dir, 'save.json')).toBe(before);
      expect(read(dir, 'commands.jsonl')).toBe(commands);
    }
    ok('--session', dir, '1');
    expect(log(dir).at(-1)).toMatchObject({ command: menu[0]?.command });
    expect(saved(dir).cli.page).toBe(0);
    expect(ok('--session', dir, '--verify')).toContain('Verified');
    expect(ok('--session', dir, 'help')).toContain('queries take no time');
  }, 120000);

  it('copies the entire session and menu, then lets the fork diverge independently', () => {
    const dir = directory();
    const fork = join(directory(), 'branch');
    ok('--session', dir, '--new');
    ok('--session', dir, 'go Pratt');
    ok('--session', dir, 'actions 2');
    ok('--session', dir, '--fork', fork);
    for (const file of ['session.json', 'save.json', 'commands.jsonl', 'metrics.jsonl', 'transcript.txt'])
      expect(read(fork, file)).toBe(read(dir, file));
    const original = read(dir, 'save.json');
    const priorMenu = saved(fork).cli.menu as AvailableAction[];
    ok('--session', fork, '1');
    expect(log(fork).at(-1)).toMatchObject({ command: priorMenu[0]?.command });
    ok('--session', fork, 'rations 75');
    expect(read(dir, 'save.json')).toBe(original);
    expect(saved(fork).finalHash).not.toBe(saved(dir).finalHash);
    expect(ok('--session', fork, '--verify')).toContain('Verified');
    expect(cli('--session', dir, '--fork', fork).code).toBe(2);
    expect(cli('--session', dir, '--new').code).toBe(2);
  }, 120000);

  it('verifies god-only explanations and reports corrupted saves as short internal errors', () => {
    const dir = directory();
    ok('--session', dir, '--new', '--god');
    ok('--session', dir, 'wait 1h');
    const session = PlaySession.load(baseContent(), read(dir, 'save.json'));
    const known = new Set(saved(dir).known);
    const event = saved(dir).world.log.events.find(
      (e: { id: number; explain?: unknown }) => e.explain && !known.has(e.id),
    );
    expect(event).toBeDefined();
    ok('--session', dir, `explain ${event.id}`);
    expect(ok('--session', dir, '--look')).toContain('GOD');
    expect(ok('--session', dir, '--verify')).toContain('Verified');
    expect(JSON.parse(ok('--replay', join(dir, 'commands.jsonl'), '--god', '--jsonl')).mode).toBe('god');
    const data = saved(dir);
    data.world.time += 60;
    data.finalHash = stateHash(data.world);
    writeFileSync(join(dir, 'save.json'), JSON.stringify(data));
    const failed = cli('--session', dir, '--verify');
    expect(failed.code).toBe(1);
    expect(failed.err).toContain('Verification failed');
    expect(failed.err).not.toContain(' at ');
    expect(session.hash).not.toBe(data.finalHash);
  }, 120000);

  it('persists generated content for fast loading and accepts independent world seeds', () => {
    const dir = directory();
    ok('--session', dir, '--new', '--scenario', 'gen:town', '--seed', '7', '--world-seed', '9');
    expect(saved(dir).generatedContent).toBeDefined();
    expect(JSON.parse(read(dir, 'session.json')).spec.source.recipe.seed).toBe(9);
    ok('--session', dir, 'plan');
    expect(ok('--session', dir, '--verify')).toContain('Verified 1 commands');
    const data = saved(dir);
    delete data.generatedContent;
    expect(PlaySession.load(baseContent(), JSON.stringify(data)).hash).toBe(data.finalHash);
  }, 120000);
});
