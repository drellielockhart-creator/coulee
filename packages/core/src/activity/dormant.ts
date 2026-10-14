/** Owner's aggregate supply adapter: only authored productive schedule slots yield goods. */
import type { ActorId } from '../ids.ts';
import { authorizeAct } from '../psyche/api.ts';
import { rng } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { resolveActivityPlace, scheduledBlock } from './api.ts';
import { productionHour } from './production.ts';

export function dormantProduction(world: World, ctx: SimContext, ids: readonly ActorId[]): number {
  let kcal = 0;
  for (const id of ids) {
    const actor = world.actors[id],
      state = world.activity.byActor[id];
    if (!actor?.alive || !state || !authorizeAct(world, id, { kind: 'consequential' }, { kind: 'own' }).ok) continue;
    if (
      !ctx.content.occupations[actor.occupationId]?.schedule.some((b) =>
        ctx.content.activities[b.activity]?.tags.includes('wild_production'),
      )
    )
      continue;
    const saved = { ...state },
      place = actor.placeId,
      budget = world.activity.minuteBudgets?.[id];
    try {
      if (world.activity.minuteBudgets) delete world.activity.minuteBudgets[id];
      for (let hour = 0; hour < 24; hour++) {
        const now = asGameMinute(ctx.now - ctx.cal.hour * 60 + hour * 60),
          cal = calendarAt(now);
        const block = scheduledBlock(world, ctx, id, cal);
        if (!block || !ctx.content.activities[block.activity]?.tags.includes('wild_production')) continue;
        const placeId = resolveActivityPlace(world, ctx, id, block.activity);
        if (placeId === null) continue;
        actor.placeId = placeId;
        state.placeId = placeId;
        state.activityId = block.activity;
        state.travel = null;
        productionHour(
          world,
          {
            ...ctx,
            now,
            cal,
            rng: (stream, key) => rng(ctx.seed, stream, now, key),
            emit: (event) => {
              if (event.kind === 'provisions.production')
                for (const line of event.data.yields)
                  kcal += line.qty * (ctx.content.items[line.defId]?.food?.kcal ?? 0);
              return ctx.emit({ ...event, t: ctx.now });
            },
          },
          [actor],
        );
      }
    } finally {
      actor.placeId = place;
      world.activity.byActor[id] = saved;
      if (budget && world.activity.minuteBudgets) world.activity.minuteBudgets[id] = budget;
    }
  }
  return kcal;
}
