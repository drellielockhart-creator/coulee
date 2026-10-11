import type { ViewModel } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { baselineOf, digestLine } from './digest.ts';

const vmAt = (t: number, over: { purse?: number; place?: number; band?: string; entries?: number }) =>
  ({
    time: { t },
    playerId: 1,
    actors: [
      {
        id: 1,
        shortName: 'Ada',
        placeId: over.place ?? 3,
        activity: { verb: 'keeping shop' },
        provisions: { purseCents: over.purse ?? 500 },
        needs: { list: [{ id: 'hunger', name: 'Hunger', band: over.band ?? '' }] },
      },
    ],
    chronicle: {
      recent: Array.from({ length: over.entries ?? 1 }, (_, i) => ({ id: i + 1, text: `entry ${i + 1}` })),
    },
  }) as unknown as ViewModel;
const name = (id: number) => (id === 3 ? 'the store' : 'the church');

describe('what changed since you looked away', () => {
  it('lists only what the PC can see changed', () => {
    const base = baselineOf(vmAt(0, {}));
    const line = digestLine(base, vmAt(180, { purse: 460, place: 4, band: 'Peckish', entries: 3 }), name);
    expect(line).toBe(
      'Since you looked away (3 h): 2 new in the Chronicle · Hunger: content → Peckish · purse −40¢ · now at the church.',
    );
  });
  it('says the world waited when no game time passed (the app pauses while hidden)', () => {
    const base = baselineOf(vmAt(60, {}));
    expect(digestLine(base, vmAt(60, {}), name)).toBe(
      'Welcome back. The world waited for you. Ada: keeping shop · the store. Last: entry 1',
    );
  });
});
