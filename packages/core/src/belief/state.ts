/**
 * Belief state: propositions, beliefs with credence + evidence, rumors (lineages), Figures,
 * Grudges, misfortunes, community suspicion & escalation (04 §5, §6.3, §8, §9).
 * OWNER: module:belief.
 *
 * Integer scales: credence 0..100 (+ Q8 logit carry −127..127), evidence weight Q8,
 * juiciness/notoriety/grudge intensity 0..100, heat unbounded int, consensus 0..1000,
 * misfortune pressure M 0..1000 per mille, rung 0..3 (M1 scope of the 0..6 ladder).
 */
import type { PredicateId } from '../content.ts';
import {
  type ActorId,
  asFigureId,
  asGrudgeId,
  type BeliefId,
  type EventId,
  type FigureId,
  type GrudgeId,
  type HouseholdId,
  type MemoryId,
  nextId,
  type PlaceId,
  type PropId,
  type RumorId,
  type Table,
} from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import type { GameMinute } from '../time.ts';
import type { World } from '../world.ts';
import { seedBeliefs } from './seed.ts';

export type PropArg =
  | { kind: 'actor'; id: ActorId }
  | { kind: 'household'; id: HouseholdId }
  | { kind: 'figure'; id: FigureId }
  | { kind: 'place'; id: PlaceId }
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number }
  /** A runtime misfortune record (`world.belief.misfortunes`). */
  | { kind: 'misfortune'; id: number };

export interface Prop {
  id: PropId;
  pred: PredicateId;
  args: PropArg[];
  /** Canonical key 'witch(a:3)' used for interning. */
  key: string;
  /** Cached predicate metadata for the content-free suspicion query. */
  suspicious?: boolean;
}

/** 04 §5.2 evidence types (+ `dream`, `defense` per this revision). */
export type EvidenceType =
  | 'observation'
  | 'overheard'
  | 'statement'
  | 'document'
  | 'physical'
  | 'inference'
  | 'confession'
  | 'ordeal'
  | 'lie_received'
  | 'confabulation'
  | 'implant'
  | 'seed'
  | 'dream'
  | 'defense';

export interface Evidence {
  type: EvidenceType;
  /** +1 supports, −1 refutes. */
  dir: 1 | -1;
  memoryId: MemoryId | null;
  sourceId: ActorId | null;
  /** Weight in Q8 (256 = 1.0) after trust, plausibility and novelty. */
  weight: number;
  at: GameMinute;
  /** Rumor lineage for novelty discounting (04 §5.3). */
  rumorId: RumorId | null;
  /** For type 'defense': which defense produced it (omniscient, 04 §3.6). */
  defense?: string;
}

export interface Belief {
  id: BeliefId;
  holderId: ActorId;
  propId: PropId;
  credence: number;
  /** Capped (EVIDENCE_CAP), strongest kept. */
  evidence: Evidence[];
  firstHeard: GameMinute;
  firstSourceId: ActorId | null;
  /** Asserted publicly (harder to retract; decays at half rate). */
  voiced: boolean;
  /** Secret or deliberately not repeated (04 §3.5). */
  conceal: boolean;
  /** Q8 logit residual below one credence point (04 §5.3), −127..127. */
  carry: number;
  /** The rumor lineage this holder associates with the belief (heard it in, or started it). */
  rumorId: RumorId | null;
  /** Rumor id -> how many tellings from that lineage were heard (novelty; never evicted). */
  echoes: Record<number, number>;
  /** Whom the holder has told (the "unknown_to_L" estimate, 04 §8.3), capped. */
  toldTo: ActorId[];
  /** Last time evidence arrived (for fading). */
  lastEvidenceAt: GameMinute;
  /** Has crossed credence 50 at some point (belief.formed emitted once). */
  formed: boolean;
  /** `10` denial: supporting evidence counts at pct% until `until` (04 §5.3). */
  clamp?: { pct: number; until: GameMinute; banked: number };
}

export interface RumorVariant {
  propId: PropId;
  parentPropId: PropId | null;
  mutation: string | null;
  firstCarrierId: ActorId | null;
}

export interface Rumor {
  id: RumorId;
  rootPropId: PropId;
  originId: ActorId | null;
  bornAt: GameMinute;
  variants: RumorVariant[];
  /** 0..1000 per mille (content juiciness ×10 at birth). */
  juiciness: number;
  /** Number of tellings so far. */
  tellings: number;
  lastToldAt: GameMinute;
}

