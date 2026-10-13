/** Physical relief parcels use the same cooking and forward-planning rules as meals. */
import type { ContentBundle } from '../content.ts';
import type { ActorId, HouseholdId, ItemId } from '../ids.ts';
import { carriedBy, pantryOf, stacksDeep } from '../items/api.ts';
import type { World } from '../world.ts';
import { dailyKcal, kitchenOf, membersOf, prepBudget, recipesFor } from './meals.ts';
import { planReadiness } from './planner.ts';

export interface FoodParcel {
  itemId: ItemId;
  qty: number;
  kcal: number;
}
export interface ReliefPlanningMemo {
  parcels: Map<string, FoodParcel | null>;
  reserves: Map<string, boolean>;
}
export function reliefParcel(
  world: World,
  content: ContentBundle,
  donor: ActorId,
  recipient: ActorId,
  reserveDays: number,
  parcelDays: number,
  now: number,
  fromItems?: readonly ItemId[],
  allowSameHousehold = false,
  memo?: ReliefPlanningMemo,
): FoodParcel | null {
  // Valid only within a caller's read-only planning pass: family members share
  // a kitchen and ration, so asking about each of them need not project it again.
  const key = `${donor}:${world.actors[recipient]?.householdId}:${reserveDays}:${parcelDays}:${now}:${allowSameHousehold}:${fromItems?.join(',') ?? 'own'}`;
  if (memo?.parcels.has(key)) return memo.parcels.get(key) ?? null;
  const parcel = planParcel(
    world,
    content,
    donor,
    recipient,
    reserveDays,
    parcelDays,
    now,
    fromItems,
    allowSameHousehold,
    memo?.reserves,
  );
  memo?.parcels.set(key, parcel);
  return parcel;
}
function planParcel(
  world: World,
  content: ContentBundle,
  donor: ActorId,
  recipient: ActorId,
  reserveDays: number,
  parcelDays: number,
  now: number,
  fromItems: readonly ItemId[] | undefined,
  allowSameHousehold: boolean,
  reserves?: Map<string, boolean>,
): FoodParcel | null {
  const a = world.actors[donor],
    b = world.actors[recipient];
  if (!a || !b || (!allowSameHousehold && !fromItems && a.householdId === b.householdId)) return null;
  const holder = { householdId: b.householdId };
  const kitchen = kitchenOf(world, content, holder);
  const kcal = membersOf(world, holder).reduce((n, id) => n + dailyKcal(world, content, id, now), 0) * parcelDays;
  const donorHome = world.households[a.householdId]?.homePlaceId === a.placeId;
  const ownReserveKey = `${a.householdId}:own:${reserveDays}:${now}`;
  if (!fromItems && reserves?.get(ownReserveKey) === false) return null;
  const stacks = (
    fromItems
      ? fromItems.flatMap((id) => {
          const stack = world.items.stacks[id];
          return stack ? [stack] : [];
        })
      : [...stacksDeep(world, carriedBy(donor)), ...(donorHome ? stacksDeep(world, pantryOf(a.householdId)) : [])].map(
          (e) => e.stack,
        )
  )
    .filter(
      (s) =>
        content.items[s.defId]?.food &&
        s.condition > 0 &&
        s.spoilage < 500 &&
        s.partial === 0 &&
        !(s.foodPartialPm ?? 0),
    )
    .sort(
      (x, y) => (content.items[y.defId]?.food?.kcal ?? 0) - (content.items[x.defId]?.food?.kcal ?? 0) || x.id - y.id,
    );
  let donorHasReserve: boolean | undefined;
  for (const s of stacks) {
    const energy = content.items[s.defId]?.food?.kcal ?? 0;
    if (
      energy <= 0 ||
      !recipesFor(world, content, holder, s, 1, false, undefined, prepBudget(holder), kitchen).some(
        (r) => !r.missing.length,
      )
    )
      continue;
    const qty = Math.min(s.qty, Math.max(1, Math.ceil(kcal / energy)));
    // A virtual withdrawal: no goods move, and no future stores are invented.
    const reserveKey = `${a.householdId}:${s.id}:${qty}:${reserveDays}:${now}`;
    let retained = fromItems ? true : reserves?.get(reserveKey);
    if (retained === undefined) {
      const projected = {
        ...world,
        items: { ...world.items, stacks: { ...world.items.stacks, [s.id]: { ...s, qty: s.qty - qty } } },
      };
      retained =
        planReadiness(projected, content, { householdId: a.householdId }, now, reserveDays, false).daysOfFoodTenths >=
        reserveDays * 10;
      reserves?.set(reserveKey, retained);
    }
    if (!retained) {
      // Once a withdrawal fails, check whether this household has any surplus
      // at all before projecting every other ingredient in an already short pantry.
      donorHasReserve ??=
        planReadiness(world, content, { householdId: a.householdId }, now, reserveDays, false).daysOfFoodTenths >=
        reserveDays * 10;
      reserves?.set(ownReserveKey, donorHasReserve);
      if (!donorHasReserve) return null;
      continue;
    }
    return { itemId: s.id, qty, kcal: qty * energy };
  }
  return null;
}
export function householdFoodDays(
  world: World,
  content: ContentBundle,
  householdId: HouseholdId,
  now: number,
  horizon: number,
): number {
  return planReadiness(world, content, { householdId }, now, horizon, false).daysOfFoodTenths;
}
