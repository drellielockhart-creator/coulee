import { asEventId, asGameMinute, asMemoryId, social, type ViewOptions } from '@coulee/core';
import {
  type KnownEvent,
  PlaySession,
  packKnowledge,
  playViewModel,
  regardOf,
  renderDetail,
  sessionKnowledgeOf,
  sessionSimOf,
} from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { baseContent } from './helpers.ts';

const opts = (perspective: ViewOptions['perspective'], omniscient = false): ViewOptions => ({
  perspective,
  omniscient,
  includeExplain: true,
  recentChronicle: 0,
});
function fixture() {
  const session = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
  const sim = sessionSimOf(session);
  const pc = session.playerId;
  const target = Object.values(sim.world.actors).find((a) => a.id !== pc && a.alive);
  if (!target || !sim.world.actors[pc]) throw new Error('Missing actors');
  target.placeId = sim.world.actors[pc].placeId;
  const other = target.id;
  sim.world.social.opinions[pc] = { [other]: social.emptyOpinion(other) };
  sim.world.social.opinions[other] = { [pc]: social.emptyOpinion(pc) };
  const own = sim.world.social.opinions[pc]?.[other];
  const incoming = sim.world.social.opinions[other]?.[pc];
  if (!own || !incoming) throw new Error('Missing opinions');
  incoming.base = { affection: 23, respect: 37, trust: 17, fear: 4 };
  own.familiarity = 1000;
  sim.world.actors[pc].sheet.skills.perception = 30;
  const read = (god = false) => regardOf(sim.world, sim.content, pc, other, god);
  const inspect = (god = false) =>
    session.act(
      {
        kind: 'activity.observe',
        actorId: pc,
        data: { query: 'inspect', target: `actor:${other}` },
      },
      god ? 'god' : 'fair',
    );
  return { session, sim, pc, other, incoming, own, read, inspect };
}

