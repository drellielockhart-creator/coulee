/**
 * World content: peoples, name pools, sites, places/buildings.
 * OWNER: module:content-world (see docs/impl/MODULES.md).
 *
 * Peoples follow 02 §12 (ancestry as a data slot) and ADR 0001 "Peoples". No sim code may
 * branch on a people id; it reads these fields.
 */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import { abilityMods, checkRefs, defineDomain, type Issue, id, int, nonNegInt, ref } from './common.ts';

export const PeopleSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  plural: z.string().min(1),
  description: z.string().default(''),
  /**
   * Concealed peoples (shadow_faekin) pass as another people by default: other actors only
   * know through beliefs. `passes_as` lists the peoples a member may present as.
   */
  concealed: z.boolean().default(false),
  passes_as: z.array(ref()).default([]),
  ability_mods: abilityMods(),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  speed_ft: int().min(5).max(60).default(30),
  senses: z.array(z.enum(['normal', 'low_light', 'darkvision', 'scent', 'second_sight'])).default(['normal']),
  /** Range of 'darkvision' in feet (12 §10.1), 0 when the people lack it. */
  darkvision_ft: int().min(0).max(120).default(0),
  maturity_age: int().min(1).max(200),
  lifespan: z.strictObject({
    middle: int().min(1),
    old: int().min(1),
    venerable: int().min(1),
    /** Dice string for the random extra years past venerable, e.g. '2d20' (12 §10.1). */
    max_roll: z
      .string()
      .regex(/^\d+d\d+$/)
      .optional(),
  }),
  /** Food need as a percent of the human baseline (12 §10.1; goblins eat about 70%). Read by needs/provisions. */
  kcal_pct: int().min(10).max(300).default(100),
  /** Trait ids (resolved against content/base/traits by the psyche module when present). */
  traits: z.array(id()).default([]),
  /** Flat bonuses to skills (skill id -> bonus), e.g. Fae Courtesy +2 (12 §10.1). */
  skill_bonuses: z.record(id(), int().min(-4).max(4)).default({}),
  /**
   * Fae-rule inputs (12 §10.2; 06 owns the curves). All integers. `drift_gain_pct` is a band
   * table of [drift_at_or_above, pct]; ascending, first band must start at 0.
   */
  fae: z
    .strictObject({
      drift_floor: int().min(0).max(100).default(0),
      drift_gain_pct: z.array(z.tuple([int().min(0).max(100), int().min(0).max(1000)])).default([[0, 100]]),
      weakness_drift_offset: int().min(-50).max(50).default(0),
      bound_rate_pct: int().min(0).max(300).default(100),
      /** Name-targeting effects take this modifier (sealed name / deep-name), 0 = none. */
      name_target_mod: int().min(-10).max(0).default(0),
      /** Comfortable Fae intensity band underground, if different from the surface band. */
      comfort_underground: z.strictObject({ min: int().min(0).max(5), max: int().min(0).max(5) }).optional(),
      /** 'The Pull' (12 §5.6): from this Fae intensity on, an hourly Longing thought. */
      pull_from_fi: int().min(1).max(5).optional(),
      /** Counts as fae when inside fae dwellings (thresholds, 12 §10.2). */
      counts_as_fae_indoors: z.boolean().default(false),
    })
    .default({
      drift_floor: 0,
      drift_gain_pct: [[0, 100]],
      weakness_drift_offset: 0,
      bound_rate_pct: 100,
      name_target_mod: 0,
      counts_as_fae_indoors: false,
    }),
  /** Children of mixed parentage are rolled per child, never "half" (12 §5.3). */
  inheritance: z
    .strictObject({
      mode: z.enum(['binary_per_child']).default('binary_per_child'),
      chance_pct_one_parent: int().min(0).max(100).default(50),
    })
    .optional(),
  /**
   * Rule hooks (02 §12 traits). DEPRECATED boolean kept for compatibility; the real input is
   * `fae.weakness_drift_offset` (12 §13).
   */
  cold_iron_sensitive: z.boolean().default(false),
  fae_notice_mod: int().min(-10).max(10).default(0),
  fae_comfort: z.strictObject({ min: int().min(0).max(5), max: int().min(0).max(5) }).default({
    min: 0,
    max: 2,
  }),
  languages: z.array(id()).default([]),
  /**
   * DEPRECATED and unauthored: literacy belongs to cultures (12 ground rule 1, §13). Kept
   * optional so older readers still type-check.
   */
  literacy_pct: int().min(0).max(100).optional(),
  diet: z.enum(['omnivore', 'herbivore', 'carnivore', 'fae']).default('omnivore'),
});
export type PeopleDef = z.output<typeof PeopleSchema>;

