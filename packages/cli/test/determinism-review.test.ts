import {
  canonicalStringify,
  createSim,
  type Event,
  findNonIntegers,
  restoreSim,
  runHours,
  stateHash,
  type World,
} from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { beliefOf, internProp } from '../../core/src/belief/api.ts';
import { ensureBelief } from '../../core/src/belief/evidence.ts';
import { mindFor } from '../../core/src/psyche/mind.ts';
import { ruleCandidates } from '../../core/src/psyche/thoughts.ts';
import { makeContext } from '../../core/src/sim/sim.ts';
import { memoryDigest, memoryDigests } from '../../core/src/social/memory.ts';
import { scaleDimsPct } from '../../core/src/social/model.ts';
import { dailyOpinionUpkeep, ensureOpinion } from '../../core/src/social/opinion.ts';
import { baseContent } from './helpers.ts';

const content = baseContent();
const make = () => createSim(content, { scenarioId: 'iron_ford', seed: 42 });

describe('review regressions', () => {
  it('canonical and reversed bundle keys allocate identical IDs and replay commands identically', () => {
    const canonical = JSON.parse(canonicalStringify(content));
    const reversed = { ...content, places: Object.fromEntries(Object.entries(content.places).reverse()) };
    const sims = [content, canonical, reversed].map((b) => createSim(b, { scenarioId: 'iron_ford', seed: 42 }));
    const first = sims[0];
    if (!first) throw new Error('missing sim');
    for (const sim of sims) {
      expect(sim.world.places).toEqual(first.world.places);
      runHours(sim, 24, {
        commandsAt: (t) =>
          t === 0
            ? [
                {
                  kind: 'core.urge',
                  actorId: 1 as never,
                  data: { urge: { kind: 'activity', activityId: 'loaf', placeId: 1 as never } },
                },
              ]
            : [],
      });
    }
    expect(new Set(sims.map((s) => stateHash(s.world))).size).toBe(1);
  });

  it('every hourly save boundary, including hour 11, agrees with uninterrupted simulation', () => {
    const sim = make();
    for (let hour = 0; hour < 25; hour++) {
      const resumed = restoreSim(content, JSON.parse(JSON.stringify(sim.world)) as World);
      runHours(sim, 1);
      runHours(resumed, 1);
      expect(stateHash(resumed.world), `split at hour ${hour}`).toBe(stateHash(sim.world));
    }
  });

  it('thought decay and subsequent days never rewrite streamed or retained event bytes', () => {
    const sim = make();
    const originals = new Map<number, string>();
    const references: Event[] = [];
    sim.sink = (e) => {
      originals.set(e.id, JSON.stringify(e));
      references.push(e);
    };
    runHours(sim, 5 * 24);
    expect(sim.world.log.dropped).toBeGreaterThan(0);
    expect(references.some((e) => e.kind === 'psyche.thought')).toBe(true);
    for (const e of references) expect(JSON.stringify(e), `event ${e.id}`).toBe(originals.get(e.id));
    for (const e of sim.world.log.events) if (originals.has(e.id)) expect(JSON.stringify(e)).toBe(originals.get(e.id));
  });

  it('batch digests match pair scans and gathering caches do not survive opinion changes', () => {
    const sim = make();
    runHours(sim, 36);
    for (const owner of Object.values(sim.world.actors)) {
      const digests = memoryDigests(sim.world, content, owner.id);
      for (const other of Object.values(sim.world.actors)) {
        expect(digests.get(other.id) ?? { done: {}, did: {}, negative: 0 }).toEqual(
          memoryDigest(sim.world, content, owner.id, other.id),
        );
      }
    }
    const actor = Object.values(sim.world.actors)[0];
    if (!actor) throw new Error('missing actor');
    const m = mindFor(sim.world, makeContext(sim.world, content, []), actor.id);
    if (!m) throw new Error('missing mind');
    ruleCandidates(m, []);
    for (const other of m.known) {
      const op = ensureOpinion(sim.world, content, actor.id, other);
      op.base.affection = -100;
    }
    const fresh = mindFor(sim.world, makeContext(sim.world, content, []), actor.id);
    if (!fresh) throw new Error('missing mind');
    expect(ruleCandidates(m, [])).toEqual(ruleCandidates(fresh, []));
  });

  it('belief index follows appends, world switches and old JSON saves without changing state', () => {
    const sim = make();
    const holder = Object.values(sim.world.actors)[0]?.id;
    if (!holder) throw new Error('missing holder');
    const check = (world: World) => {
      const before = stateHash(world);
      for (const b of Object.values(world.belief.beliefs)) expect(beliefOf(world, b.holderId, b.propId)).toBe(b);
      expect(stateHash(world)).toBe(before);
    };
    check(sim.world);
    const prop = internProp(sim.world, 'faekin', [{ kind: 'actor', id: holder }]);
    const b = ensureBelief(sim.world, { content, now: sim.world.time }, holder, prop);
    expect(beliefOf(sim.world, holder, prop)).toBe(b);
    const restored = restoreSim(content, JSON.parse(JSON.stringify(sim.world)) as World);
    check(restored.world);
    check(sim.world);
  });

  it('negative-one volatile decay and mixed kin shares never store negative zero', () => {
    const sim = make();
    const [a, b] = Object.values(sim.world.actors);
    if (!a || !b) throw new Error('missing actors');
    const op = ensureOpinion(sim.world, content, a.id, b.id);
    op.volatile = { affection: -1, trust: -1, respect: 1, fear: 1 };
    dailyOpinionUpkeep(sim.world, content);
    expect(findNonIntegers(op.volatile)).toEqual([]);
    expect(op.volatile.affection).toBe(0);
    const share = scaleDimsPct({ affection: -1, trust: -7, respect: 13, fear: 4 }, 25);
    expect(share).toEqual({ affection: 0, trust: -1, respect: 3, fear: 1 });
    expect(findNonIntegers(share)).toEqual([]);
  });
});
