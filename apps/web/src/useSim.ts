/** React hook owning the sim worker. OWNER: module:web. */
import type { ActorId, Command, HouseholdId, provisions, ViewModel, ViewOptions } from '@coulee/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import type {
  ActionCatalog,
  ActOutcome,
  Alert,
  FromWorker,
  ItemCatalog,
  PlayState,
  Query,
  QueryResult,
  Speed,
  ToWorker,
  VmPatch,
} from './protocol.ts';

export interface SimHandle {
  vm: ViewModel | null;
  /** The play session: fair observation, "since last look", the last outcome (ADR 0002). */
  play: PlayState | null;
  items: ItemCatalog;
  actions: ActionCatalog;
  error: string | null;
  stepMs: number;
  /** Commands waiting for the next step (always 0 now: orders resolve immediately through the minute budget). */
  pending: number;
  /** Increments each time the worker actually advanced the clock (drives walk animations). */
  stepSerial: number;
  /** The latest auto-pause, if any (11 §1.6 `❚❚!`). */
  alerts: Alert[];
  clearAlerts: () => void;
  send: (m: ToWorker) => void;
  setSpeed: (s: Speed) => void;
  /** The ONLY way a UI action changes the world (ADR 0002 parity): a Command for the session. */
  command: (c: Command) => void;
  /** The same, awaiting the session's verdict (refused orders cost no time). Reads use this. */
  act: (c: Command, label: string) => Promise<ActOutcome>;
  /**
   * A player's order: one at a time across every panel. While one is being lived, another is
   * refused at once (no time passes) rather than queued against a stale observation.
   */
  order: (c: Command, label: string) => Promise<ActOutcome>;
  /** An order (or a wait) is being lived in the worker. */
  busy: boolean;
  /** Increments whenever the worker stops its own clock (the UI's chosen speed follows). */
  pauses: number;
  /** A wait phrase in the REPL's own words ("wait 4h", "wait until dawn"). */
  wait: (text: string, label: string) => Promise<ActOutcome>;
  /** The player has read the digest. */
  seen: () => void;
  setView: (o: Partial<ViewOptions>) => void;
  query: (q: Query) => Promise<QueryResult>;
  /** Start again: a new arrival, or the given `PlaySession.save()` string. Resolves when the worker
   * has the new session, or with the reason a save was refused (the old session carries on). */
  restart: (save?: string) => Promise<{ ok: boolean; message?: string }>;
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

export function useSim(scenarioId: string, seed: number, initialSave?: string): SimHandle {
  const worker = useRef<Worker | null>(null);
  const nextId = useRef(1);
  const waiting = useRef(new Map<number, (r: QueryResult) => void>());
  const acting = useRef(new Map<number, (r: ActOutcome) => void>());
  const [vm, setVm] = useState<ViewModel | null>(null);
  const [play, setPlay] = useState<PlayState | null>(null);
  const [items, setItems] = useState<ItemCatalog>(EMPTY_ITEMS);
  const [actions, setActions] = useState<ActionCatalog>(EMPTY_ACTIONS);
  const [error, setError] = useState<string | null>(null);
  const [stepMs, setStepMs] = useState(0);
  const [pending, setPending] = useState(0);
  const [stepSerial, setStepSerial] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pauses, setPauses] = useState(0);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(0);
  const restarting = useRef<((r: { ok: boolean; message?: string }) => void) | null>(null);
  const firstSave = useRef(initialSave);

  useEffect(() => {
    const w = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    const queries = waiting.current;
    const acts = acting.current;
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
        case 'play':
          setPlay(m.play);
          break;
        case 'acted': {
          const resolve = acts.get(m.id);
          acts.delete(m.id);
          resolve?.(m.outcome);
          break;
        }
        case 'progress':
          // A tiny store, not React state on the handle: only the clock re-renders at 4 Hz.
          useProgress.setState({ frac: m.frac });
          break;
        case 'ready':
          setItems(m.items);
          setActions(m.actions);
          restarting.current?.({ ok: true });
          restarting.current = null;
          break;
        case 'paused':
          setPauses((n) => n + 1);
          break;
        case 'load_failed':
          restarting.current?.({ ok: false, message: m.message });
          restarting.current = null;
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
    const init: ToWorker = {
      type: 'init',
      scenarioId,
      seed,
      withPlayer: true,
      ...(firstSave.current ? { save: firstSave.current } : {}),
    };
    w.postMessage(init);
    return () => {
      w.terminate();
      worker.current = null;
      queries.clear();
      acts.clear();
    };
  }, [scenarioId, seed]);

