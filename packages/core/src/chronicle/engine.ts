/**
 * The sifting engine: feeds Facts to pattern threads, evaluates how far each story has got
 * for each audience (public, the player character, the omniscient epilogue), and writes
 * entries. Partial matches stay open as threads (05 §9.2). OWNER: module:chronicle.
 *
 * P1: a thread is evaluated three times, over three fact sets. The public view sees only
 * public events; the player view adds what the player character witnessed; the omniscient
 * view sees everything. An entry is stamped with the audience whose facts produced it, and is
 * RENDERED FROM THOSE FACTS ONLY, so a private event can never leak into a public entry: not
 * through its text, its cast, nor its source list. (A pattern may declare that a story is
 * common knowledge from some level on; the public entry then gains the thread's public face
 * but still none of the private facts.)
 */
import { recordProjection } from '../director/api.ts';
import type { ExplainTerm } from '../explain.ts';
import { nextId } from '../ids.ts';
import { newDraft, writeEntry } from './entries.ts';
import type { Fact } from './facts.ts';
import { noteTold, scoreStory } from './notability.ts';
import type { PatternParams } from './params.ts';
import { PATTERNS } from './patterns/index.ts';
import type { Accept, DetectCtx, PatternDef, View } from './patterns/types.ts';
import type { Bindings } from './prose.ts';
import type { ChronicleThread, ThreadFact } from './state.ts';
import { uniq } from './text.ts';

const MAX_FACTS = 40;
const MAX_ACTORS = 8;
const MAX_OPEN_THREADS = 400;
const MAX_CLOSED_THREADS = 40;

export function findThread(dc: DetectCtx, pattern: string, key: string): ChronicleThread | undefined {
  return dc.world.chronicle.threads.find((t) => t.pattern === pattern && t.key === key);
}

/** The facts a given audience may use: the town's, the player's, or all of them (P1). */
export function factsFor(th: ChronicleThread, view: View, pcId: number): ThreadFact[] {
  if (view === 'all') return th.facts;
  if (view === 'pub') return th.facts.filter((f) => f.pub === 1);
  return pcId ? th.facts.filter((f) => f.pub === 1 || f.by.includes(pcId)) : [];
}

function openThread(dc: DetectCtx, pattern: string, key: string, t: number): ChronicleThread {
  const st = dc.world.chronicle;
  const th: ChronicleThread = {
    id: nextId(st.counters, 'thread'),
    pattern,
    key,
    openedAt: t as never,
    lastAt: t as never,
    actorIds: [],
    householdIds: [],
    facts: [],
    emitted: { pub: 0, pc: 0, all: 0 },
    data: {},
    tags: {},
    closed: false,
    truthDone: false,
    entryIds: [],
  };
  st.threads.push(th);
  if (st.threads.length > MAX_OPEN_THREADS) {
    // Drop the oldest thread that never told a story; else the oldest of all.
    let idx = st.threads.findIndex((x) => x.entryIds.length === 0 && x !== th);
    if (idx < 0) idx = st.threads.findIndex((x) => x !== th);
    if (idx >= 0) st.threads.splice(idx, 1);
  }
  return th;
}

function addToThread(th: ChronicleThread, acc: Accept): void {
  const dup = th.facts.some((f) => f.e === acc.tf.e && f.k === acc.tf.k && f.a === acc.tf.a && f.b === acc.tf.b);
  if (!dup) {
    th.facts.push(acc.tf);
    if (th.facts.length > MAX_FACTS) th.facts.splice(0, th.facts.length - MAX_FACTS);
  }
  th.lastAt = Math.max(th.lastAt, acc.tf.t) as never;
  th.actorIds = uniq([...th.actorIds, ...(acc.actors ?? [acc.tf.a, acc.tf.b])].filter((x) => x > 0)).slice(
    0,
    MAX_ACTORS,
  );
  if (acc.households) {
    th.householdIds = uniq([...th.householdIds, ...acc.households].filter((x) => x > 0)).slice(0, MAX_ACTORS);
  }
  if (acc.tags) Object.assign(th.tags, acc.tags);
}

function actorsOf(facts: readonly ThreadFact[], fallback: readonly number[]): number[] {
  const out = uniq(facts.flatMap((f) => [f.a, f.b]).filter((x) => x > 0));
  return (out.length > 0 ? out : [...fallback]).slice(0, MAX_ACTORS);
}

function maxEmitted(th: ChronicleThread): number {
  return Math.max(th.emitted.pub, th.emitted.pc, th.emitted.all);
}

/** Minimum score for each audience (content-tunable). */
function thresholdFor(dc: DetectCtx, view: View): number {
  const p = dc.params('notability', 0);
  return view === 'pub' ? p.n('paper_min', 40) : view === 'pc' ? p.n('journal_min', 30) : p.n('epilogue_min', 45);
}

/**
 * Write the entry (and ballad) for one audience at one milestone. Returns true if an entry
 * was written. A story that scores below the audience's threshold is not marked as told: if
 * it grows more notable (a famous name joins, a slow week) a later fact can still tell it.
 */
