/**
 * Spoilage (03 §3.7.4; MODULES provisions): one integer accumulator per stack, no exponentials.
 *
 *   combined_pct = max(1, floor(temp_pct[band] x wet_pct x pack_pct / 10,000))
 *   num          = 1,000 x minutes x combined_pct + carry
 *   den          = shelf_life_days x 1,440 x 100
 *   spoilage    += floor(num / den);  carry = num mod den
 *
 * Shelf life is quoted at 'cool', dry, unpackaged. The same functions drive the sim and the planner.
 * OWNER: module:provisions.
 */
import type { ContentBundle, ItemDef, ProtectionId, TempBand } from '../content.ts';
import { carryPointOf, protectionsOf, rootLocation } from '../items/containers.ts';
import type { ItemStack } from '../items/state.ts';
import type { CalendarInfo } from '../time.ts';
import type { World } from '../world.ts';
import { airTempF, storageTempF, tempBand } from './temperature.ts';

export type StorageClass = 'outdoor' | 'indoor' | 'cellar' | 'springhouse' | 'body';

/** Everything that went into one stack's spoilage rate this step: the Explain's terms. */
export interface SpoilFactors {
  storage: StorageClass;
  storageTempF: number;
  band: TempBand;
  tempPct: number;
  wet: boolean;
  wetPct: number;
  packClasses: Array<{ cls: ProtectionId; pct: number }>;
  packPct: number;
  combinedPct: number;
}

type Food = NonNullable<ItemDef['food']>;

/** Shelf life in minutes as the divisor sees it: "0 days" means it turns within half a day. */
export function shelfMinutes(food: Food): number {
  return food.shelf_life_days > 0 ? food.shelf_life_days * 1440 : 720;
}

/** Where a stack sits, for temperature: a household's pantry kind, a building, the open air, or on the body. */
export function storageClassOf(world: World, content: ContentBundle, stack: ItemStack): StorageClass {
  if (protectionsOf(world, content, stack).includes('cool_storage')) return 'springhouse';
  const root = rootLocation(world, stack);
  switch (root.kind) {
    case 'household':
      return world.provisions.households[root.householdId]?.storage ?? 'indoor';
    case 'place': {
      const p = world.places[root.placeId];
      return p && (p.kind === 'building' || p.kind === 'house') ? 'indoor' : 'outdoor';
    }
    case 'actor': {
      const cp = carryPointOf(world, content, stack);
      if (cp === 'worn' || cp === 'pocket') return 'body';
      const a = world.actors[root.actorId];
      const p = a ? world.places[a.placeId] : undefined;
      return p && (p.kind === 'building' || p.kind === 'house') ? 'indoor' : 'outdoor';
    }
  }
}

/** Effective storage temperature, F: worn items sit at max(air, 40) (03 §3.7.4 "carried on the body"). */
export function stackTempF(cal: CalendarInfo, storage: StorageClass, world?: World): number {
  if (storage === 'body') return Math.max(airTempF(cal, world), 40);
  return storageTempF(cal, storage, world);
}

/** Packaging multiplier from the protection classes in the container chain (distinct classes, floored at 5%). */
export function packagingPct(
  food: Food,
  classes: readonly ProtectionId[],
): { pct: number; used: Array<{ cls: ProtectionId; pct: number }> } {
  let p = 100;
  const used: Array<{ cls: ProtectionId; pct: number }> = [];
  for (const cls of classes) {
    const v = food.spoilage.packaging_pct[cls];
    if (v === undefined) continue;
    used.push({ cls, pct: v });
    p = Math.floor((p * v) / 100);
  }
  return { pct: used.length > 0 ? Math.max(5, p) : 100, used };
}

/** Compute the rate factors for a food stack at the given calendar moment. */
export function spoilageFactors(
  world: World,
  content: ContentBundle,
  stack: ItemStack,
  cal: CalendarInfo,
  /** Precomputed placement (the planner's projection, where nothing moves): same values, fewer walks. */
  pre?: { storage: StorageClass; protections: readonly ProtectionId[] },
): SpoilFactors | null {
  const food = content.items[stack.defId]?.food;
  if (!food) return null;
  const storage = pre?.storage ?? storageClassOf(world, content, stack);
  const f = stackTempF(cal, storage, world);
  const band = tempBand(f);
  const tempPct = food.spoilage.temperature_pct[band];
  const wet = stack.wetness > 20;
  const wetPct = wet ? food.spoilage.wet_pct : 100;
  const pack = packagingPct(food, pre?.protections ?? protectionsOf(world, content, stack));
  const combinedPct = Math.max(1, Math.floor((tempPct * wetPct * pack.pct) / 10_000));
  return {
    storage,
    storageTempF: f,
    band,
    tempPct,
    wet,
    wetPct,
    packClasses: pack.used,
    packPct: pack.pct,
    combinedPct,
  };
}

/** Advance a stack's accumulator by `minutes` at the given factors. Returns the per-mille gained. */
export function advanceSpoilage(stack: ItemStack, food: Food, factors: SpoilFactors, minutes: number): number {
  const den = shelfMinutes(food) * 100;
  const num = 1000 * minutes * factors.combinedPct + stack.spoilageCarry;
  const gained = Math.floor(num / den);
  stack.spoilageCarry = num % den;
  stack.spoilage = Math.min(1000, stack.spoilage + gained);
  return gained;
}

export type SpoilStage = 'fresh' | 'turning' | 'spoiled';

export function stageOf(stack: ItemStack, food: Food): SpoilStage {
  if (stack.spoilage >= 1000) return 'spoiled';
  if (stack.spoilage >= food.spoilage.turning_pm) return 'turning';
  return 'fresh';
}

/**
 * Minutes until the accumulator reaches `threshold` per mille at a constant rate (null if never).
 * Used for "what spoils first" estimates; the planner walks real temperatures hour by hour.
 */
export function minutesUntil(stack: ItemStack, food: Food, combinedPct: number, threshold: number): number | null {
  if (stack.spoilage >= threshold) return 0;
  if (combinedPct <= 0) return null;
  const den = shelfMinutes(food) * 100;
  const needNum = (threshold - stack.spoilage) * den - stack.spoilageCarry;
  return Math.max(0, Math.ceil(needNum / (1000 * combinedPct)));
}

/** True for places where weather reaches things: anything that is not a building or a house. */
export function isOutdoorsPlace(kind: string): boolean {
  return kind !== 'building' && kind !== 'house';
}
