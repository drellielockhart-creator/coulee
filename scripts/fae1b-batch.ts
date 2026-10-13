/**
 * Fae slice 1b batch measurements (design-docs/13 §8.2 criteria 2, 5, 6, 11): runs the
 * `charm_at_iron_ford` fixture for many seeds under one causal arm and writes one JSON line per
 * seed. Arms change initial conditions or one knob only; nothing reacts to the story's stage.
 *
 *   node --import tsx scripts/fae1b-batch.ts --arm baseline --seeds 64 --days 60 --jobs 16 \
 *     --out runs/fae1b/baseline.jsonl
 *   node --import tsx scripts/fae1b-batch.ts --summary runs/fae1b
 *
 * Arms: baseline · no-witnesses (prevent disclosure) · no-shortage (pantries above horizon) ·
 * reveal (draws_from at 70 for every adult on day 4, or at the first draw case after it) ·
 * honor-loans (maximal loan duty). `--scenario` runs another scenario (e.g. iron_ford) to
 * confirm charm code is idle without charms.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContentOrThrow } from '../packages/content/src/index.ts';
import { ensureBelief } from '../packages/core/src/belief/evidence.ts';
import { setConservationProbe } from '../packages/core/src/fae/charms.ts';
import {
  type ActorId,
  createSim,
  type Event,
  findNonIntegers,
  makeContext,
  type PropId,
  stateHash,
  step,
  type World,
} from '../packages/core/src/index.ts';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const ARMS = ['baseline', 'no-witnesses', 'no-shortage', 'reveal', 'honor-loans'] as const;
type Arm = (typeof ARMS)[number];

function arg(name: string, dflt: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? dflt) : dflt;
}

const COVET = ['ask_to_see', 'beg_loan', 'take'];

export interface SeedResult {
  seed: number;
  arm: Arm;
  days: number;
  foundDay: number | null;
  finderHousehold: string | null;
  draws: number;
  drawnLb: number;
  sources: Record<string, number>;
  transactions: number;
  violations: number;
  /** Outsiders (not the keeping household) who ever held a claim at credence ≥ 20. */
  talked: number;
  /** Covet acts (asked to see, begged, took), and outsiders who ever wanted it (D ≥ 20). */
  covetActs: number;
  coveted: number;
  loans: number;
  returned: number;
  breaches: number;
  restitutions: number;
  tells: number;
  studies: number;
  disposals: string[];
  /** Most adults at once holding bane / boon at ≥ 50. */
  bane: number;
  boon: number;
  /** Holders attributing a charm-caused loss to an actor (max at once). */
  blamed: number;
  /** Restitution grudges from loans broken past their day (13 §6.2). */
  restitutionGrudges: number;
  // ---- refusal costs (wave 6) ----
  /** Requests to borrow the charm that were turned down (failed begs, refused or lapsed requests). */
  refusals: number;
  /** Returns in the busiest rota (the longest run of one household pair's loans). */
  rotaReturns: number;
  /** Most outsiders at once holding "they sit on plenty while others go short" at credence ≥ 20. */
  gossip: number;
  /** Grudges founded on being turned away. */
  refusalGrudges: number;
  /** Highest duty-guilt any keeper carried. */
  guiltMax: number;
  /** Highest charm-story level reached per audience, and how threads closed. */
  level: { pub: number; pc: number; all: number };
  closures: string[];
  truths: number;
  hash: string;
  nonIntegers: number;
}

function topUp(world: World): void {
  // Pantries above horizon: a fortnight's flour, meal and pork more in every household's stores.
  let next = world.items.counters.item;
  for (const h of Object.values(world.households)) {
    const n = Math.max(2, h.memberIds.length);
    for (const [defId, qty] of [
      ['flour', 20 * n],
      ['cornmeal', 10 * n],
      ['salt_pork', 6 * n],
      ['beans_dry', 6 * n],
    ] as const) {
      next += 1;
      world.items.stacks[next as never] = {
        id: next as never,
        defId,
        qty,
        location: { kind: 'household', householdId: h.id },
        condition: 100,
        wetness: 0,
        spoilage: 0,
        spoilageCarry: 0,
        partial: 0,
        waterMl: 0,
        litMode: 'auto',
        lit: false,
        createdAt: world.time,
        provenance: [],
      };
    }
  }
  world.items.counters.item = next;
}

