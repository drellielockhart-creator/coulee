/**
 * Feud (05 §9.2): a chain of harm alternating between two households (or two people with no
 * household). A one-sided run of harm is not a feud (that is a grievance, or a bully); the
 * story needs both sides to give as good as they get. OWNER: module:chronicle.
 */
import type { Fact } from '../facts.ts';
import type { PatternParams } from '../params.ts';
import type { ChronicleThread, ThreadFact } from '../state.ts';
import { numberWord } from '../text.ts';
import type { Accept, DetectCtx, PatternDef } from './types.ts';
import { accept, DAY, householdOfActor, ofKind, pairKey, sideNames, sortedByTime, spanWords, tfOf } from './util.ts';

interface Run {
  harms: ThreadFact[];
  turns: number;
  rung: number;
}

function sideOf(x: string): string {
  return x.split('|')[0] ?? '';
}

function rungOf(p: PatternParams, interaction: string): number {
  if (p.l('violent_ids', ['fight', 'attack']).includes(interaction)) return 3;
  if (p.l('menace_ids', ['threaten', 'curse']).includes(interaction)) return 2;
  return 1;
}

function run(facts: readonly ThreadFact[], p: PatternParams): Run {
  const harms = sortedByTime(ofKind(facts, 'harm'));
  const last = harms[harms.length - 1];
  if (!last) return { harms: [], turns: 0, rung: 0 };
  const windowMin = p.n('window_days', 45) * DAY;
  const recent = harms.filter((h) => last.t - h.t <= windowMin);
  let turns = 0;
  let rung = 0;
  recent.forEach((h, i) => {
    const prev = recent[i - 1];
    if (prev && sideOf(prev.x) !== sideOf(h.x)) turns += 1;
    rung = Math.max(rung, h.w);
  });
  return { harms: recent, turns, rung };
}

function stage(level: number): string {
  return level >= 3 ? 'war' : level === 2 ? 'feud' : 'quarrel';
}

export const feud: PatternDef = {
  id: 'feud',
  topic: 'feud',
  importance: 55,
  balladLevel: 3,
  suppressSingles: true,
  closingLevel: 2,

  accept(f: Fact, dc: DetectCtx, p: PatternParams): Accept[] {
    if (f.cls !== 'harm' || !f.agent || !f.target || f.success === false) return [];
    const ha = householdOfActor(dc, f.agent);
    const hb = householdOfActor(dc, f.target);
    if (ha > 0 && ha === hb) return []; // a family quarrel is not a feud between houses
    const useH = ha > 0 && hb > 0;
    const side = useH ? `h${ha}` : `a${f.agent}`;
    const key = useH ? `h${pairKey(ha, hb)}` : `a${pairKey(f.agent, f.target)}`;
    const sideB = useH ? `h${hb}` : `a${f.target}`;
    return [
      accept(key, tfOf(f, 'harm', { x: `${side}|${f.sub}`, w: rungOf(p, f.sub) }), {
        actors: [f.agent, f.target],
        households: useH ? [ha, hb] : [],
        tags: {
          pa: ha <= hb && useH ? side : !useH && f.agent <= f.target ? side : sideB,
          pb: ha <= hb && useH ? sideB : !useH && f.agent <= f.target ? sideB : side,
        },
      }),
    ];
  },

  level(facts, _th, _dc, p) {
    const r = run(facts, p);
    const n = r.harms.length;
    if (n >= p.n('war_harms', 5) && r.turns >= p.n('war_turns', 3) && (r.rung >= 2 || n >= p.n('war_harms_any', 7))) {
      return 3;
    }
    if (n >= p.n('feud_harms', 3) && r.turns >= p.n('feud_turns', 2)) return 2;
    if (n >= 2 && r.turns >= 1) return 1;
    return 0;
  },

  cast(facts) {
    const last = sortedByTime(ofKind(facts, 'harm')).pop();
    return last ? [last.a, last.b] : [];
  },

  bind(facts, th, level, dc, p) {
    const r = run(facts, p);
    const first = r.harms[0];
    const last = r.harms[r.harms.length - 1];
    const pa = th.tags.pa ?? 'a0';
    const pb = th.tags.pb ?? 'a0';
    const sa = first ? sideOf(first.x) : pa;
    const sb = sa === pa ? pb : pa;
    const toNames = (s: string) => sideNames(dc, Number(s.slice(1)), s.startsWith('h'));
    const A = toNames(sa);
    const B = toNames(sb);
    const interaction = (last?.x ?? '').split('|')[1] ?? '';
    // The diarist's own house is a side: the journal cannot claim to keep out of it.
    const pc = dc.pcId;
    const pcSide = pc > 0 ? [`a${pc}`, `h${householdOfActor(dc, pc)}`] : [];
    const meA = pcSide.includes(sa);
    const meB = pcSide.includes(sb);
    return {
      me: meA || meB,
      other_families: meA ? B.families : A.families,
      stage: stage(level),
      family: A.family,
      family_b: B.family,
      families: `${A.families} and ${B.families}`,
      count: r.harms.length,
      count_word: numberWord(r.harms.length),
      span: first && last ? spanWords(first.t, last.t) : 'some days',
      interaction,
      interaction_name: dc.content.interactions?.[interaction]?.name?.toLowerCase() ?? interaction.replace(/_/g, ' '),
      violent: r.rung >= 3,
    };
  },

  importanceAt(level, _th, p) {
    return level >= 3 ? p.importance + 20 : level === 2 ? p.importance : p.importance - 25;
  },

  valence(th) {
    return th.facts.length > 6 ? -80 : -60;
  },

  stale(th, dc, p) {
    return (dc.ctx.now as number) - th.lastAt > p.n('quiet_days', 40) * DAY;
  },
};

export type { ChronicleThread };
