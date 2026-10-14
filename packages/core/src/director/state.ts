import type { Explain } from '../explain.ts';
import type { ActorId, PlaceId } from '../ids.ts';
import type { DirectorEvent } from './events.ts';
export type Foresight = 'off' | 'tiltable' | 'full';
/** D1: the Land Itself (budget 0, the regression default) and the Almanac are selectable. */
export type PersonalityId = 'land_itself' | 'almanac';
export const SELECTABLE_PERSONALITIES: readonly PersonalityId[] = ['land_itself', 'almanac'];
export interface DirectorSettings {
  personality: PersonalityId;
  foresight: Foresight;
}
export type Pacing = 'RELAX' | 'BUILD' | 'PEAK' | 'FADE';
export type ThreadStage = 'Latent' | 'Foreshadowed' | 'Active' | 'Climax' | 'Resolved' | 'Abandoned';
export interface ChekhovGun {
  planted_event: number;
  planted_at: number;
  salience: number;
  seen_by_player: boolean;
  fire_window: [number, number];
  fired: boolean;
  expired: boolean;
  fired_at: number | null;
}
export interface MemoryRef {
  owner: ActorId;
  memory: number;
  salience: number;
}
export interface Thread {
  id: number;
  pattern: string;
  actors: Record<string, ActorId>;
  places: number[];
  opened_at: number;
  last_advanced: number;
  stakes_pm: number;
  player_involvement_pm: number;
  open_questions: string[];
  state: ThreadStage;
  guns: ChekhovGun[];
  callbacks: MemoryRef[];
  interest: number;
  interest_explain: Explain | null;
  closed_at: number | null;
  last_fact: number;
  level: number;
}
export interface LedgerRecord {
  t: number;
  nudge: 'assessment';
  target: number | null;
  before: Pacing;
  after: Pacing;
  rationale: { threadId: number | null; tension: number };
  cost: 0;
  foresaw: false;
  foresight: Foresight;
  knowledge: 'omniscient';
  explain: Explain;
}
/** D1 nudges through bias hooks (DIRECTOR-PLAN §2). */
export type NudgeId = 'N4' | 'N6' | 'N8' | 'N9';
export type HookKind = 'carrier' | 'window' | 'option' | 'threshold';
/**
 * A published bias: data the owning module's own rule consults at the moment it decides.
 * `subject` is whose decision is tilted (null: anyone); `key` what it favours (a prop, a
 * household, a place; null with `toward_pc`: the PC's place or household at that moment).
 */
export interface Bias {
  id: number;
  /** The move's group (the first bias's id): one cost for all its participants. */
  group?: number;
  nudge: NudgeId;
  hook: HookKind;
  process: string;
  subject: number | null;
  key: number | null;
  toward_pc: boolean;
  /** Per mille (carrier, option), DC points (threshold) or minutes (window; signed). */
  amount: number;
  thread: number;
  move: string;
  tau: number;
  cost: number;
  placed_at: number;
  expires: number;
  charged: boolean;
  effects: number;
  last_effect?: string;
}
export interface NudgeRecord {
  t: number;
  nudge: NudgeId | 'mercy_wanted';
  bias: number | null;
  process: string;
  target: number | null;
  before: number | string;
  after: number | string;
  rationale: { threadId: number | null; tension: number; move: string; pacing: Pacing };
  cost: number;
  foresaw: boolean;
  knowledge: 'omniscient';
}
export interface NudgeTotals {
  placed: number;
  effects: number;
  charged: number;
  cost: number;
  expired_unused: number;
}
/** Planner state; absent for the Land Itself so its saves and hashes match D0. */
export interface PlanState {
  budget: number;
  reserved: number;
  next_bias: number;
  biases: Bias[];
  nudges: NudgeRecord[];
  nudges_compacted: number;
  totals: Record<string, NudgeTotals>;
  cycle: {
    target: number | null;
    build_started: number | null;
    seen_at_start: number;
    peaks: number;
    fizzles: number;
    builds: number;
  };
  spiral_days: number;
  mercy_wanted: number;
}
export interface MonthlyMetrics {
  hours: number;
  fast_sum: number;
  slow_sum: number;
  fast_max: number;
  slow_max: number;
  pacing: Record<Pacing, number>;
  dead_air_hours: number;
  dead_air_days: number;
  terms_sum: Record<string, number>;
}
export interface PatternMetrics {
  opened: number;
  resolved: number;
  abandoned: number;
}
export interface DirectorState {
  version: 1;
  settings: DirectorSettings;
  focus: ActorId | null;
  /** A held observation, not a provisions planner cache. Optional in pre-fix D0 saves. */
  survival_sample?: { actor: ActorId | null; day: number; at: number; value: number };
  retention?: {
    candidates: number;
    projection_high_water: number;
    filtered_projections: number;
    compacted_threads: number;
    capacity_evictions: number;
    compacted_unfired_guns: number;
    retired_through: number;
    retired_ids: number[];
  };
  prior_place: PlaceId | null;
  tau: number;
  tau_fast: number;
  tau_slow: number;
  fast_q16: number;
  slow_q16: number;
  pacing: Pacing;
  pacing_since: number;
  low_hours: number;
  last_hour: number;
  cursor: number;
  events: DirectorEvent[];
  event_seq: number;
  threads: Record<number, Thread>;
  ledger: LedgerRecord[];
  ledger_compacted: number;
  months: Record<string, MonthlyMetrics>;
  patterns: Record<string, PatternMetrics>;
  guns: { planted: number; seen: number; fired: number; expired: number; expired_unseen: number };
  dead_air: {
    hours: number;
    days: number;
    current_hours: number;
    longest_hours: number;
    day_hours: number;
    day_notable: boolean;
  };
  pattern_recency: Record<string, { id: number; at: number; previous_at: number | null }>;
  recent_resolutions: Array<{ pattern: string; at: number; count?: number }>;
  top_threads: Thread[];
  plan?: PlanState;
}
export function directorSettings(input: Partial<DirectorSettings> = {}): DirectorSettings {
  const personality = input.personality ?? 'land_itself';
  const foresight = input.foresight ?? 'tiltable';
  if (!SELECTABLE_PERSONALITIES.includes(personality))
    throw new Error(`director.personality must be one of ${SELECTABLE_PERSONALITIES.join(', ')} (others arrive in D2)`);
  if (!['off', 'tiltable', 'full'].includes(foresight)) throw new Error('Invalid director.foresight');
  return { personality, foresight };
}
export function createDirectorState(settings: Partial<DirectorSettings> = {}): DirectorState {
  return {
    version: 1,
    settings: directorSettings(settings),
    focus: null,
    prior_place: null,
    tau: 0,
    tau_fast: 0,
    tau_slow: 0,
    fast_q16: 0,
    slow_q16: 0,
    pacing: 'RELAX',
    pacing_since: 0,
    low_hours: 0,
    last_hour: -1,
    cursor: 0,
    events: [],
    event_seq: 0,
    threads: {},
    ledger: [],
    ledger_compacted: 0,
    months: {},
    patterns: {},
    guns: { planted: 0, seen: 0, fired: 0, expired: 0, expired_unseen: 0 },
    dead_air: { hours: 0, days: 0, current_hours: 0, longest_hours: 0, day_hours: 0, day_notable: false },
    pattern_recency: {},
    recent_resolutions: [],
    top_threads: [],
  };
}
