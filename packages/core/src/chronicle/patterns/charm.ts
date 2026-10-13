/**
 * "The Charm at ‹town›" (13 §6.7). A thread per charm and settlement. Levels, each from the
 * facts its audience may use (P1):
 *   1 A curiosity: it arrived and someone saw it work.
 *   2 A want: three or more covet acts (asked to see, begged, took), from two households, or two
 *     people each holding it rightly theirs (omniscient).
 *   3 A quarrel: a forced transfer or two loans, plus (omniscient) a boon/bane split of at
 *     least a quarter each or a discovered loss blamed on two people; publicly, a breach or a
 *     shortage the town can connect to it.
 *   Closed: disposed of, or thirty quiet days with steady custody (13 §6.6), naming how.
 * The Truth goes to the epilogue at close (and every 91 days while it runs) with numbers from
 * the charm's own draw ledger, so it stays right after the facts and the log roll away.
 * Milestones (≤ 12, audience-stamped) are kept in thread.data. OWNER: module:chronicle.
 */

import { findThread } from '../engine.ts';
import { newDraft, writeEntry } from '../entries.ts';
import type { Fact } from '../facts.ts';
import { itemSubjectName } from '../names.ts';
import type { PatternParams } from '../params.ts';
import type { Bindings } from '../prose.ts';
import type { ChronicleThread, ThreadFact } from '../state.ts';
import type { Accept, DetectCtx, PatternDef, View } from './types.ts';
import { accept, DAY, householdOfActor, tfOf } from './util.ts';

const COVET = ['ask_to_see', 'beg_loan', 'take'];
const MAX_MILESTONES = 12;
const QUIET_DAYS = 30;
const TRUTH_EVERY = 91;

function itemOf(f: Fact): number {
  const v = f.bind.item_id;
  return typeof v === 'number' ? v : 0;
}
/** The settlement a charm's story belongs to: where the charm is now, else where this happened. */
function siteOf(dc: DetectCtx, itemId: number, placeId: number): string {
  const stack = dc.world.items.stacks[itemId as never] as { location: { kind: string } } | undefined;
  const c = dc.world.fae?.charms?.[itemId as never];
  const pid = stack ? holdingPlace(dc, itemId) : (c?.disposed?.placeId ?? placeId);
  const p = pid ? dc.world.places[pid as never] : undefined;
  return p?.siteId ?? (placeId ? (dc.world.places[placeId as never]?.siteId ?? '') : '');
}
function holdingPlace(dc: DetectCtx, itemId: number): number {
  let cur = dc.world.items.stacks[itemId as never];
  for (let i = 0; i < 16 && cur; i++) {
    const l = cur.location;
    if (l.kind === 'actor') return dc.world.actors[l.actorId]?.placeId ?? 0;
    if (l.kind === 'household') return dc.world.households[l.householdId]?.homePlaceId ?? 0;
    if (l.kind === 'place') return l.placeId;
    cur = dc.world.items.stacks[l.itemId];
  }
  return 0;
}

/** Kind of fact within the thread. */
function kindOf(dc: DetectCtx, f: Fact): string | null {
  if (f.cls === 'charm') {
    switch (f.sub) {
      case 'charm_arrived':
        return 'arr';
      case 'charm_used':
        return 'use';
      case 'charm_drew':
        return 'drew';
      case 'charm_revealed':
        return 'rev';
      case 'charm_disposed':
        return 'disp';
      case 'shortfall':
        return 'short';
      case 'loan_opened':
        return 'loan';
      case 'loan_closed':
        return 'ret';
      case 'loan_breached':
        return 'breach';
      case 'turned_away':
        return 'refuse';
    }
    return null;
  }
  const def = dc.content.interactions[f.sub];
  if (!def?.tags.includes('charm')) return null;
  if (COVET.includes(f.sub)) return f.sub === 'take' && f.success ? 'force' : 'covet';
  if (f.sub === 'demand_return' && f.success === false) return 'force';
  if (f.sub === 'make_restitution' && f.success) return 'rest';
  if (f.sub === 'tell_what_found') return 'tell';
  return null;
}

