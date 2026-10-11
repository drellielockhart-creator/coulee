/**
 * Items: gear, containers, consumables and FOOD (03 §3, §6; 00 P8 "Crunch you can pack").
 * OWNER: module:provisions (schema). TOML under content/base/items/** is owned by
 * module:content-items.
 *
 * Units: weight_g (grams per unit), value_cents (cents per unit), bulk (Bulk units per
 * unit, 1 Bulk ~ 1 quart of awkward volume, one decimal), water/liquids in ml, time in
 * minutes, energy in kcal, nutrients in grams. A "unit" is whatever `unit` says ("lb",
 * "box of 100", "quart", "pair", "each"); 03 lists prices per that unit.
 *
 * P8: food is never one number. Every food item carries calories, protein/fat, a fresh
 * factor (scurvy and monotony), shelf life, spoilage modifiers by temperature, wetness and
 * packaging, and the preparation it needs (fire + fuel + cookware + water + time).
 */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import {
  checkRefs,
  decimal1,
  defineDomain,
  type Issue,
  id,
  int,
  nonNegInt,
  pct,
  posInt,
  ratePct,
  ref,
} from './common.ts';

/** Catalog sections (03 §6), plus things found rather than bought. */
export const ITEM_SECTIONS = [
  'packs_bedding',
  'shelter',
  'fire_light',
  'cookery',
  'provisions',
  'tools',
  'clothing',
  'arms',
  'ammunition',
  'armor',
  'medicine',
  'fishing_trapping',
  'rope_climbing',
  'folk_magic',
  'books',
  'animals_tack_boats',
  'trade_goods',
  'wild_food',
  'fae',
  'misc',
] as const;

export const QUALITY_TIERS = ['shoddy', 'common', 'good', 'fine', 'exceptional'] as const;

/** Materials that matter to the sim (03 §3.3). `tinplate` counts as iron (it is iron sheet). */
export const MATERIALS = [
  'iron',
  'cold_iron',
  'steel',
  'tinplate',
  'lead',
  'silver',
  'gold',
  'brass',
  'copper',
  'pewter',
  'wood',
  'rowan',
  'bark',
  'wool',
  'cotton',
  'linen',
  'canvas',
  'oilcloth',
  'leather',
  'rawhide',
  'fur',
  'gum',
  'glass',
  'ceramic',
  'stone',
  'paper',
  'horn',
  'bone',
  'tallow',
  'wax',
  'salt',
  'food',
  'liquid',
  'powder',
  'fae_thornwood',
  'moonsilk',
  'glamour_gold',
  'other',
] as const;
export type MaterialId = (typeof MATERIALS)[number];

/** Protective properties a container gives its contents (03 §3.4) — also packaging for food. */
export const PROTECTIONS = [
  'splashproof',
  'waterproof',
  'airtight',
  'crushproof',
  'insulated',
  'iron_lined',
  'concealed',
  'vermin_proof',
  'brine',
  'cool_storage',
] as const;
export type ProtectionId = (typeof PROTECTIONS)[number];

export const CARRY_POINTS = ['worn', 'pocket', 'belt', 'sling', 'pack', 'animal', 'fixed'] as const;

/**
 * Temperature bands for spoilage, by effective storage temperature (°F):
 * frozen < 32 <= cold < 45 <= cool < 70 <= warm < 85 <= hot.
 * Shelf life is quoted at 'cool', dry, unpackaged.
 */
export const TEMP_BANDS = ['frozen', 'cold', 'cool', 'warm', 'hot'] as const;
export type TempBand = (typeof TEMP_BANDS)[number];

export const FOOD_GROUPS = [
  'grain',
  'bread',
  'legume',
  'meat',
  'fish',
  'fat',
  'dairy',
  'egg',
  'fruit',
  'vegetable',
  'fungus',
  'nut',
  'sweet',
  'beverage',
  'condiment',
  'mixed',
] as const;

export const PREP_METHODS = ['raw', 'soak', 'boil', 'cook', 'fry', 'bake', 'roast', 'brew', 'grind', 'parch'] as const;

/**
 * One way of making a food edible. Time and fire are per BATCH (a pot of beans for a family
 * takes as long as a pot for one), up to `batch_servings` servings; water is per SERVING.
 */
