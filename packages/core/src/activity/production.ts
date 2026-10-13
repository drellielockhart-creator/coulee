/** Small wilderness production slice. Scheduling and movement remain activity's job. */
import { skillCheck } from '../checks.ts';
import { term } from '../explain.ts';
import { affordanceAt, carriedBy, createStack, pantryOf } from '../items/api.ts';
import { processingActors } from '../region/processing.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { minuteBudget } from './api.ts';
import { monthMatches } from './calendar.ts';
import { tacticalPinned } from './tactical.ts';

export function productionHour(world: World, ctx: SimContext): void {
  for (const actor of processingActors(world)) {
    const minutes = minuteBudget(world, actor.id).remaining;
    if (minutes === 0) continue;
    const state = world.activity.byActor[actor.id];
    const activity = state?.activityId ? ctx.content.activities[state.activityId] : undefined;
    if (tacticalPinned(world, actor.id)) continue;
    if (!actor.alive || state?.travel || !activity?.tags.includes('wild_production')) continue;
    const place = world.places[actor.placeId];
    const season = monthMatches(ctx.cal.month, activity.months);
    const suitable = !!place && activity.venue_tags.some((tag) => place.tags.includes(tag));
    const home = world.households[actor.householdId]?.homePlaceId === actor.placeId;
    const tool = activity.tool;
    const magnitude = tool
      ? Math.max(
          affordanceAt(world, ctx.content, carriedBy(actor.id), tool.affordance),
          home ? affordanceAt(world, ctx.content, pantryOf(actor.householdId), tool.affordance) : 0,
        )
      : 0;
    const toolPct = tool
      ? Math.min(100, Math.max(tool.bare_pct, Math.floor((magnitude * 100) / tool.full_tenths)))
      : 100;
    const check = activity.check
      ? skillCheck(
          ctx.content,
          actor,
          { label: activity.name, skill: activity.check.skill, dc: activity.check.dc },
          ctx.rng('activity', mixKey(actor.id, actor.placeId, hashString32(activity.id), 0x7969656c)),
        )
      : null;
    const checkPct = check ? (check.exceptional ? 150 : check.success ? 100 : check.badFailure ? 0 : 50) : 100;
    const terms = [
      term('season', `Month ${ctx.cal.month}: season percent`, season ? 100 : 0),
      term('place', 'Suitable habitat percent', suitable ? 100 : 0),
      term('tool', 'Tool yield percent', toolPct),
      term('check', 'Skill yield percent', checkPct),
    ];
    const yields: Array<{ defId: string; qty: number }> = [];
    world.provisions.productionCarry ??= {};
    for (const line of activity.yields) {
      if (!ctx.content.items[line.item] || !season || !suitable || !monthMatches(ctx.cal.month, line.months)) continue;
      const key = `${actor.id}:${activity.id}:${line.item}`;
      const amount =
        (world.provisions.productionCarry[key] ?? 0) +
        Math.floor((line.tenths_per_hour * toolPct * checkPct * minutes) / 60);
      const qty = Math.floor(amount / 100000);
      world.provisions.productionCarry[key] = amount % 100000;
      if (qty > 0) {
        createStack(
          world,
          ctx,
          line.item,
          qty,
          line.to === 'household' && home ? pantryOf(actor.householdId) : carriedBy(actor.id),
        );
        yields.push({ defId: line.item, qty });
      }
    }
    ctx.emit({
      kind: 'provisions.production',
      data: { actorId: actor.id, activityId: activity.id, yields },
      place: actor.placeId,
      roles: [{ actor: actor.id, role: 'agent' }],
      visibility: 'witnessed',
      explain: {
        kind: 'formula',
        label: `${activity.name}: gathered goods`,
        subjects: [actor.id],
        knowledge: 'participants',
        terms,
        total: yields.reduce((n, line) => n + line.qty, 0),
        outcome: !season ? 'out_of_season' : !suitable ? 'wrong_habitat' : yields.length ? 'produced' : 'no_yield',
        children: check ? [check.explain] : [],
      },
    });
  }
}
