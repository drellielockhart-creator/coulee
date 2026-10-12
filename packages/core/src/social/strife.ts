/**
 * Strife between two people (04 §10, §11.2): pair weariness, the rupture that ends a loop
 * inside one household or family, and the mediation (or the time) that ends a rupture.
 * OWNER: module:social.
 *
 * - Every hostile act between A and B is stamped on both opinion records (`strife`, fights
 *   also on `fights`). Each act in the last `strife_window_days` multiplies further hostile
 *   volition, urges, retaliation and displaced acts between them by `strife_weariness_pct`%.
 * - `rupture_fights` fights in `rupture_window_days` between people of one household (or kin)
 *   and they stop speaking: an `estranged` edge, a `social.rupture` event. While estranged,
 *   only interactions tagged in `estranged_allow_tags` (amends) pass between them.
 * - A rupture ends after `estrangement_days`, or sooner when a third party fond of both
 *   (Affection ≥ `mediation_min_affection` toward each) is with one of them and talks them
 *   round (a skill check vs `mediation_dc`): `social.mediation`, then `social.reconciled`.
 */
import { abilityMod, shortName } from '../actor.ts';
import { skillCheck } from '../checks.ts';
import type { ContentBundle } from '../content.ts';
import { type ExplainTerm, term } from '../explain.ts';
import type { ActorId, EventId, PlaceId } from '../ids.ts';
import { autonomous } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { MINUTES_PER_DAY } from '../time.ts';
import type { World } from '../world.ts';
import { softenMemories } from './memory.ts';
import { ZERO_DIMS } from './model.ts';
import { ensureOpinion, opinionOf, opinionRecord, refreshBase, refreshLabel } from './opinion.ts';
import { ageYears, tuningOf } from './tuning.ts';

const SALT_MEDIATE = 0x3ed1a7e;
/** Stamps kept per record (the windows are short; this only bounds a pathological day). */
const MAX_STAMPS = 24;

function stamp(list: number[] | undefined, now: number, keepFrom: number): number[] {
  const out = (list ?? []).filter((t) => t >= keepFrom);
  out.push(now);
  return out.length > MAX_STAMPS ? out.slice(out.length - MAX_STAMPS) : out;
}

const countSince = (list: readonly number[] | undefined, from: number): number => {
  let n = 0;
  for (const t of list ?? []) if (t >= from) n++;
  return n;
};

/** Hostile acts between the pair (either direction) in the weariness window. */
export function strifeCount(world: World, content: ContentBundle, a: ActorId, b: ActorId, now: number): number {
  const t = tuningOf(content);
  return countSince(opinionRecord(world, a, b)?.strife, now - t.strife_window_days * MINUTES_PER_DAY);
}

/** Per-mille multiplier on further hostility between the pair: pct^n (1000 = none). */
export function wearinessPermille(content: ContentBundle, n: number): number {
  const pct = tuningOf(content).strife_weariness_pct;
  let pm = 1000;
  for (let i = 0; i < n && pm > 0; i++) pm = Math.floor((pm * pct) / 100);
  return pm;
}

/** The named term that scales a positive hostile score by the pair's weariness (P1), or null. */
export function wearinessTerm(
  world: World,
  content: ContentBundle,
  a: ActorId,
  b: ActorId,
  now: number,
  score: number,
  source = 'memory',
): ExplainTerm | null {
  if (score <= 0) return null;
  const n = strifeCount(world, content, a, b, now);
  if (n === 0) return null;
  const kept = Math.floor((score * wearinessPermille(content, n)) / 1000);
  const t = tuningOf(content);
  return term(
    source,
    `Weary of it: ${n} quarrel${n === 1 ? '' : 's'} with them in ${t.strife_window_days} days`,
    kept - score,
  );
}

export function isEstranged(world: World, a: ActorId, b: ActorId): boolean {
  for (const r of world.social.relationships) {
    if (r.kind === 'estranged' && ((r.a === a && r.b === b) || (r.a === b && r.b === a))) return true;
  }
  return false;
}

function sameHouse(world: World, a: ActorId, b: ActorId): boolean {
  const x = world.actors[a];
  const y = world.actors[b];
  return x !== undefined && y !== undefined && x.householdId === y.householdId;
}

