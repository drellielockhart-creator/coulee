/**
 * Needs state. OWNER: module:needs-activities.
 * Every need is 0..1000 (1000 = satisfied). Values are integers.
 */
import { requiredRow } from '../activity/definitions.ts';
import type { NeedId } from '../content.ts';
import { type ActorId, idsOf, mustGet, type PlaceId, type Table } from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { updateBands } from './bands.ts';

export interface ActorNeeds {
  /** Need id -> 0..1000. */
  values: Record<NeedId, number>;
  /** Need id -> current band label ('' when above all bands), for change detection. */
  bands: Record<NeedId, string>;
  /** Unmet points at zero; repaid from later credits. Optional for older saves. */
  debt?: Record<NeedId, number>;
  debtBands?: Record<NeedId, string>;
  /** Net change of each need over the last simulated hour (the dossier's trend arrow). */
  hourly?: Record<NeedId, number>;
}

export interface NeedsState {
  byActor: Table<ActorId, ActorNeeds>;
  /** Indoor temperature by place for the hour just simulated (°F). Optional for older saves. */
  placeTempF?: Table<PlaceId, number>;
  /** 1 while a place's hearth is lit; `needs.hearth` is logged only when this changes. */
  hearthLit?: Table<PlaceId, number>;
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
    for (const need of Object.keys(ctx.content.needs)
      .sort()
      .map((key) => requiredRow(ctx.content.needs, key))) {
      values[need.id] = overrides[need.id] ?? need.initial;
      bands[need.id] = '';
    }
    world.needs.byActor[id] = { values, bands, debt: {}, debtBands: {} };
    for (const key of Object.keys(ctx.content.needs).sort())
      updateBands(world, id, requiredRow(ctx.content.needs, key), ctx);
  }
}
