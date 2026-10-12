/**
 * module:psyche integration tests (Iron Ford, real content). MODULES.md module:psyche acceptance.
 * Assertions are about psyche's own behavior; they hold whether the other modules' proposal
 * APIs are stubs or real (psyche's fallback thought rules fill the gaps).
 */
import {
  type ActorId,
  type Command,
  makeContext,
  psyche,
  runHours,
  type Sim,
  sameUrge,
  step,
  toViewModel,
  type World,
  yearsBetween,
} from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { actorByKey, baseContent, simFor } from './helpers.ts';

const content = baseContent();

function living(world: World): ActorId[] {
  return Object.keys(world.actors)
    .map(Number)
    .filter((id) => world.actors[id]?.alive)
    .sort((a, b) => a - b) as ActorId[];
}

/** Advance to the next hour h (0..23) on a weekday (Mon–Sat). */
function advanceTo(sim: Sim, hour: number): void {
  for (let i = 0; i < 24 * 8; i++) {
    const t = sim.world.time;
    const h = Math.floor((t % 1440) / 60);
    const day = Math.floor(t / 1440);
    // 1855-04-01 was a Sunday; the epoch is that day.
    const weekday = ((day % 7) + 7) % 7;
    if (h === hour && weekday !== 0) return;
    runHours(sim, 1);
  }
  throw new Error('no such hour');
}

const eatTags = (_w: World, u: psyche.Thought['urge']) => {
  const idx = psyche.buildTagIndex(content);
  return psyche.urgeTags(idx, u);
};

describe('psyche: 30 days in Iron Ford', () => {
  it('every living actor has a chosen urge most hours', () => {
    const sim = simFor({ seed: 1 });
    const hours = 24 * 30;
    const chosen: Record<number, number> = {};
    for (let h = 0; h < hours; h++) {
      runHours(sim, 1);
      for (const id of living(sim.world)) if (psyche.chosenUrge(sim.world, id)) chosen[id] = (chosen[id] ?? 0) + 1;
    }
    for (const id of living(sim.world)) expect((chosen[id] ?? 0) / hours).toBeGreaterThan(0.6);
    // Arbitrations carry a 'self' Explain whose children are the scored candidates.
    const arb = sim.world.log.events.filter((e) => e.kind === 'psyche.arbitrated');
    expect(arb.length).toBeGreaterThan(0);
    for (const e of arb.slice(0, 200)) {
      expect(e.visibility).toBe('inner');
      expect(e.explain?.kind).toBe('arbitration');
      expect(e.explain?.knowledge).toBe('self');
      expect((e.explain?.children ?? []).length).toBeGreaterThan(0);
    }
  }, 240_000);
});

