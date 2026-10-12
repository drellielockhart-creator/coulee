/**
 * Needs view part. OWNER: module:needs-activities.
 * Shape is a contract with module:web: add fields freely; do not rename/remove without
 * updating apps/web in the same change (coordinate via MODULES.md).
 */

import { requiredRow } from '../activity/definitions.ts';
import { abilityMod } from '../actor.ts';
import type { ContentBundle } from '../content.ts';
import type { Explain } from '../explain.ts';
import { type ActorId, rowsOf } from '../ids.ts';
import { calendarAt } from '../time.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';
import { maxVigor, needsFrozen } from './survival.ts';
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
  survival?: {
    vigor: number;
    maxVigor: number;
    wounds: number;
    woundLimit: number;
    collapsed: boolean;
    conditions: string[];
  };
  warnings?: string[];
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
  const a = world.actors[actorId];
  const s = n?.survival;
  return {
    list,
    warnings: survivalWarnings(world, content, actorId),
    ...(a
      ? {
          survival: {
            vigor: s?.vigor ?? maxVigor(world, content, actorId),
            maxVigor: maxVigor(world, content, actorId),
            wounds: s?.wounds ?? 0,
            woundLimit: a.sheet.abilities.con,
            collapsed: s?.collapsed ?? false,
            conditions: [...a.sheet.conditions],
          },
        }
      : {}),
  };
}

/** Daily stats columns for stats.csv. MUST return the same keys every day. */
export function needsDailyStats(world: World, content: ContentBundle): Record<string, number> {
  const out: Record<string, number> = { survival_deaths: 0, survival_collapsed: 0 };
  for (const rule of Object.keys(content.survival_rules ?? {}).sort()) out[`deaths_${rule}`] = 0;
  for (const n of rowsOf(world.needs.byActor)) {
    if (n.survival?.death) {
      out.survival_deaths = (out.survival_deaths ?? 0) + 1;
      for (const rule of Object.keys(content.survival_rules ?? {}).sort())
        if (content.survival_rules[rule]?.name === n.survival.death.cause)
          out[`deaths_${rule}`] = (out[`deaths_${rule}`] ?? 0) + 1;
    } else if (n.survival?.collapsed) out.survival_collapsed = (out.survival_collapsed ?? 0) + 1;
  }
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

/** A conditional forecast, using the live need ledger and the same deprivation cadence. */
export function survivalWarnings(world: World, content: ContentBundle, actorId: ActorId): string[] {
  const actor = world.actors[actorId],
    n = world.needs.byActor[actorId];
  if (!actor || !n) return [];
  if (needsFrozen(world, content, actorId)) return ['Time runs otherwise under the hill: needs are frozen.'];
  const s = n.survival;
  if (!actor.alive) return [`Died of ${s?.death?.cause ?? 'unknown causes'}.`];
  if (s?.collapsed) return ['You have collapsed. You cannot act; someone must bring water, food and shelter.'];
  const air = ambientTemperatureF(calendarAt(world.time));
  const warnings: string[] = [];
  for (const key of Object.keys(content.survival_rules ?? {}).sort()) {
    const rule = content.survival_rules[key];
    if (
      !rule ||
      (rule.heat_above_f !== undefined && (world.needs.placeTempF?.[actor.placeId] ?? air) < rule.heat_above_f)
    )
      continue;
    const value = n.values[rule.need] ?? 1000;
    const ledger = hourlyLedger(
      world,
      content,
      actorId,
      rule.need,
      air,
      world.needs.placeTempF?.[actor.placeId] ?? air,
      n.values,
    );
    if (value > 300 || (ledger.delta >= 0 && value > 0)) continue;
    const forecast = collapseForecast(world, content, actorId, rule, value, ledger.delta);
    const need = content.needs[rule.need]?.name.toLowerCase() ?? rule.need;
    const stages = [
      ...(forecast.toZero > 0
        ? [`${need} runs out in about ${span(forecast.toZero)} at the current rate (${ledger.delta}/h)`]
        : [`${need} is spent`]),
      ...(forecast.graceLeft > 0 ? [`then ${span(forecast.graceLeft)} before the first Fortitude save`] : []),
      `a save (DC ${rule.dc}, +1 each time) every ${rule.check_hours} hours; each failure costs ${rule.damage} of your ${forecast.vigor} Vigor`,
    ];
    warnings.push(
      `You may collapse from ${rule.name} in about ${span(forecast.medianHours)} (${span(forecast.soonestHours)} if every save fails) if this continues: ${stages.join('; ')}.`,
    );
  }
  return warnings;
}

/** "9 hours" under two days, otherwise days with one decimal ("13.5 days"). */
function span(hours: number): string {
  return hours < 48 ? `${hours} hour${hours === 1 ? '' : 's'}` : `${Math.round((hours * 10) / 24) / 10} days`;
}

/**
 * When deprivation would drop Vigor to zero, from the live rate, the rule's grace and cadence, and
 * the real odds of each Fortitude save (d20 + Con against a DC that rises by one per check; a
 * natural 1 fails and a 20 succeeds). Median: the hour by which collapse is more likely than not.
 * Vigor spent by other deprivations is included; recovery while relieved is not.
 */
export function collapseForecast(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  rule: NonNullable<ContentBundle['survival_rules'][string]>,
  value: number,
  delta: number,
): { toZero: number; graceLeft: number; vigor: number; medianHours: number; soonestHours: number } {
  const actor = world.actors[actorId];
  const s = world.needs.byActor[actorId]?.survival;
  const toZero = value === 0 ? 0 : Math.ceil(value / Math.max(1, -delta));
  const accrued = value === 0 ? (s?.hours[rule.id] ?? 0) : 0;
  const vigor = s?.vigor ?? maxVigor(world, content, actorId);
  const mod = abilityMod(actor?.sheet.abilities.con ?? 10);
  const graceLeft = Math.max(0, rule.grace_hours - accrued);
  // Hours from now to check k (k counts checks already made at this deprivation).
  const made = accrued >= rule.grace_hours ? Math.floor((accrued - rule.grace_hours) / rule.check_hours) + 1 : 0;
  const firstAt =
    toZero +
    (accrued < rule.grace_hours
      ? rule.grace_hours - accrued
      : rule.check_hours - ((accrued - rule.grace_hours) % rule.check_hours));
  const failures = Math.max(1, Math.ceil(vigor / Math.max(1, rule.damage)));
  // dist[f] = probability (per 1e6) of f failures so far; integer arithmetic keeps it exact enough.
  let dist = [1_000_000];
  let median = -1;
  let collapsed = 0;
  for (let i = 0; i < 400 && median < 0; i++) {
    const k = made + i;
    const failPm = Math.max(50, Math.min(950, (rule.dc + k - mod - 1) * 50));
    const next = new Array<number>(failures).fill(0);
    for (let f = 0; f < dist.length; f++) {
      const p = dist[f] ?? 0;
      const fail = Math.round((p * failPm) / 1000);
      next[f] = (next[f] ?? 0) + (p - fail);
      if (f + 1 >= failures) collapsed += fail;
      else next[f + 1] = (next[f + 1] ?? 0) + fail;
    }
    dist = next;
    if (collapsed * 2 >= 1_000_000) median = i;
  }
  return {
    toZero,
    graceLeft,
    vigor,
    medianHours: firstAt + Math.max(0, median) * rule.check_hours,
    soonestHours: firstAt + (failures - 1) * rule.check_hours,
  };
}
