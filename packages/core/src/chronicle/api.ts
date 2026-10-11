/**
 * Chronicle cross-module API (used by the CLI and the web). OWNER: module:chronicle.
 */
import type { ContentBundle } from '../content.ts';
import { formatDate } from '../time.ts';
import type { World } from '../world.ts';
import type { ChronicleEntry, KnowledgeBasis } from './state.ts';

export interface ChronicleQuery {
  /** Minimum importance 0..100. */
  minImportance?: number;
  /** Knowledge bases to include (default: all — omniscient epilogue). */
  knowledge?: readonly KnowledgeBasis[];
  limit?: number;
}

export function chronicleEntries(world: World, q: ChronicleQuery = {}): ChronicleEntry[] {
  const out = world.chronicle.entries.filter(
    (e) => e.importance >= (q.minImportance ?? 0) && (!q.knowledge || q.knowledge.includes(e.knowledge)),
  );
  return q.limit !== undefined ? out.slice(-q.limit) : out;
}

/** chronicle.md for the CLI harness (05 §11.2). PLACEHOLDER formatting. */
export function renderChronicleMarkdown(world: World, _content: ContentBundle, title: string): string {
  const lines: string[] = [`# ${title}`, ''];
  let lastDay = '';
  for (const e of world.chronicle.entries) {
    const day = formatDate(e.t);
    if (e.voice === 'almanac' && e.importance === 0) {
      lines.push(`## ${e.text}`, '');
      lastDay = day;
      continue;
    }
    if (day !== lastDay) {
      lines.push(`## ${day}`, '');
      lastDay = day;
    }
    lines.push(e.headline ? `**${e.headline}** ${e.text}` : e.text, '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
