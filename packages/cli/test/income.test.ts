import {
  activity,
  asGameMinute,
  type Command,
  findNonIntegers,
  items,
  makeContext,
  provisions,
  psyche,
  social,
  step,
} from '@coulee/core';
import { availableActions, knownExplain, PlaySession, parseText } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { employmentHour } from '../../core/src/provisions/employment.ts';
import { sessionSim } from '../../play/src/source.ts';
import { actorByKey, baseContent } from './helpers.ts';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing fixture value');
  return value;
}
function fixture() {
  const sim = sessionSim(baseContent(), { source: 'iron_ford', seed: 42, pc: { kit: 'greenhorn' } });
  const w = sim.world;
  const worker = actorByKey(sim, 'play_newcomer');
  const employer = actorByKey(sim, 'gussie_pratt');
  const place = activity.currentActivity(w, employer)?.workplaceId;
  if (!place) throw new Error('No employer workplace');
  w.time = asGameMinute(1440 + 7 * 60);
  for (const id of [worker, employer]) {
    required(w.actors[id]).placeId = place;
    Object.assign(required(w.activity.byActor[id]), {
      placeId: place,
      activityId: 'idle_at_home',
      lockedUntil: null,
      travel: null,
    });
  }
  w.activity.occupancy[place] = [worker, employer].sort((a, b) => a - b);
  const ctx = (commands: Command[] = []) => makeContext(w, sim.content, commands);
  const hire = (term: 'daily' | 'weekly' = 'daily') =>
    provisions.hireOn(
      w,
      ctx([{ kind: 'provisions.hire_on', actorId: worker, data: { employerId: employer, term } }]),
      worker,
      employer,
      term,
    );
  const work = (hour: number) => {
    w.time = asGameMinute(1440 + hour * 60);
    required(w.activity.byActor[worker]).activityId = 'work';
    employmentHour(w, ctx());
  };
  return { sim, w, worker, employer, place, ctx, hire, work };
}

