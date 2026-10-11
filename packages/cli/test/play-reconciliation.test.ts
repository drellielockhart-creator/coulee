import {
  appendEvent,
  asGameMinute,
  belief,
  type Command,
  chronicle,
  type Explain,
  makeContext,
  provisions,
  psyche,
  rowsOf,
  social,
  toViewModel,
  trimLog,
  visibleExplain,
  type World,
} from '@coulee/core';
import { PlaySession, parseText } from '@coulee/play';
import { expect, it } from 'vitest';
import { processTells } from '../../core/src/belief/tells.ts';
import { actorByKey, baseContent, simFor } from './helpers.ts';

const content = baseContent();
const opts = (perspective: World['meta']['playerId']) => ({
  perspective,
  omniscient: false,
  includeExplain: true,
  recentChronicle: 1000,
});
function text(s: PlaySession, line: string) {
  const cmd = parseText(line, s.observe());
  if (typeof cmd === 'string') throw new Error(`${line}: ${cmd}`);
  const result = s.act(cmd);
  expect(result.ok, result.reason).toBe(true);
  return result;
}

it('module views hide remote actors, private traits, other minds and unheard beliefs', () => {
  const sim = simFor();
  const w = sim.world;
  const pc = actorByKey(sim, 'gussie_pratt'),
    hidden = actorByKey(sim, 'hester_fenn');
  const a = w.actors[pc],
    b = w.actors[hidden];
  if (!a || !b) throw new Error('fixture');
  expect(toViewModel(w, content, opts(pc)).actors.some((x) => x.id === hidden)).toBe(false);
  b.placeId = a.placeId;
  b.traits.push('SECRET TRAIT');
  const mind = w.psyche.byActor[hidden];
  if (mind) mind.personaTraits = [];
  const shown = toViewModel(w, content, opts(pc)).actors.find((x) => x.id === hidden);
  expect(shown?.people).toBe('Human');
  expect(shown?.traits).toEqual([]);
  expect(shown?.psyche.visible).toBe(false);
  expect(shown?.psyche.thoughts).toEqual([]);
  expect(JSON.stringify(shown)).not.toContain('SECRET TRAIT');
  expect(shown?.belief.beliefs).toEqual([]);
  expect(social.viewSocialActor(w, content, hidden, opts(pc)).memories).toEqual([]);
  expect(toViewModel(w, content, { ...opts(pc), omniscient: true }).actors.find((x) => x.id === hidden)?.people).toBe(
    'Shadow-faekin',
  );
});

it('global belief views reveal only Figures in the viewer’s own propositions and hide aggregate truth', () => {
  const sim = simFor();
  const w = sim.world;
  const pc = actorByKey(sim, 'gussie_pratt');
  w.belief.beliefsByHolder[pc] = [];
  expect(rowsOf(w.belief.figures).length).toBeGreaterThan(0);
  expect(belief.viewBeliefGlobal(w, content, opts(pc))).toEqual({ figures: [], persecutions: [], misfortune: 0 });
  expect(belief.viewBeliefGlobal(w, content, opts(null)).figures.length).toBeGreaterThan(0);
});

it('psyche explanations gate private children, including unconscious labels', () => {
  const sim = simFor({ hours: 1 });
  const w = sim.world;
  const pc = actorByKey(sim, 'gussie_pratt');
  const mind = w.psyche.byActor[pc];
  if (!mind?.chosen) throw new Error('fixture');
  const secret: Explain = {
    kind: 'formula',
    label: 'SECRET DEFENSE',
    subjects: [pc],
    knowledge: 'omniscient',
    terms: [],
    total: 1,
    outcome: 'chosen',
  };
  mind.chosen.explain = { ...secret, label: 'My decision', knowledge: 'self', children: [secret] };
  expect(JSON.stringify(psyche.viewPsycheActor(w, content, pc, opts(pc)))).not.toContain('SECRET DEFENSE');
  expect(JSON.stringify(psyche.viewPsycheActor(w, content, pc, opts(null)))).toContain('SECRET DEFENSE');
});

