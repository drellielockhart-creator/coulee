/** Short-order policy shared by every PlaySession host. */
import { activity, type Command, items, provisions, type Sim } from '@coulee/core';

export function shortMinutes(sim: Sim, command: Command): number | null {
  const { world: w, content: c } = sim;
  if (w.tactical || c.scenarios[w.meta.scenarioId]?.tactical_scene) return null;
  const timing = c.playTiming?.town;
  if (!timing) return null;
  const cost = timing.short_acts?.[command.kind as keyof NonNullable<typeof timing.short_acts>];
  if (cost !== undefined) return cost;
  if (activity.shortActBlock(w, c, command.actorId)) return null;
  if (command.kind === 'provisions.buy' || command.kind === 'provisions.sell') return timing.purchase_minutes;
  if (command.kind !== 'core.urge') return null;
  const u = command.data.urge;
  if (u.kind === 'interaction') {
    const def = c.interactions[u.interactionId];
    const minutes = def?.short_act ? def.minutes : undefined;
    return minutes !== undefined && minutes < 60 ? minutes : null;
  }
  if (u.kind !== 'activity') return null;
  const def = c.activities[u.activityId];
  if (def?.short_act && def.minutes !== undefined) {
    if (u.activityId !== 'fetch_water') return def.minutes;
    const source = provisions.nearestWaterSource(w, c, command.actorId);
    if (!source) return null;
    const walk = localWalkMinutes(sim, command.actorId, source.placeId);
    return walk !== null && walk <= timing.walk_limit_minutes ? walk + def.minutes : null;
  }
  if (u.activityId !== 'walk' || u.placeId === undefined) return null;
  const actor = w.actors[command.actorId],
    state = w.activity.byActor[command.actorId];
  if (!actor || state?.travel || activity.onJourney(w, command.actorId)) return null;
  if (
    state?.lockedUntil !== null &&
    state?.lockedUntil !== undefined &&
    state.lockedUntil > w.time &&
    !c.activities[state.activityId ?? '']?.asleep
  )
    return null;
  const minutes = localWalkMinutes(sim, command.actorId, u.placeId);
  return minutes !== null && minutes <= timing.walk_limit_minutes ? minutes : null;
}

/** The same load-adjusted walking cost used by execution and menu labels. */
export function localWalkMinutes(
  sim: Sim,
  actorId: Command['actorId'],
  to: NonNullable<Parameters<typeof activity.walkMinutes>[3]>,
): number | null {
  const actor = sim.world.actors[actorId];
  const pace = items.loadReport(sim.world, sim.content, actorId).band.speedPct;
  if (!actor || pace === 0) return null;
  if (actor.placeId === to) return 0;
  return Math.max(1, Math.ceil((activity.walkMinutes(sim.world, sim.content, actor.placeId, to) * 100) / pace));
}
