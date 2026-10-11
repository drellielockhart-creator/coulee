/**
 * Needs view part. OWNER: module:needs-activities.
 * Shape is a contract with module:web: add fields freely; do not rename/remove without
 * updating apps/web in the same change (coordinate via MODULES.md).
 */
import { requiredRow } from '../activity/definitions.ts';
import type { ContentBundle } from '../content.ts';
import { type ActorId, rowsOf } from '../ids.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';

export interface NeedView {
  id: string;
  name: string;
  kind: 'physical' | 'social' | 'spiritual';
  /** 0..1000 */
  value: number;
  /** Legible band label ('' = fine). */
  band: string;
}

export interface NeedsActorView {
  list: NeedView[];
}

export function viewNeedsActor(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  opts: ViewOptions,
): NeedsActorView {
  if (!opts.omniscient && opts.perspective !== null && opts.perspective !== actorId) return { list: [] };
  const n = world.needs.byActor[actorId];
  const list: NeedView[] = [];
  for (const def of Object.keys(content.needs)
    .sort()
    .map((key) => requiredRow(content.needs, key))) {
    list.push({
      id: def.id,
      name: def.name,
      kind: def.kind,
      value: n?.values[def.id] ?? 1000,
      band: n?.bands[def.id] ?? '',
    });
  }
  return { list };
}

/** Daily stats columns for stats.csv. MUST return the same keys every day. */
export function needsDailyStats(world: World, content: ContentBundle): Record<string, number> {
  const out: Record<string, number> = {};
  for (const def of Object.keys(content.needs)
    .sort()
    .map((key) => requiredRow(content.needs, key))) {
    let sum = 0;
    let count = 0;
    for (const n of rowsOf(world.needs.byActor)) {
      sum += n.values[def.id] ?? 0;
      count++;
    }
    const mean = count === 0 ? 0 : Math.round(sum / count);
    out[`needs_${def.id}_mean`] = mean;
    // Retain the legacy key for existing consumers (additive contract).
    out[`need_${def.id}_mean`] = mean;
  }
  return out;
}
