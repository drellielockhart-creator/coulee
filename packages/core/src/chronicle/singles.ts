/**
 * Single-event entries (05 §11): the things worth a line on their own. A fact is scored
 * (importance + the notoriety of its people - fatigue - repeats) and, if it clears an
 * audience's bar, written for that audience: the Paper for what the town could see, the
 * Journal for what the player character saw or did, the epilogue for what nobody else knew.
 * OWNER: module:chronicle.
 */
import type { ExplainTerm } from '../explain.ts';
import type { ActorId } from '../ids.ts';
import { newDraft, writeEntry } from './entries.ts';
import type { Fact } from './facts.ts';
import { conditionName, familiesOf, familyOfHousehold } from './names.ts';
import { noteTold, scoreStory } from './notability.ts';
import type { DetectCtx } from './patterns/types.ts';
import type { Bindings } from './prose.ts';
import { daysText } from './text.ts';

type Audience = 'paper' | 'journal' | 'epilogue';

const DOMESTIC: readonly string[] = ['help', 'amends', 'dun', 'repay', 'debt', 'gossip', 'chat', 'courtship'];

/** Which audiences may be told about this fact (P1). */
export function audiencesOf(f: Fact, pcId: number): Audience[] {
  const out: Audience[] = [];
  const pcKnows = pcId > 0 && (f.by.includes(pcId) || (f.pub && f.actors.includes(pcId)));
  if (f.pub) out.push('paper');
  if (pcKnows) out.push('journal');
  if (!f.pub && !pcKnows) out.push('epilogue');
  return out;
}

function singleBind(dc: DetectCtx, f: Fact): Bindings {
  const out: Bindings = { ...f.bind };
  switch (f.cls) {
    case 'shortage': {
      const hid = f.households[0] ?? 0;
      out.family = familyOfHousehold(dc.world, hid);
      out.families = familiesOf(dc.world, hid);
      out.household = out.family;
      out.lowest_days = daysText(f.weight);
      break;
    }
    case 'nutrition': {
      out.condition_name = conditionName(f.sub);
      out.on = f.success === true;
      // Held somewhere (the Prince's prisoner): no table, cellar or season of his own to blame.
      const who = dc.world.actors[f.agent as ActorId];
      out.confined = who ? dc.content.occupations?.[who.occupationId]?.confined === true : false;
      break;
    }
    case 'need':
      out.severity = f.success ? 'severe' : 'mild';
      break;
    default:
      break;
  }
  if (f.cls === 'harm' || f.cls === 'help' || f.cls === 'courtship' || f.cls === 'dun' || f.cls === 'repay') {
    out.interaction = f.sub;
  }
  return out;
}

export function singleEntries(dc: DetectCtx, f: Fact): number {
  const p = dc.params('notability', 0);
  const pcId = dc.pcId;
  const st = dc.world.chronicle;
  const actors = f.actors.slice(0, 6);
  let written = 0;
  // Kindness, money and courtship between people under one roof are housekeeping.
  const ha = f.agent ? (dc.world.actors[f.agent as ActorId]?.householdId ?? 0) : 0;
  const hb = f.target ? (dc.world.actors[f.target as ActorId]?.householdId ?? 0) : 0;
  const domestic = ha > 0 && ha === hb && DOMESTIC.includes(f.cls);
  for (const aud of audiencesOf(f, pcId)) {
    if (domestic && aud !== 'journal') continue;
    // A repayment is the Paper's news only as the end of a debt story (the debt pattern tells it
    // when the debt was pressed or long); a lone squaring of accounts is ledger work.
    if (aud === 'paper' && f.cls === 'repay') continue;
    const voice = aud === 'paper' ? 'paper' : aud === 'journal' ? 'journal' : 'epilogue';
    const min =
      aud === 'paper' ? p.n('paper_min', 40) : aud === 'journal' ? p.n('journal_min', 30) : p.n('epilogue_min', 45);
    const pair = [f.agent, f.target]
      .filter((x) => x > 0)
      .sort((a, b) => a - b)
      .join('-');
    const repeatKey = `${voice}|${f.cls}|${f.sub}|${pair}`;
    const score = scoreStory(dc, {
      base: f.base,
      actors,
      repeatKey,
      t: f.t,
      pcIn: pcId > 0 && aud !== 'paper' && actors.includes(pcId),
      epilogue: aud === 'epilogue',
    });
    if (score.total < min) continue;
    const bind = singleBind(dc, f);
    const draft = newDraft({
      key: f.kind,
      voice,
      basis:
        aud === 'paper' ? 'public' : aud === 'journal' ? (actors.includes(pcId) ? 'witnessed' : 'heard') : 'omniscient',
      knownBy: aud === 'journal' ? [pcId] : [],
      authorId: aud === 'journal' ? pcId : null,
      importance: score.total,
      terms: score.terms as ExplainTerm[],
      valence: f.valence,
      t: f.t,
      tEnd: f.t,
      actorIds: actors,
      placeIds: f.place > 0 ? [f.place] : [],
      sources: [f.id],
      kind: 'event',
      topics: [f.cls],
      bind: aud === 'journal' ? { ...bind, pc: true } : bind,
      optional: true,
      salt: aud === 'paper' ? 1 : aud === 'journal' ? 2 : 4,
    });
    const e = writeEntry(dc, draft);
    if (e) {
      noteTold(st, repeatKey, f.t);
      written += 1;
    }
  }
  return written;
}
