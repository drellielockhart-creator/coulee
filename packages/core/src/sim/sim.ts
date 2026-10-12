/**
 * The sim loop: create, step, run, hash. FOUNDATION-OWNED.
 *
 * One step = one game-hour at T1 (ADR 0001 "Time"). Per step:
 *   1. If the hour starts a day, emit 'core.day_started'.
 *   2. Log each Command as 'core.command' (replay = seed + content hash + command log).
 *   3. Run HOURLY_SYSTEMS in fixed order (sim/schedule.ts).
 *   4. Advance world.time by 60.
 */

import type { Command } from '../command.ts';
import type { ContentBundle } from '../content.ts';
import { appendEvent, type Event, type EventInput, trimLog } from '../events/index.ts';
import { hashValue } from '../hash.ts';
import { authorizeAct } from '../psyche/api.ts';
import { rng, type Stream } from '../rng.ts';
import { type PackedJson, unpackJson } from '../serialization.ts';
import { asGameMinute, calendarAt, MINUTES_PER_DAY, minuteOfDay } from '../time.ts';
import type { World } from '../world.ts';
import type { SimContext } from './context.ts';
import { type CreateWorldOptions, createWorld } from './init.ts';
import { HOURLY_SYSTEMS } from './schedule.ts';

export interface Sim {
  world: World;
  content: ContentBundle;
  /**
   * Optional observer of every event as it is appended (not part of the World). The CLI streams
   * the full log to events.jsonl through it; the World itself keeps only a retention window.
   */
  sink?: (e: Event) => void;
  /** Optional harness hook around each system run (the CLI's --profile timer). Never changes results. */
  wrapSystem?: (systemId: string, run: () => void) => void;
}

export function createSim(content: ContentBundle, opts: CreateWorldOptions): Sim {
  return { world: createWorld(content, opts), content };
}

/** Wrap an existing (deserialized) world. Throws if the content differs from the world's. */
export function restoreSim(
  content: ContentBundle,
  saved: World | PackedJson,
  opts: { allowContentMismatch?: boolean } = {},
): Sim {
  const world = unpackJson<World>(saved);
  if (!opts.allowContentMismatch && world.meta.contentHash !== content.meta.hash) {
    throw new Error(
      `content hash mismatch: world ${world.meta.contentHash.slice(0, 12)} vs bundle ${content.meta.hash.slice(0, 12)}`,
    );
  }
  return { world, content };
}

export function makeContext(
  world: World,
  content: ContentBundle,
  commands: readonly Command[],
  sink?: (e: Event) => void,
): SimContext {
  const now = world.time;
  const seed = world.meta.seed;
  return {
    content,
    seed,
    now,
    cal: calendarAt(now),
    isNewDay: minuteOfDay(now) === 0,
    commands: commands.filter(
      (c) =>
        authorizeAct(world, c.actorId, { kind: c.kind }, { kind: 'command', issuer: c.issuer ?? { kind: 'player' } })
          .ok,
    ),
    rngAt: (stream, at, key) => rng(seed, stream, at, key),
    rng: (stream: Stream, key: number) => rng(seed, stream, now, key),
    emit: sink
      ? (e: EventInput) => {
          const id = appendEvent(world.log, e, now);
          sink(world.log.events[world.log.events.length - 1] as Event);
          return id;
        }
      : (e: EventInput) => appendEvent(world.log, e, now),
  };
}

/** Simulate one game-hour. */
export function step(sim: Sim, commands: readonly Command[] = []): void {
  const { world, content } = sim;
  const ctx = makeContext(world, content, commands, sim.sink);
  if (ctx.isNewDay) {
    const c = ctx.cal;
    ctx.emit({
      kind: 'core.day_started',
      data: {
        dayIndex: c.dayIndex,
        year: c.year,
        month: c.month,
        day: c.day,
        weekday: c.weekday,
        season: c.season,
        moon: c.moon.phase,
        isSabbath: c.isSabbath,
      },
    });
  }
  for (const command of commands) {
    ctx.emit({
      kind: 'core.command',
      roles: [{ actor: command.actorId, role: 'agent' }],
      visibility: 'private',
      data: { command },
    });
  }
  const wrap = sim.wrapSystem;
  for (const sys of HOURLY_SYSTEMS) {
    if (wrap) wrap(sys.id, () => sys.run(world, ctx));
    else sys.run(world, ctx);
  }
  // The chronicle (last system) has sifted everything up to lastId: older events may leave memory.
  if (ctx.isNewDay) trimLog(world.log, ctx.now);
  world.time = asGameMinute(world.time + 60);
}

export interface RunOptions {
  /** Commands to apply at the start of a given hour (keyed by game minute). */
  commandsAt?: (t: number) => readonly Command[];
  /** Called after each simulated day completes (for stats); `dayIndex` of the finished day. */
  onDayEnd?: (sim: Sim, dayIndex: number) => void;
}

export function runHours(sim: Sim, hours: number, opts: RunOptions = {}): void {
  for (let i = 0; i < hours; i++) {
    const t = sim.world.time;
    step(sim, opts.commandsAt?.(t) ?? []);
    if (opts.onDayEnd && minuteOfDay(sim.world.time) === 0) {
      opts.onDayEnd(sim, Math.floor(t / MINUTES_PER_DAY));
    }
  }
}

export function runDays(sim: Sim, days: number, opts: RunOptions = {}): void {
  runHours(sim, days * 24, opts);
}

/** Stable 64-bit hex hash of the entire world (state + event log). */
export function stateHash(world: World): string {
  return hashValue(world);
}
