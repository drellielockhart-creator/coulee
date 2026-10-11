/**
 * Chronicle view part (the UI feed). OWNER: module:chronicle. Contract with module:web.
 *
 * P1 / 05 §11.1: during a run the Chronicle holds only what is public or what the viewing
 * character knows. A `perspective` sees public entries and the entries they could know
 * (`knownBy`); `perspective: null` is the god/debug view (everything current, still no
 * epilogue); only `omniscient` reveals the epilogue.
 */
import type { ContentBundle } from '../content.ts';
import { formatStamp } from '../time.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';
import type { ChronicleEntry } from './state.ts';

export interface ChronicleEntryView {
  id: number;
  t: number;
  stamp: string;
  voice: string;
  headline: string | null;
  text: string;
  importance: number;
  actorIds: number[];
  /** Additive: the pattern this entry tells, or null. */
  pattern?: string | null;
  /** Additive: public | witnessed | heard | omniscient. */
  knowledge?: string;
}

export interface ChronicleGlobalView {
  recent: ChronicleEntryView[];
}

/** May this viewer read this entry? (P1) */
export function entryVisibleTo(e: ChronicleEntry, who: { perspective: number | null; omniscient: boolean }): boolean {
  if (who.omniscient) return true;
  if (e.knowledge === 'omniscient' || e.voice === 'epilogue') return false;
  if (e.knowledge === 'public') return true;
  if (who.perspective === null) return true;
  return (e.knownBy ?? []).some((k) => (k as number) === who.perspective);
}

export function viewChronicleGlobal(world: World, _content: ContentBundle, opts: ViewOptions): ChronicleGlobalView {
  const who = { perspective: opts.perspective as number | null, omniscient: opts.omniscient === true };
  const all = world.chronicle.entries.filter((e) => entryVisibleTo(e, who));
  return {
    recent: (opts.recentChronicle > 0 ? all.slice(-opts.recentChronicle) : []).map((e) => ({
      id: e.id,
      t: e.t,
      stamp: formatStamp(e.t),
      voice: e.voice,
      headline: e.headline,
      text: e.text,
      importance: e.importance,
      actorIds: [...e.actorIds],
      pattern: e.pattern,
      knowledge: e.knowledge,
    })),
  };
}

export function chronicleDailyStats(world: World, _content: ContentBundle): Record<string, number> {
  const st = world.chronicle;
  let stories = 0;
  for (const e of st.entries) if (e.kind === 'pattern' || e.kind === 'event') stories += 1;
  return {
    chronicle_entries: st.entries.length,
    chronicle_stories: stories,
    chronicle_threads: st.threads.length,
  };
}
