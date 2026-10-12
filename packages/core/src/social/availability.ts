/** Read-only command/menu preflight; shares structural eligibility with social resolution. */

import { currentActivity, isAsleep, scheduledBlock } from '../activity/api.ts';
import type { ContentBundle } from '../content.ts';
import type { ActorId } from '../ids.ts';
import { canAct } from '../needs/api.ts';
import { makeContext } from '../sim/sim.ts';
import { calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { ageYears, tuningOf } from './tuning.ts';
import { makePair, requiresFail } from './volition.ts';
export function interactionAvailability(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  targetId: ActorId,
  interactionId: string,
): { ok: boolean; reason?: string } {
  const actor = world.actors[actorId],
    target = world.actors[targetId],
    def = content.interactions[interactionId];
  const no = (reason: string) => ({ ok: false, reason });
  if (!actor || !target || !def) return no('Unknown person or interaction');
  if (!canAct(world, actorId) || !canAct(world, targetId)) return no('An incapacitated person cannot converse');
  const name = `${target.name.given} ${target.name.family}`.trim();
  if (!target.alive || target.placeId !== actor.placeId) return no(`${name} is not here`);
  const ctx = makeContext(world, content, []);
  // An infant is carried about, not talked with: social never puts one in a conversation.
  if (ageYears(target, world.time) < tuningOf(content).min_social_age) return no(`${name} is too young to talk with`);
  const block = scheduledBlock(world, ctx, targetId, calendarAt(world.time));
  const state = currentActivity(world, targetId);
  if (state?.travel) return no(`${name} is leaving for ${world.places[state.travel.to]?.name ?? 'another place'}`);
  // Activity runs before social at this same clock boundary. Check the imminent schedule too.
  if (isAsleep(world, ctx, targetId) || (block && content.activities[block.activity]?.asleep))
    return no(`${name} is asleep`);
  if (block && content.activities[block.activity]?.at === 'workplace')
    return no(
      `${name} is at work at ${world.places[state?.workplaceId ?? target.placeId]?.name ?? 'their workplace'} until ${String(block.to).padStart(2, '0')}:00`,
    );
  const own = currentActivity(world, actorId);
  if (own?.lockedUntil != null && own.lockedUntil > world.time) return no('Your current activity is still locked');
  if (
    state?.lockedUntil != null &&
    state.lockedUntil > world.time &&
    content.activities[state.activityId ?? '']?.at === 'workplace'
  )
    return no(`${name} is at work`);
  const pair = makePair(world, ctx, actorId, targetId, actor.placeId, 0);
  const reason = pair ? requiresFail(pair, def, 'urge') : 'unavailable';
  if (reason === 'cooldown')
    return no(
      interactionId === 'court'
        ? `You have already courted ${name} today; wait for its cooldown`
        : `You have already used ${def.name.toLowerCase()} with ${name}; wait for its cooldown`,
    );
  return reason ? no(`${def.name} with ${name}: ${reason}`) : { ok: true };
}
