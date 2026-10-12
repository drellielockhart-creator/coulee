/**
 * Regressions for the r2 persona playtests' fae-sign findings (PLAYTEST-TRIAGE-2026-10-11-r2
 * Tier 1 #6 and #7): no existence oracle, window-gated attempts, a bounded retry per window,
 * dead ends close, faded signs leave the open list, signature lines read as character, and
 * the text fixes.
 */
import { asGameMinute, fae, makeContext, rowsOf } from '@coulee/core';
import { PlaySession, renderDetail, sessionSim } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { resolveEpisode, snapshotWindow, windows } from '../../core/src/fae/episodes.ts';
import { NO_SUCH_SIGN, signWindow } from '../../core/src/fae/investigate.ts';
import { noticeEpisode } from '../../core/src/fae/omens.ts';
import { baseContent } from './helpers.ts';

function required<T>(x: T | undefined | null): T {
  if (x === undefined || x === null) throw new Error('fixture');
  return x;
}
const cmd = { kind: 'command' as const, issuer: { kind: 'player' as const } };

/** A true dawn episode at Lower Lantern Coulee on day 1, noticed by the PC standing there. */
function dawnSign(lead: 'nothing' | 'trace' = 'nothing', after = 40) {
  const sim = sessionSim(baseContent(), { source: 'iron_ford', seed: 42 });
  const id = required(sim.world.meta.playerId);
  const actor = required(sim.world.actors[id]);
  const place = required(rowsOf(sim.world.places).find((p) => p.defId === 'lower_coulee'));
  actor.placeId = place.id;
  actor.sheet.skills.perception = 40;
  actor.sheet.skills.lore_fae = -40; // the read fails: the question stays open for these tests
  const dawn = required(windows(place, 1).find((w) => w.window === 'dawn')).at;
  sim.world.time = asGameMinute(Math.ceil(dawn / 60) * 60);
  const ctx = makeContext(sim.world, sim.content, []);
  const snap = snapshotWindow(sim.world, ctx, place, 'dawn', dawn);
  const e = required(resolveEpisode(sim.world, ctx, { ...snap, trueRate: 1000, lookRate: 0 }));
  e.lead = lead === 'nothing' ? { kind: 'nothing', placeId: place.id } : { kind: 'trace', placeId: place.id };
  sim.world.fae.episodes[e.id] = e;
  noticeEpisode(sim.world, ctx, e);
  // Skills for the investigation itself (best of Woodcraft, Lore (Fae), Perception).
  actor.sheet.skills.perception = after;
  actor.sheet.skills.woodcraft = after;
  return { sim, id, actor, place, e };
}