/**
 * Record a hostile act between the pair (called by resolveInteraction). A household or family
 * quarrel that has come to blows `rupture_fights` times in the window ruptures: they stop speaking.
 */
export function noteStrife(
  world: World,
  ctx: SimContext,
  i: ActorId,
  tg: ActorId,
  violent: boolean,
  eventId: EventId,
  kin: boolean,
): void {
  const content = ctx.content;
  const t = tuningOf(content);
  const now = ctx.now;
  const keepFrom = now - Math.max(t.strife_window_days, t.rupture_window_days) * MINUTES_PER_DAY;
  for (const [x, y] of [
    [i, tg],
    [tg, i],
  ] as const) {
    const rec = ensureOpinion(world, content, x, y);
    rec.strife = stamp(rec.strife, now, keepFrom);
    if (violent) rec.fights = stamp(rec.fights, now, keepFrom);
  }
  if (!violent || isEstranged(world, i, tg)) return;
  const household = sameHouse(world, i, tg);
  if (!household && !kin) return;
  const fights = countSince(opinionRecord(world, i, tg)?.fights, now - t.rupture_window_days * MINUTES_PER_DAY);
  if (fights < t.rupture_fights) return;
  const [a, b] = i < tg ? [i, tg] : [tg, i];
  world.social.relationships.push({ a, b, kind: 'estranged', since: now, amountCents: null });
  refreshBase(world, content, a, b);
  const place = world.actors[i]?.placeId;
  ctx.emit({
    kind: 'social.rupture',
    roles: [
      { actor: i, role: 'agent' },
      { actor: tg, role: 'target' },
    ],
    // A house where blows are struck four times in a month is talked about (P1: the neighbors
    // heard it); the Paper treats it as gossip about a house, not as a reported brawl.
    visibility: 'public',
    importance: 55,
    ...(place !== undefined ? { place } : {}),
    causes: [eventId],
    explain: {
      kind: 'formula',
      label: `${nameOf(world, i)} and ${nameOf(world, tg)} stop speaking`,
      subjects: [i, tg],
      knowledge: 'public',
      terms: [
        term('memory', `Fights in ${t.rupture_window_days} days`, fights),
        term('other', household ? 'Under one roof' : 'Kin', 0),
      ],
      total: fights,
      dc: { total: t.rupture_fights, terms: [term('base', 'Rupture at', t.rupture_fights)] },
      outcome: 'estranged',
    },
    data: { aId: i, bId: tg, fights, household, days: t.estrangement_days },
  });
}

const nameOf = (world: World, id: ActorId): string => {
  const a = world.actors[id];
  return a ? shortName(a) : `#${id}`;
};

function endEstrangement(
  world: World,
  ctx: SimContext,
  a: ActorId,
  b: ActorId,
  mediatorId: ActorId | null,
  cause: EventId | null,
): void {
  const content = ctx.content;
  world.social.relationships = world.social.relationships.filter(
    (r) => !(r.kind === 'estranged' && ((r.a === a && r.b === b) || (r.a === b && r.b === a))),
  );
  refreshBase(world, content, a, b);
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    const rec = opinionRecord(world, x, y);
    if (!rec) continue;
    // The slate the weariness and rupture counted is wiped: a mended quarrel starts fresh.
    rec.strife = [];
    rec.fights = [];
    rec.volatile = { ...ZERO_DIMS };
  }
  refreshLabel(world, ctx, a, b);
  refreshLabel(world, ctx, b, a);
  const t = tuningOf(content);
  ctx.emit({
    kind: 'social.reconciled',
    roles: [
      { actor: a, role: 'agent' },
      { actor: b, role: 'target' },
      ...(mediatorId !== null ? [{ actor: mediatorId, role: 'witness' as const }] : []),
    ],
    visibility: mediatorId !== null ? 'public' : 'witnessed',
    importance: mediatorId !== null ? 45 : 30,
    ...(cause !== null ? { causes: [cause] } : {}),
    explain: {
      kind: 'formula',
      label: `${nameOf(world, a)} and ${nameOf(world, b)} are speaking again`,
      subjects: [a, b],
      knowledge: 'participants',
      terms:
        mediatorId !== null
          ? [term('other', `${nameOf(world, mediatorId)} talked them round`, 1)]
          : [term('base', `${t.estrangement_days} days of silence`, t.estrangement_days)],
      total: 1,
      outcome: 'reconciled',
    },
    data: { aId: a, bId: b, mediatorId },
  });
}