function count(facts: readonly ThreadFact[], k: string): number {
  let n = 0;
  for (const f of facts) if (f.k === k) n++;
  return n;
}

function levelOf(facts: ThreadFact[], th: ChronicleThread, dc: DetectCtx, view: View): number {
  const seen = count(facts, 'arr') + count(facts, 'use');
  if (seen === 0) return 0;
  let level = 1;
  const covet = facts.filter((f) => f.k === 'covet' || f.k === 'force');
  const households = new Set(covet.map((f) => householdOfActor(dc, f.a)).filter((h) => h > 0));
  const owns = view === 'all' ? (th.data.owns ?? 0) : 0;
  if (covet.length >= 3 && (households.size >= 2 || owns >= 2)) level = 2;
  const transfer = count(facts, 'force') >= 1 || count(facts, 'loan') >= 2;
  const split = view === 'all' && (th.data.split ?? 0) > 0;
  const blamed = view === 'all' && (th.data.blamed ?? 0) >= 2 && count(facts, 'short') >= 1;
  const publicQuarrel = view !== 'all' && (count(facts, 'breach') >= 1 || count(facts, 'tell') >= 1);
  if (level >= 2 && transfer && (split || blamed || publicQuarrel)) level = 3;
  return level;
}

/** Live reading of the charm's standing in town (omniscient numbers for the record). */
function sample(dc: DetectCtx, th: ChronicleThread): void {
  const itemId = th.data.item ?? 0;
  const w = dc.world;
  const adults = Object.values(w.actors).filter((a) => a.alive);
  let owns = 0;
  let boon = 0;
  let bane = 0;
  let readers = 0;
  let notorious = 0;
  for (const a of adults) {
    let any = false;
    let b0 = 0;
    let b1 = 0;
    for (const id of w.belief.beliefsByHolder[a.id] ?? []) {
      const b = w.belief.beliefs[id];
      const p = b ? w.belief.props[b.propId] : undefined;
      if (!b || !p?.args.some((x) => x.kind === 'item' && x.id === itemId)) continue;
      if (b.credence > 20) any = true;
      if (p.pred === 'owns' && b.credence >= 50) owns++;
      if (p.pred === 'boon' && b.credence >= 50) b0 = 1;
      if (p.pred === 'bane' && b.credence >= 50) b1 = 1;
    }
    if (any) notorious++;
    if (b0 || b1) readers++;
    boon += b0;
    bane += b1;
  }
  th.data.owns = owns;
  th.data.notoriety = adults.length ? Math.floor((notorious * 1000) / adults.length) : 0;
  th.data.split = readers >= 4 && boon * 4 >= readers && bane * 4 >= readers ? 1 : 0;
  // Discovered losses blamed on someone (a linked misfortune's attributions to an actor).
  let blamed = 0;
  for (const key of Object.keys(w.fae.drawCases ?? {}).sort()) {
    const dcase = w.fae.drawCases?.[key];
    if (!dcase || dcase.itemId !== itemId || dcase.misfortuneId === null) continue;
    const m = w.belief.misfortunes[dcase.misfortuneId];
    blamed += m?.attributions.filter((at) => at.leader?.kind === 'actor').length ?? 0;
  }
  th.data.blamed = blamed;
}

function milestone(th: ChronicleThread, level: number, view: View, t: number): void {
  const n = th.data.m_n ?? 0;
  if (n >= MAX_MILESTONES) return;
  if (
    Array.from({ length: n }, (_, i) => i).some(
      (i) => th.data[`m${i}_lvl`] === level && th.data[`m${i}_aud`] === audience(view),
    )
  )
    return;
  th.data[`m${n}_lvl`] = level;
  th.data[`m${n}_aud`] = audience(view);
  th.data[`m${n}_t`] = t;
  th.data.m_n = n + 1;
}
function audience(view: View): number {
  return view === 'pub' ? 0 : view === 'pc' ? 1 : 2;
}

