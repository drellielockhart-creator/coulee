/** Third-party protection for object-mediated harm (13 §1.1, 01 §4.5). */
import type { CharmDef } from '@coulee/content/schema';
import type { ActorId, HouseholdId } from '../ids.ts';
import type { World } from '../world.ts';

export function harmAllowed(
  world: World,
  def: CharmDef,
  keeper: ActorId | null,
  household: HouseholdId | null,
): boolean {
  const faeKeeper = keeper !== null && world.fae.faeActors?.[keeper] === true;
  if (def.harm_basis === 'instrument' && !faeKeeper) return true;
  if (household === null) return false; // No established target eligibility.
  const members = world.households[household]?.memberIds ?? [];
  return (
    members.length > 0 &&
    members.every(
      (id) =>
        !world.actors[id]?.alive ||
        world.fae.faeActors?.[id] === true ||
        (world.fae.forfeits?.[id] ?? []).some((f) => f.counterparty === def.court && f.until > world.time),
    )
  );
}
