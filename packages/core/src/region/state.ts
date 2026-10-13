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
  version: 1;
  definition: RegionDef;
  worldSeed: number;
  sites: Record<string, SiteRecord>;
  /** Private outdoor addresses prevent accidental encounters anywhere along an entire road. */
  transit: Table<ActorId, PlaceId>;
  knownNodes: Table<ActorId, string[]>;
}
