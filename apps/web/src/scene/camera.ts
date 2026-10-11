/**
 * Orthographic site camera + touch/mouse gestures (11 §2.2). OWNER: module:web.
 *
 * - One-finger / left-mouse drag: pan ("grab the ground": the point under the finger stays put).
 * - Pinch / mouse wheel: zoom about the fingers / cursor.
 * - Tap: select (never moves the PC). Double-tap: zoom in about the point.
 * - Two tilt presets (survey 52°, plan 78°), no free tilt.
 */
import * as THREE from 'three';

export const TILT_PRESETS = { survey: 52, plan: 78 } as const;
export type TiltPreset = keyof typeof TILT_PRESETS;

export class CameraRig {
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 3000);
  /** Ground point the camera looks at (meters, y = 0). */
  readonly target = new THREE.Vector3();
  zoom = 1;
  minZoom = 0.6;
  maxZoom = 9;
  tilt: TiltPreset = 'survey';
  /** World meters visible vertically at zoom 1 (set from the site). */
  viewHeight = 120;
  /** Pan bounds (meters). */
  bounds = new THREE.Box2(new THREE.Vector2(-50, -50), new THREE.Vector2(250, 250));
  private width = 1;
  private height = 1;
  private readonly ray = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  resize(w: number, h: number): void {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.apply();
  }

  /** Screen pixels per world meter at the current zoom (for legibility scaling). */
  pxPerMeter(): number {
    return (this.height * this.zoom) / this.viewHeight;
  }

  apply(): void {
    const aspect = this.width / this.height;
    const halfH = this.viewHeight / 2;
    const c = this.camera;
    c.left = -halfH * aspect;
    c.right = halfH * aspect;
    c.top = halfH;
    c.bottom = -halfH;
    c.zoom = this.zoom;
    const el = THREE.MathUtils.degToRad(TILT_PRESETS[this.tilt]);
    const dist = 800;
    // North (−z) is up the screen: the camera sits south of the target, looking north and down.
    c.position.set(this.target.x, this.target.y + Math.sin(el) * dist, this.target.z + Math.cos(el) * dist);
    c.up.set(0, 1, 0);
    c.lookAt(this.target);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }

  /** The ground point under a canvas pixel. */
  groundAt(px: number, py: number, out = new THREE.Vector3()): THREE.Vector3 | null {
    const ndc = new THREE.Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    return this.ray.ray.intersectPlane(this.plane, out);
  }

  /** Project a world point to canvas pixels. */
  toScreen(p: THREE.Vector3, out = new THREE.Vector2()): THREE.Vector2 {
    const v = p.clone().project(this.camera);
    return out.set(((v.x + 1) / 2) * this.width, ((1 - v.y) / 2) * this.height);
  }

  clampTarget(): void {
    this.target.x = THREE.MathUtils.clamp(this.target.x, this.bounds.min.x, this.bounds.max.x);
    this.target.z = THREE.MathUtils.clamp(this.target.z, this.bounds.min.y, this.bounds.max.y);
  }

  /** Zoom by `factor`, keeping the ground point under (px, py) fixed. */
  zoomAbout(factor: number, px: number, py: number): void {
    const before = this.groundAt(px, py);
    this.zoom = THREE.MathUtils.clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    this.apply();
    const after = this.groundAt(px, py);
    if (before && after) {
      this.target.x += before.x - after.x;
      this.target.z += before.z - after.z;
    }
    this.clampTarget();
    this.apply();
  }

  /** Fit a ground rectangle (meters) into view. */
  frame(minX: number, minZ: number, maxX: number, maxZ: number, pad = 1.15): void {
    this.target.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    const aspect = this.width / this.height;
    const el = THREE.MathUtils.degToRad(TILT_PRESETS[this.tilt]);
    // Depth is foreshortened by the tilt on screen.
    const needH = (maxZ - minZ) * Math.sin(el) * pad;
    const needW = ((maxX - minX) * pad) / aspect;
    this.zoom = THREE.MathUtils.clamp(this.viewHeight / Math.max(needH, needW, 1), this.minZoom, this.maxZoom);
    this.clampTarget();
    this.apply();
  }
}

export interface GestureCallbacks {
  onChange: () => void;
  onTap: (px: number, py: number) => void;
}

/** Attach pointer + wheel gestures to `el`. Returns a detach function. */
export function attachGestures(el: HTMLElement, rig: CameraRig, cb: GestureCallbacks): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt = { x: 0, y: 0, t: 0 };
  let moved = false;
  let lastTap = { x: -999, y: -999, t: 0 };
  let pinchStart: { d: number; zoom: number } | null = null;

  const local = (e: PointerEvent | WheelEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const mid = () => {
    const ps = [...pointers.values()];
    const a = ps[0] ?? { x: 0, y: 0 };
    const b = ps[1] ?? a;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  const down = (e: PointerEvent) => {
    el.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      downAt = { ...p, t: performance.now() };
      moved = false;
    } else if (pointers.size === 2) {
      const m = mid();
      pinchStart = { d: Math.max(1, m.d), zoom: rig.zoom };
      moved = true;
    }
  };
  const move = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    if (pointers.size === 1) {
      if (!moved && Math.hypot(p.x - downAt.x, p.y - downAt.y) < 7) return;
      moved = true;
      const a = rig.groundAt(prev.x, prev.y);
      const b = rig.groundAt(p.x, p.y);
      pointers.set(e.pointerId, p);
      if (a && b) {
        rig.target.x += a.x - b.x;
        rig.target.z += a.z - b.z;
        rig.clampTarget();
        rig.apply();
        cb.onChange();
      }
      return;
    }
    const before = mid();
    pointers.set(e.pointerId, p);
    const after = mid();
    // Pan by the midpoint's motion, then zoom about it.
    const a = rig.groundAt(before.x, before.y);
    const b = rig.groundAt(after.x, after.y);
    if (a && b) {
      rig.target.x += a.x - b.x;
      rig.target.z += a.z - b.z;
    }
    if (pinchStart) {
      const want = THREE.MathUtils.clamp((pinchStart.zoom * after.d) / pinchStart.d, rig.minZoom, rig.maxZoom);
      rig.apply();
      rig.zoomAbout(want / rig.zoom, after.x, after.y);
    } else {
      rig.clampTarget();
      rig.apply();
    }
    cb.onChange();
  };
  const up = (e: PointerEvent) => {
    const had = pointers.has(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (!had || pointers.size > 0) return;
    if (moved) return;
    const p = local(e);
    const now = performance.now();
    if (now - downAt.t > 450) return;
    if (now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
      rig.zoomAbout(1.8, p.x, p.y);
      cb.onChange();
      lastTap = { x: -999, y: -999, t: 0 };
      return;
    }
    lastTap = { ...p, t: now };
    cb.onTap(p.x, p.y);
  };
  const cancel = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = local(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    rig.zoomAbout(Math.exp(-delta * 0.0016), p.x, p.y);
    cb.onChange();
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('wheel', wheel, { passive: false });
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
    el.removeEventListener('wheel', wheel);
  };
}
