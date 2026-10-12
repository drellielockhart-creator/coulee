/**
 * The forecast contract (13 §5.7). OWNER: module:fae, called by provisions' planner.
 *
 * Input is knowledge-filtered for the holder: only charms in the holder's own kit or stores; a
 * charm's effect enters only when a member has verified it (seen it work, or studied it), at the
 * virtue the holder knows; never live remote stocks, never rumor. The projection carries its own
 * copy of the hem state (a HemSet), so planning never writes to the world.
 * Output rows: exact (a verified hem over the plan's hours), conditional (the sack: shown, never
 * counted in food-days), claims (heard of, not counted), and ungated iron arithmetic.
 */
import type { ContentBundle } from '../content.ts';
import type { ActorId, ItemId } from '../ids.ts';
import { binIron } from '../items/api.ts';
import { parentOf } from '../items/containers.ts';
import type { ItemStack } from '../items/state.ts';
import type { World } from '../world.ts';
import { charmDefOf, knowledgeOf } from './charms.ts';
import { drawEffectOf } from './draws.ts';
import { dryEffectOf, type HemSet } from './hem.ts';

export interface CharmForecastRow {
  itemId: ItemId;
  name: string;
  /** exact: counted in the plan; conditional: shown, never counted; claims: heard of only. */
  kind: 'exact' | 'conditional' | 'claims';
  text: string;
  /** Exact hem rows: rainy, exposed hours in the plan and how many the hem covers. */
  exposedHours?: number;
  coveredHours?: number;
  /** Virtue known to the holder now, and projected at the end of the plan (exact rows). */
  virtue?: number;
  virtueAfter?: number;
  /** Iron in contact, grams (ungated arithmetic) and whether it suppresses the charm. */
  ironG: number;
  suppressed: boolean;
}

function verified(world: World, members: readonly ActorId[], itemId: ItemId): boolean {
  return members.some((m) => {
    const k = knowledgeOf(world, m, itemId);
    return k?.effects !== undefined || k?.observed !== undefined;
  });
}

/** The projection's own hem state: verified hems among the holder's stacks only. */
export function forecastHems(
  world: World,
  content: ContentBundle,
  members: readonly ActorId[],
  stacks: readonly ItemStack[],
): HemSet {
  const out: HemSet = { byContainer: {} };
  for (const s of stacks) {
    const c = world.fae.charms?.[s.id];
    const def = charmDefOf(content, s.defId);
    const eff = dryEffectOf(def);
    if (!c || !def || !eff || c.inert || c.disposed || !verified(world, members, s.id)) continue;
    const parent = parentOf(world, s);
    if (!parent || !stacks.some((x) => x.id === parent.id)) continue;
    out.byContainer[parent.id] = {
      hemId: s.id,
      containerId: parent.id,
      virtue: c.virtue,
      exposure: c.exposure,
      blockMinutes: eff.block_minutes,
      cost: eff.virtue,
      maxContentsG: eff.max_contents_g,
      spill: eff.spill === 'nearest_uncovered',
      active: false,
      exposedThisHour: false,
      spent: 0,
      spilledOn: null,
      suppressed: false,
      placeId: null,
      holderId: null,
      exposedHours: 0,
      coveredHours: 0,
    };
  }
  return out;
}

/** Rows for every charm in the holder's stacks, after the projection ran with `hems`. */
export function forecastCharms(
  world: World,
  content: ContentBundle,
  members: readonly ActorId[],
  stacks: readonly ItemStack[],
  hems: HemSet,
): CharmForecastRow[] {
  const rows: CharmForecastRow[] = [];
  for (const s of stacks) {
    const def = charmDefOf(content, s.defId);
    const c = world.fae.charms?.[s.id];
    if (!def || !c) continue;
    const name = content.items[s.defId]?.name ?? s.defId;
    const iron = binIron(world, content, s);
    const suppressed = iron.ironLined || iron.grams >= def.iron.nearby_g;
    const ironText = suppressed
      ? ` Suppressed: ${(iron.grams / 454).toFixed(1)} lb of iron in contact (${iron.terms.map((t) => t.label).join(', ') || 'an iron-lined box'}).`
      : iron.grams > 0
        ? ` ${(iron.grams / 454).toFixed(1)} lb of iron in contact; it works below ${(def.iron.nearby_g / 454).toFixed(0)} lb.`
        : '';
    const known = verified(world, members, s.id);
    if (!known) {
      rows.push({
        itemId: s.id,
        name,
        kind: 'claims',
        text: `${name}: what is said of it is not counted until you have seen it work or studied it.${ironText}`,
        ironG: iron.grams,
        suppressed,
      });
      continue;
    }
    const dry = dryEffectOf(def);
    if (dry) {
      const r = Object.values(hems.byContainer).find((x) => x.hemId === s.id);
      const exposed = r?.exposedHours ?? 0;
      const covered = r?.coveredHours ?? 0;
      rows.push({
        itemId: s.id,
        name,
        kind: 'exact',
        text: r
          ? `${name}: ${c.virtue} soaking${c.virtue === 1 ? '' : 's'} of virtue; keeps its bag dry for ${covered} of ${exposed} rainy hours in this plan${exposed > covered ? ', then an ordinary flap' : ''}. Dew at dawn wakes it (bag hung empty, no rain).${ironText}`
          : `${name}: not stitched into a bag, so it covers nothing.${ironText}`,
        exposedHours: exposed,
        coveredHours: covered,
        virtue: c.virtue,
        virtueAfter: r?.virtue ?? c.virtue,
        ironG: iron.grams,
        suppressed,
      });
      continue;
    }
    const draw = drawEffectOf(def);
    // Seeing it stand full shows what it yields, not where the flour comes from: the source
    // condition is named only to a household that has studied what it does (13 §5.7, §8.2 #12).
    const studied = members.some((m) => knowledgeOf(world, m, s.id)?.effects !== undefined);
    if (draw)
      rows.push({
        itemId: s.id,
        name,
        kind: 'conditional',
        text: studied
          ? `${name}: 0 to ${draw.qty} lb of flour a dawn if an unwarded store within ${draw.radius_mi} miles has flour, while it has virtue (${c.virtue}); tie it shut at night. Not counted in food-days.${ironText}`
          : `${name}: up to ${draw.qty} lb of flour some mornings, while it has virtue (${c.virtue}); tie it shut at night. Where the flour comes from you have not learned. Not counted in food-days.${ironText}`,
        virtue: c.virtue,
        ironG: iron.grams,
        suppressed,
      });
  }
  return rows;
}
