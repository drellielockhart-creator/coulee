/**
 * The sifting engine: feeds Facts to pattern threads, evaluates how far each story has got
 * for each audience (public, the player character, the omniscient epilogue), and writes
 * entries. Partial matches stay open as threads (05 §9.2). OWNER: module:chronicle.
 *
 * P1: a thread is evaluated three times, over three fact sets. The public view sees only
 * public events; the player view adds what the player character witnessed; the omniscient
 * view sees everything. An entry is stamped with the audience whose facts produced it, so a
 * private event can never leak into a public entry.
 */
import { asEventId, type ChronicleEntryId, nextId } from '../ids.ts';
import { newDraft, writeEntry } from './entries.ts';
import type { Fact } from './facts.ts';
import { PATTERNS } from './patterns/index.ts';
import type { Accept, DetectCtx, PatternDef, View } from './patterns/types.ts';
import type { PatternParams } from './params.ts';
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
    let idx = st.threads.findIndex((x) => x.emitted.pub + x.emitted.pc + x.emitted.all === 0 && x !== th);
    if (idx < 0) idx = 0;
    st.threads.splice(idx, 1);
  }
  return th;
}

function addToThread(th: ChronicleThread, acc: Accept): void {
  const dup = th.facts.some((f) => f.e === acc.tf.e && f.k === acc.tf.k);
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

/** Write the entry (and ballad) for one audience at one milestone. */
function emitView(
  dc: DetectCtx,
  def: PatternDef,
  p: PatternParams,
  th: ChronicleThread,
  view: View,
  level: number,
  facts: ThreadFact[],
): void {
  const imp = def.importanceAt(level, th, p);
  th.emitted[view] = level;
  if (imp <= 0) return;
  const actors = actorsOf(facts, th.actorIds);
  const last = facts[facts.length - 1];
  const placeFact = [...facts].reverse().find((f) => f.p > 0);
  const t = last?.t ?? th.lastAt;
  const bind: Bindings = def.bind(facts, th, level, dc, p, view);
  const sources = facts.slice(-8).map((f) => f.e);
  const base = {
    key: def.id,
    importance: imp,
    valence: def.valence?.(th) ?? 0,
    t,
    tEnd: t,
    actorIds: actors,
    placeIds: placeFact ? [placeFact.p] : [],
    sources,
    pattern: def.id,
    kind: 'pattern' as const,
    level,
    threadId: th.id,
    topics: [def.topic],
    bind,
  };
  const pcId = dc.pcId;
  if (view === 'pub') {
    const e = writeEntry(dc, newDraft({ ...base, voice: 'paper', basis: 'public' }));
    if (e) th.entryIds.push(e.id);
    const ballad = dc.params('notability', 0).n('ballad_min', 75);
    if (def.balladLevel !== undefined && level >= def.balladLevel && imp >= ballad) {
      const b = writeEntry(dc, newDraft({ ...base, voice: 'ballad', basis: 'public', optional: true, salt: 7 }));
      if (b) th.entryIds.push(b.id);
    }
  } else if (view === 'pc') {
    const e = writeEntry(
      dc,
      newDraft({ ...base, voice: 'journal', basis: 'witnessed', knownBy: [pcId], authorId: pcId, salt: 3 }),
    );
    if (e) th.entryIds.push(e.id);
  } else {
    const e = writeEntry(dc, newDraft({ ...base, voice: 'epilogue', basis: 'omniscient', optional: true, salt: 5 }));
    if (e) th.entryIds.push(e.id);
  }
}

/** Evaluate one thread for all three audiences and write whatever milestones are new. */
function evaluate(dc: DetectCtx, def: PatternDef, p: PatternParams, th: ChronicleThread): void {
  const all = th.facts;
  const pubFacts = all.filter((f) => f.pub === 1);
  const pcFacts = dc.pcId ? all.filter((f) => f.pub === 1 || f.by.includes(dc.pcId)) : [];
  const lAll = def.level(all, th, dc, p, 'all');
  const lPubOwn = def.level(pubFacts, th, dc, p, 'pub');
  const promoted = (def.publicFrom ?? 0) > 0 && lAll >= (def.publicFrom ?? 0) && lAll > lPubOwn;
  const lPub = promoted ? lAll : lPubOwn;
  if (lPub > th.emitted.pub) emitView(dc, def, p, th, 'pub', lPub, promoted ? all : pubFacts);

  if (dc.pcId) {
    const lPc = def.level(pcFacts, th, dc, p, 'pc');
    const involved = th.actorIds.includes(dc.pcId);
    if (lPc > th.emitted.pc && (involved || lPc > lPub)) emitView(dc, def, p, th, 'pc', lPc, pcFacts);
  }
  if (lAll > th.emitted.all && (def.alwaysAll || lAll > Math.max(th.emitted.pub, th.emitted.pc))) {
    emitView(dc, def, p, th, 'all', lAll, all);
  }
}

export function feedAccept(dc: DetectCtx, def: PatternDef, p: PatternParams, acc: Accept): ChronicleThread {
  const th = findThread(dc, def.id, acc.key) ?? openThread(dc, def.id, acc.key, acc.tf.t);
  addToThread(th, acc);
  evaluate(dc, def, p, th);
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
      if (def.suppressSingles && maxEmitted(th) > 0) covered = true;
    }
  }
  return { covered };
}

function closeThread(dc: DetectCtx, def: PatternDef, p: PatternParams, th: ChronicleThread): void {
  const st = dc.world.chronicle;
  if (def.closingLevel !== undefined && maxEmitted(th) >= def.closingLevel) {
    const views: View[] = th.emitted.pub > 0 ? ['pub'] : th.emitted.pc > 0 ? ['pc'] : th.emitted.all > 0 ? ['all'] : [];
    for (const view of views) {
      const facts =
        view === 'pub'
          ? th.facts.filter((f) => f.pub === 1).length > 0
            ? th.facts.filter((f) => f.pub === 1)
            : th.facts
          : th.facts;
      const level = th.emitted[view];
      const bind = { ...def.bind(facts, th, level, dc, p, view), closed: true };
      const last = facts[facts.length - 1];
      const base = {
        key: `${def.id}.closed`,
        importance: Math.max(1, def.importanceAt(level, th, p) - 10),
        valence: -(def.valence?.(th) ?? 0) / 2,
        t: dc.ctx.now as number,
        tEnd: dc.ctx.now as number,
        actorIds: actorsOf(facts, th.actorIds),
        placeIds: last && last.p > 0 ? [last.p] : [],
        sources: facts.slice(-6).map((f) => f.e),
        pattern: def.id,
        kind: 'closing' as const,
        level: level + 100,
        threadId: th.id,
        topics: [def.topic],
        bind,
      };
      const draft =
        view === 'pub'
          ? newDraft({ ...base, voice: 'paper', basis: 'public', optional: true })
          : view === 'pc'
            ? newDraft({ ...base, voice: 'journal', basis: 'witnessed', knownBy: [dc.pcId], authorId: dc.pcId, optional: true })
            : newDraft({ ...base, voice: 'epilogue', basis: 'omniscient', optional: true });
      const e = writeEntry(dc, draft);
      if (e) th.entryIds.push(e.id);
    }
  }
  th.closed = true;
  st.threads.splice(st.threads.indexOf(th), 1);
  st.closedThreads.push({ ...th, facts: th.facts.slice(-3) });
  if (st.closedThreads.length > MAX_CLOSED_THREADS) st.closedThreads.splice(0, st.closedThreads.length - MAX_CLOSED_THREADS);
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

export { asEventId, type ChronicleEntryId };
