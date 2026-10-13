/** Short-order policy shared by every PlaySession host. */
import { activity, type Command, items, type Sim } from '@coulee/core';

export function shortMinutes(sim: Sim, command: Command): number | null {
  const { world: w, content: c } = sim;
  if (w.tactical?.active) return null;
  const timing = c.playTiming?.town;
  if (!timing || activity.shortActBlock(w, c, command.actorId)) return null;
  if (command.kind === 'provisions.buy' || command.kind === 'provisions.sell') return timing.purchase_minutes;
  if (command.kind !== 'core.urge') return null;
  const u = command.data.urge;
  if (u.kind === 'interaction') {
    const def = c.interactions[u.interactionId];
    const minutes = def?.short_act ? def.minutes : undefined;
    return minutes !== undefined && minutes < 60 ? minutes : null;
  }
  if (u.kind !== 'activity' || u.activityId !== 'walk' || u.placeId === undefined) return null;
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
  const pace = items.loadReport(w, c, command.actorId).band.speedPct;
  if (pace === 0) return null;
  const minutes = Math.max(1, Math.ceil((activity.walkMinutes(w, c, actor.placeId, u.placeId) * 100) / pace));
  return minutes <= timing.walk_limit_minutes ? minutes : null;
}
