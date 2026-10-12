import { hasCondition, setCondition } from '../actor.ts';
import type { ContentBundle } from '../content.ts';
import { type ExplainTerm, term } from '../explain.ts';
import { rowsOf } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import { asGameMinute } from '../time.ts';
import type { World } from '../world.ts';
import { dailyKcal, mealExplain } from './meals.ts';
import { ALCOHOL, MALNOURISHED, MONOTONY, SCURVY, SCURVY_REF_SERVINGS } from './rules.ts';
import { emptyIntake } from './state.ts';

export function nutritionTargets(content: ContentBundle) {
  return (
    content.nutritionRules?.daily ?? {
      id: 'daily',
      deficiency_rest_loss_per_hour: 6,
      protein_g_per_1000_kcal: 20,
      protein_on_pct: 70,
      protein_off_pct: 85,
      min_days: 7,
      fat_floor_pct: 10,
      fat_recovery_pct: 12,
      fresh_target: 10,
      fresh_reference_servings: SCURVY_REF_SERVINGS,
    }
  );
}

export function nutritionHour(world: World, ctx: SimContext): void {
  for (const actor of rowsOf(world.actors)) {
    const n = world.provisions.nutrition[actor.id];
    if (!n || !actor.alive) continue;
    const condition = (id: string, on: boolean, label: string, value: number, terms: ExplainTerm[] = []) => {
      if (hasCondition(actor, id) === on) return;
      setCondition(actor, id, on);
      ctx.emit({
        kind: 'provisions.nutrition',
        data: { actorId: actor.id, condition: id, on },
        roles: [{ actor: actor.id, role: 'subject' }],
        visibility: 'private',
        explain: mealExplain(label, [actor.id], value, terms, on ? 'on' : 'off'),
      });
    };
    const wasDrunk = n.intoxication >= ALCOHOL.drunkOn || hasCondition(actor, 'drunk');
    n.intoxication = Math.max(0, n.intoxication - ALCOHOL.decayPerHour);
    condition(
      'drunk',
      n.intoxication >= (hasCondition(actor, 'drunk') ? ALCOHOL.drunkOff : ALCOHOL.drunkOn),
      'Alcohol in the bloodstream',
      n.intoxication,
      [
        term('alcohol', 'Intoxication points', n.intoxication),
        term('threshold', 'On threshold', ALCOHOL.drunkOn),
        term('threshold', 'Recovery threshold', ALCOHOL.drunkOff),
      ],
    );
    if (wasDrunk && n.intoxication < ALCOHOL.drunkOff)
      n.hungoverUntil = asGameMinute(ctx.now + ALCOHOL.hungoverHours * 60);
    condition(
      'hungover',
      n.hungoverUntil !== null && ctx.now < n.hungoverUntil,
      'Morning after drinking',
      n.intoxication,
      [
        term('time', 'Current game minute', ctx.now),
        term('time', 'Hangover ends at minute', n.hungoverUntil ?? ctx.now),
        term('alcohol', 'Recovery below intoxication', ALCOHOL.drunkOff),
        term('time', 'Hangover hours', ALCOHOL.hungoverHours),
      ],
    );
    if (!ctx.isNewDay || n.today.dayIndex >= ctx.cal.dayIndex) continue;
    const targets = nutritionTargets(ctx.content);
    const day = n.today;
    if (day.needKcal === 0) day.needKcal = dailyKcal(world, ctx.content, actor.id, day.dayIndex * 1440);
    n.history.push(day);
    if (n.history.length > 14) n.history.shift();
    n.today = emptyIntake(ctx.cal.dayIndex);
    const fresh = Math.floor(day.freshPoints / targets.fresh_reference_servings);
    if (fresh < SCURVY.accrualBelow) {
      n.lowFreshDays++;
      n.scurvy = Math.min(1000, n.scurvy + SCURVY.accrualBase - fresh);
    } else {
      n.lowFreshDays = 0;
      n.scurvy = Math.max(
        0,
        n.scurvy - (fresh >= 40 ? SCURVY.reliefHigh : fresh >= 25 ? SCURVY.reliefMid : SCURVY.reliefLow),
      );
    }
    const foods = new Set(n.history.flatMap((d) => d.foods));
    const groups = new Set(n.history.flatMap((d) => d.groups));
    n.monotony = Math.max(0, 1000 - foods.size * MONOTONY.perFood - groups.size * MONOTONY.perGroup);
    condition(
      'scurvy_early',
      n.scurvy >= (hasCondition(actor, 'scurvy_early') ? SCURVY.earlyOff : SCURVY.earlyOn),
      'Fresh food and scurvy risk',
      n.scurvy,
      [
        term('food', 'Daily fresh points', day.freshPoints),
        term('food', 'Fresh reference servings', targets.fresh_reference_servings),
        term('food', 'Daily fresh index', fresh),
        term('threshold', 'Fresh accrual below', SCURVY.accrualBelow),
        term('history', 'Low-fresh days', n.lowFreshDays),
        term('threshold', 'On threshold', SCURVY.earlyOn),
        term('threshold', 'Recovery threshold', SCURVY.earlyOff),
      ],
    );
    condition(
      'scurvy',
      n.scurvy >= (hasCondition(actor, 'scurvy') ? SCURVY.fullOff : SCURVY.fullOn),
      'Established scurvy',
      n.scurvy,
      [
        term('food', 'Daily fresh index', fresh),
        term('history', 'Low-fresh days', n.lowFreshDays),
        term('threshold', 'On threshold', SCURVY.fullOn),
        term('threshold', 'Recovery threshold', SCURVY.fullOff),
      ],
    );
    const week = n.history.slice(-7);
    const kcal = week.reduce((v, d) => v + d.kcal, 0),
      need = week.reduce((v, d) => v + d.needKcal, 0);
    const fat = week.reduce((v, d) => v + d.fatG * 9, 0);
    const intakePct = need > 0 ? Math.floor((kcal * 100) / need) : 100;
    const fatPct = kcal > 0 ? Math.floor((fat * 100) / kcal) : 0;
    const recovering = hasCondition(actor, 'malnourished');
    const energyThreshold = recovering ? MALNOURISHED.offPct : MALNOURISHED.onPct;
    const fatThreshold = recovering ? targets.fat_recovery_pct : targets.fat_floor_pct;
    const protein = week.reduce((v, d) => v + d.proteinG, 0);
    const proteinTarget = Math.round((need * targets.protein_g_per_1000_kcal) / 1000);
    const proteinPct = proteinTarget > 0 ? Math.floor((protein * 100) / proteinTarget) : 100;
    const proteinThreshold = recovering ? targets.protein_off_pct : targets.protein_on_pct;
    const energyLow = week.length >= MALNOURISHED.minDays && intakePct < energyThreshold;
    const fatLow = week.length >= MALNOURISHED.minDays && fatPct < fatThreshold;
    const proteinLow = week.length >= targets.min_days && proteinPct < proteinThreshold;
    condition('malnourished', energyLow || fatLow || proteinLow, 'Seven-day nutrition', intakePct, [
      term('history', 'Recorded days in rolling week', week.length),
      term('threshold', 'Energy and fat minimum recorded days', MALNOURISHED.minDays),
      term('food', 'Rolling energy kcal', kcal),
      term('need', 'Rolling full energy target kcal', need),
      term('food', 'Energy percent of target', intakePct),
      term('threshold', 'Energy onset percent', MALNOURISHED.onPct),
      term('threshold', 'Energy recovery percent', MALNOURISHED.offPct),
      term(
        'food',
        'Rolling fat grams',
        week.reduce((v, d) => v + d.fatG, 0),
      ),
      term('food', 'Fat energy percent', fatPct),
      term('threshold', 'Fat onset percent', targets.fat_floor_pct),
      term('threshold', 'Fat recovery percent', targets.fat_recovery_pct),
      term('food', 'Rolling protein grams', protein),
      term('need', 'Protein target grams', proteinTarget),
      term('food', 'Protein percent of target', proteinPct),
      term('threshold', 'Protein onset percent', targets.protein_on_pct),
      term('threshold', 'Protein recovery percent', targets.protein_off_pct),
      term('threshold', 'Protein minimum recorded days', targets.min_days),
      term('hysteresis', 'Using recovery thresholds', recovering ? 1 : 0),
      term('cause', 'Energy deficiency branch', energyLow ? 1 : 0),
      term('cause', 'Fat deficiency branch', fatLow ? 1 : 0),
      term('cause', 'Protein deficiency branch', proteinLow ? 1 : 0),
    ]);
    ctx.emit({
      kind: 'provisions.intake',
      data: {
        actorId: actor.id,
        dayIndex: day.dayIndex,
        kcal: day.kcal,
        proteinG: day.proteinG,
        fatG: day.fatG,
        fresh,
        scurvy: n.scurvy,
        monotony: n.monotony,
        morale: day.morale,
      },
      roles: [{ actor: actor.id, role: 'subject' }],
      visibility: 'private',
      explain: mealExplain('Daily nutrition', [actor.id], n.scurvy, [
        term('food', 'Fresh index', fresh),
        term('food', 'Energy percent of target', intakePct),
        term('food', 'Fat energy percent', fatPct),
        term('food', 'Food groups in fourteen days', groups.size),
      ]),
    });
  }
}

/** Deficiency costs stamina even when total calories are sufficient. Needs applies this
 * through its own ledger, and the caller can display the same named physiological cost. */
export function nutritionRestLoss(world: World, content: ContentBundle, actorId: import('../ids.ts').ActorId): number {
  return world.actors[actorId]?.sheet.conditions.includes('malnourished')
    ? nutritionTargets(content).deficiency_rest_loss_per_hour
    : 0;
}
