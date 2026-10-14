/** Wave 10 E: sequences cited in the r3 Socialite, Explorer and Greenhorn reports. */
import { activity, asGameMinute, items, makeContext, provisions } from '@coulee/core';
import {
  menuActions,
  PlaySession,
  parseText,
  renderDetail,
  renderInterrupts,
  renderObservation,
  sessionSimOf,
  storefront,
} from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { dayWeatherText, weekWeatherText } from '../../core/src/chronicle/weather.ts';
import { baseContent } from './helpers.ts';

const create = (source = 'iron_ford', seed = 42) => PlaySession.create(baseContent(), { source, seed });
function ask(s: PlaySession, text: string) {
  const command = parseText(text, s.observe());
  if (typeof command === 'string') throw new Error(command);
  const r = s.act(command);
  expect(r.ok, r.reason).toBe(true);
  return r;
}
function morning(s: PlaySession, hour = 8) {
  for (let i = 0; s.observe().time.t < hour * 60 && i < 30; i++) s.advance(60);
  expect(s.observe().time.t).toBe(hour * 60);
}
function farm(s: PlaySession) {
  ask(s, 'travel cedar_farm confirm');
  const sim = sessionSimOf(s);
  for (let i = 0; activity.onJourney(sim.world, s.playerId) && i < 20; i++) {
    const j = sim.world.activity.journeys?.[s.playerId];
    if (j?.status === 'stopped') ask(s, 'resume');
    else s.advance(60);
  }
  expect(activity.onJourney(sim.world, s.playerId)).toBe(false);
}

describe('r3 E1 dialogue', () => {
  it('Socialite introduce/ask/go/introduce/chat shows only this command’s new exchanges', () => {
    const s = create('gen:town', 7);
    // The playtest began at 09:00; under wave 10 needs/schedules the Kvales leave for the 10:00
    // Sunday service, so the same chain starts an hour earlier to cross 08:00→09:00 with Johanne home.
    morning(s, 8);
    ask(s, 'go 22'); // Rowe/Whitlock Mercantile, as in the command log.
    const seen = new Set<number>();
    for (const line of [
      'talk:introduce:1',
      'talk:introduce:2',
      'talk:ask_about:1',
      "go Kvale's Smithy",
      'talk:introduce:7',
      'talk:ask_about:7',
      'talk:chat:7',
    ]) {
      const r = ask(s, line);
      for (const e of r.observation.said) {
        expect(seen.has(e.id), line).toBe(false);
        seen.add(e.id);
      }
      if (line === 'talk:chat:7') {
        expect(r.observation.said.some((e) => e.hearerId === 7 || e.speakerId === 7)).toBe(true);
        expect(renderObservation(r.observation)).toContain('Johanne');
        expect(PlaySession.load(baseContent(), s.save()).observe().said).toEqual(r.observation.said);
      }
    }
    expect(ask(s, 'look').observation.said).toEqual([]);
    expect(PlaySession.replay(baseContent(), s.commandLog).hash).toBe(s.hash);
  });
});