/**
 * A culture: the settler community an actor was raised in (12 §13). Literacy, language,
 * naming, denominations and foodways live here, never on the people.
 */
export const CultureSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  description: z.string().default(''),
  /** Peoples commonly raised in this culture (a hint for the generator, not a rule). */
  peoples: z.array(ref()).default(['human']),
  languages: z.array(id()).default([]),
  /** Share of adults who read, percent (period estimate, 1855). */
  literacy_pct: int().min(0).max(100),
  name_pools: z.array(ref()).default([]),
  /** Denomination mix, percent (need not total 100: remainder is unchurched). */
  denominations: z.array(z.strictObject({ id: id(), pct: int().min(0).max(100) })).default([]),
  foodways: z
    .strictObject({
      /** Item ids eaten daily. */
      staples: z.array(ref()).default([]),
      /** Item ids for feasts, Sundays, holidays. */
      festive: z.array(ref()).default([]),
      /** Plain-text customs that a superego package can later cite (10). */
      customs: z.array(z.string().min(1)).default([]),
    })
    .default({ staples: [], festive: [], customs: [] }),
});
export type CultureDef = z.output<typeof CultureSchema>;

export const NamePoolSchema = z.strictObject({
  id: id(),
  /** Settler culture label: "norwegian", "yankee", "cornish", "german", "irish"... */
  culture: z.string().min(1),
  peoples: z.array(ref()).min(1),
  given_female: z.array(z.string().min(1)).default([]),
  given_male: z.array(z.string().min(1)).default([]),
  family: z.array(z.string().min(1)).default([]),
  /** Elven house-names ("of Sølvklokke Hall", 12 §5.4). */
  house_names: z.array(z.string().min(1)).default([]),
  /** Private names: elven sealed names, goblin deep-names, faekin dusk-names. Fill `true_name`. */
  private_names: z.array(z.string().min(1)).default([]),
  /** Free-text notes on usage rules (12 §5.4, §6.5, §8.4). */
  notes: z.string().optional(),
});
export type NamePoolDef = z.output<typeof NamePoolSchema>;

/** A site map (05 §2): the town grid that places sit on. 1 tile = `tile_ft` feet. */
export const SiteSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  description: z.string().default(''),
  /** Local prose names; optional for older authored sites. */
  landmarks: z
    .strictObject({
      main_street: z.string().min(1),
      back_road: z.string().min(1),
      creek: z.string().min(1),
    })
    .optional(),
  grid: z.strictObject({ w: int().min(4).max(1024), h: int().min(4).max(1024) }),
  tile_ft: int().min(1).max(100).default(10),
  /** Baseline Fae intensity 0..5 (00 "The wilds are Faerie"). */
  fae_intensity: int().min(0).max(5).default(0),
});
export type SiteDef = z.output<typeof SiteSchema>;

export const PLACE_KINDS = [
  'building',
  'house',
  'farmstead',
  'yard',
  'field',
  'landing',
  'road',
  'outdoor',
  'wild',
] as const;

/**
 * A place on a site: a building or outdoor area actors can be "at" (T1 location) and the
 * renderer can draw (position + footprint on the site grid, in tiles; origin top-left).
 * `tags` are venue tags activities and occupations match on (e.g. 'tavern', 'church',
 * 'smithy', 'store', 'mill', 'home', 'workplace').
 */
