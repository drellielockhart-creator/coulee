/** Gear contributions to the owning needs thermal ledger; no second warmth meter. */
import type { ContentBundle } from '../content.ts';
import { term } from '../explain.ts';
import type { ActorId } from '../ids.ts';
import { isRaining } from '../provisions/temperature.ts';
import { mixKey, rng } from '../rng.ts';
import { calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { carriedBy, type InventoryIndex, stackAffordance, stacksDeep } from './api.ts';

export function campThermal(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  resting: boolean,
  index?: InventoryIndex,
) {
  const actor = world.actors[actorId];
  const place = actor && world.places[actor.placeId];
  if (!actor || !place || ['building', 'house'].includes(place.kind)) return { bonusF: 0, shelter: 0, terms: [] };
  let insulation = 0,
    shelter = 0,
    ground = 0;
  for (const { stack } of stacksDeep(world, carriedBy(actorId), index)) {
    if (!resting) continue;
    const wool = content.items[stack.defId]?.tags.includes('wool');
    const dryPct = 100 - Math.floor((stack.wetness * (wool ? 30 : 65)) / 100);
    insulation = Math.max(insulation, Math.floor((stackAffordance(content, stack, 'insulate') * dryPct) / 1000));
    shelter = Math.max(shelter, stackAffordance(content, stack, 'shelter'));
    ground = Math.max(ground, stackAffordance(content, stack, 'ground'));
  }
  const cal = calendarAt(world.time);
  const gust = rng(world.meta.seed, 'weather', cal.dayIndex, mixKey(0x77696e64, cal.hour)).int(3, 12);
  const wind = Math.max(0, gust - Math.floor(shelter / 2));
  const wet = isRaining(world.meta.seed, cal) ? Math.max(0, 10 - Math.floor(shelter / 2) - ground) : 0;
  const fire = world.provisions.fires[actor.placeId];
  const warmth = resting && fire?.lit && (fire.until ?? 0) > world.time ? 20 : 0;
  return {
    bonusF: insulation + warmth - wind - wet,
    shelter,
    terms: [
      term('gear', 'Bedding insulation after wetness (F)', insulation),
      term('weather', 'Wind after shelter (F)', -wind),
      term('weather', 'Rain after shelter/groundsheet (F)', -wet),
      term('fire', 'Paid campfire warmth (F)', warmth),
    ],
  };
}
