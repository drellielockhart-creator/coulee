/**
 * Derived pair index over `world.social.relationships` (never saved, never world state).
 * OWNER: module:social.
 *
 * Kin/estrangement/edge checks run per candidate pair every actor-hour; scanning the whole
 * relationship list for each was O(relationships) per check (quadratic at county scale). The
 * list only changes by `push` (length) or by replacement with a filtered copy (identity), and an
 * edge's endpoints never change, so the index is rebuilt when either changes. Lists keep the
 * relationships' array order, so `find`/`some` over them answer exactly as the full scan did.
 */
import type { ActorId } from '../ids.ts';
import type { World } from '../world.ts';
import type { Relationship } from './state.ts';

interface PairIndex {
  length: number;
  byPair: Map<number, Map<number, Relationship[]>>;
  /** Every relationship of one actor (either end), in relationship-list order. */
  byActor: Map<number, Relationship[]>;
}
const EMPTY: readonly Relationship[] = [];
const indexes = new Map<readonly Relationship[], PairIndex>();

function build(list: readonly Relationship[]): PairIndex {
  const byPair = new Map<number, Map<number, Relationship[]>>();
  const byActor = new Map<number, Relationship[]>();
  for (const r of list) {
    for (const end of r.a === r.b ? [r.a] : [r.a, r.b]) {
      const mine = byActor.get(end);
      if (mine) mine.push(r);
      else byActor.set(end, [r]);
    }
    const lo = Math.min(r.a, r.b),
      hi = Math.max(r.a, r.b);
    let inner = byPair.get(lo);
    if (!inner) {
      inner = new Map();
      byPair.set(lo, inner);
    }
    const rows = inner.get(hi);
    if (rows) rows.push(r);
    else inner.set(hi, [r]);
  }
  return { length: list.length, byPair, byActor };
}

function indexOf(world: World): PairIndex {
  const list = world.social.relationships;
  let index = indexes.get(list);
  if (!index || index.length !== list.length) {
    if (!index && indexes.size >= 16) indexes.clear();
    index = build(list);
    indexes.set(list, index);
  }
  return index;
}

/** Every relationship between `a` and `b` (either direction), in relationship-list order. */
export function relationsBetween(world: World, a: ActorId, b: ActorId): readonly Relationship[] {
  return indexOf(world).byPair.get(Math.min(a, b))?.get(Math.max(a, b)) ?? EMPTY;
}

/** Every relationship `a` has (either end), in relationship-list order. */
export function relationsOf(world: World, a: ActorId): readonly Relationship[] {
  return indexOf(world).byActor.get(a) ?? EMPTY;
}