export const PlaceSchema = z.strictObject({
  id: id(),
  site: ref(),
  name: z.string().min(1),
  kind: z.enum(PLACE_KINDS),
  description: z.string().default(''),
  tags: z.array(id()).default([]),
  x: nonNegInt(),
  y: nonNegInt(),
  w: int().min(1),
  h: int().min(1),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  /** Max comfortable occupancy; 0 = unlimited (outdoor). */
  capacity: nonNegInt().default(0),
  /** Asset id for the renderer: apps/web/public/assets/models/<model>.glb. */
  model: id().optional(),
  /** Fae intensity override for this place (e.g. a fairy ring). */
  fae_intensity: int().min(0).max(5).optional(),
});
export type PlaceDef = z.output<typeof PlaceSchema>;

export const worldDomains = {
  peoples: defineDomain({ dir: 'peoples', key: 'people', schema: PeopleSchema }),
  namePools: defineDomain({ dir: 'names', key: 'name_pool', schema: NamePoolSchema }),
  sites: defineDomain({ dir: 'places', key: 'site', schema: SiteSchema }),
  places: defineDomain({ dir: 'places', key: 'place', schema: PlaceSchema }),
  cultures: defineDomain({ dir: 'cultures', key: 'culture', schema: CultureSchema }),
};

export function worldRefs(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  for (const p of Object.values(b.peoples)) {
    checkRefs(issues, `peoples:${p.id}`, 'passes_as', p.passes_as, b.peoples, 'people');
    if (p.concealed && p.passes_as.length === 0) {
      issues.push({ where: `peoples:${p.id}`, message: 'concealed people needs passes_as' });
    }
    checkRefs(issues, `peoples:${p.id}`, 'skill_bonuses', Object.keys(p.skill_bonuses), b.skills, 'skill');
    if (p.senses.includes('darkvision') !== p.darkvision_ft > 0) {
      issues.push({ where: `peoples:${p.id}`, message: "'darkvision' sense and darkvision_ft > 0 must agree" });
    }
    // 12 §13: STR/DEX/CON +-1 only; INT/WIS/CHA must be 0.
    for (const k of ['str', 'dex', 'con'] as const) {
      const v = p.ability_mods[k] ?? 0;
      if (Math.abs(v) > 1) issues.push({ where: `peoples:${p.id}`, message: `ability_mods.${k} beyond +-1` });
    }
    for (const k of ['int', 'wis', 'cha'] as const) {
      if ((p.ability_mods[k] ?? 0) !== 0)
        issues.push({ where: `peoples:${p.id}`, message: `ability_mods.${k} must be 0 (12 §13)` });
    }
    const bands = p.fae.drift_gain_pct;
    if (bands[0]?.[0] !== 0 || bands.some((band, i) => i > 0 && band[0] <= (bands[i - 1]?.[0] ?? 0))) {
      issues.push({ where: `peoples:${p.id}`, path: 'fae.drift_gain_pct', message: 'bands must ascend from 0' });
    }
    if (p.lifespan.middle >= p.lifespan.old || p.lifespan.old >= p.lifespan.venerable) {
      issues.push({ where: `peoples:${p.id}`, path: 'lifespan', message: 'middle < old < venerable' });
    }
  }
  for (const c of Object.values(b.cultures)) {
    const where = `cultures:${c.id}`;
    checkRefs(issues, where, 'peoples', c.peoples, b.peoples, 'people');
    checkRefs(issues, where, 'name_pools', c.name_pools, b.namePools, 'name pool');
    checkRefs(issues, where, 'foodways.staples', c.foodways.staples, b.items, 'item');
    checkRefs(issues, where, 'foodways.festive', c.foodways.festive, b.items, 'item');
  }
  for (const n of Object.values(b.namePools)) {
    checkRefs(issues, `namePools:${n.id}`, 'peoples', n.peoples, b.peoples, 'people');
  }
  for (const pl of Object.values(b.places)) {
    checkRefs(issues, `places:${pl.id}`, 'site', [pl.site], b.sites, 'site');
    const site = b.sites[pl.site];
    if (site && (pl.x + pl.w > site.grid.w || pl.y + pl.h > site.grid.h)) {
      issues.push({ where: `places:${pl.id}`, message: `footprint exceeds site grid ${site.id}` });
    }
  }
  return issues;
}
