/**
 * Chronicle view part (the UI feed). OWNER: module:chronicle. Contract with module:web.
 */
import type { ContentBundle } from '../content.ts';
import { formatStamp } from '../time.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';

export interface ChronicleEntryView {
  id: number;
  t: number;
  stamp: string;
  voice: string;
  headline: string | null;
  text: string;
  importance: number;
  actorIds: number[];
}

export interface ChronicleGlobalView {
  recent: ChronicleEntryView[];
}

export function viewChronicleGlobal(world: World, _content: ContentBundle, opts: ViewOptions): ChronicleGlobalView {
  const all = world.chronicle.entries.filter((e) => opts.omniscient === true || e.knowledge !== 'omniscient');
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
    })),
  };
}

export function chronicleDailyStats(world: World, _content: ContentBundle): Record<string, number> {
  return { chronicle_entries: world.chronicle.entries.length };
}
