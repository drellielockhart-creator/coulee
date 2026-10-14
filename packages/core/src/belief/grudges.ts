/**
 * Read-only grudge queries with no runtime imports (a leaf: activity reads it without closing an
 * import cycle through belief/api). OWNER: module:belief.
 */
import { type ActorId, type GrudgeId, type HouseholdId, idsOf } from '../ids.ts';
import type { World } from '../world.ts';

/**
 * Whom `holderId` bears a live grudge against (04 §5.4): actor ids and household ids, ascending.
 * For callers that keep the holder away from (or send them toward) the grudge's target.
 */
export function grudgeTargetsOf(world: World, holderId: ActorId): { actors: ActorId[]; households: HouseholdId[] } {
  const actors: ActorId[] = [];
  const households: HouseholdId[] = [];
  for (const g of grudgesHeldBy(world, holderId)) {
    if (g.intensity <= 0) continue;
    if (g.target.kind === 'actor' && !actors.includes(g.target.id)) actors.push(g.target.id);
    if (g.target.kind === 'household' && !households.includes(g.target.id)) households.push(g.target.id);
  }
  return { actors: actors.sort((a, b) => a - b), households: households.sort((a, b) => a - b) };
}

type GrudgeRow = World['belief']['grudges'][GrudgeId] & {};
/**
 * Derived holder index (never saved). Grudge rows are only ever added through the grudge counter
 * and `holderId` never changes, so the index is rebuilt when the table object or the counter
 * changes; rows are re-checked live, so a removed or replaced row is never returned. Bounded.
 */
const holderIndex = new Map<object, { counter: number; byHolder: Map<ActorId, GrudgeRow[]> }>();
/** `holderId`'s grudge rows in ascending id order (the order `rowsOf` gives). */
export function grudgesHeldBy(world: World, holderId: ActorId): GrudgeRow[] {
  const table = world.belief.grudges;
  const counter = world.belief.counters.grudge ?? 0;
  let index = holderIndex.get(table);
  if (!index || index.counter !== counter) {
    const byHolder = new Map<ActorId, GrudgeRow[]>();
    for (const id of idsOf<GrudgeId>(table)) {
      const g = table[id];
      if (!g) continue;
      const list = byHolder.get(g.holderId);
      if (list) list.push(g);
      else byHolder.set(g.holderId, [g]);
    }
    if (!holderIndex.has(table) && holderIndex.size >= 64) holderIndex.clear();
    index = { counter, byHolder };
    holderIndex.set(table, index);
  }
  const rows = index.byHolder.get(holderId);
  if (!rows) return [];
  return rows.filter((g) => table[g.id] === g && g.holderId === holderId);
}
