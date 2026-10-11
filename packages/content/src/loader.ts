/**
 * TOML loader + validator. Node-only. FOUNDATION-OWNED.
 *
 * loadContent('content', ['base']) reads every domain directory of every mod, validates each
 * record with its zod schema (strict), merges records across files (path order) and mods
 * (later mods replace records with the same id), then runs the cross-reference checks.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import type { z } from 'zod';
import { type ContentBundle, type ContentTables, crossCheck, DOMAINS, type DomainName } from './schema/bundle.ts';
import type { DomainSpec, Issue } from './schema/common.ts';

export interface LoadResult {
  bundle: ContentBundle | undefined;
  issues: Issue[];
  /** Files read, relative to the content root, in load order. */
  files: string[];
}

function listToml(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir).sort();
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...listToml(p));
    else if (e.endsWith('.toml')) out.push(p);
  }
  return out;
}

function zodIssues(where: string, err: z.ZodError): Issue[] {
  return err.issues.map((i) => ({
    where,
    path: i.path.map(String).join('.'),
    message: i.message,
  }));
}

function readToml(file: string, root: string, issues: Issue[]): Record<string, unknown> | undefined {
  try {
    return parseToml(readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch (e) {
    issues.push({ where: relative(root, file), message: `TOML parse error: ${(e as Error).message}` });
    return undefined;
  }
}

/** Deep-merge scenario fragments: arrays concatenate, tables merge, scalars must agree. */
function mergeDocs(into: Record<string, unknown>, from: Record<string, unknown>, where: string, issues: Issue[]): void {
  for (const [k, v] of Object.entries(from)) {
    const cur = into[k];
    if (cur === undefined) into[k] = v;
    else if (Array.isArray(cur) && Array.isArray(v)) into[k] = [...cur, ...v];
    else if (isPlainObject(cur) && isPlainObject(v)) mergeDocs(cur, v, `${where}.${k}`, issues);
    else if (cur !== v) issues.push({ where, path: k, message: 'conflicting values across files' });
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function loadContent(contentRoot: string, mods: readonly string[] = ['base']): LoadResult {
  const issues: Issue[] = [];
  const files: string[] = [];
  const tables: Record<string, Record<string, unknown>> = {};
  for (const name of Object.keys(DOMAINS)) tables[name] = {};

  // Group domains by directory so files can hold several record kinds (e.g. site + place).
  const byDir = new Map<string, Array<[DomainName, DomainSpec]>>();
  for (const [name, spec] of Object.entries(DOMAINS) as Array<[DomainName, DomainSpec]>) {
    const list = byDir.get(spec.dir) ?? [];
    list.push([name, spec]);
    byDir.set(spec.dir, list);
  }

  for (const mod of mods) {
    const seenInMod = new Map<string, string>(); // `${domain}:${id}` -> file
    for (const [dir, specs] of [...byDir.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const base = join(contentRoot, mod, dir);
      const docSpec = specs.find(([, s]) => s.mode === 'document');
      if (docSpec) {
        loadDocuments(contentRoot, base, docSpec, tables, issues, files);
        continue;
      }
      for (const file of listToml(base)) {
        const rel = relative(contentRoot, file);
        files.push(rel);
        const doc = readToml(file, contentRoot, issues);
        if (!doc) continue;
        for (const [key, value] of Object.entries(doc)) {
          const match = specs.find(([, s]) => s.key === key);
          if (!match) {
            const known = specs.map(([, s]) => `[[${s.key}]]`).join(', ');
            issues.push({ where: rel, path: key, message: `unknown top-level key; expected ${known}` });
            continue;
          }
          const [domain, spec] = match;
          if (!Array.isArray(value)) {
            issues.push({ where: rel, path: key, message: `use [[${key}]] (array of tables)` });
            continue;
          }
          value.forEach((raw, idx) => {
            const rid = isPlainObject(raw) && typeof raw.id === 'string' ? raw.id : `#${idx}`;
            const res = spec.schema.safeParse(raw);
            if (!res.success) {
              issues.push(...zodIssues(`${rel} ${domain}:${rid}`, res.error));
              return;
            }
            const rec = res.data as { id: string };
            const dupKey = `${domain}:${rec.id}`;
            const prev = seenInMod.get(dupKey);
            if (prev) {
              issues.push({ where: rel, message: `duplicate ${domain} id '${rec.id}' (also in ${prev})` });
              return;
            }
            seenInMod.set(dupKey, rel);
            const table = tables[domain] as Record<string, unknown>;
            delete table[rec.id]; // later mods replace (and move to the end)
            table[rec.id] = rec;
          });
        }
      }
    }
  }

  const tablesTyped = tables as unknown as ContentTables;
  const hash = createHash('sha256').update(canonicalJson(tablesTyped)).digest('hex');
  const bundle: ContentBundle = { ...tablesTyped, meta: { format: 1, mods: [...mods], hash } };
  if (issues.length === 0) issues.push(...crossCheck(bundle));
  return { bundle: issues.length === 0 ? bundle : undefined, issues, files };
}

function loadDocuments(
  root: string,
  base: string,
  [domain, spec]: [DomainName, DomainSpec],
  tables: Record<string, Record<string, unknown>>,
  issues: Issue[],
  files: string[],
): void {
  let entries: string[];
  try {
    entries = readdirSync(base).sort();
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(base, e);
    let doc: Record<string, unknown> | undefined;
    let where = relative(root, p);
    if (statSync(p).isDirectory()) {
      doc = {};
      for (const f of listToml(p)) {
        files.push(relative(root, f));
        const part = readToml(f, root, issues);
        if (part) mergeDocs(doc, part, relative(root, f), issues);
      }
      where = `${where}/`;
    } else if (e.endsWith('.toml')) {
      files.push(where);
      doc = readToml(p, root, issues);
    }
    if (!doc) continue;
    const res = spec.schema.safeParse(doc);
    if (!res.success) {
      issues.push(...zodIssues(`${where} ${domain}`, res.error));
      continue;
    }
    const rec = res.data as { id: string };
    const table = tables[domain] as Record<string, unknown>;
    delete table[rec.id];
    table[rec.id] = rec;
  }
}

/** JSON with object keys sorted (stable hashing). */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (isPlainObject(v)) {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

export function formatIssues(issues: readonly Issue[]): string {
  return issues.map((i) => `  ${i.where}${i.path ? ` [${i.path}]` : ''}: ${i.message}`).join('\n');
}
