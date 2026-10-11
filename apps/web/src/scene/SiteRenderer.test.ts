import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadModel } from './assets.ts';
import { type ScenePlace, SiteRenderer } from './SiteRenderer.ts';

vi.mock('./assets.ts', () => ({ loadModel: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

describe('outdoor place models', () => {
  it('loads the ford without a building placeholder, at its world footprint', async () => {
    const src = new THREE.Group();
    src.add(new THREE.Mesh(new THREE.BoxGeometry(5, 1, 2)));
    vi.mocked(loadModel).mockResolvedValue(src);
    vi.stubGlobal('document', { createElement: () => ({ className: '', textContent: '' }) });
    // Exercise place construction without opening a WebGL context in Node.
    const renderer = Object.create(SiteRenderer.prototype) as SiteRenderer;
    const placesGroup = new THREE.Group();
    const invalidate = vi.fn();
    Object.assign(renderer, {
      tileM: 3,
      placesGroup,
      labels: { appendChild: vi.fn() },
      places: new Map(),
      disposed: false,
      invalidate,
    });
    const place: ScenePlace = {
      id: 5,
      name: 'Ford',
      x: 12,
      y: 7,
      w: 4,
      h: 2,
      kind: 'outdoor',
      tags: ['ford'],
      rotation: 0,
      model: 'ford',
    };
    (renderer as unknown as { addPlace: (p: ScenePlace) => void }).addPlace(place);
    await Promise.resolve();
    expect(loadModel).toHaveBeenCalledWith('ford');
    const root = placesGroup.children[0];
    expect(root?.position.toArray()).toEqual([42, 0, 24]);
    expect(root?.children.some((c) => c.type === 'Group')).toBe(true);
    expect(invalidate).toHaveBeenCalledOnce();
  });
  it('retains the outdoor surface when its model is unavailable', async () => {
    vi.mocked(loadModel).mockResolvedValue(null);
    vi.stubGlobal('document', { createElement: () => ({ className: '', textContent: '' }) });
    const renderer = Object.create(SiteRenderer.prototype) as SiteRenderer;
    const placesGroup = new THREE.Group();
    Object.assign(renderer, {
      tileM: 3,
      placesGroup,
      labels: { appendChild: vi.fn() },
      places: new Map(),
      disposed: false,
    });
    (renderer as unknown as { addPlace: (p: ScenePlace) => void }).addPlace({
      id: 1,
      name: 'Field',
      x: 3,
      y: 2,
      w: 4,
      h: 4,
      kind: 'field',
      tags: [],
      rotation: 0,
      model: 'missing',
    });
    await Promise.resolve();
    expect(placesGroup.children[0]?.children.some((c) => c.type === 'Mesh')).toBe(true);
  });
});
