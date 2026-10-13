/**
 * Play-loop polish (wave 3): walking arrives, the player's own words print first, every event is
 * told in plain English, ordinary sleep and waiting camp on open ground, and money never leaves a
 * commanded character's hands unordered.
 */
import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  activity as activityApi,
  asItemId,
  type Command,
  type Event,
  HOURLY_SYSTEMS,
  items,
  makeContext,
  type Sim,
  social,
} from '@coulee/core';
import {
  describeEvent,
  type Observation,
  PlaySession,
  parseText,
  renderInterrupts,
  renderObservation,
} from '@coulee/play';
import { expect, it } from 'vitest';
import { baseContent } from './helpers.ts';

const RAW_KIND = /\b(activity|needs|psyche|social|belief|provisions|items|chronicle|core)\.[a-z_]+\b/;
const required = <T>(x: T | undefined | null): T => {
  if (x == null) throw new Error('Missing fixture');
  return x;
};
const create = (seed = 42, source = 'iron_ford') => PlaySession.create(baseContent(), { source, seed });
const simOf = (s: PlaySession) => (s as unknown as { sim: Sim }).sim;
const text = (s: PlaySession) => renderObservation(s.observe());
function ask(s: PlaySession, line: string) {
  const c = parseText(line, s.observe());
  expect(typeof c, `${line}: ${String(c)}`).toBe('object');
  return s.act(c as Command);
}

// ---- 1. walking arrives ----------------------------------------------------------------

