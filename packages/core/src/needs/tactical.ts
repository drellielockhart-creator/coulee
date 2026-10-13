/** T0 interval settlement uses the ordinary need mutation kernel and saved integer carries. */

import { type ActorId, idsOf } from '../ids.ts';
import { inventoryIndex } from '../items/api.ts';
import { instantOf, TICKS_PER_HOUR } from '../sim/clock.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { satisfyNeed } from './api.ts';
import { hourlyLedger } from './system.ts';
import { ambientTemperatureF, heatPlaces } from './thermal.ts';

export function accrueTacticalNeeds(w: World, ctx: SimContext, through: number): void {
  const f = w.tactical?.frame;
  if (!f || through <= f.through) return;
  const elapsed = through - f.through;
  for (const id of f.live) {
    const rates = (w.tactical?.participants[id]?.action ? f.activeRates[id] : f.rates[id]) ?? {},
      carry = f.carries[id] ?? {};
    f.carries[id] = carry;
    for (const key of Object.keys(rates).sort()) {
      const numerator = (carry[key] ?? 0) + (rates[key] ?? 0) * elapsed;
      const delta = Math.trunc(numerator / TICKS_PER_HOUR) || 0;
      carry[key] = numerator - delta * TICKS_PER_HOUR || 0;
      if (delta) satisfyNeed(w, ctx, id, key, delta, { label: 'Elapsed tactical exposure', quiet: true });
    }
    f.elapsed[id] = (f.elapsed[id] ?? 0) + elapsed;
  }
  f.through = through;
}
/** Prepare immutable hourly rates once; no need is charged before time elapses. */
export function prepareTacticalNeeds(w: World, ctx: SimContext, actors?: ActorId[]): void {
  const f = w.tactical?.frame;
  if (!f) return;
  f.temperatures = heatPlaces(w, ctx);
  const air = ambientTemperatureF(ctx.cal, w),
    inventory = inventoryIndex(w);
  for (const id of actors ?? f.live) {
    const actor = w.actors[id],
      n = w.needs.byActor[id],
      activity = w.activity.byActor[id];
    if (!actor || !n || !activity) continue;
    const before = { ...n.values };
    f.rates[id] = {};
    f.activeRates[id] = {};
    const activeWorld = {
      ...w,
      activity: { ...w.activity, byActor: { ...w.activity.byActor, [id]: { ...activity, activityId: 'walk' } } },
    };
    for (const key of Object.keys(ctx.content.needs).sort()) {
      const rest = f.rates[id],
        active = f.activeRates[id];
      if (rest)
        rest[key] = hourlyLedger(
          w,
          ctx.content,
          id,
          key,
          air,
          f.temperatures[actor.placeId] ?? air,
          before,
          inventory,
          false,
        ).delta;
      if (active)
        active[key] = hourlyLedger(
          activeWorld,
          ctx.content,
          id,
          key,
          air,
          f.temperatures[actor.placeId] ?? air,
          before,
          inventory,
          false,
        ).delta;
    }
  }
}

/** Next integer meter change, so query partitioning cannot move a band-change event. */
export function nextTacticalNeedInstant(w: World): number | null {
  const f = w.tactical?.frame;
  if (!f) return null;
  let delay: number | null = null;
  for (const id of f.live) {
    const rates = (w.tactical?.participants[id]?.action ? f.activeRates[id] : f.rates[id]) ?? {};
    for (const key of Object.keys(rates).sort()) {
      const rate = rates[key] ?? 0,
        carry = f.carries[id]?.[key] ?? 0;
      if (!rate) continue;
      const ticks = rate > 0 ? Math.ceil((TICKS_PER_HOUR - carry) / rate) : Math.ceil((TICKS_PER_HOUR + carry) / -rate);
      if (delay === null || ticks < delay) delay = ticks;
    }
  }
  return delay === null ? null : f.through + Math.max(1, delay);
}

/** A second scene may admit different actors into an already open town hour. */
export function enrollTacticalNeeds(w: World, ctx: SimContext): ActorId[] {
  const f = w.tactical?.frame;
  if (f?.phase !== 'open') return [];
  const prior = f.live;
  const added = idsOf<ActorId>(w.tactical?.participants ?? {}).filter((id) => !prior.includes(id));
  if (!added.length) return [];
  prepareTacticalNeeds(w, ctx, added);
  const through = f.through;
  f.live = added;
  f.through = f.start;
  accrueTacticalNeeds(w, ctx, instantOf(w));
  f.live = [...prior, ...added].sort((a, b) => a - b);
  f.through = through;
  return added;
}