it('failed concealed-tell checks are omniscient at the source', () => {
  const sim = simFor();
  const w = sim.world;
  const pc = actorByKey(sim, 'gussie_pratt'),
    hidden = actorByKey(sim, 'hester_fenn');
  const target = w.actors[hidden],
    viewer = w.actors[pc];
  if (!target || !viewer) throw new Error('fixture');
  viewer.placeId = target.placeId;
  const tell = Object.values(content.suspicionTells)[0];
  if (!tell) throw new Error('tell');
  const c = {
    ...content,
    suspicionTells: {
      test: {
        ...tell,
        id: 'test',
        true_permille_per_hour: 1000,
        lookalike_permille_per_hour: 1000,
        min_fae_intensity: 0,
        place_tags_any: [],
        household_only: false,
        sabbath_only: false,
        hours: undefined,
        asleep: false,
        suppress: undefined,
        observe: { ...tell.observe, dc: 10000 },
      },
    },
  };
  processTells(w, makeContext(w, c, []));
  const failures = w.log.events.filter((e) => e.kind === 'belief.tell' && e.roles.some((r) => r.actor === pc));
  expect(failures.length).toBeGreaterThan(0);
  for (const e of failures) expect(visibleExplain(e.explain, pc)).toBeNull();
});

it('private journals remain private even when their source incident was public', () => {
  const sim = simFor({ hours: 24 });
  const w = sim.world;
  const pc = actorByKey(sim, 'gussie_pratt'),
    author = actorByKey(sim, 'hester_fenn');
  const base = w.chronicle.entries[0];
  if (!base) throw new Error('entry');
  const entry = {
    ...base,
    voice: 'journal' as const,
    authorId: author,
    knowledge: 'public' as const,
    text: 'PRIVATE JOURNAL',
    knownBy: [pc],
  };
  w.chronicle.entries = [entry];
  expect(chronicle.viewChronicleGlobal(w, content, opts(pc)).recent).toEqual([]);
  expect(chronicle.viewChronicleGlobal(w, content, opts(author)).recent[0]?.text).toBe('PRIVATE JOURNAL');
});

it('posted hours govern NPC purchases and sales, and beds/meals transfer real money', () => {
  const sim = simFor();
  const w = sim.world;
  const buyer = actorByKey(sim, 'amos_whitcomb');
  const a = w.actors[buyer];
  if (!a) throw new Error('buyer');
  const store = rowsOf(w.provisions.stores).find((s) => w.places[s.placeId]?.tags.includes('store'));
  if (!store) throw new Error('store');
  a.placeId = store.placeId;
  w.provisions.purses[buyer] = 500;
  w.time = asGameMinute(60);
  expect(provisions.purchase(w, makeContext(w, content, []), buyer, store.placeId, 'hardtack', 1, false)).toBe(0);
  w.time = asGameMinute(8 * 60);
  expect(provisions.purchase(w, makeContext(w, content, []), buyer, store.placeId, 'hardtack', 1, false)).toBe(1);
  const item = rowsOf(w.items.stacks).find(
    (s) => s.location.kind === 'actor' && s.location.actorId === buyer && s.defId === 'hardtack',
  );
  if (!item) throw new Error('item');
  w.time = asGameMinute(2 * 60);
  expect(provisions.sell(w, makeContext(w, content, []), buyer, store.placeId, item.id, 1)).toBe(false);
  const tavern = rowsOf(w.places).find((p) => p.tags.includes('tavern'));
  if (!tavern) throw new Error('tavern');
  a.placeId = tavern.id;
  w.time = asGameMinute(18 * 60);
  const total = () =>
    rowsOf(w.provisions.households).reduce((n, h) => n + h.cashCents, 0) +
    Object.values(w.provisions.purses).reduce((n, x) => n + x, 0);
  const before = total(),
    purse = w.provisions.purses[buyer] ?? 0;
  const ctx = makeContext(w, content, []);
  expect(provisions.admitSleep(w, ctx, buyer, tavern.id)).toBe(true);
  expect(provisions.admitSleep(w, ctx, buyer, tavern.id)).toBe(true);
  expect(w.provisions.purses[buyer]).toBe(purse - 25);
  expect(provisions.boardMeal(w, ctx, buyer)).toBe(true);
  expect(w.provisions.purses[buyer]).toBe(purse - 45);
  expect(total()).toBe(before);
  expect(w.log.events.some((e) => e.kind === 'provisions.meal' && e.data.actorId === buyer)).toBe(true);
});

