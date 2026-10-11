/**
 * content-items acceptance (MODULES.md module:content-items; 03 §6, §7.3; 00 P8).
 * Integration test over the real content/base bundle.
 */
import { describe, expect, it } from 'vitest';
import { baseContent } from './helpers.ts';

const items = baseContent().items as Record<string, ItemLike>;

interface PrepLike {
  method: string;
  minutes: number;
  fire_minutes?: number;
  yields?: string;
}
interface FoodLike {
  kcal: number;
  fresh: number;
  shelf_life_days: number;
  servings: number;
  prep: PrepLike[];
}
interface ItemLike {
  id: string;
  section: string;
  weight_g: number;
  value_cents: number;
  tags: string[];
  food?: FoodLike;
}

/** Every 03 §6.1–6.14 catalog row (services in 6.15 are not items). */
const CATALOG_ROWS: Record<string, string[]> = {
  '6.1 packs_bedding': [
    'haversack_tarred',
    'knapsack_army',
    'pack_board_tumpline',
    'ash_splint_basket',
    'saddlebags_leather',
    'blanket_wool_3pt',
    'blanket_wool_4pt_haugen',
    'buffalo_robe',
    'gum_blanket',
    'bed_tick',
    'blanket_straps',
  ],
  '6.2 shelter': [
    'oilcloth_fly_8x10',
    'wall_tent_9x9',
    'tent_poles_pegs',
    'oilcloth_groundsheet',
    'mosquito_bar',
    'snowshoes_pair',
    'canvas_bucket',
  ],
  '6.3 fire_light': [
    'lucifers_box',
    'match_safe',
    'flint_steel_char_tin',
    'burning_glass',
    'tinder_pouch',
    'candles_tallow_lb',
    'candles_spermaceti_lb',
    'tin_lantern_pierced',
    'glass_lantern_fenwick',
    'lard_oil_quart',
    'camphene_pint',
    'sticking_tommy',
    'pitch_torch_3',
  ],
  '6.4 cookery & provisions': [
    'tin_cup',
    'tin_plate',
    'frying_pan',
    'dutch_oven_10qt',
    'camp_kettle_pair',
    'coffee_mill_hand',
    'canteen_tin_wool',
    'canteen_gourd',
    'flour',
    'cornmeal',
    'salt_pork',
    'hardtack',
    'pemmican',
    'coffee_green',
    'tea',
    'sugar_brown',
    'salt_lb',
    'dried_apples',
    'beans_dry',
    'cheese',
    'whiskey_quart',
  ],
  '6.5 tools': [
    'felling_axe_hollister',
    'hatchet_belt',
    'butcher_knife',
    'clasp_knife',
    'clasp_knife_brauer',
    'bucksaw',
    'spade',
    'miners_pick_penhallow',
    'crowbar_3ft',
    'claw_hammer',
    'cut_nails_lb',
    'auger_1inch',
    'whetstone',
    'gun_oil_tin',
    'sewing_kit',
    'awl_waxed_thread',
    'pocket_compass',
    'spyglass_brass',
    'pocket_watch_silver',
    'slate_pencil',
  ],
  '6.6 clothing': [
    'red_flannels',
    'wool_socks',
    'cotton_shirt',
    'flannel_shirt_checked',
    'jean_trousers',
    'heavy_wool_trousers',
    'brogans',
    'boots_tall_cowhide',
    'moccasins_hide',
    'moccasin_liners',
    'gaiters_wool',
    'mackinaw_coat',
    'capote',
    'buffalo_coat',
    'oilskin_slicker',
    'felt_hat_wide',
    'straw_hat',
    'fur_cap_earflaps',
    'mittens_wool_overmitts',
    'muffler_wool',
  ],
  '6.7 arms & ammunition': [
    'bowie_knife',
    'cavalry_saber',
    'sword_cane',
    'smoothbore_musket_surplus',
    'percussion_musket',
    'squirrel_rifle_36',
    'kentucky_long_rifle',
    'plains_rifle_ostrander',
    'fowling_piece_12ga',
    'double_barrel_12ga',
    'pistol_single_percussion',
    'pepperbox_pistol',
    'revolver_carrow_36',
    'hunting_bow_hickory',
    'arrows_iron_dozen',
    'arrows_flint_dozen',
    'crossbow_old_country',
    'black_powder_canister',
    'powder_horn',
    'powder_flask_copper',
    'lead_bar_5lb',
    'bullet_mould',
    'patches_box',
    'percussion_caps_tin',
    'gun_flints_dozen',
    'shot_no4_5lb',
    'paper_cartridges_69',
    'silver_ball_cast',
    'gun_case_oiled_leather',
  ],
  '6.8 armor': [
    'quilted_jack',
    'smoked_hide_jerkin',
    'buff_coat',
    'plate_insert_vest',
    'cuirass_heirloom',
    'mail_shirt_old_country',
  ],
  '6.9 medicine': [
    'linen_bandages',
    'lint_plaster',
    'laudanum_2oz',
    'quinine_1oz',
    'calomel_packet',
    'pelham_restorative',
    'horse_liniment',
    'mustard_plaster',
    'snakeroot_dried',
    'willow_bark',
    'surgeons_pocket_case',
  ],
  '6.10 fishing & trapping': [
    'fishing_line_silk',
    'hooks_dozen',
    'jointed_rod',
    'fly_book',
    'trot_line',
    'fish_gig',
    'steel_trap_no1',
    'steel_trap_no3',
    'wolf_trap_no4',
    'snare_wire_brass',
    'fleshing_knife_boards',
    'castor_bait_vial',
  ],
  '6.11 rope & climbing': [
    'hemp_rope_50ft',
    'manila_rope_50ft',
    'rawhide_line_30ft',
    'cord_twine_ball',
    'grapnel_4tine',
    'iron_spikes_dozen',
    'rope_ladder_20ft',
    'block_tackle_single',
  ],
  '6.12 folk magic': [
    'rock_salt_5lb',
    'iron_nails_pocketful',
    'horseshoe_worn',
    'cold_iron_knife_brauer',
    'cold_iron_nail_ring',
    'rowan_red_thread_cross',
    'red_thread_skein',
    'bread_heel',
    'st_johns_wort_sachet',
    'holed_silver_dime',
    'brass_bell_small',
    'witch_bottle_stoneware',
    'himmelsbrief',
    'hex_sign_barnboard',
    'holy_water_vial',
    'hag_stone',
    'knapped_flint_blade',
  ],
  '6.13 books': [
    'kittredge_almanack',
    'pocket_bible',
    'rusk_domestic_medicine',
    'emigrants_guide_upper_mississippi',
    'county_map_lithographed',
    'bank_note_detector',
    'herbal_botany_manual',
    'blank_journal_pencils',
    'long_hidden_friend',
    'spellbook_blank_vellum',
    'grimoire_used',
    'scribing_ink_quills',
  ],
  '6.14 animals, tack & boats': [
    'saddle_horse_sound',
    'canadian_horse_hardy',
    'draft_horse',
    'mule',
    'oxen_yoke_two',
    'hound',
    'milk_goat',
    'riding_saddle',
    'pack_saddle_sawbuck',
    'bridle_and_bit',
    'horse_blanket',
    'oats_bushel',
    'handcart',
    'skiff_flat_14',
    'bark_canoe_16',
  ],
};

