/**
 * The site view: an orthographic, RimWorld-ish three.js render of a site (11 §2.2, §5.5, §7.4).
 * OWNER: module:web.
 *
 * Draws only from world data (site grid + place footprints + actor places; ADR 0003): terrain
 * with the creek and bluffs, buildings (glb from module:assets when present, procedural
 * placeholders otherwise), trees, and actors as figures that walk between places.
 *
 * Renders on demand: a frame is drawn only when something changed or a walk is in progress
 * (11 §5.3 battery). Nothing computed here ever flows back into a Command (11 §1.7).
 */
import * as THREE from 'three';
import { loadModel } from './assets.ts';
import { attachGestures, CameraRig, type TiltPreset } from './camera.ts';
import { MotionTracker } from './motion.ts';
import { buildTerrain, hash01, type PlaceLike, type SiteLike, scatterTrees, type Terrain, tileMeters } from './terrain.ts';

export interface ScenePlace extends PlaceLike {
  name: string;
  rotation: number;
  model: string | null;
}

export interface SceneActor {
  id: number;
  label: string;
  placeId: number;
  travelingTo: number | null;
  arriveAt: number | null;
  since: number;
  isPlayer: boolean;
  child: boolean;
  alive: boolean;
}

export interface SceneTime {
  t: number;
  hour: number;
  minute: number;
  isDaylight: boolean;
  season: string;
  sunriseMinute: number;
  sunsetMinute: number;
}

export type PickHit = { kind: 'actor'; id: number } | { kind: 'place'; id: number } | null;

/** sRGB swatches (11 §7.4: desaturated earth; saturation is a signal). */
const SW = {
  straw: [0.64, 0.6, 0.42],
  springGrass: [0.47, 0.55, 0.33],
  summerGrass: [0.42, 0.53, 0.3],
  autumnGrass: [0.62, 0.55, 0.36],
  snow: [0.9, 0.91, 0.93],
  mud: [0.46, 0.39, 0.3],
  road: [0.55, 0.47, 0.36],
  sandstone: [0.76, 0.64, 0.46],
  dolomite: [0.72, 0.68, 0.58],
  woodsFloor: [0.4, 0.41, 0.28],
  water: [0.33, 0.46, 0.58],
  river: [0.4, 0.42, 0.38],
  whitewash: [0.88, 0.86, 0.8],
  board: [0.53, 0.46, 0.38],
  log: [0.45, 0.34, 0.24],
  barnRed: [0.55, 0.24, 0.19],
  shingle: [0.34, 0.29, 0.25],
  sootBoard: [0.3, 0.27, 0.25],
  fieldstone: [0.56, 0.54, 0.5],
  iron: [0.2, 0.21, 0.24],
  pine: [0.22, 0.32, 0.24],
  oakSpring: [0.48, 0.43, 0.33],
  oakSummer: [0.33, 0.42, 0.24],
  oakAutumn: [0.55, 0.38, 0.22],
  mapleSpring: [0.6, 0.5, 0.36],
  mapleSummer: [0.4, 0.5, 0.28],
  mapleAutumn: [0.72, 0.33, 0.18],
  bare: [0.42, 0.37, 0.32],
  trunk: [0.33, 0.26, 0.2],
  skin: [0.8, 0.66, 0.54],
  ink: [0.17, 0.14, 0.11],
  rubric: [0.64, 0.19, 0.12],
} as const;
type Swatch = readonly [number, number, number];

/** Cloth family (11 §7.4): indigo, butternut, madder, undyed wool, black broadcloth, calico. */
const CLOTH: Swatch[] = [
  [0.24, 0.29, 0.43],
  [0.55, 0.44, 0.28],
  [0.55, 0.25, 0.2],
  [0.76, 0.72, 0.62],
  [0.18, 0.17, 0.17],
  [0.6, 0.48, 0.42],
  [0.35, 0.38, 0.3],
];