describe('psyche: defenses across seeds', () => {
  // One week per seed: defenses are aggregated by temperament.
  const DAYS = 7;
  const runs = Array.from({ length: 10 }, (_, i) => i + 1).map((seed) => {
    const sim = simFor({ seed, hours: 24 * DAYS });
    return { seed, world: sim.world };
  });

  it('at least one psyche.defense occurs across seeds 1..10, chronicle-worthy and omniscient', () => {
    const defs = runs.flatMap((r) => r.world.log.events.filter((e) => e.kind === 'psyche.defense'));
    expect(defs.length).toBeGreaterThan(0);
    for (const e of defs) {
      expect(e.importance ?? 0).toBeGreaterThanOrEqual(30);
      expect(e.visibility).toBe('inner');
      expect(e.explain?.knowledge).toBe('omniscient');
      if (e.kind === 'psyche.defense') expect(e.data.anxietyAfter).toBeLessThan(e.data.anxietyBefore);
    }
  });

  it("hot-tempered actors' defenses skew to displacement; the pious' to repression and reaction formation", () => {
    const tally = {
      hot: { all: 0, displacement: 0, conscience: 0 },
      pious: { all: 0, displacement: 0, conscience: 0 },
    };
    for (const r of runs) {
      for (const e of r.world.log.events) {
        if (e.kind !== 'psyche.defense') continue;
        const traits = r.world.actors[e.data.actorId]?.traits ?? [];
        const groups: Array<'hot' | 'pious'> = [];
        if (traits.includes('hot_tempered')) groups.push('hot');
        if (traits.includes('pious')) groups.push('pious');
        for (const g of groups) {
          tally[g].all++;
          if (e.data.defense === 'displacement') tally[g].displacement++;
          if (e.data.defense === 'repression' || e.data.defense === 'reaction_formation') tally[g].conscience++;
        }
      }
    }
    expect(tally.hot.all).toBeGreaterThan(20);
    expect(tally.pious.all).toBeGreaterThan(20);
    const share = (g: 'hot' | 'pious', k: 'displacement' | 'conscience') => tally[g][k] / tally[g].all;
    // Ratio bands (seeds 1..10): displacement ≥ 1.5× as common among the hot-tempered,
    // repression + reaction formation ≥ 1.15× as common among the pious.
    expect(share('hot', 'displacement')).toBeGreaterThan(1.5 * share('pious', 'displacement'));
    expect(share('pious', 'conscience')).toBeGreaterThan(1.15 * share('hot', 'conscience'));
  });

  it('projection forms beliefs through belief.formProjection and targets someone else', () => {
    const proj = runs.flatMap((r) =>
      r.world.log.events.filter((e) => e.kind === 'psyche.defense' && e.data.defense === 'projection'),
    );
    for (const e of proj) {
      if (e.kind !== 'psyche.defense') continue;
      expect(e.data.targetId).not.toBeNull();
      expect(e.data.targetId).not.toBe(e.data.actorId);
      expect(e.data.trait).toBeDefined();
    }
  });
});

describe('psyche: the player is the Ego (P2, 10 §5.5)', () => {
  it("a core.urge command wins arbitration and books the overridden voices' anxiety", () => {
    const sim = simFor({ seed: 3 });
    advanceTo(sim, 9);
    const id = actorByKey(sim, 'johann_brenner');
    const urge = { kind: 'activity' as const, activityId: 'drink_at_tavern' };
    const cmd: Command = { kind: 'core.urge', actorId: id, data: { urge } };
    step(sim, [cmd]);
    const c = psyche.chosenUrge(sim.world, id);
    expect(c?.voice).toBe('command');
    expect(c && sameUrge(c.urge, urge)).toBe(true);
    expect(c?.explain.outcome).toBe('command');
    expect(c?.explain.knowledge).toBe('self');
  });
});

describe('psyche: hunger against duty (10 §4.2, §5.2)', () => {
  /** Run one psyche hour for an actor with hunger set to 250, return chosen + the eating thought. */
  function hungry(sim: Sim, key: string, tweak?: (p: psyche.ActorPsyche) => void) {
    const id = actorByKey(sim, key);
    const needs = sim.world.needs.byActor[id];
    if (needs) needs.values.hunger = 250;
    // An actionable hunger episode, rather than a request for another snack just
    // after a meal or while its replacement is still being prepared.
    const nutrition = sim.world.provisions.nutrition[id];
    if (nutrition) nutrition.lastMealAt = null;
    sim.world.provisions.pendingMeals = (sim.world.provisions.pendingMeals ?? []).filter(
      (meal) => !meal.plates.some((plate) => plate.id === id),
    );
    const p = sim.world.psyche.byActor[id] as psyche.ActorPsyche;
    tweak?.(p);
    p.thoughts = [];
    // A late dinner leaves this arbitration outside the pre-meal snack window.
    const hungerContent = structuredClone(content);
    for (const plan of Object.values(hungerContent.mealPlans))
      for (const meal of plan.meals) if (meal.hour === 12) meal.hour = 13;
    psyche.psycheHour(sim.world, makeContext(sim.world, hungerContent, []), id);
    const eat = p.thoughts
      .filter((t) => t.voice === 'id' && (t.stance ?? 'for') === 'for' && eatTags(sim.world, t.urge).includes('eat'))
      .sort((a, b) => b.intensity - a.intensity)[0];
    return { p, eat };
  }

  it('hunger below 300 voices an Id thought to eat that beats a mild duty', () => {
    // Evening chores (keep house, duty 200) on a weekday.
    const sim = simFor({ seed: 5 });
    advanceTo(sim, 20);
    const { p, eat } = hungry(sim, 'johann_brenner');
    expect(eat).toBeDefined();
    expect(eat?.intensity ?? 0).toBeGreaterThan(300);
    expect(p.chosen).not.toBeNull();
    expect(eatTags(sim.world, p.chosen?.urge ?? { kind: 'activity' as const, activityId: '' })).toContain('eat');
  });

  it('…unless the superego is very strict', () => {
    // Forge hours (work, duty 550): a conscience at full strictness holds the hungry smith to it.
    let held = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const sim = simFor({ seed });
      advanceTo(sim, 9);
      const { p, eat } = hungry(sim, 'johann_brenner', (q) => {
        q.superego = 100;
        q.idAppetite = 30;
        q.norms.duty = 100;
      });
      expect(eat).toBeDefined();
      if (p.chosen && !eatTags(sim.world, p.chosen.urge).includes('eat')) held++;
    }
    expect(held).toBeGreaterThanOrEqual(4);
  });
});