it('play resolves the social catalog and retains PC knowledge across weeks, trimming, saves and forks', () => {
  let s = PlaySession.create(content, { source: 'iron_ford', seed: 42 });
  const saved = JSON.parse(s.save());
  const w = saved.world as World;
  const target = w.index.actorByKey.nora_dunleavy;
  if (!target) throw new Error('target');
  w.time = asGameMinute(10 * 60);
  const state = w.activity.byActor[target];
  if (!state) throw new Error('state');
  state.activityId = 'idle_at_home';
  state.lockedUntil = asGameMinute(24 * 60);
  s = PlaySession.load(content, JSON.stringify(saved));
  const interactionIds: number[] = [];
  for (const line of [
    'introduce Nora',
    'chat Nora',
    'ask about Nora',
    'gossip Nora',
    'insult Nora',
    'apologize Nora',
  ]) {
    const r = text(s, line);
    expect(r.warning, line).toBeUndefined();
    const events = (JSON.parse(s.save()).world as World).log.events.filter(
      (e) => e.kind === 'social.interaction' && e.data.initiatorId === s.playerId,
    );
    const e = events.at(-1);
    expect(e, line).toBeDefined();
    if (e) interactionIds.push(e.id);
  }
  expect(new Set(interactionIds).size).toBe(6);
  expect(s.observe().self.social.memories.length).toBeGreaterThan(0);
  expect(s.observe().self.social.opinions.some((o) => o.reasons.length > 0)).toBe(true);
  expect(s.observe().self.belief.beliefs.length).toBeGreaterThan(0);
  expect(s.observe().self.mind.chosen?.voice).toBe('Self-Command');
  expect(s.observe().self.mind.thoughts.some((t) => t.voice === 'Appetite')).toBe(true);
  const id = interactionIds[0];
  if (!id) throw new Error('interaction');
  const explanation = text(s, `explain ${id}`).detail;
  const boundary = JSON.parse(s.save());
  boundary.world.time = 22 * 1440;
  const midnight = PlaySession.load(content, JSON.stringify(boundary));
  text(midnight, 'sleep');
  const midnightSave = JSON.parse(midnight.save());
  expect(midnightSave.world.log.dropped).toBeGreaterThan(0);
  expect(midnight.observe().events.at(-1)?.id).toBeGreaterThan(boundary.world.log.lastId);
  expect(midnight.telemetry.at(-1)?.kcalBurned).toBeGreaterThan(0);
  const later = JSON.parse(s.save());
  const firstEntry = later.world.chronicle.entries[0];
  if (!firstEntry) throw new Error('chronicle fixture');
  later.world.chronicle.entries.push({
    ...firstEntry,
    id: 99999,
    voice: 'journal',
    authorId: s.playerId,
    knowledge: 'witnessed',
    knownBy: [s.playerId],
    sourceEventIds: [id],
    text: 'My first conversation with Nora.',
  });
  later.world.time += 21 * 1440;
  trimLog(later.world.log, later.world.time);
  expect(later.world.log.events.some((e: { id: number }) => e.id === id)).toBe(false);
  s = PlaySession.load(content, JSON.stringify(later));
  expect(text(s, `explain ${id}`).detail).toEqual(explanation);
  expect(JSON.stringify(text(s, 'journal').detail)).toContain('My first conversation with Nora.');
  expect(s.observe().rumors.length).toBeGreaterThan(0);
  const archive = JSON.parse(s.save()).knowledgeArchive;
  expect(JSON.stringify(archive).length).toBeLessThan(300_000);
  expect(s.fork().save()).toBe(s.save());
  expect(PlaySession.load(content, s.save()).save()).toBe(s.save());
  const before = s.observe().events;
  expect(before.length).toBeGreaterThan(0);
  expect(before.some((e) => e.kind === 'social.interaction')).toBe(true);
  // Midnight stepping trims the window; the fresh command's events still enter PC knowledge.
  const r = s.act({
    kind: 'core.urge',
    actorId: s.playerId,
    data: { urge: { kind: 'activity', activityId: 'sleep' } },
  } as Command);
  expect(r.ok).toBe(true);
  expect(s.observe().events.at(-1)?.id).toBeGreaterThan(before.at(-1)?.id ?? 0);
}, 120000);

