/** `pnpm -C packages/content run check` — validate content and print a summary. */
import { CONTENT_ROOT, DOMAINS, formatIssues, loadContent } from './index.ts';

const mods = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const res = loadContent(CONTENT_ROOT, mods.length > 0 ? mods : ['base']);
if (!res.bundle) {
  console.error(`content invalid (${res.issues.length} issue(s)):\n${formatIssues(res.issues)}`);
  process.exit(1);
}
const counts = Object.keys(DOMAINS)
  .map((d) => `${d}=${Object.keys(res.bundle?.[d as keyof typeof DOMAINS] ?? {}).length}`)
  .join(' ');
console.log(`content ok: ${res.files.length} files; ${counts}`);
