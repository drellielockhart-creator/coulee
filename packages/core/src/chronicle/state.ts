/**
 * Chronicle state: structured entries sifted from the event log (05 §9, §11).
 * OWNER: module:chronicle.
 */
import type { ActorId, ChronicleEntryId, EventId, PlaceId } from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import type { GameMinute } from '../time.ts';
import type { World } from '../world.ts';

export type ChronicleVoice = 'journal' | 'paper' | 'almanac' | 'ballad' | 'ledger';

/**
 * Knowledge basis (05 §11.1): during a run the player sees only what their character knows
 * or what is public; the omniscient epilogue reveals the rest.
 */
export type KnowledgeBasis = 'public' | 'witnessed' | 'heard' | 'omniscient';

export interface ChronicleEntry {
  id: ChronicleEntryId;
  t: GameMinute;
  tEnd: GameMinute;
  voice: ChronicleVoice;
  /** Optional headline (paper voice). */
  headline: string | null;
  text: string;
  /** 0..100 */
  importance: number;
  /** −100..100 */
  valence: number;
  actorIds: ActorId[];
  placeIds: PlaceId[];
  sourceEventIds: EventId[];
  pattern: string | null;
  templateId: string | null;
  knowledge: KnowledgeBasis;
}

export interface ChronicleState {
  counters: { entry: number };
  /** Last event id processed by sifting. */
  cursor: number;
  entries: ChronicleEntry[];
}

export function createChronicleState(): ChronicleState {
  return { counters: { entry: 0 }, cursor: 0, entries: [] };
}

export function initChronicleState(_world: World, _ctx: InitContext): void {
  // Nothing to seed. module:chronicle may seed threads from scenario tensions.
}
