import {
  asGameMinute,
  fae,
  findNonIntegers,
  makeContext,
  psyche,
  restoreSim,
  rowsOf,
  runHours,
  stateHash,
  step,
} from '@coulee/core';
import { PlaySession, sessionSim } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { fadeNotoriety } from '../../core/src/chronicle/notability.ts';
import { omenEntries } from '../../core/src/chronicle/omens.ts';
import { makeDetectCtx } from '../../core/src/chronicle/system.ts';
import { resolveEpisode, snapshotWindow } from '../../core/src/fae/episodes.ts';
import { noticeEpisode } from '../../core/src/fae/omens.ts';
import { baseContent, simFor } from './helpers.ts';

function required<T>(x: T | undefined | null): T {
  if (x === undefined || x === null) throw new Error('fixture');
  return x;
}
function episode(sim: ReturnType<typeof simFor>, placeKey = 'lower_coulee') {
  const p = required(sim.world.places[required(sim.world.index.placeByDef[placeKey])]);
  const ctx = makeContext(sim.world, sim.content, []);
  const snap = snapshotWindow(sim.world, ctx, p, 'dusk', 1000);
  return required(resolveEpisode(sim.world, ctx, { ...snap, trueRate: 1000, lookRate: 0 }));
}
describe('fae slice 1a', () => {
  it('omen prose survives repeat cleanup, caps each period and rotates templates across a year', () => {
    const sim = simFor({ seed: 42 });
    const e = episode(sim);
    const witnesses = rowsOf(sim.world.actors)
      .slice(0, 3)
      .map((a) => a.id);
    for (const id of witnesses) {
      const a = required(sim.world.actors[id]);
      a.placeId = e.snapshot.placeId;
      a.sheet.skills.perception = 30;
    }
    noticeEpisode(sim.world, makeContext(sim.world, sim.content, []), e);
    const ev = sim.world.log.events.find((x) => x.kind === 'fae.omen');
    if (ev?.kind !== 'fae.omen') throw new Error('missing omen fixture');
    for (let day = 0; day < 365; day++) {
      sim.world.time = asGameMinute(day * 1440);
      fadeNotoriety(sim.world.chronicle, sim.world.time, 14);
      const dc = makeDetectCtx(sim.world, makeContext(sim.world, sim.content, []));
      omenEntries(dc, { ...ev, t: sim.world.time });
      omenEntries(dc, { ...ev, t: sim.world.time });
    }
    const lines = sim.world.chronicle.entries.filter((x) => x.templateId?.startsWith('omen_'));
    expect(lines.filter((x) => x.voice === 'almanac')).toHaveLength(53);
    expect(lines.filter((x) => x.voice === 'paper')).toHaveLength(53);
    const counts: Record<string, number> = {};
    for (const line of lines) counts[line.templateId ?? ''] = (counts[line.templateId ?? ''] ?? 0) + 1;
    expect(Math.max(...Object.values(counts)) / lines.length).toBeLessThanOrEqual(0.1);
  });
  it('canonical-time resolution ignores the evaluation hour; saved snapshots include all rate terms', () => {
    const sim = simFor({ seed: 42 }),
      e = episode(sim);
    const s = e.snapshot;
    const first = resolveEpisode(sim.world, makeContext(sim.world, sim.content, []), s);
    sim.world.time = asGameMinute(2880);
    expect(resolveEpisode(sim.world, makeContext(sim.world, sim.content, []), s)).toEqual(first);
  });
  it('save/load and forks retain episodes, observer attempts and integer world hashes', () => {
    const sim = simFor({ seed: 42 });
    runHours(sim, 30);
    const restored = restoreSim(sim.content, JSON.parse(JSON.stringify(sim.world)));
    runHours(sim, 8);
    runHours(restored, 8);
    expect(stateHash(restored.world)).toBe(stateHash(sim.world));
    expect(findNonIntegers(sim.world)).toEqual([]);
    expect(Object.keys(sim.world.fae.episodes).length).toBeGreaterThan(0);
  });
  it('observer sampling is independent of table insertion order and never repeats a notice', () => {
    const sim = simFor({ seed: 42 });
    const e = episode(sim);
    sim.world.fae.episodes[e.id] = e;
    for (const a of rowsOf(sim.world.actors).slice(0, 3)) {
      a.placeId = e.snapshot.placeId;
      a.sheet.skills.perception = 30;
    }
    const second = restoreSim(sim.content, JSON.parse(JSON.stringify(sim.world)));
    second.world.actors = Object.fromEntries(Object.entries(second.world.actors).reverse());
    noticeEpisode(sim.world, makeContext(sim.world, sim.content, []), e);
    noticeEpisode(
      second.world,
      makeContext(second.world, second.content, []),
      required(second.world.fae.episodes[e.id]),
    );
    expect(stateHash(second.world)).toBe(stateHash(sim.world));
    const before = JSON.stringify(e.observers);
    noticeEpisode(sim.world, makeContext(sim.world, sim.content, []), e);
    expect(JSON.stringify(e.observers)).toBe(before);
  });
  it('protected tags override spring, court and seasonal intensity; no signatures or output', () => {
    for (const tags of [['protected', 'spring'], ['mound'], ['fae_barrow', 'mound']]) {
      const sim = simFor();
      const p = required(rowsOf(sim.world.places)[0]);
      p.tags = tags;
      p.faeIntensity = 5;
      expect(fae.effectiveFi(sim.world, p)).toBe(0);
      expect(fae.describe(sim.world, sim.content, p.id, null)).toHaveLength(3);
      const ctx = makeContext(sim.world, sim.content, []);
      expect(
        resolveEpisode(sim.world, ctx, { ...snapshotWindow(sim.world, ctx, p, 'dusk', 1000), trueRate: 950 }),
      ).toBeNull();
    }
  });
  it('unwitnessed true episodes cannot thin a place, form beliefs or rumor', () => {
    const sim = simFor();
    const e = episode(sim);
    sim.world.fae.episodes[e.id] = e;
    const prior = JSON.stringify(sim.world.belief);
    for (const a of rowsOf(sim.world.actors))
      if (a.placeId === e.snapshot.placeId) a.placeId = required(sim.world.index.placeByDef.dunleavys_tavern);
    noticeEpisode(sim.world, makeContext(sim.world, sim.content, []), e);
    expect(e.witnessed).toBe(false);
    expect(sim.world.fae.thinning[e.snapshot.placeId] ?? 0).toBe(0);
    expect(JSON.stringify(sim.world.belief)).toBe(prior);
  });
  it('Cold Stair admits only Ice and FI zero has no true episode rate', () => {
    const sim = simFor();
    const p = required(sim.world.places[required(sim.world.index.placeByDef.cold_stair)]);
    expect(p.faeIntensity).toBe(1);
    const ctx = makeContext(sim.world, sim.content, []);
    expect(snapshotWindow(sim.world, ctx, p, 'dusk', 2500).families).toEqual(['ice']);
    sim.world.fae.fiShift = -10;
    for (const place of rowsOf(sim.world.places)) {
      const s = snapshotWindow(sim.world, ctx, place, 'dusk', 2500);
      expect(s.trueRate).toBe(0);
      expect(s.families.every((x) => x === 'providence')).toBe(true);
    }
  });
  it('Sabbath suppression uses actual bell ranges and disappears when the range is removed', () => {
    const sim = simFor(),
      p = required(sim.world.places[required(sim.world.index.placeByDef.lutheran_church)]);
    const near = required(
      rowsOf(sim.world.places).find(
        (q) => q.id !== p.id && Math.abs(q.x - p.x) + Math.abs(q.y - p.y) < 12 && !q.tags.includes('church'),
      ),
    );
    const ctx = makeContext(sim.world, sim.content, []);
    expect(snapshotWindow(sim.world, ctx, near, 'noon', 720).trueRate).toBe(0);
    const content = structuredClone(sim.content);
    for (const place of Object.values(content.places)) delete place.bell_range_tiles;
    const s = snapshotWindow(sim.world, makeContext(sim.world, content, []), near, 'noon', 720);
    expect(s.bells).toBe(false);
    expect(s.trueRate + s.lookRate).toBeGreaterThan(0);
  });
  it('investigation caches each actor attempt and shares one lead across the party', () => {
    const sim = simFor({ seed: 42 });
    const e = episode(sim);
    sim.world.fae.episodes[e.id] = e;
    const actors = rowsOf(sim.world.actors).slice(0, 3);
    for (const a of actors) {
      a.placeId = e.snapshot.placeId;
      a.sheet.skills.perception = 30;
    }
    const ctx = makeContext(sim.world, sim.content, []);
    noticeEpisode(sim.world, ctx, e);
    const lead = JSON.stringify(e.lead);
    for (const a of actors) {
      expect(fae.investigate(sim.world, ctx, a.id, e.id, { kind: 'own' })).toBe(true);
      const hash = stateHash(sim.world);
      expect(fae.investigate(sim.world, ctx, a.id, e.id, { kind: 'own' })).toBe(false);
      expect(stateHash(sim.world)).toBe(hash);
    }
    expect(JSON.stringify(e.lead)).toBe(lead);
  });
  it('descriptions have stable base and skill-gated signatures without view mutation', () => {
    const sim = simFor();
    const id = required(rowsOf(sim.world.actors)[0]).id;
    const p = required(sim.world.index.placeByDef.huldras_shelf);
    const a = required(sim.world.actors[id]);
    a.sheet.skills.lore_fae = 0;
    const before = stateHash(sim.world),
      low = fae.describe(sim.world, sim.content, p, id);
    expect(stateHash(sim.world)).toBe(before);
    expect(low.length).toBeGreaterThanOrEqual(3);
    a.sheet.skills.lore_fae = 4;
    const high = fae.describe(sim.world, sim.content, p, id);
    expect(high).not.toEqual(low);
    expect(high[0]).toBe(low[0]);
    sim.world.time = asGameMinute(1440);
    expect(fae.describe(sim.world, sim.content, p, id)[0]).toBe(low[0]);
  });
  it('commands require the agency issuer and standing capabilities never authorize unrelated acts', () => {
    const sim = sessionSim(baseContent(), { source: 'iron_ford', seed: 42 }),
      id = required(sim.world.meta.playerId);
    expect(psyche.authorizeAct(sim.world, id, { kind: 'gift' }, { kind: 'standing', capability: 'sleep' }).ok).toBe(
      false,
    );
    const state = psyche.agencyOf(sim.world, id);
    psyche.setAgency(sim.world, id, { ...state, issuer: { kind: 'actor', id } });
    expect(
      psyche.authorizeAct(sim.world, id, { kind: 'gift' }, { kind: 'command', issuer: { kind: 'player' } }).ok,
    ).toBe(false);
    expect(
      psyche.authorizeAct(sim.world, id, { kind: 'gift' }, { kind: 'command', issuer: { kind: 'actor', id } }).ok,
    ).toBe(true);
  });
  it('headless signs and ineligible investigations consume no time and fork identically', () => {
    const s = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
    expect(s.act({ kind: 'fae.signs', actorId: s.playerId, data: {} }).elapsedMinutes).toBe(0);
    const before = s.hash;
    expect(s.act({ kind: 'fae.investigate', actorId: s.playerId, data: { signId: 'missing' } }).elapsedMinutes).toBe(0);
    expect(s.hash).toBe(before);
    expect(s.fork().hash).toBe(s.hash);
  });
  it('64 seeds of commanded omen thoughts never execute a consequential act', () => {
    for (let seed = 1; seed <= 64; seed++) {
      const sim = sessionSim(baseContent(), { source: 'iron_ford', seed }),
        id = required(sim.world.meta.playerId);
      const e = episode(sim);
      sim.world.fae.episodes[e.id] = e;
      const a = required(sim.world.actors[id]);
      a.placeId = e.snapshot.placeId;
      a.sheet.skills.perception = 30;
      noticeEpisode(sim.world, makeContext(sim.world, sim.content, []), e);
      step(sim);
      expect(psyche.authorizeAct(sim.world, id, { kind: 'attack' }, { kind: 'own' }).ok).toBe(false);
      expect(sim.world.log.events.some((x) => x.kind === 'social.interaction' && x.data.initiatorId === id)).toBe(
        false,
      );
    }
  }, 60000);
});