/** 03 §7.3 prebuilt kits (all five; the MODULES.md contract asks for three). */
const KITS: Record<string, string[]> = {
  greenhorn: [
    'knapsack_army',
    'blanket_wool_3pt',
    'gum_blanket',
    'hatchet_belt',
    'butcher_knife',
    'canteen_tin_wool',
    'tin_cup',
    'frying_pan',
    'camp_kettle_pair',
    'lucifers_box',
    'match_safe',
    'hardtack',
    'salt_pork',
    'coffee_green',
    'sugar_brown',
    'salt_lb',
    'wool_socks',
    'fowling_piece_12ga',
    'black_powder_canister',
    'shot_no4_5lb',
    'percussion_caps_tin',
    'powder_horn',
    'hemp_rope_50ft',
  ],
  trapline: [
    'ash_splint_basket',
    'blanket_wool_4pt_haugen',
    'squirrel_rifle_36',
    'black_powder_canister',
    'lead_bar_5lb',
    'bullet_mould',
    'percussion_caps_tin',
    'powder_horn',
    'steel_trap_no1',
    'steel_trap_no3',
    'hatchet_belt',
    'butcher_knife',
    'fleshing_knife_boards',
    'snare_wire_brass',
    'camp_kettle_pair',
    'tin_cup',
    'flint_steel_char_tin',
    'hardtack',
    'pemmican',
    'mackinaw_coat',
    'moccasins_hide',
  ],
  parsons_satchel: [
    'haversack_tarred',
    'pocket_bible',
    'holy_water_vial',
    'rusk_domestic_medicine',
    'linen_bandages',
    'laudanum_2oz',
    'whiskey_quart',
    'blanket_wool_3pt',
    'gum_blanket',
    'tin_cup',
    'canteen_tin_wool',
    'lucifers_box',
    'match_safe',
    'candles_tallow_lb',
    'hardtack',
    'salt_pork',
    'coffee_green',
    'salt_lb',
    'iron_nails_pocketful',
    'rowan_red_thread_cross',
    'blank_journal_pencils',
    'clasp_knife',
  ],
  light_foot: [
    'ash_splint_basket',
    'blanket_wool_3pt',
    'gum_blanket',
    'capote',
    'moccasins_hide',
    'flannel_shirt_checked',
    'hunting_bow_hickory',
    'arrows_iron_dozen',
    'arrows_flint_dozen',
    'knapped_flint_blade',
    'snare_wire_brass',
    'canteen_gourd',
    'burning_glass',
    'lucifers_box',
    'tinder_pouch',
    'pemmican',
    'salt_lb',
    'rowan_red_thread_cross',
    'hag_stone',
    'brass_bell_small',
  ],
  winter_overland: [
    'mule',
    'pack_saddle_sawbuck',
    'oats_bushel',
    'buffalo_robe',
    'blanket_wool_4pt_haugen',
    'snowshoes_pair',
    'mackinaw_coat',
    'fur_cap_earflaps',
    'mittens_wool_overmitts',
    'red_flannels',
    'wool_socks',
    'boots_tall_cowhide',
    'dutch_oven_10qt',
    'camp_kettle_pair',
    'felling_axe_hollister',
    'bucksaw',
    'oilcloth_fly_8x10',
    'double_barrel_12ga',
    'black_powder_canister',
    'shot_no4_5lb',
    'percussion_caps_tin',
  ],
};