describe('r3 E2 minute costs', () => {
  it('Greenhorn go Pratt/hire/quit uses authored minutes; a refused hire spends nothing', () => {
    const s = create();
    morning(s);
    ask(s, 'go Pratt');
    expect(ask(s, 'hire Augusta Pratt').elapsedMinutes).toBe(10);
    expect(ask(s, 'quit').elapsedMinutes).toBe(5);
    const sim = sessionSimOf(s);
    const employer = sim.world.actors[sim.world.provisions.contracts?.[s.playerId]?.employerId ?? 0];
    expect(employer).toBeDefined();
    const h = sim.world.provisions.households[employer?.householdId ?? 0];
    if (h) h.cashCents = 0;
    const hash = s.hash,
      log = s.commandLog.length;
    const command = parseText('hire Augusta Pratt weekly', s.observe());
    if (typeof command === 'string') throw new Error(command);
    const r = s.act(command);
    expect(r.ok).toBe(false);
    expect(r.elapsedMinutes).toBe(0);
    expect(s.hash).toBe(hash);
    expect(s.commandLog).toHaveLength(log);
  });
  it('drink/fill/fetch water chain without consuming the hour or moving NPCs', () => {
    const s = create(),
      sim = sessionSimOf(s);
    ask(s, 'go Glover Spring');
    const npcPlaces = Object.values(sim.world.actors)
      .filter((a) => a.id !== s.playerId)
      .map((a) => a.placeId);
    expect(ask(s, 'drink').elapsedMinutes).toBe(2);
    const vessel = items
      .stacksDeep(sim.world, items.carriedBy(s.playerId))
      .find(({ stack }) => (sim.content.items[stack.defId]?.container?.liquid_ml ?? 0) > 0)?.stack;
    if (!vessel) throw new Error('No vessel');
    vessel.waterMl = 0;
    expect(ask(s, `fill ${sim.content.items[vessel.defId]?.name}`).elapsedMinutes).toBe(3);
    vessel.waterMl = 0;
    const r = ask(s, 'fetch water');
    expect(r.elapsedMinutes).toBe(3);
    expect(vessel.waterMl).toBeGreaterThan(0);
    expect(
      Object.values(sim.world.actors)
        .filter((a) => a.id !== s.playerId)
        .map((a) => a.placeId),
    ).toEqual(npcPlaces);
    expect(sim.world.time).toBe(0);
  });
  it('a road drink takes two minutes and the route forecast respects the remaining walking budget', () => {
    const s = create('iron_ford_neighbors');
    ask(s, 'travel cedar_farm confirm');
    const r = ask(s, 'drink');
    expect(r.elapsedMinutes).toBe(2);
    expect(r.observation.region?.location.kind).toBe('edge');
    const preview = ask(s, 'route cedar_farm').routePreview;
    const start = s.observe().time.t;
    const rest = sessionSimOf(s).world.needs.byActor[s.playerId];
    for (let i = 0; activity.onJourney(sessionSimOf(s).world, s.playerId) && i < 12; i++) {
      const j = sessionSimOf(s).world.activity.journeys?.[s.playerId];
      if (j?.status === 'stopped') ask(s, 'resume');
      else s.advance(60);
    }
    expect(s.observe().time.t - start).toBe(preview?.forecast.elapsedMinutes);
    expect(s.observe().self.needs.list.find((n) => n.id === 'rest')?.value).toBe(preview?.forecast.needs.rest);
    expect(rest?.values.rest).toBe(preview?.forecast.needs.rest);
  });
  it('sleep/wake spends the wake cost and unlocks the bed', () => {
    const s = create();
    ask(s, 'standing eat off');
    ask(s, 'sleep');
    expect(s.observe().self.activity.asleep).toBe(true);
    const r = ask(s, 'wake');
    expect(r.elapsedMinutes).toBe(1);
    expect(r.observation.self.activity.asleep).toBe(false);
    expect(r.observation.minuteBudget.spent).toBe(1);
    expect(PlaySession.replay(baseContent(), s.commandLog).hash).toBe(s.hash);
  });
});

it('r3 E3 season prose cannot be read as a water spring', () => {
  const s = create();
  ask(s, 'go Pratt');
  expect(s.observe().place.description).toContain('Spring has come to Pratt');
  expect(s.observe().place.description).not.toContain('Spring at ');
});

