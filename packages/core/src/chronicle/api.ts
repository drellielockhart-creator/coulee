/**
 * Chronicle cross-module API (used by the CLI and the web). OWNER: module:chronicle.
 */
import type { ContentBundle } from '../content.ts';
import { calendarAt, MINUTES_PER_DAY } from '../time.ts';
import type { World } from '../world.ts';
import { weekNumber } from './bindings.ts';
import { newDraft, writeEntry } from './entries.ts';
import { shortNameOf } from './names.ts';
import type { ChronicleEntry, KnowledgeBasis } from './state.ts';
import { makeDetectCtx } from './system.ts';
import { entryVisibleTo } from './view.ts';

export interface ChronicleQuery {
  /** Minimum importance 0..100. */
  minImportance?: number;
  /** Knowledge bases to include (default: all — omniscient epilogue). */
  knowledge?: readonly KnowledgeBasis[];
  limit?: number;
  /** Additive: restrict to what this viewer may read (P1). Omit for the unfiltered log. */
  viewer?: { perspective: number | null; omniscient: boolean };
  /** Additive: restrict to one pattern id. */
  pattern?: string;
}

export function chronicleEntries(world: World, q: ChronicleQuery = {}): ChronicleEntry[] {
  const out = world.chronicle.entries.filter(
    (e) =>
      e.importance >= (q.minImportance ?? 0) &&
      (!q.knowledge || q.knowledge.includes(e.knowledge)) &&
      (!q.viewer || entryVisibleTo(e, q.viewer)) &&
      (q.pattern === undefined || e.pattern === q.pattern),
  );
  return q.limit !== undefined ? out.slice(-q.limit) : out;
}

export interface RenderOptions {
  /** Whose knowledge the body is filtered by; null (default) is the god/debug view. */
  perspective?: number | null;
  /** Append the omniscient epilogue (default: yes unless a perspective is given). */
  epilogue?: boolean;
}

function monthDay(t: number): string {
  const c = calendarAt(t as never);
  return `${c.monthName} ${c.day}`;
}

function isDayLine(e: ChronicleEntry): boolean {
  return e.voice === 'almanac' && e.kind === 'almanac' && e.importance === 0;
}

/** Day by day, the day's own almanac line first, then its entries in the order they happened. */
function byTime(a: ChronicleEntry, b: ChronicleEntry): number {
  const da = Math.floor(a.t / MINUTES_PER_DAY);
  const db = Math.floor(b.t / MINUTES_PER_DAY);
  if (da !== db) return da - db;
  const ha = isDayLine(a) ? 0 : 1;
  const hb = isDayLine(b) ? 0 : 1;
  return ha - hb || a.t - b.t || a.id - b.id;
}

function weekHeading(week: number): string {
  const start = (week - 1) * 7 * MINUTES_PER_DAY;
  const end = start + 6 * MINUTES_PER_DAY;
  const a = calendarAt(start as never);
  const b = calendarAt(end as never);
  const range =
    a.monthName === b.monthName
      ? `${a.monthName} ${a.day} to ${b.day}, ${b.year}`
      : `${monthDay(start)} to ${monthDay(end)}, ${b.year}`;
  return `## Week ${week}: ${range}`;
}

function blockquote(text: string): string[] {
  return text.split('\n').map((l) => `> ${l}  `);
}

/** One entry as markdown lines (without a trailing blank line). */
function renderEntry(world: World, e: ChronicleEntry): string[] {
  switch (e.voice) {
    case 'almanac':
      return isDayLine(e) ? [`*${e.text}*`] : [`> *The Almanac.* ${e.text}`];
    case 'paper':
      return [e.headline ? `**${e.headline}** ${e.text}` : e.text];
    case 'journal': {
      const who = e.authorId ? shortNameOf(world, e.authorId) : '';
      return [...blockquote(e.text), ...(who ? [`> — *${who}, in a journal*`] : [])];
    }
    case 'ballad':
      return blockquote(e.text).map((l) => l.replace(/^> /, '> ♪ '));
    case 'ledger':
      return [`*From the household ledger.* ${e.text}`];
    default:
      return [e.text];
  }
}

