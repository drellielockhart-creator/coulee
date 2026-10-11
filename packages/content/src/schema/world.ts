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
  maturity_age: int().min(1).max(200),
  lifespan: z.strictObject({
    middle: int().min(1),
    old: int().min(1),
    venerable: int().min(1),
  }),
  /** Rule hooks (02 §12 traits). Small placeholder modifiers until 12-peoples.md lands. */
  cold_iron_sensitive: z.boolean().default(false),
  fae_notice_mod: int().min(-10).max(10).default(0),
  fae_comfort: z.strictObject({ min: int().min(0).max(5), max: int().min(0).max(5) }).default({
    min: 0,
    max: 2,
  }),
  languages: z.array(id()).default([]),
  /** Base literacy rate for NPC generation, percent. */
  literacy_pct: int().min(0).max(100).default(50),
  diet: z.enum(['omnivore', 'herbivore', 'carnivore', 'fae']).default('omnivore'),
});
export type PeopleDef = z.output<typeof PeopleSchema>;

export const NamePoolSchema = z.strictObject({
  id: id(),
  /** Settler culture label: "norwegian", "yankee", "cornish", "german", "irish"... */
  culture: z.string().min(1),
  peoples: z.array(ref()).min(1),
  given_female: z.array(z.string().min(1)).default([]),
  given_male: z.array(z.string().min(1)).default([]),
  family: z.array(z.string().min(1)).default([]),
});
export type NamePoolDef = z.output<typeof NamePoolSchema>;

/** A site map (05 §2): the town grid that places sit on. 1 tile = `tile_ft` feet. */
export const SiteSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  description: z.string().default(''),
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
};

export function worldRefs(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  for (const p of Object.values(b.peoples)) {
    checkRefs(issues, `peoples:${p.id}`, 'passes_as', p.passes_as, b.peoples, 'people');
    if (p.concealed && p.passes_as.length === 0) {
      issues.push({ where: `peoples:${p.id}`, message: 'concealed people needs passes_as' });
    }
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
