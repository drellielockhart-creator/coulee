import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ActorId, ItemId, PlaceId } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { cmd } from './lib/commands.ts';

const actor = 7 as ActorId;
const target = 8 as ActorId;
const place = 3 as PlaceId;
const item = 9 as ItemId;

describe('ADR 0002 command parity', () => {
  it('activity and social UI orders are universal core urges', () => {
    expect(cmd.doActivity(actor, 'work')).toEqual({
      kind: 'core.urge',
      actorId: actor,
      data: { urge: { kind: 'activity', activityId: 'work' } },
    });
    expect(cmd.doActivity(actor, 'visit', place)).toEqual({
      kind: 'core.urge',
      actorId: actor,
      data: { urge: { kind: 'activity', activityId: 'visit', placeId: place } },
    });
    expect(cmd.interact(actor, 'gossip', target)).toEqual({
      kind: 'core.urge',
      actorId: actor,
      data: { urge: { kind: 'interaction', interactionId: 'gossip', targetId: target } },
    });
  });
  it('provisions orders preserve the CLI command payloads', () => {
    expect(cmd.buy(actor, place, 'beans', 2, true)).toEqual({
      kind: 'provisions.buy',
      actorId: actor,
      data: { placeId: place, defId: 'beans', qty: 2, onCredit: true },
    });
    expect(cmd.eat(actor, item, 'boil', 1)).toEqual({
      kind: 'provisions.eat',
      actorId: actor,
      data: { itemId: item, method: 'boil', servings: 1 },
    });
    expect(cmd.pack(actor, item, 2, null)).toEqual({
      kind: 'provisions.pack',
      actorId: actor,
      data: { itemId: item, qty: 2, intoItemId: null },
    });
    expect(cmd.setRations(actor, null, 75)).toEqual({
      kind: 'provisions.set_rations',
      actorId: actor,
      data: { householdId: null, rationPct: 75 },
    });
  });
  it('only the worker imports simulation runtime code (core, content or the play session)', () => {
    const root = new URL('.', import.meta.url).pathname;
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((f) =>
        f.isDirectory()
          ? files(join(dir, f.name))
          : /\.tsx?$/.test(f.name) && !f.name.includes('.test.') && f.name !== 'sim.worker.ts'
            ? [join(dir, f.name)]
            : [],
      );
    for (const file of files(root)) {
      const source = readFileSync(file, 'utf8');
      const imports = source.matchAll(
        /import\s+(type\s+)?(?:\{[\s\S]*?\}|[\w*][^;\n]*)\s+from\s+['"]@coulee\/(?:core|content|play)[^'"]*['"]/g,
      );
      for (const imported of imports) expect(imported[1], `runtime rules import in ${file}`).toBe('type ');
      expect(source, `dynamic rules import in ${file}`).not.toMatch(/(?:import|require)\s*\(\s*['"]@coulee\//);
    }
    expect(readFileSync(join(root, 'useSim.ts'), 'utf8')).toContain("send({ type: 'command', command: c })");
  });
});
