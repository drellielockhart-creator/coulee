import type { Place } from '../actor.ts';
export function isProtectedSite(place: Pick<Place, 'tags'> & { geometry?: string }): boolean {
  return (
    place.tags.some(
      (t) =>
        ['protected', 'protected_site', 'mound', 'burial', 'rock_art', 'rockshelter', 'atrocity_site'].includes(t) ||
        t.startsWith('mound_'),
    ) ||
    (place.geometry?.startsWith('mound') ?? false)
  );
}
