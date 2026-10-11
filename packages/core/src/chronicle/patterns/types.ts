/**
 * Pattern detector contracts (05 §9.2). A pattern owns "threads": keyed buffers of the facts
 * that could belong to one story. The engine asks the pattern which threads a fact feeds,
 * how far each thread's story has got (a level) as seen by each audience, and what to say.
 * OWNER: module:chronicle.
 */
import type { ContentBundle } from '../../content.ts';
import type { SimContext } from '../../sim/context.ts';
import type { World } from '../../world.ts';
import type { Fact } from '../facts.ts';
import type { PatternParams } from '../params.ts';
import type { Bindings, TemplateIndex } from '../prose.ts';
import type { ChronicleThread, ThreadFact } from '../state.ts';

/** Who is reading: the public, the player character, or the omniscient epilogue. */
export type View = 'pub' | 'pc' | 'all';

export interface DetectCtx {
  world: World;
  ctx: SimContext;
  content: ContentBundle;
  /** The player character's actor id, 0 if none. */
  pcId: number;
  /** Template index (built once per sifting pass). */
  index(): TemplateIndex;
  params(id: string, dfltImportance: number): PatternParams;
}

/** A fact's membership in a thread. */
export interface Accept {
  key: string;
  tf: ThreadFact;
  actors?: readonly number[];
  households?: readonly number[];
  tags?: Record<string, string>;
}

export interface PatternDef {
  id: string;
  /** Coarse subject for the UI filter. */
  topic: string;
  /** Default base importance. */
  importance: number;
  /**
   * From this level on, the story is public regardless of how each event was seen: a town
   * does not need to witness every whisper to know it is being whispered. 0 = never.
   */
  publicFrom?: number;
  /** The omniscient view keeps its own entries even when the public one has told the story. */
  alwaysAll?: boolean;
  /** Once the thread has told its story, single-event entries for its facts are redundant. */
  suppressSingles?: boolean;
  /** Which threads does this fact feed? */
  accept(f: Fact, dc: DetectCtx, p: PatternParams): Accept[];
  /** How far the story has got, as seen by `facts` (0 = no match yet, 1.. = milestones). */
  level(facts: ThreadFact[], th: ChronicleThread, dc: DetectCtx, p: PatternParams, view: View): number;
  /** Pattern-specific bindings for rendering at `level`. */
  bind(facts: ThreadFact[], th: ChronicleThread, level: number, dc: DetectCtx, p: PatternParams, view: View): Bindings;
  /** Importance 0..100 of the entry at `level`; 0 means "do not write". */
  importanceAt(level: number, th: ChronicleThread, p: PatternParams): number;
  /** Valence −100..100 of the story. */
  valence?(th: ChronicleThread): number;
  /** Quiet long enough to close? */
  stale?(th: ChronicleThread, dc: DetectCtx, p: PatternParams): boolean;
  /** Write a closing entry (`<id>.closed`) when a thread that reached this level closes. */
  closingLevel?: number;
  /** Write a ballad too when a public entry's importance reaches the notability ballad_min. */
  balladLevel?: number;
  /** Daily upkeep (counters, synthetic facts). Runs at the start of each game day. */
  daily?(dc: DetectCtx, p: PatternParams): Accept[];
}
