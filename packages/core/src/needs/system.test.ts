import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { advance, fixture, setActivity } from '../activity/test-fixture.ts';
import { DEFAULT_VIEW_OPTIONS } from '../viewmodel-types.ts';
import { drink, feed, needValue, proposeNeedUrges, satisfyNeed } from './api.ts';
import { needsSystem } from './system.ts';
import { needsDailyStats, viewNeedsActor } from './view.ts';

vi.mock('../social/api.ts', () => ({ areKin: () => false }));

describe('hourly needs', () => {
  it('keeps integer meters and debt bounded under random activity and intake sequences', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            activity: fc.constantFrom('sleep', 'work', 'idle_at_home'),
            kcal: fc.integer({ min: 0, max: 3000 }),
            ml: fc.integer({ min: 0, max: 2000 }),
          }),
          { minLength: 1, maxLength: 80 },
        ),
        (sequence) => {
          const f = fixture();
          for (const hour of sequence) {
            setActivity(f.world, f.id, hour.activity);
            needsSystem(f.world, f.ctx());
            feed(f.world, f.ctx(), f.id, hour.kcal, { label: 'Meal' });
            drink(f.world, f.ctx(), f.id, hour.ml, { label: 'Water' });
            for (const actor of Object.values(f.world.needs.byActor)) {
              for (const value of Object.values(actor.values)) {
                expect(Number.isInteger(value)).toBe(true);
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1000);
              }
              expect(actor.debt?.hunger ?? 0).toBeGreaterThanOrEqual(0);
              expect(actor.debt?.hunger ?? 0).toBeLessThanOrEqual(6000);
            }
            expect(JSON.parse(JSON.stringify(f.world))).toEqual(f.world);
            advance(f.world);
          }
        },
      ),
      { numRuns: 60 },
    );
  });
  it('sleep recovers rest and heavy labor burns more food than rest labor', () => {
    const sleeping = fixture();
    const working = fixture();
    const resting = fixture();
    setActivity(sleeping.world, sleeping.id, 'sleep');
    setActivity(working.world, working.id, 'work');
    setActivity(resting.world, resting.id, 'idle_at_home');
    needsSystem(sleeping.world, sleeping.ctx());
    needsSystem(working.world, working.ctx());
    needsSystem(resting.world, resting.ctx());
    expect(needValue(sleeping.world, sleeping.id, 'rest')).toBeGreaterThan(800);
    expect(needValue(working.world, working.id, 'hunger')).toBeLessThan(needValue(resting.world, resting.id, 'hunger'));
  });
  it('seeds bands/conditions and updates them immediately through the mutation API', () => {
    const f = fixture();
    expect(f.world.needs.byActor[f.id]?.bands.hunger).toBe('Hungry');
    expect(f.world.actors[f.id]?.sheet.conditions).toContain('hungry');
    satisfyNeed(f.world, f.ctx(), f.id, 'hunger', -150, { label: 'Cost' });
    expect(f.world.actors[f.id]?.sheet.conditions).toContain('starving');
    expect(f.world.actors[f.id]?.sheet.conditions).not.toContain('hungry');
    feed(f.world, f.ctx(), f.id, 1500, { label: 'Meal' });
    expect(f.world.actors[f.id]?.sheet.conditions).not.toContain('starving');
    expect(
      f.world.log.events.filter((e) => e.kind.startsWith('needs.')).every((e) => e.explain?.knowledge === 'self'),
    ).toBe(true);
  });
  it('uses 3 kcal and 2 ml per point and repays debt before refilling', () => {
    const f = fixture();
    feed(f.world, f.ctx(), f.id, 300, { label: 'Bread' });
    expect(needValue(f.world, f.id, 'hunger')).toBe(300);
    satisfyNeed(f.world, f.ctx(), f.id, 'thirst', -800, { label: 'Dry' });
    drink(f.world, f.ctx(), f.id, 200, { label: 'Cup' });
    expect(needValue(f.world, f.id, 'thirst')).toBe(100);
    satisfyNeed(f.world, f.ctx(), f.id, 'hunger', -400, { label: 'Missed meal' });
    expect(f.world.needs.byActor[f.id]?.debt?.hunger).toBe(100);
    feed(f.world, f.ctx(), f.id, 300, { label: 'Meal' });
    expect(needValue(f.world, f.id, 'hunger')).toBe(50);
    expect(f.world.needs.byActor[f.id]?.debt?.hunger).toBe(50);
  });
  it('rising deficits propose real urges; fair views reveal only the actor’s own needs', () => {
    const f = fixture();
    const initial = proposeNeedUrges(f.world, f.ctx(), f.id).find((u) => u.drive === 'hunger')?.intensity ?? 0;
    satisfyNeed(f.world, f.ctx(), f.id, 'hunger', -150, { label: 'Cost' });
    expect(proposeNeedUrges(f.world, f.ctx(), f.id).find((u) => u.drive === 'hunger')?.intensity).toBeGreaterThan(
      initial,
    );
    expect(
      viewNeedsActor(f.world, f.content, f.id, { ...DEFAULT_VIEW_OPTIONS, perspective: 2 as typeof f.id }).list,
    ).toEqual([]);
    expect(viewNeedsActor(f.world, f.content, f.id, DEFAULT_VIEW_OPTIONS).list.length).toBe(3);
    expect(needsDailyStats(f.world, f.content)).toHaveProperty('needs_hunger_mean');
  });
});

