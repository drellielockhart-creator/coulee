/// <reference lib="webworker" />
/**
 * Sim worker: runs a headless `PlaySession` (ADR 0002) for the web player. OWNER: module:web.
 *
 * This is the ONLY web file that imports core or @coulee/play at runtime. The UI thread imports
 * types only, so it cannot recompute a rule even by accident (parity.test.ts checks this).
 *
 * UI parity (ADR 0002 §1): every player order arrives as a Command (or a headless wait phrase
 * parsed by @coulee/play's own parser) and goes through `PlaySession.act`, which validates it
 * against the session's available actions. The running clock is `advance(60)` per game-hour.
 * So the session's replay log is the web game, and `coulee play --replay` reproduces it hash for
 * hash. Auto-pause is the session's own interrupt policy (ADR 0002 §3), the same one that stops a
 * headless `wait`.
 */

import bundleUrl from '@coulee/content/bundle.json?url';
import type { ContentBundle } from '@coulee/content/schema';
import {
  type Command,
  DEFAULT_VIEW_OPTIONS,
  provisions,
  TICKS_PER_SECOND,
  timeView,
  toViewModel,
  type ViewModel,
  type ViewOptions,
} from '@coulee/core';
import {
  type ActResult,
  foodLedger,
  type ObservationMode,
  PlaySession,
  parseText,
  renderDetail,
  renderInterrupts,
  sessionSimOf,
  storefront,
  tradePreview,
} from '@coulee/play';
import {
  type ActOutcome,
  type Alert,
  type Digest,
  type FromWorker,
  type PlayObservation,
  type QueryResult,
  SPEEDS,
  type Speed,
  type ToWorker,
  type VmPatch,
} from './protocol.ts';

declare const self: DedicatedWorkerGlobalScope;

let content: ContentBundle | null = null;
let session: PlaySession | null = null;
let speed: Speed = 'paused';
/** Explains are on: the Mind tab shows the ego's arbitration (gated by perspective in core). */
let viewOptions: ViewOptions = { ...DEFAULT_VIEW_OPTIONS, includeExplain: true };
/** Fair play by default; God view (Settings) switches the observation too (ADR 0002 §2). */
let mode: ObservationMode = 'fair';
let timer: ReturnType<typeof setInterval> | null = null;
/** Fraction of the current game-hour already elapsed at the chosen speed (display + pacing). */
let accumulator = 0;
let last = 0;
let lastProgress = 0;
let digest: Digest = emptyDigest(0);
let lastOutcome: ActOutcome | null = null;
let observation: PlayObservation | null = null;
/** Accepted entries in the session's replay log (counted here: `commandLog` clones the whole log). */
let steps = 0;
/** Money lines seen this sitting (the Ledger's money page). */
let money: Digest['money'] = [];

/** Never block the worker for more than this many game-hours per tick (Ultra on a slow phone). */
const MAX_HOURS_PER_TICK = 6;
/** Progress messages while running (display only). */
const PROGRESS_MS = 250;

const post = (m: FromWorker) => self.postMessage(m);

async function loadContent(): Promise<ContentBundle> {
  if (content) return content;
  const res = await fetch(bundleUrl);
  if (!res.ok) throw new Error(`content bundle: HTTP ${res.status}`);
  content = (await res.json()) as ContentBundle;
  return content;
}

// ---------------------------------------------------------------------------------------
// Snapshots: the first is whole; later ones carry only what changed (11 §5.4).
// ---------------------------------------------------------------------------------------

/** Last posted JSON per slice ('a<id>', 'p<id>', 'households', ...). */
const posted = new Map<string, string>();
let fullNext = true;

/** Changed rows of a keyed list, remembering what was posted. */
function changedRows<T extends { id: number }>(prefix: string, rows: readonly T[] | undefined): T[] {
  const out: T[] = [];
  for (const r of rows ?? []) {
    const key = `${prefix}${r.id}`;
    const json = JSON.stringify(r);
    if (posted.get(key) !== json) {
      posted.set(key, json);
      out.push(r);
    }
  }
  return out;
}

