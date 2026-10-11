import type { ObservanceDef } from '@coulee/content/schema';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { asActorId, asPlaceId } from '../ids.ts';
import type { ActorPsyche } from '../psyche/state.ts';
import { asGameMinute, calendarAt, toGameMinute } from '../time.ts';
import { hourInBlock, proposeActivityUrges, scheduledBlock } from './api.ts';
import { observanceActive, routineFor } from './calendar.ts';
import { recomputeOccupancy } from './state.ts';
import { activitySystem } from './system.ts';
import { activityDef, advance, fixture } from './test-fixture.ts';

vi.mock('../social/api.ts', () => ({ areKin: () => false }));

function observance(fields: Partial<ObservanceDef> = {}): ObservanceDef {
  return {
    id: 'test',
    name: 'Test',
    description: '',
    when: { weekdays: ['sun'] },
    rest_labor: false,
    exempt_roles: [],
    closes: [],
    announce: false,
    blocks: [],
    ...fields,
  };
}
function block(activity: string, from = 9, to = 12) {
  return {
    activity,
    from,
    to,
    priority: 50,
    duty: 550,
    duty_values: {},
    override_sleep: false,
    who: {},
    announce: false,
  };
}

describe('activity round', () => {
  it('follows work and night schedules with a null psyche choice', () => {
    const f = fixture();
    activitySystem(f.world, f.ctx());
    expect(f.world.actors[f.id]?.placeId).toBe(asPlaceId(2));
    f.world.time = toGameMinute(1855, 4, 2, 22);
    activitySystem(f.world, f.ctx());
    expect(f.world.activity.byActor[f.id]?.activityId).toBe('sleep');
    expect(f.world.actors[f.id]?.placeId).toBe(asPlaceId(1));
    expect(proposeActivityUrges(f.world, f.ctx(), f.id)[0]?.voice).toBe('superego');
  });
  it('executes a directly injected choice at the tavern and honors minimum blocks', () => {
    const f = fixture();
    f.world.psyche.byActor[f.id] = {
      chosen: {
        urge: { kind: 'activity', activityId: 'drink_at_tavern' },
        voice: 'command',
        compromise: false,
        at: f.world.time,
        explain: {
          kind: 'arbitration',
          label: 'Command',
          subjects: [f.id],
          knowledge: 'self',
          terms: [],
          total: 1000,
          outcome: 'chosen',
        },
      },
    } as unknown as ActorPsyche;
    activitySystem(f.world, f.ctx());
    expect(f.world.actors[f.id]?.placeId).toBe(asPlaceId(3));
    const state = f.world.activity.byActor[f.id];
    if (!state) throw new Error('Missing activity');
    state.activityId = 'sleep';
    state.lockedUntil = asGameMinute(f.world.time + 120);
    const actor = f.world.actors[f.id];
    if (actor) actor.placeId = asPlaceId(1);
    state.placeId = asPlaceId(1);
    advance(f.world);
    activitySystem(f.world, f.ctx());
    expect(state.activityId).toBe('sleep');
    advance(f.world);
    activitySystem(f.world, f.ctx());
    expect(state.activityId).toBe('drink_at_tavern');
  });
  it('handles sun anchors, wrapping months, seasons, missing venues and idle fallback', () => {
    const f = fixture();
    const occupation = f.content.occupations.smith;
    if (!occupation) throw new Error('Missing smith');
    f.content.activities.winter = activityDef('winter', { months: [11, 2] });
    f.content.activities.unavailable = activityDef('unavailable', { at: 'venue', venue_tags: ['missing'] });
    occupation.schedule = [
      {
        from: 0,
        to: 24,
        activity: 'winter',
        fallback: 'work',
        duty: 600,
        seasons: ['spring'],
        from_sun: { anchor: 'sunrise', offset_h: 1, min_hour: 0, max_hour: 24 },
        to_sun: { anchor: 'sunset', offset_h: -1, min_hour: 0, max_hour: 24 },
      },
    ];
    expect(scheduledBlock(f.world, f.ctx(), f.id, f.ctx().cal)?.activity).toBe('work');
    f.world.time = toGameMinute(1855, 4, 2, 3);
    expect(scheduledBlock(f.world, f.ctx(), f.id, f.ctx().cal)).toBeNull();
    f.world.time = toGameMinute(1855, 1, 2, 12);
    expect(scheduledBlock(f.world, f.ctx(), f.id, f.ctx().cal)).toBeNull();
    occupation.schedule = [{ from: 0, to: 24, activity: 'unavailable', fallback: 'idle_at_home', duty: 200 }];
    expect(scheduledBlock(f.world, f.ctx(), f.id, f.ctx().cal)?.activity).toBe('idle_at_home');
    occupation.schedule = [];
    expect(routineFor(f.world, f.ctx(), f.id)?.activityId).toBe('idle_at_home');
    expect(hourInBlock(2, 21, 6)).toBe(true);
    expect(hourInBlock(6, 21, 6)).toBe(false);
  });
  it('keeps attendance fixed across a gathering; observes Sabbath and market day', () => {
    const f = fixture(20);
    f.content.activities.attend_church = activityDef('attend_church', {
      at: 'venue',
      venue_tags: ['tavern'],
      tags: ['worship'],
    });
    f.content.observances.sabbath = observance({
      rest_labor: true,
      rest_activity: 'idle_at_home',
      blocks: [
        {
          ...block('attend_church'),
          attend: { base_pct: 70, value_pct: {}, trait_pct: {}, weather_pct: [] },
          fallback: 'idle_at_home',
        },
      ],
    });
    f.world.time = toGameMinute(1855, 4, 1, 9);
    const first = Object.keys(f.world.actors).map(
      (key) => routineFor(f.world, f.ctx(), asActorId(Number(key)))?.activityId,
    );
    advance(f.world);
    expect(
      Object.keys(f.world.actors).map((key) => routineFor(f.world, f.ctx(), asActorId(Number(key)))?.activityId),
    ).toEqual(first);
    expect(first.filter((id) => id === 'attend_church').length).toBeGreaterThan(10);
    expect(f.world.log.events.filter((e) => e.kind === 'activity.attendance')).toHaveLength(20);
    f.world.time = toGameMinute(1855, 4, 7, 10);
    f.content.observances.market = observance({ when: { weekdays: ['sat'] }, blocks: [block('drink_at_tavern')] });
    expect(routineFor(f.world, f.ctx(), f.id)?.activityId).toBe('drink_at_tavern');
    f.world.time = toGameMinute(1855, 4, 1, 15);
    expect(routineFor(f.world, f.ctx(), f.id)?.activityId).toBe('idle_at_home');
  });
  it('recognizes Easter offsets and protects scheduled sleep from ordinary gatherings', () => {
    const f = fixture();
    const easter = observance({ when: { easter_offset: 0 } });
    expect(observanceActive(easter, calendarAt(toGameMinute(1855, 4, 8)))).toBe(true);
    expect(observanceActive(easter, calendarAt(toGameMinute(1855, 4, 1)))).toBe(false);
    f.content.observances.late = observance({
      when: { weekdays: ['mon'] },
      blocks: [block('drink_at_tavern', 22, 24)],
    });
    f.world.time = toGameMinute(1855, 4, 2, 22);
    expect(routineFor(f.world, f.ctx(), f.id)?.activityId).toBe('sleep');
  });
  it('occupancy matches living actor places for every hour of random choices', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 5, maxLength: 5 }), {
          minLength: 1,
          maxLength: 40,
        }),
        (hours) => {
          const f = fixture(5);
          for (const places of hours) {
            for (let index = 0; index < places.length; index++) {
              const actor = f.world.actors[index + 1];
              if (actor) actor.placeId = asPlaceId(places[index] ?? 1);
            }
            recomputeOccupancy(f.world);
            for (let place = 1; place <= 3; place++)
              expect(f.world.activity.occupancy[place] ?? []).toEqual(
                Object.values(f.world.actors)
                  .filter((a) => a.alive && a.placeId === place)
                  .map((a) => a.id),
              );
            activitySystem(f.world, f.ctx());
            for (let place = 1; place <= 3; place++)
              expect(f.world.activity.occupancy[place] ?? []).toEqual(
                Object.values(f.world.actors)
                  .filter((a) => a.alive && a.placeId === place)
                  .map((a) => a.id),
              );
            advance(f.world);
          }
        },
      ),
      { numRuns: 60 },
    );
  });
});

