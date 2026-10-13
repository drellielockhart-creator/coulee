import type { RegionDef } from '@coulee/content/schema';
import type { ActorId, PlaceId, Table } from '../ids.ts';
export interface SiteRecord {
  nodeId: string;
  siteId: string;
  entranceId: PlaceId;
  layoutVersion: 1;
  tier: 'T1';
  installedAt: number;
}
export interface RegionState {
  processing?: import('./processing.ts').ProcessingState;
  census?: CensusState;
  lod?: LodState;
  version: 1;
  definition: RegionDef;
  worldSeed: number;
  sites: Record<string, SiteRecord>;
  /** Private outdoor addresses prevent accidental encounters anywhere along an entire road. */
  transit: Table<ActorId, PlaceId>;
  knownNodes: Table<ActorId, string[]>;
}

/** Slice 2a retains authored sheets; generated, never-materialized census is a later adapter. */
export interface CensusMember {
  actorId: ActorId;
  ref: string;
  identity: Pick<
    import('../actor.ts').ActorCore,
    'name' | 'sex' | 'born' | 'ancestryId' | 'presentsAsId' | 'occupationId' | 'householdId'
  > & { languages: string[] };
  alive: boolean;
  observedThrough: number;
  death?: { at: number; cause: string; placeId: PlaceId; eventId: import('../ids.ts').EventId };
}
export interface CensusState {
  version: 1;
  source: 'authored-sheets';
  members: Table<ActorId, CensusMember>;
  households: Table<
    import('../ids.ts').HouseholdId,
    {
      householdId: import('../ids.ts').HouseholdId;
      ref: string;
      siteId: string;
      memberIds: ActorId[];
    }
  >;
  /** Only consequential evidence belongs here. Routine hourly events are not copied. */
  evidence: Array<{
    key: string;
    memory: import('../social/state.ts').MemoryInput;
    hydratedMemoryId: import('../ids.ts').MemoryId | null;
    /** Present only for producer-snapshotted coarse memories. Original memory remains immutable. */
    decay?: {
      policy: import('../social/api.ts').MemoryDecayPolicy;
      throughDay: number;
      salience: number;
      forgottenAt: number | null;
    };
  }>;
}
export type RegionTier = 'T0' | 'T1' | 'T2';
export interface LodRecord {
  /** Policy result, not a claim that a T2 executor exists yet. */
  selected: RegionTier;
  processing: 'T0' | 'T1';
  belowSince: number | null;
  distanceMinutes: number | null;
  relevance: number;
  pinned: boolean;
  reasons: string[];
}
export interface LodState {
  version: 1;
  focusActorId: ActorId | null;
  actors: Table<ActorId, LodRecord>;
  /** Explicit companion/pursuer pins and module-supplied relevance; no controller branching. */
  relevance: Table<ActorId, { score: number; pinned: boolean; reason: string }>;
  evaluatedAt: number;
}
