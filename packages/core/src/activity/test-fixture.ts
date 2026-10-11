import type { ActivityDef, ContentBundle, NeedDef, OccupationDef } from '../content.ts';
import { type ActorId, asActorId, asHouseholdId, asPlaceId } from '../ids.ts';
import { createNeedsState, initNeedsState } from '../needs/state.ts';
import { rng } from '../rng.ts';
import { asGameMinute, toGameMinute } from '../time.ts';
import type { World } from '../world.ts';
import { createActivityState, initActivityState } from './state.ts';

export function activityDef(id: string, fields: Partial<ActivityDef> = {}): ActivityDef {
  return {
    id,
    name: id,
    verb: id,
    description: '',
    at: 'home',
    venue_tags: [],
    labor: 'light',
    asleep: false,
    needs: {},
    sociability: 0,
    min_hours: 1,
    tags: [],
    yields: [],
    ...fields,
  };
}
export function needDef(id: string, fields: Partial<NeedDef> = {}): NeedDef {
  return {
    id,
    name: id,
    description: '',
    kind: 'physical',
    initial: 800,
    decay_per_hour: 42,
    asleep_pct: 50,
    labor_pct: { rest: 70, light: 100, heavy: 150 },
    bands: [],
    value_pct: [],
    trait_pct: {},
    temperature_pct: [],
    sleep_quality: [],
    urges: [],
    only_traits: [],
    decay_min_age: 0,
    ...fields,
  };
}
export function fixture(count = 3) {
  const content = {
    meta: { hash: 'test' },
    needs: {
      hunger: needDef('hunger', {
        intake: { unit: 'kcal', per_point: 3 },
        bands: [
          { below: 300, label: 'Hungry', condition: 'hungry' },
          { below: 100, label: 'Starving', condition: 'starving' },
        ],
        debt: { cap: 6000, repay_pct: 50, bands: [{ at_least: 100, label: 'Gaunt', condition: 'gaunt' }] },
        urges: [{ activity: 'take_meal', below: 600, ceiling: 900, drive: 'hunger', label: 'Eat' }],
      }),
      thirst: needDef('thirst', { intake: { unit: 'ml', per_point: 2 } }),
      rest: needDef('rest', {
        decay_per_hour: 55,
        asleep_pct: 0,
        urges: [{ activity: 'sleep', below: 600, ceiling: 800, drive: 'sloth', label: 'Rest' }],
      }),
    },
    activities: {
      sleep: activityDef('sleep', { labor: 'rest', asleep: true, needs: { rest: 110 }, min_hours: 4 }),
      work: activityDef('work', { at: 'workplace', labor: 'heavy', tags: ['labor'] }),
      idle_at_home: activityDef('idle_at_home', { labor: 'rest' }),
      take_meal: activityDef('take_meal'),
      drink_at_tavern: activityDef('drink_at_tavern', { at: 'venue', venue_tags: ['tavern'] }),
    },
    occupations: {
      smith: {
        id: 'smith',
        name: 'Smith',
        description: '',
        workplace_tags: ['smithy'],
        wage_cents_per_day: 0,
        skills: [],
        roles: [],
        confined: false,
        schedule: [
          { from: 8, to: 18, activity: 'work', duty: 550, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
          { from: 21, to: 6, activity: 'sleep', duty: 300 },
        ],
      } satisfies OccupationDef,
    },
    observances: {},
    hearths: {},
    items: {},
  } as unknown as ContentBundle;
  const world = {
    meta: { seed: 42 },
    time: toGameMinute(1855, 4, 2, 8),
    actors: {},
    households: {},
    places: {},
    index: { actorByKey: {}, householdByKey: {}, placeByDef: {} },
    log: { lastId: 0, events: [] },
    needs: createNeedsState(),
    activity: createActivityState(),
    psyche: { byActor: {} },
    items: { stacks: {} },
    social: { kin: [] },
  } as unknown as World;
  for (let id = 1; id <= count; id++) {
    const aid = asActorId(id);
    const hid = asHouseholdId(id);
    world.actors[aid] = {
      id: aid,
      key: `actor_${id}`,
      name: { given: 'Actor', family: `${id}` },
      sex: 'female',
      born: toGameMinute(1825, 1, 1),
      ancestryId: 'test',
      presentsAsId: 'test',
      occupationId: 'smith',
      householdId: hid,
      placeId: asPlaceId(1),
      values: {
        piety: 0,
        thrift: 0,
        neighborliness: 0,
        parochialism: 0,
        superstition: 0,
        ambition: 0,
        temper: 0,
        rancor: 0,
        discretion: 0,
      },
      traits: [],
      sheet: {
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        skills: {},
        level: 1,
        feats: [],
        conditions: [],
        languages: [],
        literate: false,
      },
      controller: 'ai',
      alive: true,
    };
    world.households[hid] = {
      id: hid,
      key: `${id}`,
      name: 'Home',
      headId: aid,
      memberIds: [aid],
      homePlaceId: asPlaceId(1),
    };
  }
  for (let id = 1; id <= 3; id++)
    world.places[id] = {
      id: asPlaceId(id),
      defId: `${id}`,
      name: `${id}`,
      siteId: 'town',
      kind: 'building',
      tags: [id === 1 ? 'home' : id === 2 ? 'smithy' : 'tavern'],
      x: id * 10,
      y: 0,
      w: 1,
      h: 1,
      rotation: 0,
      capacity: 50,
      model: null,
      faeIntensity: 0,
    };
  const scenario = {
    actors: Object.values(world.actors).map((a) => ({ key: a.key, needs: { hunger: 200 } })),
  } as unknown as import('../content.ts').ScenarioDef;
  const ctx = fixtureContext(world, content);
  initNeedsState(world, { ...ctx, scenario });
  initActivityState(world, { ...ctx, scenario });
  return { world, content, id: asActorId(1), ctx: () => fixtureContext(world, content) };
}
/** Independent contexts for unit fixtures avoid simulation-system imports. */
export function fixtureContext(world: World, content: ContentBundle) {
  return {
    content,
    seed: world.meta.seed,
    now: world.time,
    cal: importCalendar(world.time),
    isNewDay: world.time % 1440 === 0,
    commands: [],
    rng: (stream: import('../rng.ts').Stream, key: number) => rng(world.meta.seed, stream, world.time, key),
    emit: (event: import('../events/index.ts').EventInput) => appendFixture(world, event),
  };
}

import { appendEvent } from '../events/index.ts';
import { calendarAt as importCalendar } from '../time.ts';

function appendFixture(world: World, event: import('../events/index.ts').EventInput) {
  return appendEvent(world.log, event, world.time);
}
export function advance(world: World): void {
  world.time = asGameMinute(world.time + 60);
}
export function setActivity(world: World, id: ActorId, activityId: string): void {
  const activity = world.activity.byActor[id];
  if (activity) activity.activityId = activityId;
}
