import { describe, expect, it } from 'vitest';
import { checkFile, codeOnly } from './check-invariants.ts';

const f = '/x/packages/core/src/a.ts';
const whys = (src: string) => checkFile(f, src).map((v) => `${v.line}:${v.why.split(':')[0]}`);

describe('check-invariants', () => {
  it('flags banned APIs with line numbers', () => {
    const src = [
      'const a = 1;',
      'const r = Math.random();',
      'const d = new Date();',
      'const s = Math.sin(1);',
      'const p = 2 ** 3;',
    ].join('\n');
    expect(whys(src)).toEqual([
      '2:Math.random',
      '3:Date',
      '4:transcendental Math differs across JS engines',
      "5:'**' is Math.pow",
    ]);
  });

  it('ignores comments and strings but sees template expressions', () => {
    // biome-ignore-start lint/suspicious/noTemplateCurlyInString: source text under test
    const src = [
      '// Math.random is banned',
      '/* new Date() */',
      "const s = 'performance';",
      'const t = `ok ${Math.random()}`;',
    ].join('\n');
    expect(whys(src)).toEqual(['4:Math.random']);
    expect(codeOnly("'a'\n`b${c}`")).toBe("' '\n` ${c}`");
    // biome-ignore-end lint/suspicious/noTemplateCurlyInString: source text under test
  });

  it('checks imports: no node, only type imports from @coulee/content/schema', () => {
    expect(whys("import { readFileSync } from 'node:fs';")).toEqual(["1:Node module import 'node"]);
    expect(whys("import { z } from 'zod';")).toEqual(["1:runtime import of package 'zod'"]);
    expect(whys("import type { ItemDef } from '@coulee/content/schema';")).toEqual([]);
    expect(whys("import type {\n  ItemDef,\n} from '@coulee/content/schema';")).toEqual([]);
    expect(whys("import { x } from './x.ts';")).toEqual([]);
  });

  it('flags host and locale APIs', () => {
    expect(whys('const x = process.env;')).toEqual(['1:host API']);
    expect(whys('const y = n.toLocaleString();')).toEqual([
      '1:locale-dependent formatting/ordering differs across devices',
    ]);
  });
  it('scans worldgen with the same bans while allowing its pure runtime dependencies', () => {
    const file = '/x/packages/worldgen/src/generate.ts';
    expect(checkFile(file, "import { rng } from '@coulee/core';")).toEqual([]);
    expect(checkFile(file, "import { ScenarioSchema } from '@coulee/content/schema';")).toEqual([]);
    for (const source of [
      "import { readFileSync } from 'node:fs';",
      'Math.random();',
      'new Date();',
      'Math.sin(3);',
      '2 ** 3;',
      'fetch("x");',
      'performance.now();',
    ]) {
      expect(checkFile(file, source).length).toBeGreaterThan(0);
    }
    expect(whys("import { rng } from '@coulee/core';").length).toBeGreaterThan(0);
  });
});