export const PrepSchema = z.strictObject({
  method: z.enum(PREP_METHODS),
  /** Elapsed minutes per batch (hands-on + waiting: soaking, simmering). */
  minutes: nonNegInt(),
  /** Minutes of active fire per batch (fuel: items with `supply.kind = 'fire'`). 0 = no fire. */
  fire_minutes: nonNegInt().default(0),
  /** Max servings one batch makes with one set of cookware. */
  batch_servings: posInt().default(8),
  /** Affordances required of cookware present, e.g. ['boil'] or ['bake'] or ['grind']. */
  cookware: z.array(id()).default([]),
  /** Water consumed per serving, ml (soaking hardtack, boiling beans, brewing coffee). */
  water_ml: nonNegInt().default(0),
  /** Percent of the item's kcal available when eaten this way (raw dry beans ~0). */
  kcal_pct: ratePct().default(100),
  /** Morale delta per serving eaten this way (hot coffee +, cold raw pork −). */
  morale: int().min(-20).max(20).default(0),
  /** If set, preparing turns the item into this item (e.g. green coffee -> ground coffee). */
  yields: ref().optional(),
  yields_qty: posInt().default(1),
  /** Optional skill check (02 §3) for quality; failure wastes or lowers morale. */
  check: z.strictObject({ skill: ref(), dc: nonNegInt() }).optional(),
});
export type PrepDef = z.output<typeof PrepSchema>;

export const FoodSchema = z.strictObject({
  /** Energy per unit. Baseline adult needs ~2400 kcal/day, ×1.5 at heavy labor (05 §6.1). */
  kcal: nonNegInt(),
  protein_g: nonNegInt(),
  fat_g: nonNegInt(),
  /**
   * Fresh factor 0..100: guards against scurvy and monotony. Hardtack 0, salt pork 0,
   * dried apples ~30, wild greens/ramps ~90, fresh fish/meat ~40.
   */
  fresh: pct(),
  group: z.enum(FOOD_GROUPS),
  /** Meal-sized servings per unit (a lb of hardtack ~ 3 servings). */
  servings: posInt(),
  /** Morale per serving when eaten plain (sugar +2, hardtack −1). */
  morale: int().min(-20).max(20).default(0),
  /** Shelf life in days at 'cool', dry, unpackaged. 0 = spoils within the day. */
  shelf_life_days: nonNegInt(),
  spoilage: z
    .strictObject({
      /** Spoilage rate multiplier per temperature band, percent of the 'cool' rate. */
      temperature_pct: z
        .strictObject({
          frozen: ratePct().default(5),
          cold: ratePct().default(50),
          cool: ratePct().default(100),
          warm: ratePct().default(170),
          hot: ratePct().default(300),
        })
        .default({ frozen: 5, cold: 50, cool: 100, warm: 170, hot: 300 }),
      /** Rate multiplier while the item is wet (wetness > 20%), percent. */
      wet_pct: ratePct().default(200),
      /** Rate multiplier when stored inside a container with this protection, percent. */
      packaging_pct: z.partialRecord(z.enum(PROTECTIONS), ratePct()).default({}),
      /** What it turns into when spoiled; omitted = ruined (removed with an event). */
      spoils_to: ref().optional(),
      /** Attracts vermin in poorly protected storage (mice in the flour). */
      vermin: z.boolean().default(false),
    })
    .default({
      temperature_pct: { frozen: 5, cold: 50, cool: 100, warm: 170, hot: 300 },
      wet_pct: 200,
      packaging_pct: {},
      vermin: false,
    }),
  /** Ways to make it edible. Must include at least one; 'raw' means edible as-is. */
  prep: z.array(PrepSchema).min(1),
  /** Liquid food/drink: ml per unit (counts toward thirst if `hydrates`). */
  liquid_ml: nonNegInt().default(0),
  hydrates: z.boolean().default(false),
  /** Alcohol by volume, percent (whiskey ~45). */
  alcohol_pct: pct().default(0),
  stimulant: z.boolean().default(false),
});
export type FoodDef = z.output<typeof FoodSchema>;

