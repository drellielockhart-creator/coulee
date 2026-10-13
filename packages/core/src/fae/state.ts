import type { Explain } from '../explain.ts';
import type { ActorId, HouseholdId, ItemId, PlaceId } from '../ids.ts';
export type Window = 'dawn' | 'noon' | 'dusk' | 'midnight';
export interface Snapshot {
  placeId: PlaceId;
  day: number;
  window: Window;
  at: number;
  fi: number;
  trueRate: number;
  lookRate: number;
  families: string[];
  moon: string;
  rain: boolean;
  fog?: boolean;
  thunder?: boolean;
  firstSnow?: boolean;
  ironG?: number;
  familyWeights?: number[];
  bells: boolean;
  leadPlaces: PlaceId[];
  leadActors: ActorId[];
}
export interface Observer {
  noticed: boolean;
  read: boolean;
  reading: string | null;
  notice: Explain;
  interpretation: Explain | null;
  at: number;
}
export interface Episode {
  id: string;
  snapshot: Snapshot;
  defId: string;
  family: string;
  truth: 'fae' | 'mundane';
  strength: number;
  end: number;
  traceEnd: number;
  text: string;
  plain: string;
  variant: number;
  lead: { kind: 'trace' | 'place' | 'actor' | 'nothing'; placeId: PlaceId; actorId?: ActorId };
  observers: Record<number, Observer>;
  attempts: Record<number, { at: number; found: boolean; explain: Explain }>;
  followups?: Record<number, { at: number; text: string }>;
  /** Window days (0 = the episode's own) each actor has tried, one attempt per window. */
  tries?: Record<number, number[]>;
  witnessed: boolean;
  eventId: number | null;
  propId?: import('../ids.ts').PropId;
}
export interface Question {
  signId: string;
  placeId: PlaceId;
  text: string;
  openedAt: number;
  closedAt: number | null;
  evidence: string | null;
}
/**
 * A charm's fae record (13 §5.1): TRUE function and per-instance state. The stack, its place and
 * its condition stay with module:provisions; this holds only what fae owns. `boundTo`, the draw
 * ledger and cases are `omniscient` until earned.
 */
export interface CharmState {
  itemId: ItemId;
  defId: string;
  virtue: number;
  /** Fae vigor 0..100: iron sours it; below the def's floor it stops recharging; at 0 it is ordinary. */
  vigor: number;
  /** Whom it chose (its first keeper). Omniscient. */
  boundTo: ActorId | null;
  /** Who keeps it as the town would say: the finder, the borrower while lent, a buyer. */
  custodianId: ActorId | null;
  /** Tied shut tonight: material snapshot and access revision survive save/load. */
  tie: { at: number; by: ActorId; units: number; revision?: number; contents?: string } | null;
  lastUseAt: number | null;
  /** Day index of the last dawn this charm drew. */
  lastDrawDay: number;
  lastRechargeAt: number | null;
  rechargeBlockedUntil: number;
  /** Porridge and butter left by it overnight (13 §5.8 recharge). */
  offering: { at: number; by: ActorId; placeId: PlaceId } | null;
  /** Minutes of rain exposure into the current hem block (container_dry). */
  exposure: number;
  /** Units moved per source (`h<household>` or `p<place>`): the truth for the epilogue. */
  drawLedger: Record<string, number>;
  /** Strings: none ship in slice 1b. */
  stringIds: string[];
  found: { at: number; by: ActorId; placeId: PlaceId } | null;
  /** Lying unfound at a reservoir place (13 §6.3). */
  reservoir: {
    placeId: PlaceId;
    from: number;
    findPermille: number;
    noticeDc: number;
    gathering: boolean;
    tags: string[];
    lastFindSeason: number;
  } | null;
  /** Attachment 0..100 per holder (13 §5.6): a preference, never a veto. */
  attachment: Record<number, number>;
  /** Attachment bookkeeping: week index and gain booked that week; last day of contact or benefit. */
  attachWeek: Record<number, { week: number; gained: number; lastBenefitDay: number }>;
  /** Last day each actor witnessed a use (at most one witnessed use per actor-day). */
  witnessed: Record<number, number>;
  /** Desire D 0..100 per actor, evaluated on triggers (13 §5.6). */
  desire: Record<number, number>;
  /** Day the town last heard it thanked (unthanked). */
  thankedAt: number | null;
  /** Resolution, once disposed of: buried, destroyed, returned, sold, dormant. */
  disposed: { kind: 'buried' | 'destroyed' | 'returned'; at: number; by: ActorId; placeId: PlaceId } | null;
  /** True once iron has soured it to nothing: ordinary forever. */
  inert: boolean;
  /** Actors who saw it lying at its reservoir place but left it there (held for orders). */
  noticedBy?: ActorId[];
  /** Who was shown it, until when (a granted look lets them study it). */
  access?: Record<number, number>;
  /** Last time each actor asked to see or borrow it (a refusal is not asked again for days). */
  asked?: Record<number, number>;
  /** Households each actor has told what they found (13 §6.9). */
  told?: Record<number, HouseholdId[]>;
  /** Keepers warned that it takes (by whom, when): kept_drawing needs a warning first. */
  warned?: Record<number, { at: number; by: ActorId }>;
  /** Holder:misfortune pairs already refuted (once each). */
  refuted?: Record<string, number>;
  // ---- refusal costs (wave 6; design-docs/00 decisions 2026-10-12) ----
  /** Duty-guilt per keeper for turning neighbors away (0..600; decays slowly; lending relieves it). */
  guilt?: Record<number, number>;
  /** Per asker: times turned away, when last, and how many grudges it has founded so far. */
  refusals?: Record<number, { n: number; last: number; grudges: number; by?: ActorId }>;
  /** Private truth of each taking; discovery and accusations never read the thief as evidence. */
  thefts?: CharmTheft[];
}