import { DEFAULT_VIEW_OPTIONS } from '../viewmodel-types.ts';
import { viewActivityActor, viewActivityPlace } from './view.ts';

it('activity views expose only observed venues and conceal the source of another mind’s choice', () => {
  const f = fixture();
  activitySystem(f.world, f.ctx());
  const viewer = f.world.actors[2];
  if (viewer) viewer.placeId = asPlaceId(1);
  const opts = { ...DEFAULT_VIEW_OPTIONS, perspective: asActorId(2) };
  expect(viewActivityActor(f.world, f.content, f.id, opts)).toMatchObject({
    observed: false,
    activityId: null,
    placeId: 0,
  });
  expect(viewActivityPlace(f.world, f.content, asPlaceId(2), opts).occupantIds).toEqual([]);
  if (viewer) viewer.placeId = asPlaceId(2);
  expect(viewActivityActor(f.world, f.content, f.id, opts)).toMatchObject({
    observed: true,
    activityId: 'work',
    source: 'observed',
  });
  expect(viewActivityActor(f.world, f.content, f.id, { ...opts, omniscient: true }).source).toBe('schedule');
});

it('content participation limits apply to schedules and directly chosen activities alike', () => {
  const f = fixture();
  const work = f.content.activities.work;
  const occupation = f.content.occupations.smith;
  if (!work || !occupation) throw new Error('Missing work');
  work.min_age = 40;
  occupation.schedule = [{ from: 0, to: 24, activity: 'work', fallback: 'idle_at_home', duty: 550 }];
  expect(scheduledBlock(f.world, f.ctx(), f.id, f.ctx().cal)?.activity).toBe('idle_at_home');
  activitySystem(f.world, f.ctx());
  expect(f.world.activity.byActor[f.id]?.activityId).toBe('idle_at_home');
});

