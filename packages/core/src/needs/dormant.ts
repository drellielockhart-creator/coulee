import type { ActorId } from '../ids.ts';
import { airTempF } from '../provisions/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { satisfyNeed } from './api.ts';
import { hourlyLedger } from './system.ts';

/** Elapsed aggregate maintenance. Food/water/sleep are credited against their already
 * settled expenditure, never consumed again. Other wants decay with the owner's kernel.
 * This intentionally omits off-screen pleasures and hourly arbitration (T3 only). */
export function dormantNeeds(world: World, ctx: SimContext, id: ActorId, hours: number, shortageKcal = 0): void {
  const n = world.needs.byActor[id];
  if (!n || !world.actors[id]?.alive || hours <= 0) return;
  hours = Math.min(hours, Math.max(0, Math.floor((ctx.now - (world.actors[id]?.born ?? ctx.now)) / 60)));
  for (const key of Object.keys(ctx.content.needs).sort()) {
    if (['hunger', 'thirst', 'rest', 'warmth'].includes(key)) continue;
    const ledger = (values: Readonly<Record<string, number>>) =>
      hourlyLedger(
        world,
        ctx.content,
        id,
        key,
        airTempF(ctx.cal, world),
        world.needs.placeTempF?.[world.actors[id]?.placeId ?? 0] ?? airTempF(ctx.cal, world),
        values,
        undefined,
        false,
      ).delta;
    const def = ctx.content.needs[key];
    const before = n.values[key] ?? def?.initial ?? 0;
    let after = before;
    if (def?.baseline || def?.recovery) {
      // Integer baseline/recovery is a bounded recurrence, not delta * elapsed.
      // With frozen inputs it is monotone on 0..1000 and reaches a fixed point
      // within 1001 changes. Reuse the owner kernel to retain its exact rounding.
      for (let hour = 0; hour < Math.min(hours, 1001); hour++) {
        const next = Math.max(0, Math.min(1000, after + ledger({ ...n.values, [key]: after })));
        if (next === after) break;
        after = next;
      }
    } else after = before + ledger(n.values) * hours;
    satisfyNeed(world, ctx, id, key, after - before, { label: 'Dormant elapsed upkeep', quiet: true });
  }
  if (shortageKcal > 0)
    satisfyNeed(
      world,
      ctx,
      id,
      'hunger',
      -Math.ceil(shortageKcal / (ctx.content.needs.hunger?.intake?.per_point ?? 3)),
      { label: 'Dormant pantry shortfall', quiet: true },
    );
}