/** Spot checks: 03 weight (lb) and price ($) within rounding. */
const SPOT_CHECKS: [string, number, number][] = [
  ['haversack_tarred', 1, 0.75],
  ['knapsack_army', 3, 1.5],
  ['pack_board_tumpline', 5, 2.5],
  ['blanket_wool_3pt', 5, 3.0],
  ['buffalo_robe', 12, 5.0],
  ['lucifers_box', 0.1, 0.05],
  ['lard_oil_quart', 2, 0.3],
  ['camp_kettle_pair', 3, 0.75],
  ['frying_pan', 2.5, 0.5],
  ['dutch_oven_10qt', 14, 1.75],
  ['felling_axe_hollister', 5, 1.5],
  ['crowbar_3ft', 8, 0.75],
  ['smoothbore_musket_surplus', 10, 6.0],
  ['squirrel_rifle_36', 7, 12.0],
  ['plains_rifle_ostrander', 10.5, 25.0],
  ['hemp_rope_50ft', 8, 1.0],
  ['mackinaw_coat', 5, 5.0],
  ['buffalo_coat', 15, 12.0],
  ['hardtack', 1, 0.08],
  ['salt_pork', 1, 0.12],
  ['coffee_green', 1, 0.14],
  ['cold_iron_knife_brauer', 0.5, 3.5],
  ['steel_trap_no3', 3, 1.25],
  ['surgeons_pocket_case', 1, 6.0],
];

const FOOD_SECTIONS = new Set(['provisions', 'wild_food']);

/** The food block of an item that must exist and be food. */
function foodOf(id: string): FoodLike {
  const food = items[id]?.food;
  if (!food) throw new Error(`${id} has no food block`);
  return food;
}