/** 00:00: estrangements that have run their course end on their own. */
export function dailyStrife(world: World, ctx: SimContext): void {
  const t = tuningOf(ctx.content);
  const due = world.social.relationships.filter(
    (r) => r.kind === 'estranged' && ctx.now - r.since >= t.estrangement_days * MINUTES_PER_DAY,
  );
  for (const r of due) endEstrangement(world, ctx, r.a, r.b, null, null);
}

/**
 * Each hour: a third party fond of both, who is with one of an estranged pair, may try to
 * talk them round (once a day per mediator and pair). `pools` are this hour's venues.
 */
export function mediationHour(
  world: World,
  ctx: SimContext,
  pools: ReadonlyArray<{ placeId: PlaceId; pool: ActorId[]; present: Set<number> }>,
  poolOf: ReadonlyMap<number, { placeId: PlaceId; pool: ActorId[] }>,
): void {
  const content = ctx.content;
  const t = tuningOf(content);
  const pairs = world.social.relationships.filter((r) => r.kind === 'estranged');
  if (pairs.length === 0 || pools.length === 0) return;
  for (const r of pairs) {
    if (!isEstranged(world, r.a, r.b)) continue;
    let best: { id: ActorId; party: ActorId; placeId: PlaceId; fond: number } | null = null;
    for (const party of [r.a, r.b]) {
      const venue = poolOf.get(party);
      if (!venue) continue;
      for (const m of venue.pool) {
        if (m === r.a || m === r.b || !autonomous(world, m)) continue;
        const ma = world.actors[m];
        if (!ma || ageYears(ma, ctx.now) < t.mediation_min_age) continue;
        const rec = opinionRecord(world, m, party);
        if (rec && (rec.cooldowns.mediate ?? 0) > ctx.now) continue;
        const fond = Math.min(opinionOf(world, m, r.a).affection, opinionOf(world, m, r.b).affection);
        if (fond < t.mediation_min_affection) continue;
        if (!best || fond > best.fond || (fond === best.fond && m < best.id)) {
          best = { id: m, party, placeId: venue.placeId, fond };
        }
      }
    }
    if (!best) continue;
    const mediator = world.actors[best.id];
    if (!mediator) continue;
    const other = best.party === r.a ? r.b : r.a;
    ensureOpinion(world, content, best.id, best.party).cooldowns.mediate = ctx.now + MINUTES_PER_DAY;
    const rr = ctx.rng('social', mixKey(best.id, r.a, r.b, SALT_MEDIATE));
    const fondTerm = Math.min(4, Math.max(0, Math.floor((best.fond - t.mediation_min_affection) / 10)));
    const res = skillCheck(
      content,
      mediator,
      {
        label: `Make peace: ${nameOf(world, best.id)} between ${nameOf(world, best.party)} and ${nameOf(world, other)}`,
        skill: t.mediation_skill,
        dc: t.mediation_dc,
        modifiers: [
          ...(fondTerm > 0 ? [term('opinion', 'Fond of them both', fondTerm)] : []),
          ...(abilityMod(mediator.sheet.abilities.wis) !== 0
            ? [term('ability', 'Good sense (Wis)', abilityMod(mediator.sheet.abilities.wis))]
            : []),
        ],
      },
      rr,
    );
    const ev = ctx.emit({
      kind: 'social.mediation',
      roles: [
        { actor: best.id, role: 'agent' },
        { actor: best.party, role: 'target' },
        { actor: other, role: 'subject' },
      ],
      visibility: 'witnessed',
      importance: res.success ? 40 : 20,
      place: best.placeId,
      explain: res.explain,
      data: { mediatorId: best.id, aId: best.party, bId: other, success: res.success },
    });
    if (!res.success) continue;
    softenMemories(world, content, r.a, r.b, t.mediation_soften_pct);
    softenMemories(world, content, r.b, r.a, t.mediation_soften_pct);
    endEstrangement(world, ctx, r.a, r.b, best.id, ev);
  }
}