function emitView(
  dc: DetectCtx,
  def: PatternDef,
  p: PatternParams,
  th: ChronicleThread,
  view: View,
  level: number,
  facts: ThreadFact[],
  promoted: boolean,
): boolean {
  const imp = def.importanceAt(level, th, p);
  if (imp <= 0) {
    th.emitted[view] = level;
    return false;
  }
  const real = facts.filter((f) => f.e > 0);
  const actors = promoted
    ? (def.publicActors?.(th) ?? []).slice(0, MAX_ACTORS)
    : (def.cast?.(facts, th, view) ?? actorsOf(facts, view === 'all' ? th.actorIds : [])).slice(0, MAX_ACTORS);
  const last = facts[facts.length - 1];
  const placeFact = [...facts].reverse().find((f) => f.p > 0);
  const t = last?.t ?? th.lastAt;
  const pcId = dc.pcId;
  const rep = def.repeat?.(th, level, p, dc) ?? null;
  const score = scoreStory(dc, {
    base: imp,
    actors,
    repeatKey: rep ? `${rep.key}|${view}` : null,
    ...(rep ? { repeatDays: rep.days } : {}),
    t,
    pcIn: pcId > 0 && view !== 'pub' && actors.includes(pcId),
    epilogue: view === 'all',
  });
  if (score.total < thresholdFor(dc, view)) return false;

  const bind: Bindings = def.bind(facts, th, level, dc, p, view);
  const base = {
    key: def.id,
    importance: score.total,
    terms: score.terms as ExplainTerm[],
    valence: def.valence?.(th) ?? 0,
    t,
    tEnd: t,
    actorIds: actors,
    placeIds: placeFact ? [placeFact.p] : [],
    sources: real.slice(-8).map((f) => f.e),
    pattern: def.id,
    kind: 'pattern' as const,
    level,
    threadId: th.id,
    topics: [def.topic],
    bind,
  };
  let wrote = false;
  if (view === 'pub') {
    const e = writeEntry(dc, newDraft({ ...base, voice: 'paper', basis: 'public', optional: true }));
    if (e) {
      th.entryIds.push(e.id);
      wrote = true;
    }
    const ballad = dc.params('notability', 0).n('ballad_min', 75);
    if (def.balladLevel !== undefined && level >= def.balladLevel && score.total >= ballad) {
      const b = writeEntry(dc, newDraft({ ...base, voice: 'ballad', basis: 'public', optional: true, salt: 7 }));
      if (b) th.entryIds.push(b.id);
    }
  } else if (view === 'pc') {
    const inStory = actors.includes(pcId);
    const e = writeEntry(
      dc,
      newDraft({
        ...base,
        voice: 'journal',
        basis: inStory ? 'witnessed' : 'heard',
        knownBy: [pcId],
        authorId: pcId,
        optional: true,
        salt: 3,
        bind: { ...bind, pc: true },
      }),
    );
    if (e) {
      th.entryIds.push(e.id);
      wrote = true;
    }
  } else {
    const e = writeEntry(dc, newDraft({ ...base, voice: 'epilogue', basis: 'omniscient', optional: true, salt: 5 }));
    if (e) {
      th.entryIds.push(e.id);
      wrote = true;
    }
  }
  if (wrote) {
    th.emitted[view] = level;
    if (rep) noteTold(dc.world.chronicle, `${rep.key}|${view}`, t);
  }
  return wrote;
}

/** Evaluate one thread for all three audiences and write whatever milestones are new. */
function evaluate(dc: DetectCtx, def: PatternDef, p: PatternParams, th: ChronicleThread): void {
  const pcId = dc.pcId;
  const pubFacts = factsFor(th, 'pub', pcId);
  const lPubOwn = def.level(pubFacts, th, dc, p, 'pub');
  // Common knowledge: the level can be raised by what everyone knows is going on, but the
  // entry is rendered from public facts only.
  let lPub = lPubOwn;
  let promoted = false;
  if ((def.publicFrom ?? 0) > 0) {
    const lTown = def.townLevel ? def.townLevel(th.facts, th, dc, p) : def.level(th.facts, th, dc, p, 'all');
    if (lTown >= (def.publicFrom ?? 0) && lTown > lPubOwn) {
      lPub = lTown;
      promoted = true;
    }
  }
  if (lPub > th.emitted.pub) emitView(dc, def, p, th, 'pub', lPub, pubFacts, promoted);

  if (pcId) {
    const pcFacts = factsFor(th, 'pc', pcId);
    const lPc = def.level(pcFacts, th, dc, p, 'pc');
    const involved = th.actorIds.includes(pcId);
    if (lPc > th.emitted.pc && (involved || lPc > Math.max(lPubOwn, th.emitted.pub))) {
      emitView(dc, def, p, th, 'pc', lPc, pcFacts, false);
    }
  }
  const lAll = def.level(th.facts, th, dc, p, 'all');
  if (lAll > th.emitted.all && (def.alwaysAll || lAll > Math.max(th.emitted.pub, th.emitted.pc))) {
    emitView(dc, def, p, th, 'all', lAll, th.facts, false);
  }
}