describe('psyche: privacy and determinism', () => {
  it("thoughts never leak into another actor's view with a perspective set", () => {
    const sim = simFor({ seed: 2, hours: 24 * 2 });
    const viewer = actorByKey(sim, 'gussie_pratt');
    const vm = toViewModel(sim.world, content, { perspective: viewer, omniscient: false, includeExplain: true });
    for (const a of vm.actors) {
      if (a.id === viewer) {
        expect(a.psyche.visible).toBe(true);
        expect(a.psyche.recentDefenses).toEqual([]); // unconscious until Insight
        continue;
      }
      expect(a.psyche.visible).toBe(false);
      expect(a.psyche.thoughts).toEqual([]);
      expect(a.psyche.chosen).toBeNull();
      expect(a.psyche.anxiety).toBe(0);
      expect(a.psyche.recentDefenses).toEqual([]);
      expect(a.psyche.shadow).toEqual([]);
    }
  });

  it('the same seed gives the same minds', () => {
    const a = simFor({ seed: 9, hours: 24 * 3 });
    const b = simFor({ seed: 9, hours: 24 * 3 });
    expect(JSON.stringify(a.world.psyche)).toBe(JSON.stringify(b.world.psyche));
    const t = a.world.psyche.byActor[actorByKey(a, 'johann_brenner')];
    for (const th of t?.thoughts ?? []) expect(th.reasons.reduce((s, r) => s + r.value, 0)).toBe(th.intensity);
  });
});

describe('psyche: displaced anger pays its relief only when it lands (review)', () => {
  const sim = simFor({ seed: 2, hours: 24 * 14 });
  const content = sim.content;

  it('a displacement relieves a quarter at once; the rest waits for the act', () => {
    const full = content.defenses.displacement?.relief ?? 200;
    const evs = sim.world.log.events.filter((e) => e.kind === 'psyche.defense' && e.data.defense === 'displacement');
    expect(evs.length).toBeGreaterThan(0);
    for (const e of evs) {
      if (e.kind !== 'psyche.defense') continue;
      expect(e.data.relief).toBeLessThanOrEqual(Math.floor(full / 4));
    }
  });

  it('displaced acts land on someone and say so (viaDefense on the interaction)', () => {
    const acts = sim.world.log.events.filter(
      (e) => e.kind === 'social.interaction' && e.data.viaDefense === 'displacement',
    );
    expect(acts.length).toBeGreaterThan(0);
    for (const e of acts) {
      if (e.kind !== 'social.interaction') continue;
      const target = sim.world.actors[e.data.targetId];
      expect(target).toBeDefined();
      // Never the baby: hard words need someone old enough to take them.
      expect(yearsBetween(target?.born ?? sim.world.time, e.t)).toBeGreaterThanOrEqual(6);
    }
  });
});
