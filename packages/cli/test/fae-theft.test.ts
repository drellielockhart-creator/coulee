import { asGameMinute, calendarAt, findNonIntegers, items, makeContext, psyche, social, step } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { beliefOf, internProp, observe } from '../../core/src/belief/api.ts';
import { charm as charmPattern } from '../../core/src/chronicle/patterns/charm.ts';
import { makeDetectCtx } from '../../core/src/chronicle/system.ts';
import { keeperOf, setConservationProbe } from '../../core/src/fae/charms.ts';
import { actorArg, itemArg } from '../../core/src/fae/desire.ts';
import { countStock } from '../../core/src/fae/discovery.ts';
import { checkCharmLoss } from '../../core/src/fae/theft.ts';
import { proposeFaeUrges } from '../../core/src/fae/urges.ts';
import { charmView } from '../../core/src/fae/view.ts';
import { perceivedEvents } from '../../play/src/interrupts.ts';
import { actorByKey, simFor } from './helpers.ts';

function required<T>(x: T | null | undefined): T {
  if (x === null || x === undefined) throw new Error('fixture');
  return x;
}
function fixture(seed = 3) {
  const sim = simFor({ scenarioId: 'charm_at_iron_ford', seed });
  while (calendarAt(sim.world.time).hour !== 10) step(sim);
  const w = sim.world;
  const keeper = required(w.actors[actorByKey(sim, 'edwin_fenn')]);
  const thief = required(w.actors[actorByKey(sim, 'johanne_moe')]);
  const decoy = required(w.actors[actorByKey(sim, 'gussie_pratt')]);
  const c = required(Object.values(w.fae.charms ?? {}).find((x) => x.defId === 'never_empty_sack'));
  const home = required(w.households[keeper.householdId]).homePlaceId;
  const away = required(w.index.placeByDef.dunleavys_tavern);
  for (const a of Object.values(w.actors)) a.placeId = away;
  thief.placeId = home;
  w.activity.occupancy = {
    [home]: [thief.id],
    [away]: Object.values(w.actors)
      .filter((a) => a.id !== thief.id)
      .map((a) => a.id),
  };
  Object.assign(required(w.activity.byActor[thief.id]), {
    activityId: 'idle_at_home',
    placeId: home,
    lockedUntil: null,
    travel: null,
  });
  required(w.activity.byActor[keeper.id]).activityId = 'idle_at_home';
  const ctx = () => makeContext(w, sim.content, []);
  items.moveStack(w, ctx(), c.itemId, 1, items.pantryOf(keeper.householdId));
  c.reservoir = null;
  c.boundTo = keeper.id;
  c.custodianId = keeper.id;
  c.attachment[keeper.id] = 100;
  c.desire[thief.id] = 80;
  c.refusals = { [thief.id]: { n: 4, last: w.time, grudges: 0 } };
  c.asked = { [thief.id]: w.time };
  required(w.psyche.byActor[thief.id]).norms.honesty = 10;
  thief.sheet.skills.stealth = 30;
  keeper.sheet.skills.perception = 30;
  observe(w, ctx(), thief.id, internProp(w, 'has', [actorArg(keeper.id), itemArg(c.itemId)]), {
    type: 'observation',
    dir: 1,
    sourceId: null,
    eventId: null,
  });
  required(beliefOf(w, thief.id, internProp(w, 'has', [actorArg(keeper.id), itemArg(c.itemId)]))).credence = 90;
  return { sim, w, c, keeper, thief, decoy, home, away, ctx };
}
const take = (f: ReturnType<typeof fixture>, commanded = false) =>
  social.attemptTheft(f.w, f.ctx(), {
    actorId: f.thief.id,
    victimId: f.keeper.id,
    itemId: f.c.itemId,
    ...(commanded ? { basis: { kind: 'command' as const, issuer: { kind: 'player' as const } } } : {}),
  });

