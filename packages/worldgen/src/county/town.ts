import type { PlaceDef, SiteDef } from '@coulee/content/schema';
import type { CountyRegionContext } from './types.ts';
/** Apply regional facts after local text, so a town cannot overwrite its county context. */
export function applyCountyContext(site: SiteDef, places: PlaceDef[], c: CountyRegionContext): void {
  if (c.protected) throw new Error('Cannot place a generated town at a protected site');
  site.fae_intensity = c.faeIntensity;
  site.description = `${c.townName} stands at the gravel crossing of ${c.creekName}, ${c.elevationFt} feet above sea level. ${c.geology === 'sandstone' ? 'Sandstone lies beneath the dolomite-capped ridges' : 'Dolomite underlies the upland'}, with ${c.soil} soil and ${c.vegetation.replaceAll('_', ' ')} nearby. ${c.springs.length} contact springs and ${c.bluffs.length} bluff cells lie in the surrounding coulee. Roads lead toward ${c.neighbors.map((n) => n.name).join(', ')}.`;
  for (const p of places) {
    if (p.tags.includes('creek'))
      p.description += ` This reach belongs to ${c.creekName}, draining toward ${c.riverName}.`;
    if (p.tags.includes('bluff'))
      p.description += ` The county slope faces ${c.aspect}; the valley floor exposes ${c.geology}.`;
    if (p.tags.includes('spring'))
      p.description += ` ${c.springs.length} spring cells mark the surrounding rock contact.`;
    if (p.kind === 'road')
      p.description += ` County road approaches: ${c.entrances.map((e) => e.side).join(', ')}. Neighboring settlements: ${c.neighbors.map((n) => n.name).join(', ')}.`;
  }
}
