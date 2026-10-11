/** React hook owning the sim worker. OWNER: module:web. */
import type { ActorId, Command, HouseholdId, provisions, ViewModel, ViewOptions } from '@coulee/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import type {
  ActionCatalog,
  Alert,
  FromWorker,
  ItemCatalog,
  Query,
  QueryResult,
  Speed,
  ToWorker,
  VmPatch,
} from './protocol.ts';

export interface SimHandle {
  vm: ViewModel | null;
  items: ItemCatalog;
  actions: ActionCatalog;
  error: string | null;
  stepMs: number;
  /** Commands waiting for the next step. */
  pending: number;
  /** Increments each time the worker actually advanced the clock (drives walk animations). */
  stepSerial: number;
  /** The latest auto-pause, if any (11 §1.6 `❚❚!`). */
  alerts: Alert[];
  clearAlerts: () => void;
  send: (m: ToWorker) => void;
  setSpeed: (s: Speed) => void;
  /** The ONLY way a UI action changes the world (ADR 0002 parity). */
  command: (c: Command) => void;
  setView: (o: Partial<ViewOptions>) => void;
  query: (q: Query) => Promise<QueryResult>;
}

/** Display-only fraction of the current game-hour elapsed (0..1), from worker `progress`. */
export const useProgress = create<{ frac: number }>(() => ({ frac: 0 }));

const EMPTY_ITEMS: ItemCatalog = {};
const EMPTY_ACTIONS: ActionCatalog = { activities: [], interactions: [] };

/** Merge rows by id in `ids` order, keeping unchanged rows' identity (memoized panels skip them). */
function mergeRows<T extends { id: number }>(prev: readonly T[], ids: readonly number[], changed: readonly T[]): T[] {
  const byId = new Map<number, T>(prev.map((r) => [r.id, r]));
  for (const r of changed) byId.set(r.id, r);
  const out: T[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    if (r) out.push(r);
  }
  // Same rows in the same order: keep the old array so selectors see no change.
  return out.length === prev.length && out.every((r, i) => r === prev[i]) ? (prev as T[]) : out;
}

/** Apply a worker patch to the last full view model. Pure (unit-tested). */
export function applyPatch(prev: ViewModel, p: VmPatch): ViewModel {
  return {
    ...prev,
    time: p.time,
    playerId: p.playerId,
    eventCount: p.eventCount,
    actors: mergeRows(prev.actors, p.actorIds, p.actors),
    places: mergeRows(prev.places, p.placeIds, p.places),
    ...(p.scenario ? { scenario: p.scenario } : {}),
    ...(p.seed !== undefined ? { seed: p.seed } : {}),
    ...('site' in p ? { site: p.site ?? null } : {}),
    ...(p.households ? { households: p.households } : {}),
    ...(p.chronicle ? { chronicle: p.chronicle } : {}),
    ...(p.belief ? { belief: p.belief } : {}),
  };
}

export function useSim(scenarioId: string, seed: number): SimHandle {
  const worker = useRef<Worker | null>(null);
  const nextQuery = useRef(1);
  const waiting = useRef(new Map<number, (r: QueryResult) => void>());
  const [vm, setVm] = useState<ViewModel | null>(null);
  const [items, setItems] = useState<ItemCatalog>(EMPTY_ITEMS);
  const [actions, setActions] = useState<ActionCatalog>(EMPTY_ACTIONS);
  const [error, setError] = useState<string | null>(null);
  const [stepMs, setStepMs] = useState(0);
  const [pending, setPending] = useState(0);
  const [stepSerial, setStepSerial] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const w = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    const queries = waiting.current;
    w.onmessage = (ev: MessageEvent<FromWorker>) => {
      const m = ev.data;
      switch (m.type) {
        case 'snapshot': {
          const { vm: full, patch } = m;
          if (full) setVm(full);
          else if (patch) setVm((prev) => (prev ? applyPatch(prev, patch) : prev));
          setPending(m.pending);
          if (m.stepped > 0) {
            setStepMs(m.stepMs);
            setStepSerial((s) => s + 1);
            useProgress.setState({ frac: 0 });
          }
          if (m.alerts?.length) setAlerts(m.alerts);
          break;
        }
        case 'progress':
          // A tiny store, not React state on the handle: only the clock re-renders at 4 Hz.
          useProgress.setState({ frac: m.frac });
          break;
        case 'ready':
          setItems(m.items);
          setActions(m.actions);
          break;
        case 'query_result': {
          const resolve = queries.get(m.id);
          queries.delete(m.id);
          resolve?.(m.result);
          break;
        }
        case 'error':
          setError(m.message);
          break;
      }
    };
    w.onerror = (e) => setError(e.message || 'worker failed to start');
    const init: ToWorker = { type: 'init', scenarioId, seed, withPlayer: true };
    w.postMessage(init);
    return () => {
      w.terminate();
      worker.current = null;
      queries.clear();
    };
  }, [scenarioId, seed]);

  const send = useCallback((m: ToWorker) => worker.current?.postMessage(m), []);
  const setSpeed = useCallback((speed: Speed) => send({ type: 'set_speed', speed }), [send]);
  const command = useCallback((c: Command) => send({ type: 'command', command: c }), [send]);
  const setView = useCallback((options: Partial<ViewOptions>) => send({ type: 'set_view', options }), [send]);
  const clearAlerts = useCallback(() => setAlerts([]), []);
  const query = useCallback(
    (q: Query) =>
      new Promise<QueryResult>((resolve) => {
        const id = nextQuery.current++;
        waiting.current.set(id, resolve);
        send({ type: 'query', id, query: q });
      }),
    [send],
  );
  return {
    vm,
    items,
    actions,
    error,
    stepMs,
    pending,
    stepSerial,
    alerts,
    clearAlerts,
    send,
    setSpeed,
    command,
    setView,
    query,
  };
}

/** Readiness via the worker query (11 §1.7), refreshed whenever the snapshot changes. */
export function useReadiness(
  sim: Pick<SimHandle, 'query' | 'vm'>,
  holder: { actorId: ActorId } | { householdId: HouseholdId } | null,
): provisions.Readiness | null {
  const [r, setR] = useState<provisions.Readiness | null>(null);
  const key = holder === null ? '' : 'actorId' in holder ? `a${holder.actorId}` : `h${holder.householdId}`;
  const t = sim.vm?.time.t ?? -1;
  const { query } = sim;
  // biome-ignore lint/correctness/useExhaustiveDependencies: key encodes holder; t refreshes per snapshot hour
  useEffect(() => {
    if (holder === null) {
      setR(null);
      return;
    }
    setR(null);
    let live = true;
    query({ kind: 'readiness', holder }).then((res) => {
      if (live && res.kind === 'readiness') setR(res.readiness);
    });
    return () => {
      live = false;
    };
  }, [key, t, query]);
  return r;
}
