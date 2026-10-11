import type { Explain } from '@coulee/core';
import type { KnownEvent } from './observation.ts';

/** Intern repeated Explain subtrees in saves; never retain world event payloads/roles/causes. */
type SavedExplain = Omit<Explain, 'children'> & { children?: number[] };
export interface KnowledgeArchive {
  events: Array<Omit<KnownEvent, 'explain'> & { explain: number | null }>;
  explanations: SavedExplain[];
}
export function packKnowledge(events: readonly KnownEvent[]): KnowledgeArchive {
  const explanations: SavedExplain[] = [];
  const ids = new Map<string, number>();
  const intern = (e: Explain): number => {
    const { children, ...rest } = e;
    const row = { ...rest, ...(children ? { children: children.map(intern) } : {}) };
    const key = JSON.stringify(row);
    const found = ids.get(key);
    if (found !== undefined) return found;
    const id = explanations.length;
    explanations.push(row);
    ids.set(key, id);
    return id;
  };
  return { events: events.map((e) => ({ ...e, explain: e.explain ? intern(e.explain) : null })), explanations };
}
export function unpackKnowledge(archive: KnowledgeArchive): KnownEvent[] {
  const read = (id: number): Explain => {
    const row = archive.explanations[id];
    if (!row) throw new Error('Invalid knowledge explanation');
    const { children, ...rest } = row;
    return { ...rest, ...(children ? { children: children.map(read) } : {}) };
  };
  return archive.events.map((e) => ({ ...e, explain: e.explain === null ? null : read(e.explain) }));
}
