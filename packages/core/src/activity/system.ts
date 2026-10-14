import { isDailyProcessing, processesPlace, processingActorIds } from '../region/processing.ts';
import { tacticalPinned } from './tactical.ts';
/** Execute the chosen activity, falling back to the content calendar. */

import { type ActorId, idsOf } from '../ids.ts';
import { campSleepActivity, inventoryIndex, loadReport, movementDelay } from '../items/api.ts';
import { canAct, rousedBy } from '../needs/api.ts';
import { activeEmployment, admitSleep, workAvailability } from '../provisions/api.ts';
import { authorizeAct, chosenUrge, standingOrders } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import { interactionAvailability, prepareReliefTravel, reliefReservations } from '../social/api.ts';
import { addHours } from '../time.ts';
import type { World } from '../world.ts';
import { minuteBudget, noteCall, resolveActivityPlace, walkMinutes } from './api.ts';
import { blockActive, observanceActive, routineFor } from './calendar.ts';
import { requiredRow } from './definitions.ts';
import { activityExplain } from './explain.ts';
import { type ActivitySource, recomputeOccupancy } from './state.ts';
import { advanceJourneys, onJourney } from './travel.ts';

export function activitySystem(world: World, ctx: SimContext): void {
  advanceJourneys(world, ctx);
  // Accepted conversations reserve both participants for this hour, before anyone moves.
  prepareReliefTravel(world, ctx);
  const invited = new Set<ActorId>(reliefReservations(world, ctx));
  for (const cmd of ctx.commands) {
    if (cmd.kind !== 'core.urge' || cmd.data.urge.kind !== 'interaction' || cmd.data.urge.targetId === undefined)
      continue;
    const u = cmd.data.urge;
    if (
      u.targetId !== undefined &&
      interactionAvailability(world, ctx.content, cmd.actorId, u.targetId, u.interactionId).ok
    )
      invited.add(u.targetId);
  }
  // A fae Command (investigate a sign, tie or study a charm) is done where the actor stands this
  // hour: a standing order must not walk them off before fae resolves it (r2 playtest #7).
  for (const cmd of ctx.commands) if (cmd.kind.startsWith('fae.') && cmd.kind !== 'fae.signs') invited.add(cmd.actorId);
  // Hiring is a short conversation: reserve both people before their routines move them.
  for (const cmd of ctx.commands) {
    if (
      cmd.kind === 'provisions.hire_on' &&
      interactionAvailability(world, ctx.content, cmd.actorId, cmd.data.employerId, 'chat').ok
    ) {
      invited.add(cmd.actorId);
      invited.add(cmd.data.employerId);
    }
  }
  const inventory = world.items?.stacks ? inventoryIndex(world) : undefined;
  for (const id of processingActorIds(world)) {
    if (tacticalPinned(world, id)) continue;
    const actor = requiredRow(world.actors, id);
    const state = world.activity.byActor[id];
    if (!actor.alive || !state) continue;
    // Short orders already occupied this entire hour; do not add another walk or activity.
    if (minuteBudget(world, id).remaining === 0) continue;
    if (onJourney(world, id)) {
      const cmd = ctx.commands.find(
        (c) =>
          c.actorId === id &&
          c.kind === 'core.urge' &&
          c.data.urge.kind === 'activity' &&
          authorizeAct(world, id, { kind: 'work' }, { kind: 'command', issuer: c.issuer ?? { kind: 'player' } }).ok,
      );
      if (
        canAct(world, id) &&
        cmd &&
        authorizeAct(world, id, { kind: cmd.kind }, { kind: 'command', issuer: cmd.issuer ?? { kind: 'player' } }).ok &&
        world.activity.journeys?.[id]?.status === 'stopped' &&
        cmd?.kind === 'core.urge' &&
        cmd.data.urge.kind === 'activity' &&
        resolveActivityPlace(world, ctx, id, cmd.data.urge.activityId, cmd.data.urge.placeId) === actor.placeId
      ) {
        state.activityId = cmd.data.urge.activityId;
        state.since = ctx.now;
        const j = world.activity.journeys?.[id];
        if (j && ctx.content.activities[state.activityId]?.asleep) {
          j.status = 'camp';
          j.campUntil = ctx.now + 480;
        }
      }
      continue;
    }
    if (!canAct(world, id)) {
      state.activityId = 'incapacitated';
      state.travel = null;
      continue;
    }
    const load = loadReport(world, ctx.content, id, inventory);
    if (state.travel && load.band.speedPct === 0) continue;
    if (state.travel) {
      state.hourlyWalk = { at: ctx.now, minutes: Math.min(60, Math.max(0, state.travel.arrive - ctx.now)) };
      if (ctx.now + 60 < state.travel.arrive) continue;
      const arrivedAt = state.travel.arrive;
      const from = actor.placeId;
      const minutes = Math.max(0, state.travel.arrive - state.since);
      actor.placeId = state.travel.to;
      state.placeId = state.travel.to;
      state.travel = null;
      ctx.emit({
        kind: 'activity.moved',
        data: { actorId: id, from, to: actor.placeId, minutes },
        place: actor.placeId,
        roles: [{ actor: id, role: 'agent' }],
        visibility: 'witnessed',
        explain: {
          kind: 'formula',
          label: 'Travel arrival',
          subjects: [id],
          knowledge: 'public',
          terms: [],
          total: arrivedAt,
          outcome: 'arrived',
        },
      });
    }
    const workOrder = ctx.commands.find(
      (c) =>
        c.actorId === id &&
        c.kind === 'core.urge' &&
        c.data.urge.kind === 'activity' &&
        authorizeAct(world, id, { kind: 'work' }, { kind: 'command', issuer: c.issuer ?? { kind: 'player' } }).ok,
    );
    if (workOrder?.kind === 'core.urge' && workOrder.data.urge.kind === 'activity') {
      const contract = activeEmployment(world, id);
      if (workOrder.data.urge.activityId === 'work' && contract && !workAvailability(world, ctx.content, id))
        state.workShift = {
          until: ctx.cal.dayIndex * 1440 + contract.toHour * 60,
          issuer: workOrder.issuer ?? { kind: 'player' },
        };
      else delete state.workShift;
    }
    if (state.workShift && (ctx.now >= state.workShift.until || workAvailability(world, ctx.content, id))) {
      delete state.workShift;
      if (state.activityId === 'work') state.lockedUntil = null;
    }
    const continuingWork =
      state.workShift &&
      !workOrder &&
      authorizeAct(world, id, { kind: 'work' }, { kind: 'command', issuer: state.workShift.issuer }).ok;
    const chosen = chosenUrge(world, id);
    // Any order wakes a sleeper (to drink, to go), and so does a need in a rousing band (Parched,
    // Starving) when the standing orders choose something else. Other locks (travel, work) hold.
    const woken =
      ctx.content.activities[state.activityId ?? '']?.asleep &&
      ((chosen?.voice === 'command' && chosen.at === ctx.now) ||
        (rousedBy(world, ctx.content, id) !== null &&
          chosen?.urge.kind === 'activity' &&
          !ctx.content.activities[chosen.urge.activityId]?.asleep));
    if (state.lockedUntil !== null && ctx.now < state.lockedUntil && !woken) continue;
    const routine = routineFor(world, ctx, id);
    const urge = chosen?.at === ctx.now || !isDailyProcessing(world) ? chosen?.urge : undefined;
    // An explicit conversation occupies this hour at the current venue. A schedule must
    // not carry its speaker away (or put them to sleep) before social resolves it.
    const conversation = (chosen?.voice === 'command' && urge?.kind === 'interaction') || invited.has(id);
    // Someone at work here keeps working while they talk (a word across the counter or the
    // anvil); anyone else is held, at leisure, where they are (playtest r2 availability).
    const workingHere =
      conversation &&
      state.activityId !== null &&
      state.placeId === actor.placeId &&
      ctx.content.activities[state.activityId]?.tags.includes('labor') === true;
    let activityId = conversation
      ? workingHere
        ? (state.activityId ?? 'idle_at_home')
        : 'idle_at_home'
      : continuingWork
        ? 'work'
        : urge?.kind === 'activity'
          ? urge.activityId
          : routine?.activityId;
    let source: ActivitySource = conversation
      ? 'command'
      : continuingWork
        ? 'command'
        : urge?.kind === 'activity'
          ? chosen?.voice === 'command'
            ? 'command'
            : 'urge'
          : 'schedule';
    let placeId = activityId
      ? resolveActivityPlace(
          world,
          ctx,
          id,
          activityId,
          conversation
            ? actor.placeId
            : continuingWork
              ? (state.workplaceId ?? undefined)
              : urge?.kind === 'activity'
                ? urge.placeId
                : undefined,
        )
      : null;
    if (activityId === 'work' && workAvailability(world, ctx.content, id)) activityId = 'idle_at_home';
    if (placeId === null || !activityId || !ctx.content.activities[activityId]) {
      activityId = routine?.activityId;
      placeId = activityId ? resolveActivityPlace(world, ctx, id, activityId) : null;
      source = 'schedule';
    }
    if (!activityId || placeId === null) continue;
    const selected = ctx.content.activities[activityId];
    const home = world.households[actor.householdId]?.homePlaceId;
    if (
      selected?.asleep &&
      selected.at === 'home' &&
      (!standingOrders(world, id).lodging || world.places[home ?? 0]?.siteId !== world.places[actor.placeId]?.siteId)
    ) {
      activityId = campSleepActivity(ctx.content) ?? activityId;
      placeId = actor.placeId;
    }
    if (
      ctx.content.activities[activityId]?.asleep &&
      !ctx.content.activities[activityId]?.tags.includes('camp') &&
      !admitSleep(world, ctx, id, placeId)
    ) {
      activityId = 'idle_at_home';
    }
    const def = requiredRow(ctx.content.activities, activityId);
    const rawExplain = continuingWork
      ? {
          kind: 'choice' as const,
          label: 'Continue the ordered paid shift',
          subjects: [id],
          knowledge: 'self' as const,
          terms: [
            { source: 'command' as const, label: 'Shift closing minute', value: state.workShift?.until ?? ctx.now },
          ],
          total: Math.max(0, (state.workShift?.until ?? ctx.now) - ctx.now),
          outcome: 'work',
        }
      : source !== 'schedule' && chosen
        ? chosen.explain
        : routine?.explain;
    const explain = rawExplain ? activityExplain(rawExplain) : undefined;
    const from = actor.placeId;
    const changed = state.activityId !== activityId || state.placeId !== placeId;
    // The walk takes real time: distance on the site grid at a walking pace, slowed by the load.
    // A trip that fits inside the hour is simply done (the hour is the grain of the sim); a
    // longer one leaves the actor on the road until it ends (the view reports the minutes left).
    let walked = 0;
    if (from !== placeId) {
      walked = walkMinutes(world, ctx.content, from, placeId);
      if (load.band.speedPct < 100) {
        const extra = movementDelay(world, ctx, id, load, walked);
        if (extra === null) continue;
        walked += extra;
      }
      state.hourlyWalk = { at: ctx.now, minutes: Math.min(minuteBudget(world, id).remaining, walked) };
      if (walked > minuteBudget(world, id).remaining) {
        state.travel = {
          from,
          to: placeId,
          arrive: (ctx.now + minuteBudget(world, id).spent + walked) as import('../time.ts').GameMinute,
        };
        state.activityId = activityId;
        state.source = source;
        state.since = ctx.now;
        state.lockedUntil = addHours(state.travel.arrive, Math.max(1, def.min_hours));
        continue;
      }
    }
    actor.placeId = placeId;
    state.placeId = placeId;
    if (from !== placeId)
      ctx.emit({
        kind: 'activity.moved',
        data: { actorId: id, from, to: placeId, minutes: walked },
        place: placeId,
        roles: [{ actor: id, role: 'agent' }],
        visibility: 'witnessed',
        ...(explain ? { explain } : {}),
      });
    if (changed) {
      state.activityId = activityId;
      state.since = ctx.now;
      // This hour already belongs to the hiring conversation. Do not create an idle lock
      // that would make its later provisions executor reject its own reservation.
      state.lockedUntil =
        conversation && ctx.commands.some((c) => c.kind === 'provisions.hire_on' && c.actorId === id)
          ? ctx.now
          : addHours(ctx.now, def.min_hours);
      state.source = source;
      if (def.at === 'kin') noteCall(world, id, placeId);
      ctx.emit({
        kind: 'activity.started',
        data: { actorId: id, activityId, placeId, source },
        place: placeId,
        roles: [{ actor: id, role: 'agent' }],
        visibility: def.asleep ? 'private' : 'witnessed',
        ...(explain ? { explain } : {}),
      });
    } else state.source = source;
  }
  recomputeOccupancy(world);
  // One announcement per place at a gathering's opening hour; occupants are already sorted.
  for (const key of Object.keys(ctx.content.observances).sort()) {
    const def = requiredRow(ctx.content.observances, key);
    if (!observanceActive(def, ctx.cal)) continue;
    for (const b of def.blocks) {
      if (!b.announce || !blockActive(b, ctx.cal)) continue;
      const previous = { ...ctx.cal, hour: (ctx.cal.hour + 23) % 24 };
      if (blockActive(b, previous)) continue;
      for (const pid of idsOf(world.activity.occupancy)) {
        if (!processesPlace(world, pid)) continue;
        const actorIds = requiredRow(world.activity.occupancy, pid).filter(
          (id) => world.activity.byActor[id]?.activityId === b.activity,
        );
        if (actorIds.length === 0) continue;
        ctx.emit({
          kind: 'activity.gathering',
          data: { observanceId: key, activityId: b.activity, actorIds, placeId: pid },
          roles: actorIds.map((actor) => ({ actor, role: 'participant' })),
          place: pid,
          importance: 15,
          visibility: 'public',
          explain: {
            kind: 'formula',
            label: def.name,
            subjects: actorIds,
            knowledge: 'public',
            terms: [{ source: 'place', label: 'Present', value: actorIds.length }],
            total: actorIds.length,
            outcome: 'gathered',
          },
        });
      }
    }
  }
}
