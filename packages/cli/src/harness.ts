/**
 * Headless harness library: used by the CLI and by integration tests. FOUNDATION-OWNED.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
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
    events_total: world.log.events.length,
    events_day: world.log.events.length - eventsBefore,
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

export function runScenario(content: ContentBundle, spec: RunSpec): RunResult {
  const sim = createSim(content, { scenarioId: spec.scenarioId, seed: spec.seed });
  const stats: Array<Record<string, number | string>> = [];
  let eventsBefore = sim.world.log.events.length;
  runHours(sim, spec.hours, {
    onDayEnd: (s, dayIndex) => {
      stats.push(statsRow(s, dayIndex, eventsBefore));
      eventsBefore = s.world.log.events.length;
    },
  });
  return { sim, hash: stateHash(sim.world), stats };
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

export function writeRunOutputs(dir: string, spec: RunSpec, res: RunResult, title: string): void {
  mkdirSync(dir, { recursive: true });
  const { world, content } = res.sim;
  writeFileSync(join(dir, 'chronicle.md'), chronicle.renderChronicleMarkdown(world, content, title));
  writeFileSync(join(dir, 'events.jsonl'), eventsJsonl(world.log.events));
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
        events: world.log.events.length,
      },
      null,
      2,
    )}\n`,
  );
}
