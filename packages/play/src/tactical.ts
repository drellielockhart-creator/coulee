import { type ActorId, type Sim, TICKS_PER_SECOND, tactical } from '@coulee/core';
import type { AvailableAction } from './actions.ts';
export function tacticalActions(sim: Sim, pc: ActorId): AvailableAction[] {
  const out: AvailableAction[] = [];
  for (const verb of ['guard', 'cancel', 'breathe'] as const) {
    const command = { kind: `tactical.${verb}` as const, actorId: pc, data: {} };
    if (!tactical.tacticalCommandCheck(sim.world, sim.content, command))
      out.push({
        id: `tactical:${verb}`,
        label: verb === 'breathe' ? 'Breathe and return to ordinary time' : verb,
        command,
      });
  }
  out.push({
    id: 'tactical:resume',
    label: 'Resume for up to six seconds',
    command: { kind: 'tactical.advance', actorId: pc, data: { ticks: 6 * TICKS_PER_SECOND } },
  });
  const pos = tactical.tacticalPosition(sim.world, pc);
  if (pos)
    for (const [dx, dy, label] of [
      [0, -1, 'north'],
      [-1, 0, 'west'],
      [1, 0, 'east'],
      [0, 1, 'south'],
    ] as const) {
      const command = { kind: 'tactical.move' as const, actorId: pc, data: { x: pos.x + dx, y: pos.y + dy } };
      if (!tactical.tacticalCommandCheck(sim.world, sim.content, command))
        out.push({ id: `tactical:move:${label}`, label: `Step ${label}`, command });
    }
  return out;
}