it('sleep quality reads beginning-of-hour needs, regardless of content iteration order', () => {
  const f = fixture();
  const rest = f.content.needs.rest;
  if (!rest) throw new Error('Missing rest');
  rest.sleep_quality = [{ need: 'hunger', below: 300, pct: -50, label: 'Hungry bed' }];
  satisfyNeed(f.world, f.ctx(), f.id, 'hunger', 110, { label: 'Food' });
  setActivity(f.world, f.id, 'sleep');
  needsSystem(f.world, f.ctx());
  expect(needValue(f.world, f.id, 'hunger')).toBeLessThan(300);
  expect(needValue(f.world, f.id, 'rest')).toBe(910);
  satisfyNeed(f.world, f.ctx(), f.id, 'rest', -300, { label: 'Fatigue' });
  needsSystem(f.world, f.ctx());
  expect(needValue(f.world, f.id, 'rest')).toBe(665);
});

it('applies content value, trait and temperature multipliers with one explicit rounding', () => {
  const f = fixture();
  const hunger = f.content.needs.hunger;
  const actor = f.world.actors[f.id];
  if (!hunger || !actor) throw new Error('Missing actor needs');
  hunger.value_pct = [{ value: 'neighborliness', per_step_pct: 20 }];
  hunger.trait_pct = { test: 200 };
  hunger.temperature_pct = [{ below_f: 100, pct: 120, label: 'Test temperature' }];
  actor.values.neighborliness = 2;
  actor.traits = ['test'];
  satisfyNeed(f.world, f.ctx(), f.id, 'hunger', 600, { label: 'Food' });
  setActivity(f.world, f.id, 'work');
  needsSystem(f.world, f.ctx());
  expect(needValue(f.world, f.id, 'hunger')).toBe(588);
});

it('reads caloric physiology from people fields while preserving intake energy', () => {
  const f = fixture();
  f.content.peoples = { test: { kcal_pct: 70 } } as unknown as typeof f.content.peoples;
  setActivity(f.world, f.id, 'work');
  needsSystem(f.world, f.ctx());
  expect(needValue(f.world, f.id, 'hunger')).toBe(156);
  feed(f.world, f.ctx(), f.id, 300, { label: 'Food' });
  expect(needValue(f.world, f.id, 'hunger')).toBe(256);
});
