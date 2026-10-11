/**
 * Node entry for @coulee/content: loader, validator, bundler.
 * Browser code must import from '@coulee/content/schema' (types/schemas) or
 * '@coulee/content/bundle.json' (the built bundle) instead.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatIssues, type LoadResult, loadContent } from './loader.ts';
import type { ContentBundle } from './schema/bundle.ts';

export { canonicalJson, formatIssues, type LoadResult, loadContent } from './loader.ts';
export * from './schema/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
/** Repo root (packages/content/src -> ../../..). */
export const REPO_ROOT = join(here, '..', '..', '..');
export const CONTENT_ROOT = join(REPO_ROOT, 'content');
export const BUNDLE_PATH = join(here, '..', 'dist', 'content-bundle.json');

/** Load and validate, throwing a readable error on any issue. */
export function loadContentOrThrow(mods: readonly string[] = ['base'], root = CONTENT_ROOT): ContentBundle {
  const res: LoadResult = loadContent(root, mods);
  if (!res.bundle) {
    throw new Error(`content has ${res.issues.length} issue(s):\n${formatIssues(res.issues)}`);
  }
  return res.bundle;
}

export function writeBundle(bundle: ContentBundle, path = BUNDLE_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(bundle)}\n`);
}

/** Read a previously written bundle (no validation). */
export function readBundle(path = BUNDLE_PATH): ContentBundle {
  return JSON.parse(readFileSync(path, 'utf8')) as ContentBundle;
}
