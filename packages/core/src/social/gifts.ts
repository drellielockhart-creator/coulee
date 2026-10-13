/**
 * Gifts are things (playtest r2: "A ribbon. I thought of you." with no ribbon and no cost).
 * A gift is one unit of something the giver has: their own kit first, then the household's
 * stores, drawn from the `gift_sections` of the catalog, the item nearest a usual small gift's
 * value (`gift_value_cents`). Social hands it over through the items API.
 * OWNER: module:social.
 */
import type { ContentBundle } from '../content.ts';
import type { ActorId } from '../ids.ts';
import { carriedBy, pantryOf, stacksDeep } from '../items/api.ts';
import type { ItemStack } from '../items/state.ts';
import { accessibleStack } from '../provisions/api.ts';
import type { World } from '../world.ts';
import { tuningOf } from './tuning.ts';

/** The stack a giver would draw one gift from, or null when they have nothing fit to give. */
export function giftStack(world: World, content: ContentBundle, giverId: ActorId): ItemStack | null {
  const giver = world.actors[giverId];
  if (!giver) return null;
  const t = tuningOf(content);
  const sections = new Set<string>(t.gift_sections);
  const fit = (s: ItemStack, openedFood: boolean): boolean => {
    const def = content.items[s.defId];
    return (
      def !== undefined &&
      accessibleStack(world, giverId, s) &&
      sections.has(def.section) &&
      def.value_cents > 0 &&
      def.container === undefined &&
      s.qty >= 1 &&
      s.condition > 0 &&
      s.spoilage < 500 &&
      ((openedFood && def.food !== undefined) || (s.partial === 0 && !(s.foodPartialPm ?? 0)))
    );
  };
  const pick = (stacks: ItemStack[], openedFood = false): ItemStack | null => {
    let best: ItemStack | null = null;
    let bestGap = 0;
    for (const s of stacks) {
      if (!fit(s, openedFood)) continue;
      const value = content.items[s.defId]?.value_cents ?? 0;
      const gap = Math.abs(value - t.gift_value_cents);
      if (best === null || gap < bestGap || (gap === bestGap && s.id < best.id)) {
        best = s;
        bestGap = gap;
      }
    }
    return best;
  };
  const own = stacksDeep(world, carriedBy(giverId)).map((e) => e.stack);
  const pantry = stacksDeep(world, pantryOf(giver.householdId)).map((e) => e.stack);
  // Prefer a whole gift; an opened food parcel still has something worth sharing.
  // moveStack leaves partial use behind when splitting off a whole unit.
  return pick(own) ?? pick(pantry) ?? pick(own, true) ?? pick(pantry, true);
}
