/**
 * Provisions view parts (P8 legibility). OWNER: module:provisions.
 * Contract with module:web (see needs/view.ts note).
 */
import type { ContentBundle } from '../content.ts';
import { type ActorId, type HouseholdId, type PlaceId, rowsOf } from '../ids.ts';
import { pantryOf, stacksAt } from '../items/api.ts';
import { type ItemStackView, viewStacks } from '../items/view.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';
import { priceAt, type Readiness, readinessOf, serviceAt, storeOpen } from './api.ts';

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
  employment?: {
    employer: string;
    workplace: string;
    dailyCents: number;
    hours: number;
    fromHour: number;
    toHour: number;
    endsAt: number;
    pay: 'daily' | 'weekly';
    earnedCents: number;
    ended?: string;
  };
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
  open?: boolean;
  hours?: { opens: number; closes: number };
  bedCents?: number;
  mealCents?: number;
  /** Store stock with prices, or null if this place is not a store. */
  stock: StockLineView[] | null;
  /** When the next freight tops the shelves up (stores with a restock table). */
  freight?: {
    everyDays: number;
    dueDay: number;
    inDays: number;
    weekday: string;
    /** Percent of a full delivery while the river is closed at the due date (100 when open). */
    deliveryPct: number;
    /** Restocked lines now out of stock (names), which the freight brings back. */
    awaited: string[];
  };
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
  const contract = known ? world.provisions.contracts?.[actorId] : undefined;
  const employer = contract ? world.actors[contract.employerId] : undefined;
  return {
    ...(contract
      ? {
          employment: {
            employer: employer ? `${employer.name.given} ${employer.name.family}`.trim() : 'Former employer',
            workplace: world.places[contract.workplaceId]?.name ?? 'Workplace',
            dailyCents: contract.dailyCents,
            hours: contract.hours,
            fromHour: contract.fromHour,
            toHour: contract.toHour,
            endsAt: contract.endsAt,
            pay: contract.pay,
            earnedCents:
              (world.provisions.employment?.[actorId]?.earnedCents ?? 0) +
              (world.provisions.wageArrears ?? [])
                .filter((c) => c.workerId === actorId)
                .reduce((n, c) => n + c.account.earnedCents, 0),
            ...(contract.ended ? { ended: contract.ended } : {}),
          },
        }
      : {}),
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
  if (!opts.omniscient && opts.perspective !== null && world.actors[opts.perspective]?.placeId !== placeId)
    return { stock: null };
  const service = serviceAt(world, content, placeId);
  const trade = service
    ? {
        open: storeOpen(world, content, placeId),
        hours: { opens: service.opens, closes: service.closes },
        ...(service.bed_cents !== undefined ? { bedCents: service.bed_cents } : {}),
        ...(service.meal_cents !== undefined ? { mealCents: service.meal_cents } : {}),
      }
    : {};
  const store = world.provisions.stores[placeId];
  if (!store) return { stock: null, ...trade };
  const stock = stacksAt(world, { kind: 'place', placeId }).map((s) => ({
    itemId: s.id,
    defId: s.defId,
    name: content.items[s.defId]?.name ?? s.defId,
    qty: s.qty,
    priceCents: priceAt(world, content, placeId, s.defId) ?? 0,
  }));
  const restock = store.restockId ? content.restocks?.[store.restockId] : undefined;
  if (!restock) return { stock, ...trade };
  // The same calendar the economy delivers on (economy.ts householdDay): day 0 never delivers.
  const today = Math.floor(world.time / 1440);
  const dueDay = (Math.floor(today / restock.every_days) + 1) * restock.every_days;
  const due = calendarAt(asGameMinute(dueDay * 1440));
  const have = new Set(stock.filter((l) => l.qty > 0).map((l) => l.defId));
  return {
    stock,
    ...trade,
    freight: {
      everyDays: restock.every_days,
      dueDay,
      inDays: dueDay - today,
      weekday: due.weekday,
      deliveryPct: restock.river_closed_months.includes(due.month) ? restock.river_closed_pct : 100,
      awaited: restock.lines
        .filter((l) => !have.has(l.item) && content.items[l.item]?.food)
        .map((l) => content.items[l.item]?.name ?? l.item),
    },
  };
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
    provisions_tabs_cents: tabsOnce(world),
  };
}

/** Store tabs mirror the keeper's ledger in every store it keeps: count each keeper's ledger once. */
function tabsOnce(world: World): number {
  const seen = new Set<number>();
  let n = 0;
  for (const s of rowsOf(world.provisions.stores)) {
    if (s.ownerHouseholdId !== null) {
      if (seen.has(s.ownerHouseholdId)) continue;
      seen.add(s.ownerHouseholdId);
    }
    n += rowsOf(s.tabs).reduce((v, c) => v + c, 0);
  }
  return n;
}
