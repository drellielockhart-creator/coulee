/**
 * Writing entries: render the draft in its voice, store it, bump notoriety and the cast,
 * and announce pattern matches. OWNER: module:chronicle.
 */
import type { ActorCore } from '../actor.ts';
import type { Explain, ExplainTerm } from '../explain.ts';
import {
  type ActorId,
  asActorId,
  asChronicleEntryId,
  asEventId,
  asPlaceId,
  type ChronicleEntryId,
  nextId,
} from '../ids.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { GameMinute } from '../time.ts';
import { baseBindings, weekNumber } from './bindings.ts';
import type { DetectCtx } from './patterns/types.ts';
import { type Bindings, renderTemplate } from './prose.ts';
import type { ChronicleEntry, ChronicleVoice, EntryKind, KnowledgeBasis } from './state.ts';
import { capFirst, uniq } from './text.ts';

export interface Draft {
  /** Template key: an event kind, a pattern id, '<pattern>.closed' or '<pattern>.truth'. */
  key: string;
  voice: ChronicleVoice;
  basis: KnowledgeBasis;
  knownBy: number[];
  authorId: number | null;
  t: number;
  tEnd: number;
  importance: number;
  valence: number;
  actorIds: number[];
  placeIds: number[];
  sources: number[];
  pattern: string | null;
  kind: EntryKind;
  level: number;
  threadId: number | null;
  topics: string[];
  bind: Bindings;
  terms: ExplainTerm[];
  /** Skip silently when no template exists (ballads, epilogue lines). */
  optional: boolean;
  /** Extra rng salt so two drafts from one event differ. */
  salt: number;
}

const TONE_ORDER = [
  'piety',
  'temper',
  'thrift',
  'superstition',
  'ambition',
  'rancor',
  'neighborliness',
  'parochialism',
  'discretion',
] as const;

/** A journal's temperament: the writer's strongest value of +2 or more (ties: fixed order). */
export function toneOf(a: ActorCore | undefined): string | null {
  if (!a) return null;
  let best: string | null = null;
  let bestV = 1;
  for (const v of TONE_ORDER) {
    const x = (a.values as Record<string, number | undefined>)[v] ?? 0;
    if (x > bestV) {
      best = v;
      bestV = x;
    }
  }
  if (best) return best;
  return ((a.values as Record<string, number | undefined>).superstition ?? 0) <= -2 ? 'skeptic' : null;
}

export function newDraft(over: Partial<Draft> & Pick<Draft, 'key' | 'voice' | 'basis' | 'importance'>): Draft {
  return {
    knownBy: [],
    authorId: null,
    t: 0,
    tEnd: 0,
    valence: 0,
    actorIds: [],
    placeIds: [],
    sources: [],
    pattern: null,
    kind: 'event',
    level: 0,
    threadId: null,
    topics: [],
    bind: {},
    terms: [],
    optional: false,
    salt: 0,
    ...over,
  };
}

function fallbackText(d: Draft, bind: Bindings): string {
  const who = typeof bind.cast === 'string' ? bind.cast : '';
  const what = d.key.replace(/^[a-z]+\./, '').replace(/[._]/g, ' ');
  return capFirst(who ? `${who}: ${what}` : what);
}

/** Render and store one entry. Returns null when a draft was optional and had no template. */
export function writeEntry(dc: DetectCtx, d: Draft): ChronicleEntry | null {
  const { world, content, ctx } = dc;
  const st = world.chronicle;
  const bind: Bindings = {
    ...baseBindings(world, content, {
      t: d.t,
      actors: d.actorIds,
      place: d.placeIds[0] ?? 0,
      formal: d.voice === 'paper',
      authorId: d.authorId,
    }),
    voice: d.voice,
    basis: d.basis,
    level: d.level,
    ...d.bind,
  };
  const rng = ctx.rng('chronicle', mixKey(d.sources[0] ?? 0, d.level, hashString32(`${d.key}|${d.voice}`), d.salt));
  const author = d.authorId ? world.actors[d.authorId as ActorId] : undefined;
  const rendered = renderTemplate(dc.index(), rng, st.variants, d.key, d.voice, d.importance, bind, toneOf(author));
  if (!rendered && d.optional) return null;

  // Epilogue lines about minds are capped per week so a nervous town does not drown the story.
  const week = weekNumber(d.t);
  if (st.weekLoad.week !== week) st.weekLoad = { week, entries: 0, epilogue: 0 };
  if (d.voice === 'epilogue' && d.kind === 'event') {
    const cap = dc.params('notability', 0).n('epilogue_weekly_cap', 14);
    if (st.weekLoad.epilogue >= cap) return null;
    st.weekLoad.epilogue += 1;
  } else if (d.kind !== 'digest' && d.kind !== 'almanac') {
    st.weekLoad.entries += 1;
  }

  const entry: ChronicleEntry = {
    id: asChronicleEntryId(nextId(st.counters, 'entry')),
    t: d.t as GameMinute,
    tEnd: d.tEnd as GameMinute,
    voice: d.voice,
    headline: rendered?.headline ?? null,
    text: rendered?.text ?? fallbackText(d, bind),
    importance: Math.max(0, Math.min(100, Math.round(d.importance))),
    valence: Math.max(-100, Math.min(100, Math.round(d.valence))),
    actorIds: d.actorIds.map(asActorId),
    placeIds: uniq(d.placeIds.filter((p) => p > 0)).map(asPlaceId),
    sourceEventIds: d.sources.map(asEventId),
    pattern: d.pattern,
    templateId: rendered?.templateId ?? null,
    knowledge: d.basis,
    knownBy: d.knownBy.map(asActorId),
    authorId: d.authorId ? asActorId(d.authorId) : null,
    kind: d.kind,
    level: d.level,
    threadId: d.threadId,
    topics: d.topics,
  };
  if (d.terms.length > 0) {
    const threshold = dc.params('notability', 0).n(d.voice === 'journal' ? 'journal_min' : 'paper_min', 40);
    const explain: Explain = {
      kind: 'formula',
      label: 'Why the Chronicle kept this',
      subjects: d.actorIds.slice(0, 3).map(asActorId),
      knowledge: 'omniscient',
      terms: d.terms,
      total: entry.importance,
      dc: { total: threshold, terms: [] },
      outcome: 'kept',
      margin: entry.importance - threshold,
    };
    entry.explain = explain;
  }
  st.entries.push(entry);
  st.tallies.week.entries[d.voice] = (st.tallies.week.entries[d.voice] ?? 0) + 1;
  st.tallies.total.entries[d.voice] = (st.tallies.total.entries[d.voice] ?? 0) + 1;

  if (d.importance > 0) {
    for (const a of d.actorIds) {
      st.notoriety[a] = Math.min(100, (st.notoriety[a] ?? 0) + Math.floor(d.importance / 8));
      st.cast[a] = (st.cast[a] ?? 0) + d.importance;
    }
  }
  if (d.pattern) {
    ctx.emit({
      kind: 'chronicle.pattern_matched',
      data: { pattern: d.pattern, entryId: entry.id as ChronicleEntryId, level: d.level, voice: d.voice },
      roles: d.actorIds.slice(0, 6).map((a) => ({ actor: asActorId(a), role: 'participant' as const })),
      visibility: 'inner',
      ...(entry.explain ? { explain: entry.explain } : {}),
      causes: d.sources.slice(-3).map(asEventId),
    });
  }
  return entry;
}
