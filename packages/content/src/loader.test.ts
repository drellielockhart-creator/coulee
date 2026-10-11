import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT_ROOT, loadContent } from './index.ts';

let tmp: string | null = null;
afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = null;
});

/** Copy content/base into a temp root and add one extra file. */
function withExtra(rel: string, toml: string) {
  tmp = mkdtempSync(join(tmpdir(), 'coulee-content-'));
  cpSync(join(CONTENT_ROOT, 'base'), join(tmp, 'base'), { recursive: true });
  writeFileSync(join(tmp, 'base', rel), toml);
  return loadContent(tmp, ['base']);
}

describe('content loader', () => {
  it('loads content/base with no issues', () => {
    const res = loadContent(CONTENT_ROOT, ['base']);
    expect(res.issues).toEqual([]);
    expect(res.bundle?.meta.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects unknown fields (strict schemas)', () => {
    const res = withExtra(
      'items/zz_typo.toml',
      '[[item]]\nid = "nail"\nname = "Nail"\nsection = "tools"\nweight_g = 5\nbulk = 0\nvalue_cents = 1\nwieght = 3\n',
    );
    expect(res.bundle).toBeUndefined();
    expect(res.issues.some((i) => i.message.includes('wieght') || i.path === '')).toBe(true);
  });

  it('rejects duplicate ids and bad cross references', () => {
    const dup = withExtra(
      'items/zz_dup.toml',
      '[[item]]\nid = "hardtack"\nname = "x"\nsection = "misc"\nweight_g = 1\nbulk = 0\nvalue_cents = 1\n',
    );
    expect(dup.issues.some((i) => i.message.includes("duplicate items id 'hardtack'"))).toBe(true);
    rmSync(tmp as string, { recursive: true, force: true });
    const bad = withExtra(
      'activities/zz_bad.toml',
      '[[activity]]\nid = "loaf"\nname = "Loaf"\nverb = "loafing"\nat = "anywhere"\nneeds = { boredom = 5 }\n',
    );
    expect(bad.issues.some((i) => i.message.includes("unknown need 'boredom'"))).toBe(true);
  });

  it('rejects a food item without prep and bulk with two decimals', () => {
    const res = withExtra(
      'items/zz_food.toml',
      '[[item]]\nid = "mush"\nname = "Mush"\nsection = "provisions"\nweight_g = 10\nbulk = 0.25\nvalue_cents = 1\n[item.food]\nkcal = 1\nprotein_g = 0\nfat_g = 0\nfresh = 0\ngroup = "grain"\nservings = 1\nshelf_life_days = 1\nprep = []\n',
    );
    const paths = res.issues.map((i) => i.path);
    expect(paths).toContain('bulk');
    expect(paths).toContain('food.prep');
  });
});
