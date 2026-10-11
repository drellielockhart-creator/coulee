/**
 * Needs view part. OWNER: module:needs-activities.
 * Shape is a contract with module:web: add fields freely; do not rename/remove without
 * updating apps/web in the same change (coordinate via MODULES.md).
 */
import { requiredRow } from '../activity/definitions.ts';
import type { ContentBundle } from '../content.ts';
import type { Explain } from '../explain.ts';
import { type ActorId, rowsOf } from '../ids.ts';
import { calendarAt } from '../time.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';
import { hourlyLedger } from './system.ts';
import { ambientTemperatureF } from './thermal.ts';

export interface NeedView {
  id: string;
  name: string;
  kind: 'physical' | 'social' | 'spiritual';
  /** 0..1000 */
  value: number;
  /** Legible band label ('' = fine). */
  band: string;
  /** Net change over the last simulated hour (trend arrow). */
  trend?: number;
  /** P1: the projected hourly balance at the current activity (only with includeExplain). */
  explain?: Explain;
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
    const view: NeedView = {
      id: def.id,
      name: def.name,
      kind: def.kind,
      value: n?.values[def.id] ?? 1000,
      band: n?.bands[def.id] ?? '',
      trend: n?.hourly?.[def.id] ?? 0,
    };
    const actor = world.actors[actorId];
    if (opts.includeExplain && n && actor?.alive) {
      const air = ambientTemperatureF(calendarAt(world.time));
      const ledger = hourlyLedger(
        world,
        content,
        actorId,
        def.id,
        air,
        world.needs.placeTempF?.[actor.placeId] ?? air,
        n.values,
      );
      view.explain = {
        kind: 'formula',
        label: `${def.name}: next hour at the current activity`,
        subjects: [actorId],
        knowledge: 'self',
        terms: ledger.terms,
        total: Math.max(0, Math.min(1000, (n.values[def.id] ?? def.initial) + ledger.delta)),
        outcome: 'projected',
        children: ledger.calculations,
      };
    }
    list.push(view);
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
