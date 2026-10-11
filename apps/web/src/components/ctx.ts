/** Sim handle context so panels can read the view model and send Commands. OWNER: module:web. */
import type { ActorView, ViewModel } from '@coulee/core';
import { createContext, useContext } from 'react';
import type { SimHandle } from '../useSim.ts';

export const SimCtx = createContext<SimHandle | null>(null);

export function useSimCtx(): SimHandle {
  const s = useContext(SimCtx);
  if (!s) throw new Error('SimCtx missing');
  return s;
}

/** The view model; panels only render once it exists. */
export function useVm(): ViewModel {
  const vm = useSimCtx().vm;
  if (!vm) throw new Error('view model not ready');
  return vm;
}

export function actorById(vm: ViewModel, id: number | null): ActorView | null {
  if (id === null) return null;
  return vm.actors.find((a) => a.id === id) ?? null;
}

export function nameOf(vm: ViewModel, id: number): string {
  return vm.actors.find((a) => a.id === id)?.name ?? `#${id}`;
}

export function placeName(vm: ViewModel, id: number | null): string {
  if (id === null) return '—';
  return vm.places.find((p) => p.id === id)?.name ?? '—';
}
