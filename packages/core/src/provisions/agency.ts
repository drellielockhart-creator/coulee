/** Provisions' view of actor agency: delegates to psyche's canonical policy (00 decisions log 2026-10-11). */
import type { ActorId } from '../ids.ts';
import { authorizeAct } from '../psyche/api.ts';
import type { World } from '../world.ts';

export function autonomousProvisioning(world: World, id: ActorId): boolean {
  return authorizeAct(world, id, { kind: 'consequential' }, { kind: 'own' }).ok;
}
