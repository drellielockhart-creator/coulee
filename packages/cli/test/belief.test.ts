import {
  asGameMinute,
  belief,
  createSim,
  findNonIntegers,
  makeContext,
  restoreSim,
  rng,
  rowsOf,
  runHours,
  stateHash,
  toGameMinute,
  toViewModel,
  yearsBetween,
} from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { updatePersecutions } from '../../core/src/belief/escalation.ts';
import { ensureBelief } from '../../core/src/belief/evidence.ts';
import { baseContent, simFor } from './helpers.ts';

const content = baseContent();
const context = (sim: ReturnType<typeof simFor>) => makeContext(sim.world, sim.content, []);

function isolated(seed = 42) {
  const sim = simFor({ seed });
  sim.world.belief = belief.createBeliefState();
  return sim;
}
function seedClaim(
  sim: ReturnType<typeof simFor>,
  holderId: Parameters<typeof ensureBelief>[2],
  propId: Parameters<typeof ensureBelief>[3],
  credence = 90,
) {
  const b = ensureBelief(sim.world, context(sim), holderId, propId);
  b.credence = credence;
  return b;
}

/**
 * The Catalyst meets the accused and their ego weighs the step belief proposes (an `accuse` to
 * the face; `shun_lobby` to a neighbor). Stands in for psyche + social: the urge is taken with
 * chance intensity/1000 (a seeded draw), as a strong-enough proposal usually wins the hour.
 */
function catalystActs(sim: ReturnType<typeof simFor>): void {
  for (const p of sim.world.belief.persecutions) {
    const cid = p.pending?.catalystId;
    if (cid === undefined || p.target.kind !== 'actor') continue;
    const cat = sim.world.actors[cid];
    const accused = sim.world.actors[p.target.id];
    if (!cat || !accused) continue;
    cat.placeId = accused.placeId;
    sim.world.activity.occupancy[accused.placeId] = rowsOf(sim.world.actors)
      .filter((a) => a.placeId === accused.placeId)
      .map((a) => a.id);
    const ctx = context(sim);
    const step = belief
      .proposeBeliefUrges(sim.world, ctx, cid)
      .find((u) => u.source === 'belief' && u.voice === 'superego');
    const ps = sim.world.psyche.byActor[cid];
    if (!step || !ps) continue;
    const roll = rng(sim.world.meta.seed, 'belief', sim.world.time, cid).int(1, 1000);
    if (roll > step.intensity) continue;
    ps.chosen = {
      urge: step.urge,
      voice: 'superego',
      compromise: false,
      at: sim.world.time,
      explain: {
        kind: 'arbitration',
        label: step.label,
        subjects: [cid],
        knowledge: 'self',
        terms: [],
        total: step.intensity,
        outcome: 'chosen',
      },
    };
  }
}

