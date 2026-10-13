/** Conditions sampled once at a window, using the existing temperature and precipitation hooks. */
import type { Place } from '../actor.ts';
import type { ContentBundle } from '../content.ts';
import { rowsOf } from '../ids.ts';
import { allStacks, rootOf } from '../items/api.ts';
import { airTempF, isRaining } from '../provisions/api.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { World } from '../world.ts';

/** One inventory pass for every opening window; containers and carried iron count at their actual place. */
export function ironByPlace(world: World, content: ContentBundle): Record<number, number> {
  const iron: Record<number, number> = {};
  for (const stack of allStacks(world)) {
    const def = content.items[stack.defId];
    if (!def || stack.qty <= 0) continue;
    const pct = def.materials.reduce(
      (sum, m) => sum + (['iron', 'cold_iron', 'steel', 'tinplate'].includes(m.material) ? m.pct : 0),
      0,
    );
    if (!pct) continue;
    const root = rootOf(world, stack);
    const place =
      root.kind === 'actor'
        ? world.actors[root.actorId]?.placeId
        : root.kind === 'household'
          ? world.households[root.householdId]?.homePlaceId
          : root.kind === 'place'
            ? root.placeId
            : undefined;
    if (place !== undefined) iron[place] = (iron[place] ?? 0) + Math.floor((def.weight_g * stack.qty * pct) / 100);
  }
  return iron;
}
export function weatherAt(world: World, p: Place, at: number, ctx: SimContext) {
  if (!ctx.rngAt) throw new Error('Weather snapshots require canonical-time RNG');
  const cal = calendarAt(asGameMinute(at));
  const rain = isRaining(world.meta.seed, cal, world);
  const snow = rain && airTempF(cal, world) <= 32;
  const thunder =
    rain &&
    airTempF(cal, world) >= 60 &&
    ctx.rngAt('weather', asGameMinute(cal.dayIndex * 1440), mixKey(0xfae6)).chancePermille(200);
  const fog =
    !rain &&
    p.tags.some((t) => ['coulee', 'creek', 'spring', 'ford'].includes(t)) &&
    (cal.hour < 8 || cal.hour >= 17) &&
    ctx.rngAt('weather', asGameMinute(cal.dayIndex * 1440), mixKey(0xfae7)).chancePermille(350);
  return { rain, snow, thunder, fog };
}
/** First frozen precipitation of each July–June season. Kept globally, not rerolled for each place. */
export function recordSnow(world: World, at: number, ctx: SimContext): void {
  const p = rowsOf(world.places)[0];
  if (!p) return;
  const c = calendarAt(asGameMinute(at));
  if (!weatherAt(world, p, at, ctx).snow) return;
  const season = c.year - (c.month < 7 ? 1 : 0);
  if (world.fae.snowSeason !== season) {
    world.fae.snowSeason = season;
    world.fae.firstSnowDay = c.dayIndex;
  }
}
