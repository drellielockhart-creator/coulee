/// <reference lib="webworker" />
/**
 * Sim worker: loads the content bundle + scenario, steps the sim, posts view-model
 * snapshots, and answers pure queries from core APIs (11 §1.7). OWNER: module:web.
 *
 * This is the ONLY web file that imports core at runtime. The UI thread imports types only,
 * so it cannot recompute a rule even by accident (parity.test.ts checks this).
 *
 * Auto-pause uses the shared interrupt policy from @coulee/play (ADR 0002 §3): the same
 * perception filter and alert classification that stop a headless `wait`, so the pocket UI and
 * headless play stop on the same events.
 */

import bundleUrl from '@coulee/content/bundle.json?url';
import type { ContentBundle } from '@coulee/content/schema';
import {
  type Command,
  createSim,
  DEFAULT_VIEW_OPTIONS,
  type Event,
  eventsSince,
  provisions,
  type Sim,
  step,
  toViewModel,
  type ViewModel,
  type ViewOptions,
} from '@coulee/core';
import { alertForEvent, type Interrupt, perceivedEvents, provisionsAlert } from '@coulee/play';
import { type Alert, type FromWorker, SPEEDS, type Speed, type ToWorker, type VmPatch } from './protocol.ts';

declare const self: DedicatedWorkerGlobalScope;

let content: ContentBundle | null = null;
let sim: Sim | null = null;
let speed: Speed = 'paused';
let pending: Command[] = [];
/** Explains are on: the Mind tab shows the ego's arbitration (gated by perspective in core). */
let viewOptions: ViewOptions = { ...DEFAULT_VIEW_OPTIONS, includeExplain: true };
let timer: ReturnType<typeof setInterval> | null = null;
/** Fraction of the current game-hour already elapsed at the chosen speed (display + pacing). */
let accumulator = 0;
let last = 0;
let lastProgress = 0;
/** The PC's own readiness after the last step: the provisions alert compares across a step. */
let lastReadiness: provisions.Readiness | null = null;

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
  if (!sim || !content) return;
  post({
    type: 'snapshot',
    ...snapshotPayload(toViewModel(sim.world, content, viewOptions)),
    hash: null,
    stepMs,
    pending: pending.length,
    stepped,
    ...(alerts.length ? { alerts } : {}),
  });
}

// ---------------------------------------------------------------------------------------
// Stepping + the shared auto-pause policy
// ---------------------------------------------------------------------------------------

function nameOf(id: number): string {
  const a = sim?.world.actors[id as never];
  return a ? `${a.name.given} ${a.name.family}`.trim() : 'Someone';
}

/** Display copy for an alert (words only; the policy decided already). */
function alertText(it: Interrupt, e: Event | null): string {
  if (!e || !sim || !content) return it.reason;
  const pc = sim.world.meta.playerId;
  switch (e.kind) {
    case 'social.interaction':
      return e.data.targetId === pc
        ? `${nameOf(e.data.initiatorId)} turns to you: ${e.data.label}`
        : `${nameOf(e.data.initiatorId)}: ${e.data.label}`;
    case 'needs.band_changed':
      return `${content.needs[e.data.needId]?.name ?? e.data.needId}: now ${e.data.to}`;
    case 'activity.moved':
      return e.data.actorId === pc
        ? `You arrive at ${sim.world.places[e.data.to]?.name ?? 'your destination'}`
        : `${nameOf(e.data.actorId)} arrives at ${sim.world.places[e.data.to]?.name ?? 'the place'}`;
    default:
      return e.kind.replace(/^[a-z]+\./, '').replaceAll('_', ' ');
  }
}

/** Alerts the PC perceives in the step just taken (fair play: never off-screen truth). */
function stepAlerts(lastId: number, priorPlace: number | undefined): Alert[] {
  if (!sim || !content) return [];
  const w = sim.world;
  const pc = w.meta.playerId;
  if (pc === null) return [];
  const out: Alert[] = [];
  for (const e of perceivedEvents(eventsSince(w.log, lastId), pc, priorPlace as never)) {
    const it = alertForEvent(w, content, pc, e);
    if (it.pause) out.push({ ...it, text: alertText(it, e), t: w.time });
  }
  const after = provisions.readinessOf(w, content, { actorId: pc }, w.time);
  if (lastReadiness) {
    const food = provisionsAlert(
      lastReadiness.daysOfFoodTenths,
      after.daysOfFoodTenths,
      lastReadiness.daysOfFuelTenths,
      after.daysOfFuelTenths,
    );
    if (food) out.push({ ...food, text: food.reason, t: w.time });
  }
  lastReadiness = after;
  return out;
}