export interface CharmTheft {
  at: number;
  thiefId: ActorId;
  victimId: ActorId;
  householdId: HouseholdId;
  placeId: PlaceId;
  eventId: import('../ids.ts').EventId;
  witnesses: ActorId[];
  discoveredAt: number | null;
  misfortuneId: number | null;
  lastCheckDay: number;
  /** Refused askers remembered by this keeper before the loss (not later keepers' refusals). */
  refused: ActorId[];
}

/**
 * Fae's private record of a discrepancy (13 §5.2), one per (charm, source, def). Nothing is
 * known to anyone until `checkShortfall` finds it.
 */
export interface DrawCase {
  id: string;
  itemId: ItemId;
  /** Physical bins under this household case, with separate material accounting. */
  bins?: Record<
    string,
    { source: DrawCase['source']; placeId: PlaceId; undiscovered: number; discovered: number; lastAt: number }
  >;
  source: { kind: 'household'; id: HouseholdId } | { kind: 'place'; id: PlaceId };
  /** The household that would miss it (the store's or mill's owner, or the household itself). */
  householdId: HouseholdId | null;
  placeId: PlaceId;
  def: string;
  undiscovered: number;
  discovered: number;
  firstAt: number;
  lastAt: number;
  misfortuneId: number | null;
  lastEvidenceAt: number | null;
  accepted: boolean;
  /** Units repaid by the keeper (restitution in kind or cash at 5 cents a pound). */
  restituted?: number;
  /** Who has tried to follow the loss back, when (−1: traced). */
  tracedBy?: Record<number, number>;
  /** A visible trace until this time after a draw; who has rolled for it, by draw day. */
  traceUntil: number;
  traceRolls: Record<number, number>;
}

/** What one actor has verified about a charm (13 §5.3): minute learned, by kind. */
export interface CharmKnowledge {
  construction?: number;
  effects?: number;
  counterparty?: number;
  observed?: number;
  /** Source households learned (traced draw cases), by household id. */
  sources?: number[];
  /** Outstanding units learned by this actor; private later draws never alter this report. */
  losses?: Record<number, number>;
}

/** Recorded protection forfeits, scoped to the counterparty (01 §4.5). */
export interface Forfeit {
  kind: 'trespass' | 'bargain' | 'hospitality' | 'tribute' | 'unclaimed' | 'hunt_road';
  counterparty: string;
  until: number;
}
export interface FaeState {
  /** Explicit fae actors; ancestry alone never makes a mortal a Fair Folk actor. */
  faeActors?: Record<number, boolean>;
  forfeits?: Record<number, Forfeit[]>;
  episodes: Record<string, Episode>;
  drift?: Record<number, number>;
  snowSeason?: number;
  firstSnowDay?: number;
  thinning: Record<number, number>;
  fiShift: number;
  signatures: Record<number, string>;
  cooldowns: Record<string, number>;
  questions: Record<number, Question[]>;
  aura: Record<number, number>;
  incursion: Record<number, number>;
  enabled: boolean;
  /** Charm records by item id (slice 1b). Absent until a charm exists, so older saves keep their hash. */
  charms?: Record<number, CharmState>;
  drawCases?: Record<string, DrawCase>;
  /** Verified charm knowledge per actor, by item id. */
  known?: Record<number, Record<number, CharmKnowledge>>;
  /** Last stock count per household (counting oftener after a loss). */
  counts?: Record<number, number>;
  /**
   * Causal ablations for experiments (13 §8.2 #5): set by a harness at creation, never by play.
   * `noWitnesses` prevents disclosure; `loanDuty` overrides a borrower's duty to return.
   */
  ablation?: { noWitnesses?: boolean; loanDuty?: number };
}
export const createFaeState = (): FaeState => ({
  episodes: {},
  thinning: {},
  fiShift: 0,
  signatures: {},
  cooldowns: {},
  questions: {},
  aura: {},
  incursion: {},
  enabled: true,
});
