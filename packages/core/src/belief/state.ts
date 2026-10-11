/**
 * Belief state: propositions, beliefs with credence + evidence, rumors (lineages), Figures,
 * Grudges, community suspicion & escalation (04 §5, §8, §9). OWNER: module:belief.
 *
 * Integer scales: credence 0..100, evidence weight in hundredths, juiciness/notoriety/
 * grudge intensity 0..100, heat unbounded int, consensus 0..1000, rung 0..3 (M2 scope).
 */
import type { PredicateId } from '../content.ts';
import {
  type ActorId,
  asFigureId,
  asGrudgeId,
  type BeliefId,
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

export type PropArg =
  | { kind: 'actor'; id: ActorId }
  | { kind: 'household'; id: HouseholdId }
  | { kind: 'figure'; id: FigureId }
  | { kind: 'place'; id: PlaceId }
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number };

export interface Prop {
  id: PropId;
  pred: PredicateId;
  args: PropArg[];
  /** Canonical key 'witch(a:3)' used for interning. */
  key: string;
}

/** 04 §5.2 evidence types. */
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
  | 'seed';

export interface Evidence {
  type: EvidenceType;
  /** +1 supports, −1 refutes. */
  dir: 1 | -1;
  memoryId: MemoryId | null;
  sourceId: ActorId | null;
  /** Weight in hundredths (2.5 -> 250). */
  weight: number;
  at: GameMinute;
  /** Rumor lineage for novelty discounting (04 §5.3). */
  rumorId: RumorId | null;
}

export interface Belief {
  id: BeliefId;
  holderId: ActorId;
  propId: PropId;
  credence: number;
  /** Capped, top-k by weight. */
  evidence: Evidence[];
  firstHeard: GameMinute;
  firstSourceId: ActorId | null;
  /** Asserted publicly (harder to retract). */
  voiced: boolean;
  /** Secret or deliberately not repeated (04 §3.5). */
  conceal: boolean;
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
  juiciness: number;
}

export interface Figure {
  id: FigureId;
  key: string;
  name: string;
  description: string;
  /** Ground truth (never read by actors' decision code). */
  trulyId: ActorId | null;
  notoriety: number;
}

export type GrudgeTarget =
  | { kind: 'actor'; id: ActorId }
  | { kind: 'household'; id: HouseholdId }
  | { kind: 'figure'; id: FigureId };

export interface Grudge {
  id: GrudgeId;
  holderId: ActorId;
  target: GrudgeTarget;
  founding: Array<{ kind: 'memory' | 'belief' | 'seed'; id: number | null; label: string }>;
  intensity: number;
  aim: 'restitution' | 'apology' | 'humiliation' | 'expulsion' | 'harm' | 'death';
  patienceDays: number;
  public: boolean;
  inheritedFrom: GrudgeId | null;
  since: GameMinute;
}

/** Escalation process on one target (04 §9.2), M2 scope rungs 0..3. */
export interface Persecution {
  target: GrudgeTarget;
  rung: number;
  since: GameMinute;
  heat: number;
  /** 0..1000 */
  consensus: number;
  leaderIds: ActorId[];
}

export interface BeliefState {
  counters: { prop: number; belief: number; rumor: number; figure: number; grudge: number };
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
}

export function createBeliefState(): BeliefState {
  return {
    counters: { prop: 0, belief: 0, rumor: 0, figure: 0, grudge: 0 },
    props: {},
    propByKey: {},
    beliefs: {},
    beliefsByHolder: {},
    rumors: {},
    figures: {},
    grudges: {},
    persecutions: [],
    misfortune: 0,
  };
}

/**
 * Seed from the scenario: figures and grudges here; beliefs/secrets are interned by the
 * belief module's own seeding (STUB below leaves them to module:belief, which must map
 * PropSeed args via the predicate's arg kinds).
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
    const id = asGrudgeId(nextId(st.counters, 'grudge'));
    st.grudges[id] = {
      id,
      holderId,
      target,
      founding: [{ kind: 'seed', id: null, label: g.founding }],
      intensity: g.intensity,
      aim: g.aim,
      patienceDays: 30,
      public: g.public,
      inheritedFrom: null,
      since: ctx.now,
    };
  }
  // STUB: module:belief seeds ctx.scenario.beliefs / ctx.scenario.secrets here, and the
  // concealed-people suspicion priors (shadow_faekin: everyone else's belief is absent).
}
