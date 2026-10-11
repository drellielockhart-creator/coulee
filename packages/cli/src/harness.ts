/**
 * Headless harness library: used by the CLI and by integration tests. FOUNDATION-OWNED.
 */
import { closeSync, mkdirSync, openSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import {
  activity,
  asGameMinute,
  belief,
  type ContentBundle,
  chronicle,
  createSim,
  type Event,
  formatStamp,
  type LogRetention,
  MINUTES_PER_DAY,
  needs,
  provisions,
  psyche,
  runHours,
  type Sim,
  social,
  stateHash,
} from '@coulee/core';

export interface RunSpec {
  scenarioId: string;
  seed: number;
  hours: number;
}

export interface RunResult {
  sim: Sim;
  hash: string;
  stats: Array<Record<string, number | string>>;
}

/** Daily stats row: core columns + every module's dailyStats (keys must be stable). */
function statsRow(sim: Sim, dayIndex: number, eventsBefore: number): Record<string, number | string> {
  const { world, content } = sim;
  return {
    day: dayIndex,
    date: formatStamp(asGameMinute(dayIndex * MINUTES_PER_DAY)).slice(0, 10),
    events_total: world.log.lastId,
    events_day: world.log.lastId - eventsBefore,
    actors_alive: Object.values(world.actors).filter((a) => a.alive).length,
    ...needs.needsDailyStats(world, content),
    ...activity.activityDailyStats(world, content),
    ...psyche.psycheDailyStats(world, content),
    ...social.socialDailyStats(world, content),
    ...belief.beliefDailyStats(world, content),
    ...provisions.provisionsDailyStats(world, content),
    ...chronicle.chronicleDailyStats(world, content),
  };
}

export interface ScenarioRunOptions {
  /** Receives every event in order, including the world-creation events (streams events.jsonl). */
  sink?: (e: Event) => void;
  /** In-memory retention (default: core's rolling window; null keeps every event). */
  logRetention?: LogRetention | null;
  /** Harness timer around each system (see `profileSystems`). */
  wrapSystem?: (systemId: string, run: () => void) => void;
}

export function runScenario(content: ContentBundle, spec: RunSpec, opts: ScenarioRunOptions = {}): RunResult {
  const sim = createSim(content, {
    scenarioId: spec.scenarioId,
    seed: spec.seed,
    ...(opts.logRetention !== undefined ? { logRetention: opts.logRetention } : {}),
  });
  if (opts.sink) {
    for (const e of sim.world.log.events) opts.sink(e);
    sim.sink = opts.sink;
  }
  if (opts.wrapSystem) sim.wrapSystem = opts.wrapSystem;
  const stats: Array<Record<string, number | string>> = [];
  let eventsBefore = sim.world.log.lastId;
  runHours(sim, spec.hours, {
    onDayEnd: (s, dayIndex) => {
      stats.push(statsRow(s, dayIndex, eventsBefore));
      eventsBefore = s.world.log.lastId;
    },
  });
  return { sim, hash: stateHash(sim.world), stats };
}

/** Collects every event a run emits (tests that need the whole log of a long run). */
export function collectingSink(): { sink: (e: Event) => void; events: Event[] } {
  const events: Event[] = [];
  return { sink: (e) => events.push(e), events };
}

/** Streams events as JSON lines to a file, buffered (a year is hundreds of MB; never held in memory). */
export function jsonlFileSink(path: string): { sink: (e: Event) => void; close: () => number } {
  const fd = openSync(path, 'w');
  let buf: string[] = [];
  let size = 0;
  let count = 0;
  const flush = () => {
    if (buf.length > 0) writeSync(fd, buf.join(''));
    buf = [];
    size = 0;
  };
  return {
    sink: (e) => {
      const line = `${JSON.stringify(e)}\n`;
      buf.push(line);
      size += line.length;
      count++;
      if (size > 4_000_000) flush();
    },
    close: () => {
      flush();
      closeSync(fd);
      return count;
    },
  };
}

export function toCsv(rows: ReadonlyArray<Record<string, number | string>>): string {
  const cols: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  const esc = (v: unknown) => {
    const s = v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return `${[cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')}\n`;
}

export function eventsJsonl(events: readonly Event[]): string {
  return events.map((e) => JSON.stringify(e)).join('\n') + (events.length > 0 ? '\n' : '');
}

export interface RunExtras {
  /** events.jsonl was already streamed by a sink: do not rewrite it from the retained window. */
  eventsStreamed?: boolean;
  /** Extra manifest fields (timing, memory, save size). */
  manifest?: Record<string, unknown>;
}

export function writeRunOutputs(
  dir: string,
  spec: RunSpec,
  res: RunResult,
  title: string,
  extras: RunExtras = {},
): void {
  mkdirSync(dir, { recursive: true });
  const { world, content } = res.sim;
  writeFileSync(join(dir, 'chronicle.md'), chronicle.renderChronicleMarkdown(world, content, title));
  if (!extras.eventsStreamed) writeFileSync(join(dir, 'events.jsonl'), eventsJsonl(world.log.events));
  writeFileSync(join(dir, 'stats.csv'), toCsv(res.stats));
  writeFileSync(join(dir, 'final-hash.txt'), `${res.hash}\n`);
  writeFileSync(
    join(dir, 'manifest.json'),
    `${JSON.stringify(
      {
        scenario: spec.scenarioId,
        seed: spec.seed,
        hours: spec.hours,
        contentHash: content.meta.hash,
        mods: content.meta.mods,
        finalTime: formatStamp(world.time),
        stateHash: res.hash,
        events: world.log.lastId,
        eventsRetained: world.log.events.length,
        ...extras.manifest,
      },
      null,
      2,
    )}\n`,
  );
}