export function feedAccept(dc: DetectCtx, def: PatternDef, p: PatternParams, acc: Accept): ChronicleThread {
  const th = findThread(dc, def.id, acc.key) ?? openThread(dc, def.id, acc.key, acc.tf.t);
  addToThread(th, acc);
  evaluate(dc, def, p, th);
  if (dc.world.director && def.openState) recordProjection(dc.world, def.openState(th, dc, p));
  return th;
}

/** Feed one fact to every pattern. `covered` means a pattern is already telling this story. */
export function feedFact(dc: DetectCtx, f: Fact): { covered: boolean } {
  let covered = false;
  for (const def of PATTERNS) {
    const p = dc.params(def.id, def.importance);
    if (!p.enabled) continue;
    for (const acc of def.accept(f, dc, p)) {
      const th = feedAccept(dc, def, p, acc);
      if (def.suppressSingles && th.entryIds.length > 0) covered = true;
    }
  }
  return { covered };
}

function closeThread(dc: DetectCtx, def: PatternDef, p: PatternParams, th: ChronicleThread): void {
  const st = dc.world.chronicle;
  const pcId = dc.pcId;
  if (def.closingLevel !== undefined && maxEmitted(th) >= def.closingLevel) {
    // Close each audience's story that was actually told, from that audience's facts.
    const views: View[] = [];
    if (th.emitted.pub > 0) views.push('pub');
    if (th.emitted.pc > 0 && pcId) views.push('pc');
    if (th.emitted.all > 0 && th.emitted.pub === 0 && th.emitted.pc === 0) views.push('all');
    for (const view of views) {
      const facts = factsFor(th, view, pcId);
      const level = th.emitted[view];
      const promoted = view === 'pub' && facts.length === 0;
      const actors = promoted
        ? (def.publicActors?.(th) ?? [])
        : (def.cast?.(facts, th, view) ?? actorsOf(facts, view === 'all' ? th.actorIds : []));
      const bind = { ...def.bind(facts, th, level, dc, p, view), closed: true };
      const last = facts[facts.length - 1];
      const imp = Math.max(1, def.importanceAt(level, th, p) - 10);
      const score = scoreStory(dc, {
        base: imp,
        actors,
        repeatKey: null,
        t: dc.ctx.now as number,
        pcIn: pcId > 0 && view !== 'pub' && actors.includes(pcId),
      });
      if (score.total < thresholdFor(dc, view)) continue;
      const base = {
        key: `${def.id}.closed`,
        importance: score.total,
        terms: score.terms,
        valence: -Math.trunc((def.valence?.(th) ?? 0) / 2),
        t: dc.ctx.now as number,
        tEnd: dc.ctx.now as number,
        actorIds: actors.slice(0, MAX_ACTORS),
        placeIds: last && last.p > 0 ? [last.p] : [],
        sources: facts
          .filter((f) => f.e > 0)
          .slice(-6)
          .map((f) => f.e),
        pattern: def.id,
        kind: 'closing' as const,
        level: level + 100,
        threadId: th.id,
        topics: [def.topic],
        bind,
        optional: true,
      };
      const draft =
        view === 'pub'
          ? newDraft({ ...base, voice: 'paper', basis: 'public' })
          : view === 'pc'
            ? newDraft({ ...base, voice: 'journal', basis: 'witnessed', knownBy: [pcId], authorId: pcId })
            : newDraft({ ...base, voice: 'epilogue', basis: 'omniscient' });
      const e = writeEntry(dc, draft);
      if (e) th.entryIds.push(e.id);
    }
  }
  th.closed = true;
  if (dc.world.director && def.openState) recordProjection(dc.world, def.openState(th, dc, p));
  const idx = st.threads.indexOf(th);
  if (idx >= 0) st.threads.splice(idx, 1);
  st.closedThreads.push({ ...th, facts: th.facts.slice(-3) });
  if (st.closedThreads.length > MAX_CLOSED_THREADS)
    st.closedThreads.splice(0, st.closedThreads.length - MAX_CLOSED_THREADS);
}

/** Daily upkeep: pattern counters, synthetic facts, then close stale threads. */
export function dailyPatterns(dc: DetectCtx): void {
  for (const def of PATTERNS) {
    const p = dc.params(def.id, def.importance);
    if (!p.enabled || !def.daily) continue;
    for (const acc of def.daily(dc, p)) feedAccept(dc, def, p, acc);
  }
  for (const th of [...dc.world.chronicle.threads]) {
    const def = PATTERNS.find((d) => d.id === th.pattern);
    if (!def) continue;
    const p = dc.params(def.id, def.importance);
    if (def.stale?.(th, dc, p)) closeThread(dc, def, p, th);
  }
}