export function runSeed(seed: number, arm: Arm, days: number, scenarioId = 'charm_at_iron_ford'): SeedResult {
  const content = loadContentOrThrow(['base']);
  const sim = createSim(content, { scenarioId, seed });
  const w = sim.world;
  if (arm === 'no-witnesses') w.fae.ablation = { noWitnesses: true };
  if (arm === 'honor-loans') w.fae.ablation = { loanDuty: 1000 };
  if (arm === 'no-shortage') topUp(w);
  let transactions = 0;
  let violations = 0;
  setConservationProbe((r) => {
    transactions++;
    if (!r.ok) violations++;
  });
  const talked = new Set<number>();
  const coveted = new Set<number>();
  const out: SeedResult = {
    seed,
    arm,
    days,
    foundDay: null,
    finderHousehold: null,
    draws: 0,
    drawnLb: 0,
    sources: {},
    transactions: 0,
    violations: 0,
    talked: 0,
    covetActs: 0,
    coveted: 0,
    loans: 0,
    returned: 0,
    breaches: 0,
    restitutions: 0,
    tells: 0,
    studies: 0,
    disposals: [],
    bane: 0,
    boon: 0,
    blamed: 0,
    restitutionGrudges: 0,
    refusals: 0,
    rotaReturns: 0,
    gossip: 0,
    refusalGrudges: 0,
    guiltMax: 0,
    level: { pub: 0, pc: 0, all: 0 },
    closures: [],
    truths: 0,
    hash: '',
    nonIntegers: 0,
  };
  let revealed = false;
  let seen = 0;
  const onEvent = (e: Event) => {
    switch (e.kind) {
      case 'fae.charm_arrived':
        out.foundDay ??= Math.floor(e.t / 1440);
        out.finderHousehold ??= w.households[w.actors[e.data.finderId]?.householdId as never]?.name ?? null;
        break;
      case 'fae.charm_drew':
        out.draws++;
        out.drawnLb += e.data.qty;
        out.sources[e.data.source] = (out.sources[e.data.source] ?? 0) + e.data.qty;
        break;
      case 'fae.charm_revealed':
        if (e.data.facts.includes('effects')) out.studies++;
        break;
      case 'fae.charm_disposed':
        out.disposals.push(e.data.kind);
        break;
      case 'social.loan_opened':
        out.loans++;
        break;
      case 'social.loan_closed':
        if (e.data.status === 'returned') out.returned++;
        break;
      case 'social.loan_breached':
        out.breaches++;
        break;
      case 'social.request_answered':
        if (e.data.status !== 'accepted') {
          const r = (w.social.pendingRequests ?? []).find((x) => x.id === e.data.requestId);
          if (r?.response === 'lend_item') out.refusals++;
        }
        break;
      case 'social.interaction': {
        const id = e.data.interactionId;
        if (COVET.includes(id)) out.covetActs++;
        if (id === 'beg_loan' && !e.data.success) out.refusals++;
        if (id === 'make_restitution' && e.data.success) out.restitutions++;
        if (id === 'tell_what_found' && e.data.success) out.tells++;
        break;
      }
    }
  };
  for (let h = 0; h < days * 24; h++) {
    step(sim);
    for (const e of w.log.events) {
      if ((e.id as number) <= seen) continue;
      seen = e.id as number;
      onEvent(e);
    }
    if (w.time % 1440 !== 0) continue;
    const day = Math.floor(w.time / 1440);
    const c = Object.values(w.fae.charms ?? {}).find((x) => x.defId === 'never_empty_sack');
    if (!c) continue;
    if (arm === 'reveal' && !revealed && day >= 4) {
      const cases = Object.values(w.fae.drawCases ?? {}).filter((x) => x.householdId !== null);
      if (cases.length) {
        revealed = true;
        const ctx = makeContext(w, content, []);
        for (const dc of cases)
          for (const a of Object.values(w.actors)) {
            if (!a.alive) continue;
            const p = internPropFor(w, c.itemId, dc.householdId as number);
            const b = ensureBelief(w, ctx, a.id, p);
            b.credence = Math.max(b.credence, 70);
          }
      }
    }
    // Daily census.
    const stack = w.items.stacks[c.itemId];
    let holder = -1;
    if (stack) {
      let cur = stack;
      for (let i = 0; i < 16 && cur.location.kind === 'container'; i++) {
        const up = w.items.stacks[cur.location.itemId];
        if (!up) break;
        cur = up;
      }
      holder =
        cur.location.kind === 'household'
          ? cur.location.householdId
          : cur.location.kind === 'actor'
            ? (w.actors[cur.location.actorId]?.householdId ?? -1)
            : -1;
    }
    let bane = 0;
    let boon = 0;
    for (const b of Object.values(w.belief.beliefs)) {
      const p = w.belief.props[b.propId];
      if (!p?.args.some((x) => x.kind === 'item' && x.id === c.itemId)) continue;
      const outsider = w.actors[b.holderId]?.householdId !== holder;
      if (p.pred.startsWith('claim.') && b.credence >= 20 && outsider) talked.add(b.holderId);
      if (p.pred === 'bane' && b.credence >= 50) bane++;
      if (p.pred === 'boon' && b.credence >= 50) boon++;
    }
    let gossip = 0;
    for (const b of Object.values(w.belief.beliefs)) {
      const p = w.belief.props[b.propId];
      if (p?.pred === 'hoards' && b.credence >= 20 && w.actors[b.holderId]?.householdId !== holder) gossip++;
    }
    out.gossip = Math.max(out.gossip, gossip);
    const guilt = (c as { guilt?: Record<string, number> }).guilt ?? {};
    out.guiltMax = Math.max(out.guiltMax, ...Object.values(guilt), 0);
    out.bane = Math.max(out.bane, bane);
    out.boon = Math.max(out.boon, boon);
    for (const [k, d] of Object.entries(c.desire))
      if (d >= 20 && w.actors[Number(k) as ActorId]?.householdId !== holder) coveted.add(Number(k));
    let blamed = 0;
    for (const dc of Object.values(w.fae.drawCases ?? {})) {
      if (dc.misfortuneId === null) continue;
      blamed +=
        w.belief.misfortunes[dc.misfortuneId]?.attributions.filter((a) => a.leader?.kind === 'actor').length ?? 0;
    }
    out.blamed = Math.max(out.blamed, blamed);
    for (const th of [...w.chronicle.threads, ...w.chronicle.closedThreads]) {
      if (th.pattern !== 'charm') continue;
      out.level.pub = Math.max(out.level.pub, th.emitted.pub);
      out.level.pc = Math.max(out.level.pc, th.emitted.pc);
      out.level.all = Math.max(out.level.all, th.emitted.all);
      if (th.closed && th.tags.resolution && !out.closures.includes(`${th.id}:${th.tags.resolution}`))
        out.closures.push(`${th.id}:${th.tags.resolution}`);
    }
  }
  out.truths = w.chronicle.entries.filter((e) => e.pattern === 'charm' && e.kind === 'truth').length;
  out.closures = out.closures.map((x) => x.split(':')[1] as string);
  out.restitutionGrudges = Object.values(w.belief.grudges).filter((g) =>
    g.founding.some((f) => f.label === 'Kept what was lent past the day'),
  ).length;
  out.refusalGrudges = Object.values(w.belief.grudges).filter((g) =>
    g.founding.some((f) => f.label.startsWith('Turned us away') || f.label.startsWith('Sits on plenty')),
  ).length;
  out.rotaReturns = Math.max(0, ...Object.values(w.social.rotas ?? {}).map((r) => r.returned));
  out.talked = talked.size;
  out.coveted = coveted.size;
  out.transactions = transactions;
  out.violations = violations;
  out.hash = stateHash(w);
  out.nonIntegers = findNonIntegers(w).length;
  setConservationProbe(null);
  return out;
}

