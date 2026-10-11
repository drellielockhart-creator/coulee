/** React hook owning the sim worker. OWNER: module:web. */
import type { ViewModel } from '@coulee/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FromWorker, Speed, ToWorker } from './protocol.ts';

export interface SimHandle {
  vm: ViewModel | null;
  error: string | null;
  stepMs: number;
  send: (m: ToWorker) => void;
  setSpeed: (s: Speed) => void;
}

export function useSim(scenarioId: string, seed: number): SimHandle {
  const worker = useRef<Worker | null>(null);
  const [vm, setVm] = useState<ViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepMs, setStepMs] = useState(0);

  useEffect(() => {
    const w = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (ev: MessageEvent<FromWorker>) => {
      const m = ev.data;
      if (m.type === 'snapshot') {
        setVm(m.vm);
        setStepMs(m.stepMs);
      } else if (m.type === 'error') setError(m.message);
    };
    const init: ToWorker = { type: 'init', scenarioId, seed, withPlayer: true };
    w.postMessage(init);
    return () => {
      w.terminate();
      worker.current = null;
    };
  }, [scenarioId, seed]);

  const send = useCallback((m: ToWorker) => worker.current?.postMessage(m), []);
  const setSpeed = useCallback((speed: Speed) => send({ type: 'set_speed', speed }), [send]);
  return { vm, error, stepMs, send, setSpeed };
}
