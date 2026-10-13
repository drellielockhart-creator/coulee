import type { ActorId } from '../ids.ts';
import type { World } from '../world.ts';
import { authorizeAct } from './agency.ts';
/** Slice 1 has no hostile executor: an independently acting mind can brace once at entry. */
export function tacticalReaction(w: World, id: ActorId): 'guard' | null {
  return authorizeAct(w, id, { kind: 'tactical.guard' }, { kind: 'own' }).ok ? 'guard' : null;
}