describe('belief integration', () => {
  it('seeds authored propositions, secrets, and concealed household self-knowledge', () => {
    const sim = simFor();
    const hidden = rowsOf(sim.world.actors).find((a) => content.peoples[a.ancestryId]?.concealed);
    expect(hidden).toBeDefined();
    if (!hidden) throw new Error('fixture needs a concealed actor');
    const own = belief.viewBeliefActor(sim.world, content, hidden.id, {
      perspective: hidden.id,
      omniscient: false,
      includeExplain: false,
      recentChronicle: 0,
    });
    expect(own.beliefs.some((b) => b.conceal && b.credence === 100)).toBe(true);
    const outsider = rowsOf(sim.world.actors).find((a) => a.householdId !== hidden.householdId);
    if (!outsider) throw new Error('fixture needs another household');
    const publicView = belief.viewBeliefActor(sim.world, content, hidden.id, {
      perspective: outsider.id,
      omniscient: false,
      includeExplain: false,
      recentChronicle: 0,
    });
    expect(publicView.beliefs.some((b) => b.conceal)).toBe(false);
    // Presented ancestry is observable only when the outsider is actually present.
    outsider.placeId = hidden.placeId;
    const view = toViewModel(sim.world, content, { perspective: outsider.id, omniscient: false });
    const actor = view.actors.find((a) => a.id === hidden.id);
    expect(actor?.people).toBe(content.peoples[hidden.presentsAsId]?.name);
    expect(belief.suspicionOf(sim.world, outsider.id, hidden.id)).toBe(0);
  });

  it('evidence can suspect an innocent actor without reading their ancestry', () => {
    const sim = isolated();
    const actors = rowsOf(sim.world.actors);
    const observer = actors[0];
    const target = actors.find((a) => a.id !== observer?.id && !content.peoples[a.ancestryId]?.concealed);
    if (!observer || !target) throw new Error('fixture');
    observer.values.superstition = 0;
    const kind = Object.values(content.predicates).find((p) => p.kind_of !== undefined);
    if (!kind) throw new Error('kind predicate');
    const prop = belief.internProp(sim.world, kind.id, [{ kind: 'actor', id: target.id }]);
    expect(belief.suspicionOf(sim.world, observer.id, target.id)).toBe(0);
    for (let i = 0; i < 12; i++)
      belief.observe(sim.world, context(sim), observer.id, prop, {
        type: 'observation',
        dir: 1,
        sourceId: null,
        eventId: null,
      });
    expect(belief.suspicionOf(sim.world, observer.id, target.id)).toBeGreaterThan(50);
    expect(findNonIntegers(sim.world)).toEqual([]);
  });

  it('retains Told lineage memories and discounts echoes, including across variants', () => {
    const sim = isolated();
    const [a, b, c, target] = rowsOf(sim.world.actors);
    if (!a || !b || !c || !target) throw new Error('fixture');
    const prop = belief.internProp(sim.world, 'drinks', [{ kind: 'actor', id: target.id }]);
    seedClaim(sim, a.id, prop);
    seedClaim(sim, c.id, prop);
    const req = {
      speakerId: a.id,
      listenerId: b.id,
      placeId: a.placeId,
      channel: 'newspaper' as const,
      interactionEventId: null,
      topic: prop,
    };
    const first = belief.transmit(sim.world, context(sim), req);
    expect(first.told).toBe(true);
    const row = belief.beliefOf(sim.world, b.id, prop);
    const weight = row?.evidence.at(-1)?.weight ?? 0;
    belief.transmit(sim.world, context(sim), req);
    expect(row?.evidence.at(-1)?.weight).toBeLessThan(weight);
    belief.transmit(sim.world, context(sim), { ...req, speakerId: c.id });
    expect(row?.evidence.at(-1)?.weight).toBeGreaterThan(weight / 2);
    if (first.rumorId === null) throw new Error('lineage');
    expect(belief.noveltyQ8(sim.world, b.id, first.rumorId)).toBeLessThan(256);
    const memory = rowsOf(sim.world.social.memories).find((m) => m.ownerId === b.id && m.source.kind === 'told');
    // Social may still be a stub during this parallel wave; when available it must carry lineage.
    if (memory?.source.kind === 'told') expect(memory.source.rumorId).toBe(first.rumorId);
  });

  it('a rumor reaches at least 30% of adults on most seeds 1..20 and records mutations', () => {
    let successes = 0;
    let mutations = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const sim = isolated(seed);
      const adults = rowsOf(sim.world.actors).filter((a) => yearsBetween(a.born, sim.world.time) >= 16);
      const origin = adults[0];
      const target = adults.at(-1);
      if (!origin || !target) throw new Error('adults');
      const prop = belief.internProp(sim.world, 'drinks', [{ kind: 'actor', id: target.id }]);
      seedClaim(sim, origin.id, prop, 95);
      for (let day = 0; day < 30; day++) {
        for (let hour = 0; hour < 3; hour++) {
          sim.world.time = asGameMinute(day * 1440 + hour * 60);
          const random = rng(seed, 'test', sim.world.time, 991);
          for (const speaker of adults) {
            const listener = random.pick(adults);
            if (listener && listener.id !== speaker.id)
              belief.transmit(sim.world, context(sim), {
                speakerId: speaker.id,
                listenerId: listener.id,
                placeId: speaker.placeId,
                channel: 'tavern',
                interactionEventId: null,
              });
          }
        }
      }
      const reached = adults.filter((a) => (sim.world.belief.beliefsByHolder[a.id]?.length ?? 0) > 0).length;
      if (reached / adults.length >= 0.3) successes++;
      mutations += rowsOf(sim.world.belief.rumors).reduce(
        (n, r) => n + r.variants.filter((v) => v.mutation !== null).length,
        0,
      );
      expect(findNonIntegers(sim.world)).toEqual([]);
    }
    expect(successes).toBeGreaterThan(10);
    expect(mutations).toBeGreaterThan(0);
  }, 30000);

  it('misfortune truth is never consulted by attribution, and projection creates evidence', () => {
    const a = isolated();
    const b = isolated();
    const actors = rowsOf(a.world.actors);
    const holder = actors[0];
    const target = actors.at(-1);
    if (!holder || !target) throw new Error('actors');
    for (const sim of [a, b]) {
      belief.formProjection(sim.world, context(sim), holder.id, target.id, 'envy');
      belief.reportMisfortune(sim.world, context(sim), {
        kindId: 'cows_dried',
        householdId: holder.householdId,
        culpritId: sim === a ? target.id : null,
      });
      sim.world.time = asGameMinute(60);
      belief.beliefSystem(sim.world, context(sim));
    }
    expect(rowsOf(a.world.belief.misfortunes)[0]?.attributions).toEqual(
      rowsOf(b.world.belief.misfortunes)[0]?.attributions,
    );
    expect(rowsOf(a.world.belief.beliefs).some((b) => b.evidence.some((e) => e.defense === 'projection'))).toBe(true);
    expect(rowsOf(a.world.belief.grudges).some((g) => g.target.kind === 'unknown')).toBe(true);
  });

  it('escalation has catalysts and dwell time, varies by seed, and steps down without fuel', () => {
    let accused = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const sim = isolated(seed);
      const actors = rowsOf(sim.world.actors).filter((a) => yearsBetween(a.born, sim.world.time) >= 16);
      const target = actors.at(-1);
      if (!target) throw new Error('target');
      const households = rowsOf(sim.world.households);
      const household = households[0];
      if (!household) throw new Error('household');
      const misfortuneId = belief.reportMisfortune(sim.world, context(sim), {
        kindId: 'cow_died',
        householdId: household.id,
      });
      if (misfortuneId === null) throw new Error('misfortune');
      const prop = belief.internProp(sim.world, 'caused', [
        { kind: 'actor', id: target.id },
        { kind: 'misfortune', id: misfortuneId },
      ]);
      for (const actor of actors.slice(0, 5)) {
        actor.values.temper = 0;
        actor.values.rancor = 1;
        seedClaim(sim, actor.id, prop, 90);
        belief.makeGrudge(sim.world, {
          holderId: actor.id,
          target: { kind: 'actor', id: target.id },
          founding: [{ kind: 'belief', id: prop, label: 'Blamed for the cow' }],
          intensity: 70,
          aim: 'expulsion',
          public: true,
          since: sim.world.time,
        });
      }
      updatePersecutions(sim.world, context(sim));
      expect(sim.world.belief.persecutions[0]?.rung).toBe(1);
      sim.world.time = asGameMinute(2 * 1440);
      updatePersecutions(sim.world, context(sim));
      expect(sim.world.belief.persecutions[0]?.rung).toBe(1);
      sim.world.time = asGameMinute(3 * 1440);
      updatePersecutions(sim.world, context(sim));
      catalystActs(sim);
      updatePersecutions(sim.world, context(sim));
      const p = sim.world.belief.persecutions[0];
      if (!p) throw new Error('persecution');
      if (p.rung >= 2) accused++;
      for (const g of rowsOf(sim.world.belief.grudges)) g.intensity = 0;
      for (const b of rowsOf(sim.world.belief.beliefs)) b.credence = 1;
      for (let day = 4; day <= 35; day++) {
        sim.world.time = asGameMinute(day * 1440);
        updatePersecutions(sim.world, context(sim));
      }
      expect(p.rung).toBe(0);
    }
    expect(accused).toBeGreaterThan(0);
    expect(accused).toBeLessThan(20);
  });

  it('natural lookalikes produce noticed tell evidence on an innocent actor', () => {
    const sim = isolated();
    const actors = rowsOf(sim.world.actors);
    const target = actors.find((a) => !content.peoples[a.ancestryId]?.concealed);
    const observer = actors.find((a) => a.id !== target?.id);
    if (!target || !observer) throw new Error('actors');
    observer.placeId = target.placeId;
    observer.values.superstition = 0;
    const authored = content.suspicionTells.animal_unease;
    if (!authored) throw new Error('tell');
    sim.content = {
      ...content,
      suspicionTells: {
        animal_unease: {
          ...authored,
          true_permille_per_hour: 1000,
          lookalike_permille_per_hour: 1000,
          strength: 100,
          place_tags_any: [],
          min_fae_intensity: 0,
          suppress: undefined,
          observe: { skill: 'perception', dc: 0, add_disguise: false },
        },
      },
    };
    sim.world.time = asGameMinute(60);
    belief.beliefSystem(sim.world, context(sim));
    expect(
      sim.world.log.events.some((e) => e.kind === 'belief.tell' && e.data.targetId === target.id && e.data.noticed),
    ).toBe(true);
    expect(belief.suspicionOf(sim.world, observer.id, target.id)).toBeGreaterThan(0);
  });

  it('attaches Figures by public identity beliefs while private secrets stay out of Commons', () => {
    const sim = simFor();
    const figure = rowsOf(sim.world.belief.figures)[0];
    const adults = rowsOf(sim.world.actors).filter((a) => yearsBetween(a.born, sim.world.time) >= 16);
    const target = adults[0];
    if (!figure || !target) throw new Error('figure fixture');
    const prop = belief.internProp(sim.world, 'is_figure', [
      { kind: 'actor', id: target.id },
      { kind: 'figure', id: figure.id },
    ]);
    for (const actor of adults) seedClaim(sim, actor.id, prop).conceal = true;
    belief.beliefSystem(sim.world, context(sim));
    expect(figure.attachedIds).not.toContain(target.id);
    expect(sim.world.belief.commons[prop]?.prevalence).toBe(0);
    for (const actor of adults) seedClaim(sim, actor.id, prop).conceal = false;
    sim.world.time = asGameMinute(1440);
    belief.beliefSystem(sim.world, context(sim));
    expect(figure.attachedIds).toContain(target.id);
    expect(sim.world.log.events.some((e) => e.kind === 'belief.figure_attached')).toBe(true);
  });

  it('continued fuel can reach shunning and exposes compliance through the API', () => {
    const sim = isolated();
    const adults = rowsOf(sim.world.actors).filter((a) => yearsBetween(a.born, sim.world.time) >= 16);
    const target = adults.at(-1);
    if (!target) throw new Error('target');
    const prop = belief.internProp(sim.world, 'witch', [{ kind: 'actor', id: target.id }]);
    for (const actor of adults.slice(0, -1)) {
      actor.values.temper = 3;
      actor.values.rancor = 3;
      actor.values.neighborliness = 0;
      seedClaim(sim, actor.id, prop, 95);
      belief.makeGrudge(sim.world, {
        holderId: actor.id,
        target: { kind: 'actor', id: target.id },
        founding: [{ kind: 'belief', id: prop, label: 'Accusation' }],
        intensity: 50,
        aim: 'expulsion',
        public: true,
        since: sim.world.time,
      });
    }
    for (let day = 0; day < 20; day++) {
      sim.world.time = asGameMinute(day * 1440);
      for (const g of rowsOf(sim.world.belief.grudges)) g.intensity = 50 + day;
      updatePersecutions(sim.world, context(sim));
      catalystActs(sim);
      updatePersecutions(sim.world, context(sim));
    }
    const p = sim.world.belief.persecutions[0];
    expect(p?.rung).toBe(3);
    expect(p?.actAttributed).toBe(false);
    expect(p?.shunnerIds.length).toBeGreaterThan(0);
    if (p?.shunnerIds[0] !== undefined) expect(belief.isShunning(sim.world, p.shunnerIds[0], target.id)).toBe(true);
    expect(findNonIntegers(sim.world)).toEqual([]);
  });

  it('is deterministic across JSON save/load and retains only integer state', () => {
    const a = createSim(content, { scenarioId: 'iron_ford', seed: 42 });
    const b = createSim(content, { scenarioId: 'iron_ford', seed: 42 });
    runHours(a, 48);
    runHours(b, 24);
    const resumed = restoreSim(content, JSON.parse(JSON.stringify(b.world)));
    runHours(resumed, 24);
    expect(stateHash(resumed.world)).toBe(stateHash(a.world));
    expect(findNonIntegers(a.world)).toEqual([]);
    expect(a.world.log.events.some((e) => e.kind.startsWith('belief.') && e.t > 0)).toBe(true);
  }, 30000);
});