function internPropFor(w: World, itemId: number, householdId: number): PropId {
  const key = `draws_from(i:${itemId},h:${householdId})`;
  const existing = w.belief.propByKey[key];
  if (existing !== undefined) return existing;
  const id = (w.belief.counters.prop + 1) as PropId;
  w.belief.counters.prop = id;
  w.belief.props[id] = {
    id,
    pred: 'draws_from',
    args: [
      { kind: 'item', id: itemId as never },
      { kind: 'household', id: householdId as never },
    ],
    key,
  };
  w.belief.propByKey[key] = id;
  return id;
}

async function main(): Promise<void> {
  const worker = process.argv.indexOf('--worker');
  if (worker >= 0) {
    const seed = Number(process.argv[worker + 1]);
    const arm = process.argv[worker + 2] as Arm;
    const days = Number(process.argv[worker + 3]);
    const scenario = process.argv[worker + 4] ?? 'charm_at_iron_ford';
    process.stdout.write(`${JSON.stringify(runSeed(seed, arm, days, scenario))}\n`);
    return;
  }
  const summary = process.argv.indexOf('--summary');
  if (summary >= 0) {
    const dir = process.argv[summary + 1] ?? 'runs/fae1b';
    for (const f of readdirSync(dir)
      .filter((x) => x.endsWith('.jsonl'))
      .sort()) {
      const rows = readFileSync(join(dir, f), 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as SeedResult);
      console.log(`${f}: ${JSON.stringify(summarize(rows))}`);
    }
    return;
  }
  const arm = arg('arm', 'baseline') as Arm;
  if (!ARMS.includes(arm)) throw new Error(`arm must be one of ${ARMS.join(', ')}`);
  const seeds = Number(arg('seeds', '64'));
  const first = Number(arg('first', '1'));
  const days = Number(arg('days', '60'));
  const jobs = Number(arg('jobs', '16'));
  const scenario = arg('scenario', 'charm_at_iron_ford');
  const outPath = arg('out', `runs/fae1b/${arm}.jsonl`);
  mkdirSync(join(outPath, '..'), { recursive: true });
  const queue = Array.from({ length: seeds }, (_, i) => first + i);
  const lines: string[] = [];
  const self = fileURLToPath(import.meta.url);
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      for (let s = queue.shift(); s !== undefined; s = queue.shift()) {
        const line = await new Promise<string>((resolve, reject) => {
          const child = spawn(
            process.execPath,
            ['--import', 'tsx', self, '--worker', String(s), arm, String(days), scenario],
            {
              cwd: ROOT,
              stdio: ['ignore', 'pipe', 'inherit'],
            },
          );
          let buf = '';
          child.stdout.on('data', (d: Buffer) => {
            buf += d.toString();
          });
          child.on('close', (code) =>
            code === 0 ? resolve(buf.trim()) : reject(new Error(`seed ${s} exited ${code}`)),
          );
        });
        lines.push(line);
      }
    }),
  );
  lines.sort((a, b) => (JSON.parse(a) as SeedResult).seed - (JSON.parse(b) as SeedResult).seed);
  writeFileSync(outPath, `${lines.join('\n')}\n`);
  console.log(`${arm}: ${JSON.stringify(summarize(lines.map((l) => JSON.parse(l) as SeedResult)))}`);
}

