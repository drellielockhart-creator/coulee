/**
 * Scapegoat (05 §9.2, 10 §7): suspicion lands on someone because a mind needed somewhere to
 * put its own trouble: a projection or a displacement aimed at them, then the community's
 * escalation ladder climbing against the same person. The town sees only the climb (that is
 * the paper's and the rumor patterns' story); the defense is inner, so this pattern is told
 * from the omniscient view, and to the player only for their own mind. OWNER: module:chronicle.
 */
import type { Fact } from '../facts.ts';
import type { PatternParams } from '../params.ts';
import type { ThreadFact } from '../state.ts';
import { numberWord } from '../text.ts';
import type { Accept, DetectCtx, PatternDef } from './types.ts';
import { accept, DAY, ofKind, sortedByTime, tfOf } from './util.ts';
import { insiderOf } from './whispers.ts';

function defenses(facts: readonly ThreadFact[]): ThreadFact[] {
  return sortedByTime(ofKind(facts, 'defense'));
}

function rungAfter(facts: readonly ThreadFact[]): number {
  const first = defenses(facts)[0];
  if (!first) return 0;
  let rung = 0;
  for (const f of facts) if (f.k === 'rung' && f.t >= first.t) rung = Math.max(rung, f.w);
  return rung;
}

export const scapegoat: PatternDef = {
  id: 'scapegoat',
  topic: 'scapegoat',
  importance: 55,
  alwaysAll: true,
  balladLevel: 3,
  suppressSingles: false,
  closingLevel: 2,

  accept(f: Fact, dc: DetectCtx, p: PatternParams): Accept[] {
    if (
      f.cls === 'defense' &&
      f.agent &&
      f.target &&
      p.l('scapegoat_defenses', ['projection', 'displacement']).includes(f.sub) &&
      // A mother short with her own daughter does not start the village's whispers about her:
      // only a mind outside the target's house and blood can be where the talk began.
      !insiderOf(dc, f.target)(f.agent)
    ) {
      return [
        accept(`t${f.target}`, tfOf(f, 'defense'), { actors: [f.target, f.agent], tags: { target: String(f.target) } }),
      ];
    }
    if (f.cls === 'escalation' && f.subject && f.weight >= 1) {
      return [accept(`t${f.subject}`, tfOf(f, 'rung', { a: f.subject, b: 0, w: f.weight }), { actors: [f.subject] })];
    }
    return [];
  },

  level(facts) {
    const d = defenses(facts);
    if (d.length === 0) return 0;
    const rung = rungAfter(facts);
    if (rung >= 2) return 3;
    if (rung >= 1) return 2;
    return 1;
  },

  cast(facts, th) {
    const target = Number(th.tags.target ?? 0);
    const d = defenses(facts)[0];
    return [target, d?.a ?? 0].filter((x) => x > 0);
  },

  bind(facts, th, level, dc) {
    const d = defenses(facts);
    // Ground truth (this pattern is omniscient): was the suspected one what the talk said?
    const subject = dc.world.actors[Number(th.tags.target ?? 0) as never];
    const hiddenKin = subject ? subject.ancestryId !== subject.presentsAsId : false;
    const first = d[0];
    const names = first
      ? (dc.content.defenses?.[first.x as never] as { name?: string; period_label?: string } | undefined)
      : undefined;
    const rung = rungAfter(facts);
    return {
      defense: first?.x ?? '',
      defense_name: (names?.period_label ?? names?.name ?? '').toLowerCase(),
      defense_clinical: (names?.name ?? '').toLowerCase(),
      count: d.length,
      count_word: numberWord(d.length),
      rung,
      rung_name: rung >= 2 ? 'accusation' : rung >= 1 ? 'whispers' : '',
      truth: true,
      hidden_kin: hiddenKin,
      level_word: level >= 3 ? 'named' : level === 2 ? 'whispered' : 'chosen',
    };
  },

  importanceAt(level, _th, p) {
    // The seed (a defense with nobody yet talking) is not a story, only a thread.
    return level >= 3 ? p.importance + 18 : level === 2 ? p.importance : 0;
  },

  valence() {
    return -75;
  },

  stale(th, dc, p) {
    return (dc.ctx.now as number) - th.lastAt > p.n('quiet_days', 45) * DAY;
  },
};
