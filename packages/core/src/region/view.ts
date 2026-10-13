import type { ActorId } from '../ids.ts';
import type { World } from '../world.ts';
import { locationOf } from './api.ts';
export function regionView(world: World, perspective: ActorId) {
  if (!world.region) return null;
  const known = world.region.knownNodes[perspective] ?? [];
  return {
    name: world.region.definition.name,
    location: locationOf(world, perspective),
    destinations: world.region.definition.nodes
      .filter((n) => known.includes(n.id))
      .map((n) => ({ id: n.id, name: n.name })),
    journey: world.activity.journeys?.[perspective] ?? null,
  };
}
