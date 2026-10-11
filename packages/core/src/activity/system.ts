/** Execute the chosen activity, falling back to the content calendar. */
import { type ActorId, idsOf } from '../ids.ts';
import { admitSleep } from '../provisions/api.ts';
import { chosenUrge } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import { addHours } from '../time.ts';
import type { World } from '../world.ts';
import { noteCall, resolveActivityPlace } from './api.ts';
import { blockActive, observanceActive, routineFor } from './calendar.ts';
import { requiredRow } from './definitions.ts';
import { activityExplain } from './explain.ts';
import { type ActivitySource, recomputeOccupancy } from './state.ts';

export function activitySystem(world: World, ctx: SimContext): void {
  for (const id of idsOf<ActorId>(world.actors)) {
    const actor = requiredRow(world.actors, id);
    const state = world.activity.byActor[id];
    if (!actor.alive || !state) continue;
    if (state.travel) {
      if (ctx.now < state.travel.arrive) continue;
      const from = actor.placeId;
      actor.placeId = state.travel.to;
      state.placeId = state.travel.to;
      state.travel = null;
      ctx.emit({
        kind: 'activity.moved',
        data: { actorId: id, from, to: actor.placeId },
        place: actor.placeId,
        roles: [{ actor: id, role: 'agent' }],
        visibility: 'witnessed',
        explain: {
          kind: 'formula',
          label: 'Travel arrival',
          subjects: [id],
          knowledge: 'public',
          terms: [],
          total: ctx.now,
          outcome: 'arrived',
        },
      });
    }
    if (state.lockedUntil !== null && ctx.now < state.lockedUntil) continue;
    const chosen = chosenUrge(world, id);
    const routine = routineFor(world, ctx, id);
    const urge = chosen?.urge;
    // An explicit conversation occupies this hour at the current venue. A schedule must
    // not carry its speaker away (or put them to sleep) before social resolves it.
    const conversation = chosen?.voice === 'command' && urge?.kind === 'interaction';
    let activityId = urge?.kind === 'activity' ? urge.activityId : conversation ? 'idle_at_home' : routine?.activityId;
    let source: ActivitySource = conversation
      ? 'command'
      : urge?.kind === 'activity'
        ? chosen?.voice === 'command'
          ? 'command'
          : 'urge'
        : 'schedule';
    let placeId = activityId
      ? resolveActivityPlace(
          world,
          ctx,
          id,
          activityId,
          conversation ? actor.placeId : urge?.kind === 'activity' ? urge.placeId : undefined,
        )
      : null;
    if (placeId === null || !activityId || !ctx.content.activities[activityId]) {
      activityId = routine?.activityId;
      placeId = activityId ? resolveActivityPlace(world, ctx, id, activityId) : null;
      source = 'schedule';
    }
    if (!activityId || placeId === null) continue;
    if (ctx.content.activities[activityId]?.asleep && !admitSleep(world, ctx, id, placeId)) {
      activityId = 'idle_at_home';
    }
    const def = requiredRow(ctx.content.activities, activityId);
    const rawExplain = source !== 'schedule' && chosen ? chosen.explain : routine?.explain;
    const explain = rawExplain ? activityExplain(rawExplain) : undefined;
    const from = actor.placeId;
    const changed = state.activityId !== activityId || state.placeId !== placeId;
    actor.placeId = placeId;
    state.placeId = placeId;
    if (from !== placeId)
      ctx.emit({
        kind: 'activity.moved',
        data: { actorId: id, from, to: placeId },
        place: placeId,
        roles: [{ actor: id, role: 'agent' }],
        visibility: 'witnessed',
        ...(explain ? { explain } : {}),
      });
    if (changed) {
      state.activityId = activityId;
      state.since = ctx.now;
      state.lockedUntil = addHours(ctx.now, def.min_hours);
      state.source = source;
      if (def.at === 'kin') noteCall(world, id, placeId);
      ctx.emit({
        kind: 'activity.started',
        data: { actorId: id, activityId, placeId, source },
        place: placeId,
        roles: [{ actor: id, role: 'agent' }],
        visibility: def.asleep ? 'private' : 'witnessed',
        ...(explain ? { explain } : {}),
      });
    } else state.source = source;
  }
  recomputeOccupancy(world);
  // One announcement per place at a gathering's opening hour; occupants are already sorted.
  for (const key of Object.keys(ctx.content.observances).sort()) {
    const def = requiredRow(ctx.content.observances, key);
    if (!observanceActive(def, ctx.cal)) continue;
    for (const b of def.blocks) {
      if (!b.announce || !blockActive(b, ctx.cal)) continue;
      const previous = { ...ctx.cal, hour: (ctx.cal.hour + 23) % 24 };
      if (blockActive(b, previous)) continue;
      for (const pid of idsOf(world.activity.occupancy)) {
        const actorIds = requiredRow(world.activity.occupancy, pid).filter(
          (id) => world.activity.byActor[id]?.activityId === b.activity,
        );
        if (actorIds.length === 0) continue;
        ctx.emit({
          kind: 'activity.gathering',
          data: { observanceId: key, activityId: b.activity, actorIds, placeId: pid },
          roles: actorIds.map((actor) => ({ actor, role: 'participant' })),
          place: pid,
          importance: 15,
          visibility: 'public',
          explain: {
            kind: 'formula',
            label: def.name,
            subjects: actorIds,
            knowledge: 'public',
            terms: [{ source: 'place', label: 'Present', value: actorIds.length }],
            total: actorIds.length,
            outcome: 'gathered',
          },
        });
      }
    }
  }
}
