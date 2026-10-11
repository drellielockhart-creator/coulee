/**
 * Shared schema helpers. FOUNDATION-OWNED (see docs/impl/MODULES.md).
 *
 * Conventions for every content domain:
 * - TOML field names are snake_case and are kept verbatim in the JSON bundle and in TS.
 * - Every record has `id` matching ID_RE. Ids are unique within a domain.
 * - Objects are strict: unknown keys are errors (typos must not pass silently).
 * - Accumulating quantities are integers with the unit in the name: weight_g, value_cents,
 *   kcal, minutes, water_ml. The only decimals allowed are "magnitudes" with one decimal
 *   place (affordance magnitudes, bulk), validated by `decimal1`; core converts them with
 *   `Math.round(x * 10)` into integer tenths before accumulating anything.
 */
import { z } from 'zod';

export const ID_RE = /^[a-z][a-z0-9_]*$/;

export const id = () => z.string().regex(ID_RE, 'ids are snake_case: lowercase letters, digits, underscores');

/** Reference to another content record by id (validated in the cross-reference pass). */
export const ref = id;

export const int = () => z.number().int();
export const nonNegInt = () => z.number().int().min(0);
export const posInt = () => z.number().int().min(1);
export const pct = () => z.number().int().min(0).max(100);
/** Multiplier expressed as an integer percentage (100 = unchanged). */
export const ratePct = () => z.number().int().min(0).max(10_000);

/** A decimal with at most one decimal place, e.g. affordance `cut = 0.5`, bulk = 1.5. */
export const decimal1 = () =>
  z.number().refine((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, 'at most one decimal place');

export const WEEKDAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export const weekday = () => z.enum(WEEKDAY_IDS);

export const ABILITY_IDS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type AbilityId = (typeof ABILITY_IDS)[number];
export const abilityId = () => z.enum(ABILITY_IDS);

/** 04 §3.1 Values, each −3..+3. */
export const VALUE_IDS = [
  'piety',
  'thrift',
  'neighborliness',
  'parochialism',
  'superstition',
  'ambition',
  'temper',
  'rancor',
  'discretion',
] as const;
export type ValueId = (typeof VALUE_IDS)[number];
export const valueId = () => z.enum(VALUE_IDS);

/** Full ability block (3..25ish). */
export const abilities = () =>
  z.strictObject({
    str: int().min(1).max(30),
    dex: int().min(1).max(30),
    con: int().min(1).max(30),
    int: int().min(1).max(30),
    wis: int().min(1).max(30),
    cha: int().min(1).max(30),
  });

/** Partial ability modifiers (e.g. ancestry). */
export const abilityMods = () =>
  z
    .strictObject({
      str: int().min(-6).max(6).optional(),
      dex: int().min(-6).max(6).optional(),
      con: int().min(-6).max(6).optional(),
      int: int().min(-6).max(6).optional(),
      wis: int().min(-6).max(6).optional(),
      cha: int().min(-6).max(6).optional(),
    })
    .default({});

/** Partial values block, each −3..+3. */
export const valuesBlock = () =>
  z
    .strictObject({
      piety: int().min(-3).max(3).optional(),
      thrift: int().min(-3).max(3).optional(),
      neighborliness: int().min(-3).max(3).optional(),
      parochialism: int().min(-3).max(3).optional(),
      superstition: int().min(-3).max(3).optional(),
      ambition: int().min(-3).max(3).optional(),
      temper: int().min(-3).max(3).optional(),
      rancor: int().min(-3).max(3).optional(),
      discretion: int().min(-3).max(3).optional(),
    })
    .default({});

/** A validation problem. `where` is "domain:id" or a file path; `path` is a field path. */
export interface Issue {
  where: string;
  path?: string;
  message: string;
}

/**
 * One content domain: a TOML directory under content/<mod>/ and the top-level key each
 * record is written under.
 *
 * - mode 'records' (default): every *.toml file in `dir` (recursively) may contain
 *   `[[<key>]]` arrays of tables. Records are merged across files in path order.
 * - mode 'document': each *.toml file directly in `dir` is ONE record (its top-level
 *   table). A sub-directory `dir/<name>/` is also one record: its files are merged, with
 *   top-level arrays concatenated and scalars/tables required not to conflict.
 */
export interface DomainSpec<S extends z.ZodType = z.ZodType> {
  dir: string;
  key: string;
  mode?: 'records' | 'document';
  schema: S;
}

export function defineDomain<S extends z.ZodType>(spec: DomainSpec<S>): DomainSpec<S> {
  return spec;
}

/** Helper for cross-reference checks: report ids in `refs` missing from `table`. */
export function checkRefs(
  issues: Issue[],
  where: string,
  path: string,
  refs: readonly (string | undefined)[],
  table: Record<string, unknown>,
  what: string,
): void {
  for (const r of refs) {
    if (r !== undefined && !Object.hasOwn(table, r)) {
      issues.push({ where, path, message: `unknown ${what} '${r}'` });
    }
  }
}
