/** Place lookup index for venue resolution and site-scoped place scans. OWNER: module:activity. */
import { type PlaceId, rowsOf } from '../ids.ts';
import type { World } from '../world.ts';

type Place = World['places'][PlaceId] & {};
/**
 * Derived place index (never saved): place rows by site, and place ids by site (regional worlds
 * only) and tag. Places are installed at init and by the population hook, which both call
 * `forgetVenueIndex`; the index is also rebuilt every game hour. Lists are in ascending id order.
 */
interface PlaceIndex {
  time: number;
  regional: boolean;
  sites: Map<string, Place[]>;
  byTag: Map<string, Map<string, PlaceId[]>>;
}
const indexes = new Map<object, PlaceIndex>();
const NO_SITE = '\u0000';
export function forgetVenueIndex(world: World): void {
  indexes.delete(world.places);
}
function placeIndex(world: World): PlaceIndex {
  const regional = world.region !== undefined && world.region !== null;
  let index = indexes.get(world.places);
  if (!index || index.time !== world.time || index.regional !== regional) {
    const sites = new Map<string, Place[]>();
    const byTag = new Map<string, Map<string, PlaceId[]>>();
    for (const p of rowsOf(world.places)) {
      const site = p.siteId ?? NO_SITE;
      const rows = sites.get(site);
      if (rows) rows.push(p);
      else sites.set(site, [p]);
      const key = regional ? site : '';
      let tags = byTag.get(key);
      if (!tags) {
        tags = new Map();
        byTag.set(key, tags);
      }
      for (const tag of new Set(p.tags)) {
        const list = tags.get(tag);
        if (list) list.push(p.id);
        else tags.set(tag, [p.id]);
      }
    }
    if (!index && indexes.size >= 16) indexes.clear();
    index = { time: world.time, regional, sites, byTag };
    indexes.set(world.places, index);
  }
  return index;
}
/** Places (same site in regional worlds) carrying any of `tags`, each once; callers order them. */
export function venueCandidates(world: World, site: string | undefined, tags: readonly string[]): PlaceId[] {
  const index = placeIndex(world);
  const byTag = index.byTag.get(index.regional ? (site ?? NO_SITE) : '');
  if (!byTag) return [];
  const out = new Set<PlaceId>();
  for (const tag of tags) for (const id of byTag.get(tag) ?? []) out.add(id);
  return [...out];
}
/** Every place whose `siteId` equals `site` (in any world), ascending id. Shared: do not mutate. */
export function placesInSite(world: World, site: string | undefined): readonly Place[] {
  return placeIndex(world).sites.get(site ?? NO_SITE) ?? [];
}
