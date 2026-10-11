import { FoodSchema } from '@coulee/content/schema';
import { describe, expect, it } from 'vitest';
import type { ItemStack } from '../items/state.ts';
import { advanceSpoilage, minutesUntil, packagingPct, type SpoilFactors, stageOf } from './spoilage.ts';

const food = FoodSchema.parse({
  kcal: 1000,
  protein_g: 10,
  fat_g: 20,
  fresh: 0,
  group: 'grain',
  servings: 4,
  shelf_life_days: 365,
  prep: [{ method: 'raw', minutes: 0 }],
});
const factors: SpoilFactors = {
  storage: 'indoor',
  storageTempF: 50,
  band: 'cool',
  tempPct: 100,
  wet: false,
  wetPct: 100,
  packClasses: [],
  packPct: 100,
  combinedPct: 100,
};
const stack = (): ItemStack => ({ spoilage: 0, spoilageCarry: 0 }) as ItemStack;

describe('integer spoilage kernel', () => {
  it('retains long-life fractional hours and agrees with time-to-threshold', () => {
    const s = stack();
    for (let i = 0; i < 365 * 24; i++) advanceSpoilage(s, food, factors, 60);
    expect(s.spoilage).toBe(1000);
    expect(s.spoilageCarry).toBe(0);
    const other = stack();
    for (let i = 0; i < 24; i++) advanceSpoilage(other, food, factors, 60);
    expect(minutesUntil(other, food, 100, 1000)).toBe(364 * 1440);
    expect(stageOf(other, food)).toBe('fresh');
  });
  it('applies packaging outside-in with rounding after each layer and a minimum rate', () => {
    const packed = {
      ...food,
      spoilage: { ...food.spoilage, packaging_pct: { waterproof: 67, airtight: 33, brine: 1 } },
    };
    expect(packagingPct(packed, ['waterproof', 'airtight']).pct).toBe(22);
    expect(packagingPct(packed, ['waterproof', 'airtight', 'brine']).pct).toBe(5);
  });
});