/**
 * Step up to `n` hours. When `stopOnAlert`, the first hour that raises a pausing alert ends the
 * run and the worker pauses itself, so Ultra never overshoots what the PC would want to see.
 */
function stepHours(n: number, stopOnAlert: boolean): void {
  if (!sim) return;
  const t0 = performance.now();
  const alerts: Alert[] = [];
  let stepped = 0;
  for (let i = 0; i < n; i++) {
    const pc = sim.world.meta.playerId;
    const prior = pc === null ? undefined : sim.world.actors[pc]?.placeId;
    const lastId = sim.world.log.lastId;
    step(sim, pending);
    pending = [];
    stepped++;
    alerts.push(...stepAlerts(lastId, prior));
    if (stopOnAlert && alerts.length > 0) {
      speed = 'paused';
      accumulator = 0;
      break;
    }
  }
  snapshot(performance.now() - t0, stepped, alerts);
}

function tick(): void {
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;
  // Paused keeps the partial hour: resuming continues the countdown to the next order.
  if (speed === 'paused') return;
  accumulator += dt * SPEEDS[speed];
  const whole = Math.floor(accumulator);
  if (whole > 0) {
    // The governor (11 §5.1): a slow device runs the same sim slower, never a different sim.
    const n = Math.min(whole, MAX_HOURS_PER_TICK);
    accumulator -= whole;
    stepHours(n, true);
  }
  // stepHours may have auto-paused (TS narrowed `speed` above).
  if (sim && (speed as Speed) !== 'paused' && now - lastProgress >= PROGRESS_MS) {
    lastProgress = now;
    post({ type: 'progress', t: sim.world.time, frac: Math.min(0.999, accumulator) });
  }
}

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'init': {
        const c = await loadContent();
        sim = createSim(c, { scenarioId: msg.scenarioId, seed: msg.seed, withPlayer: msg.withPlayer });
        pending = [];
        accumulator = 0;
        fullNext = true;
        const pc = sim.world.meta.playerId;
        if (pc !== null) {
          viewOptions = { ...viewOptions, perspective: pc };
          lastReadiness = provisions.readinessOf(sim.world, c, { actorId: pc }, sim.world.time);
        }
        post({
          type: 'ready',
          scenarios: Object.values(c.scenarios).map((s) => ({ id: s.id, name: s.name })),
          contentHash: c.meta.hash,
          items: c.items,
          actions: {
            activities: Object.values(c.activities).map((a) => ({
              id: a.id,
              name: a.name,
              verb: a.verb,
              at: a.at,
              venue_tags: [...a.venue_tags],
              asleep: a.asleep === true,
            })),
            interactions: Object.values(c.interactions).map((i) => ({
              id: i.id,
              name: i.name,
              label: i.label,
              description: i.description,
            })),
          },
        });
        snapshot(0, 0);
        break;
      }
      case 'set_speed':
        speed = msg.speed;
        if (timer === null) {
          last = performance.now();
          timer = setInterval(tick, 50);
        }
        break;
      case 'step':
        // A manual hour starts the next hour's countdown afresh.
        accumulator = 0;
        stepHours(Math.max(0, Math.min(24 * 7, Math.floor(msg.hours))), false);
        if (sim) post({ type: 'progress', t: sim.world.time, frac: 0 });
        break;
      case 'command':
        pending.push(msg.command);
        snapshot(0, 0);
        break;
      case 'query': {
        if (!sim || !content) break;
        const q = msg.query;
        if (q.kind === 'readiness') {
          const readiness = provisions.readinessOf(sim.world, content, q.holder, sim.world.time);
          post({ type: 'query_result', id: msg.id, result: { kind: 'readiness', readiness } });
        }
        break;
      }
      case 'set_view':
        viewOptions = { ...viewOptions, ...msg.options };
        // Perspective changes who is in view: send the whole model once.
        fullNext = true;
        snapshot(0, 0);
        break;
    }
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
