/**
 * Shared helpers for integration tests that need real content (Node-side).
 * FOUNDATION-OWNED. Module agents put their integration tests in
 * packages/cli/test/<module-id>.test.ts and import from here.
 */
import { loadContentOrThrow } from '@coulee/content';
import { type ContentBundle, createSim, runHours, type Sim } from '@coulee/core';

let cached: ContentBundle | null = null;

/** content/base, validated, loaded once per test file. */
export function baseContent(): ContentBundle {
  cached ??= loadContentOrThrow(['base']);
  return cached;
}

/** A fresh Iron Ford sim (or another scenario), optionally advanced by `hours`. */
export function simFor(opts: { seed?: number; hours?: number; scenarioId?: string } = {}): Sim {
  const sim = createSim(baseContent(), { scenarioId: opts.scenarioId ?? 'iron_ford', seed: opts.seed ?? 1 });
  if (opts.hours) runHours(sim, opts.hours);
  return sim;
}

/** Actor id by scenario key, throwing if absent. */
export function actorByKey(sim: Sim, key: string) {
  const id = sim.world.index.actorByKey[key];
  if (id === undefined) throw new Error(`no actor '${key}' in scenario`);
  return id;
}
