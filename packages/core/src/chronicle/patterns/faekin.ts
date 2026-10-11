/**
 * Faekin suspicion (05 §9.2, S6, P7): the hidden folk, a witch, a trader with the Fair Folk:
 * talk that someone is not what they seem. Keyed by the person it is about. The partial
 * match is a single believer; the story is how many, and the climb of the town's ladder
 * against them (unease, whispers, a public accusation, a shunning). Which claims count is
 * data: a predicate marked supernatural, or one that asserts a people. OWNER: module:chronicle.
 */
import type { ActorId } from '../../ids.ts';
import type { Fact } from '../facts.ts';
import { predOfProp, pronounsOf, shortNameOf } from '../names.ts';
import type { PatternParams } from '../params.ts';
import type { ThreadFact } from '../state.ts';
import { numberWord } from '../text.ts';
import type { Accept, DetectCtx, PatternDef } from './types.ts';
import { accept, DAY, ofKind, sortedByTime, spanWords, tfOf } from './util.ts';
import { holdersOf, isSupernatural } from './whispers.ts';

function rungOf(facts: readonly ThreadFact[]): number {
  let r = 0;
  for (const f of facts) if (f.k === 'rung') r = Math.max(r, f.w);
  return r;
}

function levelFor(n: number, rung: number, p: PatternParams): number {
  if (rung >= 2) return 4;
  if (rung >= 1 || n >= p.n('town_holders', 6)) return 3;
  if (n >= p.n('talk_holders', 3)) return 2;
  if (n >= 1) return 1;
  return 0;
}

export const faekinSuspicion: PatternDef = {
  id: 'faekin_suspicion',
  topic: 'suspicion',
  importance: 55,
  balladLevel: 3,
  suppressSingles: true,
  closingLevel: 2,
  publicFrom: 2,
  publicActors(th) {
    const s = Number(th.tags.subject ?? 0);
    return s > 0 ? [s] : [];
  },

  accept(f: Fact, dc: DetectCtx): Accept[] {
    if (f.cls === 'escalation' && f.subject && f.ev.kind === 'belief.escalation') {
      // Only a climb on a fae charge belongs to this story; a thief's shunning is the Paper's own.
      const persecution = dc.world.belief?.persecutions?.find(
        (x) => x.target.kind === 'actor' && x.target.id === f.subject,
      );
      const fae = persecution
        ? persecution.charges.some((c) => isSupernatural(dc, predOfProp(dc.world, c)))
        : dc.world.chronicle.threads.some((t) => t.pattern === 'faekin_suspicion' && t.key === `s${f.subject}`);
      if (!fae) return [];
      return [
        accept(`s${f.subject}`, tfOf(f, 'rung', { a: f.subject, b: 0, w: f.weight }), {
          actors: [f.subject],
          tags: { subject: String(f.subject) },
        }),
      ];
    }
    if (f.cls === 'reveal' && f.subject) {
      // The town has made up its mind about what the person is: the top of the ladder.
      return [
        accept(`s${f.subject}`, tfOf(f, 'rung', { a: f.subject, b: 0, w: 3 }), {
          actors: [f.subject],
          tags: { subject: String(f.subject), rumor: String(f.bind.rumor ?? ''), pred: f.sub },
        }),
      ];
    }
    if ((f.cls !== 'transmit' && f.cls !== 'belief') || !f.subject) return [];
    if (!isSupernatural(dc, f.sub)) return [];
    const tags = { subject: String(f.subject), rumor: String(f.bind.rumor ?? ''), pred: f.sub };
    if (f.cls === 'transmit') {
      return [
        accept(`s${f.subject}`, tfOf(f, f.success ? 'told' : 'refused'), {
          actors: [f.subject, f.agent, f.target],
          tags,
        }),
      ];
    }
    return [accept(`s${f.subject}`, tfOf(f, 'held'), { actors: [f.subject, f.agent], tags })];
  },

  level(facts, _th, _dc, p: PatternParams) {
    return levelFor(holdersOf(facts).length, rungOf(facts), p);
  },

  townLevel(facts, _th, _dc, p: PatternParams) {
    return levelFor(holdersOf(facts, true).length, rungOf(facts), p);
  },

  cast(_facts, th) {
    const s = Number(th.tags.subject ?? 0);
    return s > 0 ? [s] : [];
  },

  bind(facts, th, level, dc, _p, view) {
    // When the town's ladder climbs before anyone is heard saying why, the claim is the plain one.
    const sid = Number(th.tags.subject ?? 0);
    const out: Record<string, string | number | boolean> = {
      named: Number(th.tags.subject ?? 0) > 0,
      rumor:
        th.tags.rumor ||
        `${shortNameOf(dc.world, sid)} is not what ${pronounsOf(dc.world.actors[sid as ActorId]).he} seems`,
      pred: th.tags.pred ?? '',
      level_word: level >= 4 ? 'accused' : level === 3 ? 'shunned' : level === 2 ? 'whispered' : 'doubted',
    };
    // Ground truth is the epilogue's alone: the town only has its suspicion.
    const subject = dc.world.actors[Number(th.tags.subject ?? 0) as ActorId];
    if (view === 'all' && subject) out.hidden_kin = subject.ancestryId !== subject.presentsAsId;
    const rung = rungOf(facts);
    if (rung > 0) {
      out.rung = rung;
      const name = Object.values(dc.content.persecutionRungs ?? {}).find((r) => r.rung === rung)?.name;
      out.rung_name = (name ?? '').toLowerCase();
    }
    if (facts.length === 0) return out;
    const n = holdersOf(facts).length;
    const told = sortedByTime(ofKind(facts, 'told'));
    const first = told[0];
    const last = told[told.length - 1];
    out.holders = n;
    out.count = n;
    out.count_word = numberWord(n);
    out.span = first && last ? spanWords(first.t, last.t) : 'some days';
    return out;
  },

  importanceAt(level, _th, p) {
    return level >= 4
      ? p.importance + 30
      : level === 3
        ? p.importance + 18
        : level === 2
          ? p.importance + 2
          : p.importance - 18;
  },

  valence() {
    return -60;
  },

  stale(th, dc, p) {
    return (dc.ctx.now as number) - th.lastAt > p.n('quiet_days', 30) * DAY;
  },
};
