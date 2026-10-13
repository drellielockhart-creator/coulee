/** Pure integer travel arithmetic; grade is already included in directed authored minutes. */
export interface JourneyLeg {
  edgeId: string;
  direction: 'ab' | 'ba';
  from: string;
  to: string;
  distanceFt: number;
  costMinutes: number;
}
export interface Progress {
  segment: number;
  feet: number;
  remainder: number;
}
export interface TravelInterval extends Progress {
  movingMinutes: number;
  waitingMinutes: number;
  arrived: boolean;
}
/** Minute boundaries carry fractional feet and unused minutes across junctions. */
export function travelInterval(
  legs: readonly JourneyLeg[],
  start: Progress,
  speedPct: number,
  budget = 60,
): TravelInterval {
  let { segment, feet, remainder } = start;
  let movingMinutes = 0;
  while (movingMinutes < budget && segment < legs.length && speedPct > 0) {
    const leg = legs[segment];
    if (!leg) break;
    const denominator = leg.costMinutes * 100;
    const numerator = leg.distanceFt * speedPct + remainder;
    feet += Math.floor(numerator / denominator);
    remainder = numerator % denominator;
    movingMinutes++;
    if (feet >= leg.distanceFt) {
      segment++;
      feet = 0;
      remainder = 0;
    }
  }
  return {
    segment,
    feet,
    remainder,
    movingMinutes,
    waitingMinutes: 60 - movingMinutes,
    arrived: segment === legs.length,
  };
}
