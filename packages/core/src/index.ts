/**
 * @coulee/core public API. FOUNDATION-OWNED barrel.
 * Module namespaces are exported as namespaces to avoid name clashes:
 *   import { needs, social, provisions } from '@coulee/core';
 */

export * as activity from './activity/index.ts';
export * from './actor.ts';
export * as belief from './belief/index.ts';
export * from './checks.ts';
export * as chronicle from './chronicle/index.ts';
export * from './command.ts';
export * from './content.ts';
export * from './events/index.ts';
export * from './explain.ts';
export * as fae from './fae/index.ts';
export * from './hash.ts';
export * from './ids.ts';
export * as items from './items/index.ts';
export * as needs from './needs/index.ts';
export * as provisions from './provisions/index.ts';
export * as psyche from './psyche/index.ts';
export * as region from './region/index.ts';
export * from './rng.ts';
export { type PackedJson, packJson, unpackJson } from './serialization.ts';
export * from './sim/advance.ts';
export * from './sim/clock.ts';
export type { InitContext, SimContext } from './sim/context.ts';
export { type CreateWorldOptions, createWorld, installSite } from './sim/init.ts';
export { HOURLY_SYSTEMS, type SystemFn } from './sim/schedule.ts';
export * from './sim/sim.ts';
export * as social from './social/index.ts';
export * as tactical from './tactical/index.ts';
export * from './time.ts';
export * from './urge.ts';
export * from './viewmodel.ts';
export type { World, WorldMeta } from './world.ts';
