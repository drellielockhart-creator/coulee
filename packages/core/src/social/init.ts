/**
 * Seed social state from the scenario (04 §4.1, §6.2, §7.1). OWNER: module:social.
 *
 * - Relationship edges (with their age from `days`), creditor amounts into the mirrored
 *   obligation ledger.
 * - Opinion records for every structural pair and every household pair: base =
 *   compatibility + relationship priors + household prior. These are the acquaintances.
 * - Scenario opinions become seed Reasons; scenario memories become backstory Memories
 *   (pre-decayed by `days_ago`) and, if they carry an opinion delta, Reasons citing them so
 *   they fade as the memory fades.
 */
import { type ActorId, idsOf, mustGet } from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import { asGameMinute, MINUTES_PER_DAY } from '../time.ts';
import type { World } from '../world.ts';
import { decayOneDay, encodeSalience, insertMemory, isNegativeKind, memoryFloor, memoryTauDays } from './memory.ts';
import { isZeroDims } from './model.ts';
import { addReason, adjustLedger, ensureOpinion, opinionLabel, opinionOf, refreshBase } from './opinion.ts';
import { tuningOf } from './tuning.ts';

/** Backstory decay is simulated day by day, at most this many days. */
const MAX_BACKSTORY_DAYS = 3650;

export function initSocialState(world: World, ctx: InitContext): void {
  const content = ctx.content;
  const key = (k: string): ActorId | undefined => world.index.actorByKey[k];
  for (const id of idsOf<ActorId>(world.actors)) {
    mustGet(world.actors, id, 'actor');
    world.social.opinions[id] ??= {};
    world.social.memoriesByOwner[id] ??= [];
  }
  // Structural edges first, so every base sees all of them.
  for (const r of ctx.scenario.relationships) {
    const a = key(r.a);
    const b = key(r.b);
    if (a === undefined || b === undefined || a === b) continue;
    const since = asGameMinute(ctx.now - (r.days ?? 0) * MINUTES_PER_DAY);
    world.social.relationships.push({ a, b, kind: r.kind, since, amountCents: r.amount_cents ?? null });
  }
  for (const r of world.social.relationships) {
    ensureOpinion(world, content, r.a, r.b);
    ensureOpinion(world, content, r.b, r.a);
    refreshBase(world, content, r.a, r.b);
    if (r.kind === 'creditor' && r.amountCents !== null && r.amountCents > 0) {
      adjustLedger(world, content, r.a, r.b, { favors: 0, cents: r.amountCents });
    }
  }
  // Household members know each other.
  for (const hid of idsOf(world.households)) {
    const h = world.households[hid];
    if (!h) continue;
    for (const a of h.memberIds) {
      for (const b of h.memberIds) {
        if (a !== b) ensureOpinion(world, content, a, b);
      }
    }
  }
  for (const o of ctx.scenario.opinions) {
    const from = key(o.from);
    const to = key(o.to);
    if (from === undefined || to === undefined || from === to) continue;
    addReason(
      world,
      content,
      from,
      to,
      {
        label: o.reason,
        cites: { kind: 'seed' },
        delta: { affection: o.affection, respect: o.respect, trust: o.trust, fear: o.fear },
        since: ctx.now,
      },
      ctx.now,
    );
  }
  const t = tuningOf(content);
  for (const s of ctx.scenario.memories ?? []) {
    const owner = key(s.owner);
    const about = key(s.about);
    if (owner === undefined || about === undefined || owner === about) continue;
    const days = Math.min(MAX_BACKSTORY_DAYS, s.days_ago);
    const at = asGameMinute(ctx.now - s.days_ago * MINUTES_PER_DAY);
    const id = insertMemory(world, ctx, {
      ownerId: owner,
      eventId: null,
      kind: s.kind,
      at,
      placeId: null,
      roles: [
        { who: about, role: 'agent', conf: 100 },
        { who: owner, role: isNegativeKind(content, s.kind) ? 'victim' : 'target', conf: 100 },
      ],
      source: { kind: 'witnessed' },
      emotion: s.emotion,
      intensity: s.intensity,
      salience: encodeSalience(content, s.intensity),
      confidence: 1000,
      rehearsals: 0,
      pinned: false,
      summary: s.summary,
      aboutId: about,
      did: false,
    });
    const m = world.social.memories[id];
    if (m) {
      const tau = memoryTauDays(world, content, m);
      const floor = memoryFloor(content, m);
      for (let d = 0; d < days && m.salience > floor; d++) m.salience = decayOneDay(m.salience, tau, floor);
      if (m.salience < t.forget_below) m.salience = t.forget_below;
    }
    ensureOpinion(world, content, owner, about);
    const delta = { affection: s.affection, respect: s.respect, trust: s.trust, fear: s.fear };
    if (!isZeroDims(delta)) {
      addReason(
        world,
        content,
        owner,
        about,
        { label: s.reason ?? s.summary, cites: { kind: 'memory', id }, delta, since: at },
        ctx.now,
      );
    }
  }
  // Labels start from the seeded numbers (no label_changed events at init).
  for (const from of idsOf<ActorId>(world.social.opinions)) {
    const table = world.social.opinions[from] ?? {};
    for (const to of idsOf<ActorId>(table)) {
      const op = table[to];
      if (op) op.label = opinionLabel(opinionOf(world, from, to));
    }
  }
}
