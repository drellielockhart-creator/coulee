/**
 * Psyche state (P7; ADR 0001 "Psyche-lite"; design-docs/10-psyche.md §14.1). OWNER: module:psyche.
 *
 * Numbers: ego/superego/idAppetite 0..100, drive weights and norm strengths 0..100, anxiety
 * 0..1000 (= real + neur + moral, Freud's three anxieties, 10 §6), thought intensity 0..1000
 * (the doc's 0..100 read ×10, 10 §14.5 #1), defense style 0..100 (default 10), shadow charge
 * 0..100 per disowned trait. Everything is an integer.
 */
import type { DefenseId, TraitId } from '../content.ts';
import { DEFENSES, VALUES } from '../content.ts';
import type { ExplainTerm } from '../explain.ts';
import { type ActorId, type EventId, idsOf, mustGet, type Table, type ThoughtId } from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import type { GameMinute } from '../time.ts';
import type { ChosenUrge, ModuleId, Urge, Voice } from '../urge.ts';
import type { World } from '../world.ts';

export interface Thought {
  id: ThoughtId;
  /** Id (appetite, impulse, fear) or Superego (conscience, duty); 'command' = player will. */
  voice: Voice | 'command';
  /**
   * What the thought is about. For stance 'for' the thing it wants; for stance 'against' the
   * option it opposes (a prohibition: "Not one glass").
   */
  urge: Urge;
  /** 0..1000, after trait voice weighting. */
  intensity: number;
  /** "I could eat a horse", "The Sabbath must be kept". */
  label: string;
  source: ModuleId;
  bornAt: GameMinute;
  /** Intensity lost per hour if not renewed. */
  decayPerHour: number;
  /** Named integer terms summing to `intensity` (P1: why the thought is this loud). */
  reasons: ExplainTerm[];
  /** 10 §4.1 identity (from UrgeProposal). */
  drive?: string;
  norm?: string;
  speaker?: string;
  // ---- additive (module:psyche finish) ----
  /** Merge key: same-key thoughts merge (max) instead of stacking (10 §4.2 caps). */
  key?: string;
  /**
   * 'for' (default) supports `urge`; 'against' opposes it and any option carrying `against`
   * tags; 'aside' is voiced but takes no side (a defense's masked residue).
   */
  stance?: 'for' | 'against' | 'aside';
  /** Tags this thought opposes (10 §5.2: "incompatible by tag"). */
  against?: string[];
  /** Whom the thought is about (rage at, longing for, owed to). */
  targetId?: ActorId;
  /** The voiced line shown in the Inner Voices panel (Id first person; Superego quoted). */
  line?: string;
  /** Consecutive arbitrations this thought has lost (habituation, 10 §6). */
  frustrated?: number;
  /** Set when a defense produced or disguised this thought (10 §4.1, §7). Hidden until Insight. */
  maskedBy?: DefenseId;
}

export interface DefenseRecord {
  defense: DefenseId;
  at: GameMinute;
  targetId: ActorId | null;
  eventId: EventId;
}

export interface AnxietyPools {
  /** Realistic anxiety: threats in the world (fear). */
  real: number;
  /** Neurotic anxiety: the Id's frustrated appetites. */
  neur: number;
  /** Moral anxiety: guilt and shame, the Superego's frustrated demands. */
  moral: number;
}

