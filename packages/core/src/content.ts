/**
 * Content-facing types for core. The zod schemas in @coulee/content are the single source
 * of truth; core imports only their TYPES (erased at runtime), so core has no runtime
 * dependency on zod or the loader. FOUNDATION-OWNED.
 */
import type { AbilityId, DefenseId, ValueId } from '@coulee/content/schema';

export type {
  AbilityId,
  ActivityDef,
  ChronicleTemplateDef,
  ContentBundle,
  DefenseId,
  FoodDef,
  InteractionDef,
  ItemDef,
  MaterialId,
  NeedDef,
  OccupationDef,
  PeopleDef,
  PlaceDef,
  PredicateDef,
  PrepDef,
  ProtectionId,
  RelationshipKind,
  ScenarioActor,
  ScenarioDef,
  ScenarioHousehold,
  ScheduleBlock,
  SiteDef,
  SkillDef,
  StackSeed,
  TempBand,
  TraitDef,
  ValueId,
} from '@coulee/content/schema';

/** Content ids are the TOML `id` strings. Aliases document intent; they are not branded. */
export type ItemDefId = string;
export type NeedId = string;
export type ActivityId = string;
export type InteractionId = string;
export type TraitId = string;
export type PeopleId = string;
export type OccupationId = string;
export type SkillId = string;
export type PlaceDefId = string;
export type PredicateId = string;

/** Runtime constants mirrored from the schema (core may not import zod at runtime). */
export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export const VALUES = [
  'piety',
  'thrift',
  'neighborliness',
  'parochialism',
  'superstition',
  'ambition',
  'temper',
  'rancor',
  'discretion',
] as const;
export const DEFENSES = [
  'repression',
  'projection',
  'displacement',
  'rationalization',
  'sublimation',
  'denial',
  'reaction_formation',
] as const;

// Compile-time guards: the runtime mirrors above must equal the schema unions.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type _AbilitiesMatchSchema = Assert<Same<AbilityId, (typeof ABILITIES)[number]>>;
export type _ValuesMatchSchema = Assert<Same<ValueId, (typeof VALUES)[number]>>;
export type _DefensesMatchSchema = Assert<Same<DefenseId, (typeof DEFENSES)[number]>>;