describe('belief: misfortunes need what they strike; the hidden folk keep away from the bell (review)', () => {
  it('a fever only takes a house with a child in it, and household names read as English', () => {
    const sim = simFor({ seed: 42, hours: 24 * 60 });
    const mis = sim.world.log.events.filter((e) => e.kind === 'belief.misfortune');
    expect(mis.length).toBeGreaterThan(0);
    for (const e of mis) {
      if (e.kind !== 'belief.misfortune') continue;
      // No "(Kvale Ridge)" disambiguators, no "Captain Hurd' hens": a bare apostrophe only after an s.
      expect(e.data.text).not.toMatch(/\(|[a-rt-zA-Z]' /);
      if (e.data.kindId !== 'child_fever') continue;
      const m = sim.world.belief.misfortunes[e.data.misfortuneId as never] as { householdId: number } | undefined;
      const h = m ? sim.world.households[m.householdId as never] : undefined;
      const kids = (h?.memberIds ?? []).filter((id) => yearsBetween(sim.world.actors[id]?.born ?? e.t, e.t) < 14);
      expect(kids.length).toBeGreaterThan(0);
    }
  });

  it('a concealed actor who winces at the bell keeps away from the next ones (a belief urge)', () => {
    const sim = simFor({ seed: 1 });
    const hester = sim.world.index.actorByKey.hester_fenn;
    if (hester === undefined) throw new Error('hester');
    sim.world.belief.wary = { [hester]: { until: (sim.world.time + 30 * 1440) as never, tellId: 'bell_ache' } };
    sim.world.time = toGameMinute(1855, 4, 8, 9, 0); // a Sabbath morning
    const urges = belief.proposeBeliefUrges(sim.world, makeContext(sim.world, sim.content, []), hester);
    expect(urges.some((u) => u.label === 'Keep away from the bell')).toBe(true);
  });

  it('slow tells are content: an unaging face and an empty pew, noticed by those who know them', () => {
    const c = baseContent();
    expect(c.suspicionTells.unaging?.observers).toBe('acquainted');
    expect(c.suspicionTells.kept_from_meeting?.subject_not_place_tags).toContain('church');
    expect(c.suspicionTells.bell_ache?.wary_days ?? 0).toBeGreaterThan(0);
  });
});

describe('belief: rumors spread fast, then fade (playtest 2026-10-11: one rumor told 1,555 times a year)', () => {
  it('a juicy rumor is told mostly in its first fortnight and then drops out of talk', () => {
    const sim = isolated(11);
    const adults = rowsOf(sim.world.actors).filter((a) => yearsBetween(a.born, sim.world.time) >= 16);
    const origin = adults[0];
    const target = adults.at(-1);
    if (!origin || !target) throw new Error('adults');
    const prop = belief.internProp(sim.world, 'violent', [{ kind: 'actor', id: target.id }]);
    seedClaim(sim, origin.id, prop, 95);
    const byDay: number[] = [];
    for (let day = 0; day < 60; day++) {
      let told = 0;
      for (let hour = 0; hour < 3; hour++) {
        sim.world.time = asGameMinute(day * 1440 + hour * 60);
        const random = rng(11, 'test', sim.world.time, 993);
        for (const speaker of adults) {
          const listener = random.pick(adults);
          if (!listener || listener.id === speaker.id) continue;
          const out = belief.transmit(sim.world, context(sim), {
            speakerId: speaker.id,
            listenerId: listener.id,
            placeId: speaker.placeId,
            channel: 'tavern',
            interactionEventId: null,
          });
          if (out.told) told++;
        }
      }
      byDay.push(told);
    }
    const first = byDay.slice(0, 14).reduce((a, b) => a + b, 0);
    const late = byDay.slice(30).reduce((a, b) => a + b, 0);
    const reached = adults.filter((a) => (belief.beliefOf(sim.world, a.id, prop)?.credence ?? 0) > 0).length;
    expect(reached / adults.length).toBeGreaterThan(0.5);
    expect(first).toBeGreaterThan(late * 4);
    // Saturated: the town has it, and nobody is still repeating it to everyone.
    expect(byDay.slice(45).reduce((a, b) => a + b, 0)).toBeLessThan(adults.length);
    expect(findNonIntegers(sim.world)).toEqual([]);
  });

  it('a teller who has told it all round has nothing fresh to tell; a newcomer still gets the old news', () => {
    const sim = isolated(12);
    const adults = rowsOf(sim.world.actors).filter((a) => yearsBetween(a.born, sim.world.time) >= 16);
    const [teller, friend, stranger, subject] = adults;
    if (!teller || !friend || !stranger || !subject) throw new Error('adults');
    const prop = belief.internProp(sim.world, 'drinks', [{ kind: 'actor', id: subject.id }]);
    const b = seedClaim(sim, teller.id, prop, 90);
    expect(belief.hasRumorFor(sim.world, teller.id, friend.id, content)).toBe(true);
    // Forty days on, told to twenty people, heard five times over, and half the town holds it.
    const id = belief.planTransmit(sim.world, context(sim), {
      speakerId: teller.id,
      listenerId: friend.id,
      placeId: null,
      channel: 'street',
      interactionEventId: null,
      deliberate: true,
    });
    expect(id).not.toBeNull();
    b.toldTo = adults.slice(4, 24).map((a) => a.id);
    if (b.rumorId !== null) b.echoes[b.rumorId] = 5;
    sim.world.time = asGameMinute(sim.world.time + 40 * 1440);
    sim.world.belief.commons[prop] = { prevalence: 700, assumed: true, since: asGameMinute(0) };
    sim.world.social.opinions[teller.id] ??= {};
    const table = sim.world.social.opinions[teller.id] ?? {};
    const rec = table[friend.id];
    if (rec) rec.familiarity = 600;
    else {
      table[friend.id] = {
        targetId: friend.id,
        base: { affection: 0, respect: 0, trust: 0, fear: 0 },
        reasons: [],
        volatile: { affection: 0, respect: 0, trust: 0, fear: 0 },
        obligation: { favors: 0, cents: 0 },
        familiarity: 600,
        cooldowns: {},
        label: '',
      };
    }
    const fresh = belief.freshnessOf(sim.world, sim.world.time, b, friend.id);
    expect(fresh.pm).toBeLessThan(100);
    expect(belief.hasRumorFor(sim.world, teller.id, friend.id, content)).toBe(false);
    // The stranger has never met the teller: they cannot be assumed to have heard.
    expect(belief.freshnessOf(sim.world, sim.world.time, b, stranger.id).common).toBe(1000);
  });
});
