/// <reference lib="webworker" />
/**
 * Sim worker: loads the content bundle + scenario, steps the sim, posts view-model
 * snapshots, and answers pure queries from core APIs (11 §1.7). OWNER: module:web.
 *
 * This is the ONLY web file that imports core at runtime. The UI thread imports types only,
 * so it cannot recompute a rule even by accident (parity.test.ts checks this).
 */

import bundleUrl from '@coulee/content/bundle.json?url';
import type { ContentBundle } from '@coulee/content/schema';
import {
  type Command,
  createSim,
  DEFAULT_VIEW_OPTIONS,
  provisions,
  type Sim,
  step,
  toViewModel,
  type ViewOptions,
} from '@coulee/core';
import { type FromWorker, SPEEDS, type Speed, type ToWorker } from './protocol.ts';

declare const self: DedicatedWorkerGlobalScope;

let content: ContentBundle | null = null;
let sim: Sim | null = null;
let speed: Speed = 'paused';
let pending: Command[] = [];
/** Explains are on: the Mind tab shows the ego's arbitration (gated by perspective in core). */
let viewOptions: ViewOptions = { ...DEFAULT_VIEW_OPTIONS, includeExplain: true };
let timer: ReturnType<typeof setInterval> | null = null;
let accumulator = 0;
let last = 0;

/** Never block the worker for more than this many game-hours per tick (Ultra on a slow phone). */
const MAX_HOURS_PER_TICK = 6;

const post = (m: FromWorker) => self.postMessage(m);

async function loadContent(): Promise<ContentBundle> {
  if (content) return content;
  const res = await fetch(bundleUrl);
  if (!res.ok) throw new Error(`content bundle: HTTP ${res.status}`);
  content = (await res.json()) as ContentBundle;
  return content;
}

function snapshot(stepMs: number, stepped: number): void {
  if (!sim || !content) return;
  post({
    type: 'snapshot',
    vm: toViewModel(sim.world, content, viewOptions),
    hash: null,
    stepMs,
    pending: pending.length,
    stepped,
  });
}

function stepHours(n: number): void {
  if (!sim) return;
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    step(sim, pending);
    pending = [];
  }
  snapshot(performance.now() - t0, n);
}

function tick(): void {
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;
  if (speed === 'paused') {
    accumulator = 0;
    return;
  }
  accumulator += dt * SPEEDS[speed];
  const whole = Math.floor(accumulator);
  if (whole > 0) {
    // The governor (11 §5.1): a slow device runs the same sim slower, never a different sim.
    const n = Math.min(whole, MAX_HOURS_PER_TICK);
    accumulator -= whole;
    stepHours(n);
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
        if (sim.world.meta.playerId !== null) viewOptions = { ...viewOptions, perspective: sim.world.meta.playerId };
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
        stepHours(Math.max(0, Math.min(24 * 7, Math.floor(msg.hours))));
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
        snapshot(0, 0);
        break;
    }
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