function changedSlice<K extends 'scenario' | 'seed' | 'site' | 'households' | 'chronicle' | 'belief'>(
  vm: ViewModel,
  key: K,
): Partial<Pick<VmPatch, K>> {
  const json = JSON.stringify(vm[key] ?? null);
  if (posted.get(key) === json) return {};
  posted.set(key, json);
  return { [key]: vm[key] } as Partial<Pick<VmPatch, K>>;
}

/** Build the next snapshot payload: the whole view model, or a patch against the last one. */
export function snapshotPayload(vm: ViewModel): { vm: ViewModel } | { patch: VmPatch } {
  if (fullNext) {
    fullNext = false;
    posted.clear();
    changedRows('a', vm.actors);
    changedRows('p', vm.places);
    for (const k of ['scenario', 'seed', 'site', 'households', 'chronicle', 'belief'] as const) changedSlice(vm, k);
    return { vm };
  }
  return {
    patch: {
      time: vm.time,
      playerId: vm.playerId,
      eventCount: vm.eventCount,
      actorIds: (vm.actors ?? []).map((a) => a.id),
      actors: changedRows('a', vm.actors),
      placeIds: (vm.places ?? []).map((p) => p.id),
      places: changedRows('p', vm.places),
      ...changedSlice(vm, 'scenario'),
      ...changedSlice(vm, 'seed'),
      ...changedSlice(vm, 'site'),
      ...changedSlice(vm, 'households'),
      ...changedSlice(vm, 'chronicle'),
      ...changedSlice(vm, 'belief'),
    },
  };
}

function snapshot(stepMs: number, stepped: number, alerts: Alert[] = []): void {
  if (!session) return;
  const sim = sessionSimOf(session);
  post({
    type: 'snapshot',
    ...snapshotPayload(toViewModel(sim.world, sim.content, viewOptions)),
    hash: null,
    stepMs,
    pending: 0,
    stepped,
    ...(alerts.length ? { alerts } : {}),
  });
}

// ---------------------------------------------------------------------------------------
// The play session: observation, "since last look", outcomes
// ---------------------------------------------------------------------------------------

function emptyDigest(t: number): Digest {
  return { from: t, to: t, elapsed: 0, money: [], needs: [], events: [], said: [], skipped: 0, stops: [] };
}

function strip(o: ActResult['observation']): PlayObservation {
  const {
    truth: _truth,
    beliefGraph: _graph,
    ...fair
  } = o as ActResult['observation'] & {
    truth?: unknown;
    beliefGraph?: unknown;
  };
  return fair;
}

/** Fold one time-advancing result into the digest (what the PC perceived, nothing more: P1). */
function absorb(r: ActResult, at: number): void {
  const o = r.observation;
  digest.to = o.time.t;
  digest.elapsed += r.elapsedMinutes;
  digest.money.push(...o.changes.money);
  money = [...money, ...o.changes.money].slice(-80);
  digest.skipped += o.changes.skipped;
  for (const line of o.changes.needs) {
    const name = line.split(':')[0] ?? line;
    const prior = digest.needs.findIndex((n) => n.startsWith(`${name}:`));
    if (prior < 0) digest.needs.push(line);
    else {
      // Keep where it started and where it ended: "Hunger: steady → hungry".
      const from = (digest.needs[prior] ?? '').split('→')[0]?.trim() ?? `${name}:`;
      const to = line.split('→')[1]?.trim() ?? '';
      digest.needs[prior] = `${from} → ${to}`;
    }
  }
  const seen = new Set(digest.events.map((e) => e.id));
  for (const e of o.events)
    if (!e.routine && e.t >= at && !seen.has(e.id))
      digest.events.push({ id: e.id, t: e.t, summary: e.summary, explain: e.explain });
  const said = new Set(digest.said.map((e) => e.id));
  for (const e of o.said ?? []) if (!said.has(e.id)) digest.said.push(e);
  digest.stops.push(...renderInterrupts(r));
  if (digest.events.length > 40) digest.events = digest.events.slice(-40);
  if (digest.said.length > 12) digest.said = digest.said.slice(-12);
}