export function summarize(rows: SeedResult[]): Record<string, number | string> {
  const n = rows.length || 1;
  const sum = (f: (r: SeedResult) => number) => rows.reduce((a, r) => a + f(r), 0);
  const pct = (f: (r: SeedResult) => boolean) => Math.round((rows.filter(f).length * 100) / n);
  const kinds = new Set(rows.flatMap((r) => [...r.closures, ...r.disposals]));
  return {
    seeds: rows.length,
    found: pct((r) => r.foundDay !== null),
    meanDraws: Math.round((sum((r) => r.draws) * 10) / n) / 10,
    meanLb: Math.round(sum((r) => r.drawnLb) / n),
    transactions: sum((r) => r.transactions),
    violations: sum((r) => r.violations),
    talked: Math.round((sum((r) => r.talked) * 10) / n) / 10,
    coveted: Math.round((sum((r) => r.coveted) * 10) / n) / 10,
    covetActs: sum((r) => r.covetActs),
    loans: sum((r) => r.loans),
    returned: sum((r) => r.returned),
    breaches: sum((r) => r.breaches),
    restitutions: sum((r) => r.restitutions),
    restitutionGrudges: sum((r) => r.restitutionGrudges),
    refusals: sum((r) => r.refusals ?? 0),
    rotaReturnsMean: Math.round((sum((r) => r.rotaReturns ?? 0) * 10) / n) / 10,
    gossipMean: Math.round((sum((r) => r.gossip ?? 0) * 10) / n) / 10,
    refusalGrudges: sum((r) => r.refusalGrudges ?? 0),
    guiltMaxMean: Math.round(sum((r) => r.guiltMax ?? 0) / n),
    tells: sum((r) => r.tells),
    studies: sum((r) => r.studies),
    bane: Math.round((sum((r) => r.bane) * 10) / n) / 10,
    boon: Math.round((sum((r) => r.boon) * 10) / n) / 10,
    blamed: Math.round((sum((r) => r.blamed) * 10) / n) / 10,
    level1: pct((r) => Math.max(r.level.pub, r.level.pc, r.level.all) >= 1),
    level2: pct((r) => Math.max(r.level.pub, r.level.pc, r.level.all) >= 2),
    level3: pct((r) => Math.max(r.level.pub, r.level.pc, r.level.all) >= 3),
    closedPeacefully: pct((r) => r.closures.length > 0),
    rotaClosures: rows.filter((r) => r.closures.includes('shared')).length,
    resolutionKinds: [...kinds].sort().join(','),
    truths: sum((r) => r.truths),
    nonIntegers: sum((r) => r.nonIntegers),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) void main();