export const ItemSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  plural: z.string().optional(),
  section: z.enum(ITEM_SECTIONS),
  /** Period catalog copy (03 §2.5): 1–3 sentences, one situational hint. */
  copy: z.string().default(''),
  /** Hidden truth for patent medicines, glamours, counterfeits (03 §3.6). */
  truth: z.string().optional(),
  maker: z.string().optional(),
  /** What one unit is: "lb", "box of 100", "quart", "pair", "each". */
  unit: z.string().default('each'),
  weight_g: nonNegInt(),
  bulk: decimal1().min(0),
  value_cents: nonNegInt(),
  quality: z.enum(QUALITY_TIERS).default('common'),
  shape: z.array(z.enum(['long', 'rigid', 'soft', 'fragile'])).default([]),
  /** Material composition by percent of mass (sum <= 100). Drives Iron Presence etc. */
  materials: z.array(z.strictObject({ material: z.enum(MATERIALS), pct: pct() })).default([]),
  /** Affordance -> magnitude (03 §3.2), e.g. { cut = 2, ignite = 1, boil = 0.5 }. */
  affordances: z.record(id(), decimal1().min(0)).default({}),
  /** Property tags (03 §3.1): waterproof, noisy, flammable, perishable, wet_ruin, blessed... */
  tags: z.array(id()).default([]),
  /** Whether units stack into one instance (false for tools with individual condition). */
  stackable: z.boolean().default(true),
  container: z
    .strictObject({
      capacity_g: nonNegInt(),
      capacity_bulk: decimal1().min(0),
      /** For canteens, kettles, kegs. */
      liquid_ml: nonNegInt().default(0),
      protects: z.array(z.enum(PROTECTIONS)).default([]),
      carry: z.enum(CARRY_POINTS).default('pack'),
    })
    .optional(),
  wearable: z
    .strictObject({
      slot: z.enum(['head', 'body_base', 'body_mid', 'body_outer', 'legs', 'feet', 'hands', 'neck']),
      /** °F of comfort-band extension (05 §6.3). */
      insulation: nonNegInt(),
      wind_block_pct: pct().default(0),
      /** Percent of insulation kept when soaked (wool ~50-70, cotton ~10). */
      wet_retention_pct: pct().default(50),
    })
    .optional(),
  /**
   * This item is a consumable supply: one unit provides `units` of supply `kind`.
   * Kinds are snake_case ids whose unit is implied by the kind:
   *   fire (minutes of campfire), lamp_oil (lamp-minutes), candle (candle-minutes),
   *   powder (charges), percussion_cap (shots), ball_<caliber> (shots), fodder (animal-days)...
   */
  supply: z.strictObject({ kind: id(), units: posInt() }).optional(),
  /** Devices that burn supplies: a lantern consumes lamp_oil per hour lit, a rifle caps per use. */
  consumes: z.array(z.strictObject({ kind: id(), per: z.enum(['hour', 'use', 'day']), units: posInt() })).default([]),
  food: FoodSchema.optional(),
  /** Base condition loss per use/day (03 §3.6), 0..100. */
  wear: nonNegInt().default(0),
});
export type ItemDef = z.output<typeof ItemSchema>;

export const itemsDomains = {
  items: defineDomain({ dir: 'items', key: 'item', schema: ItemSchema }),
};

const StackSeedSchema = z.strictObject({
  item: ref(),
  qty: posInt(),
  /** Put inside this other seeded container (by its item id, first match in the same list). */
  in: ref().optional(),
  worn: z.boolean().default(false),
});
export type StackSeed = z.output<typeof StackSeedSchema>;

/** Per-household scenario fields owned by provisions: the pantry / household stores. */
export const provisionsHouseholdFields = {
  pantry: z.array(StackSeedSchema).default([]),
  /** Household cash, cents. */
  cash_cents: nonNegInt().default(0),
};

/** Per-actor scenario fields owned by provisions: what the actor carries/wears. */
export const provisionsActorFields = {
  inventory: z.array(StackSeedSchema).default([]),
  purse_cents: nonNegInt().default(0),
};

/** Top-level scenario fields owned by provisions: store stock and other placed goods. */
export const provisionsScenarioFields = {
  stocks: z
    .array(
      z.strictObject({
        place: ref(),
        items: z.array(StackSeedSchema).default([]),
        /** Price multiplier vs value_cents at this store, percent (03 §8.1). */
        markup_pct: ratePct().default(100),
      }),
    )
    .default([]),
};

export function itemsRefs(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  const supplyKinds = new Set<string>();
  for (const it of Object.values(b.items)) if (it.supply) supplyKinds.add(it.supply.kind);
  for (const it of Object.values(b.items)) {
    const where = `items:${it.id}`;
    const sum = it.materials.reduce((s, m) => s + m.pct, 0);
    if (sum > 100) issues.push({ where, path: 'materials', message: `materials sum to ${sum}% > 100%` });
    for (const c of it.consumes) {
      if (!supplyKinds.has(c.kind)) {
        issues.push({ where, path: 'consumes', message: `no item supplies '${c.kind}'` });
      }
    }
    if (it.food) {
      checkRefs(issues, where, 'food.spoilage.spoils_to', [it.food.spoilage.spoils_to], b.items, 'item');
      for (const p of it.food.prep) {
        checkRefs(issues, where, 'food.prep.yields', [p.yields], b.items, 'item');
        checkRefs(issues, where, 'food.prep.check.skill', [p.check?.skill], b.skills, 'skill');
        if (p.fire_minutes > 0 && !supplyKinds.has('fire')) {
          issues.push({ where, path: 'food.prep', message: "needs fire but no item supplies 'fire'" });
        }
      }
    }
  }
  const seedRefs = (where: string, stacks: readonly StackSeed[]) => {
    checkRefs(
      issues,
      where,
      'item',
      stacks.map((s) => s.item),
      b.items,
      'item',
    );
  };
  for (const s of Object.values(b.scenarios)) {
    for (const h of s.households) seedRefs(`scenarios:${s.id}/households:${h.key}`, h.pantry);
    for (const a of s.actors) seedRefs(`scenarios:${s.id}/actors:${a.key}`, a.inventory);
    for (const st of s.stocks) {
      checkRefs(issues, `scenarios:${s.id}/stocks`, 'place', [st.place], b.places, 'place');
      seedRefs(`scenarios:${s.id}/stocks:${st.place}`, st.items);
    }
  }
  return issues;
}
