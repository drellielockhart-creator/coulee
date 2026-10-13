import type { Command } from '../command.ts';
import type { ContentBundle } from '../content.ts';
import type { Explain } from '../explain.ts';
import { type ActorId, idsOf, type PlaceId, type Table } from '../ids.ts';
import { loadReport } from '../items/api.ts';
import { canAct, needValue } from '../needs/api.ts';
import { drinkingWater, leaveRoadCamp, roadPreparationPending } from '../provisions/api.ts';
import { authorizeAct, type Basis } from '../psyche/api.ts';
import { nodeAt } from '../region/api.ts';
import { processesActor } from '../region/processing.ts';
import type { SimContext } from '../sim/context.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { recomputeOccupancy } from './state.ts';
import { tacticalPinned } from './tactical.ts';
import { type JourneyLeg, type TravelInterval, travelInterval } from './travel-rules.ts';
export interface TravelOrder {
  destinationNodeId: string;
  edgeIds: string[];
  pace: 'walk';
  campPolicy: 'ask' | 'auto';
}
export interface Journey {
  leader: ActorId;
  memberIds: ActorId[];
  transport: null;
  legs: JourneyLeg[];
  segment: number;
  feet: number;
  remainder: number;
  originNodeId: string;
  destinationNodeId: string;
  originEntrance: PlaceId;
  destinationEntrance: PlaceId;
  startedAt: number;
  dailyWalkingMinutes: number;
  walkingDay: number;
  campUntil: number | null;
  status: 'walking' | 'stopped' | 'camp' | 'arrived';
  campPolicy: 'ask' | 'auto';
  basis: Basis;
  pendingInterruption: string | null;
  suppliesWarned?: boolean;
  interval?: TravelInterval & { at: number };
}
export function onJourney(w: World, id: ActorId): boolean {
  const j = w.activity.journeys?.[id];
  return !!j && j.status !== 'arrived';
}
export function walking(w: World, id: ActorId): boolean {
  return onJourney(w, id) && w.activity.journeys?.[id]?.status === 'walking';
}
export function travelExplain(id: ActorId, label: string, total: number, outcome: string): Explain {
  return {
    kind: 'formula',
    label,
    subjects: [id],
    knowledge: 'self',
    terms: [{ source: 'travel', label: 'Integer feet along the directed road', value: total }],
    total,
    outcome,
  };
}
export function routeTo(w: World, id: ActorId, destination: string): string[] | null {
  const region = w.region,
    origin = nodeAt(w, id);
  if (!region || !origin || origin === destination || !region.knownNodes[id]?.includes(destination)) return null;
  const queue = [{ node: origin, edges: [] as string[] }],
    seen = new Set([origin]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (!current) continue;
    for (const e of [...region.definition.edges].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
      if (e.capability !== 'walk' || !e.available_months.includes(calendarAt(w.time).month)) continue;
      const next = e.a === current.node ? e.b : e.b === current.node ? e.a : null;
      if (!next || seen.has(next) || !region.knownNodes[id]?.includes(next)) continue;
      const edges = [...current.edges, e.id];
      if (next === destination) return edges;
      seen.add(next);
      queue.push({ node: next, edges });
    }
  }
  return null;
}
export function travelCheck(w: World, c: ContentBundle, id: ActorId, order: TravelOrder): string | null {
  if (!w.region?.transit[id]) return 'No regional road is installed for this actor';
  if (onJourney(w, id)) return 'Stop, resume, or turn back on your present journey';
  if (!canAct(w, id)) return 'Unable to travel';
  if (loadReport(w, c, id).band.speedPct === 0) return 'Your load prevents walking';
  if (order.pace !== 'walk' || !['ask', 'auto'].includes(order.campPolicy)) return 'Unsupported travel policy';
  let node = nodeAt(w, id);
  if (!node || !order.edgeIds.length || order.edgeIds.length > 64) return 'Choose a connected road';
  for (const eid of order.edgeIds) {
    const e = w.region.definition.edges.find((e) => e.id === eid);
    if (e?.capability !== 'walk' || !e.available_months.includes(calendarAt(w.time).month))
      return 'Road closed or requires unsupported transport';
    if (e.crossings.length || e.hazards.length)
      return 'This route requires a crossing or hazard decision not supported yet';
    node = e.a === node ? e.b : e.b === node ? e.a : null;
    if (!node || !w.region.knownNodes[id]?.includes(node)) return 'Route is disconnected or unknown';
  }
  return node === order.destinationNodeId && node !== nodeAt(w, id) ? null : 'Route does not reach that destination';
}
function emit(
  w: World,
  ctx: SimContext,
  id: ActorId,
  kind: 'departed' | 'stopped' | 'camp' | 'resumed' | 'turned_back',
  reason: string,
): void {
  const j = w.activity.journeys?.[id];
  ctx.emit({
    kind: 'activity.journey',
    data: { actorId: id, kind, reason },
    place: w.actors[id]?.placeId,
    roles: [{ actor: id, role: 'agent' }],
    visibility: 'private',
    explain: travelExplain(id, reason, j?.feet ?? 0, kind),
  });
}
export function startJourney(w: World, ctx: SimContext, id: ActorId, order: TravelOrder, basis: Basis): string | null {
  const refusal = travelCheck(w, ctx.content, id, order);
  const auth = authorizeAct(w, id, { kind: 'activity.travel' }, basis);
  if (refusal) return refusal;
  if (!auth.ok) return auth.reason;
  const r = w.region;
  if (!r) return 'No region';
  const origin = nodeAt(w, id);
  if (!origin) return 'No origin';
  let node = origin;
  const legs: JourneyLeg[] = order.edgeIds.map((eid) => {
    const edge = r.definition.edges.find((e) => e.id === eid);
    if (!edge) throw new Error('Validated road missing');
    const direction = edge.a === node ? 'ab' : 'ba';
    const from = node;
    node = direction === 'ab' ? edge.b : edge.a;
    return {
      edgeId: eid,
      direction,
      from,
      to: node,
      distanceFt: edge.distance_ft,
      costMinutes: edge.cost_minutes[direction],
    };
  });
  const originEntrance = r.sites[origin]?.entranceId,
    destinationEntrance = r.sites[order.destinationNodeId]?.entranceId;
  const actor = w.actors[id],
    state = w.activity.byActor[id],
    transit = r.transit[id];
  if (!actor || !state || transit === undefined || originEntrance === undefined || destinationEntrance === undefined)
    return 'Uninstalled entrance';
  w.activity.journeys ??= {};
  w.activity.journeys[id] = {
    leader: id,
    memberIds: [id],
    transport: null,
    legs,
    segment: 0,
    feet: 0,
    remainder: 0,
    originNodeId: origin,
    destinationNodeId: order.destinationNodeId,
    originEntrance,
    destinationEntrance,
    startedAt: ctx.now,
    dailyWalkingMinutes: 0,
    walkingDay: ctx.cal.dayIndex,
    campUntil: null,
    status: 'walking',
    campPolicy: order.campPolicy,
    basis,
    pendingInterruption: null,
  };
  actor.placeId = transit;
  state.placeId = transit;
  state.travel = null;
  state.activityId = 'walk';
  state.lockedUntil = null;
  state.source = basis.kind === 'command' ? 'command' : 'urge';
  state.since = ctx.now;
  emit(
    w,
    ctx,
    id,
    'departed',
    `Set off for ${r.definition.nodes.find((n) => n.id === node)?.name ?? node}. Hourly travel boundaries; carried supplies only.`,
  );
  recomputeOccupancy(w);
  return null;
}
export function journeyCommandCheck(w: World, c: ContentBundle, command: Command): string | null {
  if (command.kind === 'activity.travel') return travelCheck(w, c, command.actorId, command.data);
  const j = w.activity.journeys?.[command.actorId];
  if (!j || j.status === 'arrived') return 'No journey in progress';
  if (command.kind === 'activity.stop' && j.status === 'stopped') return 'Already stopped';
  if (command.kind === 'activity.camp' && j.status === 'camp') return 'Already camping';
  if (
    (command.kind === 'activity.resume' || command.kind === 'activity.turn_back') &&
    roadPreparationPending(w, command.actorId)
  )
    return 'Finish the roadside meal before walking';
  if (command.kind === 'activity.resume' && loadReport(w, c, command.actorId).band.speedPct === 0)
    return 'Your load prevents walking';
  if (
    command.kind === 'activity.resume' &&
    j.walkingDay === calendarAt(w.time).dayIndex &&
    j.dailyWalkingMinutes >= (w.region?.definition.walking_minutes_per_day ?? 480)
  )
    return 'Daily walking limit reached; camp or rest until tomorrow';
  if (command.kind === 'activity.resume' && j.status === 'walking') return 'Already walking';
  if (command.kind === 'activity.resume' && j.campUntil !== null && w.time < j.campUntil)
    return 'Finish the eight-hour camp first';
  return null;
}
function applyJourneyCommand(w: World, ctx: SimContext, command: Command): void {
  const id = command.actorId;
  const basis: Basis = { kind: 'command', issuer: command.issuer ?? { kind: 'player' } };
  if (!canAct(w, id) || !authorizeAct(w, id, { kind: command.kind }, basis).ok) return;
  if (command.kind === 'activity.travel') {
    startJourney(w, ctx, id, command.data, basis);
    return;
  }
  if (
    !['activity.stop', 'activity.resume', 'activity.turn_back', 'activity.camp'].includes(command.kind) ||
    journeyCommandCheck(w, ctx.content, command)
  )
    return;
  const j = w.activity.journeys?.[id];
  if (!j) return;
  j.basis = basis;
  j.pendingInterruption = null;
  if (command.kind === 'activity.stop') {
    j.status = 'stopped';
    j.campUntil = null;
    emit(w, ctx, id, 'stopped', 'Stopped on the road.');
  }
  if (command.kind === 'activity.camp') {
    j.status = 'camp';
    j.campUntil = ctx.now + 480;
    emit(w, ctx, id, 'camp', 'Camp for eight hours, using carried bedding and supplies.');
  }
  if (command.kind === 'activity.resume') {
    j.status = 'walking';
    j.campUntil = null;
    emit(w, ctx, id, 'resumed', 'Resumed the journey.');
  }
  if (command.kind === 'activity.turn_back') {
    const traversed = j.legs.slice(0, j.segment + 1).reverse();
    const current = traversed[0];
    if (!current) return;
    const progress = j.feet;
    j.legs = traversed.map((l) => {
      const e = w.region?.definition.edges.find((e) => e.id === l.edgeId);
      const direction = l.direction === 'ab' ? 'ba' : 'ab';
      return { ...l, direction, from: l.to, to: l.from, costMinutes: e?.cost_minutes[direction] ?? l.costMinutes };
    });
    j.segment = 0;
    j.feet = current.distanceFt - progress;
    j.remainder = 0;
    const previousOrigin = j.originNodeId,
      previousEntrance = j.originEntrance;
    j.originNodeId = current.to;
    j.originEntrance = w.region?.sites[current.to]?.entranceId ?? j.destinationEntrance;
    j.destinationNodeId = previousOrigin;
    j.destinationEntrance = previousEntrance;
    j.status = 'walking';
    j.campUntil = null;
    emit(w, ctx, id, 'turned_back', 'Turned back toward the departure entrance.');
  }
}
/** Foundation calls before needs: this hour's road context replaces the old scheduled activity. */
export function prepareJourneys(w: World, ctx: SimContext): void {
  if (!w.region) return;
  for (const command of ctx.commands) applyJourneyCommand(w, ctx, command);
  for (const id of idsOf<ActorId>(w.activity.journeys ?? {})) {
    if (!processesActor(w, id)) continue;
    if (tacticalPinned(w, id)) continue;
    const j = w.activity.journeys?.[id],
      state = w.activity.byActor[id];
    if (!j || !state || j.status === 'arrived') continue;
    if (j.walkingDay !== ctx.cal.dayIndex) {
      j.walkingDay = ctx.cal.dayIndex;
      j.dailyWalkingMinutes = 0;
    }
    if (j.status === 'camp' && (j.campUntil ?? 0) <= ctx.now) {
      j.status = 'stopped';
      j.campUntil = null;
      j.pendingInterruption = 'Camp finished; resume when ready';
      emit(w, ctx, id, 'stopped', j.pendingInterruption);
    }
    if (j.status === 'walking' && j.dailyWalkingMinutes >= w.region.definition.walking_minutes_per_day) {
      j.status = j.campPolicy === 'auto' ? 'camp' : 'stopped';
      j.campUntil = j.status === 'camp' ? ctx.now + 480 : null;
      j.pendingInterruption = 'Daily walking limit reached; choose camp or rest.';
      emit(w, ctx, id, 'camp', j.pendingInterruption);
    }
    const allowed = canAct(w, id) && authorizeAct(w, id, { kind: 'activity.travel' }, j.basis).ok;
    const speed = allowed && j.status === 'walking' ? loadReport(w, ctx.content, id).band.speedPct : 0;
    if (speed > 0) leaveRoadCamp(w, ctx, id);
    const budget = Math.min(60, Math.max(0, w.region.definition.walking_minutes_per_day - j.dailyWalkingMinutes));
    j.interval = { ...travelInterval(j.legs, j, speed, budget), at: ctx.now };
    state.activityId = allowed && j.status === 'camp' ? 'sleep_rough' : speed > 0 ? 'walk' : 'idle_at_home';
    state.travel = null;
    state.lockedUntil = null;
  }
}
/** Activity commits distance only after needs and agency have admitted the actor. */
export function advanceJourneys(w: World, ctx: SimContext): void {
  for (const id of idsOf<ActorId>(w.activity.journeys ?? {})) {
    if (!processesActor(w, id)) continue;
    if (tacticalPinned(w, id)) continue;
    const j = w.activity.journeys?.[id];
    if (!j || j.status === 'arrived' || !j.interval || j.interval.at !== ctx.now) continue;
    if (!canAct(w, id) || !authorizeAct(w, id, { kind: 'activity.travel' }, j.basis).ok) {
      j.status = 'stopped';
      continue;
    }
    if (j.status === 'walking') {
      j.segment = j.interval.segment;
      j.feet = j.interval.feet;
      j.remainder = j.interval.remainder;
      j.dailyWalkingMinutes += j.interval.movingMinutes;
    }
  }
}
/** Supply kernels finish the road interval before exposing the destination hearth/water. */
export function finishJourneys(w: World, ctx: SimContext, forecastWarning?: (reason: string) => void): void {
  for (const id of idsOf<ActorId>(w.activity.journeys ?? {})) {
    if (!processesActor(w, id)) continue;
    if (tacticalPinned(w, id)) continue;
    const j = w.activity.journeys?.[id],
      a = w.actors[id],
      s = w.activity.byActor[id];
    if (!j || !a || !s || j.status === 'arrived') continue;
    if (j.segment >= j.legs.length && canAct(w, id) && authorizeAct(w, id, { kind: 'activity.travel' }, j.basis).ok) {
      const from = a.placeId;
      a.placeId = j.destinationEntrance;
      s.placeId = a.placeId;
      s.activityId = 'idle_at_home';
      s.since = asGameMinute(ctx.now + 60);
      j.status = 'arrived';
      ctx.emit({
        kind: 'activity.moved',
        data: { actorId: id, from, to: a.placeId, minutes: ctx.now + 60 - j.startedAt },
        place: a.placeId,
        roles: [{ actor: id, role: 'agent' }],
        visibility: 'witnessed',
        explain: travelExplain(
          id,
          'Journey arrival at the hourly boundary',
          j.legs.reduce((n, l) => n + l.distanceFt, 0),
          'arrived',
        ),
      });
    } else if (j.status === 'walking' && !j.suppliesWarned && drinkingWater(w, ctx.content, id) === 0) {
      const reason = 'Carried water is exhausted; stop and decide whether to resume or turn back.';
      if (forecastWarning) {
        j.suppliesWarned = true;
        forecastWarning(reason);
        continue;
      }
      j.status = 'stopped';
      j.suppliesWarned = true;
      j.pendingInterruption = reason;
      emit(w, ctx, id, 'stopped', j.pendingInterruption);
    } else if (
      j.status === 'walking' &&
      ['hunger', 'thirst', 'rest', 'warmth'].some((n) => needValue(w, id, n) < 150)
    ) {
      if (forecastWarning) {
        forecastWarning('Critical vitals along the route: tend to your needs before continuing.');
        continue;
      }
      j.status = 'stopped';
      j.pendingInterruption = 'Critical vitals: stopped on the road; tend to your needs before resuming.';
      emit(w, ctx, id, 'stopped', j.pendingInterruption);
    }
  }
  if (w.region) recomputeOccupancy(w);
}
export type Journeys = Table<ActorId, Journey>;
