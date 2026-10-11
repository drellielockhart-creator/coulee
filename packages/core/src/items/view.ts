/**
 * Item view parts. OWNER: module:provisions. Contract with module:web (see needs/view.ts note).
 * The Kit Sheet / Flat-Lay (03 §2.3) and the pantry both render ItemStackView lists.
 */
import type { ContentBundle } from '../content.ts';
import type { ActorId } from '../ids.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';
import { bulkTenths, carriedBy, stacksDeep, weightG } from './api.ts';
import type { ItemLocation } from './state.ts';

export interface ItemStackView {
  id: number;
  defId: string;
  name: string;
  qty: number;
  unit: string;
  /** Total weight of the stack (qty × unit), grams. */
  weightG: number;
  /** Total bulk, tenths of a Bulk unit. */
  bulkTenths: number;
  condition: number;
  wetness: number;
  /** 0..1000 spoilage progress, or null if not food. */
  spoilage: number | null;
  /** Nesting depth (0 = directly carried/stored). */
  depth: number;
  containerId: number | null;
  worn: boolean;
  isFood: boolean;
  section: string;
}

export interface ItemsActorView {
  carried: ItemStackView[];
  totalWeightG: number;
  totalBulkTenths: number;
  /** Legible load band (03 §4.1): 'Unburdened' | 'Light' | 'Medium' | 'Heavy' | 'Staggering'. */
  loadBand: string;
}

export function viewStacks(world: World, content: ContentBundle, loc: ItemLocation): ItemStackView[] {
  return stacksDeep(world, loc).map(({ stack: s, depth }) => {
    const def = content.items[s.defId];
    return {
      id: s.id,
      defId: s.defId,
      name: def?.name ?? s.defId,
      qty: s.qty,
      unit: def?.unit ?? 'each',
      weightG: (def?.weight_g ?? 0) * s.qty,
      bulkTenths: Math.round((def?.bulk ?? 0) * 10) * s.qty,
      condition: s.condition,
      wetness: s.wetness,
      spoilage: def?.food ? s.spoilage : null,
      depth,
      containerId: s.location.kind === 'container' ? s.location.itemId : null,
      worn: s.location.kind === 'actor' && s.location.worn,
      isFood: def?.food !== undefined,
      section: def?.section ?? 'misc',
    };
  });
}

export function viewItemsActor(
  world: World,
  content: ContentBundle,
  actorId: ActorId,
  _opts: ViewOptions,
): ItemsActorView {
  const loc = carriedBy(actorId);
  return {
    carried: viewStacks(world, content, loc),
    totalWeightG: weightG(world, content, loc),
    totalBulkTenths: bulkTenths(world, content, loc),
    loadBand: 'Unburdened', // STUB: module:provisions computes from Str carry capacity (03 §4.1)
  };
}
