/**
 * Refusal costs (wave 6; design-docs/00 decisions 2026-10-12): a keeper at the attachment cap may
 * turn a neighbor away, but refusal has costs on both sides, so it becomes a story, not a stall.
 */
import { type ActorId, calendarAt, type ItemId, items, makeContext, type Sim, social, step } from '@coulee/core';
import { PlaySession } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { charm as charmPattern } from '../../core/src/chronicle/patterns/charm.ts';
import type { ChronicleThread } from '../../core/src/chronicle/state.ts';
import { makeDetectCtx } from '../../core/src/chronicle/system.ts';
import { charmTransferred } from '../../core/src/fae/arc.ts';
import { charmCovetPressure, charmGuilt, charmRefused } from '../../core/src/fae/refusal.ts';
import { holderDecision } from '../../core/src/social/objects.ts';
import { simFor } from './helpers.ts';

function required<T>(x: T | undefined | null, what = 'fixture'): T {
  if (x === undefined || x === null) throw new Error(what);
  return x;
}
const simOf = (s: PlaySession) => (s as unknown as { sim: Sim }).sim;
const actor = (sim: Sim, key: string): ActorId => required(sim.world.index.actorByKey[key], key);

/** The fixture with the sack in the Fenns' stores, kept by Edwin (attachment 100). */
function kept(seed = 3, honesty = 70) {
  const sim = simFor({ scenarioId: 'charm_at_iron_ford', seed });
  while (calendarAt(sim.world.time).hour !== 10) step(sim);
  const c = required(Object.values(sim.world.fae.charms ?? {}).find((x) => x.defId === 'never_empty_sack'));
  const edwin = actor(sim, 'edwin_fenn');
  const a = required(sim.world.actors[edwin]);
  items.moveStack(sim.world, makeContext(sim.world, sim.content, []), c.itemId, 1, items.pantryOf(a.householdId));
  c.reservoir = null;
  c.boundTo = edwin;
  c.custodianId = edwin;
  c.attachment[edwin] = 100;
  required(sim.world.psyche.byActor[edwin]).norms.honesty = honesty;
  return { sim, c, edwin, item: c.itemId as ItemId };
}

