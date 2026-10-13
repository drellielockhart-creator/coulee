import { asGameMinute, createSim, items, makeContext, restoreSim, stateHash } from '@coulee/core';
import { describe, expect, it } from 'vitest';
import { internProp } from '../../core/src/belief/api.ts';
import { ensureBelief } from '../../core/src/belief/evidence.ts';
import { weekNumber } from '../../core/src/chronicle/bindings.ts';
import { charm } from '../../core/src/chronicle/patterns/charm.ts';
import type { ChronicleThread } from '../../core/src/chronicle/state.ts';
import { makeDetectCtx } from '../../core/src/chronicle/system.ts';
import { noteItemInteraction, restitutionOwed } from '../../core/src/fae/arc.ts';
import { ensureCharm, knownRecord } from '../../core/src/fae/charms.ts';
import { desireOf } from '../../core/src/fae/desire.ts';
import { checkShortfall } from '../../core/src/fae/discovery.ts';
import { dawnDraw } from '../../core/src/fae/draws.ts';
import { hemSet, openHemHour } from '../../core/src/fae/hem.ts';
import { tieCharm } from '../../core/src/fae/tend.ts';
import { proposeFaeUrges } from '../../core/src/fae/urges.ts';
import { charmDaily } from '../../core/src/fae/witness.ts';
import { planReadiness } from '../../core/src/provisions/planner.ts';
import { applyItemAct, itemPreflight, loanUrges } from '../../core/src/social/objects.ts';
import { baseContent } from './helpers.ts';

function setup() {
  const content = structuredClone(baseContent());
  const sim = createSim(content, { scenarioId: 'charm_at_iron_ford', seed: 42 });
  const w = sim.world;
  const c = required(Object.values(required(w.fae.charms))[0]);
  const a = required(w.index.actorByKey.edwin_fenn);
  const b = required(w.index.actorByKey.johanne_moe);
  const ctx = () => makeContext(w, content, []);
  items.moveStack(w, ctx(), c.itemId, 1, items.carriedBy(a));
  c.reservoir = null;
  c.custodianId = a;
  const draw = () => {
    w.time = asGameMinute(w.time + 1740);
    c.tie = { at: w.time - 540, by: a, units: 0 };
    return dawnDraw(w, ctx(), c);
  };
  const terms = {
    kind: 'loan' as const,
    dueAt: asGameMinute(1440),
    use: 'household' as const,
    depositCents: 100,
    rechargeDuty: true,
  };
  return { sim, content, w, c, a, b, ctx, draw, terms };
}
function thread(s: ReturnType<typeof setup>): ChronicleThread {
  return {
    id: 999,
    pattern: 'charm',
    key: 'test',
    openedAt: asGameMinute(0),
    lastAt: asGameMinute(0),
    actorIds: [s.a, s.b],
    householdIds: [],
    facts: [{ e: 9000, t: 0, a: s.a, b: 0, p: 6, pub: 1, by: [s.b], k: 'arr', w: 0, s: 1, x: 'charm_arrived' }],
    emitted: { pub: 1, pc: 1, all: 1 },
    data: { item: s.c.itemId },
    tags: { item: String(s.c.itemId) },
    closed: false,
    truthDone: false,
    entryIds: [],
  };
}

