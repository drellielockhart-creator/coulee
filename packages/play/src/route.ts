import {
  type ActorId,
  asGameMinute,
  calendarAt,
  items,
  type provisions,
  region,
  type Sim,
  provisions as supplies,
  timeView,
} from '@coulee/core';

export interface RouteCheck {
  id: 'food' | 'water' | 'warmth' | 'load' | 'light';
  label: string;
  status: 'ok' | 'short' | 'watch' | 'unknown';
  detail: string;
}

/** Fair, read-only presentation of the shared trip forecast. No alternate travel or supply rules. */
export interface RoutePreview {
  nodeId: string;
  at: number;
  destination: string;
  distanceFt: number;
  departure: string;
  arrival: string;
  legs: Array<{ edgeId: string; name: string; from: string; to: string; distanceFt: number }>;
  forecast: provisions.TripReadiness;
  checks: RouteCheck[];
  weather: { temperatureF: number; raining: boolean };
}

export function routePreviewOf(
  sim: Sim,
  pc: ActorId,
  nodeId: string,
  edgeIds: readonly string[],
  forecast: provisions.TripReadiness,
): RoutePreview {
  const { world, content } = sim;
  const map = region.regionView(world, pc)?.map;
  const location = map ? world.activity.journeys?.[pc] : undefined;
  let from = map?.currentNodeId ?? location?.legs[location.segment]?.from ?? '';
  const name = (id: string) => map?.sites.find((n) => n.id === id)?.name ?? id;
  const legs = edgeIds.flatMap((edgeId) => {
    const road = map?.roads.find((e) => e.id === edgeId);
    if (!road) return [];
    const to = road.a === from ? road.b : road.a;
    const leg = { edgeId, name: road.name, from: name(from), to: name(to), distanceFt: road.distanceFt };
    from = to;
    return [leg];
  });
  const needCheck = (id: RouteCheck['id'], label: string, needId: string, detail: string): RouteCheck => {
    const value = forecast.needs[needId];
    const band = content.needs[needId]?.bands
      .filter((b) => value !== undefined && value < b.below)
      .sort((a, b) => a.below - b.below)[0];
    return {
      id,
      label,
      status: value === undefined ? 'unknown' : band?.condition ? 'short' : band ? 'watch' : 'ok',
      detail: `${detail} · ${band?.label ?? (value === undefined ? 'not projected' : 'satisfied')} (${value ?? '?'}/1000)`,
    };
  };
  const siteId = world.region?.definition.nodes.find((n) => n.id === nodeId)?.site;
  const sources = Object.values(world.places).filter(
    (p) => p.siteId === siteId && supplies.isWaterSource(world, content, p.id),
  );
  forecast = { ...forecast, warnings: [...forecast.warnings] };
  if (!sources.length)
    forecast.warnings.push(
      `No reachable water source recorded at ${forecast.destination}; carry water for your stay and return.`,
    );
  const checks: RouteCheck[] = [
    needCheck('food', 'Food', 'hunger', `${forecast.kcal} kcal eaten`),
    needCheck('water', 'Water', 'thirst', `${forecast.waterUsedMl} ml used; ${forecast.waterLeftMl} ml left`),
    needCheck('warmth', 'Warmth', 'warmth', 'Projected warmth'),
  ];
  const water = checks.find((c) => c.id === 'water');
  if (water) {
    water.detail += sources.length
      ? ` · Destination water: ${sources.map((p) => p.name).join(', ')}`
      : ' · No destination water source recorded';
    if (!sources.length && water.status === 'ok') water.status = 'watch';
  }
  if (forecast.waterLeftMl === 0 && water && water.status !== 'short') water.status = 'watch';
  const load = items.loadReport(world, content, pc);
  checks.push({
    id: 'load',
    label: 'Load',
    status: load.band.speedPct === 0 ? 'short' : load.band.speedPct < 100 ? 'watch' : 'ok',
    detail: `${load.band.label}, ${load.loadPct}% at departure; ${forecast.loadPct}% projected · walking speed ${load.band.speedPct}%`,
  });
  let dark = false;
  for (let t: number = world.time; t < forecast.arrivalTime; t += forecast.boundaryMinutes)
    if (!calendarAt(asGameMinute(t)).isDaylight) {
      dark = true;
      break;
    }
  checks.push({
    id: 'light',
    label: 'Light',
    status: dark ? 'watch' : 'ok',
    detail: dark
      ? 'Includes dark travel; reduced visibility. Consider leaving at dawn.'
      : 'Daylight throughout the estimated journey.',
  });
  // A forecast stopped early cannot certify the rest of the route.
  if (!forecast.arrived)
    for (const check of checks)
      if (check.id !== 'light' && check.id !== 'load' && check.status === 'ok') check.status = 'unknown';
  return {
    nodeId,
    at: world.time,
    destination: forecast.destination,
    distanceFt: legs.reduce((total, leg) => total + leg.distanceFt, 0),
    departure: timeView(world.time).stamp,
    arrival: timeView(forecast.arrivalTime).stamp,
    legs,
    forecast,
    checks,
    weather: region.environmentAt(world),
  };
}