export interface ActorPsyche {
  /** Absent means psyche; preserves existing NPC state hashes. */
  agency?: import('./agency.ts').AgencyState;
  agencyMode?: import('./agency.ts').AgencyMode;
  standingOrders?: import('./agency.ts').StandingOrders;
  ego: number;
  superego: number;
  idAppetite: number;
  /** 0..1000; always equals anxSrc.real + anxSrc.neur + anxSrc.moral. */
  anxiety: number;
  /** Live thoughts (insertion order; capped at THOUGHT_CAP by intensity). */
  thoughts: Thought[];
  /** Result of this hour's ego arbitration; null if none yet. */
  chosen: ChosenUrge | null;
  /** Jungian persona label (public mask), or null. */
  persona: string | null;
  /** Disowned trait ids (Jungian shadow): the traits with charge ≥ SHADOW_MIN. */
  shadow: TraitId[];
  /** Most recent defenses, newest last (capped by psyche). */
  recentDefenses: DefenseRecord[];
  // ---- additive (module:psyche finish) ----
  /** The three anxieties (10 §6). */
  anxSrc: AnxietyPools;
  /** Drive weights 0..100 by drive id (10 §3.2). */
  drives: Record<string, number>;
  /** Norm strengths 0..100 by norm id (10 §3.3). */
  norms: Record<string, number>;
  /** Defense style 0..100 by defense id (10 §7.1). Firing adds +2; relaxes to `styleBase` weekly. */
  defenseStyle: Partial<Record<DefenseId, number>>;
  styleBase: Partial<Record<DefenseId, number>>;
  /** Shadow charge 0..100 by trait id (10 §8.2). */
  shadowCharge: Record<string, number>;
  /** Traits the Persona presents in public (10 §8.1); empty = no mask, the actor shows as they are. */
  personaTraits: TraitId[];
  /** Mask discipline 0..100 (Discretion lives here). */
  personaControl: number;
  /** Insight tier 0..3 (10 §8.5): own defenses up to this maturity tier are visible to self. */
  insight: number;
  /** Consecutive frustrated arbitrations per drive (10 §5.3 sublimation, §7 triggers). */
  frustration: Record<string, number>;
  /** Forbidden wishes toward one target, by drive (10 §7.2 reaction formation: repeated 3+). */
  wishes: Record<string, { targetId: ActorId; count: number }>;
  /** Last act against conscience (10 §7.2 rationalization). */
  lastTransgression: { at: GameMinute; norm: string; targetId: ActorId | null } | null;
  /**
   * Anger stored against a blocked object (10 §7.2 displacement): `amount` is the relief still
   * owed, paid only when a displaced act lands (psyche/api defenseActLanded) before `until`.
   */
  displaced: {
    amount: number;
    objectId: ActorId | null;
    drive: string;
    until?: GameMinute;
    /** The safer person the anger is stored for (social runs the act when they meet). */
    targetId?: ActorId;
    /** The masked line the defense left behind. */
    line?: string;
  } | null;
  lastDefenseAt: GameMinute | null;
  /** Traits acquired from habitual defenses (style ≥ 70: Suspicious, Zealot; 10 §7.1). */
  acquired: TraitId[];
  /** How the last arbitration went: 'plain' | 'compromise' | 'sublimation' | 'impulse' | 'command'. */
  lastMode: string;
}

export interface PsycheState {
  standingCapabilities?: import('../content.ts').ContentBundle['standingCapabilities'];
  counters: {
    thought: number;
    // ---- additive ----
    defenses?: number;
    compromises?: number;
    sublimations?: number;
    impulses?: number;
    commands?: number;
  };
  byActor: Table<ActorId, ActorPsyche>;
}

export function createPsycheState(): PsycheState {
  return {
    counters: { thought: 0, defenses: 0, compromises: 0, sublimations: 0, impulses: 0, commands: 0 },
    byActor: {},
  };
}

/** Shadow charge at which a trait counts as disowned (and can be projected, 10 §7.2). */
export const SHADOW_MIN = 30;
/** Scenario-listed shadow traits start at this charge (10 §14.5 #5). */
export const SHADOW_SEED = 60;
/** Default defense style (10 §7.1). */
export const STYLE_DEFAULT = 10;

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** An empty psyche with neutral numbers (tests, runtime-created actors). */
export function blankPsyche(): ActorPsyche {
  return {
    ego: 50,
    superego: 50,
    idAppetite: 50,
    anxiety: 0,
    thoughts: [],
    chosen: null,
    persona: null,
    shadow: [],
    recentDefenses: [],
    anxSrc: { real: 0, neur: 0, moral: 0 },
    drives: {},
    norms: {},
    defenseStyle: {},
    styleBase: {},
    shadowCharge: {},
    personaTraits: [],
    personaControl: 50,
    insight: 0,
    frustration: {},
    wishes: {},
    lastTransgression: null,
    displaced: null,
    lastDefenseAt: null,
    acquired: [],
    lastMode: 'plain',
  };
}

/**
 * Split a starting anxiety across the three pools. Explicit scenario pools win; otherwise it
 * splits by temperament (real 50 : neur idAppetite : moral superego), remainder to real.
 */
export function splitAnxiety(total: number, idAppetite: number, superego: number): AnxietyPools {
  const wReal = 50;
  const wNeur = Math.max(0, idAppetite);
  const wMoral = Math.max(0, superego);
  const sum = wReal + wNeur + wMoral;
  const neur = Math.floor((total * wNeur) / sum);
  const moral = Math.floor((total * wMoral) / sum);
  return { real: total - neur - moral, neur, moral };
}

/** Recompute the `shadow` list (charge ≥ SHADOW_MIN), sorted by id. */
export function refreshShadowList(p: ActorPsyche): void {
  const out: string[] = [];
  for (const k of Object.keys(p.shadowCharge).sort()) if ((p.shadowCharge[k] ?? 0) >= SHADOW_MIN) out.push(k);
  p.shadow = out;
}

