import { appendEvent, asActorId, asItemId, type Command, findNonIntegers, type World } from '@coulee/core';
import { alertFor, PlaySession, parseText, provisionsAlert } from '@coulee/play';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cmd } from '../../../apps/web/src/lib/commands.ts';
import { baseContent } from './helpers.ts';

function required<T>(x: T | undefined): T {
  if (x === undefined) throw new Error('Required fixture missing');
  return x;
}
const create = (seed = 42, source = 'iron_ford') => PlaySession.create(baseContent(), { source, seed });
function doText(s: PlaySession, text: string) {
  const c = parseText(text, s.observe());
  expect(typeof c, `Parse ${text}: ${String(c)}`).toBe('object');
  const r = s.act(c as Command);
  expect(r.ok, `${text}: ${r.reason}`).toBe(true);
  // Loads take real transit time; the next transaction starts after arrival.
  if (text.startsWith('go '))
    while ((JSON.parse(s.save()).world as World).activity.byActor[s.playerId]?.travel) s.advance(60);
  return r;
}
const worldOf = (s: PlaySession) => JSON.parse(s.save()).world as World;
describe('headless sessions', () => {
  it('creates an ordinary newcomer and preserves the original scenario', () => {
    const s = create(),
      w = worldOf(s),
      original = baseContent().scenarios.iron_ford;
    expect(Object.keys(w.actors)).toHaveLength((original?.actors.length ?? 0) + 1);
    expect(w.actors[s.playerId]?.key).toBe('play_newcomer');
    expect(s.observe().self.provisions.purseCents).toBe(5000);
    expect(s.observe().self.inventory.carried.length).toBeGreaterThan(5);
    expect(findNonIntegers(w)).toEqual([]);
  });
  it('replays every hash, saves/loads/forks exactly, and does not mutate on invalid input', () => {
    const s = create();
    while (s.observe().time.t < 6 * 60) s.advance(60);
    doText(s, 'go Pratt');
    doText(s, 'buy hardtack 3');
    doText(s, 'eat hardtack');
    doText(s, 'wait 2h');
    expect(PlaySession.replay(baseContent(), s.commandLog).save()).toBe(s.save());
    expect(PlaySession.load(baseContent(), s.save()).save()).toBe(s.save());
    const fork = s.fork();
    expect(fork.save()).toBe(s.save());
    const saved = s.save();
    doText(fork, 'rations 75');
    expect(s.save()).toBe(saved);
    for (const input of [
      null,
      {},
      { kind: 'provisions.buy', actorId: s.playerId, data: { qty: -1 } },
      { kind: 'core.urge', actorId: asActorId(1), data: {} },
      { kind: 'activity.wait', actorId: s.playerId, data: { minutes: NaN } },
    ]) {
      expect(s.act(input as Command).ok).toBe(false);
      expect(s.save()).toBe(saved);
    }
    const log = s.commandLog;
    required(log[1]).after = 'wrong';
    expect(() => PlaySession.replay(baseContent(), log)).toThrow('diverged');
  }, 120000);
  it('all offered action ids execute from the observation that offered them', () => {
    const s = create();
    for (const action of s.observe().actions) {
      const branch = s.fork();
      const result = branch.act(action.id);
      expect(result.ok, `${action.id}: ${result.reason}`).toBe(true);
      expect(result.warning ?? '', action.id).not.toContain('Cannot');
    }
  }, 180000);
  it('fair observations never contain another mind or concealed ancestry across seeds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10000 }), (seed) => {
        const s = create(seed);
        s.advance(60);
        const fair = s.observe();
        expect(fair.mode).toBe('fair');
        expect('truth' in fair).toBe(false);
        expect('beliefGraph' in fair).toBe(false);
        for (const actor of fair.present) {
          // Additive (playtest r2): what anyone in the room can see, asleep, working, a child.
          expect(Object.keys(actor).sort()).toEqual(expect.arrayContaining(['activity', 'id', 'name', 'people']));
          for (const key of Object.keys(actor))
            expect(['activity', 'id', 'name', 'people', 'asleep', 'working', 'child']).toContain(key);
          expect(actor.people).not.toMatch(/shadow|faekin/i);
        }
        expect(JSON.stringify(fair)).not.toContain('shadow_faekin');
        expect(fair.self.mind.shadow).toEqual([]);
        expect(fair.self.mind.recentDefenses).toEqual([]);
        const god = s.observe('god');
        expect(god.truth?.actors.some((a) => /faekin/i.test(a.people))).toBe(true);
      }),
      { numRuns: 6, seed: 73 },
    );
  }, 120000);
  it('hides failed concealed-tell checks even in older saved knowledge and detaches god observations', () => {
    const s = create();
    const saved = JSON.parse(s.save());
    const w = saved.world as World;
    const other = required(Object.values(w.actors).find((a) => a.id !== s.playerId));
    const eventId = appendEvent(
      w.log,
      {
        kind: 'belief.tell',
        visibility: 'private',
        roles: [{ actor: s.playerId, role: 'witness' }],
        data: { targetId: other.id, tellId: 'hidden_tell', noticed: false },
        explain: {
          kind: 'check',
          label: 'SECRET NOTICE',
          subjects: [s.playerId],
          knowledge: 'self',
          terms: [],
          total: 1,
          outcome: 'failure',
        },
      },
      w.time,
    );
    saved.known.push(eventId);
    const loaded = PlaySession.load(baseContent(), JSON.stringify(saved));
    expect(JSON.stringify(loaded.observe())).not.toContain('SECRET NOTICE');
    const before = loaded.save();
    const god = loaded.observe('god');
    if (god.beliefGraph) god.beliefGraph.misfortune = 999;
    loaded.spec.seed = 900;
    expect(loaded.save()).toBe(before);
  });
  it('accepts each web constructor through the same validation path', () => {
    const s = create(),
      pc = s.playerId;
    expect(s.fork().act(cmd.doActivity(pc, 'sleep')).ok).toBe(true);
    const target = s.observe().present[0];
    expect(target).toBeDefined();
    const sleeping = s.fork().act(cmd.interact(pc, 'chat', required(target).id));
    expect(sleeping.ok).toBe(false);
    expect(sleeping.elapsedMinutes).toBe(0);
    expect(sleeping.reason).toContain('asleep');
    while (s.observe().time.t < 6 * 60) s.advance(60);
    doText(s, 'go Pratt');
    const o = s.observe(),
      stock = o.store.stock?.find((x) => x.defId === 'hardtack');
    expect(stock).toBeDefined();
    expect(s.fork().act(cmd.buy(pc, o.place.id, required(stock).defId, 2, false)).ok).toBe(true);
    const food = required(o.self.inventory.carried.find((x) => x.defId === 'hardtack'));
    expect(s.fork().act(cmd.eat(pc, asItemId(food.id), 'raw', 1)).ok).toBe(true);
    expect(s.fork().act(cmd.setRations(pc, null, 75)).ok).toBe(true);
    expect(s.fork().act(cmd.pack(pc, asItemId(food.id), 1, null)).ok).toBe(true);
  });
  it('sells without creating money and explains the price', () => {
    const s = create();
    while (s.observe().time.t < 6 * 60) s.advance(60);
    doText(s, 'go Pratt');
    const before = worldOf(s);
    const a = s.observe().actions.find((x) => x.id.startsWith('sell:'));
    expect(a).toBeDefined();
    const r = s.act(required(a).id);
    expect(r.ok).toBe(true);
    const after = worldOf(s);
    const money = (w: World) =>
      Object.values(w.provisions.purses).reduce((a, b) => a + b, 0) +
      Object.values(w.provisions.households).reduce((a, b) => a + b.cashCents, 0) +
      Object.values(w.provisions.stores).reduce((a, b) => a + b.tillCents, 0);
    expect(money(after)).toBe(money(before));
    expect(after.log.events.some((e) => e.kind === 'provisions.sale' && e.explain?.total)).toBe(true);
  });
  it.each([
    ['iron_ford', 42],
    ['gen:town', 7],
  ] as const)(
    'survives a scripted seven-day newcomer visit: %s seed %i',
    (source, seed) => {
      const s = create(seed, source);
      let bought = false,
        talked = false,
        slept = false,
        ate = false;
      const start = s.observe().time.t;
      for (let guard = 0; guard < 230 && s.observe().time.t < start + 7 * 1440; guard++) {
        const o = s.observe();
        const available = (id: string) => o.actions.find((a) => a.id === id);
        const run = (action: NonNullable<ReturnType<typeof available>>) => {
          const r = s.act(action.id);
          expect(r.ok, r.reason).toBe(true);
        };
        const unlocked = !!available('activity:sleep');
        const rest = o.self.needs.list.find((n) => n.id === 'rest')?.value ?? 1000;
        const thirst = o.self.needs.list.find((n) => n.id === 'thirst')?.value ?? 1000;
        const hunger = o.self.needs.list.find((n) => n.id === 'hunger')?.value ?? 1000;
        // Exercise an explicit bedtime even when the sustainable Rest economy never drops below 420.
        if (unlocked && (rest < 420 || (!slept && o.time.t % 1440 >= 21 * 60))) {
          run(required(available('activity:sleep')));
          slept = true;
          continue;
        }
        if (unlocked && thirst < 550) {
          run(required(available('activity:fetch_water')));
          continue;
        }
        const food = o.actions.find((a) => a.id.startsWith('eat:') && a.id.endsWith(':raw'));
        if (hunger < 650 && food) {
          run(food);
          ate = true;
          continue;
        }
        if (!bought && o.store.stock) {
          const buy = available('buy:hardtack') ?? o.actions.find((a) => a.id.startsWith('buy:'));
          if (buy) {
            const command = buy.command;
            expect(command.kind).toBe('provisions.buy');
            if (command.kind === 'provisions.buy') {
              const r = s.act({ ...command, data: { ...command.data, qty: 5 } });
              expect(r.ok).toBe(true);
              bought = true;
              continue;
            }
          }
        }
        if (!bought && unlocked) {
          const store = o.places.find((p) => /outfit|store|mercantile/i.test(p.name));
          const go = store ? available(`go:${store.id}`) : undefined;
          if (go) {
            run(go);
            continue;
          }
        }
        if (!talked && unlocked) {
          const chat = o.actions.find((a) => a.id.startsWith('talk:chat:'));
          if (chat) {
            run(chat);
            talked = true;
            continue;
          }
        }
        const result = s.advance(60);
        expect(result.ok).toBe(true);
      }
      const o = s.observe();
      expect(o.time.t - start).toBe(7 * 1440);
      expect(o.self.alive).toBe(true);
      expect([bought, talked, slept, ate]).toEqual([true, true, true, true]);
      expect(o.self.needs.list.find((n) => n.id === 'hunger')?.value).toBeGreaterThan(100);
      expect(o.self.needs.list.find((n) => n.id === 'thirst')?.value).toBeGreaterThan(100);
      expect(findNonIntegers(worldOf(s))).toEqual([]);
      expect(s.telemetry.reduce((n, m) => n + m.kcalEaten, 0)).toBeGreaterThan(7000);
      expect(s.telemetry.reduce((n, m) => n + m.kcalBurned, 0)).toBeGreaterThan(7000);
    },
    240000,
  );
});
it('interrupt defaults cover danger, summons, arrivals, vitals, notable witnesses and food/fuel crossings', () => {
  for (const flag of ['danger', 'addressed', 'arrival', 'worseVital'])
    expect(alertFor({ id: 1, kind: 'test', [flag]: true }).pause).toBe(true);
  expect(alertFor({ id: 1, kind: 'test', importance: 50, participant: true }).pause).toBe(true);
  expect(alertFor({ id: 1, kind: 'test', importance: 20 }).pause).toBe(false);
  expect(provisionsAlert(10, 9, null, null)?.pause).toBe(true);
  expect(provisionsAlert(9, 8, null, null)).toBeNull();
  expect(provisionsAlert(30, 30, 10, 9)?.pause).toBe(true);
});
