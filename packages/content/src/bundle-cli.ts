/** `pnpm -C packages/content run bundle [mods...]` -> dist/content-bundle.json */
import { relative } from 'node:path';
import { BUNDLE_PATH, CONTENT_ROOT, formatIssues, loadContent, REPO_ROOT, writeBundle } from './index.ts';

const mods = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const res = loadContent(CONTENT_ROOT, mods.length > 0 ? mods : ['base']);
if (!res.bundle) {
  console.error(`content invalid (${res.issues.length} issue(s)):\n${formatIssues(res.issues)}`);
  process.exit(1);
}
writeBundle(res.bundle);
console.log(
  `bundled ${res.files.length} files -> ${relative(REPO_ROOT, BUNDLE_PATH)} (hash ${res.bundle.meta.hash.slice(0, 12)})`,
);
