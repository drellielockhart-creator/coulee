import { tacticalPosition } from '../activity/api.ts';
import type { ContentBundle } from '../content.ts';
import { type ActorId, idsOf } from '../ids.ts';
import type { World } from '../world.ts';
import type { Cell } from './state.ts';
export const cellKey = (p: Cell): string => `${p.x},${p.y}`;
/** Slice 1 uses the authored place's interior footprint as its walkable site grid. */
export function sceneCells(w: World, content: ContentBundle, placeId: number): Cell[] {
  const p = w.places[placeId];
  if (!p) return [];
  const cells: Cell[] = [];
  const scale = Math.max(1, Math.floor((content.sites[p.siteId]?.tile_ft ?? 10) / 5));
  for (let y = p.y * scale; y < (p.y + p.h) * scale; y++)
    for (let x = p.x * scale; x < (p.x + p.w) * scale; x++) cells.push({ x, y });
  return cells;
}
export function movementCheck(w: World, c: ContentBundle, id: ActorId, to: Cell): string | null {
  const s = w.tactical,
    from = tacticalPosition(w, id);
  if (!s?.active || !from) return 'No active tactical scene';
  if (!Number.isSafeInteger(to.x) || !Number.isSafeInteger(to.y)) return 'Use integer grid cells';
  if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) !== 1)
    return 'Move one orthogonal cell; walls and corners cannot be crossed';
  if (!sceneCells(w, c, s.placeId).some((p) => p.x === to.x && p.y === to.y))
    return 'That cell is outside the walkable scene';
  for (const other of idsOf<ActorId>(s.participants)) {
    const pos = tacticalPosition(w, other);
    if (other !== id && pos?.x === to.x && pos.y === to.y) return 'That cell is occupied';
  }
  if (s.reservations[cellKey(to)]) return 'That cell is reserved';
  return null;
}