  const send = useCallback((m: ToWorker) => worker.current?.postMessage(m), []);
  const setSpeed = useCallback((speed: Speed) => send({ type: 'set_speed', speed }), [send]);
  const command = useCallback((c: Command) => send({ type: 'command', command: c }), [send]);
  const act = useCallback(
    (c: Command, label: string) =>
      new Promise<ActOutcome>((resolve) => {
        const id = nextId.current++;
        acting.current.set(id, resolve);
        send({ type: 'command', command: c, id, label });
      }),
    [send],
  );
  /** One order at a time across every panel; a second is refused at once, costing nothing. */
  const guarded = useCallback((label: string, run: () => Promise<ActOutcome>): Promise<ActOutcome> => {
    if (inFlight.current > 0)
      return Promise.resolve({
        ok: false,
        reason: 'Another order is still being carried out',
        elapsedMinutes: 0,
        interrupts: [],
        label,
        t: -1,
      });
    inFlight.current++;
    setBusy(true);
    return run().finally(() => {
      inFlight.current--;
      setBusy(inFlight.current > 0);
    });
  }, []);
  const order = useCallback((c: Command, label: string) => guarded(label, () => act(c, label)), [guarded, act]);
  const wait = useCallback(
    (text: string, label: string) =>
      guarded(
        label,
        () =>
          new Promise<ActOutcome>((resolve) => {
            const id = nextId.current++;
            acting.current.set(id, resolve);
            send({ type: 'wait', text, id, label });
          }),
      ),
    [send, guarded],
  );
  const seen = useCallback(() => send({ type: 'seen' }), [send]);
  const setView = useCallback((options: Partial<ViewOptions>) => send({ type: 'set_view', options }), [send]);
  const clearAlerts = useCallback(() => setAlerts([]), []);
  const query = useCallback(
    (q: Query) =>
      new Promise<QueryResult>((resolve) => {
        const id = nextId.current++;
        waiting.current.set(id, resolve);
        send({ type: 'query', id, query: q });
      }),
    [send],
  );
  const restart = useCallback(
    (save?: string) =>
      new Promise<{ ok: boolean; message?: string }>((resolve) => {
        restarting.current?.({ ok: false, message: 'superseded' });
        restarting.current = (r) => {
          if (r.ok) setAlerts([]);
          resolve(r);
        };
        send({ type: 'init', scenarioId, seed, withPlayer: true, ...(save ? { save } : {}) });
      }),
    [send, scenarioId, seed],
  );
  return {
    vm,
    play,
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
    act,
    order,
    busy,
    pauses,
    wait,
    seen,
    setView,
    query,
    restart,
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

/**
 * A worker query re-asked whenever the play state moves (each observation), with a short
 * debounce for slider/stepper drags (11 §1.7: queries debounce at 100 ms).
 */
export function useQuery<K extends QueryResult['kind']>(
  sim: Pick<SimHandle, 'query' | 'play'>,
  q: Query | null,
  kind: K,
): Extract<QueryResult, { kind: K }> | null {
  const [r, setR] = useState<Extract<QueryResult, { kind: K }> | null>(null);
  const key = q === null ? '' : JSON.stringify(q);
  const stamp = sim.play ? `${sim.play.observation.time.t}:${sim.play.steps}` : '';
  const { query } = sim;
  // biome-ignore lint/correctness/useExhaustiveDependencies: key encodes the query; stamp refreshes per change
  useEffect(() => {
    if (q === null) {
      setR(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      query(q).then((res) => {
        if (live && res.kind === kind) setR(res as Extract<QueryResult, { kind: K }>);
      });
    }, 60);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key, stamp, query, kind]);
  return r;
}
