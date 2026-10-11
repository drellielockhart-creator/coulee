/**
 * Provisions view parts (P8 legibility). OWNER: module:provisions.
 * Contract with module:web (see needs/view.ts note).
 */
import type { ContentBundle } from '../content.ts';
import { type ActorId, type HouseholdId, type PlaceId, rowsOf } from '../ids.ts';
import { pantryOf, stacksAt } from '../items/api.ts';
import { type ItemStackView, viewStacks } from '../items/view.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';
import { priceAt, type Readiness, readinessOf } from './api.ts';

export interface NutritionView {
  kcalToday: number;
  /** Mean over the recorded history, kcal/day. */
  kcalAvg: number;
  proteinAvgG: number;
  freshAvg: number;
  /** 0..1000 */
  scurvy: number;
  /** 0..1000 */
  monotony: number;
  lastMealAt: number | null;
}

export interface ProvisionsActorView {
  purseCents: number;
  nutrition: NutritionView;
  readiness: Readiness;
}

export interface ProvisionsHouseholdView {
  cashCents: number;
  rationPct: number;
  pantry: ItemStackView[];
  readiness: Readiness;
}

export interface StockLineView {
  itemId: number;
  defId: string;
  name: string;
  qty: number;
  priceCents: number;
}

export interface ProvisionsPlaceView {
  /** Store stock with prices, or null if this place is not a store. */
  stock: StockLineView[] | null;
}

export function viewProvisionsActor(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  opts: ViewOptions,
): ProvisionsActorView {
  const known = opts.omniscient || opts.perspective === null || opts.perspective === actorId;
  const n = known ? world.provisions.nutrition[actorId] : undefined;
  const hist = n?.history ?? [];
  const avg = (f: (d: (typeof hist)[number]) => number) =>
    hist.length === 0 ? 0 : Math.round(hist.reduce((s, d) => s + f(d), 0) / hist.length);
  return {
    purseCents: known ? (world.provisions.purses[actorId] ?? 0) : 0,
    nutrition: {
      kcalToday: n?.today.kcal ?? 0,
      kcalAvg: avg((d) => d.kcal),
      proteinAvgG: avg((d) => d.proteinG),
      freshAvg: avg((d) => (d.servings === 0 ? 0 : Math.round(d.freshPoints / d.servings))),
      scurvy: n?.scurvy ?? 0,
      monotony: n?.monotony ?? 0,
      lastMealAt: n?.lastMealAt ?? null,
    },
    readiness: known ? readinessOf(world, content, { actorId }, world.time) : unknownReadiness(),
  };
}

export function viewProvisionsHousehold(
  world: World,
  content: ContentBundle,
  householdId: HouseholdId,
  opts: ViewOptions,
): ProvisionsHouseholdView {
  const known =
    opts.omniscient || opts.perspective === null || world.actors[opts.perspective]?.householdId === householdId;
  const h = known ? world.provisions.households[householdId] : undefined;
  return {
    cashCents: h?.cashCents ?? 0,
    rationPct: h?.rationPct ?? 100,
    pantry: known ? viewStacks(world, content, pantryOf(householdId)) : [],
    readiness: known ? readinessOf(world, content, { householdId }, world.time) : unknownReadiness(),
  };
}

export function viewProvisionsPlace(
  world: World,
  content: ContentBundle,
  placeId: PlaceId,
  opts: ViewOptions,
): ProvisionsPlaceView {
  if (
    !world.provisions.stores[placeId] ||
    (!opts.omniscient && opts.perspective !== null && world.actors[opts.perspective]?.placeId !== placeId)
  )
    return { stock: null };
  const stock = stacksAt(world, { kind: 'place', placeId }).map((s) => ({
    itemId: s.id,
    defId: s.defId,
    name: content.items[s.defId]?.name ?? s.defId,
    qty: s.qty,
    priceCents: priceAt(world, content, placeId, s.defId) ?? 0,
  }));
  return { stock };
}

function unknownReadiness(): Readiness {
  return {
    kcalOnHand: 0,
    kcalPerDay: 0,
    daysOfFoodTenths: 0,
    daysOfFuelTenths: null,
    spoilsFirst: null,
    unpreparable: [],
    warnings: ['These provisions are not known to this character.'],
  };
}

export function provisionsDailyStats(world: World, _content: ContentBundle): Record<string, number> {
  const nutrition = rowsOf(world.provisions.nutrition);
  return {
    provisions_kcal: nutrition.reduce((n, s) => n + s.today.kcal, 0),
    provisions_scurvy: nutrition.filter((s) => s.scurvy >= 500).length,
    provisions_cash_cents: rowsOf(world.provisions.households).reduce((n, h) => n + h.cashCents, 0),
    provisions_tabs_cents: rowsOf(world.provisions.stores).reduce(
      (n, s) => n + rowsOf(s.tabs).reduce((v, c) => v + c, 0),
      0,
    ),
  };
}
