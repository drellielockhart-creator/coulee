import type { ViewModel } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import type { VmPatch } from './protocol.ts';
import { applyPatch } from './useSim.ts';

const vm = {
  time: { t: 0 },
  playerId: 1,
  eventCount: 0,
  actors: [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
  ],
  places: [{ id: 9, name: 'Store' }],
  households: [],
  chronicle: { recent: [] },
} as unknown as ViewModel;

describe('snapshot patches', () => {
  it('keeps unchanged rows and slices by identity and applies changed ones', () => {
    const patch = {
      time: { t: 60 },
      playerId: 1,
      eventCount: 3,
      actorIds: [1, 2],
      actors: [{ id: 2, name: 'B2' }],
      placeIds: [9],
      places: [],
    } as unknown as VmPatch;
    const next = applyPatch(vm, patch);
    expect(next.time.t).toBe(60);
    expect(next.actors[0]).toBe(vm.actors[0]);
    expect(next.actors[1]).toMatchObject({ name: 'B2' });
    expect(next.places).toBe(vm.places);
    expect(next.chronicle).toBe(vm.chronicle);
  });
  it('drops people who left the view and keeps the worker order', () => {
    const next = applyPatch(vm, {
      time: { t: 60 },
      playerId: 1,
      eventCount: 3,
      actorIds: [2],
      actors: [],
      placeIds: [9],
      places: [],
    } as unknown as VmPatch);
    expect(next.actors.map((a) => a.id)).toEqual([2]);
  });
});
