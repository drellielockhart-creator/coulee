/** React hook owning the sim worker. OWNER: module:web. */
import type { ActorId, Command, HouseholdId, provisions, ViewModel, ViewOptions } from '@coulee/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionCatalog, FromWorker, ItemCatalog, Query, QueryResult, Speed, ToWorker } from './protocol.ts';

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
  send: (m: ToWorker) => void;
  setSpeed: (s: Speed) => void;
  /** The ONLY way a UI action changes the world (ADR 0002 parity). */
  command: (c: Command) => void;
  setView: (o: Partial<ViewOptions>) => void;
  query: (q: Query) => Promise<QueryResult>;
}

const EMPTY_ITEMS: ItemCatalog = {};
const EMPTY_ACTIONS: ActionCatalog = { activities: [], interactions: [] };

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

  useEffect(() => {
    const w = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    const queries = waiting.current;
    w.onmessage = (ev: MessageEvent<FromWorker>) => {
      const m = ev.data;
      switch (m.type) {
        case 'snapshot':
          setVm(m.vm);
          setPending(m.pending);
          if (m.stepped > 0) {
            setStepMs(m.stepMs);
            setStepSerial((s) => s + 1);
          }
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
  const query = useCallback(
    (q: Query) =>
      new Promise<QueryResult>((resolve) => {
        const id = nextQuery.current++;
        waiting.current.set(id, resolve);
        send({ type: 'query', id, query: q });
      }),
    [send],
  );
  return { vm, items, actions, error, stepMs, pending, stepSerial, send, setSpeed, command, setView, query };
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
