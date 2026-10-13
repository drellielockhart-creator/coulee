import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fitRegion, type RegionMapData, roadPosition, zoomRegion } from '../lib/regionMap.ts';
import { RegionMap } from './RegionMap.tsx';

const map: RegionMapData = {
  layout: 'schematic',
  observedAt: 120 as RegionMapData['observedAt'],
  sites: [
    { id: 'a', siteId: 'town', name: 'Town', x: 100, y: 100 },
    { id: 'b', siteId: 'farm', name: 'Farm', x: 340, y: 100 },
  ],
  roads: [{ id: 'road', a: 'a', b: 'b', name: 'Ridge Road', distanceFt: 60000 }],
  currentNodeId: null,
  position: {
    edgeId: 'road',
    direction: 'ab',
    feet: 15000,
    distanceFt: 60000,
    progressPermille: 250,
    towardNodeId: 'b',
    status: 'walking',
  },
  reports: [{ nodeId: 'b', at: 60, text: 'A wagon reached the farm.' }],
};

describe('region map presentation', () => {
  it('renders known destination buttons, progress, camera controls and dated reports from supplied data', () => {
    const html = renderToStaticMarkup(
      <RegionMap map={map} name="County" destinations={['b']} busy={false} onDestination={() => {}} />,
    );
    expect(html).toContain('aria-label="Route to Farm"');
    expect(html).toContain('data-progress="250"');
    expect(html).toContain('walking toward Farm');
    expect(html).toContain('25% of this road');
    expect(html).toContain('Ridge Road');
    expect(html).toContain('reported 1 h ago');
    expect(html).toContain('aria-label="Zoom region in"');
    expect(html).not.toMatch(/NaN|undefined/);
  });
  it('fits both phone and desktop while keeping zoom anchored under the pointer', () => {
    for (const [width, height] of [
      [390, 500],
      [1040, 700],
    ]) {
      const camera = fitRegion(map.sites, width ?? 390, height ?? 500);
      for (const n of map.sites) {
        const x = n.x * camera.scale + camera.x;
        expect(x).toBeGreaterThanOrEqual(80);
        expect(x).toBeLessThanOrEqual((width ?? 390) - 80);
      }
      const anchor = { x: 133, y: 170 };
      const zoomed = zoomRegion(camera, 1.3, anchor);
      expect((anchor.x - zoomed.x) / zoomed.scale).toBeCloseTo((anchor.x - camera.x) / camera.scale);
      expect((anchor.y - zoomed.y) / zoomed.scale).toBeCloseTo((anchor.y - camera.y) / camera.scale);
    }
  });
  it('puts the PC on the correct side of the road after reversing, and tolerates missing geometry', () => {
    expect(roadPosition(map)).toMatchObject({ x: 160, y: 100 });
    expect(
      roadPosition({ ...map, position: map.position ? { ...map.position, direction: 'ba' } : null }),
    ).toMatchObject({ x: 280, y: 100 });
    expect(roadPosition({ ...map, sites: [] })).toBeNull();
    const html = renderToStaticMarkup(
      <RegionMap
        map={{ ...map, sites: [], roads: [], position: null, reports: [] }}
        name="County"
        destinations={[]}
        busy={false}
        onDestination={() => {}}
      />,
    );
    expect(html).toContain('No regional geography is known yet');
    expect(html).not.toMatch(/NaN|undefined/);
  });
});
