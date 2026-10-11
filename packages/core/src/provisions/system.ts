/**
 * Provisions system: runs SIXTH each hour (after belief). OWNER: module:provisions.
 *
 * Contract (MODULES.md module:provisions):
 *   - Meals at meal hours (or when psyche chose an eating urge): pick food from the actor's
 *     inventory or household pantry, check prep requirements (fire + fuel + cookware +
 *     water + time), consume units, record intake (kcal/protein/fat/fresh/groups), feed
 *     hunger via needs/api.ts feed(), emit 'provisions.meal'.
 *   - Spoilage (hourly or daily): advance ItemStack.spoilage by
 *     1000 / (shelf_life_days*24) per hour × temperature band pct × wet pct × packaging pct
 *     (integer math), spoil at 1000 -> 'provisions.spoiled' (+ spoils_to).
 *   - Daily: roll intake into history, update scurvy/monotony, toggle nutrition conditions,
 *     household ration policy and shortage events, store restocking.
 *   - Commands: 'provisions.*' (buy/eat/set_rations/pack) by the same rules as NPCs.
 */
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';

export function provisionsSystem(_world: World, _ctx: SimContext): void {
  // STUB: implemented by module:provisions.
}
