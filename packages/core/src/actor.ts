/**
 * Actors, households, places: the core entities every module shares. FOUNDATION-OWNED.
 *
 * P2 "Everyone is a character sheet": the player is an ordinary actor whose `controller`
 * is 'player' (its urges come from Commands). No rule may branch on `controller`; only the
 * *source of urges* differs.
 *
 * Mind state is NOT here: it is split into module slices keyed by ActorId
 * (needs -> world.needs, psyche -> world.psyche, opinions/memories -> world.social,
 * beliefs -> world.belief, inventory -> world.items). See world.ts.
 */
import type { AbilityId, OccupationId, PeopleId, PlaceDefId, SkillId, TraitId, ValueId } from './content.ts';
import type { ActorId, HouseholdId, PlaceId } from './ids.ts';
import type { GameMinute } from './time.ts';

export type Abilities = Record<AbilityId, number>;
export type Values = Record<ValueId, number>;

/** The rules-state (02). Only the fields M1 needs; combat/feats/vigor arrive later. */
export interface Sheet {
  /** Existing townsfolk default to +0 progression and Medium grapple size. */
  combat?: { attack: number; grappleSize: number };
  abilities: Abilities;
  /** Skill id -> ranks (02 §4.2). Missing = 0 ranks. */
  skills: Record<SkillId, number>;
  level: number;
  feats: string[];
  /** Active condition ids (02 §13), e.g. 'hungry', 'fatigued'. Written via core helpers. */
  conditions: string[];
  languages: string[];
  literate: boolean;
}

export interface ActorName {
  given: string;
  family: string;
  nickname?: string;
}

export interface ActorCore {
  id: ActorId;
  /** Scenario-local key ('gussie_pratt'); stable across runs of the same scenario. */
  key: string;
  name: ActorName;
  sex: 'female' | 'male';
  born: GameMinute;
  /** Ground-truth people. Never shown to other actors; they hold beliefs instead. */
  ancestryId: PeopleId;
  /** The people this actor publicly presents as (concealed peoples pass). */
  presentsAsId: PeopleId;
  occupationId: OccupationId;
  householdId: HouseholdId;
  /** Where the actor is now (T1 location). WRITTEN ONLY by the activity module. */
  placeId: PlaceId;
  /** Personality (04 §3.1), −3..+3 each; base + trait shifts are applied by psyche at init. */
  values: Values;
  traits: TraitId[];
  sheet: Sheet;
  /** Who supplies urges: AI (psyche) or Commands. Never used to pick a rule path. */
  controller: 'ai' | 'player';
  alive: boolean;
}

export interface Household {
  id: HouseholdId;
  key: string;
  name: string;
  headId: ActorId;
  /** Members in insertion (scenario) order. */
  memberIds: ActorId[];
  homePlaceId: PlaceId;
}

/** A runtime place, created from a PlaceDef (content) or at runtime (a camp). */
export interface Place {
  id: PlaceId;
  /** Content id ('dunleavys_tavern'), or '' for runtime-created places. */
  defId: PlaceDefId;
  siteId: string;
  name: string;
  kind: string;
  tags: string[];
  /** Footprint on the site grid, in tiles. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  capacity: number;
  model: string | null;
  faeIntensity: number;
  description?: string;
}

export const abilityMod = (score: number): number => Math.floor((score - 10) / 2);

export function displayName(a: Pick<ActorCore, 'name'>): string {
  const n = a.name;
  const given = n.nickname ? `${n.given} "${n.nickname}"` : n.given;
  return n.family ? `${given} ${n.family}` : given;
}

export function shortName(a: Pick<ActorCore, 'name'>): string {
  const n = a.name;
  // A nickname that already carries the family name ("Captain Hurd") stands alone.
  if (n.nickname && n.family && n.nickname.includes(n.family)) return n.nickname;
  return n.family ? `${n.nickname ?? n.given} ${n.family}` : (n.nickname ?? n.given);
}

export function hasCondition(a: ActorCore, condition: string): boolean {
  return a.sheet.conditions.includes(condition);
}

/** Add/remove a condition idempotently (keeps insertion order for determinism). */
export function setCondition(a: ActorCore, condition: string, on: boolean): void {
  const i = a.sheet.conditions.indexOf(condition);
  if (on && i < 0) a.sheet.conditions.push(condition);
  if (!on && i >= 0) a.sheet.conditions.splice(i, 1);
}