function renderBody(world: World, entries: ChronicleEntry[]): string[] {
  const lines: string[] = [];
  let week = -1;
  for (const e of [...entries].sort(byTime)) {
    const w = weekNumber(e.t);
    if (w !== week) {
      lines.push(weekHeading(w), '');
      week = w;
    }
    lines.push(...renderEntry(world, e), '');
  }
  return lines;
}

function renderEpilogue(world: World, entries: ChronicleEntry[]): string[] {
  if (entries.length === 0) return [];
  const lines: string[] = [
    '---',
    '',
    '## Epilogue: what the county never knew',
    '',
    '*Set down after the fact, from the record of what was truly done, said, and felt. Nobody in the story had this.*',
    '',
  ];
  let week = -1;
  for (const e of [...entries].sort(byTime)) {
    const w = weekNumber(e.t);
    if (w !== week) {
      lines.push(`### Week ${w}`, '');
      week = w;
    }
    lines.push(`**${monthDay(e.t)}.** ${e.text}`, '');
  }
  void world;
  return lines;
}

/** chronicle.md for the CLI harness (05 §11.2): grouped by week, epilogue last. */
export function renderChronicleMarkdown(
  world: World,
  _content: ContentBundle,
  title: string,
  opts: RenderOptions = {},
): string {
  const perspective = opts.perspective ?? null;
  const all = world.chronicle.entries;
  const body = all.filter((e) => entryVisibleTo(e, { perspective, omniscient: false }));
  const includeEpilogue = opts.epilogue ?? perspective === null;
  const truths = includeEpilogue ? all.filter((e) => e.knowledge === 'omniscient' || e.voice === 'epilogue') : [];
  const lines: string[] = [`# ${title}`, ''];
  lines.push(...renderBody(world, body));
  lines.push(...renderEpilogue(world, truths));
  return `${lines.join('\n').trimEnd()}\n`;
}

export { argForm, familiesOf, formalName, type HouseholdForms, householdForms } from './names.ts';

/** Durable brawl summary is handed off synchronously, before micro-events can be evicted. */
export function recordFight(
  world: World,
  ctx: import('../sim/context.ts').SimContext,
  data: {
    actors: import('../ids.ts').ActorId[];
    witnesses: import('../ids.ts').ActorId[];
    eventId: import('../ids.ts').EventId;
    placeId: import('../ids.ts').PlaceId;
    text: string;
  },
): void {
  writeEntry(
    makeDetectCtx(world, ctx),
    newDraft({
      key: 'tactical.outcome',
      voice: 'almanac',
      basis: 'witnessed',
      knownBy: data.witnesses,
      actorIds: data.actors,
      placeIds: [data.placeId],
      sources: [data.eventId],
      t: ctx.now,
      tEnd: ctx.now,
      importance: 55,
      kind: 'event',
      topics: ['fight'],
      fallback: data.text,
    }),
  );
}

export type { OpenProjection } from './patterns/open.ts';

/** Score already-perceived events using the Chronicle's salience scale. Repetition is
 * intentionally not applied: it changes prose selection, not whether an event occurred. */
export function notableObservedEvents(
  world: World,
  ctx: import('../sim/context.ts').SimContext,
  pc: import('../ids.ts').ActorId | null,
  events: readonly import('../events/index.ts').Event[],
): boolean {
  if (pc === null) return false;
  const dc = measurementDetectCtx(world, ctx);
  const minimum = dc.params('notability', 0).n('journal_min', 30);
  return events.some((e) => {
    if (e.kind.startsWith('chronicle.') || (e.importance ?? 0) <= 0) return false;
    const actors = e.roles.map((r) => r.actor);
    return (
      measurementScore(dc, { base: e.importance ?? 0, actors, repeatKey: null, t: e.t, pcIn: actors.includes(pc) })
        .total >= minimum
    );
  });
}

import { scoreStory as measurementScore } from './notability.ts';
import { makeDetectCtx as measurementDetectCtx } from './system.ts';
