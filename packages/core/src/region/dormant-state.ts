import type { ActorId, HouseholdId } from '../ids.ts';

/** Saved policy: changing a device never changes the simulated county. */
export interface DormantPolicy {
  enabled: boolean;
  enterMinutes: number;
  exitMinutes: number;
  dwellMinutes: number;
  hourlyRadiusMinutes: number;
  hourlySoftCap: number;
  /** Annual opportunities per 1000 eligible people; explicit priors, not fitted T2 rates. */
  birthsPerThousand: number;
  deathsPerThousand: number;
  marriagesPerThousand: number;
  movesPerThousand: number;
  feudsPerThousand: number;
}
export const DORMANT_POLICY: DormantPolicy = {
  enabled: true,
  enterMinutes: 1440,
  exitMinutes: 1200,
  dwellMinutes: 1440,
  hourlyRadiusMinutes: 360,
  hourlySoftCap: 400,
  birthsPerThousand: 190,
  deathsPerThousand: 20,
  marriagesPerThousand: 20,
  movesPerThousand: 30,
  feudsPerThousand: 2800,
};
export interface DormantFact {
  key: string;
  at: number;
  site: string;
  kind: 'birth' | 'death' | 'marriage' | 'move' | 'debt' | 'default' | 'harvest' | 'pantry' | 'feud';
  actors: ActorId[];
  text: string;
  amount: number;
  /** Receipts are authoritative, not the rolling log or a current memory id. */
  hydrated: boolean;
  chance?: { annualPerThousand: number; draw: number; denominator: number };
  trace?: { kind: 'absence' | 'notice' | 'ledger'; placeId: import('../ids.ts').PlaceId | null; at: number };
}
export interface DormantSite {
  since: number;
  through: number;
  mindsThrough: number;
  actors: ActorId[];
  households: HouseholdId[];
  /** Frozen entry dispositions used by the aggregate, independent of lazy mind hydration. */
  dispositions: Record<number, Array<{ targetId: ActorId; affection: number; trust: number; hadGrudge: boolean }>>;
  consumedKcal: number;
  shortageKcal: number;
  producedKcal: number;
}
export interface DormantState {
  version: 1;
  policy: DormantPolicy;
  sites: Record<string, DormantSite>;
  facts: DormantFact[];
  /** Saved dwell clock separate from the T1->T2 grace. */
  belowSince: Record<string, number>;
}
