/**
 * Stable state hash over a canonical serialization. FOUNDATION-OWNED.
 *
 * Canonical form: objects with keys sorted by UTF-16 code unit order, arrays in order,
 * numbers via their shortest round-trip decimal (integers in practice), strings JSON-escaped.
 * `undefined` object members are skipped (as JSON.stringify does). The serialization is
 * streamed straight into two independent 32-bit hash lanes, so hashing a large world does
 * not build a giant string.
 */
import { mix32 } from './rng.ts';

class Hasher {
  a = 0x811c9dc5;
  b = 0x9e3779b9;
  n = 0;
  str(s: string): void {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      this.a = Math.imul(this.a ^ c, 0x01000193);
      this.b = Math.imul(this.b ^ c, 0x5bd1e995) ^ (this.b >>> 13);
    }
    this.n += s.length;
  }
  digest(): string {
    const x = mix32(this.a ^ this.n);
    const y = mix32(this.b ^ mix32(this.n + 0x6a09e667));
    return x.toString(16).padStart(8, '0') + y.toString(16).padStart(8, '0');
  }
}

function walk(h: Hasher, v: unknown, path: string): void {
  if (v === null) {
    h.str('null');
    return;
  }
  switch (typeof v) {
    case 'number':
      if (!Number.isFinite(v)) throw new Error(`hash: non-finite number at ${path}`);
      h.str(String(v));
      return;
    case 'string':
      h.str(JSON.stringify(v));
      return;
    case 'boolean':
      h.str(v ? 'true' : 'false');
      return;
    case 'object': {
      if (Array.isArray(v)) {
        h.str('[');
        for (let i = 0; i < v.length; i++) {
          if (i > 0) h.str(',');
          walk(h, v[i], `${path}[${i}]`);
        }
        h.str(']');
        return;
      }
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o).sort();
      h.str('{');
      let first = true;
      for (const k of keys) {
        const x = o[k];
        if (x === undefined) continue;
        if (!first) h.str(',');
        first = false;
        h.str(JSON.stringify(k));
        h.str(':');
        walk(h, x, `${path}.${k}`);
      }
      h.str('}');
      return;
    }
    default:
      throw new Error(`hash: unsupported ${typeof v} at ${path} (world state must be plain data)`);
  }
}

/** 64-bit hex hash of any plain-data value. */
export function hashValue(v: unknown): string {
  const h = new Hasher();
  walk(h, v, '$');
  return h.digest();
}

/** Canonical JSON string (sorted keys). Use for snapshots/debugging, not in hot paths. */
export function canonicalStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map((x) => canonicalStringify(x ?? null)).join(',')}]`;
  const o = v as Record<string, unknown>;
  const parts: string[] = [];
  for (const k of Object.keys(o).sort()) {
    if (o[k] === undefined) continue;
    parts.push(`${JSON.stringify(k)}:${canonicalStringify(o[k])}`);
  }
  return `{${parts.join(',')}}`;
}

/**
 * Invariant 2 check: every number in accumulated state is an integer. Returns the paths of
 * offending values (empty = ok). Used by tests and `coulee run --check-state`.
 */
export function findNonIntegers(v: unknown, path = '$', out: string[] = [], limit = 20): string[] {
  if (out.length >= limit) return out;
  if (typeof v === 'number') {
    if (!Number.isInteger(v)) out.push(`${path}=${v}`);
    // Negative zero is an integer, but it is not plain JSON (it round-trips to 0) and it leaks
    // into labels and Explains as "-0". Treat it as a violation of invariant 2.
    else if (Object.is(v, -0)) out.push(`${path}=-0`);
  } else if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) findNonIntegers(v[i], `${path}[${i}]`, out, limit);
  } else if (v !== null && typeof v === 'object') {
    for (const k of Object.keys(v)) findNonIntegers((v as Record<string, unknown>)[k], `${path}.${k}`, out, limit);
  }
  return out;
}