function outcomeOf(r: ActResult, label: string): ActOutcome {
  return {
    ok: r.ok,
    ...(r.reason ? { reason: r.reason } : {}),
    ...(r.warning ? { warning: r.warning } : {}),
    ...(r.notice ? { notice: r.notice } : {}),
    ...(r.stopped ? { stopped: r.stopped } : {}),
    elapsedMinutes: r.elapsedMinutes,
    interrupts: r.interrupts,
    ...(r.detail === undefined ? {} : { detail: r.detail, text: renderDetail(r.detail) }),
    label,
    t: r.observation.time.t,
  };
}

function postPlay(): void {
  if (!session || !observation) return;
  post({
    type: 'play',
    play: {
      observation,
      digest,
      last: lastOutcome,
      mode,
      money,
      steps,
    },
  });
}

/** Alerts for the dispatch strip: the session's interrupts, in its own words. */
function alertsOf(r: ActResult): Alert[] {
  const t = r.observation.time.t;
  const out: Alert[] = r.interrupts.map((i) => ({
    category: i.category,
    reason: i.reason,
    text: i.reason,
    score: i.score,
    ...(i.eventId === undefined ? {} : { eventId: i.eventId }),
    t,
  }));
  if (r.stopped) {
    const line = renderInterrupts(r)[0];
    if (line) out.unshift({ category: 'stopped', reason: 'wait stopped', text: line, score: 700, t });
  }
  return out;
}

/** Stop the clock and say so: the UI's chosen speed must follow the worker's (11 §1.6 `❚❚!`). */
function pauseSelf(): void {
  speed = 'paused';
  accumulator = 0;
  post({ type: 'paused' });
}

/** The PC's life ended: only reading remains, and the clock stops for good. */
function ended(): boolean {
  return observation?.ending !== null && observation?.ending !== undefined;
}

/**
 * A player order through the session. Time-taking orders start a fresh digest ("since your
 * last order"); queries take no time and leave it alone.
 */
function order(command: Command | string, label: string, id?: number): void {
  if (!session) return;
  const at = sessionSimOf(session).world.time;
  const r = session.act(command, mode);
  observation = strip(r.observation);
  if (r.ok) steps++;
  const changed = r.elapsedMinutes > 0 || r.elapsedTicks !== undefined;
  if (r.ok && changed) {
    digest = emptyDigest(at);
    absorb(r, at);
  }
  const outcome = outcomeOf(r, label);
  // A quiet read (journal, look) leaves the last order's outcome on show; refusals always show.
  const quiet =
    r.ok &&
    !changed &&
    r.interrupts.length === 0 &&
    r.elapsedMinutes === 0 &&
    (r.detail === undefined || Array.isArray(r.detail));
  if (!quiet) lastOutcome = outcome;
  // Her own order's arrival is already its outcome; a wait's stop, danger or a summons still
  // needs a dispatch. Any interrupt pauses the clock either way (the shared policy, 11 §1.6).
  const isWait = typeof command !== 'string' && command.kind === 'activity.wait';
  const alerts = r.ok ? alertsOf(r).filter((a) => isWait || a.category !== 'arrival') : [];
  if (r.interrupts.length || ended()) pauseSelf();
  // An order that took its hour starts the next hour's countdown afresh; a read leaves it be.
  else if (changed) accumulator = 0;
  if (id !== undefined) post({ type: 'acted', id, outcome });
  // Reads and refusals leave the world as it was: no new view model to send.
  if (changed) snapshot(0, Math.ceil(r.elapsedMinutes / 60), alerts);
  postPlay();
}

/**
 * Let the clock run up to `n` hours, each an `advance(60)` (a logged one-hour wait). When
 * `stopOnAlert`, the first hour that raises a pausing interrupt ends the run and the worker
 * pauses itself, so Ultra never overshoots what the PC would want to see.
 */
