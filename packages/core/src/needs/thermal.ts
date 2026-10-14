/** Exposure and actual hearth fuel. Weather hook until provisions exposes its temperature API. */
import { requiredRow } from '../activity/definitions.ts';
import { type ActorId, idsOf, type PlaceId, sortedKeys } from '../ids.ts';
import { carriedBy, type InventoryIndex, inventoryIndex, pantryOf, stacksDeep } from '../items/api.ts';
import { airTempF, hearthBurn, heatingFuel } from '../provisions/api.ts';
import { fixedDerivation, processesPlace, processingActorIds } from '../region/processing.ts';
import type { SimContext } from '../sim/context.ts';
import type { CalendarInfo } from '../time.ts';
import type { World } from '../world.ts';

/** Outdoor air, °F: provisions owns the weather hook (one source of temperature for spoilage and exposure). */
export function ambientTemperatureF(cal: CalendarInfo, world?: World): number {
  return airTempF(cal, world);
}

type HearthDef = SimContext['content']['hearths'][string];
/** Hearth definitions in key order (sorted keys cached and revalidated by `sortedKeys`). */
function sortedHearths(content: SimContext['content']): HearthDef[] {
  return sortedKeys(content.hearths).map((key) => requiredRow(content.hearths, key));
}

/** One fuel debit per place per hour, independent of how many actors sleep there. */
export function heatPlaces(world: World, ctx: SimContext): Record<number, number> {
  const air = ambientTemperatureF(ctx.cal, world);
  const temperatures: Record<number, number> = {};
  if (world.region) world.needs.placeTempF ??= {};
  const regional = world.region ? world.needs.placeTempF : undefined;
  const inventory = world.items?.stacks ? inventoryIndex(world) : undefined;
  // Maps, not objects: place ids can be large and sparse (county), and these never leave the call.
  const homes = fixedDerivation(world, 'heat:homes', () => {
    const map = new Map<number, number>();
    for (const hid of idsOf(world.households)) {
      const h = requiredRow(world.households, hid);
      if (!map.has(h.homePlaceId)) map.set(h.homePlaceId, hid);
    }
    return map;
  });
  const occupied = new Set<number>();
  const workplaceOwners = new Map<number, ActorId>();
  for (const aid of processingActorIds(world)) {
    const workplace = world.activity.byActor[aid]?.workplaceId;
    if (workplace != null && !workplaceOwners.has(workplace)) workplaceOwners.set(workplace, aid);
    if (world.actors[aid]?.alive && !world.activity.byActor[aid]?.travel)
      occupied.add(requiredRow(world.actors, aid).placeId);
  }
  const heated = fixedDerivation(world, 'heat:places', () =>
    idsOf<PlaceId>(world.places).filter((id) => processesPlace(world, id)),
  );
  for (const pid of heated) {
    const place = requiredRow(world.places, pid);
    const hearth = sortedHearths(ctx.content).find((h) => h.place_tags.some((tag) => place.tags.includes(tag)));
    if (!hearth) {
      temperatures[pid] = air;
      if (regional) regional[pid] = air;
      continue;
    }
    let lit = air < hearth.when_below_f && (!hearth.occupied_only || occupied.has(pid));
    const wanted = hearthBurn(hearth, air);
    let fuel = 0;
    if (lit && hearth.fuel_from === 'household' && wanted > 0) {
      const owner = workplaceOwners.get(pid);
      const hid = homes.get(pid) ?? (owner !== undefined ? world.actors[owner]?.householdId : undefined);
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
    if (regional) regional[pid] = temperatureF;
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
  // Regional worlds keep other sites' last temperatures: the table is updated in place as each
  // place is heated (nothing aliases it; projections and clones copy it). Rebuilding or merging
  // the county table on every heated hour dominated heatPlaces at county scale.
  if (!world.region) world.needs.placeTempF = temperatures;
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
