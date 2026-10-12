import type { Place } from '../actor.ts';
import type { PlaceId } from '../ids.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { isProtectedSite } from './sites.ts';

export { isProtectedSite } from './sites.ts';
export function effectiveFi(world: World, place: Place | PlaceId, t = world.time): number {
  const p = typeof place === 'number' ? world.places[place] : place;
  if (!p || isProtectedSite(p)) return 0;
  const c = calendarAt(asGameMinute(t));
  const festival =
    (c.month === 4 && c.day === 30) || (c.month === 6 && c.day === 24) ? 1 : c.month === 10 && c.day === 31 ? 2 : 0;
  return Math.max(
    0,
    Math.min(
      5,
      p.faeIntensity +
        world.fae.fiShift +
        (p.tags.includes('spring') ? 1 : 0) +
        festival +
        (world.fae.aura[p.id] ?? 0) +
        ((world.fae.incursion[p.id] ?? 0) > t ? 1 : 0),
    ),
  );
}
export function episodesAt(world: World, placeId: PlaceId) {
  return Object.keys(world.fae.episodes)
    .sort()
    .flatMap((id) => {
      const e = world.fae.episodes[id];
      return e && e.snapshot.placeId === placeId && e.traceEnd >= world.time ? [e] : [];
    });
}
export {
  charmKeepWeight,
  charmTransferred,
  grantLook,
  noteItemInteraction,
  restitutionMade,
  restitutionOwed,
} from './arc.ts';
export type { CharmForecastRow } from './forecast.ts';
export { investigate, investigationEligibility } from './investigate.ts';
export { tieWindow } from './tend.ts';
export { loanTerms, nextSundayNoon } from './urges.ts';
export { type CharmCard, charmView, describe, signs } from './view.ts';
