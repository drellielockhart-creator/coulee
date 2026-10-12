/** Integration seam for the agency wave. Read sheet policy through psyche's public API.
 * Until the agency field is present, existing actors retain their psyche-led behavior.
 */
import type { ActorId } from '../ids.ts';
import { psycheOf } from '../psyche/api.ts';
import type { World } from '../world.ts';

export function autonomousProvisioning(world: World, id: ActorId): boolean {
  const mind = psycheOf(world, id) as ReturnType<typeof psycheOf> & { agencyMode?: string };
  return mind?.agencyMode !== 'commanded';
}