describe('fae signs (r2 playtest regressions)', () => {
  it('investigating an unnoticed or nonexistent sign gives one generic refusal (no existence oracle)', () => {
    const { sim, id, e } = dawnSign();
    const other = required(rowsOf(sim.world.places).find((p) => p.defId === 'brenner_house'));
    const ctx = makeContext(sim.world, sim.content, []);
    const snap = snapshotWindow(sim.world, ctx, other, 'dawn', e.snapshot.at);
    const hidden = required(resolveEpisode(sim.world, ctx, { ...snap, trueRate: 1000, lookRate: 0 }));
    sim.world.fae.episodes[hidden.id] = hidden;
    const before = JSON.stringify(sim.world.fae);
    const unnoticed = fae.investigationEligibility(sim.world, id, hidden.id);
    const missing = fae.investigationEligibility(sim.world, id, '999:0:dawn');
    const word = fae.investigationEligibility(sim.world, id, 'glimmer');
    expect(unnoticed).toBe(NO_SUCH_SIGN);
    expect(missing).toBe(NO_SUCH_SIGN);
    expect(word).toBe(NO_SUCH_SIGN);
    expect(fae.investigate(sim.world, ctx, id, hidden.id, cmd)).toBe(false);
    const refused = sim.world.log.events.at(-1);
    expect(refused?.kind).toBe('fae.refused');
    expect(JSON.stringify(sim.world.fae)).toBe(before);
  });

  it('outside the sign’s window the attempt is refused at no cost, with when to come back', () => {
    const { sim, id, e } = dawnSign();
    sim.world.time = asGameMinute(e.snapshot.at - (e.snapshot.at % 1440) + 11 * 60);
    const reason = required(fae.investigationEligibility(sim.world, id, e.id));
    expect(reason).toMatch(/only shows at dawn; come back then \(from about \d\d:\d\d\)/);
    expect(e.attempts[id]).toBeUndefined();
    const s = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
    expect(s.act({ kind: 'fae.investigate', actorId: s.playerId, data: { signId: e.id } }).elapsedMinutes).toBe(0);
  });

  it('a failed reading may be retried once at each later window while the trace lasts, never twice in one', () => {
    const { sim, id, actor, e } = dawnSign('trace', -40);
    expect(fae.investigate(sim.world, makeContext(sim.world, sim.content, []), id, e.id, cmd)).toBe(true);
    expect(e.attempts[id]?.found).toBe(false);
    expect(fae.investigationEligibility(sim.world, id, e.id)).toContain('already this dawn');
    // Next day's dawn window: one more attempt, with its own roll key.
    const next = required(signWindow(sim.world, e, e.snapshot.at + 600).next);
    sim.world.time = asGameMinute(Math.ceil(next / 60) * 60);
    expect(signWindow(sim.world, e, sim.world.time).day).toBe(1);
    actor.sheet.skills.perception = 60;
    actor.sheet.skills.woodcraft = 60;
    expect(fae.investigationEligibility(sim.world, id, e.id)).toBeNull();
    expect(fae.investigate(sim.world, makeContext(sim.world, sim.content, []), id, e.id, cmd)).toBe(true);
    expect(e.tries?.[id]).toEqual([0, 1]);
    expect(e.attempts[id]?.found).toBe(true);
    expect(fae.investigationEligibility(sim.world, id, e.id)).not.toBeNull();
  });

  it('a dead end closes the question; faded signs leave the open list', () => {
    const { sim, id, e } = dawnSign('nothing');
    expect(fae.investigate(sim.world, makeContext(sim.world, sim.content, []), id, e.id, cmd)).toBe(true);
    expect(e.attempts[id]?.found).toBe(true);
    const q = required(fae.signs(sim.world, id).find((x) => x.signId === e.id));
    expect(q.closedAt).not.toBeNull();
    expect(q.evidence).toContain('nowhere further');
    expect(fae.investigationEligibility(sim.world, id, e.id)).toContain('already tested');
    // A faded, unsettled sign shows as faded and is not an "Open sign".
    const other = dawnSign('trace', -40);
    delete other.sim.world.fae.episodes[other.e.id];
    const faded = required(fae.signs(other.sim.world, other.id).find((x) => x.signId === other.e.id));
    expect(faded.available).toBe(false);
    expect(renderDetail([faded])).toContain('Faded');
    expect(fae.investigationEligibility(other.sim.world, other.id, other.e.id)).toBe(
      'That trace has faded; there is nothing left to follow.',
    );
  });

  it('a place’s signature reads as its standing character, not a sign', () => {
    const sim = sessionSim(baseContent(), { source: 'iron_ford', seed: 42 });
    const id = required(sim.world.meta.playerId);
    const p = required(sim.world.index.placeByDef.huldras_shelf);
    const layers = fae.describe(sim.world, sim.content, p, id);
    expect(layers.some((l) => l.startsWith('As always here: '))).toBe(true);
  });

  it('signs with nothing to show says so, and refusals are not double-punctuated', () => {
    const s = PlaySession.create(baseContent(), { source: 'iron_ford', seed: 42 });
    const r = s.act({ kind: 'fae.signs', actorId: s.playerId, data: {} });
    expect(renderDetail(r.detail)).toMatch(/^No signs or wonders yet/);
    expect(renderDetail(r.detail)).not.toContain('journal');
    expect(`${NO_SUCH_SIGN.replace(/[.\s]+$/, '')}. No game time spent.`).not.toContain('..');
  });
});
