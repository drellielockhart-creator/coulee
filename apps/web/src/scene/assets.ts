/**
 * glb asset loading with procedural fallbacks. OWNER: module:web.
 *
 * Looks for models in this order:
 *   1. /assets/manifest.json, if present (several shapes accepted, see `normalizeManifest`);
 *   2. /assets/models/<id>.glb (the module:assets layout);
 *   3. /assets/<id>.glb.
 * A response only counts if it really is a binary glTF (magic "glTF"): the preview server's SPA
 * fallback answers unknown paths with index.html and a 200.
 * Anything missing renders as a procedural placeholder, so the map is never empty.
 */
import type * as THREE from 'three';
import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');

export type Manifest = Map<string, string>;

/** Accepts: ["mill", ...] | {models: [...]} | {models: {id: path}} | {id: path} | [{id, path|file|glb}]. */
export function normalizeManifest(raw: unknown): Manifest {
  const out: Manifest = new Map();
  const add = (id: unknown, path: unknown) => {
    if (typeof id !== 'string' || id === '') return;
    if (typeof path === 'string' && path !== '') {
      const p = path.startsWith('/') || /^https?:/.test(path) ? path : `${BASE}assets/${path.replace(/^\.?\//, '')}`;
      out.set(id, p);
    } else {
      out.set(id, `${BASE}assets/models/${id}.glb`);
    }
  };
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      for (const e of v) {
        if (typeof e === 'string') add(e, null);
        else if (e && typeof e === 'object') {
          const o = e as Record<string, unknown>;
          add(o.id ?? o.name, o.glb ?? o.path ?? o.file ?? o.model ?? null);
        }
      }
    } else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if ('models' in o) {
        walk(o.models);
        if ('props' in o) walk(o.props);
        if ('figures' in o) walk(o.figures);
        if (o.aliases && typeof o.aliases === 'object') {
          for (const [alias, target] of Object.entries(o.aliases)) {
            if (typeof target === 'string') out.set(alias, out.get(target) ?? `${BASE}assets/models/${target}.glb`);
          }
        }
        return;
      }
      for (const [k, val] of Object.entries(o)) {
        if (typeof val === 'string') add(k, val);
        else if (val && typeof val === 'object') {
          const r = val as Record<string, unknown>;
          add(k, r.glb ?? r.path ?? r.file ?? null);
        }
      }
    }
  };
  walk(raw);
  return out;
}

let manifestPromise: Promise<Manifest> | null = null;

export function loadManifest(): Promise<Manifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(`${BASE}assets/manifest.json`)
      .then(async (r) => {
        if (!r.ok) return new Map<string, string>();
        const text = await r.text();
        if (text.trimStart().startsWith('<')) return new Map<string, string>();
        return normalizeManifest(JSON.parse(text));
      })
      .catch(() => new Map<string, string>());
  }
  return manifestPromise;
}

function isGlb(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 12) return false;
  return new DataView(buf).getUint32(0, true) === 0x46546c67; // 'glTF'
}

/** The glTF loader is its own chunk, fetched the first time a model is actually needed. */
let loader: Promise<GLTFLoader> | null = null;
function gltfLoader(): Promise<GLTFLoader> {
  loader ??= import('three/addons/loaders/GLTFLoader.js').then((m) => new m.GLTFLoader());
  return loader;
}
const cache = new Map<string, Promise<THREE.Object3D | null>>();

async function fetchGlb(url: string): Promise<THREE.Object3D | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    if (!isGlb(buf)) return null;
    const gltf = await (await gltfLoader()).parseAsync(buf, '');
    const root = gltf.scene;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const s = mat as THREE.MeshStandardMaterial;
            s.flatShading = true;
            s.roughness = Math.max(s.roughness, 0.85);
            s.metalness = Math.min(s.metalness, 0.1);
            s.needsUpdate = true;
          }
        }
      }
    });
    return root;
  } catch {
    return null;
  }
}

/** Resolve a model id to a loaded scene (shared; clone before adding), or null. */
export function loadModel(id: string): Promise<THREE.Object3D | null> {
  let p = cache.get(id);
  if (!p) {
    p = loadManifest().then(async (m) => {
      const listed = m.get(id);
      const urls = listed ? [listed] : [`${BASE}assets/models/${id}.glb`, `${BASE}assets/${id}.glb`];
      for (const u of urls) {
        const obj = await fetchGlb(u);
        if (obj) return obj;
      }
      return null;
    });
    cache.set(id, p);
  }
  return p;
}

/** First manifest id matching any of the patterns (actor figures, props). */
export async function findModelId(patterns: readonly RegExp[]): Promise<string | null> {
  const m = await loadManifest();
  for (const re of patterns) for (const id of [...m.keys()].sort()) if (re.test(id)) return id;
  return null;
}
