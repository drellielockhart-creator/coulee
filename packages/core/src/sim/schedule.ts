/**
 * The fixed system order (ADR 0001 invariant 6). FOUNDATION-OWNED.
 * Changing the order is an architecture decision: ask the orchestrator / Ellie.
 */

import { activitySystem } from '../activity/system.ts';
import { beliefSystem } from '../belief/system.ts';
import { chronicleSystem } from '../chronicle/system.ts';
import { directorSystem } from '../director/system.ts';
import { faeSystem } from '../fae/system.ts';
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
  { id: 'fae', run: faeSystem },
  { id: 'social', run: socialSystem },
  { id: 'belief', run: beliefSystem },
  { id: 'provisions', run: provisionsSystem },
  { id: 'chronicle', run: chronicleSystem },
  { id: 'director', run: directorSystem },
];

/** Tactical frames prepare minds after needs rates, then commit activities and settle
 * supplies at the closing boundary. Legacy hours continue to run the list above unchanged. */
export const TACTICAL_PREPARATION_SYSTEMS = new Set(['psyche']);
export function prepareHourIntentions(world: World, ctx: SimContext): void {
  for (const system of HOURLY_SYSTEMS) if (TACTICAL_PREPARATION_SYSTEMS.has(system.id)) system.run(world, ctx);
}
