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

/**
 * Director hook N9 (DIRECTOR-PLAN §2), defaulting to no bias: `thresholdTilt(process, key)`,
 * at most DC −2 on an unseen detect check of a sign or a shortfall. Never consulted for a
 * concealed attribute, and nothing the PC could perceive.
 */
export { thresholdTiltFor as thresholdTilt } from '../director/bias.ts';
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
// Refusal costs (wave 6): the keeper's duty-guilt, the refused side's costs, and the theft hook.
export { charmCovetPressure, charmGuilt, charmRefused, guiltToward } from './refusal.ts';
export { faeSystem as regionFaeHour } from './system.ts';
export { tieWindow } from './tend.ts';
export { auditCharmTheft, recordCharmTheft } from './theft.ts';
export { loanTerms, nextSundayNoon } from './urges.ts';
export { type CharmCard, charmView, describe, signs } from './view.ts';

/** Households with an open, not yet discovered draw on their stores (Director N9 targeting; read-only). */
export function undiscoveredDrawHouseholds(world: World): number[] {
  const out = new Set<number>();
  for (const k of Object.keys(world.fae.drawCases ?? {}).sort()) {
    const dc = world.fae.drawCases?.[k];
    if (dc && !dc.accepted && dc.undiscovered > 0 && dc.householdId !== null) out.add(dc.householdId);
  }
  return [...out].sort((a, b) => a - b);
}
