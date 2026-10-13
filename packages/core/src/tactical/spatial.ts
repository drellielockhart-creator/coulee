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
    if (other !== id && !s.participants[other]?.fled && pos?.x === to.x && pos.y === to.y)
      return 'That cell is occupied';
  }
  if (s.reservations[cellKey(to)]) return 'That cell is reserved';
  return null;
}

/** Slice 2 authored door; offsets are five-foot cells from the interior's north-west corner. */
export function sceneExit(w: World, c: ContentBundle): (Cell & { placeId: import('../ids.ts').PlaceId }) | null {
  const s = w.tactical,
    def = c.scenarios[w.meta.scenarioId]?.tactical_scene?.exit;
  const first = s ? sceneCells(w, c, s.placeId)[0] : undefined;
  const placeId = def ? w.index.placeByDef[def.place] : undefined;
  if (!def || !first || !placeId || !s || w.places[placeId]?.siteId !== w.places[s.placeId]?.siteId) return null;
  return { x: first.x + def.x, y: first.y + def.y, placeId };
}
export function fleeStep(w: World, c: ContentBundle, id: ActorId): Cell | null {
  const start = tacticalPosition(w, id),
    exit = sceneExit(w, c),
    s = w.tactical;
  if (!start || !exit || !s) return null;
  if (start.x === exit.x && start.y === exit.y) return start;
  const cells = new Set(sceneCells(w, c, s.placeId).map(cellKey));
  const occupied = new Set(
    idsOf<ActorId>(s.participants)
      .filter((x) => x !== id && !s.participants[x]?.fled)
      .flatMap((x) => {
        const p = tacticalPosition(w, x);
        return p ? [cellKey(p)] : [];
      }),
  );
  for (const key of Object.keys(s.reservations).sort()) if (s.reservations[key]?.actorId !== id) occupied.add(key);
  const queue: Array<{ cell: Cell; first?: Cell }> = [{ cell: start }],
    seen = new Set([cellKey(start)]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (!current) continue;
    for (const [dx, dy] of [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
    ] as const) {
      const cell = { x: current.cell.x + dx, y: current.cell.y + dy },
        key = cellKey(cell);
      if (!cells.has(key) || seen.has(key) || occupied.has(key)) continue;
      const first = current.first ?? cell;
      if (cell.x === exit.x && cell.y === exit.y) return first;
      seen.add(key);
      queue.push({ cell, first });
    }
  }
  return null;
}
export function adjacent(w: World, a: ActorId, b: ActorId): boolean {
  const x = tacticalPosition(w, a),
    y = tacticalPosition(w, b);
  return (
    a !== b &&
    !!x &&
    !!y &&
    w.actors[a]?.placeId === w.actors[b]?.placeId &&
    Math.abs(x.x - y.x) + Math.abs(x.y - y.y) === 1
  );
}
