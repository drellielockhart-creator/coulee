/** Trip forecast: private execution of the same completed road intervals and supply kernels. */
import { advanceJourneys, finishJourneys, prepareJourneys, startJourney, type TravelOrder } from '../activity/api.ts';
import type { ContentBundle } from '../content.ts';
import type { Explain } from '../explain.ts';
import { forecastHems } from '../fae/forecast.ts';
import { type ActorId, type ItemId, rowsOf } from '../ids.ts';
import { loadReport, rootOf } from '../items/api.ts';
import { itineraryNeedsHour } from '../needs/api.ts';
import { environmentAt } from '../region/api.ts';
import { makeContext } from '../sim/sim.ts';
import { asGameMinute } from '../time.ts';
import type { World } from '../world.ts';
import { foodServings, holderSupply } from './meals.ts';
import { provisionsSystem } from './system.ts';
export interface TripReadiness {
  destination: string;
  elapsedMinutes: number;
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
  explain: Explain;
}
/** Read-only forecast; never executes social/future fae checks or reveals hidden charm state. */
export function tripReadiness(
  world: World,
  content: ContentBundle,
  id: ActorId,
  order: TravelOrder,
): TripReadiness | string {
  let projection: World = JSON.parse(JSON.stringify(world));
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
  const refusal = startJourney(projection, begin, id, order, { kind: 'command', issuer: { kind: 'player' } });
  if (refusal) return refusal;
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
  const uncertainCheck = {};
  let checkAhead = false;
  for (let hour = 0; hour < 168; hour++) {
    const checkpoint = JSON.stringify(projection),
      priorKcal = kcal;
    const beforeIntake = { ...projection.provisions.nutrition[id]?.today };
    const ctx = makeContext(projection, content, [], (event) => {
      if (event.kind === 'provisions.meal' && event.data.actorId === id) {
        kcal += event.data.kcal;
      }
    });
    // Never sample future cooking, vermin, survival or magic checks for a fair preview.
    ctx.rng = () => {
      throw uncertainCheck;
    };
    ctx.rngAt = () => {
      throw uncertainCheck;
    };
    try {
      prepareJourneys(projection, ctx);
      itineraryNeedsHour(projection, ctx);
      advanceJourneys(projection, ctx);
      provisionsSystem(projection, ctx, { hems });
      finishJourneys(projection, ctx);
    } catch (error) {
      if (error !== uncertainCheck) throw error;
      projection = JSON.parse(checkpoint);
      kcal = priorKcal;
      checkAhead = true;
      break;
    }
    const afterIntake = projection.provisions.nutrition[id]?.today;
    if (afterIntake) {
      const sameDay = beforeIntake.dayIndex === afterIntake.dayIndex;
      proteinG += afterIntake.proteinG - (sameDay ? (beforeIntake.proteinG ?? 0) : 0);
      fatG += afterIntake.fatG - (sameDay ? (beforeIntake.fatG ?? 0) : 0);
      freshPoints += afterIntake.freshPoints - (sameDay ? (beforeIntake.freshPoints ?? 0) : 0);
    }
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
  const warnings: string[] = [];
  if (checkAhead) warnings.push('A future check is uncertain; forecast stops before rolling it.');
  if (!arrived)
    warnings.push(journey?.pendingInterruption ?? 'Forecast stops before arrival; review camp or supplies.');
  if (water() === 0) warnings.push('No carried water remains.');
  if ((values.rest ?? 1000) < 400) warnings.push('Rest will be low; plan a camp.');
  return {
    destination:
      world.region?.definition.nodes.find((n) => n.id === order.destinationNodeId)?.name ?? order.destinationNodeId,
    elapsedMinutes,
    arrivalTime: start + elapsedMinutes,
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
    uncertainty: world.region?.definition.fixed_weather
      ? ['Fixed authored weather; excludes encounters and unknown magic.']
      : ['Departure weather held constant; changing weather, encounters and future checks remain uncertain.'],
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
