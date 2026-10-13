/** Hourly physiology uses the previous hour's activity. */
import { isAsleep, laborOf } from '../activity/api.ts';
import { requiredRow } from '../activity/definitions.ts';
import type { ContentBundle } from '../content.ts';
import type { Explain, ExplainTerm } from '../explain.ts';
import { type ActorId, idsOf } from '../ids.ts';
import { campThermal, type InventoryIndex, inventoryIndex, loadFatigue } from '../items/api.ts';
import { energyAgePct, nutritionRestLoss } from '../provisions/api.ts';
import type { SimContext } from '../sim/context.ts';
import { yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import { satisfyNeed } from './api.ts';
import { needsFrozen, survivalHour } from './survival.ts';
import { ambientTemperatureF, clothingWarmth, heatPlaces } from './thermal.ts';

export interface HourlyLedger {
  /** Net integer change this hour (before clamping and debt). */
  delta: number;
  terms: ExplainTerm[];
  calculations: Explain[];
}

/**
 * The hourly balance of one need (decay by labor/sleep/values/traits/physiology/weather,
 * exposure, the activity's own effect, recovery, water access). Pure: the system applies it,
 * and the dossier re-runs it to show the math (P1) without logging an event per actor-need-hour.
 */
export function hourlyLedger(
  world: World,
  content: ContentBundle,
  id: ActorId,
  key: string,
  air: number,
  placeTempF: number,
  before: Readonly<Record<string, number>>,
  inventory?: InventoryIndex,
  /** Routine ticks only need the delta; views retain the full explanation by default. */
  trace = true,
  intervalPart = false,
): HourlyLedger {
  const accounted = world.activity.minuteBudgets?.[id]?.accountedActivity;
  const current = world.activity.byActor[id];
  if (accounted && current && current.activityId !== accounted) {
    return hourlyLedger(
      {
        ...world,
        activity: {
          ...world.activity,
          byActor: { ...world.activity.byActor, [id]: { ...current, activityId: accounted } },
        },
      },
      content,
      id,
      key,
      air,
      placeTempF,
      before,
      inventory,
      trace,
      intervalPart,
    );
  }
  const interval = world.activity.journeys?.[id]?.interval;
  if (!intervalPart && interval?.at === world.time && interval.movingMinutes > 0 && interval.movingMinutes < 60) {
    const state = world.activity.byActor[id];
    if (state) {
      const part = (activityId: string) =>
        hourlyLedger(
          {
            ...world,
            activity: { ...world.activity, byActor: { ...world.activity.byActor, [id]: { ...state, activityId } } },
          },
          content,
          id,
          key,
          air,
          placeTempF,
          before,
          inventory,
          trace,
          true,
        );
      const walk = part('walk'),
        wait = part('idle_at_home');
      const delta = Math.round((walk.delta * interval.movingMinutes + wait.delta * interval.waitingMinutes) / 60);
      return {
        delta: delta || 0,
        terms: trace
          ? [
              {
                source: 'travel',
                label: `${interval.movingMinutes} minutes walking; ${interval.waitingMinutes} waiting`,
                value: delta || 0,
              },
            ]
          : [],
        calculations: [...walk.calculations, ...wait.calculations],
      };
    }
  }
  if (needsFrozen(world, content, id))
    return {
      delta: 0,
      terms: trace ? [{ source: 'place', label: 'Time runs otherwise under the hill', value: 0 }] : [],
      calculations: [],
    };
  const actor = requiredRow(world.actors, id);
  const def = requiredRow(content.needs, key);
  const ctx = { content };
  const labor = laborOf(world, ctx, id);
  const asleep = isAsleep(world, ctx, id);
  const activityId = world.activity.byActor[id]?.activityId;
  const activity = activityId ? content.activities[activityId] : undefined;
  const terms: ExplainTerm[] | undefined = trace ? [] : undefined;
  const calculations: Explain[] | undefined = trace ? [] : undefined;
  const factors: ExplainTerm[] | undefined = trace
    ? [
        { source: 'base', label: 'Points per hour', value: def.decay_per_hour },
        { source: 'base', label: `${labor} labor percent`, value: def.labor_pct[labor] },
        { source: 'base', label: 'Sleep percent', value: asleep ? def.asleep_pct : 100 },
      ]
    : undefined;
  // A vice need runs down only for those who hold it (Drink: a drinker's trait), never for the young.
  const notTheirs =
    (def.only_traits.length > 0 && !def.only_traits.some((t) => actor.traits.includes(t))) ||
    (def.decay_min_age > 0 && yearsBetween(actor.born, world.time) < def.decay_min_age);
  if (notTheirs) factors?.push({ source: 'trait', label: 'Not a want of theirs', value: 0 });
  let decay = notTheirs ? 0 : ((def.decay_per_hour * def.labor_pct[labor]) / 100) * (asleep ? def.asleep_pct / 100 : 1);
  let valuePct = 100;
  for (const clause of def.value_pct) {
    const modifier = clause.per_step_pct * actor.values[clause.value];
    valuePct += modifier;
    factors?.push({ source: 'value', label: `${clause.value}: percent adjustment`, value: modifier || 0 });
  }
  decay *= Math.max(0, valuePct) / 100;
  for (const trait of actor.traits) {
    const pct = def.trait_pct[trait] ?? 100;
    decay *= pct / 100;
    if (pct !== 100) factors?.push({ source: 'trait', label: `${trait}: percent multiplier`, value: pct });
  }
  if (def.intake?.unit === 'kcal') {
    const kcalPct = content.peoples?.[actor.ancestryId]?.kcal_pct ?? 100;
    const age = energyAgePct(world, id);
    decay *= (kcalPct * age) / 10000;
    factors?.push({ source: 'base', label: 'Age energy percent', value: age });
    factors?.push({ source: 'base', label: 'Physiological energy percent', value: kcalPct });
  }
  let weatherPct = 100;
  for (const clause of def.temperature_pct)
    if (
      (clause.below_f === undefined || air < clause.below_f) &&
      (clause.above_f === undefined || air > clause.above_f)
    )
      weatherPct += clause.pct - 100;
  decay = Math.round((decay * Math.max(0, weatherPct)) / 100);
  factors?.push({ source: 'weather', label: `Ambient ${air} F: percent multiplier`, value: Math.max(0, weatherPct) });
  calculations?.push({
    kind: 'formula',
    label: 'Hourly expenditure',
    subjects: [id],
    knowledge: 'self',
    terms: factors ?? [],
    total: decay,
    outcome: 'expended',
    note: 'Base times labor, sleep, nonnegative values, traits, physiology and weather percentages; rounded once.',
  });
  terms?.push({
    source: 'need',
    label: `Hourly decay (${labor}${asleep ? ', asleep' : ''}; values, traits, weather)`,
    value: decay === 0 ? 0 : -decay,
  });
  let delta = decay === 0 ? 0 : -decay;
  if (key === 'rest' && !asleep) {
    const deficiency = nutritionRestLoss(world, content, id);
    delta -= deficiency;
    if (deficiency) terms?.push({ source: 'nutrition', label: 'Malnourishment stamina loss', value: -deficiency });
  }
  if (key === 'rest' && !asleep && labor !== 'rest') {
    const load = loadFatigue(world, content, id, decay, inventory);
    delta -= load.extra;
    if (load.extra) terms?.push({ source: 'load', label: 'Additional fatigue from carried load', value: -load.extra });
    if (load.terms.length)
      calculations?.push({
        kind: 'formula',
        label: 'Carried load fatigue',
        subjects: [id],
        knowledge: 'self',
        terms: load.terms,
        total: load.extra,
        outcome: 'expended',
      });
  }
  if (def.exposure) {
    const e = def.exposure;
    const camp = campThermal(world, content, id, asleep || labor === 'rest', inventory);
    const clothing = clothingWarmth(world, content, id, inventory);
    terms?.push({ source: 'gear', label: 'Worn clothing after wetness and wear (F)', value: clothing });
    const effective =
      placeTempF + e.base_insulation_f + clothing + e.activity_f[labor] + (asleep ? e.asleep_f : 0) + camp.bonusF;
    if (camp.terms.length)
      calculations?.push({
        kind: 'formula',
        label: 'Camp exposure adjustment',
        subjects: [id],
        knowledge: 'self',
        terms: camp.terms,
        total: camp.bonusF,
        outcome: 'applied',
      });
    const change =
      effective < e.comfort_f
        ? -Math.min(e.max_loss_per_hour, (e.comfort_f - effective) * e.loss_per_degree)
        : e.regain_per_hour;
    delta += change;
    terms?.push({
      source: 'weather',
      label: `Exposure: effective ${effective} F, comfort ${e.comfort_f} F`,
      value: change,
    });
  }
  let recovery = def.intake?.unit === 'ml' ? 0 : (activity?.needs[key] ?? 0);
  if (asleep && recovery > 0) {
    let quality = 100;
    for (const clause of def.sleep_quality) if ((before[clause.need] ?? 1000) < clause.below) quality += clause.pct;
    recovery = Math.round((recovery * Math.max(0, quality)) / 100);
  }
  delta += recovery;
  terms?.push({ source: 'base', label: activity?.name ?? 'No activity', value: recovery });
  if (def.recovery && (before[key] ?? def.initial) < def.recovery.toward) {
    const regain = Math.min(
      def.recovery.per_hour,
      Math.max(0, def.recovery.toward - (before[key] ?? def.initial) - delta),
    );
    delta += regain;
    terms?.push({ source: 'need', label: 'Recovery toward baseline', value: regain });
  }
  if (def.baseline) {
    const target = baselineOf(world, content, id, key);
    const now = (before[key] ?? def.initial) + delta;
    const gap = target - now;
    if (gap !== 0) {
      const step = Math.max(1, Math.floor((Math.abs(gap) * def.baseline.per_hour_permille) / 1000));
      const move = gap > 0 ? Math.min(gap, step) : -Math.min(-gap, step);
      delta += move;
      terms?.push({ source: 'need', label: `Drift toward ${target} (who they are here)`, value: move });
    }
  }
  return { delta, terms: terms ?? [], calculations: calculations ?? [] };
}

/**
 * A need's personal resting level (NeedDef.baseline): `toward` + the largest bonus among the
 * actor's occupation roles + each age bonus reached, clamped 0..1000. Null-safe: `initial`.
 */
export function baselineOf(world: World, content: ContentBundle, id: ActorId, key: string): number {
  const def = content.needs[key];
  const actor = world.actors[id];
  if (!def?.baseline || !actor) return def?.initial ?? 0;
  const b = def.baseline;
  let roleBonus: number | null = null;
  for (const r of content.occupations[actor.occupationId]?.roles ?? []) {
    const v = b.role_bonus[r];
    if (v !== undefined && (roleBonus === null || v > roleBonus)) roleBonus = v;
  }
  let v = b.toward + (roleBonus ?? 0);
  const age = yearsBetween(actor.born, world.time);
  for (const a of b.age_bonus) if (age >= a.min_age) v += a.bonus;
  return Math.max(0, Math.min(1000, v));
}

export function needsSystem(world: World, ctx: SimContext): void {
  const temperatures = world.tactical?.frame?.temperatures ?? heatPlaces(world, ctx);
  const air = ambientTemperatureF(ctx.cal, world);
  const keys = Object.keys(ctx.content.needs).sort();
  const inventory = world.items?.stacks ? inventoryIndex(world) : undefined;
  for (const id of idsOf<ActorId>(world.actors)) {
    const actor = requiredRow(world.actors, id);
    const n = world.needs.byActor[id];
    if (!actor.alive || !n) continue;
    // Sleep penalties use one immutable set of beginning-of-hour needs, avoiding id-order effects.
    const before = { ...n.values };
    const hourly: Record<string, number> = {};
    for (const key of keys) {
      const def = requiredRow(ctx.content.needs, key);
      const ledger = hourlyLedger(
        world,
        ctx.content,
        id,
        key,
        air,
        temperatures[actor.placeId] ?? air,
        before,
        inventory,
        false,
      );
      if (world.tactical?.frame?.live.includes(id)) continue;
      // The hourly balance is routine: it updates the meter (and emits band changes) without an
      // event per actor-need-hour. The dossier re-derives the math on demand (hourlyNeedExplain).
      const after = satisfyNeed(world, ctx, id, key, ledger.delta, {
        label: `${def.name}: hourly balance`,
        quiet: true,
      });
      hourly[key] = after - (before[key] ?? def.initial);
    }
    n.hourly = hourly;
  }
  survivalHour(world, ctx);
}
