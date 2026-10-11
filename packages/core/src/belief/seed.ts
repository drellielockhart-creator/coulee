/**
 * Scenario belief seeding (secrets, authored beliefs, concealed self-knowledge). OWNER: module:belief.
 * Stub created by the orchestrator to unblock compilation; module:belief implements it.
 */
import type { FigureId } from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import type { World } from '../world.ts';

export function seedBeliefs(_world: World, _ctx: InitContext, _figureByKey: Record<string, FigureId>): void {}