function runHours(n: number, stopOnAlert: boolean): void {
  if (!session || ended()) return;
  const t0 = performance.now();
  const alerts: Alert[] = [];
  let stepped = 0;
  for (let i = 0; i < n; i++) {
    const at = sessionSimOf(session).world.time;
    const r = sessionSimOf(session).world.tactical?.active
      ? session.act({ kind: 'tactical.advance', actorId: session.playerId, data: { ticks: 1 } }, mode)
      : session.advance(60, mode);
    observation = strip(r.observation);
    if (r.ok) steps++;
    absorb(r, at);
    stepped++;
    alerts.push(...alertsOf(r));
    if (ended() || ((stopOnAlert || !!r.observation.tactical) && alerts.length > 0)) {
      pauseSelf();
      break;
    }
  }
  snapshot(performance.now() - t0, stepped, alerts);
  postPlay();
}

function tick(): void {
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;
  // Paused keeps the partial hour: resuming continues the countdown to the next hour.
  if (speed === 'paused') return;
  // Tactical throughput: 0.5/1/2 game seconds per real second; Ultra is capped at 2.
  const tactical = !!session && !!sessionSimOf(session).world.tactical?.active;
  accumulator +=
    dt *
    (tactical
      ? speed === 'x1'
        ? TICKS_PER_SECOND / 2
        : speed === 'x2'
          ? TICKS_PER_SECOND
          : 2 * TICKS_PER_SECOND
      : SPEEDS[speed]);
  const whole = Math.floor(accumulator);
  if (whole > 0) {
    // The governor (11 §5.1): a slow device runs the same sim slower, never a different sim.
    const n = Math.min(whole, MAX_HOURS_PER_TICK);
    accumulator -= n;
    runHours(n, true);
  }
  // runHours may have auto-paused (TS narrowed `speed` above).
  if (session && (speed as Speed) !== 'paused' && now - lastProgress >= PROGRESS_MS) {
    lastProgress = now;
    post({ type: 'progress', t: sessionSimOf(session).world.time, frac: Math.min(0.999, accumulator) });
  }
}