it('does not report a spontaneous conversation as the requested interaction when the target leaves', () => {
  const s = PlaySession.create(content, { source: 'iron_ford', seed: 42 });
  text(s, 'go Pratt');
  text(s, 'sleep');
  while (s.observe().time.t < 420) s.advance(60);
  for (const command of [
    'chat Nora',
    'ask about Nora',
    'gossip Michael',
    'meal',
    'go Pratt',
    'buy hardtack 3',
    'chat Lydia',
  ])
    text(s, command);
  const r = text(s, 'insult Lydia');
  expect(r.warning).toContain('requested conversation did not take place');
  expect(r.detail).toBeUndefined();
  const w = JSON.parse(s.save()).world as World;
  expect(
    w.log.events.some(
      (e) =>
        e.t === 14 * 60 &&
        e.kind === 'social.interaction' &&
        e.data.initiatorId === s.playerId &&
        e.data.interactionId !== 'insult',
    ),
  ).toBe(true);
}, 120000);

it('a failed apology is not narrated as a reconciliation', () => {
  const sim = simFor();
  const w = sim.world;
  const pc = actorByKey(sim, 'gussie_pratt'),
    target = actorByKey(sim, 'johann_brenner');
  w.meta.playerId = pc;
  const place = w.actors[pc]?.placeId;
  if (!place) throw new Error('place');
  const id = appendEvent(
    w.log,
    {
      kind: 'social.interaction',
      importance: 100,
      place,
      visibility: 'public',
      roles: [
        { actor: pc, role: 'agent' },
        { actor: target, role: 'target' },
      ],
      data: {
        interactionId: 'apologize',
        initiatorId: pc,
        targetId: target,
        placeId: place,
        success: false,
        label: 'Apologize',
      },
    },
    w.time,
  );
  chronicle.chronicleSystem(w, makeContext(w, content, []));
  const entries = w.chronicle.entries.filter((e) => e.voice === 'journal' && e.sourceEventIds.includes(id));
  expect(entries.length).toBeGreaterThan(0);
  expect(entries.every((e) => e.templateId === 'journal_amends_failed')).toBe(true);
  expect(entries[0]?.text).toContain('did not mend');
});

it('preserves the append-only log and replay across a save/load after every command', () => {
  const continuous = PlaySession.create(content, { source: 'iron_ford', seed: 42 });
  let restored = continuous.fork();
  const commands = [
    'go Pratt',
    'sleep',
    'wait until 07:00',
    'chat Nora',
    'ask about Nora',
    'gossip Michael',
    'meal',
    'go Pratt',
    'buy hardtack 3',
    'chat Lydia',
  ];
  for (const line of commands) {
    const before = (JSON.parse(continuous.save()).world as World).log.events;
    const a = text(continuous, line),
      b = text(restored, line);
    expect(a.ok).toBe(b.ok);
    expect(restored.hash, line).toBe(continuous.hash);
    const after = (JSON.parse(continuous.save()).world as World).log.events;
    expect(
      after.filter((e) => e.id <= (before.at(-1)?.id ?? 0)),
      line,
    ).toEqual(before);
    restored = PlaySession.load(content, restored.save());
  }
  expect(PlaySession.replay(content, restored.commandLog).save()).toBe(restored.save());
}, 120000);
