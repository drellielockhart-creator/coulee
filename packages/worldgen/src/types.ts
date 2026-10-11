import type { PlaceDef, ScenarioDef, SiteDef } from '@coulee/content/schema';

export const GEN_VERSION = 2;
export interface TownRecipe {
  genVersion: number;
  seed: number;
  preset?: 'coulee' | 'river';
  constraints?: { townName?: string; onRiver?: boolean; farmsteads?: number };
}
export interface QaResult {
  check: string;
  pass: boolean;
  detail: string;
}
export interface GenReport {
  recipe: TownRecipe;
  /** Pure generation cannot measure a clock. The CLI fills these using stage boundaries. */
  layers: Array<{ layer: string; elapsedMs: number | null }>;
  decisions: string[];
  qa: QaResult[];
  playtest: {
    days: number;
    hash: string;
    alive: number;
    population: number;
    deprived: number;
    shortages: number;
  } | null;
}
export interface GeneratedTown {
  scenario: ScenarioDef;
  site: SiteDef;
  places: PlaceDef[];
  report: GenReport;
}
