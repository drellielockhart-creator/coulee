/// <reference lib="webworker" />
/**
 * Sim worker: loads the content bundle + scenario, steps the sim, posts view-model
 * snapshots. OWNER: module:web.
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
let viewOptions: ViewOptions = { ...DEFAULT_VIEW_OPTIONS };
let timer: ReturnType<typeof setInterval> | null = null;
let accumulator = 0;
let last = 0;

const post = (m: FromWorker) => self.postMessage(m);

async function loadContent(): Promise<ContentBundle> {
  if (content) return content;
  const res = await fetch(bundleUrl);
  if (!res.ok) throw new Error(`content bundle: HTTP ${res.status}`);
  content = (await res.json()) as ContentBundle;
  return content;
}

function snapshot(stepMs: number): void {
  if (!sim || !content) return;
  post({ type: 'snapshot', vm: toViewModel(sim.world, content, viewOptions), hash: null, stepMs });
}

function stepHours(n: number): void {
  if (!sim) return;
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    step(sim, pending);
    pending = [];
  }
  snapshot(performance.now() - t0);
}

function tick(): void {
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;
  accumulator += dt * SPEEDS[speed];
  const whole = Math.floor(accumulator);
  if (whole > 0) {
    accumulator -= whole;
    stepHours(Math.min(whole, 24));
  }
}

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'init': {
        const c = await loadContent();
        sim = createSim(c, { scenarioId: msg.scenarioId, seed: msg.seed, withPlayer: msg.withPlayer });
        if (sim.world.meta.playerId !== null) viewOptions = { ...viewOptions, perspective: sim.world.meta.playerId };
        post({
          type: 'ready',
          scenarios: Object.values(c.scenarios).map((s) => ({ id: s.id, name: s.name })),
          contentHash: c.meta.hash,
        });
        snapshot(0);
        break;
      }
      case 'set_speed':
        speed = msg.speed;
        if (timer === null) {
          last = performance.now();
          timer = setInterval(tick, 100);
        }
        break;
      case 'step':
        stepHours(msg.hours);
        break;
      case 'command':
        pending.push(msg.command);
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
        snapshot(0);
        break;
    }
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
