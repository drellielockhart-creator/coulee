import { describe, expect, it } from 'vitest';
import { normalizeManifest } from './assets.ts';

describe('asset manifests', () => {
  it('resolves Blender model files and aliases without assuming a site layout', () => {
    const result = normalizeManifest({
      models: [
        { id: 'ford', file: 'models/ford.glb' },
        { id: 'store', file: 'models/store.glb' },
      ],
      aliases: { outfitter: 'store' },
    });
    expect(result.get('ford')).toBe('/assets/models/ford.glb');
    expect(result.get('outfitter')).toBe('/assets/models/store.glb');
  });
  it('tolerates missing manifests and older lists', () => {
    expect(normalizeManifest(null).size).toBe(0);
    expect(normalizeManifest(['mill']).get('mill')).toBe('/assets/models/mill.glb');
  });
});
