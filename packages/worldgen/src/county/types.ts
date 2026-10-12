import type { QaResult } from '../types.ts';
export const COUNTY_GEN_VERSION = 3;
export const COUNTY_LAYERS = ['terrain', 'hydrology', 'ecology', 'fae', 'settlements', 'routes'] as const;
export type CountyLayer = (typeof COUNTY_LAYERS)[number];
export interface CountyRecipe {
  genVersion: number;
  seed: number;
  preset?: 'coulee' | 'river';
  /** 40-acre cells, 1,320 feet square. Default 100 × 128 = 800 square miles. */
  size?: { width: number; height: number };
  layerVersions?: Partial<Record<CountyLayer, number>>;
  constraints?: { fordTownMaxAnchorMinutes?: number; protectedCells?: number[] };
}
export interface ResolvedCountyRecipe extends CountyRecipe {
  preset: 'coulee' | 'river';
  size: { width: number; height: number };
  layerVersions: Record<CountyLayer, number>;
  constraints: { fordTownMaxAnchorMinutes: number; protectedCells: number[] };
}
export type Aspect = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'flat';
export interface TerrainCell {
  id: number;
  x: number;
  y: number;
  downstream: number | null;
  catchment: number;
  /** Terrain-stage calibrated channel order; zero on dry hillslopes. */
  channelOrder?: number;
  elevationFt: number;
  slopePm: number;
  aspect: Aspect;
  soil: 'alluvium' | 'loess' | 'thin';
  geology: 'sandstone' | 'dolomite';
  contactFt: number;
  bluff: boolean;
  cave: boolean;
  sinkhole: boolean;
  algific: boolean;
  erratic: boolean;
  leadPm: number;
  protected: boolean;
}
export interface WaterCell {
  cell: number;
  kind: 'river' | 'creek' | 'dry';
  downstream: number | null;
  order: number;
  stream: string | null;
  spring: boolean;
  floodplain: boolean;
  ford: boolean;
  gravelBar: boolean;
  depthIn: number;
  millSeat: boolean;
  fallFt: number;
  /** Local contour trail crosses the gravel reach; independent of later wagon roads. */
  trailCrossing?: boolean;
  trailCells?: number[];
}
export type Vegetation = 'goat_prairie' | 'maple_basswood' | 'oak_savanna' | 'floodplain_forest' | 'oak_woodland';
export interface EcologyCell {
  vegetation: Vegetation;
  oldGrowth: boolean;
  fogPocket: boolean;
  wildlifePm: number;
  foragePm: number;
}
export interface FaeAnchor {
  id: string;
  cell: number;
  family: 'spring' | 'cave' | 'sinkhole' | 'fog' | 'old_growth';
  court: 'River' | 'Under' | 'Alder' | 'Thorn';
  intensity: number;
}
export interface FaeLayer {
  intensity: number[];
  anchors: FaeAnchor[];
}
export interface CountySettlement {
  id: string;
  cell: number;
  name: string;
  kind: 'ford_town' | 'mill' | 'landing' | 'diggings' | 'farm';
  /** Surname reserved for the future census; no actor/history is materialized here. */
  foundingFamily?: string;
  namedFeatureId?: string;
  suitability: number;
  required: boolean;
}
export interface RegionNode {
  id: string;
  cell: number;
  kind: CountySettlement['kind'] | 'site' | 'junction' | 'ford';
  name: string;
  required: boolean;
  protected: boolean;
}
export interface RegionEdge {
  id: string;
  a: string;
  b: string;
  kind: 'ridge_road' | 'valley_road' | 'river' | 'fae_path';
  /** Empty for non-geographic fae paths. */
  cells: number[];
  lengthFt: number;
  climbFt: number;
  descentFt: number;
  gradePm: number;
  /** Path length / endpoint distance, rounded to per mille (roads only). */
  sinuosityPm?: number;
  crossings?: Array<{ cell: number; kind: 'ford' | 'timber_bridge' }>;
  surface: 'earth' | 'gravel' | 'water' | 'other';
  availableMonths: number[];
  seasonalHazards: string[];
  /** Base unloaded walking / canoe time, a→b and b→a, before weather or load. */
  costMinutes: { ab: number; ba: number };
  downstream: 'ab' | 'ba' | null;
}
export interface RegionGraph {
  nodes: RegionNode[];
  edges: RegionEdge[];
}
export interface CountyStats extends ReturnType<typeof import('./metrics.ts').countyMetrics> {
  cells: number;
  towns: number;
  fords: number;
  mills: number;
  springs: number;
  caves: number;
  anchors: number;
  roadFt: number;
}
export interface CountyNamedFeature {
  id: string;
  kind: 'creek' | 'valley';
  name: string;
  cells: number[];
  labelCell: number;
  /** Long, high-order reaches are candidates for map labels. */
  major: boolean;
}
export interface GeneratedCounty {
  recipe: ResolvedCountyRecipe;
  terrain: TerrainCell[];
  hydrology: WaterCell[];
  ecology: EcologyCell[];
  fae: FaeLayer;
  namedFeatures?: CountyNamedFeature[];
  settlements: CountySettlement[];
  graph: RegionGraph;
  report: { qa: QaResult[]; stats: CountyStats; hashes: Record<CountyLayer, string>; hash: string; deferred: string[] };
}
/** Q07 hook: future consulted polity records belong on the graph, never in terrain/ancestry rules. */
export interface CountyRegionContext {
  countyHash: string;
  settlementId: string;
  townName: string;
  cell: number;
  creekName: string;
  riverName: string;
  onRiver: boolean;
  elevationFt: number;
  geology: TerrainCell['geology'];
  aspect: Aspect;
  soil: TerrainCell['soil'];
  vegetation: Vegetation;
  faeIntensity: number;
  protected: boolean;
  springs: number[];
  bluffs: number[];
  neighbors: Array<{ id: string; name: string; cell: number }>;
  entrances: Array<{ edge: string; side: 'N' | 'E' | 'S' | 'W' }>;
}
