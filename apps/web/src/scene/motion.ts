/**
 * Actor motion between snapshots (11 §1.7: "the renderer interpolates"). OWNER: module:web.
 *
 * Snapshots arrive once per game-hour with each actor's place. When an actor's place changes,
 * the tracker starts a walk along the road from where the figure is drawn now to its new
 * standing spot, timed at a walking pace scaled to the current game speed. Pure (no three.js):
 * the clock is passed in.
 */
import { type Pt, pathLength, pointAlong, routeBetween, standingSpot } from './paths.ts';
import type { PlaceLike } from './terrain.ts';

export interface ActorPlacement {
  id: number;
  placeId: number;
  /** In-progress travel reported by the activity view (multi-hour trips). */
  travelingTo: number | null;
  arriveAt: number | null;
  since: number;
}

interface Track {
  placeId: number;
  spot: Pt;
  path: Pt[] | null;
  startMs: number;
  durMs: number;
  /** Last heading (radians, in the tile plane: 0 = +x/east). */
  heading: number;
}

/** Ambling pace through town, meters per game-minute (~2.6 mph). */
export const WALK_M_PER_MIN = 70;

export interface MotionClock {
  nowMs: number;
  /** Real milliseconds per game-minute at the current speed (paused -> the 1× pace). */
  msPerGameMinute: number;
  /** Meters per tile. */
  tileM: number;
  /** Game minute of the snapshot. */
  t: number;
}

export class MotionTracker {
  private tracks = new Map<number, Track>();

  /** Feed a new snapshot. Returns true if any walk started. */
  update(actors: readonly ActorPlacement[], places: readonly PlaceLike[], clock: MotionClock): boolean {
    const byId = new Map(places.map((p) => [p.id, p]));
    const roads = places.filter((p) => p.kind === 'road');
    // Standing slots: occupants of each place in ascending id order.
    const atPlace = new Map<number, number[]>();
    for (const a of [...actors].sort((x, y) => x.id - y.id)) {
      const list = atPlace.get(a.placeId) ?? [];
      list.push(a.id);
      atPlace.set(a.placeId, list);
    }
    let started = false;
    const seen = new Set<number>();
    for (const a of actors) {
      seen.add(a.id);
      const place = byId.get(a.placeId);
      if (!place) continue;
      const occupants = atPlace.get(a.placeId) ?? [a.id];
      let spot = standingSpot(place, occupants.indexOf(a.id), occupants.length, roads);
      // Multi-hour travel: stand at the fraction of the route the sim says we've covered.
      if (a.travelingTo !== null && a.arriveAt !== null && a.arriveAt > a.since) {
        const dest = byId.get(a.travelingTo);
        if (dest) {
          const route = routeBetween(place, dest, places);
          const f = Math.max(0, Math.min(1, (clock.t - a.since) / (a.arriveAt - a.since)));
          spot = pointAlong(route, f);
        }
      }
      const prev = this.tracks.get(a.id);
      if (!prev) {
        this.tracks.set(a.id, { placeId: a.placeId, spot, path: null, startMs: clock.nowMs, durMs: 0, heading: 0 });
        continue;
      }
      const from = this.positionOf(prev, clock.nowMs);
      // View-only refreshes must not restart an already-running walk.
      const moved = Math.hypot(prev.spot.x - spot.x, prev.spot.y - spot.y) > 0.05;
      if (!moved) {
        prev.placeId = a.placeId;
        prev.spot = spot;
        continue;
      }
      let path: Pt[];
      const prevPlace = byId.get(prev.placeId);
      if (prev.placeId !== a.placeId && prevPlace) {
        const route = routeBetween(prevPlace, place, places);
        path = [from, ...route.slice(1, -1), spot];
      } else {
        path = [from, spot];
      }
      const meters = pathLength(path) * clock.tileM;
      const gameMin = meters / WALK_M_PER_MIN;
      const durMs = clock.msPerGameMinute <= 0 ? 0 : Math.max(450, Math.min(6000, gameMin * clock.msPerGameMinute));
      this.tracks.set(a.id, {
        placeId: a.placeId,
        spot,
        path,
        startMs: clock.nowMs,
        durMs,
        heading: prev.heading,
      });
      started = true;
    }
    for (const id of [...this.tracks.keys()]) if (!seen.has(id)) this.tracks.delete(id);
    return started;
  }

  private positionOf(tr: Track, nowMs: number): Pt {
    if (!tr.path || tr.durMs <= 0) return tr.spot;
    const f = (nowMs - tr.startMs) / tr.durMs;
    if (f >= 1) return tr.spot;
    return pointAlong(tr.path, ease(Math.max(0, f)));
  }

  /** Drawn position, whether walking, and heading for an actor at real time `nowMs`. */
  sample(id: number, nowMs: number): { p: Pt; walking: boolean; heading: number } | null {
    const tr = this.tracks.get(id);
    if (!tr) return null;
    const walking = tr.path !== null && nowMs - tr.startMs < tr.durMs;
    const p = this.positionOf(tr, nowMs);
    if (walking && tr.path) {
      const ahead = pointAlong(tr.path, ease(Math.min(1, (nowMs - tr.startMs + 60) / tr.durMs)));
      if (Math.hypot(ahead.x - p.x, ahead.y - p.y) > 1e-4) tr.heading = Math.atan2(ahead.y - p.y, ahead.x - p.x);
    }
    return { p, walking, heading: tr.heading };
  }

  anyWalking(nowMs: number): boolean {
    for (const tr of this.tracks.values()) if (tr.path !== null && nowMs - tr.startMs < tr.durMs) return true;
    return false;
  }
}

/** Gentle ease-in-out so figures start and stop rather than teleport. */
function ease(f: number): number {
  return f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
}