/** How it ended, from the world as it now stands (13 §6.6). */
function resolutionOf(dc: DetectCtx, th: ChronicleThread, facts: readonly ThreadFact[], view: View = 'all'): string {
  if (view !== 'all') {
    const disposal = [...facts].reverse().find((f) => f.k === 'disp');
    if (disposal && ['buried', 'destroyed', 'returned'].includes(disposal.x)) return disposal.x;
    if (count(facts, 'rest') > 0) return 'restitution';
    if (count(facts, 'ret') >= 2 && count(facts, 'breach') === 0) return 'shared';
    return 'quiet';
  }
  const itemId = th.data.item ?? 0;
  const c = dc.world.fae?.charms?.[itemId as never];
  if (c?.disposed) return c.disposed.kind;
  if (count(facts, 'rest') > 0 || (th.data.rest ?? 0) > 0) return 'restitution';
  const cases = Object.values(dc.world.fae?.drawCases ?? {}).filter((x) => x.itemId === itemId);
  if (cases.some((x) => x.accepted)) return 'accepted';
  // Shared out means a rota still running: two clean returns, the last within the quiet window.
  const rota = Object.values(dc.world.social.rotas ?? {}).find(
    (r) =>
      r.itemId === itemId &&
      r.returned >= 2 &&
      r.breaches === 0 &&
      r.lastAt >= (dc.ctx.now as number) - (QUIET_DAYS + 7) * DAY,
  );
  if (rota) return 'shared';
  if (c && c.virtue <= 0) return 'dormant';
  if ((th.data.notoriety ?? 0) < 200) return 'quiet';
  return 'settled';
}

const RESOLUTION_WORDS: Record<string, string> = {
  destroyed: 'burned at the forge',
  buried: 'buried with iron on it',
  returned: 'given back to the Good Neighbors',
  restitution: 'paid for, in flour and in cash',
  accepted: 'kept with the knowledge and consent of those it takes from',
  shared: 'shared out between households, week and week about',
  dormant: 'left to go quiet, its virtue spent',
  quiet: 'kept quietly',
  settled: 'let be',
};

function keeperOfThread(facts: readonly ThreadFact[]): number {
  const last = [...facts].reverse().find((f) => f.k === 'use' || f.k === 'arr' || f.k === 'loan' || f.k === 'ret');
  if (!last) return 0;
  return last.k === 'loan' ? last.b || last.a : last.a;
}

/** Who kept the charm when its last story closed (-1 if it has had none). */
function previousKeeper(dc: DetectCtx, th: ChronicleThread): number {
  return dc.world.chronicle.charmMemo?.[th.data.item ?? 0]?.keeperId ?? -1;
}

function nameOf(dc: DetectCtx, id: number): string {
  const a = dc.world.actors[id as never];
  return a ? `${a.name.given} ${a.name.family}`.trim() : '';
}

/** "1,140 lb from the Pratts' stores, 600 lb from the mill". Omniscient. */
function sourceWords(dc: DetectCtx, itemId: number): { text: string; lb: number } {
  const c = dc.world.fae?.charms?.[itemId as never];
  if (!c) return { text: 'nothing that anyone counted', lb: 0 };
  const parts: Array<{ lb: number; name: string }> = [];
  let total = 0;
  for (const key of Object.keys(c.drawLedger).sort()) {
    const lb = c.drawLedger[key] ?? 0;
    total += lb;
    const id = Number(key.slice(1));
    const name = key.startsWith('h')
      ? (dc.world.households[id as never]?.name ?? 'a household')
      : (dc.world.places[id as never]?.name ?? 'a store');
    const lower = name.replace(/^The /, 'the ');
    parts.push({ lb, name: key.startsWith('h') ? `the stores of ${lower}` : lower });
  }
  parts.sort((a, b) => b.lb - a.lb || (a.name < b.name ? -1 : 1));
  const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return {
    text: parts.length ? parts.map((p) => `${fmt(p.lb)} lb from ${p.name}`).join(', ') : 'nothing at all',
    lb: total,
  };
}

