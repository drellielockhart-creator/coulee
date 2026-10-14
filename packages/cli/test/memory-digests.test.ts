/**
 * Memory digests are maintained incrementally (social/memory.ts): every write to an owner's
 * memories goes through memory.ts, which folds the change into the cached digests. These tests
 * keep that exact: (1) no file outside memory.ts writes the memory tables or casts them writable,
 * and (2) across a real run (inserts, evictions, daily decay, Sunday consolidation, a save and
 * restore) the cached digests always equal the full scan.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { restoreSim, runHours, type World } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import type { MemoryDigest } from '../../core/src/social/memory.ts';
import { memoryDigests, scanMemoryDigests } from '../../core/src/social/memory.ts';
import { baseContent, simFor } from './helpers.ts';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const SCANNED = ['packages/core/src', 'packages/play/src', 'packages/cli/src', 'packages/cli/test', 'apps/web/src'];
const WRITE_PATH = 'packages/core/src/social/memory.ts';
const SELF = 'packages/cli/test/memory-digests.test.ts';

/** Writes (or writable casts) of `social.memories` / `social.memoriesByOwner` and their rows. */
const FORBIDDEN: Array<{ re: RegExp; why: string }> = [
  { re: /\bmemories(ByOwner)?\s*(\[[^\]]*\])?\s*\)?\s*as\b/, why: 'casts a memory table or row' },
  { re: /\bmemories(ByOwner)?\s*\[[^\]]*\]\s*(=|\?\?=|\|\|=|&&=)(?!=)/, why: 'assigns into a memory table' },
  { re: /\bdelete\s+[\w.?]*\bmemories(ByOwner)?\s*\[/, why: 'deletes from a memory table' },
  {
    re: /\bmemoriesByOwner\s*\[[^\]]*\]\??\.(push|splice|pop|shift|unshift|sort|reverse|fill)\(/,
    why: 'mutates an owner list',
  },
  { re: /\.memories(ByOwner)?\s*=(?!=)/, why: 'replaces a memory table' },
  { re: /as\s+(unknown\s+as\s+)?(Writable|Mutable)<\s*Memory\b/, why: 'casts a Memory writable' },
];

function listSources(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries.sort()) {
    if (e === 'node_modules' || e === 'dist') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...listSources(p));
    else if (/\.(ts|tsx)$/.test(e) && !e.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const norm = (m: ReadonlyMap<number, MemoryDigest>) =>
  [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, d]) => ({
      id,
      done: Object.entries(d.done).sort(),
      did: Object.entries(d.did).sort(),
      negative: d.negative,
    }));

function expectExact(world: World, label: string): number {
  const content = baseContent();
  let owners = 0;
  for (const key of Object.keys(world.social.memoriesByOwner)) {
    const owner = Number(key);
    const cached = norm(memoryDigests(world, content, owner as never));
    const fresh = norm(scanMemoryDigests(world, content, owner as never));
    if (JSON.stringify(cached) !== JSON.stringify(fresh))
      expect({ label, owner, cached }).toEqual({ label, owner, cached: fresh });
    owners++;
  }
  return owners;
}

describe('memory digests', () => {
  it('only social/memory.ts writes the memory tables', () => {
    const hits: string[] = [];
    for (const dir of SCANNED) {
      for (const file of listSources(join(ROOT, dir))) {
        const rel = relative(ROOT, file).replaceAll('\\', '/');
        if (rel === WRITE_PATH || rel === SELF) continue;
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (/^\s*(\/\/|\*)/.test(line)) return;
            for (const f of FORBIDDEN) if (f.re.test(line)) hits.push(`${rel}:${i + 1}: ${f.why}: ${line.trim()}`);
          });
      }
    }
    expect(hits).toEqual([]);
  });

  it('the guard catches the write shapes it names', () => {
    const bad = [
      'world.social.memories[id] = m;',
      'w.social.memoriesByOwner[id] ??= [];',
      'delete world.social.memories[id];',
      'world.social.memoriesByOwner[o]?.push(id);',
      '(world.social.memories as Record<number, Memory>)[id] = m;',
      'const x = m as Writable<Memory>;',
      'world.social.memories = {};',
    ];
    for (const line of bad) expect(FORBIDDEN.some((f) => f.re.test(line))).toBe(true);
    expect(FORBIDDEN.some((f) => f.re.test('const m = world.social.memories[id];'))).toBe(false);
  });

  it('cached digests equal the full scan every hour, across decay, consolidation and a restore', () => {
    // 1855-04-01 is a Sunday: nine days cover eight nightly decays and the Sunday consolidation.
    const sim = simFor({ seed: 42, fullLog: false });
    let checks = 0;
    for (let h = 0; h < 9 * 24; h++) {
      runHours(sim, 1);
      checks += expectExact(sim.world, `hour ${h + 1}`);
    }
    const restored = restoreSim(sim.content, JSON.parse(JSON.stringify(sim.world)));
    for (let h = 0; h < 48; h++) {
      runHours(restored, 1);
      runHours(sim, 1);
      checks += expectExact(restored.world, `restored hour ${h + 1}`);
    }
    expect(JSON.stringify(restored.world.social.memories)).toBe(JSON.stringify(sim.world.social.memories));
    expect(checks).toBeGreaterThan(1000);
  }, 120_000);
});
