/**
 * The content bundle: every domain, composed from per-module domain lists.
 * FOUNDATION-OWNED. Modules add domains by adding entries to their own `xDomains` object
 * (in their own schema file) — this file picks them up via the spreads below.
 */

import type { z } from 'zod';
import { beliefDomains, beliefRefs } from './belief.ts';
import { chronicleDomains, chronicleRefs } from './chronicle.ts';
import { combatDomains } from './combat.ts';
import type { DomainSpec, Issue } from './common.ts';
import { deriveCharmClaims, faeDomains, faeRefs } from './fae.ts';
import { itemsDomains, itemsRefs } from './items.ts';
import { needsActivitiesDomains, needsActivitiesRefs } from './needs-activities.ts';
import { psycheDomains, psycheRefs } from './psyche.ts';
import { regionDomains, regionRefs } from './region.ts';
import { rulesDomains, rulesRefs } from './rules.ts';
import { scenarioDomains, scenarioRefs } from './scenario.ts';
import { socialDomains, socialRefs } from './social.ts';
import { worldDomains, worldRefs } from './world.ts';

export const DOMAINS = {
  ...combatDomains,
  ...faeDomains,
  ...rulesDomains,
  ...worldDomains,
  ...regionDomains,
  ...needsActivitiesDomains,
  ...psycheDomains,
  ...socialDomains,
  ...beliefDomains,
  ...itemsDomains,
  ...chronicleDomains,
  ...scenarioDomains,
} as const;

export type DomainName = keyof typeof DOMAINS;

type RecordOf<D> = D extends DomainSpec<infer S> ? z.output<S> : never;

export type ContentTables = {
  [K in DomainName]: Record<string, RecordOf<(typeof DOMAINS)[K]>>;
};

export interface BundleMeta {
  /** Bundle format version. */
  format: 1;
  /** Content mods included, in load order. */
  mods: string[];
  /** sha256 of the canonical JSON of the tables (excluding meta). */
  hash: string;
}

export type ContentBundle = ContentTables & { meta: BundleMeta };

/** Cross-reference checks, one per owning module. Order is fixed for stable output. */
export const REF_CHECKS: ReadonlyArray<(b: ContentBundle) => Issue[]> = [
  rulesRefs,
  worldRefs,
  regionRefs,
  needsActivitiesRefs,
  psycheRefs,
  socialRefs,
  beliefRefs,
  itemsRefs,
  chronicleRefs,
  scenarioRefs,
  faeRefs,
];

/**
 * Bundle-time derivations, run on the merged tables before hashing and cross-checks (so the
 * checks validate what they derive). Order is fixed.
 */
export const DERIVATIONS: ReadonlyArray<(tables: Record<string, Record<string, unknown>>, issues: Issue[]) => void> = [
  deriveCharmClaims,
];

export function crossCheck(b: ContentBundle): Issue[] {
  const out: Issue[] = [];
  for (const check of REF_CHECKS) out.push(...check(b));
  return out;
}