describe('inspect: another person’s regard', () => {
  it('redacts old archived relationship labels and incoming numbers in check labels', () => {
    const f = fixture();
    const saved = JSON.parse(f.session.save());
    const event: KnownEvent = {
      id: 12345,
      t: 0,
      kind: 'social.label_changed',
      summary: 'A neighbor now thinks of you as friend',
      explain: {
        kind: 'check',
        label: 'Persuasion',
        subjects: [f.pc],
        knowledge: 'self',
        terms: [],
        total: 15,
        outcome: 'success',
        dc: { total: 12, terms: [{ source: 'opinion', label: 'Their regard (Affection +23, Trust +17)', value: -1 }] },
      },
    };
    saved.knowledgeArchive = packKnowledge([
      event,
      { ...event, id: 12346, kind: 'social.interaction', summary: 'You chatted with your neighbor' },
    ]);
    saved.known = [event.id, 12346];
    const loaded = PlaySession.load(baseContent(), JSON.stringify(saved));
    const knowledge = sessionKnowledgeOf(loaded);
    expect(JSON.stringify(knowledge)).not.toMatch(/friend|Affection|Trust/);
    expect(knowledge[0]?.explain?.dc?.terms[0]?.label).toBe('Their apparent manner');
    expect(PlaySession.load(baseContent(), loaded.save()).save()).toBe(loaded.save());
  });
  it('keeps witnessed aid visible through the durable archive without a PC memory or retained event', () => {
    const f = fixture();
    const id = asMemoryId(987);
    const eventId = asEventId(45678);
    f.sim.world.social.memories[id] = {
      kind: 'help',
      at: asGameMinute(0),
      since: asGameMinute(0),
      placeId: null,
      roles: [{ who: f.pc, role: 'agent', conf: 1000 }],
      emotion: 'gratitude',
      intensity: 80,
      confidence: 1000,
      rehearsals: 0,
      pinned: false,
      aboutId: f.pc,
      did: false,
      count: 1,
      id,
      ownerId: f.other,
      eventId,
      salience: 1000,
      summary: 'SECRET gratitude',
      source: { kind: 'witnessed' },
    };
    f.sim.world.social.memoriesByOwner[f.other] = [id];
    f.incoming.reasons.push({
      label: 'SECRET private interpretation of aid',
      cites: { kind: 'memory', id },
      delta: { affection: 15, respect: 10, trust: 20, fear: 0 },
      since: asGameMinute(0),
    });
    const aid: KnownEvent = {
      id: eventId,
      t: 0,
      kind: 'needs.aid',
      summary: 'You help your neighbor (carried home)',
      explain: null,
      deed: { agentId: f.pc, targetIds: [f.other] },
    };
    const saved = JSON.parse(f.session.save());
    saved.knowledgeArchive = packKnowledge([aid]);
    saved.known = [eventId];
    saved.world.log.events = [];
    const loaded = PlaySession.load(baseContent(), JSON.stringify(saved));
    const result = loaded.act({
      kind: 'activity.observe',
      actorId: f.pc,
      data: { query: 'inspect', target: `actor:${f.other}` },
    });
    const d = result.detail as { regard: social.RegardView };
    expect(d.regard.reasons).toEqual([aid.summary]);
    expect(renderDetail(result.detail)).not.toContain('SECRET');
    const sim = sessionSimOf(loaded);
    expect(
      playViewModel(sim.world, sim.content, opts(f.pc), sessionKnowledgeOf(loaded)).actors.find((a) => a.id === f.other)
        ?.social.regard,
    ).toEqual(d.regard);
  });
  it('withholds exact axes, labels, secret causes and private interpretations in fair play', () => {
    const f = fixture();
    f.incoming.label = 'Friend';
    f.incoming.reasons.push(
      {
        label: 'SECRET unheard rumor',
        cites: { kind: 'seed' },
        delta: { affection: 7, respect: 0, trust: 0, fear: 0 },
        since: asGameMinute(0),
      },
      {
        label: 'SECRET rationalization',
        cites: { kind: 'memory', id: asMemoryId(100) },
        viaDefense: 'projection',
        delta: { affection: 1, respect: 0, trust: 0, fear: 0 },
        since: asGameMinute(0),
      },
    );
    const eventId = asEventId(12345);
    for (const [id, ownerId, summary] of [
      [100, f.other, 'SECRET private interpretation'],
      [101, f.pc, 'Brought a gift to my neighbor'],
    ] as const) {
      f.sim.world.social.memories[id] = {
        id: asMemoryId(id),
        ownerId,
        eventId,
        summary,
        kind: 'gift',
        at: asGameMinute(0),
        since: asGameMinute(0),
        placeId: null,
        roles: [
          { who: f.pc, role: 'agent', conf: 100 },
          { who: f.other, role: 'target', conf: 100 },
        ],
        source: { kind: 'witnessed' },
        emotion: 'gratitude',
        intensity: 30,
        salience: 1000,
        confidence: 1000,
        rehearsals: 0,
        pinned: true,
        aboutId: ownerId === f.pc ? f.other : f.pc,
        did: ownerId === f.pc,
        count: 1,
      };
      f.sim.world.social.memoriesByOwner[ownerId] = [asMemoryId(id)];
    }
    f.incoming.reasons.push({
      label: 'SECRET private gift motive',
      cites: { kind: 'memory', id: asMemoryId(100) },
      delta: { affection: 6, respect: 0, trust: 1, fear: 0 },
      since: asGameMinute(0),
    });
    const before = f.session.hash;
    const result = f.inspect();
    expect(result.ok).toBe(true);
    expect(result.elapsedMinutes).toBe(0);
    const detail = result.detail as { regard: social.RegardView };
    expect(detail.regard.reasons).toEqual(['Brought a gift to my neighbor']);
    expect(detail.regard).not.toHaveProperty('truth');
    expect(detail.regard).not.toHaveProperty('affection');
    const text = renderDetail(result.detail);
    expect(text).toContain('Seems to feel about you: friendly');
    expect(text).not.toMatch(/SECRET|Friend|affection: 23|affection 37/);
    const vm = playViewModel(f.sim.world, f.sim.content, opts(f.pc));
    const actor = vm.actors.find((a) => a.id === f.other);
    expect(actor?.social.opinions).toEqual([]);
    expect(actor?.social.regard).toEqual(detail.regard);
    expect(JSON.stringify(actor?.social)).not.toMatch(/SECRET|Friend/);
    // Query commands are archived, but never change simulation state.
    expect(f.session.hash).toBe(before);
  });

  it('misreads strangers/guarded people consistently within a day, including load and fork', () => {
    const f = fixture();
    f.own.familiarity = 0;
    const pc = f.sim.world.actors[f.pc];
    const other = f.sim.world.actors[f.other];
    if (!pc || !other) throw new Error('Missing actors');
    pc.sheet.skills.perception = 0;
    other.values.discretion = 20;
    const first = f.read();
    expect(first?.explain?.outcome).toBe('failure');
    expect(first?.band).not.toBe(f.read(true)?.band);
    f.sim.world.time = asGameMinute(1439);
    expect(f.read()).toEqual(first);
    expect((f.inspect().detail as { regard: social.RegardView }).regard).toEqual(first);
    const loaded = PlaySession.load(baseContent(), f.session.save());
    const sim = sessionSimOf(loaded);
    expect(regardOf(sim.world, sim.content, f.pc, f.other)).toEqual(first);
    expect(sessionSimOf(loaded.fork()).world).toEqual(sim.world);
    sim.world.time = asGameMinute(1440);
    expect(regardOf(sim.world, sim.content, f.pc, f.other)?.explain?.roll).not.toEqual(first?.explain?.roll);
  });

  it('does not read a distant person’s current private feelings', () => {
    const f = fixture();
    const target = f.sim.world.actors[f.other];
    if (!target) throw new Error('Missing target');
    target.placeId = Object.values(f.sim.world.places).find((p) => p.id !== target.placeId)?.id ?? target.placeId;
    expect(f.read()).toBeUndefined();
    expect(f.read(true)?.truth).toBeDefined();
  });

  it('god inspect includes exact current values, base, mood and hidden causes', () => {
    const f = fixture();
    f.incoming.reasons.push({
      label: 'SECRET belief',
      cites: { kind: 'seed' },
      delta: { affection: 11, respect: -3, trust: 2, fear: 1 },
      since: asGameMinute(0),
    });
    f.incoming.volatile.affection = -2;
    const r = f.inspect(true);
    const d = r.detail as { regard: social.RegardView };
    expect(d.regard.truth?.opinion).toEqual(social.opinionOf(f.sim.world, f.other, f.pc));
    expect(d.regard.truth?.base).toEqual(f.incoming.base);
    expect(d.regard.truth?.volatile).toEqual(f.incoming.volatile);
    expect(renderDetail(r.detail)).toContain('True cause: SECRET belief');
    expect(
      playViewModel(f.sim.world, f.sim.content, opts(f.pc, true)).actors.find((a) => a.id === f.other)?.social.regard,
    ).toEqual(d.regard);
  });

  it('changes the band and visible deeds after actual gifts and insults', () => {
    const f = fixture();
    const w = f.sim.world;
    const pc = w.actors[f.pc];
    const target = w.actors[f.other];
    if (!pc || !target) throw new Error('Missing actors');
    w.time = asGameMinute(8 * 60);
    target.placeId = pc.placeId;
    const active = w.activity.byActor[f.pc];
    if (!active) throw new Error('Missing activity');
    w.activity.byActor[f.other] = { ...active, activityId: 'idle_at_home', lockedUntil: asGameMinute(0) };
    f.incoming.base = { affection: 18, respect: 0, trust: 0, fear: 0 };
    const before = f.read()?.band;
    const gift = f.session.act({
      kind: 'core.urge',
      actorId: f.pc,
      data: { urge: { kind: 'interaction', interactionId: 'gift', targetId: f.other } },
    });
    expect(gift.ok, gift.reason).toBe(true);
    target.placeId = pc.placeId;
    expect(f.read()?.band).not.toBe(before);
    expect(f.read()?.reasons.join(' ')).toContain('a little something');
    // An insult is permitted by commanded agency; place the pair back together after the hour.
    target.placeId = pc.placeId;
    const otherActivity = w.activity.byActor[f.other];
    if (!otherActivity) throw new Error('Missing activity');
    otherActivity.activityId = 'idle_at_home';
    otherActivity.lockedUntil = asGameMinute(0);
    f.incoming.base = { affection: -13, respect: 0, trust: 0, fear: 0 };
    f.incoming.reasons = [];
    const beforeInsult = f.read()?.band;
    const insult = f.session.act({
      kind: 'core.urge',
      actorId: f.pc,
      data: { urge: { kind: 'interaction', interactionId: 'insult', targetId: f.other } },
    });
    expect(insult.ok, insult.reason).toBe(true);
    target.placeId = pc.placeId;
    // The insult's roll depends on when in the hour it lands (minute budget); either outcome is a visible deed.
    const after = f.read();
    const reasons = after?.reasons.join(' ') ?? '';
    if (/Told .* what I think of them/.test(reasons)) expect(after?.band).not.toBe(beforeInsult);
    else expect(reasons).toMatch(/laughed off my words/);
  });
});