describe('FAE 1b review regressions', () => {
  it('1: refuses an unaffordable deposit in preflight and execution', () => {
    const { w, c, a, b, ctx, content, terms } = setup();
    w.provisions.purses[b] = 0;
    required(w.provisions.households[required(w.actors[b]).householdId]).cashCents = 0;
    const before = JSON.stringify(w.provisions.households);
    expect(itemPreflight(w, required(content.interactions.beg_loan), b, a, c.itemId, terms, 0)).not.toBeNull();
    applyItemAct(w, ctx(), required(content.interactions.beg_loan), b, a, c.itemId, terms, 1, [], null);
    expect(w.social.objectLoans ?? []).toHaveLength(0);
    expect(items.rootOf(w, required(w.items.stacks[c.itemId]))).toEqual(items.carriedBy(a));
    expect(JSON.stringify(w.provisions.households)).toBe(before);
  });
  it('2: unknown losses cannot affect restitution eligibility or execution', () => {
    const s = setup(),
      { w, c, a, b, ctx, content } = s;
    const out = s.draw();
    if (out.kind !== 'drew' || out.source.householdId === null) throw Error('draw');
    const target = required(w.households[out.source.householdId]).headId;
    const before = JSON.stringify(w.provisions.households);
    const refusal = itemPreflight(
      w,
      required(content.interactions.make_restitution),
      b,
      target,
      c.itemId,
      undefined,
      w.time,
    );
    expect(refusal).not.toBeNull();
    applyItemAct(
      w,
      ctx(),
      required(content.interactions.make_restitution),
      b,
      target,
      c.itemId,
      undefined,
      1,
      [],
      null,
    );
    expect(JSON.stringify(w.provisions.households)).toBe(before);
    expect(required(Object.values(required(w.fae.drawCases))[0]).restituted ?? 0).toBe(0);
    w.fae.drawCases = {};
    expect(
      itemPreflight(w, required(content.interactions.make_restitution), b, target, c.itemId, undefined, w.time),
    ).toBe(refusal);
    expect(a).not.toBe(b);
  });
  it('3: audience closure does not read private acceptance, virtue, or disposal', () => {
    const s = setup();
    s.draw();
    const th = thread(s),
      dc = makeDetectCtx(s.w, s.ctx()),
      p = dc.params('charm', 55);
    for (const view of ['pub', 'pc'] as const) {
      const before = charm.bind(th.facts, th, 1, dc, p, view).resolution;
      required(Object.values(required(s.w.fae.drawCases))[0]).accepted = true;
      s.c.virtue = 0;
      expect(charm.bind(th.facts, th, 1, dc, p, view).resolution).toBe(before);
    }
  });
  it('4: enclosing iron suppresses the shared live/planner hem pass', () => {
    const { w, ctx, content, a } = setup();
    const box = items.createStack(w, ctx(), 'iron_bound_casket', 1, items.carriedBy(a));
    const bag = items.createStack(w, ctx(), 'flour_sack_25lb', 1, { kind: 'container', itemId: box });
    const hem = items.createStack(w, ctx(), 'rain_hem', 1, { kind: 'container', itemId: bag });
    ensureCharm(w, content, hem);
    for (const world of [w, structuredClone(w)]) {
      const hems = hemSet(world, content);
      openHemHour(world, content, hems, () => true);
      expect(required(hems.byContainer[bag]).active).toBe(false);
      expect(required(hems.byContainer[bag]).spent).toBe(0);
    }
  });
  it('5: fifty sealed days preserve vigor', () => {
    const { w, ctx, c, a } = setup();
    const box = items.createStack(w, ctx(), 'iron_bound_casket', 1, items.carriedBy(a));
    items.moveStack(w, ctx(), c.itemId, 1, { kind: 'container', itemId: box });
    for (let i = 0; i < 50; i++) {
      w.time = asGameMinute(i * 1440);
      charmDaily(w, ctx());
    }
    expect(c.vigor).toBe(100);
    expect(c.inert).toBe(false);
  });
  it('6: protected origins reject minimum-FI-zero draws', () => {
    const s = setup();
    required(s.w.places[required(s.w.actors[s.a]).placeId]).tags.push('protected_site');
    expect(s.draw().kind).toBe('idle');
  });
  it('7: fae harm fizzles without forfeit, preserving virtue and material', () => {
    const s = setup();
    required(s.content.charms.never_empty_sack).harm_basis = 'fae';
    const virtue = s.c.virtue;
    const stacks = JSON.stringify(s.w.items.stacks);
    expect(s.draw().kind).toBe('idle');
    expect(s.c.virtue).toBe(virtue);
    expect(JSON.stringify(s.w.items.stacks)).toBe(stacks);
    expect(s.w.log.events.some((e) => e.explain?.outcome === 'fizzled')).toBe(true);
  });
  it('8: opening and refilling invalidates the tie across JSON save/load', () => {
    const s = setup(),
      { w, c, ctx, a } = s;
    const f = items.createStack(w, ctx(), 'flour', 2, { kind: 'container', itemId: c.itemId });
    w.time = asGameMinute(1200);
    c.tie = { at: 1200, by: a, units: 2 };
    items.moveStack(w, ctx(), f, 2, items.carriedBy(a));
    items.moveStack(w, ctx(), f, 2, { kind: 'container', itemId: c.itemId });
    const restored = restoreSim(s.content, JSON.parse(JSON.stringify(w)));
    restored.world.time = asGameMinute(1740);
    expect(
      dawnDraw(
        restored.world,
        makeContext(restored.world, s.content, []),
        required(required(restored.world.fae.charms)[c.itemId]),
      ).kind,
    ).toBe('idle');
  });
  it('9: household bins share a draw case and discovery consequence', () => {
    const s = setup(),
      { w, c, ctx, a } = s;
    const first = s.draw();
    if (first.kind !== 'drew' || first.source.householdId === null) throw Error('draw');
    const hid = first.source.householdId;
    const store = required(
      Object.values(w.provisions.stores).find(
        (x) => x.ownerHouseholdId === hid && required(w.places[x.placeId]).tags.includes('store'),
      ),
    );
    for (const st of Object.values(w.items.stacks)) if (st.defId === 'flour') items.deleteStack(w, st.id);
    const bag = items.createStack(w, ctx(), 'flour_sack_25lb', 1, { kind: 'place', placeId: store.placeId });
    items.createStack(w, ctx(), 'flour', 10, { kind: 'container', itemId: bag });
    w.time = asGameMinute(3180);
    c.tie = { at: 2640, by: a, units: 0 };
    expect(dawnDraw(w, ctx(), c).kind).toBe('drew');
    const counter = required(w.households[hid]).headId;
    required(w.actors[counter]).sheet.skills.perception = 100;
    checkShortfall(w, ctx(), hid, counter, 'count');
    expect(Object.values(required(w.fae.drawCases))).toHaveLength(1);
    expect(Object.values(w.belief.misfortunes)).toHaveLength(1);
  });
  it('10: a surviving lender household member receives return proposals', () => {
    const { w, c, a, b, ctx, content, terms } = setup();
    terms.depositCents = 0;
    applyItemAct(w, ctx(), required(content.interactions.share_out), a, b, c.itemId, terms, 1, [], null);
    w.time = asGameMinute(1800);
    const hh = required(w.households[required(w.actors[a]).householdId]);
    for (const id of hh.memberIds) required(w.actors[id]).placeId = hh.homePlaceId;
    required(w.actors[b]).placeId = hh.homePlaceId;
    required(w.actors[a]).alive = false;
    expect(
      loanUrges(w, ctx(), b).some(
        (x) => x.urge.kind === 'interaction' && x.urge.interactionId === 'return_item' && x.urge.targetId !== a,
      ),
    ).toBe(true);
  });
  it('11: hidden custody cannot change believed keeper, desire, or destinations', () => {
    const { w, c, a, b, ctx, content } = setup();
    const observer = required(w.index.actorByKey.gussie_pratt);
    w.time = asGameMinute(660);
    required(w.actors[observer]).sheet.skills.spellcraft = 4;
    for (const id of [a, b]) {
      required(w.actors[id]).placeId = required(w.households[required(w.actors[id]).householdId]).homePlaceId;
      required(w.activity.byActor[id]).activityId = 'idle';
    }
    for (const [pred, args] of [
      ['claim.never_empty_sack.feeds', [{ kind: 'item', id: c.itemId }]],
      [
        'has',
        [
          { kind: 'actor', id: a },
          { kind: 'item', id: c.itemId },
        ],
      ],
    ] as const) {
      const prop = internProp(w, pred, [...args]);
      ensureBelief(w, ctx(), observer, prop).credence = 80;
    }
    const before = { d: desireOf(w, content, observer, c), urges: proposeFaeUrges(w, ctx(), observer) };
    items.moveStack(w, ctx(), c.itemId, 1, items.carriedBy(b));
    c.custodianId = b;
    expect({ d: desireOf(w, content, observer, c), urges: proposeFaeUrges(w, ctx(), observer) }).toEqual(before);
  });
  it('12: throttled Truth remains pending and retries the same thread', () => {
    const s = setup(),
      { w, c, ctx } = s;
    c.drawLedger = { h1: 10 };
    w.time = asGameMinute(40 * 1440);
    const th = thread(s);
    w.chronicle.threads.push(th);
    w.chronicle.weekLoad = { week: weekNumber(w.time), entries: 18, epilogue: 18 };
    let dc = makeDetectCtx(w, ctx());
    required(charm.stale)(th, dc, dc.params('charm', 55));
    expect(th.truthDone).toBe(false);
    expect(w.chronicle.charmMemo?.[c.itemId]?.truthLb).toBeUndefined();
    w.time = asGameMinute(w.time + 7 * 1440);
    w.chronicle.weekLoad = { week: weekNumber(w.time), entries: 0, epilogue: 0 };
    dc = makeDetectCtx(w, ctx());
    required(charm.daily)(dc, dc.params('charm', 55));
    required(charm.stale)(th, dc, dc.params('charm', 55));
    expect(th.truthDone).toBe(true);
    expect(w.chronicle.charmMemo?.[c.itemId]?.truthLb).toBe(10);
    expect(w.chronicle.entries).toHaveLength(1);
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw new Error('Missing fixture value');
  return value;
}

describe('FAE fixes: permitted paths and boundary cases', () => {
  it('collects exactly the paid deposit and refunds it once', () => {
    const { w, c, a, b, ctx, content, terms } = setup();
    const cash = required(w.provisions.households[required(w.actors[b]).householdId]);
    cash.cashCents = 500;
    w.provisions.purses[b] = 0;
    const before = cash.cashCents;
    applyItemAct(w, ctx(), required(content.interactions.beg_loan), b, a, c.itemId, terms, 1, [], null);
    expect(cash.cashCents).toBe(before - 100);
    expect(required(w.social.objectLoans)[0]?.collectedDepositCents).toBe(100);
    applyItemAct(w, ctx(), required(content.interactions.return_item), b, a, c.itemId, undefined, 1, [], null);
    expect(cash.cashCents).toBe(before);
    applyItemAct(w, ctx(), required(content.interactions.return_item), b, a, c.itemId, undefined, 1, [], null);
    expect(cash.cashCents).toBe(before);
  });
  it('does not refund an unverified nominal deposit in an old saved loan', () => {
    const { w, c, a, b, ctx, content, terms } = setup();
    terms.depositCents = 0;
    applyItemAct(w, ctx(), required(content.interactions.beg_loan), b, a, c.itemId, terms, 1, [], null);
    const loan = required(required(w.social.objectLoans)[0]);
    loan.depositCents = 100;
    delete loan.collectedDepositCents;
    const before = JSON.stringify(w.provisions.households);
    applyItemAct(w, ctx(), required(content.interactions.return_item), b, a, c.itemId, undefined, 1, [], null);
    expect(JSON.stringify(w.provisions.households)).toBe(before);
  });
  it.each(['fae', 'instrument'] as const)(
    '%s harm honors counterparty-scoped, unexpired forfeits and the fae actor override',
    (basis) => {
      const s = setup();
      const def = required(s.content.charms.never_empty_sack);
      def.harm_basis = basis;
      s.w.fae.faeActors = { [s.a]: true };
      expect(s.draw().kind).toBe('idle');
      s.w.fae.forfeits = {};
      for (const a of Object.values(s.w.actors))
        s.w.fae.forfeits[a.id] = [{ kind: 'bargain', counterparty: def.court, until: 10000 }];
      expect(s.draw().kind).toBe('drew');
      for (const a of Object.values(s.w.actors))
        s.w.fae.forfeits[a.id] = [{ kind: 'bargain', counterparty: def.court, until: 0 }];
      expect(s.draw().kind).toBe('idle');
    },
  );
  it('protected source places cannot supply a draw', () => {
    const s = setup();
    const origin = required(s.w.actors[s.a]).placeId;
    for (const p of Object.values(s.w.places)) if (p.id !== origin) p.tags.push('protected_site');
    expect(s.draw().kind).toBe('idle');
  });
  it('audience disposal wording comes from the witnessed fact', () => {
    const s = setup(),
      th = thread(s),
      dc = makeDetectCtx(s.w, s.ctx());
    th.facts.push({ ...required(th.facts[0]), k: 'disp', x: 'buried' });
    expect(charm.bind(th.facts, th, 1, dc, dc.params('charm', 55), 'pub').resolution).toBe('buried with iron on it');
  });
  it('a household return completes after the original lender dies', () => {
    const { w, c, a, b, ctx, content, terms } = setup();
    terms.depositCents = 0;
    applyItemAct(w, ctx(), required(content.interactions.beg_loan), b, a, c.itemId, terms, 1, [], null);
    required(w.actors[a]).alive = false;
    const receiver = required(
      required(w.households[required(w.actors[a]).householdId]).memberIds.find((id) => id !== a && w.actors[id]?.alive),
    );
    applyItemAct(w, ctx(), required(content.interactions.return_item), b, receiver, c.itemId, undefined, 1, [], null);
    expect(required(w.social.objectLoans)[0]?.status).toBe('returned');
    expect(items.rootOf(w, required(w.items.stacks[c.itemId]))).toEqual(items.carriedBy(receiver));
  });
});

describe('FAE fixes: knowledge and projection isolation', () => {
  it('later private losses cannot change a known restitution amount', () => {
    const s = setup();
    const result = s.draw();
    if (result.kind !== 'drew' || result.source.householdId === null) throw Error('draw');
    const hid = result.source.householdId;
    const prop = internProp(s.w, 'draws_from', [
      { kind: 'item', id: s.c.itemId },
      { kind: 'household', id: hid },
    ]);
    ensureBelief(s.w, s.ctx(), s.a, prop).credence = 100;
    knownRecord(s.w, s.a, s.c.itemId).losses = { [hid]: 10 };
    const dc = required(Object.values(required(s.w.fae.drawCases))[0]);
    dc.undiscovered += 50;
    dc.discovered += 30;
    expect(restitutionOwed(s.w, s.c.itemId, hid, s.a)).toBe(10);
    noteItemInteraction(s.w, s.ctx(), 'tell', s.a, s.b, s.c.itemId);
    ensureBelief(s.w, s.ctx(), s.b, prop).credence = 100;
    expect(restitutionOwed(s.w, s.c.itemId, hid, s.b)).toBe(10);
    s.w.fae.drawCases = {};
    expect(restitutionOwed(s.w, s.c.itemId, hid, s.a)).toBe(10);
  });
  it('a readiness projection cannot open the live tied sack', () => {
    const { w, c, a, ctx, content } = setup();
    items.createStack(w, ctx(), 'flour', 10, { kind: 'container', itemId: c.itemId });
    w.time = asGameMinute(1200);
    expect(tieCharm(w, ctx(), a, c, { kind: 'own' }).ok).toBe(true);
    const before = stateHash(w);
    planReadiness(w, content, { actorId: a }, w.time, 2);
    expect(stateHash(w)).toBe(before);
    items.accessContents(w, required(items.stacksDeep(w, { kind: 'container', itemId: c.itemId })[0]).stack);
    w.time = asGameMinute(1740);
    expect(dawnDraw(w, ctx(), c)).toEqual({ kind: 'idle', reason: 'opened before cockcrow' });
  });
});

it('a fae activator cannot evade protection by leaving the tied sack loose', () => {
  const s = setup();
  s.w.fae.faeActors = { [s.a]: true };
  items.moveStack(s.w, s.ctx(), s.c.itemId, 1, { kind: 'place', placeId: required(s.w.actors[s.a]).placeId });
  expect(s.draw().kind).toBe('idle');
});
