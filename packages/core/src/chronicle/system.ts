/**
 * Chronicle system: runs LAST each hour. OWNER: module:chronicle.
 *
 * Contract (MODULES.md module:chronicle): read events with id > state.cursor (events/index.ts
 * eventsSince), run notability + pattern detectors (05 §9.2), render entries from
 * content templates (chronicleTemplates) in period voices, advance the cursor.
 *
 * PLACEHOLDER (M0): renders one almanac line per 'core.day_started' using the
 * 'day_heading' template, so `coulee run` produces a readable chronicle.md.
 */

import { eventsSince } from '../events/index.ts';
import { asChronicleEntryId, nextId } from '../ids.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { formatDate, MOON_PHASE_NAMES } from '../time.ts';
import type { World } from '../world.ts';

export function chronicleSystem(world: World, ctx: SimContext): void {
  const st = world.chronicle;
  for (const e of eventsSince(world.log, st.cursor)) {
    if (e.kind === 'core.day_started') {
      const tpl = Object.values(ctx.content.chronicleTemplates).find((t) => t.on === e.kind);
      const variant = tpl ? (ctx.rng('chronicle', mixKey(e.id)).pick(tpl.text) ?? '') : '{date}.';
      const text = variant.replaceAll('{date}', formatDate(e.t)).replaceAll('{moon}', MOON_PHASE_NAMES[e.data.moon]);
      st.entries.push({
        id: asChronicleEntryId(nextId(st.counters, 'entry')),
        t: e.t,
        tEnd: e.t,
        voice: 'almanac',
        headline: null,
        text,
        importance: 0,
        valence: 0,
        actorIds: [],
        placeIds: [],
        sourceEventIds: [e.id],
        pattern: null,
        templateId: tpl?.id ?? null,
        knowledge: 'public',
      });
    }
  }
  st.cursor = world.log.lastId;
}