export interface Figure {
  id: FigureId;
  key: string;
  name: string;
  description: string;
  /** Ground truth (never read by actors' decision code). */
  trulyId: ActorId | null;
  /** 0..100: max(base, share of adults who think of this figure). */
  notoriety: number;
  /** Authored floor for notoriety. */
  baseNotoriety: number;
  /** Actors the community's Consensus has attached this figure to (`belief.figure_attached`). */
  attachedIds: ActorId[];
  /** The archetype tellers fit to a person (scenario `fits`; Specification, 04 §8.5). */
  fits?: { sex?: 'female' | 'male'; min_age: number; traits_any: string[]; roles_any: string[] };
}

export type GrudgeTarget =
  | { kind: 'actor'; id: ActorId }
  | { kind: 'household'; id: HouseholdId }
  | { kind: 'figure'; id: FigureId }
  /** "Whoever did this": an unknown culprit of one misfortune (04 §5.4). */
  | { kind: 'unknown'; misfortuneId: number };

export type GrudgeAim = 'restitution' | 'apology' | 'humiliation' | 'expulsion' | 'harm' | 'death';

export interface Grudge {
  id: GrudgeId;
  holderId: ActorId;
  target: GrudgeTarget;
  founding: Array<{ kind: 'memory' | 'belief' | 'seed' | 'misfortune' | 'grudge'; id: number | null; label: string }>;
  intensity: number;
  aim: GrudgeAim;
  patienceDays: number;
  public: boolean;
  inheritedFrom: GrudgeId | null;
  since: GameMinute;
  /** Milli-points of intensity below 1 (fixed-point decay). */
  residue: number;
  /** C12: uncanny grudges keep a floor; 'none' never decays (fae holders). */
  decay: 'normal' | 'floor' | 'none';
  decayFloor: number;
  /** Founded by a defense (projection, displacement, reaction formation): Heat ×125/100. */
  viaDefense: string | null;
  lastRehearsedAt: GameMinute;
  /** The unknown culprit this grudge was once aimed at, after attribution found a face. */
  retargetedFrom: number | null;
}

/** One rung change in a process's history. */
export interface PersecutionStep {
  rung: number;
  at: GameMinute;
  catalystId: ActorId | null;
  eventId: EventId | null;
}

/** Escalation process on one target (04 §9.2). M1 scope: rungs 0..3. */
export interface Persecution {
  target: GrudgeTarget;
  rung: number;
  since: GameMinute;
  heat: number;
  /** 0..1000 */
  consensus: number;
  leaderIds: ActorId[];
  /** Process id (stable). */
  id: number;
  /** What the target is believed guilty of or to be (04 §9.2 charge set), strongest first. */
  charges: PropId[];
  /** Some believed charge is an act (lifts the identity-only cap). */
  actAttributed: boolean;
  /** Distinct holders of any charge above 40. */
  holdersOver40: number;
  history: PersecutionStep[];
  /** Last time something fed the process (new holders, heat rising, an attributed misfortune). */
  lastFuelAt: GameMinute;
  /** A Catalyst ready to take the next step (proposed as an urge until taken or stale). */
  pending: { rung: number; catalystId: ActorId; score: number; since: GameMinute } | null;
  /** Actors complying with a shunning (rung 3). */
  shunnerIds: ActorId[];
  /** A Revealed event fired for a kind charge (12 §7.6). */
  revealed: boolean;
  /** Day index of the last stub-mode volition roll (one per day). */
  lastFallbackDay: number;
}

/** A misfortune that struck a household (04 §3.3, §5.4). */
export interface Misfortune {
  id: number;
  kindId: string;
  householdId: HouseholdId;
  victimId: ActorId | null;
  at: GameMinute;
  placeId: PlaceId | null;
  /** Ground truth: who really did it (null = natural). Read only by epilogue/god views. */
  culpritId: ActorId | null;
  /** The `befell(household, misfortune)` news prop. */
  propId: PropId;
  eventId: EventId | null;
  /** Per-believer attribution results (04 §5.4), latest per holder. */
  attributions: Array<{ holderId: ActorId; leader: GrudgeTarget | null; sharePermille: number; at: GameMinute }>;
}

/** Commons row (04 §5.5): prevalence among adults of credence > 50. */
export interface CommonsRow {
  prevalence: number;
  assumed: boolean;
  since: GameMinute;
}

