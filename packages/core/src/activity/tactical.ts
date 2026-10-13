/** Activity owns authoritative grid positions and routine suspension. */
import type { ActorId, PlaceId } from '../ids.ts';
import type { Cell, Position } from '../tactical/state.ts';
import type { World } from '../world.ts';
export function tacticalPosition(w: World, id: ActorId): Position | undefined {
  return w.activity.tacticalPositions?.[id];
}
export function tacticalPinned(w: World, id: ActorId): boolean {
  return (
    (!!w.tactical?.active && !!w.tactical.participants[id]) ||
    (w.tactical?.frame?.phase === 'settling' && w.tactical.frame.live.includes(id))
  );
}
export function installTacticalPositions(w: World, placeId: PlaceId, ids: ActorId[], cells: Cell[]): void {
  const p = w.places[placeId];
  if (!p || cells.length < ids.length) throw new Error('Insufficient walkable scene cells');
  w.activity.tacticalPositions ??= {};
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i] as ActorId,
      cell = cells[i] as Cell;
    w.activity.tacticalPositions[id] = { ...cell, site: p.siteId, level: 0 };
    const a = w.activity.byActor[id];
    if (a) {
      a.activityId = 'idle_at_home';
      a.travel = null;
    }
  }
}
export function moveTactical(w: World, id: ActorId, cell: Cell): void {
  const pos = tacticalPosition(w, id);
  if (pos) {
    pos.x = cell.x;
    pos.y = cell.y;
  }
}