function col(s: Swatch): THREE.Color {
  return new THREE.Color().setRGB(s[0], s[1], s[2], THREE.SRGBColorSpace);
}
function mix(a: Swatch, b: Swatch, t: number): Swatch {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const FIGURE_H = 1.75;

interface ActorGfx {
  root: THREE.Group;
  body: THREE.Group;
  ring: THREE.Mesh;
  label: HTMLDivElement;
  data: SceneActor;
}

interface PlaceGfx {
  root: THREE.Group;
  label: HTMLDivElement;
  data: ScenePlace;
  outline: THREE.LineSegments;
}

export class SiteRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly rig = new CameraRig();
  private readonly hemi = new THREE.HemisphereLight(0xf3ebdc, 0x5a4d3e, 1.6);
  private readonly sun = new THREE.DirectionalLight(0xfff1dc, 1.8);
  private readonly world = new THREE.Group();
  private readonly ground = new THREE.Group();
  private readonly placesGroup = new THREE.Group();
  private readonly actorsGroup = new THREE.Group();
  private readonly labels: HTMLDivElement;
  private readonly motion = new MotionTracker();
  private readonly detach: () => void;
  private readonly ro: ResizeObserver;
  private readonly canvas: HTMLCanvasElement;

  private siteKey = '';
  private site: (SiteLike & { name: string }) | null = null;
  private tileM = 3.048;
  private terrain: Terrain | null = null;
  private places = new Map<number, PlaceGfx>();
  private actors = new Map<number, ActorGfx>();
  private selectedActor: number | null = null;
  private selectedPlace: number | null = null;
  private dirty = true;
  private raf = 0;
  private disposed = false;
  private framed = false;
  private season = '';
  private treeMeshes: THREE.InstancedMesh[] = [];
  private treeSpots: ReturnType<typeof scatterTrees> = [];
  private msPerGameMinute = 667;
  private lastT = 0;

  /** Called when the player taps something on the map. */
  onPick: (hit: PickHit) => void = () => {};

  private readonly geo = {
    body: new THREE.CylinderGeometry(0.2, 0.3, 1.05, 7),
    head: new THREE.IcosahedronGeometry(0.17, 0),
    brim: new THREE.CylinderGeometry(0.3, 0.3, 0.04, 8),
    crown: new THREE.CylinderGeometry(0.15, 0.17, 0.2, 7),
    ring: new THREE.RingGeometry(0.42, 0.55, 24),
    blob: new THREE.CircleGeometry(0.42, 16),
  };
  private readonly mats = {
    skin: new THREE.MeshLambertMaterial({ color: col(SW.skin) }),
    ink: new THREE.MeshBasicMaterial({ color: col(SW.ink), side: THREE.BackSide }),
    hat: new THREE.MeshLambertMaterial({ color: col(SW.ink) }),
    blob: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
    ringPlayer: new THREE.MeshBasicMaterial({ color: col(SW.ink), side: THREE.DoubleSide }),
    ringSel: new THREE.MeshBasicMaterial({ color: col(SW.rubric), side: THREE.DoubleSide }),
    cloth: CLOTH.map((c) => new THREE.MeshLambertMaterial({ color: col(c) })),
  };

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'site-canvas';
    this.canvas.setAttribute('aria-label', 'Site map');
    container.appendChild(this.canvas);
    this.labels = document.createElement('div');
    this.labels.className = 'map-labels';
    this.labels.setAttribute('aria-hidden', 'true');
    container.appendChild(this.labels);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0xd9ccb3);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.world);
    this.world.add(this.ground, this.placesGroup, this.actorsGroup);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.detach = attachGestures(this.canvas, this.rig, {
      onChange: () => this.invalidate(),
      onTap: (x, y) => this.onPick(this.pick(x, y)),
    });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.loop();
  }

  private onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(this.raf);
    else this.loop();
  };

  invalidate(): void {
    this.dirty = true;
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.rig.resize(w, h);
    if (!this.framed && this.site && w > 0 && h > 0) this.frameTown();
    this.invalidate();
  }

  // -------------------------------------------------------------------------------------
  // Site + places
  // -------------------------------------------------------------------------------------

  setSite(site: SiteLike & { name: string }, places: readonly ScenePlace[]): void {
    const key = JSON.stringify([site, places.map((p) => [p.id, p.x, p.y, p.w, p.h, p.kind, p.model, p.rotation])]);
    if (key === this.siteKey) return;
    this.siteKey = key;
    this.site = site;
    this.tileM = tileMeters(site);
    this.terrain = buildTerrain(site, places);
    this.clearGroup(this.ground);
    this.clearGroup(this.placesGroup);
    for (const p of this.places.values()) p.label.remove();
    this.places.clear();
    this.buildGround(places);
    for (const p of places) this.addPlace(p);
    const m = this.terrain.margin * this.tileM;
    this.rig.viewHeight = Math.max(60, site.h * this.tileM * 0.75);
    this.rig.bounds.set(
      new THREE.Vector2(-m * 0.4, -m * 0.4),
      new THREE.Vector2(site.w * this.tileM + m * 0.4, site.h * this.tileM + m * 0.4),
    );
    this.framed = false;
    this.frameTown();
    this.invalidate();
  }

  /** Fit the built-up area (all place footprints). */
  frameTown(): void {
    if (!this.site) return;
    const ps = [...this.places.values()].map((p) => p.data);
    if (ps.length === 0) {
      this.rig.frame(0, 0, this.site.w * this.tileM, this.site.h * this.tileM);
    } else {
      const minX = Math.min(...ps.map((p) => p.x));
      const minY = Math.min(...ps.map((p) => p.y));
      const maxX = Math.max(...ps.map((p) => p.x + p.w));
      const maxY = Math.max(...ps.map((p) => p.y + p.h));
      const t = this.tileM;
      this.rig.frame((minX - 3) * t, (minY - 3) * t, (maxX + 3) * t, (maxY + 3) * t, 1.05);
    }
    this.framed = this.canvas.clientWidth > 0;
    this.invalidate();
  }

  private clearGroup(g: THREE.Group): void {
    for (const child of [...g.children]) {
      g.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh || (o as THREE.LineSegments).isLineSegments) {
          m.geometry?.dispose();
        }
      });
    }
    if (g === this.ground) this.treeMeshes = [];
  }

  private groundColor(zone: 0 | 1 | 2 | 3, h: number, x: number, y: number, slope: number): Swatch {
    const s = this.season;
    const grass: Swatch =
      s === 'winter' ? SW.snow : s === 'summer' ? SW.summerGrass : s === 'autumn' ? SW.autumnGrass : SW.springGrass;
    if (zone === 0) return h < -1 ? SW.river : SW.water;
    if (zone === 1) {
      if (h < -0.1) return SW.mud;
      // Early-April bottomland: last year's straw with green coming through.
      return mix(grass, SW.straw, s === 'spring' ? 0.25 + hash01(x, y, 5) * 0.5 : hash01(x, y, 5) * 0.3);
    }
    if (slope > 0.9) return mix(SW.sandstone, SW.dolomite, hash01(x, y, 9) * 0.3);
    if (zone === 2) return mix(SW.woodsFloor, s === 'winter' ? SW.snow : SW.straw, hash01(x, y, 6) * 0.35);
    return mix(SW.dolomite, s === 'winter' ? SW.snow : SW.straw, 0.35 + hash01(x, y, 4) * 0.3);
  }

  private buildGround(places: readonly ScenePlace[]): void {
    const t = this.terrain;
    const site = this.site;
    if (!t || !site) return;
    const tm = this.tileM;
    const m = t.margin;
    const cols = site.w + 2 * m;
    const rows = site.h + 2 * m;
    // Vertex grid at tile corners; two triangles per tile, flat-shaded (non-indexed).
    const hAt = (gx: number, gy: number) => t.heightAt(gx, gy);
    const pos: number[] = [];
    const colors: number[] = [];
    const c = new THREE.Color();
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x0 = i - m;
        const y0 = j - m;
        const corners = [
          [x0, y0],
          [x0 + 1, y0],
          [x0, y0 + 1],
          [x0 + 1, y0 + 1],
        ] as const;
        const hs = corners.map(([a, b]) => hAt(a, b));
        const tris = [
          [0, 2, 1],
          [1, 2, 3],
        ] as const;
        for (const tri of tris) {
          let hsum = 0;
          let hmin = Number.POSITIVE_INFINITY;
          let hmax = Number.NEGATIVE_INFINITY;
          for (const k of tri) {
            const [a, b] = corners[k] as readonly [number, number];
            const hh = hs[k] as number;
            pos.push(a * tm, hh, b * tm);
            hsum += hh;
            hmin = Math.min(hmin, hh);
            hmax = Math.max(hmax, hh);
          }
          const zone = t.zoneAt(x0 + 0.5, y0 + 0.5);
          const slope = (hmax - hmin) / tm;
          c.copy(col(this.groundColor(zone, hsum / 3, x0, y0, slope)));
          for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.name = 'terrain';
    this.ground.add(mesh);

    // Water surface: creek ribbon + river sheet, slightly below bank level.
    const water = new THREE.MeshLambertMaterial({ color: col(SW.water), transparent: true, opacity: 0.88 });
    const wpos: number[] = [];
    const wy = -0.45;
    for (let y = -m; y < site.h + m; y++) {
      if (t.riverFrom !== null && y >= t.riverFrom) break;
      const cy = Math.max(0, Math.min(site.h - 1, y));
      const xa = t.creekXAt(cy + 0.5);
      const xb = t.creekXAt(Math.max(0, Math.min(site.h - 1, y + 1)) + 0.5);
      const hw = t.creekHalf + 0.25;
      wpos.push(
        (xa - hw) * tm,
        wy,
        y * tm,
        (xb - hw) * tm,
        wy,
        (y + 1) * tm,
        (xa + hw) * tm,
        wy,
        y * tm,
        (xa + hw) * tm,
        wy,
        y * tm,
        (xb - hw) * tm,
        wy,
        (y + 1) * tm,
        (xb + hw) * tm,
        wy,
        (y + 1) * tm,
      );
    }
    if (t.riverFrom !== null) {
      const x0 = -m * tm;
      const x1 = (site.w + m) * tm;
      const z0 = t.riverFrom * tm;
      const z1 = (t.riverFrom + 12) * tm;
      wpos.push(x0, -0.7, z0, x0, -0.7, z1, x1, -0.7, z0, x1, -0.7, z0, x0, -0.7, z1, x1, -0.7, z1);
    }
    const wgeo = new THREE.BufferGeometry();
    wgeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
    wgeo.computeVertexNormals();
    this.ground.add(new THREE.Mesh(wgeo, water));

    // The ford: wherever a road crosses the creek, iron bars across the bed (01 §8.2).
    const ironMat = new THREE.MeshLambertMaterial({ color: col(SW.iron) });
    for (const p of places) {
      if (p.kind !== 'road') continue;
      for (let y = p.y; y < p.y + p.h; y++) {
        const cx = t.creekXAt(y + 0.5);
        if (cx < p.x - 0.3 || cx > p.x + p.w + 0.3) continue;
        for (let k = 0; k < 4; k++) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(t.creekHalf * 2.4 * tm, 0.12, 0.12), ironMat);
          bar.position.set(cx * tm, -0.3, (y + 0.2 + k * 0.2) * tm);
          this.ground.add(bar);
        }
      }
    }
    this.treeSpots = scatterTrees(t, places);
    this.buildTrees();
  }

  private buildTrees(): void {
    for (const m of this.treeMeshes) {
      this.ground.remove(m);
      m.geometry.dispose();
    }
    this.treeMeshes = [];
    const t = this.terrain;
    if (!t) return;
    const tm = this.tileM;
    const s = this.season;
    const leaf = (kind: 'oak' | 'maple'): Swatch => {
      if (s === 'winter') return SW.bare;
      if (kind === 'oak') return s === 'summer' ? SW.oakSummer : s === 'autumn' ? SW.oakAutumn : SW.oakSpring;
      return s === 'summer' ? SW.mapleSummer : s === 'autumn' ? SW.mapleAutumn : SW.mapleSpring;
    };
    const kinds = [
      { kind: 'pine' as const, geo: new THREE.ConeGeometry(2.2, 9, 6), y: 6.2, color: SW.pine },
      { kind: 'oak' as const, geo: new THREE.IcosahedronGeometry(3.4, 0), y: 6.4, color: leaf('oak') },
      { kind: 'maple' as const, geo: new THREE.DodecahedronGeometry(2.9, 0), y: 6.0, color: leaf('maple') },
    ];
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 3.2, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: col(SW.trunk) });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, this.treeSpots.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    let ti = 0;
    for (const k of kinds) {
      const spots = this.treeSpots.filter((sp) => sp.kind === k.kind);
      const mesh = new THREE.InstancedMesh(k.geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), spots.length);
      const c = new THREE.Color();
      spots.forEach((sp, i) => {
        const gh = t.heightAt(sp.x, sp.y);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(Math.floor(sp.x * 7), Math.floor(sp.y * 7), 31) * 6.28);
        sc.setScalar(sp.scale);
        m4.compose(v.set(sp.x * tm, gh + k.y * sp.scale, sp.y * tm), q, sc);
        mesh.setMatrixAt(i, m4);
        c.copy(col(mix(k.color, SW.ink, hash01(Math.floor(sp.x * 3), Math.floor(sp.y * 3), 37) * 0.18)));
        mesh.setColorAt(i, c);
        m4.compose(v.set(sp.x * tm, gh + 1.6 * sp.scale, sp.y * tm), q, sc);
        trunks.setMatrixAt(ti++, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.ground.add(mesh);
      this.treeMeshes.push(mesh);
    }
    trunks.count = ti;
    trunks.instanceMatrix.needsUpdate = true;
    this.ground.add(trunks);
    this.treeMeshes.push(trunks);
  }

  private addPlace(p: ScenePlace): void {
    const tm = this.tileM;
    const root = new THREE.Group();
    root.position.set((p.x + p.w / 2) * tm, 0, (p.y + p.h / 2) * tm);
    root.rotation.y = THREE.MathUtils.degToRad(-p.rotation);
    const fw = p.w * tm;
    const fd = p.h * tm;
    // Lot / surface patch under every place.
    const patchColor: Swatch =
      p.kind === 'road'
        ? SW.road
        : p.kind === 'landing'
          ? SW.board
          : p.kind === 'field'
            ? SW.mud
            : mix(SW.straw, SW.road, 0.35);
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(fw, fd),
      new THREE.MeshLambertMaterial({ color: col(patchColor), polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.y = p.kind === 'landing' ? 0.25 : 0.04;
    root.add(patch);
    const placeholder = this.placeholderFor(p, fw, fd);
    if (placeholder) root.add(placeholder);
    if (p.kind === 'yard' || p.kind === 'field' || p.kind === 'farmstead') root.add(this.fence(fw, fd));

    // Selection outline (hidden until selected).
    const outlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(fw + 0.6, 0.05, fd + 0.6));
    const outline = new THREE.LineSegments(outlineGeo, new THREE.LineBasicMaterial({ color: col(SW.rubric) }));
    outline.position.y = 0.3;
    outline.visible = false;
    root.add(outline);
    this.placesGroup.add(root);

    const label = document.createElement('div');
    label.className = `lbl lbl-place lbl-${p.kind}`;
    label.textContent = p.name;
    this.labels.appendChild(label);
    this.places.set(p.id, { root, label, data: p, outline });

    if (p.model && placeholder) {
      const modelId = p.model;
      loadModel(modelId).then((src) => {
        if (!src || this.disposed || this.places.get(p.id)?.root !== root) return;
        const obj = src.clone(true);
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const ratio = Math.max(size.x / fw, size.z / fd);
        let s = 1;
        if (ratio > 0.98) s = 0.95 / ratio;
        else if (ratio < 0.4 && ratio > 0) s = 0.45 / ratio;
        obj.scale.multiplyScalar(s);
        root.remove(placeholder);
        root.add(obj);
        this.invalidate();
      });
    }
  }

  private fence(fw: number, fd: number): THREE.Object3D {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: col(SW.board) });
    const rail = (len: number, x: number, z: number, rotY: number) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.12), mat);
      r.position.set(x, 0.9, z);
      r.rotation.y = rotY;
      g.add(r);
    };
    rail(fw, 0, -fd / 2, 0);
    rail(fw, 0, fd / 2, 0);
    rail(fd, -fw / 2, 0, Math.PI / 2);
    rail(fd, fw / 2, 0, Math.PI / 2);
    return g;
  }

  /** Procedural stand-ins by kind and tags, sized from the footprint. */
  private placeholderFor(p: ScenePlace, fw: number, fd: number): THREE.Object3D | null {
    const tags = new Set(p.tags);
    const g = new THREE.Group();
    if (p.kind === 'road' || p.kind === 'outdoor' || p.kind === 'wild' || p.kind === 'field' || p.kind === 'yard') {
      return null;
    }
    if (p.kind === 'landing') {
      // Plank deck + the ferry flat.
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(fw * 0.7, 0.3, fd * 0.5),
        new THREE.MeshLambertMaterial({ color: col(SW.board) }),
      );
      deck.position.set(0, 0.3, fd * 0.1);
      const flat = new THREE.Mesh(
        new THREE.BoxGeometry(fw * 0.45, 0.5, fd * 0.3),
        new THREE.MeshLambertMaterial({ color: col(SW.log) }),
      );
      flat.position.set(0, 0.1, fd * 0.55);
      g.add(deck, flat);
      return g;
    }
    let wall: Swatch = SW.board;
    let roof: Swatch = SW.shingle;
    let height = 4;
    let fill = 0.82;
    if (tags.has('church')) {
      wall = SW.whitewash;
      height = 6;
    } else if (tags.has('mill')) {
      wall = SW.barnRed;
      height = 7;
    } else if (tags.has('smithy')) {
      wall = SW.sootBoard;
      height = 3.6;
    } else if (tags.has('store') || tags.has('outfitter')) {
      wall = SW.whitewash;
      height = 5.5;
    } else if (tags.has('tavern')) {
      wall = SW.board;
      height = 5.5;
    } else if (p.kind === 'house' || p.kind === 'farmstead') {
      wall = SW.log;
      height = 3.2;
      fill = 0.6;
    }
    const bw = fw * fill;
    const bd = fd * fill;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, height, bd), new THREE.MeshLambertMaterial({ color: col(wall) }));
    body.position.y = height / 2;
    g.add(body);
    const roofMesh = new THREE.Mesh(gable(bw * 1.08, bd * 1.1, Math.min(bw, bd) * 0.42), new THREE.MeshLambertMaterial({ color: col(roof) }));
    roofMesh.position.y = height;
    // Ridge runs along the longer side.
    if (bd > bw) roofMesh.rotation.y = Math.PI / 2;
    g.add(roofMesh);
    if (tags.has('store') || tags.has('outfitter')) {
      // False front facing the street.
      const front = new THREE.Mesh(
        new THREE.BoxGeometry(bw * 1.02, height * 1.45, 0.3),
        new THREE.MeshLambertMaterial({ color: col(SW.whitewash) }),
      );
      front.position.set(0, (height * 1.45) / 2, bd / 2 + 0.1);
      g.add(front);
    }
    if (tags.has('church')) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(2.2, height + 5, 2.2), new THREE.MeshLambertMaterial({ color: col(SW.whitewash) }));
      tower.position.set(0, (height + 5) / 2, bd / 2 - 1.1);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 6, 4), new THREE.MeshLambertMaterial({ color: col(SW.shingle) }));
      spire.position.set(0, height + 5 + 3, bd / 2 - 1.1);
      spire.rotation.y = Math.PI / 4;
      g.add(tower, spire);
    }
    if (tags.has('smithy') || p.kind === 'house' || tags.has('tavern')) {
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 0.8), new THREE.MeshLambertMaterial({ color: col(SW.fieldstone) }));
      chimney.position.set(bw * 0.3, height + 1, 0);
      g.add(chimney);
    }
    if (tags.has('mill')) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1, 12), new THREE.MeshLambertMaterial({ color: col(SW.log) }));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(-bw / 2 - 0.6, 2.2, 0);
      g.add(wheel);
    }
    return g;
  }

  // -------------------------------------------------------------------------------------
  // Actors
  // -------------------------------------------------------------------------------------

  setActors(list: readonly SceneActor[], t: number, msPerGameMinute: number): void {
    this.msPerGameMinute = msPerGameMinute;
    this.lastT = t;
    const live = new Set<number>();
    for (const a of list) {
      if (!a.alive) continue;
      live.add(a.id);
      let g = this.actors.get(a.id);
      if (!g) {
        g = this.makeActor(a);
        this.actors.set(a.id, g);
      }
      g.data = a;
      g.label.textContent = a.label;
      g.label.classList.toggle('is-player', a.isPlayer);
    }
    for (const [id, g] of this.actors) {
      if (!live.has(id)) {
        this.actorsGroup.remove(g.root);
        g.label.remove();
        this.actors.delete(id);
      }
    }
    const places = [...this.places.values()].map((p) => p.data);
    this.motion.update(
      list.filter((a) => a.alive),
      places,
      { nowMs: performance.now(), msPerGameMinute, tileM: this.tileM, t },
    );
    this.invalidate();
  }

  private makeActor(a: SceneActor): ActorGfx {
    const root = new THREE.Group();
    const body = new THREE.Group();
    const cloth = this.mats.cloth[Math.floor(hash01(a.id, 1, 41) * this.mats.cloth.length)] ?? this.mats.ink;
    const coat = new THREE.Mesh(this.geo.body, cloth);
    coat.position.y = 0.55;
    const coatInk = new THREE.Mesh(this.geo.body, this.mats.ink);
    coatInk.position.y = 0.55;
    coatInk.scale.setScalar(1.14);
    const head = new THREE.Mesh(this.geo.head, this.mats.skin);
    head.position.y = 1.25;
    const headInk = new THREE.Mesh(this.geo.head, this.mats.ink);
    headInk.position.y = 1.25;
    headInk.scale.setScalar(1.18);
    const brim = new THREE.Mesh(this.geo.brim, this.mats.hat);
    brim.position.y = 1.38;
    const crown = new THREE.Mesh(this.geo.crown, this.mats.hat);
    crown.position.y = 1.48;
    body.add(coatInk, coat, headInk, head, brim);
    if (hash01(a.id, 2, 43) < 0.6) body.add(crown);
    if (a.child) body.scale.setScalar(0.72);
    const blob = new THREE.Mesh(this.geo.blob, this.mats.blob);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.06;
    const ring = new THREE.Mesh(this.geo.ring, this.mats.ringPlayer);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    ring.visible = false;
    root.add(blob, ring, body);
    this.actorsGroup.add(root);
    const label = document.createElement('div');
    label.className = 'lbl lbl-actor';
    this.labels.appendChild(label);
    return { root, body, ring, label, data: a };
  }

  setSelection(actorId: number | null, placeId: number | null): void {
    this.selectedActor = actorId;
    this.selectedPlace = placeId;
    for (const [id, p] of this.places) p.outline.visible = id === placeId;
    this.invalidate();
  }

  focusActor(id: number): void {
    const s = this.motion.sample(id, performance.now());
    if (!s) return;
    this.rig.target.set(s.p.x * this.tileM, 0, s.p.y * this.tileM);
    if (this.rig.zoom < 2.2) this.rig.zoom = 2.2;
    this.rig.clampTarget();
    this.rig.apply();
    this.invalidate();
  }

  focusPlace(id: number): void {
    const p = this.places.get(id);
    if (!p) return;
    const d = p.data;
    this.rig.target.set((d.x + d.w / 2) * this.tileM, 0, (d.y + d.h / 2) * this.tileM);
    if (this.rig.zoom < 1.8) this.rig.zoom = 1.8;
    this.rig.clampTarget();
    this.rig.apply();
    this.invalidate();
  }

  zoomBy(f: number): void {
    const r = this.canvas.getBoundingClientRect();
    this.rig.zoomAbout(f, r.width / 2, r.height / 2);
    this.invalidate();
  }

  setTilt(t: TiltPreset): void {
    this.rig.tilt = t;
    this.rig.apply();
    this.invalidate();
  }

  get tilt(): TiltPreset {
    return this.rig.tilt;
  }

  // -------------------------------------------------------------------------------------
  // Time of day + season
  // -------------------------------------------------------------------------------------

  setTime(time: SceneTime): void {
    if (time.season !== this.season) {
      this.season = time.season;
      if (this.site && this.terrain) {
        const places = [...this.places.values()].map((p) => p.data);
        this.clearGroup(this.ground);
        this.buildGround(places);
      }
    }
    const m = time.hour * 60 + time.minute;
    const span = Math.max(1, time.sunsetMinute - time.sunriseMinute);
    const f = (m - time.sunriseMinute) / span;
    const daylight = f > 0 && f < 1;
    const el = daylight ? Math.sin(Math.PI * f) : 0;
    const az = Math.PI * (1 - f); // east at sunrise -> west at sunset, via the south.
    const R = 300;
    const cx = this.site ? (this.site.w * this.tileM) / 2 : 0;
    const cz = this.site ? (this.site.h * this.tileM) / 2 : 0;
    this.sun.position.set(cx + Math.cos(az) * R, 40 + el * R, cz + Math.sin(az) * R * 0.6);
    this.sun.target.position.set(cx, 0, cz);
    const warm = new THREE.Color(0xffc48a);
    const noon = new THREE.Color(0xfff4e2);
    this.sun.color.copy(warm).lerp(noon, Math.min(1, el * 1.6));
    this.sun.intensity = daylight ? 0.4 + 1.6 * el : 0;
    // Night: blue-ink grade held above a brightness floor (11 §7.4).
    const night = new THREE.Color(0x6f7ea0);
    const day = new THREE.Color(0xf3ebdc);
    const k = daylight ? Math.min(1, 0.35 + el * 1.2) : 0;
    this.hemi.color.copy(night).lerp(day, k);
    this.hemi.intensity = 0.85 + 0.9 * k;
    (this.scene.background as THREE.Color).set(0x2a2f3c).lerp(new THREE.Color(0xd9ccb3), k);
    this.invalidate();
  }

  // -------------------------------------------------------------------------------------
  // Picking, labels, render loop
  // -------------------------------------------------------------------------------------

  private pick(px: number, py: number): PickHit {
    const now = performance.now();
    let best: { id: number; d: number } | null = null;
    const v = new THREE.Vector3();
    const sp = new THREE.Vector2();
    for (const [id, g] of this.actors) {
      const s = this.motion.sample(id, now);
      if (!s) continue;
      v.set(s.p.x * this.tileM, g.body.scale.y * 0.8 * g.root.scale.y, s.p.y * this.tileM);
      this.rig.toScreen(v, sp);
      const d = Math.hypot(sp.x - px, sp.y - py);
      // 44 px hit area at least (11 §2.2 hit slop).
      if (d < 26 && (!best || d < best.d || (d === best.d && id < best.id))) best = { id, d };
    }
    if (best) return { kind: 'actor', id: best.id };
    const g = this.rig.groundAt(px, py);
    if (!g) return null;
    const tx = g.x / this.tileM;
    const ty = g.z / this.tileM;
    let hit: ScenePlace | null = null;
    for (const p of this.places.values()) {
      const d = p.data;
      if (tx >= d.x && tx < d.x + d.w && ty >= d.y && ty < d.y + d.h) {
        // Prefer buildings over roads; then the smaller footprint.
        const score = (d.kind === 'road' ? 1e6 : 0) + d.w * d.h;
        const cur = hit ? (hit.kind === 'road' ? 1e6 : 0) + hit.w * hit.h : Number.POSITIVE_INFINITY;
        if (score < cur || (score === cur && hit && d.id < hit.id)) hit = d;
      }
    }
    return hit ? { kind: 'place', id: hit.id } : null;
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const walking = this.motion.anyWalking(now);
    if (!this.dirty && !walking) return;
    this.dirty = false;
    this.drawFrame(now);
  };

  private drawFrame(now: number): void {
    const ppm = this.rig.pxPerMeter();
    // Legibility (11 §7.5): figures stay ≥ ~22 px tall however far out we zoom.
    const legible = THREE.MathUtils.clamp(22 / (FIGURE_H * ppm), 1, 4.5);
    const v = new THREE.Vector3();
    const sp = new THREE.Vector2();
    const placed: Array<{ el: HTMLDivElement; x: number; y: number; pri: number }> = [];
    for (const [id, g] of this.actors) {
      const s = this.motion.sample(id, now);
      if (!s) continue;
      const gh = this.terrain ? Math.max(0, this.terrain.heightAt(s.p.x, s.p.y)) : 0;
      g.root.position.set(s.p.x * this.tileM, gh, s.p.y * this.tileM);
      g.root.scale.setScalar(legible);
      g.body.rotation.y = -s.heading + Math.PI / 2;
      // A little bob while walking.
      g.body.position.y = s.walking ? Math.abs(Math.sin(now / 110)) * 0.06 : 0;
      const sel = id === this.selectedActor;
      g.ring.visible = sel || g.data.isPlayer;
      g.ring.material = sel ? this.mats.ringSel : this.mats.ringPlayer;
      g.ring.scale.setScalar(sel ? 1.25 : 1);
      v.set(g.root.position.x, gh + FIGURE_H * legible * (g.data.child ? 0.8 : 1) + 0.2, g.root.position.z);
      this.rig.toScreen(v, sp);
      placed.push({ el: g.label, x: sp.x, y: sp.y, pri: sel ? 0 : g.data.isPlayer ? 1 : 3 });
      g.label.classList.toggle('is-selected', sel);
    }
    for (const [id, p] of this.places) {
      const d = p.data;
      const lift = d.kind === 'road' ? 0.5 : 4;
      v.set((d.x + d.w / 2) * this.tileM, lift, (d.y + d.h / 2) * this.tileM);
      this.rig.toScreen(v, sp);
      const sel = id === this.selectedPlace;
      placed.push({ el: p.label, x: sp.x, y: sp.y, pri: sel ? 0 : d.kind === 'road' ? 5 : 4 });
      p.label.classList.toggle('is-selected', sel);
    }
    this.layoutLabels(placed, ppm);
    this.renderer.render(this.scene, this.rig.camera);
  }

  /** Declutter by priority (11 §2.2): selected, then the PC, then names, then places. */
  private layoutLabels(items: Array<{ el: HTMLDivElement; x: number; y: number; pri: number }>, ppm: number): void {
    const taken: Array<[number, number, number, number]> = [];
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    items.sort((a, b) => a.pri - b.pri || a.y - b.y || a.x - b.x);
    for (const it of items) {
      const isActor = it.el.classList.contains('lbl-actor');
      // Far out, only the PC, the selection, and buildings get names.
      if (isActor && it.pri > 1 && ppm < 2.2) {
        it.el.style.display = 'none';
        continue;
      }
      const lw = Math.max(24, it.el.textContent?.length ?? 4) * (isActor ? 6.4 : 6.8) + 10;
      const lh = 20;
      const x0 = it.x - lw / 2;
      const y0 = it.y - lh;
      const off = it.x < -40 || it.x > w + 40 || it.y < -20 || it.y > h + 40;
      const overlaps = taken.some(([a, b, c, d]) => x0 < c && x0 + lw > a && y0 < d && y0 + lh > b);
      if (off || (overlaps && it.pri > 1)) {
        it.el.style.display = 'none';
        continue;
      }
      taken.push([x0, y0, x0 + lw, y0 + lh]);
      it.el.style.display = '';
      it.el.style.transform = `translate(${Math.round(it.x)}px, ${Math.round(it.y)}px) translate(-50%, -100%)`;
    }
  }

  /** Game minute of the last snapshot (for tests/debug overlays). */
  get snapshotT(): number {
    return this.lastT;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.detach();
    this.ro.disconnect();
    this.clearGroup(this.ground);
    this.clearGroup(this.placesGroup);
    this.renderer.dispose();
    this.canvas.remove();
    this.labels.remove();
  }
}

/** Triangular-prism gable roof: ridge along x, eaves at y = 0. */
function gable(w: number, d: number, h: number): THREE.BufferGeometry {
  const x = w / 2;
  const z = d / 2;
  // biome-ignore format: vertex table
  const p = [
    -x, 0, -z,  x, 0, -z,  x, h, 0,   -x, 0, -z,  x, h, 0,  -x, h, 0, // north slope
    -x, 0, z,  -x, h, 0,   x, h, 0,   -x, 0, z,   x, h, 0,   x, 0, z, // south slope
    -x, 0, -z, -x, h, 0,  -x, 0, z, // west gable
     x, 0, -z,  x, 0, z,   x, h, 0, // east gable
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}