describe('charm desperation theft', () => {
  it('voices an Id taking during the ask cooldown, scaled by conscience and local opportunity', () => {
    const f = fixture();
    const proposals = () => proposeFaeUrges(f.w, f.ctx(), f.thief.id);
    const desire = () => required(proposals().find((p) => p.label.startsWith('Take the sack'))).intensity;
    const quiet = desire();
    expect(proposals().some((p) => p.voice === 'superego' && p.norm === 'honesty')).toBe(true);
    f.keeper.placeId = f.home;
    expect(desire()).toBeLessThan(quiet);
    required(f.w.psyche.byActor[f.thief.id]).norms.honesty = 90;
    expect(desire()).toBeLessThan(quiet);
    f.thief.placeId = f.away;
    expect(proposals().some((p) => p.label.startsWith('Take the sack'))).toBe(false);
  });

  it('a commanded actor feels the wish but never takes on their own; an explicit Command can order it', () => {
    const f = fixture();
    psyche.setAgency(f.w, f.thief.id, {
      ...psyche.agencyOf(f.w, f.thief.id),
      mode: 'commanded',
      issuer: { kind: 'player' },
    });
    const location = required(f.w.items.stacks[f.c.itemId]).location;
    expect(take(f).success).toBe(false);
    expect(required(f.w.items.stacks[f.c.itemId]).location).toEqual(location);
    const command = {
      kind: 'core.urge' as const,
      actorId: f.thief.id,
      data: {
        urge: { kind: 'interaction' as const, interactionId: 'take', targetId: f.keeper.id, itemId: f.c.itemId },
      },
    };
    step(f.sim, [command]);
    expect(f.c.custodianId).toBe(f.thief.id);
    expect(f.w.log.events.some((e) => e.kind === 'social.theft' && e.data.success)).toBe(true);
  });

  it('an autonomous Id choice reaches the same theft executor without any Command', () => {
    const f = fixture();
    const p = required(f.w.psyche.byActor[f.thief.id]);
    p.ego = 10;
    p.idAppetite = 100;
    p.superego = 0;
    p.norms.honesty = 0;
    p.drives.greed = 100;
    p.thoughts = [];
    f.c.desire[f.thief.id] = 100;
    const values = required(f.w.needs.byActor[f.thief.id]).values;
    for (const id of Object.keys(values)) values[id] = 1000;
    step(f.sim);
    expect(p.chosen?.urge).toMatchObject({ kind: 'activity', activityId: 'steal_charm' });
    const theft = required(f.w.log.events.find((e) => e.kind === 'social.theft' && e.data.actorId === f.thief.id));
    expect(theft.kind).toBe('social.theft');
    expect(f.c.custodianId).toBe(f.thief.id);
    expect(f.w.log.events.some((e) => e.kind === 'core.command')).toBe(false);
  });

  it('moves the existing sack and contents, keeps its bond and rightful claims, and audits conservation', () => {
    const f = fixture();
    const ownership = internProp(f.w, 'owns', [actorArg(f.keeper.id), itemArg(f.c.itemId)]);
    observe(f.w, f.ctx(), f.keeper.id, ownership, { type: 'observation', dir: 1, sourceId: null, eventId: null });
    const beforeClaim = beliefOf(f.w, f.keeper.id, ownership)?.credence;
    f.c.guilt = { [f.keeper.id]: 300 };
    f.c.tie = { at: f.w.time, by: f.keeper.id, units: 0 };
    const before = Object.values(f.w.items.stacks).map((s) => [s.id, s.defId, s.qty]);
    const audits: boolean[] = [];
    setConservationProbe((r) => audits.push(r.ok));
    try {
      expect(take(f)).toMatchObject({ success: true, detected: false, movedId: f.c.itemId });
    } finally {
      setConservationProbe(null);
    }
    expect(audits).toEqual([true]);
    expect(Object.values(f.w.items.stacks).map((s) => [s.id, s.defId, s.qty])).toEqual(before);
    expect(keeperOf(f.w, f.c)).toBe(f.thief.id);
    expect(f.c.boundTo).toBe(f.keeper.id);
    expect(f.c.tie).toBeNull();
    expect(f.c.guilt[f.keeper.id]).toBe(300);
    expect(beliefOf(f.w, f.keeper.id, ownership)?.credence).toBe(beforeClaim);
    expect(
      beliefOf(f.w, f.thief.id, internProp(f.w, 'owns', [actorArg(f.thief.id), itemArg(f.c.itemId)])),
    ).toBeUndefined();
    expect(findNonIntegers(f.w)).toEqual([]);
  });

  it('finds the loss by a later count, survives save/load and log pruning, and may blame a refused innocent', () => {
    const f = fixture();
    f.c.refusals = { [f.decoy.id]: { n: 3, last: f.w.time, grudges: 1 } };
    const before = Object.keys(f.w.belief.misfortunes).length;
    const start = f.w.log.lastId;
    take(f);
    expect(Object.keys(f.w.belief.misfortunes)).toHaveLength(before);
    const stolen = required(f.w.log.events.find((e) => e.kind === 'fae.charm_stolen'));
    expect(perceivedEvents([stolen], f.keeper.id, f.away)).toEqual([]);
    expect(charmView(f.w, f.sim.content, f.keeper.id).some((card) => card.keeperId === f.thief.id)).toBe(false);
    const loaded = JSON.parse(JSON.stringify(f.w)) as typeof f.w;
    loaded.log.events = loaded.log.events.filter((e) => e.id <= start);
    loaded.time = asGameMinute(loaded.time + 1440);
    required(loaded.actors[f.keeper.id]).placeId = f.home;
    const ctx = makeContext(loaded, f.sim.content, []);
    expect(countStock(loaded, ctx, f.keeper.id)).toBeGreaterThan(0);
    const loss = required(loaded.fae.charms?.[f.c.itemId]?.thefts?.[0]);
    const m = required(loaded.belief.misfortunes[loss.misfortuneId as never]);
    expect(m.culpritId).toBe(f.thief.id); // omniscient truth, unused by attribution
    const charge = (id: typeof f.thief.id) =>
      beliefOf(loaded, f.keeper.id, internProp(loaded, 'took_goods', [actorArg(id), actorArg(f.keeper.id)]));
    expect(required(charge(f.decoy.id)).credence).toBeGreaterThan(0);
    expect(charge(f.thief.id)).toBeUndefined();
    const count = Object.keys(loaded.belief.misfortunes).length;
    expect(checkCharmLoss(loaded, ctx, f.keeper.id)).toBe(0);
    expect(Object.keys(loaded.belief.misfortunes)).toHaveLength(count);
  });

  it('witnesses can identify the thief, while a failed taking moves nothing and creates no loss case', () => {
    const f = fixture();
    f.keeper.placeId = f.home;
    f.thief.sheet.skills.stealth = 2;
    f.sim.content = {
      ...f.sim.content,
      reliefRules: Object.fromEntries(
        Object.entries(f.sim.content.reliefRules ?? {}).map(([id, rule]) => [
          id,
          { ...rule, theft_dc: 1, detection_dc: 30 },
        ]),
      ),
    };
    const r = take(f);
    expect(r).toMatchObject({ success: true, detected: true });
    expect(f.c.thefts).toHaveLength(1);
    expect(
      required(beliefOf(f.w, f.keeper.id, internProp(f.w, 'took_goods', [actorArg(f.thief.id), actorArg(f.keeper.id)])))
        .credence,
    ).toBeGreaterThan(0);
    const failed = fixture();
    failed.thief.sheet.skills.stealth = -30;
    expect(take(failed).success).toBe(false);
    expect(failed.c.thefts).toBeUndefined();
    expect(keeperOf(failed.w, failed.c)).toBe(failed.keeper.id);
  });

  it('the paper reports a theft and only the epilogue names the taker, with a stolen resolution', () => {
    const f = fixture();
    take(f);
    f.keeper.placeId = f.home;
    countStock(f.w, f.ctx(), f.keeper.id);
    for (let h = 0; h < 25; h++) step(f.sim);
    const entries = f.w.chronicle.entries;
    const truth = required(entries.find((e) => e.text.includes('keeper by possession')));
    expect(truth.voice).toBe('epilogue');
    expect(truth.text).toContain('Johanne Moe took');
    const paper = required(entries.find((e) => e.text.includes('A theft is reported')));
    expect(paper.voice).toBe('paper');
    expect(paper.text).not.toContain('Johanne');
    const thread = required(f.w.chronicle.threads.find((th) => th.pattern === 'charm' && th.data.item === f.c.itemId));
    const dc = makeDetectCtx(f.w, f.ctx());
    expect(charmPattern.bind(thread.facts, thread, 1, dc, dc.params('charm', 55), 'all').resolution).toBe(
      'taken from its keeper without leave',
    );
  });
});