describe('r3 E4 water and routes', () => {
  it('Explorer travel/go fields/fetch water reaches the Cedar Farm well', () => {
    const s = create('iron_ford_neighbors');
    const preview = ask(s, 'route cedar_farm');
    expect(preview.routePreview?.checks.find((c) => c.id === 'water')?.detail).toContain('Cedar Farm well');
    farm(s);
    ask(s, 'go Cedar Farm fields');
    const r = ask(s, 'fetch water');
    expect(r.elapsedMinutes).toBeLessThan(60);
    expect(r.observation.place.name).toBe('Cedar Farm well');
    const moved = r.interrupts.find((i) => i.category === 'arrival');
    expect(moved?.reason).toContain(`${r.elapsedMinutes - 3} min on foot`);
    expect(provisions.drinkingWater(sessionSimOf(s).world, sessionSimOf(s).content, s.playerId)).toBeGreaterThan(0);
  });
  it('no-source fixture warns in the preview and refuses fetch water without time or state changes', () => {
    const s = create('iron_ford_neighbors'),
      sim = sessionSimOf(s);
    for (const p of Object.values(sim.world.places))
      if (p.siteId === 'cedar_farm') p.tags = p.tags.filter((t) => !['water', 'well'].includes(t));
    expect(ask(s, 'route cedar_farm').routePreview?.forecast.warnings.join(' ')).toContain(
      'No reachable water source recorded at Cedar Farm',
    );
    farm(s);
    const hash = s.hash;
    expect(parseText('fetch water', s.observe())).toBe('No reachable water source on this site');
    const r = s.act({
      kind: 'core.urge',
      actorId: s.playerId,
      data: { urge: { kind: 'activity', activityId: 'fetch_water' } },
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('No reachable water');
    expect(r.elapsedMinutes).toBe(0);
    expect(s.hash).toBe(hash);
  });
  it('an overloaded traveler can read a road route refusal without spending time', () => {
    const s = create('iron_ford_neighbors'),
      sim = sessionSimOf(s);
    ask(s, 'travel cedar_farm confirm');
    items.createStack(
      sim.world,
      makeContext(sim.world, sim.content, []),
      'firewood_armload',
      30,
      items.carriedBy(s.playerId),
    );
    const hash = s.hash;
    const r = ask(s, 'route cedar_farm');
    expect(r.detail).toContain('load prevents walking');
    expect(r.elapsedMinutes).toBe(0);
    expect(s.hash).toBe(hash);
  });
  it('critical vitals require explicit travel confirmation, and road route projects only what remains', () => {
    const s = create('iron_ford_neighbors'),
      sim = sessionSimOf(s);
    const n = sim.world.needs.byActor[s.playerId];
    if (n) n.values.rest = 150;
    const hash = s.hash;
    const c = parseText('travel cedar_farm', s.observe());
    if (typeof c === 'string') throw new Error(c);
    const refused = s.act(c);
    expect(refused.ok).toBe(false);
    expect(refused.reason).toContain('confirm');
    expect(s.hash).toBe(hash);
    if (n) n.values.rest = 1000;
    const full = ask(s, 'route cedar_farm').routePreview?.forecast.elapsedMinutes ?? 0;
    ask(s, 'travel cedar_farm confirm');
    const before = s.hash;
    const r = ask(s, 'route cedar_farm');
    expect(r.elapsedMinutes).toBe(0);
    expect(r.routePreview?.forecast.elapsedMinutes).toBeLessThan(full);
    expect(s.hash).toBe(before);
  });
});

describe('r3 E5 menus', () => {
  it('loaded go menu minutes match arrival; collapse and destination-free walks are absent', () => {
    const s = create();
    const go = s.observe().actions.find((a) => a.id.startsWith('go:'));
    if (!go) throw new Error('No destination');
    const minutes = Number(/\((\d+) min\)/.exec(go.label)?.[1]);
    expect(s.act(go.command).elapsedMinutes).toBe(minutes);
    expect(
      s
        .observe()
        .actions.some((a) => ['activity:incapacitated', 'activity:walk', 'activity:travel_on_foot'].includes(a.id)),
    ).toBe(false);
    expect(
      s.act({
        kind: 'core.urge',
        actorId: s.playerId,
        data: { urge: { kind: 'activity', activityId: 'incapacitated' } },
      }).ok,
    ).toBe(false);
  });
  it('Attend church is in the first menu and repeated stable/text orders explain its lock', () => {
    const s = create();
    morning(s, 10);
    expect(menuActions(s.observe()).some((a) => a.id === 'activity:attend_church')).toBe(true);
    ask(s, 'attend church');
    for (const text of ['attend church', 'activity:attend_church']) {
      const c = parseText(text, s.observe());
      expect(typeof c).not.toBe('string');
      if (typeof c === 'string') throw new Error(c);
      const r = s.act(c);
      expect(r.reason).toContain('still at church');
      expect(r.elapsedMinutes).toBe(0);
    }
  });
});

it('r3 E6 wait until 07:00/tomorrow always explains an early stop', () => {
  for (const text of ['wait until 07:00', 'wait until tomorrow']) {
    const s = create(),
      sim = sessionSimOf(s);
    sim.world.time = asGameMinute(20 * 60);
    const n = sim.world.needs.byActor[s.playerId];
    if (n) n.values.rest = 310;
    ask(s, 'standing sleep off');
    const r = ask(s, text);
    expect(r.stopped).toBeDefined();
    expect(renderInterrupts(r).join(' ')).toMatch(/Wait stopped.*you meant to wait until.*:/);
    expect(r.stopped?.reasons.every((reason) => reason.length > 0)).toBe(true);
  }
});

it('r3 E7 journal is chronological and fixed weather agrees with almanac and social text', () => {
  const s = create('iron_ford_neighbors'),
    sim = sessionSimOf(s);
  for (let i = 0; i < 24 * 8; i++) s.advance(60);
  const journal = ask(s, 'journal').detail as Array<{ t: number; text: string }>;
  expect(journal.map((e) => e.t)).toEqual(journal.map((e) => e.t).sort((a, b) => a - b));
  expect(journal.some((e) => /Snow in|Rain in|Rain from|went to bed parched/.test(e.text))).toBe(false);
  expect(s.observe().weather).toMatchObject({ temperatureF: 55, raining: false, description: 'Dry' });
  expect(dayWeatherText(42, 3 * 1440, sim.world)).toBe('');
  expect(weekWeatherText(42, 0, sim.world)).toContain('dry all week');
});

describe('r3 E8 small usability', () => {
  it('faded signs describe a faded trace without sending look back to signs', () => {
    const s = create(),
      sim = sessionSimOf(s);
    const actor = sim.world.actors[s.playerId];
    if (!actor) throw new Error('No player');
    sim.world.time = asGameMinute(60);
    sim.world.fae.questions[s.playerId] = [
      {
        signId: 'expired',
        placeId: actor.placeId,
        text: 'The broom leaned oddly.',
        openedAt: 0,
        closedAt: null,
        evidence: null,
      },
    ];
    expect(ask(s, 'look').observation.place.description).toContain('That trace has faded');
    expect(s.observe().place.description).not.toContain('question is still open');
  });
  it('places at Cedar Farm includes regional destinations and local well', () => {
    const s = create('iron_ford_neighbors');
    farm(s);
    const destinations = menuActions(s.observe(), -1);
    expect(destinations.some((a) => /Iron Ford/.test(a.label))).toBe(true);
    expect(destinations.some((a) => /Cedar Farm well/.test(a.label))).toBe(true);
  });
  it('gathered and carried wood sell together across stacks without discarding wetness', () => {
    const s = create(),
      sim = sessionSimOf(s);
    morning(s);
    ask(s, 'go Pratt');
    const wood = items
      .stacksDeep(sim.world, items.carriedBy(s.playerId))
      .find(({ stack }) => stack.defId === 'firewood_armload')?.stack;
    if (!wood) throw new Error('No carried wood');
    wood.qty = 1;
    wood.wetness = 20; // Old carried wood was exposed in the playtest's rain; new wood differs.
    items.createStack(sim.world, makeContext(sim.world, sim.content, []), wood.defId, 1, items.carriedBy(s.playerId));
    // Wave 10 D3: Pratt's posts a real piece bid for wood (3 cents an armload), paid from her cash.
    const bid = s.observe().store.bids?.find((b) => b.defId === wood.defId)?.cents;
    expect(bid).toBe(3);
    const cash = provisions.countyCash(sim.world);
    const r = ask(s, 'sell firewood 2');
    expect(r.elapsedMinutes).toBe(5);
    expect(r.observation.changes.money.reduce((sum, m) => sum + m.purse, 0)).toBe(2 * (bid ?? 0));
    expect(provisions.countyCash(sim.world)).toBe(cash);
    expect(
      items.stacksDeep(sim.world, items.carriedBy(s.playerId)).some(({ stack }) => stack.defId === wood.defId),
    ).toBe(false);
    const sold = items
      .stacksAt(sim.world, items.atPlace(sim.world.actors[s.playerId]?.placeId ?? (0 as never)))
      .filter((stack) => stack.defId === wood.defId);
    expect(sold.some((stack) => stack.wetness === 20)).toBe(true);
  });
  it('a cross-stack wood sale respects the store’s buying cash and spends nothing when refused', () => {
    const s = create(),
      sim = sessionSimOf(s);
    morning(s);
    ask(s, 'go Pratt');
    const wood = items
      .stacksDeep(sim.world, items.carriedBy(s.playerId))
      .find(({ stack }) => stack.defId === 'firewood_armload')?.stack;
    if (!wood) throw new Error('No carried wood');
    wood.qty = 1;
    wood.wetness = 20;
    items.createStack(sim.world, makeContext(sim.world, sim.content, []), wood.defId, 1, items.carriedBy(s.playerId));
    const place = sim.world.actors[s.playerId]?.placeId ?? (0 as never);
    const store = sim.world.provisions.stores[place];
    if (store?.ownerHouseholdId == null) throw new Error('Missing store owner');
    const head = sim.world.households[store.ownerHouseholdId]?.headId;
    const owner = sim.world.provisions.households[store.ownerHouseholdId];
    if (!owner || head === undefined) throw new Error('Missing cashbox');
    owner.cashCents = 4; // One armload's bid, not two.
    sim.world.provisions.purses[head] = 0;
    const hash = s.hash;
    const command = parseText('sell firewood 2', s.observe());
    if (typeof command === 'string') throw new Error(command);
    const r = s.act(command);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('lacks the cash');
    expect(s.hash).toBe(hash);
  });
  it('prices has one horn-arrow entry and inspect cornmeal reads the counter’s catalog before buying', () => {
    const s = create();
    morning(s);
    ask(s, 'go Pratt');
    const price = renderDetail(ask(s, 'prices arrows').detail);
    expect(price.match(/horn-tipped/g)).toHaveLength(1);
    expect(storefront(sessionSimOf(s), s.playerId)?.lines.filter((l) => /horn-tipped/.test(l.name))).toHaveLength(1);
    const hash = s.hash;
    const r = ask(s, 'inspect cornmeal');
    expect(r.elapsedMinutes).toBe(0);
    expect(renderDetail(r.detail)).toContain('kcal');
    expect(renderDetail(r.detail)).toContain('Preparation:');
    expect(s.hash).toBe(hash);
  });
  it('06:00 look drops stale night duty and drink Appetite after standing water restored thirst', () => {
    const s = create();
    morning(s, 6);
    const sim = sessionSimOf(s),
      n = sim.world.needs.byActor[s.playerId];
    if (n) n.values.thirst = 900;
    const text = renderObservation(ask(s, 'look').observation);
    expect(text).not.toContain('Conscience: It is late');
    expect(text).not.toContain('Appetite: Drink accessible water');
  });
});
