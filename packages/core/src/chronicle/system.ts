/**
 * Chronicle system: runs LAST each hour. OWNER: module:chronicle.
 *
 * Incremental story sifting over the events since the cursor (05 §9): every module's events
 * become Facts; Facts feed the pattern threads (partial matches stay open) and the tallies;
 * a fact no pattern is telling may earn a line of its own if it is notable enough
 * (importance + notoriety, less fatigue and repeats). Each day begins with an almanac line
 * and the day's upkeep; each week ends with a digest. No LLM: prose comes from content
 * templates, varied deterministically through `ctx.rng('chronicle', ...)`.
 */

import { type Event, eventsSince } from '../events/index.ts';
import type { SimContext } from '../sim/context.ts';
import { formatDate, MOON_PHASE_NAMES } from '../time.ts';
import type { World } from '../world.ts';
import { weekNumber } from './bindings.ts';
import { annualAlmanac, weeklyDigest } from './digest.ts';
import { dailyPatterns, feedFact } from './engine.ts';
import { newDraft, writeEntry } from './entries.ts';
import { classVocab, factOf } from './facts.ts';
import { fadeNotoriety, tallyFact } from './notability.ts';
import { type PatternParams, patternParams } from './params.ts';
import type { DetectCtx } from './patterns/types.ts';
import { buildTemplateIndex, type TemplateIndex } from './prose.ts';
import { singleEntries } from './singles.ts';
import { ensureChronicleState } from './state.ts';

/** Build the detector context for one sifting pass. */
export function makeDetectCtx(world: World, ctx: SimContext): DetectCtx {
  const params: Record<string, PatternParams> = {};
  let idx: TemplateIndex | null = null;
  return {
    world,
    ctx,
    content: ctx.content,
    pcId: (world.meta.playerId as number | null) ?? 0,
    index: () => {
      idx ??= buildTemplateIndex(ctx.content);
      return idx;
    },
    params: (id, dflt) => {
      const hit = params[id];
      if (hit) return hit;
      const made = patternParams(ctx.content, id, dflt);
      params[id] = made;
      return made;
    },
  };
}

/** Every new day opens with an almanac line (and the day's upkeep first). */
function onDayStarted(dc: DetectCtx, ev: Extract<Event, { kind: 'core.day_started' }>): void {
  const st = dc.world.chronicle;
  const week = weekNumber(ev.t);
  if (week > 1 && st.lastDigestWeek < week - 1) weeklyDigest(dc, week - 1, ev.t);
  if (ev.data.month === 1 && ev.data.day === 1) annualAlmanac(dc, ev.t, ev.data.year);
  fadeNotoriety(st, ev.t, 14);
  dailyPatterns(dc);

  const d = ev.data;
  writeEntry(
    dc,
    newDraft({
      key: ev.kind,
      voice: 'almanac',
      basis: 'public',
      importance: 0,
      t: ev.t,
      tEnd: ev.t,
      kind: 'almanac',
      sources: [ev.id],
      topics: ['almanac'],
      bind: { sabbath: d.isSabbath, moon: MOON_PHASE_NAMES[d.moon] },
      fallback: `${formatDate(ev.t)}. The ${MOON_PHASE_NAMES[d.moon]}.`,
    }),
  );
}

export function chronicleSystem(world: World, ctx: SimContext): void {
  const st = world.chronicle;
  ensureChronicleState(st);
  const events = eventsSince(world.log, st.cursor);
  if (events.length > 0) {
    const dc = makeDetectCtx(world, ctx);
    const vocab = classVocab(dc.params('notability', 0));
    for (const ev of events) {
      if (ev.kind.startsWith('chronicle.')) continue; // sifting is meta
      if (ev.kind === 'core.day_started') {
        onDayStarted(dc, ev);
        continue;
      }
      const f = factOf(world, ctx.content, ev, vocab);
      if (!f) continue;
      tallyFact(dc, f);
      const { covered } = feedFact(dc, f);
      if (!covered) singleEntries(dc, f);
    }
  }
  st.cursor = world.log.lastId;
}
