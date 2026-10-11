/**
 * Branded numeric ids for runtime entities.
 *
 * - Runtime entities (actors, places, events, memories...) get integer ids allocated from
 *   monotonically increasing counters that live in world state. Ids are never reused.
 * - Content definitions (items, needs, activities...) are identified by their TOML `id`
 *   string (snake_case). Those are plain `string` aliases, see `content.ts`.
 *
 * All id kinds any module needs are declared here so no module has to edit this file.
 */

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type ActorId = Brand<number, 'ActorId'>;
export type HouseholdId = Brand<number, 'HouseholdId'>;
export type PlaceId = Brand<number, 'PlaceId'>;
export type EventId = Brand<number, 'EventId'>;
/** An item *instance* (a specific sack of flour), not an item definition. */
export type ItemId = Brand<number, 'ItemId'>;
export type ThoughtId = Brand<number, 'ThoughtId'>;
export type MemoryId = Brand<number, 'MemoryId'>;
export type BeliefId = Brand<number, 'BeliefId'>;
/** An interned proposition (04 §5.1). */
export type PropId = Brand<number, 'PropId'>;
export type RumorId = Brand<number, 'RumorId'>;
/** A rumor identity such as "the Bluff Witch" (00 glossary: Figure). */
export type FigureId = Brand<number, 'FigureId'>;
export type GrudgeId = Brand<number, 'GrudgeId'>;
export type ChronicleEntryId = Brand<number, 'ChronicleEntryId'>;

export const asActorId = (n: number): ActorId => n as ActorId;
export const asHouseholdId = (n: number): HouseholdId => n as HouseholdId;
export const asPlaceId = (n: number): PlaceId => n as PlaceId;
export const asEventId = (n: number): EventId => n as EventId;
export const asItemId = (n: number): ItemId => n as ItemId;
export const asThoughtId = (n: number): ThoughtId => n as ThoughtId;
export const asMemoryId = (n: number): MemoryId => n as MemoryId;
export const asBeliefId = (n: number): BeliefId => n as BeliefId;
export const asPropId = (n: number): PropId => n as PropId;
export const asRumorId = (n: number): RumorId => n as RumorId;
export const asFigureId = (n: number): FigureId => n as FigureId;
export const asGrudgeId = (n: number): GrudgeId => n as GrudgeId;
export const asChronicleEntryId = (n: number): ChronicleEntryId => n as ChronicleEntryId;

/**
 * A table of entities keyed by integer id. Plain object so the world stays JSON-able.
 *
 * Determinism: never iterate with `for...in` / `Object.values` and rely on that order
 * implicitly. Use `idsOf(table)` / `rowsOf(table)`, which return ascending id order.
 */
// biome-ignore lint/correctness/noUnusedVariables: Id documents the key kind (phantom).
export type Table<Id extends number, Row> = { [id: number]: Row };

/** Ascending ids of a table (total order on integers). */
export function idsOf<Id extends number>(table: Table<Id, unknown>): Id[] {
  // ECMAScript (OrdinaryOwnPropertyKeys) lists integer-index keys in ascending numeric order on
  // every engine, so the keys of an id table normally arrive sorted. Verify in one pass and sort
  // only if a non-index key ever breaks that (hot path: called thousands of times per game-hour).
  const keys = Object.keys(table);
  const out: number[] = new Array(keys.length);
  let sorted = true;
  let prev = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < keys.length; i++) {
    const n = Number(keys[i]);
    out[i] = n;
    if (n < prev) sorted = false;
    prev = n;
  }
  if (!sorted) out.sort((a, b) => a - b);
  return out as Id[];
}

/** Rows of a table in ascending id order. */
export function rowsOf<Id extends number, Row>(table: Table<Id, Row>): Row[] {
  const out: Row[] = [];
  for (const id of idsOf<Id>(table)) {
    const row = table[id];
    if (row !== undefined) out.push(row);
  }
  return out;
}

/** Lookup that throws on a missing id (programming error, not a game state). */
export function mustGet<Id extends number, Row>(table: Table<Id, Row>, id: Id, what = 'row'): Row {
  const row = table[id];
  if (row === undefined) throw new Error(`missing ${what} ${id}`);
  return row;
}

/**
 * Allocate the next id from a counter object field. Counters start at 1; 0 is never a valid id.
 * Usage: `const id = asMemoryId(nextId(world.social.counters, 'memory'))`.
 */
export function nextId<K extends string>(counters: Record<K, number>, key: K): number {
  const id = counters[key] + 1;
  counters[key] = id;
  return id;
}