describe('fae refusal costs (wave 6)', () => {
  it('an honest keeper feels each refusal far more than a dishonest one, and it weighs on the next ask', () => {
    const honest = kept(3, 80);
    const sly = kept(3, 10);
    const jo = actor(honest.sim, 'johanne_moe');
    const beg = required(honest.sim.content.interactions.beg_loan);
    const guiltTerm = (k: typeof honest) => {
      const d = holderDecision(k.sim.world, makeContext(k.sim.world, k.sim.content, []), beg, k.edwin, jo, k.item);
      return required(d.explain.terms.find((t) => t.label === 'Guilt over turning neighbors away')).value;
    };
    expect(guiltTerm(honest)).toBe(0);
    for (const k of [honest, sly])
      charmRefused(k.sim.world, makeContext(k.sim.world, k.sim.content, []), k.edwin, jo, k.item, 'decided');
    expect(charmGuilt(honest.sim.world, honest.edwin, honest.item)).toBeGreaterThan(
      3 * charmGuilt(sly.sim.world, sly.edwin, sly.item),
    );
    // Toward someone already turned away it weighs in full.
    expect(guiltTerm(honest)).toBe(charmGuilt(honest.sim.world, honest.edwin, honest.item));
    const ev = required(honest.sim.world.log.events.find((e) => e.kind === 'fae.turned_away'));
    expect(ev.visibility).toBe('inner');
    expect(ev.explain?.knowledge).toBe('self');
    const thoughts = required(honest.sim.world.psyche.byActor[honest.edwin]).thoughts;
    expect(thoughts.some((t) => t.voice === 'superego' && t.label.startsWith('I turned Johanne away'))).toBe(true);
  });

  it('the refused think less of the keeper, want it more, say so, and found grudges as it repeats', () => {
    const { sim, c, edwin, item } = kept(4, 40);
    const jo = actor(sim, 'johanne_moe');
    const wantBefore = c.desire[jo] ?? 0;
    const trustBefore = social.opinionOf(sim.world, jo, edwin).trust;
    const ctx = () => makeContext(sim.world, sim.content, []);
    charmRefused(sim.world, ctx(), edwin, jo, item, 'decided');
    expect(c.desire[jo] ?? 0).toBeGreaterThan(wantBefore);
    expect(social.opinionOf(sim.world, jo, edwin).trust).toBeLessThan(trustBefore);
    const hoards = Object.values(sim.world.belief.beliefs).find(
      (b) => b.holderId === jo && sim.world.belief.props[b.propId]?.pred === 'hoards',
    );
    expect(required(hoards).credence).toBeGreaterThan(0);
    const grudges = () =>
      Object.values(sim.world.belief.grudges).filter(
        (g) => g.holderId === jo && g.target.kind === 'actor' && g.target.id === edwin,
      );
    charmRefused(sim.world, ctx(), edwin, jo, item, 'decided');
    expect(grudges()).toHaveLength(0);
    charmRefused(sim.world, ctx(), edwin, jo, item, 'decided');
    expect(grudges().map((g) => g.aim)).toEqual(['apology']);
    charmRefused(sim.world, ctx(), edwin, jo, item, 'decided');
    charmRefused(sim.world, ctx(), edwin, jo, item, 'decided');
    expect(grudges().map((g) => g.aim)).toEqual(['apology', 'humiliation']);
    // The theft hook: pressure rises with each refusal; nothing for the keeping house.
    expect(charmCovetPressure(sim.world, jo, item)).toBeGreaterThanOrEqual(500);
    expect(charmCovetPressure(sim.world, edwin, item)).toBe(0);
  });

  it('lending to the turned-away eases the conscience, and guilt fades slowly by itself', () => {
    const { sim, c, edwin, item } = kept(5, 80);
    const jo = actor(sim, 'johanne_moe');
    charmRefused(sim.world, makeContext(sim.world, sim.content, []), edwin, jo, item, 'decided');
    const g0 = charmGuilt(sim.world, edwin, item);
    expect(g0).toBeGreaterThan(0);
    for (let h = 0; h < 48; h++) step(sim);
    const g2 = charmGuilt(sim.world, edwin, item);
    expect(g2).toBeLessThan(g0);
    expect(g2).toBeGreaterThan(Math.floor(g0 / 2));
    // Every hand-over (a loan, a gift) runs through charmTransferred.
    items.moveStack(sim.world, makeContext(sim.world, sim.content, []), item, 1, items.carriedBy(jo));
    charmTransferred(sim.world, makeContext(sim.world, sim.content, []), item, jo);
    expect(charmGuilt(sim.world, edwin, item)).toBeLessThanOrEqual(Math.floor(g2 / 2) + 1);
    expect(c.refusals?.[jo]?.n).toBe(0);
  });

  it('a commanded keeper refuses only by Command (or silence), and still bears the guilt', () => {
    const s = PlaySession.create(simFor().content, { source: 'charm_at_iron_ford', seed: 42 });
    const w = simOf(s).world;
    const pc = s.playerId;
    const c = required(Object.values(w.fae.charms ?? {}).find((x) => x.defId === 'never_empty_sack'));
    items.moveStack(w, makeContext(w, simOf(s).content, []), c.itemId, 1, items.carriedBy(pc));
    c.reservoir = null;
    c.boundTo = pc;
    c.custodianId = pc;
    c.attachment[pc] = 100;
    const pcPlace = required(w.actors[pc]).placeId;
    const asker = required(
      Object.values(w.actors).find(
        (a) => a.alive && a.id !== pc && a.placeId === pcPlace && a.householdId !== required(w.actors[pc]).householdId,
      ),
      'someone here',
    );
    const ctx = makeContext(w, simOf(s).content, []);
    social.resolveInteraction(w, ctx, {
      def: required(simOf(s).content.interactions.beg_loan),
      initiatorId: asker.id,
      targetId: pc,
      placeId: pcPlace,
      present: [],
      mode: 'urge',
      via: 'urge',
      itemId: c.itemId,
      terms: {
        kind: 'loan',
        dueAt: (w.time + 3 * 1440) as never,
        use: 'household',
        depositCents: 0,
        rechargeDuty: true,
      },
    });
    const req = required(
      (w.social.pendingRequests ?? []).find((r) => r.to === pc && r.response === 'lend_item'),
      'a pending request',
    );
    expect(charmGuilt(w, pc, c.itemId)).toBe(0);
    const no = s.act(`answer:${req.id}:no`);
    expect(no.ok).toBe(true);
    expect(charmGuilt(w, pc, c.itemId)).toBeGreaterThan(0);
    expect((w.social.objectLoans ?? []).length).toBe(0);
    // The guilt is a conscience held for orders: the sack stays put until a Command lends it.
    const thoughts = required(w.psyche.byActor[pc]).thoughts;
    expect(thoughts.some((t) => t.voice === 'superego' && t.label.startsWith('I turned'))).toBe(true);
    for (let i = 0; i < 6; i++) s.act({ kind: 'activity.wait', actorId: pc, data: { minutes: 60 } });
    expect((w.social.objectLoans ?? []).length).toBe(0);
  });

  it('the epilogue tells it: a third refusal, and the day the keeper lent at last (each once)', () => {
    const { sim, c, edwin } = kept(6, 80);
    const jo = actor(sim, 'johanne_moe');
    const fact = (k: string, a: number, b: number, w: number, t: number) => ({
      e: 1,
      t,
      a,
      b,
      pub: 0 as const,
      by: [],
      k,
      w,
    });
    const th: ChronicleThread = {
      id: 9300 as never,
      pattern: 'charm',
      key: 'test',
      openedAt: 0 as never,
      lastAt: 0 as never,
      actorIds: [],
      householdIds: [],
      facts: [fact('refuse', edwin, jo, 3, 10), fact('loan', edwin, actor(sim, 'kristoffer_moe'), 0, 20)] as never,
      emitted: { pub: 0, pc: 0, all: 0 },
      data: { item: c.itemId },
      tags: {},
      closed: false,
      truthDone: false,
      entryIds: [],
    };
    sim.world.chronicle.threads.push(th);
    const lines = () => sim.world.chronicle.entries.filter((e) => e.threadId === th.id).map((e) => e.text);
    for (let i = 0; i < 2; i++) {
      const dc = makeDetectCtx(sim.world, makeContext(sim.world, sim.content, []));
      charmPattern.daily?.(dc, dc.params('charm', 55));
    }
    const told = lines();
    expect(told.filter((t) => t.includes('turned Johanne Moe away a third time'))).toHaveLength(1);
    // Lent to the same household that was turned away: the conscience eases, told once.
    expect(told.filter((t) => t.includes('whom Edwin had turned away'))).toHaveLength(1);
  });
});