describe('content-items: catalog coverage (03 §6)', () => {
  for (const [section, ids] of Object.entries(CATALOG_ROWS)) {
    it(`${section} has an item for every row`, () => {
      const missing = ids.filter((id) => !items[id]);
      expect(missing).toEqual([]);
    });
  }

  it('every catalog row is filed under a section that belongs to its 03 group', () => {
    const allowed: Record<string, string[]> = {
      '6.1 packs_bedding': ['packs_bedding'],
      '6.2 shelter': ['shelter'],
      '6.3 fire_light': ['fire_light'],
      '6.4 cookery & provisions': ['cookery', 'provisions', 'trade_goods'],
      '6.5 tools': ['tools'],
      '6.6 clothing': ['clothing'],
      '6.7 arms & ammunition': ['arms', 'ammunition'],
      '6.8 armor': ['armor'],
      '6.9 medicine': ['medicine'],
      '6.10 fishing & trapping': ['fishing_trapping'],
      '6.11 rope & climbing': ['rope_climbing'],
      '6.12 folk magic': ['folk_magic', 'provisions'],
      '6.13 books': ['books'],
      '6.14 animals, tack & boats': ['animals_tack_boats'],
    };
    const bad: string[] = [];
    for (const [group, ids] of Object.entries(CATALOG_ROWS)) {
      for (const id of ids) {
        const it = items[id];
        if (it && !(allowed[group] ?? []).includes(it.section)) bad.push(`${id} is ${it.section}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('content-items: prebuilt kits (03 §7.3)', () => {
  for (const [kit, ids] of Object.entries(KITS)) {
    it(`kit ${kit} can be assembled from existing ids`, () => {
      const missing = ids.filter((id) => !items[id]);
      expect(missing).toEqual([]);
    });
  }
});

describe('content-items: food (00 P8)', () => {
  const foods = Object.values(items).filter((i) => i.food);

  it('every provisions or wild_food item has a food block with at least one prep', () => {
    const bad = Object.values(items)
      .filter((i) => FOOD_SECTIONS.has(i.section))
      .filter((i) => !i.food || i.food.prep.length < 1)
      .map((i) => i.id);
    expect(bad).toEqual([]);
  });

  it('every perishable item has a finite shelf life', () => {
    const bad = Object.values(items)
      .filter((i) => i.tags.includes('perishable'))
      .filter((i) => !i.food || !Number.isFinite(i.food.shelf_life_days))
      .map((i) => i.id);
    expect(bad).toEqual([]);
  });

  it('at least 15 foods, and no two identical on kcal/kg, fresh, shelf life and prep', () => {
    const sigs = foods.map((i) => {
      const f = i.food as FoodLike;
      const kcalPerKg = Math.round((f.kcal * 1000) / i.weight_g);
      const prep = f.prep.map((p) => `${p.method}:${p.minutes}:${p.fire_minutes ?? 0}`).join(',');
      return `${kcalPerKg}|${f.fresh}|${f.shelf_life_days}|${prep}`;
    });
    expect(foods.length).toBeGreaterThanOrEqual(15);
    expect(new Set(sigs).size).toBe(sigs.length);
  });

  it('prep chains resolve: every yields target exists', () => {
    const bad: string[] = [];
    for (const i of foods) {
      for (const p of (i.food as FoodLike).prep) {
        if (p.yields && !items[p.yields]) bad.push(`${i.id}->${p.yields}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('green coffee -> roasted -> ground is a chain via yields', () => {
    expect(foodOf('coffee_green').prep[0]?.yields).toBe('coffee_roasted');
    expect(foodOf('coffee_roasted').prep[0]?.yields).toBe('coffee_ground');
  });

  it('hardtack is dead food and dried apples are keeping food (03 §3.7.3 bands)', () => {
    expect(foodOf('hardtack').fresh).toBeLessThan(10);
    const apples = foodOf('dried_apples').fresh;
    expect(apples).toBeGreaterThanOrEqual(10);
    expect(apples).toBeLessThan(40);
  });
});

describe('content-items: weights and prices (03 §6, spot check)', () => {
  it('20+ spot-checked items match 03 weight (lb → g) and price ($ → cents) within rounding', () => {
    expect(SPOT_CHECKS.length).toBeGreaterThanOrEqual(20);
    const bad: string[] = [];
    for (const [id, lb, dollars] of SPOT_CHECKS) {
      const it = items[id];
      if (!it) {
        bad.push(`${id}: missing`);
        continue;
      }
      if (Math.abs(it.weight_g - Math.round(lb * 453.6)) > 1) bad.push(`${id}: weight ${it.weight_g} vs ${lb} lb`);
      if (it.value_cents !== Math.round(dollars * 100)) bad.push(`${id}: ${it.value_cents}c vs $${dollars}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('content-items: supplies and consumption', () => {
  it('every consumes kind has a supplying item', () => {
    const supplied = new Set<string>();
    for (const i of Object.values(items)) {
      const sup = (i as unknown as { supply?: { kind: string } }).supply;
      if (sup) supplied.add(sup.kind);
    }
    const bad: string[] = [];
    for (const i of Object.values(items)) {
      const cons = (i as unknown as { consumes?: { kind: string }[] }).consumes ?? [];
      for (const c of cons) if (!supplied.has(c.kind)) bad.push(`${i.id}:${c.kind}`);
    }
    expect(bad).toEqual([]);
  });

  it('a lantern burns lamp oil by the hour and a rifle burns caps and powder per use', () => {
    const lantern = items.glass_lantern_fenwick as unknown as { consumes: { kind: string; per: string }[] };
    expect(lantern.consumes[0]).toMatchObject({ kind: 'lamp_oil', per: 'hour' });
    const rifle = items.plains_rifle_ostrander as unknown as { consumes: { kind: string; per: string }[] };
    expect(rifle.consumes.map((c) => c.kind)).toEqual(
      expect.arrayContaining(['powder_gr', 'percussion_cap', 'ball_54']),
    );
    expect(rifle.consumes.every((c) => c.per === 'use')).toBe(true);
  });
});
