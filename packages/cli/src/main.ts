#!/usr/bin/env -S node --import tsx
/**
 * The `coulee` CLI harness (07 §4). FOUNDATION-OWNED.
 *
 *   coulee run --scenario iron_ford --seed 42 --days 10 [--out runs/name]
 *   coulee content check [--mods base]
 *   coulee inspect "Gussie Pratt" [--scenario iron_ford --seed 42 --days 3 | --run runs/name]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { CONTENT_ROOT, formatIssues, loadContent, loadContentOrThrow, REPO_ROOT } from '@coulee/content';
import { formatStamp, toViewModel } from '@coulee/core';
import { COUNTY_GEN_VERSION, countyTownContext, GEN_VERSION } from '@coulee/worldgen';
import { cac } from 'cac';
import { packJson } from '../../core/src/serialization.ts';
import { generateTimedCounty, writeGeneratedCounty } from './county-generation.ts';
import { findActor, renderDossier } from './dossier.ts';
import { generateTimedTown, writeGeneratedTown } from './generation.ts';
import { jsonlFileSink, type RunSpec, runScenario, type WorldSource, writeRunOutputs } from './harness.ts';
import { type PlayOptions, playCLI } from './play.ts';

const cli = cac('coulee');

const resolveOut = (p: string) => (isAbsolute(p) ? p : join(REPO_ROOT, p));
const modsOf = (m: unknown): string[] => (typeof m === 'string' && m.length > 0 ? m.split(',') : ['base']);

function hoursOf(o: { days?: number; years?: number; hours?: number }): number {
  if (o.hours !== undefined) return Math.max(0, Math.floor(Number(o.hours)));
  if (o.years !== undefined) return Math.max(0, Math.round(Number(o.years) * 365 * 24));
  return Math.max(0, Math.floor(Number(o.days ?? 7)) * 24);
}

cli
  .command('run', 'Run a scenario headless and write chronicle.md, events.jsonl, stats.csv, final hash')
  .option('--scenario <id>', 'Scenario id', { default: 'iron_ford' })
  .option('--seed <n>', 'Seed (integer)', { default: 1 })
  .option('--world-seed <n>', 'World seed for gen:town (defaults to sim seed)')
  .option('--days <n>', 'Days to simulate (default 7)')
  .option('--years <n>', 'Years to simulate')
  .option('--hours <n>', 'Hours to simulate')
  .option('--out <dir>', 'Output directory (default runs/<scenario>-<seed>)')
  .option('--mods <list>', 'Content mods, comma-separated', { default: 'base' })
  .option('--profile', 'Time each system and print ms per game-hour')
  .option('--no-events', 'Do not write events.jsonl (it is large: hundreds of MB per simulated year)')
  .option('--save', 'Also write save.json (the World as JSON: what a saved game holds)')
  .action(
    (o: {
      scenario: string;
      seed: number;
      worldSeed?: number;
      days?: number;
      years?: number;
      hours?: number;
      out?: string;
      mods?: string;
      profile?: boolean;
      events?: boolean;
      save?: boolean;
    }) => {
      const content = loadContentOrThrow(modsOf(o.mods));
      const spec = {
        scenarioId: String(o.scenario),
        seed: Number(o.seed),
        hours: hoursOf(o),
        worldSeed: o.worldSeed === undefined ? undefined : Number(o.worldSeed),
      };
      const out = resolveOut(o.out ?? `runs/${spec.scenarioId.replace(':', '-')}-${spec.seed}`);
      mkdirSync(out, { recursive: true });
      // The World keeps a rolling window; the full log streams to disk as it happens.
      const stream = o.events === false ? null : jsonlFileSink(join(out, 'events.jsonl'));
      const timers: Record<string, number> = {};
      const wrapSystem = o.profile
        ? (id: string, run: () => void) => {
            const t = performance.now();
            run();
            timers[id] = (timers[id] ?? 0) + performance.now() - t;
          }
        : undefined;
      const t0 = performance.now();
      const res = runScenario(content, spec, {
        ...(stream ? { sink: stream.sink } : {}),
        ...(wrapSystem ? { wrapSystem } : {}),
      });
      const ms = performance.now() - t0;
      const streamed = stream?.close() ?? 0;
      const saveJson = JSON.stringify(packJson(res.sim.world));
      const saveBytes = Buffer.byteLength(saveJson);
      if (o.save) writeFileSync(join(out, 'save.json'), saveJson);
      const w = res.sim.world as unknown as Record<string, unknown>;
      const bySlice = Object.fromEntries(
        Object.keys(w)
          .map((k) => [k, Buffer.byteLength(JSON.stringify(w[k]) ?? '')] as const)
          .sort((a, b) => b[1] - a[1]),
      );
      const mem = process.memoryUsage();
      const scenarioName = res.sim.content.scenarios[res.sim.world.meta.scenarioId]?.name ?? spec.scenarioId;
      const msPerHour = spec.hours > 0 ? ms / spec.hours : 0;
      writeRunOutputs(out, spec, res, `${scenarioName} — seed ${spec.seed}`, {
        eventsStreamed: stream !== null,
        manifest: {
          msPerGameHour: Math.round(msPerHour * 100) / 100,
          saveBytes,
          saveBytesBySlice: bySlice,
          heapUsedMB: Math.round(mem.heapUsed / 1e6),
          ...(o.profile
            ? { systemsMs: Object.fromEntries(Object.entries(timers).map(([k, v]) => [k, Math.round(v)])) }
            : {}),
        },
      });
      console.log(
        `ran ${spec.scenarioId} seed ${spec.seed} for ${spec.hours} h in ${Math.round(ms)} ms ` +
          `(${msPerHour.toFixed(2)} ms/game-hour) -> ${formatStamp(res.sim.world.time)}; ` +
          `${res.sim.world.log.lastId} events (${res.sim.world.log.events.length} retained${stream ? `, ${streamed} streamed` : ''}); ` +
          `save ${(saveBytes / 1e6).toFixed(2)} MB; heap ${Math.round(mem.heapUsed / 1e6)} MB, rss ${Math.round(mem.rss / 1e6)} MB; hash ${res.hash}`,
      );
      if (o.profile) {
        const actors = Object.keys(res.sim.world.actors).length;
        for (const [id, t] of Object.entries(timers).sort((a, b) => b[1] - a[1]))
          console.log(
            `  ${id.padEnd(11)} ${(t / spec.hours).toFixed(3)} ms/h  ${((1000 * t) / spec.hours / actors).toFixed(1)} µs/actor-h`,
          );
      }
      console.log(
        `wrote ${relative(process.cwd(), out) || '.'}/{chronicle.md,${stream ? 'events.jsonl,' : ''}stats.csv,final-hash.txt,manifest.json}`,
      );
    },
  );

cli
  .command('gen <kind>', 'Generate a town content mod or county JSON and SVG')
  .option('--seed <n>', 'World seed (uint32)', { default: 1 })
  .option('--out <dir>', 'Output directory (default runs/gen-<seed>)')
  .option('--preset <name>', 'coulee or river', { default: 'coulee' })
  .option('--mods <list>', 'Content mods', { default: 'base' })
  .option('--town', 'Also export the county’s chosen ford town')
  .action(
    (kind: string, o: { seed: number; out?: string; preset: 'coulee' | 'river'; mods?: string; town?: boolean }) => {
      if (kind === 'county') {
        const seed = Number(o.seed);
        const { county, timing } = generateTimedCounty({ genVersion: COUNTY_GEN_VERSION, seed, preset: o.preset });
        const out = resolveOut(o.out ?? `runs/county-${seed}`);
        writeGeneratedCounty(out, county, timing);
        if (o.town) {
          const regionContext = countyTownContext(county);
          const town = generateTimedTown(loadContentOrThrow(modsOf(o.mods)), {
            genVersion: GEN_VERSION,
            seed,
            preset: o.preset,
            regionContext,
          });
          writeGeneratedTown(join(out, 'town'), town);
        }
        console.log(
          `Generated county ${seed}: ${county.report.stats.cells} cells; ${timing.desktopMs} ms desktop, ${timing.estimatedPhoneMs} ms phone estimate (no pre-roll) -> ${out}`,
        );
        return;
      }
      if (kind !== 'town') throw new Error(`Unknown generator '${kind}'`);
      const seed = Number(o.seed);
      const town = generateTimedTown(loadContentOrThrow(modsOf(o.mods)), {
        genVersion: GEN_VERSION,
        seed,
        preset: o.preset,
      });
      const out = resolveOut(o.out ?? `runs/gen-${seed}`);
      writeGeneratedTown(out, town);
      console.log(
        `Generated ${town.scenario.name}: ${town.scenario.actors.length} people; ${town.report.qa.length} QA checks passed -> ${out}`,
      );
    },
  );

cli
  .command('content <action>', 'Content tools: `content check`')
  .option('--mods <list>', 'Content mods, comma-separated', { default: 'base' })
  .action((action: string, o: { mods?: string }) => {
    if (action !== 'check') {
      console.error(`unknown content action '${action}' (expected: check)`);
      process.exit(2);
    }
    const res = loadContent(CONTENT_ROOT, modsOf(o.mods));
    if (!res.bundle) {
      console.error(`content invalid (${res.issues.length} issue(s)):\n${formatIssues(res.issues)}`);
      process.exit(1);
    }
    const sizes = Object.entries(res.bundle)
      .filter(([k]) => k !== 'meta')
      .map(([k, v]) => `${k}=${Object.keys(v as object).length}`)
      .join(' ');
    console.log(`content ok (${res.files.length} files): ${sizes}`);
  });

cli
  .command('inspect <actorName>', 'Print a character dossier (re-simulates deterministically)')
  .option('--scenario <id>', 'Scenario id', { default: 'iron_ford' })
  .option('--seed <n>', 'Seed', { default: 1 })
  .option('--world-seed <n>', 'World seed for gen:town')
  .option('--days <n>', 'Days to simulate first (default 0)')
  .option('--hours <n>', 'Hours to simulate first')
  .option('--run <dir>', 'Re-create the end state of a previous `coulee run` from its manifest.json')
  .option('--mods <list>', 'Content mods', { default: 'base' })
  .action(
    (
      name: string,
      o: {
        scenario: string;
        seed: number;
        days?: number;
        hours?: number;
        run?: string;
        mods?: string;
        worldSeed?: number;
      },
    ) => {
      let content = loadContentOrThrow(modsOf(o.mods));
      let spec: RunSpec = {
        worldSeed: o.worldSeed === undefined ? undefined : Number(o.worldSeed),
        scenarioId: String(o.scenario),
        seed: Number(o.seed),
        hours: hoursOf({ days: o.days ?? 0, ...(o.hours !== undefined ? { hours: o.hours } : {}) }),
      };
      if (o.run) {
        const m = JSON.parse(readFileSync(join(resolveOut(o.run), 'manifest.json'), 'utf8')) as {
          scenario: string;
          seed: number;
          hours: number;
          stateHash: string;
          worldSource?: WorldSource;
          mods?: string[];
        };
        spec = { scenarioId: m.scenario, seed: m.seed, hours: m.hours, worldSource: m.worldSource };
        if (m.mods) content = loadContentOrThrow(m.mods);
      }
      const res = runScenario(content, spec);
      const vm = toViewModel(res.sim.world, res.sim.content, { perspective: null, includeExplain: true });
      const { actor, matches } = findActor(vm, name);
      if (!actor) {
        console.error(
          matches.length === 0
            ? `no actor matches '${name}'. Actors: ${vm.actors.map((a) => a.name).join(', ')}`
            : `'${name}' is ambiguous: ${matches.map((a) => a.name).join(', ')}`,
        );
        process.exit(1);
      }
      console.log(renderDossier(vm, actor));
    },
  );

cli
  .command('play [command]', 'Play a newcomer headlessly (fair knowledge by default)')
  .option('--text', 'Readable text REPL (default)')
  .option('--compact', 'Omit unchanged session status/menu lines')
  .option('--jsonl', 'One JSON Command in, one JSON observation out')
  .option('--replay <file>', 'Replay commands.jsonl and verify every state hash')
  .option('--god', 'Reveal ground truth')
  .option('--scenario <id>', 'Authored id or gen:town', { default: 'iron_ford' })
  .option('--seed <n>', 'Simulation seed', { default: 42 })
  .option('--world-seed <n>', 'Independent world generation seed')
  .option('--log <dir>', 'Write commands, metrics and transcript')
  .option('--session <dir>', 'Persist a session across separate command calls')
  .option('--new', 'Create a stateless session')
  .option('--look', 'Print the current session observation without acting')
  .option('--fork <dir>', 'Copy the session into a new directory')
  .option('--verify', 'Replay the session log and compare its saved state hash')
  .action((command: string | undefined, o: PlayOptions) =>
    playCLI(o, command).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }),
  );

cli.help();
// Negative menu numbers are positional play input, not CAC flags.
const cliArgs = process.argv.slice();
if (cliArgs[2] === 'play' && /^-\d+$/.test(cliArgs.at(-1) ?? '')) cliArgs[cliArgs.length - 1] = ` ${cliArgs.at(-1)}`;
cli.parse(cliArgs);
if (!cli.matchedCommand && process.argv.length > 2) {
  console.error(`unknown command: ${process.argv.slice(2).join(' ')}`);
  cli.outputHelp();
  process.exit(2);
}