import { findNonIntegers, hashValue } from '../hash.ts';
import { needsSystem } from '../needs/system.ts';
import type { World } from '../world.ts';
import { fixtureContext } from './test-fixture.ts';

it('needs and calendar remain deterministic and plain JSON through a mid-day save/load', () => {
  const a = fixture();
  const b = fixture();
  for (const f of [a, b])
    f.content.observances.test = observance({
      when: { weekdays: ['mon', 'tue', 'wed', 'thu'] },
      blocks: [
        {
          ...block('drink_at_tavern', 19, 21),
          attend: { base_pct: 40, value_pct: { piety: -8 }, trait_pct: {}, weather_pct: [] },
        },
      ],
    });
  const run = (world: World, hours: number) => {
    for (let h = 0; h < hours; h++) {
      const ctx = fixtureContext(world, a.content);
      needsSystem(world, ctx);
      activitySystem(world, ctx);
      advance(world);
    }
  };
  run(a.world, 72);
  run(b.world, 31);
  const resumed = JSON.parse(JSON.stringify(b.world)) as World;
  run(resumed, 41);
  expect(hashValue(resumed)).toBe(hashValue(a.world));
  expect(findNonIntegers(a.world)).toEqual([]);
  expect(JSON.parse(JSON.stringify(a.world))).toEqual(a.world);
});

import { activityExplain } from './explain.ts';

it('copies incoming arbitration math into JSON-stable activity event explanations', () => {
  const explain = {
    kind: 'choice',
    label: 'Test',
    subjects: [],
    knowledge: 'self' as const,
    terms: [{ source: 'psyche', label: 'Zero', value: -0 }],
    total: -0,
    outcome: 'chosen',
  };
  const normalized = activityExplain(explain);
  expect(JSON.parse(JSON.stringify(normalized))).toEqual(normalized);
  expect(Object.is(explain.terms[0]?.value, -0)).toBe(true);
});
