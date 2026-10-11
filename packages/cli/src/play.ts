import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { loadContentOrThrow } from '@coulee/content';
import { HELP, PlaySession, parseText, type ReplayLog, renderDetail, renderObservation } from '@coulee/play';
export interface PlayOptions {
  text?: boolean;
  jsonl?: boolean;
  replay?: string;
  god?: boolean;
  scenario: string;
  seed: number;
  worldSeed?: number;
  log?: string;
}
export async function playCLI(o: PlayOptions): Promise<void> {
  const content = loadContentOrThrow(['base']);
  let session = o.replay
    ? PlaySession.replay(
        content,
        readFileSync(o.replay, 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line)) as ReplayLog,
      )
    : PlaySession.create(content, {
        source: o.scenario,
        seed: Number(o.seed),
        ...(o.worldSeed === undefined ? {} : { worldSeed: Number(o.worldSeed) }),
      });
  const mode = o.god ? 'god' : 'fair';
  const transcript: string[] = [];
  let page = 0,
    forks = 0;
  const print = (line: string) => {
    console.log(line);
    transcript.push(line);
  };
  const flush = () => {
    if (!o.log) return;
    mkdirSync(o.log, { recursive: true });
    writeFileSync(join(o.log, 'commands.jsonl'), session.commandLog.map((x) => JSON.stringify(x)).join('\n') + '\n');
    writeFileSync(join(o.log, 'metrics.jsonl'), session.telemetry.map((x) => JSON.stringify(x)).join('\n') + '\n');
    writeFileSync(join(o.log, 'transcript.txt'), transcript.join('\n') + '\n');
  };
  if (o.replay) {
    print(o.jsonl ? JSON.stringify(session.observe(mode)) : renderObservation(session.observe(mode)));
    flush();
    return;
  }
  if (!o.jsonl)
    print(`Coulee — newcomer play. ${mode.toUpperCase()}. Type help.\n${renderObservation(session.observe(mode))}`);
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    try {
      if (!o.jsonl) {
        transcript.push(`> ${line}`);
        const [verb, ...args] = line.trim().split(/\s+/);
        if (verb === 'quit' || verb === 'exit') break;
        if (verb === 'help') {
          print(HELP);
          continue;
        }
        if (verb === 'save') {
          if (!args.length) throw new Error('Use save <file>');
          writeFileSync(args.join(' '), session.save());
          print('Saved.');
          continue;
        }
        if (verb === 'load') {
          session = PlaySession.load(content, readFileSync(args.join(' '), 'utf8'));
          page = 0;
          print(renderObservation(session.observe(mode)));
          flush();
          continue;
        }
        if (verb === 'fork') {
          if (o.log) {
            mkdirSync(o.log, { recursive: true });
            writeFileSync(join(o.log, `fork-${++forks}.json`), session.save());
          }
          session = session.fork();
          print('Forked at the same state. Use save to keep this branch.');
          continue;
        }
        if (verb === 'actions') {
          page = Math.max(1, Number(args[0] ?? 1));
          print(renderObservation(session.observe(mode), page));
          continue;
        }
      }
      const command = o.jsonl ? JSON.parse(line) : parseText(line, session.observe(mode), page);
      if (typeof command === 'string' && !o.jsonl) {
        print(command);
        continue;
      }
      const result = session.act(command, mode);
      page = 0;
      if (o.jsonl)
        print(
          JSON.stringify({
            ...result.observation,
            result: {
              ok: result.ok,
              reason: result.reason,
              warning: result.warning,
              elapsedMinutes: result.elapsedMinutes,
              interrupts: result.interrupts,
              detail: result.detail,
            },
          }),
        );
      else {
        if (result.reason) print(result.reason);
        if (result.warning) print(result.warning);
        if (result.interrupts.length) print(`Stopped: ${result.interrupts.map((i) => i.reason).join('; ')}`);
        if (result.detail !== undefined) print(renderDetail(result.detail));
        print(renderObservation(result.observation));
      }
      flush();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      print(o.jsonl ? JSON.stringify({ ...session.observe(mode), result: { ok: false, reason } }) : `Error: ${reason}`);
    }
  }
  input.close();
  flush();
}
