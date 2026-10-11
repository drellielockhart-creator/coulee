/** Exposure and actual hearth fuel. Weather hook until provisions exposes its temperature API. */
import { requiredRow } from '../activity/definitions.ts';
import { type ActorId, idsOf, type PlaceId } from '../ids.ts';
import { consumeSupply, pantryOf, supplyUnits } from '../items/api.ts';
import { airTempF } from '../provisions/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { CalendarInfo } from '../time.ts';
import type { World } from '../world.ts';

/** Outdoor air, °F: provisions owns the weather hook (one source of temperature for spoilage and exposure). */
export function ambientTemperatureF(cal: CalendarInfo): number {
  return airTempF(cal);
}

/** One fuel debit per place per hour, independent of how many actors sleep there. */
export function heatPlaces(world: World, ctx: SimContext): Record<number, number> {
  const air = ambientTemperatureF(ctx.cal);
  const temperatures: Record<number, number> = {};
  const homes: Record<number, number> = {};
  for (const hid of idsOf(world.households)) {
    const h = requiredRow(world.households, hid);
    homes[h.homePlaceId] ??= hid;
  }
  const occupied = new Set<number>();
  for (const aid of idsOf<ActorId>(world.actors))
    if (world.actors[aid]?.alive && !world.activity.byActor[aid]?.travel)
      occupied.add(requiredRow(world.actors, aid).placeId);
  for (const pid of idsOf<PlaceId>(world.places)) {
    const place = requiredRow(world.places, pid);
    const hearth = Object.keys(ctx.content.hearths)
      .sort()
      .map((key) => requiredRow(ctx.content.hearths, key))
      .find((h) => h.place_tags.some((tag) => place.tags.includes(tag)));
    if (!hearth) {
      temperatures[pid] = air;
      continue;
    }
    let lit = air < hearth.when_below_f && (!hearth.occupied_only || occupied.has(pid));
    const wanted = hearth.burn_base + Math.floor((hearth.burn_per_10f * Math.max(0, hearth.ref_f - air)) / 10);
    let fuel = 0;
    if (lit && hearth.fuel_from === 'household' && wanted > 0) {
      const owner = idsOf<ActorId>(world.actors).find((id) => world.activity.byActor[id]?.workplaceId === pid);
      const hid = homes[pid] ?? (owner !== undefined ? world.actors[owner]?.householdId : undefined);
      if (hid === undefined) lit = false;
      else {
        const loc = pantryOf(hid as import('../ids.ts').HouseholdId);
        lit = supplyUnits(world, ctx.content, loc, hearth.fuel_kind) >= wanted;
        if (lit) fuel = consumeSupply(world, ctx.content, loc, hearth.fuel_kind, wanted);
      }
    }
    const temperatureF = lit ? Math.min(hearth.cap_f, air + hearth.gain_f) : air + hearth.unlit_gain_f;
    temperatures[pid] = temperatureF;
    // Routine burning is silent; lighting or letting a hearth go out is the event (P1 keeps the math on it).
    world.needs.hearthLit ??= {};
    const was = world.needs.hearthLit[pid] ?? 0;
    if (lit) world.needs.hearthLit[pid] = 1;
    else delete world.needs.hearthLit[pid];
    if ((lit ? 1 : 0) !== was)
      ctx.emit({
        kind: 'needs.hearth',
        data: { placeId: pid, fuel, lit, temperatureF },
        place: pid,
        visibility: 'public',
        explain: {
          kind: 'formula',
          label: hearth.name,
          subjects: [],
          knowledge: 'public',
          terms: [
            { source: 'weather', label: 'Outdoor air', value: air },
            { source: 'place', label: lit ? 'Fire and temperature cap' : 'Shelter', value: temperatureF - air },
          ],
          total: temperatureF,
          outcome: lit ? 'lit' : 'unlit',
          note: `${fuel} fuel minutes burned`,
        },
      });
  }
  world.needs.placeTempF = temperatures;
  return temperatures;
}
