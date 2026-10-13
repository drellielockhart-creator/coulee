import { advanceCombatHealth, nextCombatHealthInstant } from '../needs/api.ts';
/** Version 1: sparse action instants inside a saved hour frame. Legacy adapter stays byte-stable. */

import { finishJourneys, prepareJourneys } from '../activity/api.ts';
import type { Command } from '../command.ts';
import type { Event } from '../events/index.ts';
import { trimLog } from '../events/index.ts';
import { type ActorId, idsOf } from '../ids.ts';
import { accrueTacticalNeeds, nextTacticalNeedInstant, prepareTacticalNeeds } from '../needs/api.ts';
import { nextTacticalSupplyInstant, tacticalSupplies } from '../provisions/api.ts';
import { regionSystem } from '../region/api.ts';
import { commandTactical, requestBrawl, requestEncounter } from '../tactical/api.ts';
import type { TacticalCommand } from '../tactical/commands.ts';
import { tacticalSystem } from '../tactical/system.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import { instantOf, setInstant, TICKS_PER_HOUR, TICKS_PER_MINUTE } from './clock.ts';
import { HOURLY_SYSTEMS, prepareHourIntentions, TACTICAL_PREPARATION_SYSTEMS } from './schedule.ts';
import { announceDay, makeContext, type Sim, stepHourly } from './sim.ts';