function claimWords(dc: DetectCtx, itemId: number): string {
  const c = dc.world.fae?.charms?.[itemId as never];
  const def = c ? dc.content.charms?.[c.defId] : undefined;
  if (!def) return '';
  let best = { n: -1, text: '' };
  for (const x of def.claims) {
    if (x.route === 'truth') continue;
    const key = `claim.${def.id}.${x.id}(i:${itemId})`;
    const prop = dc.world.belief.propByKey[key];
    if (prop === undefined) continue;
    let n = 0;
    for (const a of Object.values(dc.world.actors)) {
      const id = (dc.world.belief.beliefsByHolder[a.id] ?? []).find((b) => dc.world.belief.beliefs[b]?.propId === prop);
      if (id !== undefined && (dc.world.belief.beliefs[id]?.credence ?? 0) >= 40) n++;
    }
    if (n > best.n) best = { n, text: x.text.replace('{0} ', '').replace('{0}', 'it') };
  }
  return best.text;
}

function blameWords(dc: DetectCtx, itemId: number): string {
  for (const key of Object.keys(dc.world.fae?.drawCases ?? {}).sort()) {
    const dcase = dc.world.fae?.drawCases?.[key];
    if (!dcase || dcase.itemId !== itemId || dcase.misfortuneId === null) continue;
    const m = dc.world.belief.misfortunes[dcase.misfortuneId];
    const counts = new Map<number, number>();
    for (const at of m?.attributions ?? [])
      if (at.leader?.kind === 'actor') counts.set(at.leader.id, (counts.get(at.leader.id) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    if (top) {
      const h = dc.world.households[dcase.householdId as never];
      return ` The loss at ${h?.name ?? 'the stores'} was laid at ${nameOf(dc, top[0])}'s door, who never had it.`;
    }
  }
  return '';
}

/** This charm's story memory, created on first use (worlds without charms keep their hash). */
function memoOf(dc: DetectCtx, itemId: number): { truthLb?: number; keeperId?: number } {
  dc.world.chronicle.charmMemo ??= {};
  const memo = dc.world.chronicle.charmMemo;
  memo[itemId] ??= {};
  return memo[itemId] as { truthLb?: number; keeperId?: number };
}

/** The pounds the last Truth for this charm named: this thread's, else any earlier story's. */
function lastTruthLb(dc: DetectCtx, th: ChronicleThread): number | undefined {
  if (th.data.truth_lb !== undefined) return th.data.truth_lb;
  return dc.world.chronicle.charmMemo?.[th.data.item ?? 0]?.truthLb;
}

function writeTruth(dc: DetectCtx, th: ChronicleThread, final: boolean): void {
  const itemId = th.data.item ?? 0;
  const src = sourceWords(dc, itemId);
  memoOf(dc, itemId);
  // A Truth that would only repeat the last one (a thread reopened with nothing newly drawn) is
  // not written again.
  if (lastTruthLb(dc, th) === src.lb) {
    delete th.data.truth_pending;
    th.truthDone = final || th.truthDone;
    th.data.truth_t = dc.ctx.now as number;
    th.data.truth_lb = src.lb;
    return;
  }
  const draft = newDraft({
    key: 'charm.truth',
    importance: 70,
    terms: [],
    valence: -20,
    t: dc.ctx.now as number,
    tEnd: dc.ctx.now as number,
    actorIds: th.actorIds.slice(0, 4),
    placeIds: [],
    sources: [],
    pattern: 'charm',
    kind: 'truth',
    level: final ? 200 : 199,
    threadId: th.id,
    topics: ['charm'],
    voice: 'epilogue',
    basis: 'omniscient',
    bind: {
      charm: itemSubjectName(dc.world, dc.content, itemId),
      source: src.text,
      lb: src.lb,
      blame: blameWords(dc, itemId),
      truth: true,
      closed: final,
    },
  });
  const e = writeEntry(dc, draft);
  if (!e) {
    th.data.truth_pending = final ? 2 : 1;
    return;
  }
  delete th.data.truth_pending;
  th.entryIds.push(e.id);
  th.truthDone = final || th.truthDone;
  th.data.truth_t = dc.ctx.now as number;
  th.data.truth_lb = src.lb;
  memoOf(dc, itemId).truthLb = src.lb;
}

/**
 * Refusal costs (wave 6) told in the epilogue: a neighbor turned away a third time, and the day the
 * keeper lent it at last to someone once turned away. Each is told once per asker.
 */
function refusalLines(dc: DetectCtx, th: ChronicleThread): void {
  const hh = (id: number) => dc.world.actors[id as never]?.householdId;
  for (const f of th.facts) {
    if (f.k === 'refuse' && f.w >= 3 && !th.data[`refused_${f.b}`]) {
      th.data[`refused_${f.b}`] = 1;
      writeRefusalLine(dc, th, 'charm.refused', f.a, f.b);
    }
    if (f.k === 'loan' && f.b > 0 && !th.data[`relent_${hh(f.b)}`]) {
      const once = th.facts.find((r) => r.k === 'refuse' && r.t < f.t && hh(r.b) === hh(f.b) && r.a > 0);
      if (!once) continue;
      th.data[`relent_${hh(f.b)}`] = 1;
      writeRefusalLine(dc, th, 'charm.relented', f.a, once.b);
    }
  }
}

function writeRefusalLine(dc: DetectCtx, th: ChronicleThread, key: string, keeper: number, asker: number): void {
  const draft = newDraft({
    key,
    importance: 60,
    terms: [],
    valence: key === 'charm.refused' ? -20 : 15,
    t: dc.ctx.now as number,
    tEnd: dc.ctx.now as number,
    actorIds: [keeper, asker].filter((x) => x > 0),
    placeIds: [],
    sources: [],
    pattern: 'charm',
    kind: 'pattern',
    level: 150,
    threadId: th.id,
    topics: ['charm'],
    voice: 'epilogue',
    basis: 'omniscient',
    bind: {
      charm: itemSubjectName(dc.world, dc.content, th.data.item ?? 0),
      keeper: nameOf(dc, keeper),
      keeper_short: dc.world.actors[keeper as never]?.name.given ?? '',
      asker: nameOf(dc, asker),
      asker_short: dc.world.actors[asker as never]?.name.given ?? '',
    },
  });
  const e = writeEntry(dc, draft);
  if (e) th.entryIds.push(e.id);
}

export const charm: PatternDef = {
  id: 'charm',
  entryKeys: ['charm.refused', 'charm.relented'],
  topic: 'charm',
  importance: 55,
  balladLevel: 3,
  suppressSingles: true,
  closingLevel: 1,

  accept(f: Fact, dc: DetectCtx): Accept[] {
    const k = kindOf(dc, f);
    if (k === null) return [];
    const itemId = itemOf(f);
    if (!itemId) return [];
    const key = `i${itemId}@${siteOf(dc, itemId, f.place)}`;
    const th = findThread(dc, 'charm', key);
    // Daily uses are texture: the story keeps the first three, and counts the rest.
    if (k === 'use' && th && count(th.facts, 'use') >= 3) {
      th.data.uses = (th.data.uses ?? 0) + 1;
      return [];
    }
    if (k === 'rest' && th) th.data.rest = (th.data.rest ?? 0) + 1;
    // A draw and a shortfall connect to the charm only in the omniscient view (P1): who is
    // short does not know why. Revealed facts stay with the one who learned them.
    // A keeper's conscience over a refusal is inner: the story knows it only omnisciently.
    const hidden = k === 'drew' || k === 'short' || k === 'refuse';
    const tf = tfOf(f, k, {
      ...(hidden ? { pub: 0, by: [] } : {}),
      ...(k === 'disp' ? { x: String(f.bind.disposal ?? '') } : {}),
    });
    return [accept(key, tf, { actors: [f.agent, f.target].filter((x) => x > 0), tags: { item: String(itemId) } })];
  },

  level(facts: ThreadFact[], th: ChronicleThread, dc: DetectCtx, _p: PatternParams, view: View): number {
    th.data.item ??= Number(th.tags.item ?? 0);
    if (view === 'all') sample(dc, th);
    const level = levelOf(facts, th, dc, view);
    if (level > 0) milestone(th, level, view, dc.ctx.now as number);
    return level;
  },

  bind(
    facts: ThreadFact[],
    th: ChronicleThread,
    level: number,
    dc: DetectCtx,
    _p: PatternParams,
    view: View,
  ): Bindings {
    const itemId = th.data.item ?? 0;
    const keeper = keeperOfThread(facts);
    const loan = [...facts].reverse().find((f) => f.k === 'loan');
    const resolution = resolutionOf(dc, th, facts, view);
    const out: Bindings = {
      charm: itemSubjectName(dc.world, dc.content, itemId),
      claim: claimWords(dc, itemId) || 'keeps a family in bread',
      keeper: keeper ? nameOf(dc, keeper) : 'a household out on the coulee',
      keeper_short: keeper ? (dc.world.actors[keeper as never]?.name.given ?? '') : 'they',
      lent_to: loan ? nameOf(dc, loan.b) : '',
      resolution: RESOLUTION_WORDS[resolution] ?? 'let be',
      level,
      // A story told again (the thread reopened after closing) has no arrival in it: it must not
      // say the sack came to its present keeper out of the grass; under the same keeper as the
      // story before it is no news at all ('still': no arrival line).
      stage: count(facts, 'arr') > 0 ? 'arrived' : previousKeeper(dc, th) === keeper ? 'still' : 'again',
    };
    // The omniscient view sees every fact: only it records who kept the charm in this story.
    if (view === 'all' && keeper) th.data.keeper_id = keeper;
    if (view === 'all') {
      const src = sourceWords(dc, itemId);
      out.source = src.text;
      out.lb = src.lb;
    }
    return out;
  },

  importanceAt(level: number): number {
    return level >= 3 ? 75 : level === 2 ? 65 : 55;
  },

  valence(th: ChronicleThread): number {
    return (th.data.split ?? 0) > 0 ? -30 : -10;
  },

  daily(dc: DetectCtx): Accept[] {
    for (const th of dc.world.chronicle.threads) {
      if (th.pattern !== 'charm') continue;
      if (th.data.truth_pending) writeTruth(dc, th, th.data.truth_pending === 2);
      refusalLines(dc, th);
      const since = (th.data.truth_t ?? th.openedAt) as number;
      if ((dc.ctx.now as number) - since >= TRUTH_EVERY * DAY && (th.data.uses ?? 0) + th.facts.length > 3)
        writeTruth(dc, th, false);
    }
    return [];
  },

  stale(th: ChronicleThread, dc: DetectCtx): boolean {
    const now = dc.ctx.now as number;
    const disposed = th.facts.some((f) => f.k === 'disp');
    const unsettled = ['force', 'short', 'breach', 'loan', 'ret', 'covet', 'arr', 'disp'];
    const last = Math.max(th.openedAt as number, ...th.facts.filter((f) => unsettled.includes(f.k)).map((f) => f.t));
    const openLoan = (dc.world.social.objectLoans ?? []).some(
      (l) => l.itemId === (th.data.item ?? 0) && l.status === 'open',
    );
    const close = disposed ? now - last >= DAY : now - last >= QUIET_DAYS * DAY && !openLoan;
    if (close && !th.truthDone) {
      th.tags.resolution = resolutionOf(dc, th, th.facts);
      writeTruth(dc, th, true);
    }
    if (close && th.data.keeper_id) memoOf(dc, th.data.item ?? 0).keeperId = th.data.keeper_id;
    return close && th.truthDone;
  },
};
