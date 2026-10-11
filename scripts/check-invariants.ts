/**
 * Enforces the core invariants of ADR 0001 that the type system cannot:
 * determinism (no ambient randomness, clocks, timers, locale, engine-dependent math) and
 * purity (no Node/DOM APIs, no runtime imports of other packages) in packages/core/src.
 *
 * Usage: tsx scripts/check-invariants.ts [dir...]   (default: packages/core/src)
 * Exits 1 and prints file:line for every violation. Test files (*.test.ts) are exempt.
 * FOUNDATION-OWNED.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

interface Rule {
  re: RegExp;
  why: string;
}

const TRANSCENDENTAL = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'pow',
  'cbrt',
  'hypot',
  'fround',
];

/** Applied to code with comments and string contents blanked out. */
const RULES: Rule[] = [
  { re: /\bMath\.random\b/, why: 'Math.random: use rng(seed, stream, tick, key)' },
  { re: /\bDate\b/, why: 'Date: use GameMinute time (time.ts)' },
  { re: /\bperformance\b/, why: 'performance: no wall clock in core' },
  {
    re: /\b(setTimeout|setInterval|setImmediate|clearTimeout|clearInterval|queueMicrotask|requestAnimationFrame)\b/,
    why: 'timers: core is synchronous and clockless',
  },
  { re: /\bcrypto\b/, why: 'crypto: use rng() / hash.ts' },
  {
    re: new RegExp(`\\bMath\\.(${TRANSCENDENTAL.join('|')})\\b`),
    why: 'transcendental Math differs across JS engines: use integer tables/approximations',
  },
  { re: /\*\*/, why: "'**' is Math.pow: multiply explicitly (x * x)" },
  {
    re: /\b(process|Buffer|require|__dirname|__filename|globalThis|window|document|self|navigator|fetch|localStorage|sessionStorage|indexedDB|XMLHttpRequest|WebSocket|Worker|postMessage)\b/,
    why: 'host API: core has no Node/DOM access',
  },
  {
    re: /\b(Intl|toLocaleString|toLocaleDateString|toLocaleTimeString|localeCompare)\b/,
    why: 'locale-dependent formatting/ordering differs across devices',
  },
  { re: /\bWeakMap\b|\bWeakRef\b|\bFinalizationRegistry\b/, why: 'GC-dependent structures are nondeterministic' },
];

interface Violation {
  file: string;
  line: number;
  why: string;
  text: string;
}

/**
 * Blank out comments and the contents of string/template literals, preserving newlines,
 * so rules only see code. Template `${...}` expressions are kept as code.
 */
export function codeOnly(src: string): string {
  const out: string[] = [];
  let i = 0;
  const n = src.length;
  // Stack of contexts: 'code' (with brace depth) or 'tpl' (inside a template literal).
  const stack: Array<{ kind: 'code'; depth: number } | { kind: 'tpl' }> = [{ kind: 'code', depth: 0 }];
  const blank = (ch: string) => (ch === '\n' ? '\n' : ' ');
  while (i < n) {
    const top = stack[stack.length - 1] as (typeof stack)[number];
    const c = src[i] as string;
    const d = src[i + 1];
    if (top.kind === 'tpl') {
      if (c === '\\') {
        out.push(' ', blank(d ?? ' '));
        i += 2;
      } else if (c === '`') {
        out.push('`');
        stack.pop();
        i++;
      } else if (c === '$' && d === '{') {
        out.push('${');
        stack.push({ kind: 'code', depth: 0 });
        i += 2;
      } else {
        out.push(blank(c));
        i++;
      }
      continue;
    }
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') {
        out.push(' ');
        i++;
      }
    } else if (c === '/' && d === '*') {
      out.push('  ');
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out.push(blank(src[i] as string));
        i++;
      }
      out.push('  ');
      i += 2;
    } else if (c === '"' || c === "'") {
      out.push(c);
      i++;
      while (i < n && src[i] !== c && src[i] !== '\n') {
        if (src[i] === '\\') {
          out.push(' ');
          i++;
        }
        out.push(blank(src[i] ?? ' '));
        i++;
      }
      out.push(c);
      i++;
    } else if (c === '`') {
      out.push('`');
      stack.push({ kind: 'tpl' });
      i++;
    } else if (c === '{') {
      top.depth++;
      out.push(c);
      i++;
    } else if (c === '}') {
      if (top.depth === 0 && stack.length > 1) {
        stack.pop(); // end of ${...}
      } else {
        top.depth--;
      }
      out.push(c);
      i++;
    } else {
      out.push(c);
      i++;
    }
  }
  return out.join('');
}

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...listTs(p));
    else if (e.endsWith('.ts') && !e.endsWith('.test.ts') && !e.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const IMPORT_RE = /^\s*(import|export)\s+(type\s+)?[^'"]*?\bfrom\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/;

export function checkFile(file: string, src: string): Violation[] {
  const rel = relative(ROOT, file);
  const out: Violation[] = [];
  const srcLines = src.split('\n');
  const codeLines = codeOnly(src).split('\n');
  // Multi-line imports: join each import statement onto its first line for the check.
  for (let ln = 0; ln < srcLines.length; ln++) {
    const line = srcLines[ln] as string;
    if (!/^\s*(import|export)\b/.test(line)) continue;
    let stmt = line;
    let k = ln;
    while (!/['"][^'"]+['"]\s*;?\s*$/.test(stmt) && k + 1 < srcLines.length && k - ln < 40) {
      k++;
      stmt += ` ${srcLines[k]}`;
    }
    const m = IMPORT_RE.exec(stmt.replace(/\s+/g, ' '));
    if (!m) continue;
    const typeOnly = m[2] !== undefined;
    const spec = (m[3] ?? m[4]) as string;
    if (
      spec.startsWith('node:') ||
      /^(fs|path|os|crypto|child_process|url|util|worker_threads|perf_hooks)$/.test(spec)
    ) {
      out.push({ file: rel, line: ln + 1, why: `Node module import '${spec}' in core`, text: line.trim() });
    } else if (!spec.startsWith('.') && !typeOnly) {
      out.push({
        file: rel,
        line: ln + 1,
        why: `runtime import of package '${spec}': core may only \`import type\` from packages`,
        text: line.trim(),
      });
    } else if (!spec.startsWith('.') && typeOnly && spec !== '@coulee/content/schema') {
      out.push({
        file: rel,
        line: ln + 1,
        why: `core may only import types from '@coulee/content/schema' (got '${spec}')`,
        text: line.trim(),
      });
    }
  }
  codeLines.forEach((code, idx) => {
    if (/^\s*(import|export)\b.*\bfrom\b/.test(code)) return;
    for (const r of RULES) {
      if (r.re.test(code)) out.push({ file: rel, line: idx + 1, why: r.why, text: (srcLines[idx] ?? '').trim() });
    }
  });
  return out;
}

function main(): void {
  const dirs = process.argv.slice(2);
  const targets = dirs.length > 0 ? dirs.map((d) => join(ROOT, d)) : [join(ROOT, 'packages/core/src')];
  const violations: Violation[] = [];
  let files = 0;
  for (const dir of targets) {
    for (const f of listTs(dir)) {
      files++;
      violations.push(...checkFile(f, readFileSync(f, 'utf8')));
    }
  }
  if (violations.length > 0) {
    for (const v of violations) console.error(`${v.file}:${v.line}: ${v.why}\n    ${v.text}`);
    console.error(`\ncheck-invariants: ${violations.length} violation(s) in ${files} files`);
    process.exit(1);
  }
  console.log(`check-invariants: ok (${files} files)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