function answer(query: Extract<ToWorker, { type: 'query' }>['query']): QueryResult | null {
  if (!session) return null;
  const sim = sessionSimOf(session);
  const pc = session.playerId;
  switch (query.kind) {
    case 'readiness': {
      // Another household's larder is not hers to know in fair play (P1); God view sees all.
      const h = query.holder;
      const mine =
        'actorId' in h
          ? h.actorId === pc
          : sim.world.actors[pc]?.householdId === h.householdId &&
            (!sim.world.region ||
              sim.world.places[sim.world.households[h.householdId]?.homePlaceId ?? 0]?.siteId ===
                sim.world.places[sim.world.actors[pc]?.placeId ?? 0]?.siteId);
      return {
        kind: 'readiness',
        readiness:
          mine || mode === 'god'
            ? provisions.readinessOf(sim.world, sim.content, h, sim.world.time)
            : {
                kcalOnHand: 0,
                kcalPerDay: 0,
                daysOfFoodTenths: 0,
                daysOfFuelTenths: null,
                spoilsFirst: null,
                unpreparable: [],
                warnings: ['These provisions are not known to your character.'],
              },
      };
    }
    case 'storefront':
      return { kind: 'storefront', storefront: storefront(sim, pc) };
    case 'trade_preview':
      return { kind: 'trade_preview', preview: tradePreview(sim, pc, query.order) };
    case 'ledger': {
      // Her own kit and household are hers to know; anyone else's only in God view (P1).
      const holder = query.holder ?? { actorId: pc };
      const mine =
        'actorId' in holder
          ? holder.actorId === pc
          : sim.world.actors[pc]?.householdId === holder.householdId &&
            (!sim.world.region ||
              sim.world.places[sim.world.households[holder.householdId]?.homePlaceId ?? 0]?.siteId ===
                sim.world.places[sim.world.actors[pc]?.placeId ?? 0]?.siteId);
      return {
        kind: 'ledger',
        ledger: mine || mode === 'god' ? foodLedger(sim.world, sim.content, pc, holder) : null,
      };
    }
    case 'save': {
      const o = observation ?? strip(session.observe(mode));
      return {
        kind: 'save',
        json: session.save(),
        stamp: timeView(sim.world.time).stamp,
        place: o.place.name,
        t: sim.world.time,
      };
    }
    case 'log':
      return { kind: 'log', log: session.commandLog, hash: session.hash };
  }
}

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'init': {
        const c = await loadContent();
        let next: PlaySession;
        try {
          next = msg.save
            ? PlaySession.load(c, msg.save)
            : PlaySession.create(c, { source: msg.scenarioId, seed: msg.seed });
        } catch (e) {
          // A save from another build or content: say so, and keep playing what is running.
          const message = e instanceof Error ? e.message : String(e);
          if (session && msg.save) {
            post({ type: 'load_failed', message });
            break;
          }
          if (!msg.save) throw e;
          post({ type: 'load_failed', message });
          next = PlaySession.create(c, { source: msg.scenarioId, seed: msg.seed });
        }
        session = next;
        pauseSelf();
        fullNext = true;
        const sim = sessionSimOf(session);
        viewOptions = {
          ...viewOptions,
          perspective: mode === 'god' ? null : session.playerId,
          omniscient: mode === 'god',
        };
        observation = strip(session.observe(mode));
        digest = emptyDigest(sim.world.time);
        lastOutcome = null;
        money = [];
        steps = session.commandLog.length - 1;
        post({
          type: 'ready',
          scenarios: Object.values(c.scenarios).map((s) => ({ id: s.id, name: s.name })),
          contentHash: c.meta.hash,
          items: sim.content.items,
          actions: {
            activities: Object.values(sim.content.activities).map((a) => ({
              id: a.id,
              name: a.name,
              verb: a.verb,
              at: a.at,
              venue_tags: [...a.venue_tags],
              asleep: a.asleep === true,
              tags: [...a.tags],
              labor: a.labor,
            })),
            interactions: Object.values(sim.content.interactions).map((i) => ({
              id: i.id,
              name: i.name,
              label: i.label,
              description: i.description,
              tags: [...i.tags],
            })),
          },
        });
        snapshot(0, 0);
        postPlay();
        break;
      }
      case 'set_speed':
        speed = ended() ? 'paused' : msg.speed;
        if (timer === null) {
          last = performance.now();
          timer = setInterval(tick, 50);
        }
        break;
      case 'step':
        // A manual hour starts the next hour's countdown afresh.
        accumulator = 0;
        runHours(Math.max(0, Math.min(24 * 7, Math.floor(msg.hours))), false);
        if (session) post({ type: 'progress', t: sessionSimOf(session).world.time, frac: 0 });
        break;
      case 'command':
        order(msg.command, msg.label ?? msg.command.kind, msg.id);
        break;
      case 'wait': {
        if (!session) break;
        // The REPL's own parser turns the phrase into the Command (ADR 0002: one grammar).
        const parsed = parseText(msg.text, session.observe(mode));
        if (typeof parsed === 'string') {
          lastOutcome = {
            ok: false,
            reason: parsed,
            elapsedMinutes: 0,
            interrupts: [],
            label: msg.label ?? msg.text,
            t: sessionSimOf(session).world.time,
          };
          if (msg.id !== undefined) post({ type: 'acted', id: msg.id, outcome: lastOutcome });
          postPlay();
        } else order(parsed, msg.label ?? msg.text, msg.id);
        break;
      }
      case 'seen':
        if (session) digest = emptyDigest(sessionSimOf(session).world.time);
        postPlay();
        break;
      case 'query': {
        const result = answer(msg.query);
        if (result) post({ type: 'query_result', id: msg.id, result });
        break;
      }
      case 'set_view': {
        viewOptions = { ...viewOptions, ...msg.options };
        const god = viewOptions.omniscient === true || viewOptions.perspective === null;
        const next: ObservationMode = god ? 'god' : 'fair';
        if (session && next !== mode) {
          mode = next;
          observation = strip(session.observe(mode));
        }
        // Perspective changes who is in view: send the whole model once.
        fullNext = true;
        snapshot(0, 0);
        postPlay();
        break;
      }
    }
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