it('go <place> arrives within the hour and the observation shows the new place at once', () => {
  const s = create();
  const r = ask(s, 'go Pratt');
  expect(r.ok).toBe(true);
  const o = r.observation;
  expect(o.place.name).toMatch(/Pratt/);
  expect(o.self.activity.travelingTo).toBeNull();
  const moved = o.events.find((e) => e.kind === 'activity.moved');
  expect(moved?.summary).toMatch(/^You arrive at Pratt/);
  expect(moved?.summary).toMatch(/min on foot|arrive at Pratt & Daughter, Outfitters$/);
  const out = text(s);
  expect(out).toContain('Pratt & Daughter, Outfitters');
  expect(out).not.toMatch(/Dunleavy's Tavern\s*\nEllis/);
});

it('walking time is the site distance at a walking pace, slowed by the load, and a long trip shows progress', () => {
  const s = create();
  const sim = simOf(s);
  const here = required(sim.world.actors[s.playerId]).placeId;
  const pratt = required(Object.values(sim.world.places).find((p) => /Pratt/.test(p.name)));
  // 60 ft at 264 ft/min is a minute; the Medium pack (80% pace) adds a quarter of it, rounded up.
  expect(activityApi.walkMinutes(sim.world, sim.content, here, pratt.id)).toBe(1);
  // Move the outfitters 50,000 ft away: the trip now outlasts the hour and she is on the road.
  pratt.x = 5000;
  const r = ask(s, 'go Pratt');
  expect(r.ok).toBe(true);
  const o = r.observation;
  expect(o.self.activity.travelingTo).toBe(pratt.id);
  expect(o.place.id).toBe(here);
  expect(text(s)).toMatch(/on the road to Pratt & Daughter, Outfitters, about \d+ min more/);
  let guard = 0;
  while (s.observe().self.activity.travelingTo !== null && guard++ < 24) s.advance(60);
  const after = s.observe();
  expect(after.place.id).toBe(pratt.id);
  expect(
    after.events.some((e) => e.kind === 'activity.moved' && /^You arrive at Pratt.*min on foot/.test(e.summary)),
  ).toBe(true);
});

// ---- 2. the player's own words ---------------------------------------------------------

it("the player's own exchange prints first, then what was said to her, then talk overheard", () => {
  const s = create();
  const michael = required(s.observe().present.find((p) => p.name === 'Michael Dunleavy'));
  const r = s.act(`talk:chat:${michael.id}`);
  expect(r.ok).toBe(true);
  const said = r.observation.said;
  expect(said.length).toBeGreaterThan(0);
  expect(said[0]?.speakerId).toBe(s.playerId);
  expect(said[0]?.lines?.some((l) => l.speakerId === s.playerId)).toBe(true);
  const out = text(s);
  const mine = said[0]?.lines?.[0];
  expect(out).toContain(`${mine?.speaker}: “${mine?.text}”`);
  // Her own line comes before any line another character initiated.
  const own = out.indexOf(`  ${mine?.speaker}: “${mine?.text}”`);
  for (const e of said.slice(1))
    for (const l of e.lines ?? []) expect(out.indexOf(`  ${l.speaker}: “${l.text}”`)).toBeGreaterThan(own);
});

it('an act whose words were not composed still says so instead of printing nothing', () => {
  const s = create();
  const michael = required(s.observe().present.find((p) => p.name === 'Michael Dunleavy'));
  s.act(`talk:chat:${michael.id}`);
  const o: Observation = JSON.parse(JSON.stringify(s.observe()));
  for (const e of o.said) delete e.lines;
  expect(renderObservation(o)).toContain('Nothing worth repeating is said.');
});

// ---- 3. no raw event kinds -------------------------------------------------------------

it('every event told to the player, every interrupt and every rendered turn is plain English', () => {
  const s = create();
  const seen: string[] = [];
  const note = (o: Observation) => seen.push(renderObservation(o), ...o.events.map((e) => e.summary));
  note(s.observe());
  for (const line of [
    'wait 3h',
    'go Pratt',
    'wait 1h',
    'buy hardtack 2',
    'eat hardtack',
    'go Dunleavy',
    'sleep',
    'wait until 09:00',
    'wait 1d',
    'journal',
  ]) {
    const c = parseText(line, s.observe());
    if (typeof c === 'string') continue;
    const r = s.act(c);
    if (!r.ok) continue;
    note(r.observation);
    seen.push(...r.interrupts.map((i) => i.reason), ...renderInterrupts(r));
    for (const i of r.interrupts) if (i.kind) expect(i.reason).not.toBe(i.kind);
  }
  for (const line of seen) expect(line, line).not.toMatch(RAW_KIND);
  expect(seen.join('\n')).not.toMatch(/Stopped: (activity|needs|social)/);
});

it('names the sentences the smoke test saw as raw kinds', () => {
  const s = create();
  const sim = simOf(s);
  const pc = s.playerId;
  const ev = (kind: string, data: object, extra: object = {}) =>
    ({
      id: 1,
      t: 0,
      kind,
      data,
      roles: [{ actor: pc, role: 'agent' }],
      visibility: 'private',
      ...extra,
    }) as unknown as Event;
  const say = (e: Event) => describeEvent(sim.world, sim.content, pc, e).text;
  expect(say(ev('needs.band_changed', { actorId: pc, needId: 'hunger', from: '', to: 'Peckish', value: 590 }))).toBe(
    'You are getting peckish',
  );
  expect(
    say(ev('needs.band_changed', { actorId: pc, needId: 'hunger', from: 'Peckish', to: 'Hungry', value: 290 })),
  ).toBe('You are hungry now');
  expect(say(ev('needs.band_changed', { actorId: pc, needId: 'hunger', from: 'Hungry', to: '', value: 900 }))).toBe(
    'You are no longer hungry',
  );
  expect(say(ev('activity.started', { actorId: pc, activityId: 'sleep', placeId: 1, source: 'command' }))).toBe(
    'You lie down to sleep',
  );
  const pratt = required(Object.values(sim.world.places).find((p) => /Pratt/.test(p.name)));
  expect(say(ev('activity.moved', { actorId: pc, from: 1, to: pratt.id, minutes: 12 }))).toBe(
    `You arrive at ${pratt.name} (12 min on foot)`,
  );
  // Whatever new kind a module adds, the fallback reads as words, never as a kind.
  expect(say(ev('belief.mystery_event', {}))).toBe('Belief: mystery event');
});

it('a wait stopped early says when, what it was for, and why', () => {
  const s = create();
  s.act('activity:sleep');
  let stopped: ReturnType<typeof s.advance> | undefined;
  for (let i = 0; i < 40 && !stopped?.stopped; i++) {
    const until = s.observe().time.t + 1440;
    stopped = s.advance({ time: until, maxMinutes: 1440 });
  }
  const r = required(stopped);
  expect(r.stopped).toBeDefined();
  const lines = renderInterrupts(r);
  // The day is named on both ends, so a stop never reads as an overshoot (playtest r2), and the
  // reason is always said.
  expect(lines[0]).toMatch(
    /^Wait stopped at \d\d:\d\d on \w+ the \d+\w\w \(you meant to wait until \d\d:\d\d on \w+ the /,
  );
  expect(renderInterrupts(r, { allReasons: true })[0]).toMatch(/\): .+\.$/);
  expect(lines.join(' ')).not.toMatch(RAW_KIND);
});

// ---- 4. camping with the ordinary verbs ------------------------------------------------

function toTheShelf(s: PlaySession) {
  const r = ask(s, 'go Huldra');
  expect(r.ok).toBe(true);
  expect(r.observation.place.name).toMatch(/Huldra/);
  return r.observation;
}

it('sleep on open ground with bedding makes camp there: no walk, no paid bed', () => {
  const s = create();
  const o = toTheShelf(s);
  expect(o.self.camp).toEqual({ afield: true, bedding: true });
  const bed = o.actions.find((a) => a.id === 'activity:sleep');
  expect(bed?.label).toBe('Make camp and sleep here');
  const purse = o.self.provisions.purseCents;
  const started = (JSON.parse(s.save()).world.log.lastId as number) ?? 0;
  const r = ask(s, 'sleep');
  expect(r.ok).toBe(true);
  for (let i = 0; i < 6; i++) s.advance(60);
  const after = s.observe();
  expect(after.place.name).toMatch(/Huldra/);
  expect(after.self.activity.name).toBe('Sleep at this camp');
  expect(after.self.provisions.purseCents).toBe(purse);
  const log = JSON.parse(s.save()).world.log.events as Event[];
  expect(
    log.some(
      (e) =>
        e.id > started &&
        e.kind === 'provisions.cash_transfer' &&
        e.data.fromId === s.playerId &&
        e.data.reason === 'Tavern bed',
    ),
  ).toBe(false);
});

it('waiting through the night away from lodgings sleeps in place on standing orders; the lodging order stays in town', () => {
  const s = create();
  toTheShelf(s);
  const purse = s.observe().self.provisions.purseCents;
  const r = s.advance({ time: s.observe().time.t + 8 * 60, maxMinutes: 600 });
  expect(r.ok).toBe(true);
  const o = s.observe();
  expect(o.place.name).toMatch(/Huldra/);
  expect(o.self.provisions.purseCents).toBe(purse);
  const slept = (JSON.parse(s.save()).world.log.events as Event[]).some(
    (e) => e.kind === 'activity.started' && e.data.actorId === s.playerId && e.data.activityId === 'sleep_rough',
  );
  expect(slept).toBe(true);
  // In town the same hour at the tavern keeps the PC's own bed: no camp is offered.
  const home = create();
  const town = home.observe();
  expect(town.self.camp.afield).toBe(false);
  expect(town.actions.some((a) => a.id === 'activity:sleep_rough')).toBe(false);
  expect(town.actions.find((a) => a.id === 'activity:sleep')?.label).toBe('Sleep');
});

it('without bedding the camp is not offered and ordinary sleep still goes to a bed', () => {
  const s = create();
  const sim = simOf(s);
  for (const st of Object.values(sim.world.items.stacks)) {
    const root = items.rootOf(sim.world, st);
    if (
      root.kind === 'actor' &&
      root.actorId === s.playerId &&
      (sim.content.items[st.defId]?.affordances.insulate ?? 0) > 0
    )
      st.condition = 0;
  }
  const o = toTheShelf(s);
  expect(o.self.camp).toEqual({ afield: true, bedding: false });
  expect(o.actions.find((a) => a.id === 'activity:sleep')?.label).toBe('Sleep');
  expect(ask(s, 'sleep').notice).toMatch(/nothing to sleep in .* head back to your lodgings/);
});

it('rest stays where she stands instead of walking home', () => {
  const s = create();
  ask(s, 'go Pratt');
  expect(s.observe().actions.find((a) => a.id === 'activity:idle_at_home')?.label).toBe('Rest here awhile');
  ask(s, 'rest');
  expect(s.observe().place.name).toMatch(/Pratt/);
  expect(text(s)).not.toMatch(/at home, at leisure/);
});

// ---- 5. money moves only on her order --------------------------------------------------

function owing(s: PlaySession) {
  // A loan from Joel Pike, as the ledger records it, dated long enough ago to be due.
  const sim = simOf(s);
  const pc = s.playerId;
  const joel = required(
    Object.values(sim.world.actors).find((a) => a.name.given === 'Joel' && a.name.family === 'Pike'),
  );
  social.extendCredit(sim.world, makeContext(sim.world, sim.content, []), joel.id, pc, 150);
  return joel;
}

it('a due debt is an obligation with a due date in the journal and a duty thought, never an automatic payment', () => {
  const s = create();
  const joel = owing(s);
  const o = s.observe();
  expect(o.self.obligations).toHaveLength(1);
  expect(o.self.obligations[0]).toMatchObject({ creditorId: joel.id, cents: 150, overdue: false, daysLeft: 30 });
  const journal = s.act('journal');
  const entry = (journal.detail as Array<{ text: string }>).at(-1);
  expect(entry?.text).toMatch(/You owe Joel Pike \$1\.50, due .*1855/);
  // Thirty-one days on, it is overdue: reminded in the status, with a duty thought.
  const rel = required(simOf(s).world.social.relationships.find((r) => r.kind === 'creditor' && r.b === s.playerId));
  rel.since = (rel.since - 31 * 1440) as never;
  s.advance(60);
  const late = s.observe();
  expect(late.self.obligations[0]?.overdue).toBe(true);
  expect(renderObservation(late)).toMatch(/You owe Joel Pike \$1\.50, overdue since .*1855/);
  expect(late.self.mind.thoughts.some((t) => t.urge === `interaction:repay->${joel.id}`)).toBe(true);
  // Never an automatic payment to the creditor (the standing lodging order may pay her bed).
  const repaid = simOf(s).world.log.events.filter(
    (e) => e.kind === 'provisions.cash_transfer' && e.data.fromId === s.playerId && e.data.toId === joel.id,
  );
  expect(repaid).toEqual([]);
});

it('a social act that moves money needs her order when she is held for orders; it still runs when ordered', () => {
  const s = create();
  const joel = owing(s);
  const sim = simOf(s);
  const pc = s.playerId;
  const w = sim.world;
  required(w.actors[joel.id]).placeId = required(w.actors[pc]).placeId;
  activityApi.recomputeOccupancy(w);
  const run = (voice: 'ego' | 'command') => {
    const before = w.log.lastId;
    const urge = { kind: 'interaction', interactionId: 'repay', targetId: joel.id } as const;
    required(w.psyche.byActor[pc]).chosen = {
      urge,
      voice,
      compromise: false,
      at: w.time,
      explain: {
        kind: 'formula',
        label: 'test',
        subjects: [pc],
        knowledge: 'self',
        terms: [],
        total: 0,
        outcome: 'chosen',
      },
    } as never;
    const social_ = required(HOURLY_SYSTEMS.find((x) => x.id === 'social'));
    // An order arrives as a Command in the same tick (authorizeAct reads its issuer).
    const orders = voice === 'command' ? [{ kind: 'core.urge', actorId: pc, data: { urge } } as never] : [];
    social_.run(w, makeContext(w, sim.content, orders));
    return w.log.events.filter((e) => e.id > before && e.kind === 'provisions.cash_transfer' && e.data.fromId === pc);
  };
  // The psyche is not the player: an unordered impulse to settle up moves nothing.
  expect(run('ego')).toHaveLength(0);
  expect(w.provisions.purses[pc]).toBe(5000);
  // Ordered, the same act pays.
  expect(run('command')).toHaveLength(1);
  expect(w.provisions.purses[pc]).toBe(4850);
});

// ---- 6. cheap text fixes ---------------------------------------------------------------

it('pack <item> into <container> takes the direction as written', () => {
  const s = create();
  const o = s.observe();
  const name = (id: number) => o.self.inventory.carried.find((i) => i.id === id)?.name ?? '';
  const pack = parseText('pack canteen into knapsack', o) as Extract<Command, { kind: 'provisions.pack' }>;
  expect(name(pack.data.itemId)).toMatch(/canteen/i);
  expect(name(required(pack.data.intoItemId))).toMatch(/knapsack/i);
  expect(parseText('pack knapsack', o)).toMatch(/pack <item> into <container>/);
  // Not on offer: the game gives the real reason, at no time cost (wave 5: pack refusals).
  const wrong = parseText('pack knapsack into canteen', o);
  expect(typeof wrong).not.toBe('string');
  const refused = s.act(wrong as Command);
  expect(refused.ok).toBe(false);
  expect(refused.reason).toMatch(/will not go into the Canteen.*(holds \d+ ml of water|is full by)/);
  expect(refused.elapsedMinutes).toBe(0);
  expect(parseText('pack nonsense into canteen', o)).toMatch(/^You carry nothing called/);
  // Two containers that hold each other make both directions offered: the words pick one.
  const both = JSON.parse(JSON.stringify(o)) as Observation;
  const act = (id: string, label: string) => ({
    id,
    label,
    command: { ...pack, data: { ...pack.data, itemId: asItemId(Number(id.split(':')[1])) } },
  });
  both.actions = [
    act('pack:1:2', 'Pack Army knapsack into Tin canteen'),
    act('pack:2:1', 'Pack Tin canteen into Army knapsack'),
  ];
  const pick = parseText('pack knapsack into canteen', both) as Extract<Command, { kind: 'provisions.pack' }>;
  expect(pick.data.itemId).toBe(1);
  // Doing it says what was moved.
  const r = s.act(pack);
  expect(r.ok).toBe(true);
  expect(r.notice).toMatch(/^Moved 1 of your .* into the /);
});

it('an ambiguous or empty order says what each candidate is, with prices, not bare ids', () => {
  const s = create();
  s.advance({ time: 7 * 60, maxMinutes: 480 });
  ask(s, 'go Pratt');
  const o = s.observe();
  const bare = parseText('buy', o);
  expect(bare).toMatch(/^Buy what\?/);
  const some = parseText('buy f', o);
  expect(typeof some === 'string' ? some : '').toMatch(/^Which one\? .*\(\$\d+\.\d\d\) \[buy:/);
  expect(parseText('go nowhere at all', o)).toMatch(/^Nothing here matches/);
});

it('what she has heard lists on a look, not on every turn; an infant is not offered a chat', () => {
  const s = create();
  const o: Observation = JSON.parse(JSON.stringify(s.observe()));
  o.self.belief.beliefs = [
    { id: 1, text: 'Somebody is of the hidden folk', credence: 70, evidenceCount: 1, voiced: false, conceal: false },
  ];
  o.changes.elapsed = 0;
  expect(renderObservation(o)).toContain('Heard: Somebody is of the hidden folk');
  o.changes.elapsed = 60;
  expect(renderObservation(o)).not.toContain('Heard: Somebody');
  const brigid = required(s.observe().present.find((p) => p.name === 'Brigid Dunleavy'));
  expect(s.observe().actions.some((a) => a.id === `talk:chat:${brigid.id}`)).toBe(false);
});

// ---- the session CLI says the same things --------------------------------------------

it('the stateless CLI shows arrivals, stopped waits and camp in words, never as event kinds', () => {
  const dir = mkdtempSync(join(tmpdir(), 'coulee-polish-'));
  try {
    const run = (...args: string[]) => {
      // File descriptors work in the socket-restricted agent sandbox too; default
      // child-process pipes fail there with EPERM despite a misleading status of 0.
      const stdout = join(dir, 'stdout.txt'),
        stderr = join(dir, 'stderr.txt');
      const outFd = openSync(stdout, 'w'),
        errFd = openSync(stderr, 'w');
      let r: ReturnType<typeof spawnSync>;
      try {
        r = spawnSync(
          process.execPath,
          ['--import', 'tsx', 'packages/cli/src/main.ts', 'play', '--session', join(dir, 'session'), ...args],
          {
            stdio: ['ignore', outFd, errFd],
            timeout: 120000,
          },
        );
      } finally {
        closeSync(outFd);
        closeSync(errFd);
      }
      expect(r.error).toBeUndefined();
      const output = readFileSync(stdout, 'utf8');
      expect(r.status, readFileSync(stderr, 'utf8') || output).toBe(0);
      return output;
    };
    run('--new', '--scenario', 'iron_ford', '--seed', '42');
    const go = run('go Pratt');
    expect(go).toContain('You arrive at Pratt & Daughter, Outfitters');
    expect(go).toMatch(/\| Pratt & Daughter, Outfitters\n/);
    const wait = run('wait until 07:00');
    expect(wait).toMatch(
      /^Wait stopped at \d\d:\d\d on \w+ the \d+\w\w \(you meant to wait until 07:00 on \w+ the \d+\w\w\): /m,
    );
    for (const out of [go, wait]) {
      expect(out).not.toMatch(/Stopped: /);
      expect(out).not.toMatch(RAW_KIND);
    }
    expect(run('help')).toContain('sleep makes camp where you stand');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 180000);

it('the Here line says who is asleep, so nobody is offered to talk to who cannot answer', () => {
  const s = create();
  s.advance(180);
  const o = s.observe();
  const sleeper = required(o.present.find((p) => /sleep/i.test(p.activity)));
  expect(text(s)).toContain(`${sleeper.name} (#${sleeper.id}, asleep)`);
  expect(o.actions.some((a) => a.id === `talk:chat:${sleeper.id}`)).toBe(false);
});
