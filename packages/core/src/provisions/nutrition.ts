import { hasCondition, setCondition } from '../actor.ts';
import { term } from '../explain.ts';
import { rowsOf } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import { asGameMinute } from '../time.ts';
import type { World } from '../world.ts';
import { mealExplain } from './meals.ts';
import { ALCOHOL, MALNOURISHED, MONOTONY, SCURVY, SCURVY_REF_SERVINGS } from './rules.ts';
import { emptyIntake } from './state.ts';

export function nutritionHour(world: World, ctx: SimContext): void {
  for (const actor of rowsOf(world.actors)) {
    const n = world.provisions.nutrition[actor.id];
    if (!n || !actor.alive) continue;
    const condition = (id: string, on: boolean, label: string, value: number) => {
      if (hasCondition(actor, id) === on) return;
      setCondition(actor, id, on);
      ctx.emit({
        kind: 'provisions.nutrition',
        data: { actorId: actor.id, condition: id, on },
        roles: [{ actor: actor.id, role: 'subject' }],
        visibility: 'private',
        explain: mealExplain(label, [actor.id], value, [], on ? 'on' : 'off'),
      });
    };
    const wasDrunk = n.intoxication >= ALCOHOL.drunkOn || hasCondition(actor, 'drunk');
    n.intoxication = Math.max(0, n.intoxication - ALCOHOL.decayPerHour);
    condition(
      'drunk',
      n.intoxication >= (hasCondition(actor, 'drunk') ? ALCOHOL.drunkOff : ALCOHOL.drunkOn),
      'Alcohol in the bloodstream',
      n.intoxication,
    );
    if (wasDrunk && n.intoxication < ALCOHOL.drunkOff)
      n.hungoverUntil = asGameMinute(ctx.now + ALCOHOL.hungoverHours * 60);
    condition(
      'hungover',
      n.hungoverUntil !== null && ctx.now < n.hungoverUntil,
      'Morning after drinking',
      n.intoxication,
    );
    if (!ctx.isNewDay || n.today.dayIndex >= ctx.cal.dayIndex) continue;
    const day = n.today;
    n.history.push(day);
    if (n.history.length > 14) n.history.shift();
    n.today = emptyIntake(ctx.cal.dayIndex);
    const fresh = Math.floor(day.freshPoints / SCURVY_REF_SERVINGS);
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
    );
    condition(
      'scurvy',
      n.scurvy >= (hasCondition(actor, 'scurvy') ? SCURVY.fullOff : SCURVY.fullOn),
      'Established scurvy',
      n.scurvy,
    );
    const week = n.history.slice(-7);
    const kcal = week.reduce((v, d) => v + d.kcal, 0),
      need = week.reduce((v, d) => v + d.needKcal, 0);
    const fat = week.reduce((v, d) => v + d.fatG * 9, 0);
    const intakePct = need > 0 ? Math.floor((kcal * 100) / need) : 100;
    const fatPct = kcal > 0 ? Math.floor((fat * 100) / kcal) : 0;
    const underfed =
      week.length >= MALNOURISHED.minDays &&
      (intakePct < (hasCondition(actor, 'malnourished') ? MALNOURISHED.offPct : MALNOURISHED.onPct) ||
        fatPct < MALNOURISHED.fatFloorPct);
    condition('malnourished', underfed, 'Seven-day nutrition', intakePct);
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
