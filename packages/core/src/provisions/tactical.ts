/** Supply clocks for carried devices use elapsed intervals, never UI query counts. */

import { allStacks, inventoryIndex, supplyUnits } from '../items/api.ts';
import { rootLocation } from '../items/containers.ts';
import { TICKS_PER_HOUR } from '../sim/clock.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { devicesHour } from './environment.ts';
import { BEDTIME_HOUR } from './rules.ts';
export function tacticalSupplies(w: World, ctx: SimContext, elapsed: number): void {
  if (elapsed <= 0) return;
  devicesHour(w, ctx, elapsed);
  const f = w.tactical?.frame;
  if (!f) return;
  const hunger = Object.values(ctx.content.needs).find((n) => n.intake?.unit === 'kcal');
  if (!hunger?.intake) return;
  w.provisions.tacticalCarry ??= {};
  for (const id of f.live) {
    const n = w.provisions.nutrition[id];
    if (!n) continue;
    const key = `burn:${id}`,
      c = w.provisions.tacticalCarry;
    const numerator =
      (c[key] ?? 0) +
      Math.max(0, -((w.tactical?.participants[id]?.action ? f.activeRates[id] : f.rates[id])?.[hunger.id] ?? 0)) *
        hunger.intake.per_point *
        elapsed;
    const kcal = Math.floor(numerator / TICKS_PER_HOUR);
    c[key] = numerator % TICKS_PER_HOUR;
    n.today.burnKcal = (n.today.burnKcal ?? 0) + kcal;
    if (f.through === f.end) n.today.burnHours = (n.today.burnHours ?? 0) + 1;
  }
}

/** Carried supply-unit deadlines also split the sparse frame; running dry has an exact instant. */
export function nextTacticalSupplyInstant(w: World, ctx: SimContext): number | null {
  const f = w.tactical?.frame;
  if (!f?.live.length) return null;
  const index = inventoryIndex(w);
  let delay: number | null = null;
  for (const stack of allStacks(w)) {
    const loc = rootLocation(w, stack);
    if (loc.kind !== 'actor' || !f.live.includes(loc.actorId) || stack.condition <= 0) continue;
    const wanted =
      stack.litMode === 'on' || (stack.litMode === 'auto' && !ctx.cal.isDaylight && ctx.cal.hour < BEDTIME_HOUR);
    if (!wanted) continue;
    for (const cost of ctx.content.items[stack.defId]?.consumes ?? []) {
      if (
        (cost.per !== 'hour' && cost.per !== 'day') ||
        cost.units <= 0 ||
        supplyUnits(w, ctx.content, loc, cost.kind, index) <= 0
      )
        continue;
      const denominator = TICKS_PER_HOUR * (cost.per === 'day' ? 24 : 1);
      const carry = w.provisions.tacticalCarry?.[`device:${stack.id}:${cost.kind}`] ?? 0;
      const ticks = Math.ceil((denominator - carry) / cost.units);
      if (delay === null || ticks < delay) delay = ticks;
    }
  }
  return delay === null ? null : f.through + Math.max(1, delay);
}
