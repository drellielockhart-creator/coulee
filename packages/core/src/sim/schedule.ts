/**
 * The fixed system order (ADR 0001 invariant 6). FOUNDATION-OWNED.
 * Changing the order is an architecture decision: ask the orchestrator / Ellie.
 */
import { activitySystem } from '../activity/system.ts';
import { beliefSystem } from '../belief/system.ts';
import { chronicleSystem } from '../chronicle/system.ts';
import { needsSystem } from '../needs/system.ts';
import { provisionsSystem } from '../provisions/system.ts';
import { psycheSystem } from '../psyche/system.ts';
import { socialSystem } from '../social/system.ts';
import type { World } from '../world.ts';
import type { SimContext } from './context.ts';

export type SystemFn = (world: World, ctx: SimContext) => void;

/** Per game-hour, in this order. */
export const HOURLY_SYSTEMS: ReadonlyArray<{ id: string; run: SystemFn }> = [
  { id: 'needs', run: needsSystem },
  { id: 'psyche', run: psycheSystem },
  { id: 'activity', run: activitySystem },
  { id: 'social', run: socialSystem },
  { id: 'belief', run: beliefSystem },
  { id: 'provisions', run: provisionsSystem },
  { id: 'chronicle', run: chronicleSystem },
];
