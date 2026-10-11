/**
 * Needs state. OWNER: module:needs-activities.
 * Every need is 0..1000 (1000 = satisfied). Values are integers.
 */
import type { NeedId } from '../content.ts';
import { type ActorId, idsOf, mustGet, type Table } from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import type { World } from '../world.ts';

export interface ActorNeeds {
  /** Need id -> 0..1000. */
  values: Record<NeedId, number>;
  /** Need id -> current band label ('' when above all bands), for change detection. */
  bands: Record<NeedId, string>;
}

export interface NeedsState {
  byActor: Table<ActorId, ActorNeeds>;
}

export function createNeedsState(): NeedsState {
  return { byActor: {} };
}

/** Seed needs from content defaults and scenario overrides (actor `needs = { ... }`). */
export function initNeedsState(world: World, ctx: InitContext): void {
  const byKey: Record<string, Record<string, number>> = {};
  for (const a of ctx.scenario.actors) byKey[a.key] = a.needs;
  for (const id of idsOf<ActorId>(world.actors)) {
    const actor = mustGet(world.actors, id, 'actor');
    const overrides = byKey[actor.key] ?? {};
    const values: Record<string, number> = {};
    const bands: Record<string, string> = {};
    for (const need of Object.values(ctx.content.needs)) {
      values[need.id] = overrides[need.id] ?? need.initial;
      bands[need.id] = '';
    }
    world.needs.byActor[id] = { values, bands };
  }
}