describe('ordinary newcomer income', () => {
  it('pays actual work from the employer purse, caps the day, and expires without wage fallback', () => {
    const { w, worker, employer, ctx, hire, work } = fixture();
    const initial = provisions.countyCash(w);
    const starting = required(w.provisions.purses[worker]);
    const employerStarting = provisions.cashOf(w, employer);
    expect(hire()).toBe(true);
    for (let hour = 8; hour < 18; hour++) work(hour);
    expect(w.provisions.purses[worker]).toBe(starting + 60);
    expect(activity.scheduledBlock(w, { content: baseContent() }, worker, ctx().cal)?.activity).toBe('idle_at_home');
    expect(provisions.cashOf(w, employer)).toBe(employerStarting - 60);
    expect(provisions.countyCash(w)).toBe(initial);
    w.time = asGameMinute(2 * 1440);
    employmentHour(w, ctx());
    expect(w.provisions.contracts?.[worker]?.ended).toBe('term_end');
    expect(provisions.activeEmployment(w, worker)).toBeNull();
    expect(findNonIntegers(w)).toEqual([]);
  });

  it('quits and dismisses with earned claims intact through insolvency', () => {
    for (const ending of ['quit', 'dismiss'] as const) {
      const { w, worker, employer, ctx, hire, work } = fixture();
      expect(hire('weekly')).toBe(true);
      work(8);
      const owed = required(w.provisions.employment?.[worker]).earnedCents;
      expect(owed).toBeGreaterThan(0);
      const hh = required(w.provisions.households[required(w.actors[employer]).householdId]);
      w.provisions.purses[employer] = 0;
      hh.cashCents = 0;
      const initial = provisions.countyCash(w);
      const ended =
        ending === 'quit'
          ? provisions.quitWork(w, ctx([{ kind: 'provisions.quit', actorId: worker, data: {} }]), worker)
          : provisions.dismissWorker(
              w,
              ctx([{ kind: 'provisions.dismiss', actorId: employer, data: { workerId: worker } }]),
              employer,
              worker,
            );
      expect(ended).toBe(true);
      expect(required(w.provisions.employment?.[worker]).earnedCents).toBe(owed);
      expect(hire()).toBe(false);
      expect(provisions.countyCash(w)).toBe(initial);
      // Move real money back to the debtor, then collect the preserved weekly claim on Saturday.
      w.provisions.purses[worker] = required(w.provisions.purses[worker]) - owed;
      w.provisions.purses[employer] = owed;
      w.time = asGameMinute(6 * 1440);
      employmentHour(w, ctx());
      expect(required(w.provisions.employment?.[worker]).earnedCents).toBe(0);
      expect(provisions.countyCash(w)).toBe(initial);
    }
  });

  it('can hire on elsewhere while the old employer still owes wages', () => {
    const { sim, w, worker, employer, ctx, hire, work } = fixture();
    expect(hire('weekly')).toBe(true);
    work(8);
    const owed = required(w.provisions.employment?.[worker]).earnedCents;
    w.provisions.purses[employer] = 0;
    required(w.provisions.households[required(w.actors[employer]).householdId]).cashCents = 0;
    expect(provisions.quitWork(w, ctx([{ kind: 'provisions.quit', actorId: worker, data: {} }]), worker)).toBe(true);
    const next = actorByKey(sim, 'tollef_haugen');
    const offer = required(provisions.hiringOffer(w, sim.content, next));
    for (const id of [worker, next]) {
      required(w.actors[id]).placeId = offer.workplaceId;
      Object.assign(required(w.activity.byActor[id]), {
        placeId: offer.workplaceId,
        activityId: 'idle_at_home',
        lockedUntil: null,
      });
    }
    const command: Command = { kind: 'provisions.hire_on', actorId: worker, data: { employerId: next, term: 'daily' } };
    expect(provisions.hireOn(w, ctx([command]), worker, next, 'daily')).toBe(true);
    expect(w.provisions.wageArrears?.[0]?.employerId).toBe(employer);
    expect(w.provisions.wageArrears?.[0]?.account.earnedCents).toBe(owed);
    const cash = provisions.countyCash(w);
    w.provisions.purses[worker] = required(w.provisions.purses[worker]) - owed;
    w.provisions.purses[employer] = owed;
    w.time = asGameMinute(6 * 1440);
    employmentHour(w, ctx());
    expect(w.provisions.wageArrears).toEqual([]);
    expect(provisions.countyCash(w)).toBe(cash);
  });

  it('uses the same hire executor for autonomous newcomers and blocks unordered commanded acts', () => {
    const { w, sim, worker, employer, ctx } = fixture();
    expect(provisions.hireOn(w, ctx(), worker, employer, 'daily')).toBe(false);
    psyche.setAgency(w, worker, { ...psyche.agencyOf(w, worker), mode: 'psyche', issuer: null });
    expect(provisions.hireOn(w, ctx(), worker, employer, 'daily')).toBe(true);
    expect(activity.scheduledBlock(w, sim, worker, ctx().cal)?.activity).toBe('work');
  });

  it('refuses empty employer cash with an Explain', () => {
    const { w, worker, employer, hire } = fixture();
    w.provisions.purses[employer] = 0;
    required(w.provisions.households[required(w.actors[employer]).householdId]).cashCents = 0;
    expect(hire()).toBe(false);
    const event = w.log.events.at(-1);
    expect(event?.kind).toBe('provisions.hiring');
    expect(event?.explain?.children?.[0]?.terms.some((t) => t.source === 'cash' && t.value < 0)).toBe(true);
    expect(w.provisions.contracts?.[worker]).toBeUndefined();
  });

  it('refuses filled seasonal demand and adverse opinion, and applies the calendar to farm offers', () => {
    const { w, sim, worker, employer, hire } = fixture();
    const offer = required(provisions.hiringOffer(w, sim.content, employer));
    // A signed commitment fills the store's sole temporary position.
    w.provisions.contracts = {
      [employer]: {
        employerId: employer,
        workplaceId: offer.workplaceId,
        previousWorkplaceId: null,
        dailyCents: 60,
        hours: 8,
        fromHour: 7,
        toHour: 18,
        pay: 'daily',
        startedAt: w.time,
        endsAt: w.time + 1440,
      },
    };
    expect(hire()).toBe(false);
    expect(w.log.events.at(-1)?.explain?.note).toBe('No extra hands needed');
    delete w.provisions.contracts[employer];
    w.provisions.hiringAttempts = {};
    const ctx = makeContext(w, sim.content, []);
    social.addOpinionReason(w, ctx, employer, worker, {
      label: 'Known dishonest work',
      cites: { kind: 'seed' },
      delta: { affection: -100, trust: -100, respect: -100, fear: 0 },
      since: w.time,
    });
    expect(hire()).toBe(false);
    expect(w.log.events.at(-1)?.explain?.note).toContain('opinion');
    const farmer = actorByKey(sim, 'edwin_fenn');
    expect(provisions.hiringOffer(w, sim.content, farmer)?.rule.id).toBe('planting_hands');
    w.time = asGameMinute(100 * 1440);
    expect(provisions.hiringOffer(w, sim.content, farmer)).toBeNull();
  });

  it('prices each piece marginally: split and bulk sales match; stock and cash bound trade', () => {
    const f = fixture();
    const ctx = f.ctx();
    const stack = items.createStack(f.w, ctx, 'rabbit_pelt', 30, items.carriedBy(f.worker));
    const first = provisions.saleQuote(f.w, f.sim.content, f.place, stack);
    const total = provisions.saleTotal(f.w, f.sim.content, f.place, stack, 30);
    expect(first).toBeGreaterThan(0);
    expect(total).toBeLessThan(required(first) * 30);
    const before = provisions.countyCash(f.w);
    const purse = required(f.w.provisions.purses[f.worker]);
    const command: Command = {
      kind: 'provisions.sell',
      actorId: f.worker,
      data: { placeId: f.place, itemId: stack, qty: 30 },
    };
    expect(provisions.sell(f.w, f.ctx([command]), f.worker, f.place, stack, 30)).toBe(true);
    expect(f.w.provisions.purses[f.worker]).toBe(purse + required(total));
    expect(provisions.countyCash(f.w)).toBe(before);
    const extra = items.createStack(f.w, ctx, 'rabbit_pelt', 1, items.carriedBy(f.worker));
    expect(provisions.saleQuote(f.w, f.sim.content, f.place, extra)).toBeNull();
    // Purchasing real shelf stock reopens exactly that much demand.
    const buy: Command = {
      kind: 'provisions.buy',
      actorId: f.worker,
      data: { placeId: f.place, defId: 'rabbit_pelt', qty: 1, onCredit: false },
    };
    expect(provisions.purchase(f.w, f.ctx([buy]), f.worker, f.place, 'rabbit_pelt', 1, false)).toBe(1);
    expect(provisions.saleQuote(f.w, f.sim.content, f.place, extra)).toBeGreaterThan(0);
    expect(provisions.countyCash(f.w)).toBe(before);
    expect(findNonIntegers(f.w)).toEqual([]);
    const g = fixture();
    const batch = items.createStack(g.w, g.ctx(), 'rabbit_pelt', 30, items.carriedBy(g.worker));
    const original = required(g.w.provisions.purses[g.worker]);
    for (let i = 0; i < 30; i++) {
      const c: Command = {
        kind: 'provisions.sell',
        actorId: g.worker,
        data: { placeId: g.place, itemId: batch, qty: 1 },
      };
      expect(provisions.sell(g.w, g.ctx([c]), g.worker, g.place, batch, 1)).toBe(true);
    }
    expect(g.w.provisions.purses[g.worker]).toBe(original + required(total));
  });

  it('reserves the hiring conversation through a full turn and hides the private assessment', () => {
    const { sim, w, worker, employer } = fixture();
    const action = availableActions(sim, worker).find((a) => a.id === `hire:${employer}:daily`);
    expect(action).toBeDefined();
    step(sim, [required(action).command]);
    expect(provisions.activeEmployment(w, worker)?.employerId).toBe(employer);
    const event = w.log.events.findLast((e) => e.kind === 'provisions.hiring' && e.data.workerId === worker);
    expect(event?.explain).toBeDefined();
    expect(knownExplain(required(event?.explain), worker, 'fair')?.children).toEqual([]);
  });

  it('a fair Greenhorn can hire, work, eat and replay the same outcome', () => {
    const session = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42, pc: { kit: 'greenhorn' } });
    const act = (text: string) => {
      const command = parseText(text, session.observe());
      if (typeof command === 'string') throw new Error(command);
      const result = session.act(command);
      expect(result.ok, `${text}: ${result.reason ?? ''}`).toBe(true);
      return result;
    };
    expect(session.observe().self.provisions.purseCents).toBe(300);
    act('sleep');
    // Use fair clocks to wait through interruptions to Monday morning.
    while (session.observe().time.t < 1440 + 7 * 60) act('wait 1h');
    act('go Pratt');
    act('hire Augusta daily');
    expect(session.observe().self.provisions.employment?.dailyCents).toBe(60);
    const before = session.observe().self.provisions.purseCents;
    for (let i = 0; i < 8; i++) act('work');
    expect(session.observe().self.provisions.purseCents).toBeGreaterThan(before);
    act('go Dunleavy');
    act('meal');
    expect(session.observe().self.provisions.nutrition.kcalToday).toBeGreaterThan(0);
    expect(PlaySession.replay(baseContent(), session.commandLog).hash).toBe(session.hash);
  });
});
