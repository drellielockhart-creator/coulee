/**
 * Betrayal (05 §9.2): someone helped is later the one who harms the helper. Order matters
 * (help, then harm); a stranger's harm, or harm that came first, is not a betrayal.
 * A grudge the helper forms against the helped afterwards deepens it. OWNER: module:chronicle.
 */
import type { ActorId } from '../../ids.ts';
import { areKin } from '../../social/api.ts';
import { classVocab, type Fact } from '../facts.ts';
import type { PatternParams } from '../params.ts';
import type { ThreadFact } from '../state.ts';
import { numberWord } from '../text.ts';
import type { Accept, DetectCtx, PatternDef } from './types.ts';
import { accept, DAY, householdOfActor, ofKind, sortedByTime, spanWords, tfOf } from './util.ts';

/** How much `from` likes `to` right now (base + reasons + the day's mood), from the social slice. */
function affectionOf(dc: DetectCtx, from: number, to: number): number {
  const o = dc.world.social?.opinions?.[from as ActorId]?.[to as ActorId];
  if (!o) return 0;
  return o.base.affection + o.volatile.affection + o.reasons.reduce((s, r) => s + r.delta.affection, 0);
}

/** The first meaningful help that is followed, inside the window, by harm from the one helped. */
function firstHelpBeforeHarm(facts: readonly ThreadFact[], windowDays: number, trustFloor: number) {
  const ordered = sortedByTime(facts);
  let help: ThreadFact | undefined;
  for (const f of ordered) {
    // 04 §9.2: the helper held the helped in some regard (opinion > floor) when the help was given.
    if (f.k === 'help' && !help && f.w >= trustFloor) help = f;
    if (f.k === 'harm' && help && f.t > help.t && f.t - help.t <= windowDays * DAY) {
      return { help, harm: f };
    }
  }
  return null;
}

function severe(p: PatternParams, f: ThreadFact): boolean {
  return f.w >= 2 || p.l('severe_ids', ['fight', 'attack', 'steal', 'accuse', 'slander', 'curse']).includes(f.x);
}

export const betrayal: PatternDef = {
  id: 'betrayal',
  topic: 'betrayal',
  importance: 50,
  balladLevel: 2,
  suppressSingles: false,

  accept(f: Fact, dc: DetectCtx, p: PatternParams): Accept[] {
    // key: the helper first, then the helped.
    const helpIds = p.l('help_ids', ['help', 'gift', 'lend']);
    const harmIds = p.l('harm_ids', ['insult', 'fight', 'threaten', 'steal', 'accuse', 'slander', 'curse', 'attack']);
    const isHelp = (f.cls === 'help' || f.cls === 'debt') && helpIds.includes(f.sub);
    // Help under one roof is housekeeping: spouses and a mother and son help each other daily,
    // so any spat after it is no betrayal. Kin in other houses can be betrayed, but only by a
    // grave harm (a fight, an accusation) or a grudge, not by a sharp word.
    const household = f.agent > 0 && f.target > 0 && householdOfActor(dc, f.agent) === householdOfActor(dc, f.target);
    if (household) return [];
    const kin = f.agent > 0 && f.target > 0 && areKin(dc.world, f.agent as ActorId, f.target as ActorId);
    if (isHelp && f.agent && f.target && f.success !== false) {
      return [
        accept(`${f.agent}>${f.target}`, tfOf(f, 'help', { w: affectionOf(dc, f.agent, f.target) }), {
          actors: [f.agent, f.target],
          tags: { helper: String(f.agent), helped: String(f.target) },
        }),
      ];
    }
    if (f.cls === 'harm' && harmIds.includes(f.sub) && f.agent && f.target && f.success !== false) {
      const w = p.l('severe_ids', ['fight', 'attack', 'steal', 'accuse', 'slander', 'curse']).includes(f.sub) ? 2 : 1;
      if (kin && w < 2) return [];
      return [
        accept(`${f.target}>${f.agent}`, tfOf(f, 'harm', { w }), {
          actors: [f.target, f.agent],
          tags: { helper: String(f.target), helped: String(f.agent) },
        }),
      ];
    }
    if (f.cls === 'grudge' && f.agent && f.target) {
      return [
        accept(`${f.agent}>${f.target}`, tfOf(f, 'grudge'), {
          actors: [f.agent, f.target],
          tags: { helper: String(f.agent), helped: String(f.target) },
        }),
      ];
    }
    return [];
  },

  level(facts, _th, _dc, p) {
    const m = firstHelpBeforeHarm(facts, p.n('window_days', 90), p.n('trust_floor', 25));
    if (!m) return 0;
    const after = facts.filter((f) => f.t >= m.harm.t);
    const grudge = after.some((f) => f.k === 'grudge');
    if (grudge || after.some((f) => f.k === 'harm' && severe(p, f))) return 2;
    return 1;
  },

  cast(facts) {
    // betrayer first, the one betrayed second
    const harm = ofKind(facts, 'harm')[0];
    if (harm) return [harm.a, harm.b];
    const help = ofKind(facts, 'help')[0];
    return help ? [help.b, help.a] : [];
  },

  bind(facts, _th, level, dc, p) {
    const m = firstHelpBeforeHarm(facts, p.n('window_days', 90), p.n('trust_floor', 25));
    const helps = ofKind(facts, 'help').length;
    const out: Record<string, string | number | boolean> = {
      count: helps,
      count_word: numberWord(helps),
      span: m ? spanWords(m.help.t, m.harm.t) : 'a while',
      kind: m && severe(p, m.harm) ? 'grave' : 'cold',
    };
    if (m) {
      const harmId = m.harm.x;
      const vocab = classVocab(dc.params('notability', 0));
      out.interaction = harmId;
      out.interaction_name = dc.content.interactions?.[harmId]?.name?.toLowerCase() ?? harmId.replace(/_/g, ' ');
      out.act = vocab.verb(harmId)[0] ?? 'wronged';
      out.act_pp = vocab.verb(harmId)[2] ?? vocab.verb(harmId)[0] ?? 'wronged';
      const helpId = m.help.x;
      out.favor = vocab.verb(helpId)[0] ?? 'helped';
    }
    void level;
    return out;
  },

  importanceAt(level, _th, p) {
    return level >= 2 ? p.importance + 10 : p.importance - 10;
  },

  valence() {
    return -70;
  },

  stale(th, dc, p) {
    return (dc.ctx.now as number) - th.lastAt > p.n('quiet_days', 60) * DAY;
  },
};