/**
 * Seed psyche numbers from the scenario plus trait shifts (TraitDef.psyche, .drives, .norms,
 * .defenses), drives and norms from the 04 Values (10 §3.3), anxiety pools, defense style,
 * Persona and Shadow (10 §8.1–8.2), and Insight (10 §8.5).
 */
export function initPsycheState(world: World, ctx: InitContext): void {
  world.psyche.standingCapabilities = Object.fromEntries(
    Object.keys(ctx.content.standingCapabilities ?? {})
      .sort()
      .flatMap((id) => {
        const d = ctx.content.standingCapabilities[id];
        return d ? [[id, { ...d, item_tags: [...d.item_tags] }]] : [];
      }),
  );
  const seeds = new Map(ctx.scenario.actors.map((a) => [a.key, a]));
  const driveIds = Object.keys(ctx.content.drives ?? {}).sort();
  const normIds = Object.keys(ctx.content.norms ?? {}).sort();
  for (const id of idsOf<ActorId>(world.actors)) {
    const actor = mustGet(world.actors, id, 'actor');
    const seed = seeds.get(actor.key);
    let ego = seed?.psyche.ego ?? 50;
    let superego = seed?.psyche.superego ?? 50;
    let idAppetite = seed?.psyche.id_appetite ?? 50;
    const traitDefs = actor.traits.map((t) => ctx.content.traits[t]).filter((d) => d !== undefined);
    for (const def of traitDefs) {
      ego += def.psyche.ego;
      superego += def.psyche.superego;
      idAppetite += def.psyche.id_appetite;
    }
    ego = clamp(ego, 0, 100);
    superego = clamp(superego, 0, 100);
    idAppetite = clamp(idAppetite, 0, 100);

    const drives: Record<string, number> = {};
    for (const d of driveIds) {
      const def = ctx.content.drives[d];
      if (!def) continue;
      let w = 50;
      for (const v of VALUES) w += (actor.values[v] ?? 0) * (def.values[v] ?? 0);
      const override = seed?.drives[d];
      if (override !== undefined) w = override;
      for (const t of traitDefs) w += t.drives[d] ?? 0;
      drives[d] = clamp(w, 0, 100);
    }
    const norms: Record<string, number> = {};
    for (const n of normIds) {
      const def = ctx.content.norms[n];
      if (!def) continue;
      let s = def.base;
      for (const v of VALUES) s += (actor.values[v] ?? 0) * (def.values[v] ?? 0);
      const override = seed?.norms[n];
      if (override !== undefined) s = override;
      for (const t of traitDefs) s += t.norms[n] ?? 0;
      norms[n] = clamp(s, 0, 100);
    }

    // Style = 10 × Π(trait pct / 100), computed in per-mille fixed point (10 §14.5 #6).
    const styleBase: Partial<Record<DefenseId, number>> = {};
    for (const d of DEFENSES) {
      let s = STYLE_DEFAULT * 1000;
      for (const t of traitDefs) {
        const pct = t.defenses[d];
        if (pct !== undefined) s = Math.floor((s * pct) / 100);
      }
      const override = seed?.defense_style[d];
      styleBase[d] = override !== undefined ? override : clamp(Math.floor((s + 500) / 1000), 0, 100);
    }

    const anxiety = clamp(seed?.anxiety ?? 0, 0, 1000);
    const pools = seed?.anxiety_pools
      ? { real: seed.anxiety_pools.real, neur: seed.anxiety_pools.neur, moral: seed.anxiety_pools.moral }
      : splitAnxiety(anxiety, idAppetite, superego);

    const shadowCharge: Record<string, number> = {};
    for (const t of seed?.shadow ?? []) shadowCharge[t] = SHADOW_SEED;

    const discretion = actor.values.discretion ?? 0;
    const p: ActorPsyche = {
      ...blankPsyche(),
      ...(seed?.agency_mode ? { agencyMode: seed.agency_mode } : {}),
      ...(seed?.standing_orders
        ? { standingOrders: { ...seed.standing_orders, activities: [...seed.standing_orders.activities] } }
        : {}),
      ego,
      superego,
      idAppetite,
      anxiety: pools.real + pools.neur + pools.moral,
      anxSrc: pools,
      persona: seed?.persona ?? null,
      drives,
      norms,
      defenseStyle: { ...styleBase },
      styleBase,
      shadowCharge,
      personaTraits: [...(seed?.persona_traits ?? [])],
      personaControl: clamp(seed?.persona_control ?? 50 + 15 * discretion, 0, 100),
      insight: clamp(seed?.insight ?? 0, 0, 3),
    };
    refreshShadowList(p);
    world.psyche.byActor[id] = p;
  }
}
