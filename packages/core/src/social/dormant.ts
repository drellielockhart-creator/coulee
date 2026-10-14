/** Lazy upkeep without encounters, arbitration, new feelings or arrival-time rolls. */
import type { ContentBundle } from '../content.ts';
import type { ActorId } from '../ids.ts';
import type { World } from '../world.ts';
import { decayMemoriesDaily } from './memory.ts';
import { dailyOpinionUpkeep, pruneCooldowns } from './opinion.ts';

export function dormantSocialDecay(world: World, content: ContentBundle, ids: readonly ActorId[], days: number): void {
  // Shared integer decay kernels on an owner-local facade. These are monotone bounded
  // integers; after 1001 days all decaying quantities have reached their fixed point.
  const memoriesByOwner = Object.fromEntries(ids.map((id) => [id, world.social.memoriesByOwner[id] ?? []]));
  const opinions = Object.fromEntries(ids.map((id) => [id, world.social.opinions[id] ?? {}]));
  const view: World = { ...world, region: undefined, social: { ...world.social, memoriesByOwner, opinions } };
  for (let day = 0; day < Math.min(1001, days); day++) {
    decayMemoriesDaily(view, content);
    dailyOpinionUpkeep(view, content);
  }
  pruneCooldowns(view, world.time);
}

export function dormantMarriage(world: World, content: ContentBundle, a: ActorId, b: ActorId): boolean {
  if (world.social.relationships.some((r) => r.kind === 'spouse' && [a, b].some((id) => r.a === id || r.b === id)))
    return false;
  world.social.relationships.push({ a, b, kind: 'spouse', since: world.time, amountCents: null });
  refreshBase(world, content, a, b);
  return true;
}

import { refreshBase } from './opinion.ts';
