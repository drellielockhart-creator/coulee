import type { HearthDef, ItemDef } from '@coulee/content/schema';
import { expect, it, vi } from 'vitest';
import { fixture } from '../activity/test-fixture.ts';
import { asHouseholdId, asPlaceId } from '../ids.ts';
import { createStack, pantryOf, supplyUnits } from '../items/api.ts';
import { toGameMinute } from '../time.ts';
import { heatPlaces } from './thermal.ts';

vi.mock('../social/api.ts', () => ({ areKin: () => false }));

it('burns hearth fuel once per occupied building and loses its fire when fuel runs out', () => {
  const f = fixture();
  f.world.items.counters = { item: 0 };
  f.content.items.fuel = { id: 'fuel', stackable: true, supply: { kind: 'fire', units: 60 } } as unknown as ItemDef;
  const hearth: HearthDef = {
    id: 'test',
    name: 'Stove',
    place_tags: ['home'],
    when_below_f: 58,
    fuel_kind: 'fire',
    burn_base: 20,
    burn_per_10f: 0,
    ref_f: 40,
    gain_f: 38,
    cap_f: 68,
    unlit_gain_f: 6,
    fuel_from: 'household',
    occupied_only: true,
  };
  f.content.hearths.test = hearth;
  f.world.time = toGameMinute(1855, 1, 1, 5);
  const loc = pantryOf(asHouseholdId(1));
  createStack(f.world, f.ctx(), 'fuel', 1, loc);
  const hot = heatPlaces(f.world, f.ctx())[asPlaceId(1)];
  expect(supplyUnits(f.world, f.content, loc, 'fire')).toBe(40);
  heatPlaces(f.world, f.ctx());
  heatPlaces(f.world, f.ctx());
  expect(supplyUnits(f.world, f.content, loc, 'fire')).toBe(0);
  const cold = heatPlaces(f.world, f.ctx())[asPlaceId(1)];
  expect(hot ?? 0).toBeGreaterThan(cold ?? 0);
  // Routine burning is silent: the log records lighting (with the first hour's fuel) and going out.
  const events = f.world.log.events.filter((e) => e.kind === 'needs.hearth');
  expect(events.map((e) => [e.data.lit, e.data.fuel])).toEqual([
    [true, 20],
    [false, 0],
  ]);
});
