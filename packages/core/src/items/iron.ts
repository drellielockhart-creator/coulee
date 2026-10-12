/**
 * Iron Presence at a bin (03 §3.3 integer form; 13 §5.2, §5.4). OWNER: module:provisions.
 *
 * IP_g = Σ floor(weight_g × qty × ferrous_pct × cold_pct / 10,000), ferrous = iron, steel, tinplate
 * and cold_iron; cold iron counts ×3. "At the bin" is what touches the thing:
 *   - in a container: the container's own iron plus everything else in it (deep);
 *   - loose at a household's stores, a place or a person: the other loose things there and their own
 *     iron (not what is packed inside them), except hearth gear (things that cook, boil, bake, fry or
 *     roast, or light a fire or a lamp): the kettle and the tinderbox are at the hearth, not in the bin;
 *   - plus whatever iron is inside the thing itself (a horseshoe dropped in the flour sack).
 * Pure: no RNG, no mutation; the Explain lists the named contributions.
 */
import type { ContentBundle, ItemDef } from '../content.ts';
import { type ExplainTerm, term } from '../explain.ts';
import type { ItemId } from '../ids.ts';
import type { World } from '../world.ts';
import { type InventoryIndex, inventoryIndex, stacksDeep } from './api.ts';
import { containerChain, locKey, parentOf } from './containers.ts';
import type { ItemStack } from './state.ts';

const FERROUS = ['iron', 'steel', 'tinplate', 'cold_iron'] as const;
const HEARTH = ['cook', 'boil', 'bake', 'fry', 'roast', 'ignite', 'light'] as const;

/** Iron Presence of one unit-stack in grams (03 §3.3; cold iron ×3). */
export function ferrousG(def: ItemDef | undefined, qty: number): number {
  if (!def) return 0;
  let n = 0;
  for (const m of def.materials)
    if ((FERROUS as readonly string[]).includes(m.material)) n += m.pct * (m.material === 'cold_iron' ? 3 : 1);
  return n ? Math.floor((def.weight_g * qty * n) / 100) : 0;
}

/** Hearth gear sits at the fire, not in the bin. */
export function isHearthGear(def: ItemDef | undefined): boolean {
  return !!def && HEARTH.some((a) => (def.affordances[a] ?? 0) > 0);
}

export interface BinIron {
  grams: number;
  /** Named contributions, largest first (at most 6), for the Explain. */
  terms: ExplainTerm[];
  /** True when an `iron_lined` container encloses the thing. */
  ironLined: boolean;
}

/**
 * Iron Presence in contact with a stack: inside it, and at its bin (see the file header). One
 * location's index is enough; callers in a loop pass a shared `index`.
 */
export function binIron(
  world: World,
  content: ContentBundle,
  stack: ItemStack,
  index: InventoryIndex = inventoryIndex(world),
): BinIron {
  const parts = new Map<string, number>();
  const add = (s: ItemStack, g: number) => {
    if (g <= 0) return;
    const name = content.items[s.defId]?.name ?? s.defId;
    parts.set(name, (parts.get(name) ?? 0) + g);
  };
  const seen = new Set<ItemId>([stack.id]);
  // Inside the thing itself.
  for (const { stack: s } of stacksDeep(world, { kind: 'container', itemId: stack.id }, index)) {
    seen.add(s.id);
    add(s, ferrousG(content.items[s.defId], s.qty));
  }
  const parent = parentOf(world, stack);
  if (parent) {
    add(parent, ferrousG(content.items[parent.defId], parent.qty));
    for (const { stack: s } of stacksDeep(world, { kind: 'container', itemId: parent.id }, index))
      if (!seen.has(s.id)) add(s, ferrousG(content.items[s.defId], s.qty));
  } else {
    for (const s of index.at[locKey(stack.location)] ?? []) {
      if (s.id === stack.id || world.items.stacks[s.id] !== s) continue;
      const def = content.items[s.defId];
      if (isHearthGear(def)) continue;
      add(s, ferrousG(def, s.qty));
    }
  }
  const ironLined = containerChain(world, stack).some((c) =>
    (content.items[c.defId]?.container?.protects ?? []).includes('iron_lined'),
  );
  const sorted = [...parts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  let grams = 0;
  for (const [, g] of sorted) grams += g;
  return {
    grams,
    terms: sorted.slice(0, 6).map(([name, g]) => term('iron', name, g)),
    ironLined,
  };
}
