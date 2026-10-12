import {
  appendFileSync,
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import type { ContentBundle } from '@coulee/core';
import {
  type AvailableAction,
  confirmEnding,
  infoFor,
  menuActions,
  type Observation,
  type ObservationMode,
  PlaySession,
  parseText,
  type ReplayLog,
  renderBrief,
  renderDetail,
  renderInterrupts,
  renderObservation,
  type SessionSpec,
} from '@coulee/play';
import type { PlayOptions } from './play.ts';

interface Manifest {
  format: 1;
  spec: SessionSpec;
  mode: ObservationMode;
}
interface MenuState {
  page: number;
  menu: AvailableAction[];
  previous?: Observation;
  compact?: boolean;
}
const files = ['session.json', 'save.json', 'commands.jsonl', 'metrics.jsonl', 'transcript.txt'];
const jsonl = (rows: unknown[]) => rows.map((row) => JSON.stringify(row) + '\n').join('');
function save(dir: string, session: PlaySession, menu: MenuState) {
  const temporary = join(dir, 'save.json.tmp');
  writeFileSync(temporary, JSON.stringify({ ...JSON.parse(session.save()), cli: menu, finalHash: session.hash }));
  renameSync(temporary, join(dir, 'save.json'));
}
function emptyDirectory(dir: string): boolean {
  if (existsSync(dir) && readdirSync(dir).length) return false;
  mkdirSync(dir, { recursive: true });
  return true;
}

/** One process, one command. Only accepted core Commands enter the replay log. */
export function sessionCLI(content: ContentBundle, o: PlayOptions, line?: string): 0 | 2 {
  const dir = resolve(o.session ?? '');
  const operations = [o.new, o.look, o.fork !== undefined, o.verify, line !== undefined].filter(Boolean).length;
  if (operations !== 1 || o.jsonl || o.replay || o.log) {
    console.log('Use --session <dir> with exactly one of --new, --look, --fork <dir>, --verify, or "<command>".');
    if (existsSync(join(dir, 'session.json'))) printCurrent(content, dir);
    return 2;
  }
  if (o.new && !emptyDirectory(dir)) {
    console.log('Session directory must be new or empty. Use --look to resume.');
    if (existsSync(join(dir, 'session.json'))) printCurrent(content, dir);
    return 2;
  }
  const lock = join(dir, '.lock');
  const fd = openSync(lock, 'wx');
  closeSync(fd);
  try {
    if (o.new) {
      const session = PlaySession.create(content, {
        source: o.scenario,
        seed: Number(o.seed),
        ...(o.worldSeed === undefined ? {} : { worldSeed: Number(o.worldSeed) }),
        pc: {
          name: 'Ellis Wayfarer',
          kit: 'newcomer',
          ancestry: content.playStarts.newcomer?.ancestry,
          lodging: 'tavern',
        },
      });
      const mode = o.god ? 'god' : 'fair';
      const observation = session.observe(mode);
      writeFileSync(join(dir, 'session.json'), JSON.stringify({ format: 1, spec: session.spec, mode }));
      writeFileSync(join(dir, 'commands.jsonl'), jsonl(session.commandLog));
      writeFileSync(join(dir, 'metrics.jsonl'), '');
      const text = renderObservation(observation);
      writeFileSync(join(dir, 'transcript.txt'), text + '\n');
      save(dir, session, {
        page: 0,
        menu: menuActions(observation),
        previous: observation,
        compact: o.compact ?? false,
      });
      console.log(text);
      return 0;
    }
    const { session, manifest, menu, savedHash } = load(content, dir);
    const mode = manifest.mode;
    const observation = session.observe(mode);
    // A refusal is one line (playtest r2: phone-size output; no doubled period).
    const invalid = (reason: string): 2 => {
      const text = `${reason.replace(/[.\s]+$/, '')}. No game time spent.`;
      appendFileSync(join(dir, 'transcript.txt'), `${line === undefined ? '' : '> ' + line + '\n'}${text}\n`);
      console.log(text);
      return 2;
    };
    if (o.god && mode !== 'god') return invalid('Mode is fixed at creation; use --new --god for a god session.');
    if (o.look) {
      console.log(renderObservation(observation, menu.page));
      return 0;
    }
    if (o.fork !== undefined) {
      const target = resolve(o.fork);
      if (target === dir || !emptyDirectory(target)) return invalid('Fork directory must be new or empty.');
      // Both lines of a forked story are branched: a fair ending in either keeps the county's
      // secrets (playtest r2: retire in a fork, read the omniscient epilogue, play on).
      if (!session.isBranched) {
        session.markBranched();
        save(dir, session, menu);
      }
      for (const file of files) copyFileSync(join(dir, file), join(target, file));
      console.log(`Forked to ${target}.\n${renderObservation(observation, menu.page)}`);
      return 0;
    }
    if (o.verify) {
      const log = readFileSync(join(dir, 'commands.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((row) => JSON.parse(row)) as ReplayLog;
      const replayed = PlaySession.replay(content, log, mode);
      if (replayed.hash !== session.hash || savedHash !== session.hash)
        throw new Error('Verification failed: replay/save hash mismatch');
      console.log(`Verified ${log.length - 1} commands; final hash ${session.hash}.`);
      return 0;
    }
    const text = (line ?? '').trim();
    if (!text || /[\r\n]/.test(text)) return invalid('Supply exactly one nonempty command line.');
    const [verb, ...args] = text.split(/\s+/);
    let page = 0;
    // Bare help, standing, agency, rations: read, with no time and no order (help <person> is an act).
    const detail: string | undefined = infoFor(text, observation) ?? undefined;
    if (detail !== undefined) {
      /* reading only */
    } else if (verb?.toLowerCase() === 'actions' || verb?.toLowerCase() === 'places') {
      page = Number(args[0] ?? 1);
      if (verb?.toLowerCase() === 'places') page = -page;
      if (
        args.length > 1 ||
        !Number.isSafeInteger(page) ||
        page === 0 ||
        (page < 0 && verb?.toLowerCase() !== 'places') ||
        !menuActions(observation, page).length
      )
        return invalid('Use actions <page> with an available positive page number.');
    }
    const numbered = /^[+-]?\d+$/.test(text) ? menu.menu[Number(text) - 1]?.command : undefined;
    const command =
      detail !== undefined || page !== 0
        ? parseText('look', observation)
        : /^[+-]?\d+$/.test(text)
          ? numbered
            ? (confirmEnding(numbered, text) ?? numbered)
            : 'No such menu number'
          : parseText(text, observation);
    if (typeof command === 'string') return invalid(command);
    const oldCommands = session.commandLog.length;
    const oldMetrics = session.telemetry.length;
    const result = session.act(command, mode);
    if (!result.ok) return invalid(result.reason ?? 'Invalid command');
    // A reply that took no time is the answer and one line (playtest r2: phone-size output); look,
    // actions and places show the whole scene. A wait's stop says why on its own line, so the
    // scene does not repeat the reason.
    const full = result.elapsedMinutes > 0 || ['look', 'actions', 'places'].includes((verb ?? '').toLowerCase());
    const stopped = result.stopped?.reasons ?? [];
    const scene = {
      ...result.observation,
      changes: {
        ...result.observation.changes,
        events: result.observation.changes.events.filter((e) => !stopped.includes(e)),
      },
    };
    const sceneText = full
      ? renderObservation(
          scene,
          page,
          (o.compact ?? menu.compact) && !['look', 'actions', 'places'].includes(verb ?? '')
            ? menu.previous
            : undefined,
        )
      : renderBrief(result.observation);
    // An act already listed among the scene's events is not said twice.
    const answer = detail ?? (result.detail === undefined ? undefined : renderDetail(result.detail));
    const said = answer?.match(/^\[\d+\] /)?.[0];
    const output = [
      result.warning,
      result.notice,
      ...renderInterrupts(result, { allReasons: true }),
      said && sceneText.includes(`\n${said}`) ? undefined : answer,
      sceneText,
    ]
      .filter((part) => part !== undefined)
      .join('\n');
    appendFileSync(join(dir, 'commands.jsonl'), jsonl(session.commandLog.slice(oldCommands)));
    appendFileSync(join(dir, 'metrics.jsonl'), jsonl(session.telemetry.slice(oldMetrics)));
    appendFileSync(join(dir, 'transcript.txt'), `> ${line}\n${output}\n`);
    // The numbers refer to the last menu shown: a brief reply leaves it (and the scene) as it was.
    save(
      dir,
      session,
      full
        ? {
            page,
            menu: menuActions(result.observation, page),
            previous: result.observation,
            compact: o.compact ?? menu.compact,
          }
        : { ...menu, compact: o.compact ?? menu.compact },
    );
    console.log(output);
    return 0;
  } finally {
    unlinkSync(lock);
  }
}

function load(content: ContentBundle, dir: string) {
  const manifest = JSON.parse(readFileSync(join(dir, 'session.json'), 'utf8')) as Manifest;
  if (manifest.format !== 1 || !['fair', 'god'].includes(manifest.mode)) throw new Error('Session format mismatch');
  const json = readFileSync(join(dir, 'save.json'), 'utf8');
  const saved = JSON.parse(json);
  if (JSON.stringify(manifest.spec) !== JSON.stringify(saved.spec) || !saved.cli?.menu)
    throw new Error('Session metadata/save mismatch');
  return {
    session: PlaySession.load(content, json),
    manifest,
    menu: saved.cli as MenuState,
    savedHash: saved.finalHash,
  };
}
function printCurrent(content: ContentBundle, dir: string) {
  const { session, manifest, menu } = load(content, dir);
  console.log(renderObservation(session.observe(manifest.mode), menu.page));
}