/** Authored opt-in trigger; ordinary scenarios never allocate tactical state. */
export function admitScriptedScene(sim: Sim): boolean {
  const w = sim.world,
    def = sim.content.scenarios[w.meta.scenarioId]?.tactical_scene;
  if (!def || w.tactical || w.backgroundTactical || w.time < def.at_minute || w.time % 60 !== 0) return false;
  const place = w.index.placeByDef[def.place];
  if (!place) return false;
  const ids = idsOf<ActorId>(w.actors).filter(
    (id) => w.actors[id]?.placeId === place && !def.exclude_actors?.includes(w.actors[id]?.key ?? ''),
  );
  const ctx = makeContext(w, sim.content, [], sim.sink);
  const admitted = requestEncounter(w, ctx, def.id, place, ids, def.text);
  if (admitted && def.brawlers) {
    const a = w.index.actorByKey[def.brawlers[0]],
      b = w.index.actorByKey[def.brawlers[1]];
    if (a && b) requestBrawl(w, ctx, a, b, { kind: 'own' });
  }
  return admitted;
}
export interface AdvanceResult {
  elapsedTicks: number;
  interrupted: boolean;
}
/** Keep ordinary orders free of tactical UI state without discarding partial-hour accounting. */
export function advanceUntil(
  sim: Sim,
  target: number,
  commands: readonly Command[] = [],
  interrupt?: (events: Event[]) => boolean,
): AdvanceResult {
  const w = sim.world;
  if (!w.tactical && w.backgroundTactical) {
    w.tactical = w.backgroundTactical;
    delete w.backgroundTactical;
  }
  try {
    return advanceScene(sim, target, commands, interrupt);
  } finally {
    if (w.tactical && !w.tactical.active) {
      w.backgroundTactical = w.tactical;
      delete w.tactical;
    }
  }
}
function advanceScene(
  sim: Sim,
  target: number,
  commands: readonly Command[] = [],
  interrupt?: (events: Event[]) => boolean,
): AdvanceResult {
  const w = sim.world,
    start = instantOf(w);
  if (!Number.isSafeInteger(target) || target < start) throw new Error('Invalid advance target');
  const last = w.log.lastId;
  if (admitScriptedScene(sim)) {
    const events = w.log.events.filter((e) => e.id > last);
    if (interrupt?.(events)) return { elapsedTicks: 0, interrupted: true };
  }
  let pending = commands;
  while (!w.tactical && instantOf(w) < target) {
    if (target - instantOf(w) < TICKS_PER_HOUR) throw new Error('Sub-hour advancement requires the tactical clock');
    const before = w.log.lastId;
    stepHourly(sim, pending);
    pending = [];
    admitScriptedScene(sim);
    if (interrupt?.(w.log.events.filter((e) => e.id > before)))
      return { elapsedTicks: instantOf(w) - start, interrupted: true };
  }
  if (!w.tactical) return { elapsedTicks: instantOf(w) - start, interrupted: false };
  const s = w.tactical;
  if (s.version !== 1) throw new Error('Unsupported tactical clock version');
  const ctx = makeContext(w, sim.content, pending, sim.sink);
  for (const command of ctx.commands) {
    ctx.emit({
      kind: 'core.command',
      data: { command },
      roles: [{ actor: command.actorId, role: 'agent' }],
      visibility: 'private',
    });
    if (command.kind.startsWith('tactical.')) commandTactical(w, ctx, command as TacticalCommand);
    else if (command.kind !== 'activity.wait' && command.kind !== 'activity.observe') s.pendingCommands.push(command);
  }
  if (target === instantOf(w)) return { elapsedTicks: 0, interrupted: false };
  s.pause = null;
  while (instantOf(w) < target) {
    if (!s.frame || s.frame.phase === 'settled') {
      const now = instantOf(w);
      if (now % TICKS_PER_HOUR !== 0) throw new Error('Hour frame missing at partial instant');
      s.frame = {
        start: now,
        through: now,
        end: now + TICKS_PER_HOUR,
        phase: 'open',
        commands: s.pendingCommands.splice(0),
        live: s.active || s.heap.length ? idsOf<ActorId>(s.participants) : [],
        rates: {},
        activeRates: {},
        carries: {},
        elapsed: {},
      };
      const before = w.log.lastId;
      const opening = makeContext(w, sim.content, s.frame.commands, sim.sink);
      announceDay(opening);
      prepareJourneys(w, opening);
      prepareTacticalNeeds(w, opening);
      prepareHourIntentions(w, opening);
      if (interrupt?.(w.log.events.filter((e) => e.id > before)))
        return { elapsedTicks: now - start, interrupted: true };
    }
    const frame = s.frame;
    const schedule = makeContext(w, sim.content, [], sim.sink);
    const next = Math.min(
      target,
      frame.end,
      s.heap[0]?.instant ?? target,
      nextTacticalNeedInstant(w) ?? target,
      nextCombatHealthInstant(w) ?? target,
      nextTacticalSupplyInstant(w, schedule) ?? target,
    );
    if (next < instantOf(w)) throw new Error('Past heap entry');
    setInstant(w, next);
    const tick = makeContext(w, sim.content, [], sim.sink),
      before = w.log.lastId;
    const elapsed = next - frame.through;
    accrueTacticalNeeds(w, tick, next);
    tacticalSupplies(
      w,
      { ...tick, cal: calendarAt(asGameMinute(Math.floor(frame.start / TICKS_PER_MINUTE))) },
      elapsed,
    );
    tacticalSystem(w, tick);
    advanceCombatHealth(w, tick);
    if (next === frame.end) {
      settleHourFrame(sim);
      frame.phase = 'settled';
      regionSystem(w, makeContext(w, sim.content, [], sim.sink));
    }
    const events = w.log.events.filter((e) => e.id > before);
    if (interrupt?.(events)) return { elapsedTicks: next - start, interrupted: true };
    // An NPC's own action completion must not latch a hidden interrupt for the player.
    s.pause = null;
  }
  return { elapsedTicks: instantOf(w) - start, interrupted: false };
}

/** T1 effects settle once at the closing instant. The accounting view retains the interval's
 * calendar/RNG keys; event timestamps use the real boundary, after all due T0 completions.
 * Only the root clock is projected: owned slices and identity tables are the original objects. */
function settleHourFrame(sim: Sim): void {
  const w = sim.world,
    f = w.tactical?.frame;
  if (!f) return;
  f.phase = 'settling';
  const accounting = { ...w, time: asGameMinute(Math.floor(f.start / TICKS_PER_MINUTE)) };
  const boundary = makeContext(w, sim.content, [], sim.sink);
  const ctx = { ...makeContext(accounting, sim.content, f.commands), emit: boundary.emit };
  for (const system of HOURLY_SYSTEMS) {
    if (TACTICAL_PREPARATION_SYSTEMS.has(system.id)) continue;
    if (sim.wrapSystem) sim.wrapSystem(system.id, () => system.run(accounting, ctx));
    else system.run(accounting, ctx);
    if (system.id === 'provisions') finishJourneys(accounting, ctx);
  }
  if (ctx.isNewDay) trimLog(w.log, w.time);
}