export interface BeliefState {
  counters: {
    prop: number;
    belief: number;
    rumor: number;
    figure: number;
    grudge: number;
    misfortune: number;
    process: number;
  };
  props: Table<PropId, Prop>;
  propByKey: Record<string, PropId>;
  beliefs: Table<BeliefId, Belief>;
  /** holder -> belief ids (insertion order). */
  beliefsByHolder: Table<ActorId, BeliefId[]>;
  rumors: Table<RumorId, Rumor>;
  figures: Table<FigureId, Figure>;
  grudges: Table<GrudgeId, Grudge>;
  persecutions: Persecution[];
  /** Settlement misfortune pressure M, 0..1000 (04 §3.3). */
  misfortune: number;
  /** Milli residue of M for fixed-point decay. */
  misfortuneResidue: number;
  misfortunes: Table<number, Misfortune>;
  /** prop id -> Commons row (04 §5.5), recomputed daily. */
  commons: Record<number, CommonsRow>;
  /**
   * Concealed actors who know they showed a tell, and keep away from its occasion until this
   * minute (tells.toml `wary_days`): the faekin who skips the Sabbath bell. Absent until first.
   */
  wary?: Table<ActorId, { until: GameMinute; tellId: string }>;
}

export function createBeliefState(): BeliefState {
  return {
    counters: { prop: 0, belief: 0, rumor: 0, figure: 0, grudge: 0, misfortune: 0, process: 0 },
    props: {},
    propByKey: {},
    beliefs: {},
    beliefsByHolder: {},
    rumors: {},
    figures: {},
    grudges: {},
    persecutions: [],
    misfortune: 0,
    misfortuneResidue: 0,
    misfortunes: {},
    commons: {},
  };
}

/** A fresh grudge row with defaults for the bookkeeping fields. */
export function makeGrudge(
  world: World,
  g: Pick<Grudge, 'holderId' | 'target' | 'founding' | 'intensity' | 'aim' | 'public' | 'since'> &
    Partial<Pick<Grudge, 'inheritedFrom' | 'decay' | 'decayFloor' | 'viaDefense' | 'patienceDays'>>,
): Grudge {
  const id = asGrudgeId(nextId(world.belief.counters, 'grudge'));
  const row: Grudge = {
    id,
    holderId: g.holderId,
    target: g.target,
    founding: g.founding,
    intensity: Math.max(0, Math.min(100, Math.round(g.intensity))),
    aim: g.aim,
    patienceDays: g.patienceDays ?? 30,
    public: g.public,
    inheritedFrom: g.inheritedFrom ?? null,
    since: g.since,
    residue: 0,
    decay: g.decay ?? 'normal',
    decayFloor: g.decayFloor ?? 0,
    viaDefense: g.viaDefense ?? null,
    lastRehearsedAt: g.since,
    retargetedFrom: null,
  };
  world.belief.grudges[id] = row;
  return row;
}

/**
 * Seed from the scenario: figures, grudges, beliefs, secrets, past misfortunes, and the
 * self-knowledge of concealed peoples (12 §7.1: the Secret `Is(self, kind)`; household knows).
 */
export function initBeliefState(world: World, ctx: InitContext): void {
  const st = world.belief;
  const figureByKey: Record<string, FigureId> = {};
  for (const f of ctx.scenario.figures) {
    const id = asFigureId(nextId(st.counters, 'figure'));
    figureByKey[f.key] = id;
    st.figures[id] = {
      id,
      key: f.key,
      name: f.name,
      description: f.description,
      trulyId: f.truly !== undefined ? (world.index.actorByKey[f.truly] ?? null) : null,
      notoriety: f.notoriety,
      baseNotoriety: f.notoriety,
      attachedIds: [],
      ...(f.fits ? { fits: { ...f.fits, traits_any: [...f.fits.traits_any], roles_any: [...f.fits.roles_any] } } : {}),
    };
  }
  for (const g of ctx.scenario.grudges) {
    const holderId = world.index.actorByKey[g.holder];
    if (holderId === undefined) continue;
    const actor = world.index.actorByKey[g.target];
    const household = world.index.householdByKey[g.target];
    const figure = figureByKey[g.target];
    const target: GrudgeTarget | null =
      actor !== undefined
        ? { kind: 'actor', id: actor }
        : household !== undefined
          ? { kind: 'household', id: household }
          : figure !== undefined
            ? { kind: 'figure', id: figure }
            : null;
    if (!target) continue;
    makeGrudge(world, {
      holderId,
      target,
      founding: [{ kind: 'seed', id: null, label: g.founding }],
      intensity: g.intensity,
      aim: g.aim,
      public: g.public,
      since: ctx.now,
    });
  }
  seedBeliefs(world, ctx, figureByKey);
}
