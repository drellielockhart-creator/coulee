/** Hourly physiology uses the previous hour's activity. */
import { isAsleep, laborOf } from '../activity/api.ts';
import { requiredRow } from '../activity/definitions.ts';
import type { Explain, ExplainTerm } from '../explain.ts';
import { type ActorId, idsOf } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { satisfyNeed } from './api.ts';
import { ambientTemperatureF, heatPlaces } from './thermal.ts';

export function needsSystem(world: World, ctx: SimContext): void {
  const temperatures = heatPlaces(world, ctx);
  const air = ambientTemperatureF(ctx.cal);
  for (const id of idsOf<ActorId>(world.actors)) {
    const actor = requiredRow(world.actors, id);
    const n = world.needs.byActor[id];
    if (!actor.alive || !n) continue;
    const labor = laborOf(world, ctx, id);
    const asleep = isAsleep(world, ctx, id);
    const activityId = world.activity.byActor[id]?.activityId;
    const activity = activityId ? ctx.content.activities[activityId] : undefined;
    // Sleep penalties use one immutable set of beginning-of-hour needs, avoiding id-order effects.
    const before = { ...n.values };
    for (const key of Object.keys(ctx.content.needs).sort()) {
      const def = requiredRow(ctx.content.needs, key);
      const terms: ExplainTerm[] = [];
      const calculations: Explain[] = [];
      const factors: ExplainTerm[] = [
        { source: 'base', label: 'Points per hour', value: def.decay_per_hour },
        { source: 'base', label: `${labor} labor percent`, value: def.labor_pct[labor] },
        { source: 'base', label: 'Sleep percent', value: asleep ? def.asleep_pct : 100 },
      ];
      let decay = ((def.decay_per_hour * def.labor_pct[labor]) / 100) * (asleep ? def.asleep_pct / 100 : 1);
      let valuePct = 100;
      for (const clause of def.value_pct) {
        const modifier = clause.per_step_pct * actor.values[clause.value];
        valuePct += modifier;
        factors.push({ source: 'value', label: `${clause.value}: percent adjustment`, value: modifier || 0 });
      }
      decay *= Math.max(0, valuePct) / 100;
      for (const trait of actor.traits) {
        const pct = def.trait_pct[trait] ?? 100;
        decay *= pct / 100;
        if (pct !== 100) factors.push({ source: 'trait', label: `${trait}: percent multiplier`, value: pct });
      }
      if (def.intake?.unit === 'kcal') {
        const kcalPct = ctx.content.peoples?.[actor.ancestryId]?.kcal_pct ?? 100;
        decay *= kcalPct / 100;
        factors.push({ source: 'base', label: 'Physiological energy percent', value: kcalPct });
      }
      let weatherPct = 100;
      for (const clause of def.temperature_pct)
        if (
          (clause.below_f === undefined || air < clause.below_f) &&
          (clause.above_f === undefined || air > clause.above_f)
        )
          weatherPct += clause.pct - 100;
      decay = Math.round((decay * Math.max(0, weatherPct)) / 100);
      factors.push({
        source: 'weather',
        label: `Ambient ${air} F: percent multiplier`,
        value: Math.max(0, weatherPct),
      });
      calculations.push({
        kind: 'formula',
        label: 'Hourly expenditure',
        subjects: [id],
        knowledge: 'self',
        terms: factors,
        total: decay,
        outcome: 'expended',
        note: 'Base times labor, sleep, nonnegative values, traits, physiology and weather percentages; rounded once.',
      });
      terms.push({
        source: 'need',
        label: `Hourly decay (${labor}${asleep ? ', asleep' : ''}; values, traits, weather)`,
        value: -decay,
      });
      let delta = decay === 0 ? 0 : -decay;
      if (def.exposure) {
        const e = def.exposure;
        const effective =
          (temperatures[actor.placeId] ?? air) + e.base_insulation_f + e.activity_f[labor] + (asleep ? e.asleep_f : 0);
        const change =
          effective < e.comfort_f
            ? -Math.min(e.max_loss_per_hour, (e.comfort_f - effective) * e.loss_per_degree)
            : e.regain_per_hour;
        delta += change;
        terms.push({
          source: 'weather',
          label: `Exposure: effective ${effective} F, comfort ${e.comfort_f} F`,
          value: change,
        });
      }
      let recovery = activity?.needs[key] ?? 0;
      if (asleep && recovery > 0) {
        let quality = 100;
        for (const clause of def.sleep_quality) if ((before[clause.need] ?? 1000) < clause.below) quality += clause.pct;
        recovery = Math.round((recovery * Math.max(0, quality)) / 100);
      }
      delta += recovery;
      terms.push({ source: 'base', label: activity?.name ?? 'No activity', value: recovery });
      if (def.recovery && (before[key] ?? def.initial) < def.recovery.toward) {
        const regain = Math.min(
          def.recovery.per_hour,
          Math.max(0, def.recovery.toward - (before[key] ?? def.initial) - delta),
        );
        delta += regain;
        terms.push({ source: 'need', label: 'Recovery toward baseline', value: regain });
      }
      if (
        !asleep &&
        def.access &&
        (before[key] ?? def.initial) + delta < def.access.below &&
        def.access.place_tags.some((t) => world.places[actor.placeId]?.tags.includes(t))
      ) {
        delta += def.access.per_hour;
        terms.push({ source: 'place', label: 'Water access', value: def.access.per_hour });
      }
      satisfyNeed(world, ctx, id, key, delta, { label: `${def.name}: hourly balance`, terms, calculations });
    }
  }
}
