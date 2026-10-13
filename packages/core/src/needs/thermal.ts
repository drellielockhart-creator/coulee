/** Exposure and actual hearth fuel. Weather hook until provisions exposes its temperature API. */
import { requiredRow } from '../activity/definitions.ts';
import { type ActorId, idsOf, type PlaceId } from '../ids.ts';
import { carriedBy, type InventoryIndex, inventoryIndex, pantryOf, stacksDeep } from '../items/api.ts';
import { airTempF, heatingFuel } from '../provisions/api.ts';
import { processesPlace, processingActorIds } from '../region/processing.ts';
import type { SimContext } from '../sim/context.ts';
import type { CalendarInfo } from '../time.ts';
import type { World } from '../world.ts';

/** Outdoor air, °F: provisions owns the weather hook (one source of temperature for spoilage and exposure). */
export function ambientTemperatureF(cal: CalendarInfo, world?: World): number {
  return airTempF(cal, world);
}

/** One fuel debit per place per hour, independent of how many actors sleep there. */
export function heatPlaces(world: World, ctx: SimContext): Record<number, number> {
  const air = ambientTemperatureF(ctx.cal, world);
  const temperatures: Record<number, number> = {};
  const inventory = world.items?.stacks ? inventoryIndex(world) : undefined;
  const homes: Record<number, number> = {};
  for (const hid of idsOf(world.households)) {
    const h = requiredRow(world.households, hid);
    homes[h.homePlaceId] ??= hid;
  }
  const occupied = new Set<number>();
  for (const aid of processingActorIds(world))
    if (world.actors[aid]?.alive && !world.activity.byActor[aid]?.travel)
      occupied.add(requiredRow(world.actors, aid).placeId);
  for (const pid of idsOf<PlaceId>(world.places).filter((id) => processesPlace(world, id))) {
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
      const owner = processingActorIds(world).find((id) => world.activity.byActor[id]?.workplaceId === pid);
      const hid = homes[pid] ?? (owner !== undefined ? world.actors[owner]?.householdId : undefined);
      if (hid === undefined) lit = false;
      else {
        const loc = pantryOf(hid as import('../ids.ts').HouseholdId);
        const paid = heatingFuel(world, ctx, pid, loc, hearth.fuel_kind, wanted, inventory);
        lit = paid !== null;
        fuel = paid ?? 0;
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
  world.needs.placeTempF = world.region ? { ...world.needs.placeTempF, ...temperatures } : temperatures;
  return temperatures;
}

/** Extra worn garments over ordinary seasonal dress; packed clothes give no protection. */
export function clothingWarmth(
  world: World,
  content: import('../content.ts').ContentBundle,
  id: ActorId,
  inventory?: InventoryIndex,
): number {
  const slots: Record<string, number> = {};
  for (const { stack } of stacksDeep(world, carriedBy(id), inventory)) {
    const garment = content.items[stack.defId]?.wearable;
    if (!garment || stack.location.kind !== 'actor' || !stack.location.worn) continue;
    const dry = 100 - Math.floor((stack.wetness * (100 - garment.wet_retention_pct)) / 100);
    const insulation = Math.floor((garment.insulation * dry * stack.condition) / 10000);
    slots[garment.slot] = Math.max(slots[garment.slot] ?? 0, insulation);
  }
  return Object.keys(slots)
    .sort()
    .reduce((sum, slot) => sum + (slots[slot] ?? 0), 0);
}
