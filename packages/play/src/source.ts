import { type ContentBundle, ScenarioActorSchema, ScenarioHouseholdSchema } from '@coulee/content/schema';
import { createSim, hashValue, psyche } from '@coulee/core';
import { GEN_VERSION, generateTown, type TownRecipe, townContent } from '@coulee/worldgen';

export type WorldSource = string | { kind: 'generated'; recipe: TownRecipe };
export interface PCSpec {
  agencyMode?: psyche.AgencyMode;
  standingOrders?: psyche.StandingOrders;
  name?: string;
  kit?: string;
  ancestry?: string;
  lodging?: 'tavern' | 'camp';
}
export interface SessionSpec {
  source: WorldSource;
  seed: number;
  worldSeed?: number;
  pc?: PCSpec;
}

/** Prepare source content without initializing or stepping a world. */
export function sessionContent(base: ContentBundle, spec: SessionSpec) {
  if (!Number.isSafeInteger(spec.seed)) throw new Error('Seed must be an integer');
  let content = base;
  let scenarioId: string;
  if (typeof spec.source !== 'string' || spec.source === 'gen:town') {
    const recipe =
      typeof spec.source === 'string'
        ? { genVersion: GEN_VERSION, seed: spec.worldSeed ?? spec.seed }
        : spec.source.recipe;
    const town = generateTown(base, recipe);
    content = townContent(base, town);
    scenarioId = town.scenario.id;
  } else scenarioId = spec.source;
  const original = content.scenarios[scenarioId];
  if (!original) throw new Error(`Unknown scenario ${scenarioId}`);
  const kit = content.playStarts[spec.pc?.kit ?? 'newcomer'];
  if (!kit) throw new Error('Unknown starting kit');
  const places = Object.values(content.places).filter((p) => p.site === original.site);
  const home =
    places.find((p) => (spec.pc?.lodging === 'camp' ? p.tags.includes('water') : p.tags.includes('tavern'))) ??
    places[0];
  if (!home) throw new Error('World has no arrival place');
  const key = 'play_newcomer';
  if (original.actors.some((a) => a.key === key) || original.households.some((h) => h.key === key))
    throw new Error('Reserved newcomer key already exists');
  const ancestry = spec.pc?.ancestry ?? kit.ancestry;
  if (!content.peoples[ancestry]) throw new Error('Unknown ancestry');
  const actor = ScenarioActorSchema.parse({
    key,
    agency_mode: spec.pc?.agencyMode ?? 'commanded',
    standing_orders: spec.pc?.standingOrders ?? psyche.DEFAULT_STANDING_ORDERS,
    given: spec.pc?.name ?? 'Ellis Wayfarer',
    family: '',
    sex: 'female',
    age: 25,
    ancestry,
    occupation: kit.occupation,
    household: key,
    place: home.id,
    abilities: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 },
    inventory: kit.inventory,
    purse_cents: kit.purse_cents,
  });
  const household = ScenarioHouseholdSchema.parse({ key, name: 'Newcomer lodgings', home: home.id, head: key });
  const scenario = {
    ...original,
    player: key,
    actors: [...original.actors, actor],
    households: [...original.households, household],
  };
  content = {
    ...content,
    scenarios: { ...content.scenarios, [scenarioId]: scenario },
    meta: { ...content.meta, hash: hashValue({ base: content.meta.hash, scenario }) },
  };
  return { content, scenarioId };
}

export function sessionSim(base: ContentBundle, spec: SessionSpec) {
  const { content, scenarioId } = sessionContent(base, spec);
  return createSim(content, { scenarioId, seed: spec.seed, withPlayer: true });
}
