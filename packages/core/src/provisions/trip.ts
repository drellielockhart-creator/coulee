/** Trip forecast: private execution of the same completed road intervals and supply kernels. */
import {
  advanceJourneys,
  clearMinuteBudget,
  finishJourneys,
  minuteBudget,
  prepareJourneys,
  startJourney,
  type TravelOrder,
  travelInterval,
} from '../activity/api.ts';
import type { ContentBundle } from '../content.ts';
import type { Explain } from '../explain.ts';
import { forecastHems } from '../fae/forecast.ts';
import { type ActorId, type ItemId, rowsOf } from '../ids.ts';
import { loadReport, rootOf } from '../items/api.ts';
import { itineraryNeedsHour } from '../needs/api.ts';
import { environmentAt } from '../region/api.ts';
import { makeContext } from '../sim/sim.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { foodServings, holderSupply } from './meals.ts';
import { provisionsSystem } from './system.ts';
export interface TripReadiness {
  destination: string;
  elapsedMinutes: number;
  walkingMinutes?: number;
  arrivalTime: number;
  arrived: boolean;
  boundaryMinutes: 60;
  waterUsedMl: number;
  waterLeftMl: number;
  fuelUsed: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  freshPoints: number;
  foods: Array<{ id: string; name: string; servingsPm: number; remainingPm: number; spoilage: number }>;
  loadPct: number;
  needs: Record<string, number>;
  warnings: string[];
  uncertainty: string[];
  risks?: string[];
  explain: Explain;
}
/** Read-only forecast; never executes social/future fae checks or reveals hidden charm state. */
export function tripReadiness(
  world: World,
  content: ContentBundle,
  id: ActorId,
  order: TravelOrder,
): TripReadiness | string {
  const projection: World = JSON.parse(JSON.stringify(world));
  const warnings: string[] = [];
  const risks = order.edgeIds.flatMap((eid) => {
    const edge = world.region?.definition.edges.find((e) => e.id === eid);
    return edge
      ? [
          `${edge.name}: ${edge.distance_ft} feet; crossings: ${edge.crossings.join(', ') || 'none recorded'}; hazards: ${edge.hazards.join(', ') || 'none recorded'}.`,
          ...(edge.crossings.length || edge.hazards.length
            ? [
                `Crossing/hazard decisions on ${edge.name} are not supported yet; this estimate assumes passage without delay.`,
              ]
            : []),
        ]
      : [];
  });
  // Preview known routes even when a future crossing currently prevents an executable order.
  for (const edge of projection.region?.definition.edges ?? []) {
    edge.crossings = [];
    edge.hazards = [];
  }
  // Only this traveler receives physiology and provisioning. No distant household or social projection.
  const actor = projection.actors[id];
  if (!actor) return 'No traveler';
  projection.actors = { [id]: actor };
  if (projection.region && !projection.region.definition.fixed_weather) {
    const environment = environmentAt(world);
    projection.region.definition.fixed_weather = {
      temperature_f: environment.temperatureF,
      raining: environment.raining,
    };
  }
  projection.households = {};
  projection.provisions.stores = {};
  projection.provisions.settings.npcBuying = false;
  const begin = makeContext(projection, content, []);
  const existing = projection.activity.journeys?.[id];
  if (existing && existing.status !== 'arrived') {
    if (existing.destinationNodeId !== order.destinationNodeId) return 'Preview the current journey destination';
    existing.campPolicy = 'auto';
    if (existing.status === 'stopped') existing.status = 'walking';
    existing.pendingInterruption = null;
  } else {
    const refusal = startJourney(
      projection,
      begin,
      id,
      { ...order, campPolicy: 'auto' },
      { kind: 'command', issuer: { kind: 'player' } },
    );
    if (refusal) return refusal;
  }
  const carried = () =>
    rowsOf(projection.items.stacks).filter((s) => {
      const root = rootOf(projection, s);
      return root.kind === 'actor' && root.actorId === id;
    });
  // A trip cannot draw on or forecast vermin in any remote pantry.
  projection.items.stacks = Object.fromEntries(carried().map((s) => [s.id, s]));
  const initial = new Map<ItemId, number>(carried().map((s) => [s.id, Math.round(foodServings(content, s) * 1000)]));
  const foodDefs = new Map(
    carried()
      .filter((s) => content.items[s.defId]?.food)
      .map((s) => [s.id, s.defId]),
  );
  const water = () => carried().reduce((n, s) => n + (s.waterMl ?? 0), 0);
  const hems = forecastHems(world, content, [id], carried());
  const waterStart = water(),
    fuelStart = holderSupply(projection, content, { actorId: id }, 'fire');
  let elapsedMinutes = 0,
    kcal = 0,
    proteinG = 0,
    fatG = 0,
    freshPoints = 0;
  const start = world.time;
  const uncertainty = new Set<string>();
  const initialJourney = projection.activity.journeys?.[id];
  if (!initialJourney) return 'No journey';
  // Also retain a complete conditional itinerary if known shortages stop the supply projection.
  let nominal = { segment: initialJourney.segment, feet: initialJourney.feet, remainder: initialJourney.remainder },
    nominalElapsed = 0,
    nominalWalking = 0;
  const speed = loadReport(projection, content, id).band.speedPct;
  if (speed === 0) return 'Your load prevents walking; lighten it before previewing arrival';
  let daily = initialJourney.dailyWalkingMinutes,
    day = calendarAt(start).dayIndex;
  while (nominal.segment < initialJourney.legs.length) {
    const cal = calendarAt(asGameMinute(start + nominalElapsed));
    if (day !== cal.dayIndex) {
      day = cal.dayIndex;
      daily = 0;
    }
    const limit = projection.region?.definition.walking_minutes_per_day ?? 480;
    if (daily >= limit) {
      nominalElapsed += 480;
      continue;
    }
    const interval = travelInterval(
      initialJourney.legs,
      nominal,
      speed,
      Math.min(nominalElapsed === 0 ? minuteBudget(projection, id).remaining : 60, limit - daily),
    );
    nominal = interval;
    nominalElapsed += 60;
    nominalWalking += interval.movingMinutes;
    daily += interval.movingMinutes;
  }
  let walkingMinutes = 0;
  for (let hour = 0; hour < 168; hour++) {
    const beforeIntake = { ...projection.provisions.nutrition[id]?.today };
    const ctx = makeContext(projection, content, [], (event) => {
      if (event.kind === 'provisions.meal' && event.data.actorId === id) {
        kcal += event.data.kcal;
      }
    });
    const leg = projection.activity.journeys?.[id]?.legs[projection.activity.journeys?.[id]?.segment ?? 0];
    const road = world.region?.definition.edges.find((e) => e.id === leg?.edgeId)?.name ?? 'the road';
    const when = `${String(ctx.cal.hour).padStart(2, '0')}:00, day ${ctx.cal.dayIndex + 1}, on ${road}`;
    // Known stochastic kernels report their checks and assume no mishap. Guard every other stream.
    ctx.rng = () => {
      throw new Error('Trip forecast attempted an unlabelled future check');
    };
    ctx.rngAt = () => {
      throw new Error('Trip forecast attempted an unlabelled future check');
    };
    const journey = projection.activity.journeys?.[id];
    if (journey?.status === 'camp' && (journey.campUntil ?? 0) <= ctx.now) {
      journey.status = 'walking';
      journey.campUntil = null;
    }
    prepareJourneys(projection, ctx);
    walkingMinutes += journey?.interval?.movingMinutes ?? 0;
    itineraryNeedsHour(projection, ctx);
    advanceJourneys(projection, ctx);
    provisionsSystem(projection, ctx, {
      hems,
      vermin: (food, risk) => {
        if (risk > 0)
          uncertainty.add(
            `Uncertain vermin check at ${when}: ${food}, ${risk}/1000 risk; assumes no loss. A loss would leave less food, and could require a resupply delay.`,
          );
      },
      preparation: (label) =>
        uncertainty.add(
          `Uncertain ${label} at ${when}; assumes success. Failure wastes provisions and may delay the journey.`,
        ),
    });
    finishJourneys(projection, ctx, (reason) => {
      if (!warnings.includes(reason)) warnings.push(reason);
    });
    const afterIntake = projection.provisions.nutrition[id]?.today;
    if (afterIntake) {
      const sameDay = beforeIntake.dayIndex === afterIntake.dayIndex;
      proteinG += afterIntake.proteinG - (sameDay ? (beforeIntake.proteinG ?? 0) : 0);
      fatG += afterIntake.fatG - (sameDay ? (beforeIntake.fatG ?? 0) : 0);
      freshPoints += afterIntake.freshPoints - (sameDay ? (beforeIntake.freshPoints ?? 0) : 0);
    }
    clearMinuteBudget(projection, id);
    projection.time = asGameMinute(projection.time + 60);
    elapsedMinutes += 60;
    const j = projection.activity.journeys?.[id];
    if (j?.status === 'arrived' || j?.status === 'stopped') break;
  }
  const journey = projection.activity.journeys?.[id];
  const arrived = journey?.status === 'arrived';
  const foods = [...foodDefs].map(([sid, defId]) => {
    const stack = projection.items.stacks[sid];
    const remainingPm = stack ? Math.round(foodServings(content, stack) * 1000) : 0;
    return {
      id: defId,
      name: content.items[defId]?.name ?? defId,
      servingsPm: (initial.get(sid) ?? 0) - remainingPm,
      remainingPm,
      spoilage: stack?.spoilage ?? 0,
    };
  });
  const values = { ...projection.needs.byActor[id]?.values };
  if (!arrived)
    warnings.push(journey?.pendingInterruption ?? 'Forecast stops before arrival; review camp or supplies.');
  if (water() === 0) warnings.push('No carried water remains.');
  if ((values.rest ?? 1000) < 400) warnings.push('Rest will be low; plan a camp.');
  const elapsedToArrival = arrived ? elapsedMinutes : nominalElapsed;
  const environment = environmentAt(world);
  risks.push(
    `Weather: ${environment.temperatureF}°F, ${environment.raining ? 'rain; exposed gear may get wet' : 'dry'}${world.region?.definition.fixed_weather ? ' (fixed authored weather)' : '; departure weather assumed throughout'}.`,
  );
  for (let minute = 0; minute < elapsedToArrival; minute += 60) {
    if (!calendarAt(asGameMinute(start + minute)).isDaylight) {
      risks.push(
        'Night/dark travel: reduced visibility along the route; footing and navigation are harder. No navigation check is scheduled on this route.',
      );
      break;
    }
  }
  if (!calendarAt(start).isDaylight) warnings.push('Consider leaving at dawn: wait until dawn, then route again.');
  return {
    destination:
      world.region?.definition.nodes.find((n) => n.id === order.destinationNodeId)?.name ?? order.destinationNodeId,
    elapsedMinutes: elapsedToArrival,
    walkingMinutes: arrived ? walkingMinutes : nominalWalking,
    arrivalTime: start + elapsedToArrival,
    arrived,
    boundaryMinutes: 60,
    waterUsedMl: waterStart - water(),
    waterLeftMl: water(),
    fuelUsed: fuelStart - holderSupply(projection, content, { actorId: id }, 'fire'),
    kcal,
    proteinG,
    fatG,
    freshPoints,
    foods,
    loadPct: loadReport(projection, content, id).loadPct,
    needs: values,
    warnings,
    risks,
    uncertainty: [
      ...(world.region?.definition.fixed_weather
        ? ['Fixed authored weather; excludes encounters and unknown magic.']
        : ['Departure weather held constant; changing weather and encounters remain uncertain.']),
      ...uncertainty,
      ...(!arrived
        ? [
            `Supply projection covers only the first ${elapsedMinutes / 60} hours: arrival above assumes the shortage/stop is resolved; re-plan after tending to it.`,
          ]
        : []),
    ],
    explain: {
      kind: 'formula',
      label: 'Trip forecast: shared hourly itinerary and provision kernels',
      subjects: [id],
      knowledge: 'self',
      terms: [{ source: 'travel', label: 'Completed hourly intervals in minutes', value: elapsedMinutes }],
      total: elapsedMinutes,
      outcome: arrived ? 'arrival' : 'decision required',
    },
  };
}
