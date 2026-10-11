/**
 * Psyche state (P7; ADR 0001 "Psyche-lite"). OWNER: module:psyche.
 *
 * Numbers: ego/superego/idAppetite 0..100, anxiety 0..1000, thought intensity 0..1000.
 */
import type { DefenseId, TraitId } from '../content.ts';
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
  urge: Urge;
  /** 0..1000, after trait voice weighting. */
  intensity: number;
  /** "I could eat a horse", "The Sabbath must be kept". */
  label: string;
  source: ModuleId;
  bornAt: GameMinute;
  /** Intensity lost per hour if not renewed. */
  decayPerHour: number;
  reasons: ExplainTerm[];
  /** 10 §4.1 identity (from UrgeProposal). */
  drive?: string;
  norm?: string;
  speaker?: string;
}

export interface DefenseRecord {
  defense: DefenseId;
  at: GameMinute;
  targetId: ActorId | null;
  eventId: EventId;
}

export interface ActorPsyche {
  ego: number;
  superego: number;
  idAppetite: number;
  anxiety: number;
  /** Live thoughts (insertion order). */
  thoughts: Thought[];
  /** Result of this hour's ego arbitration; null if none yet. */
  chosen: ChosenUrge | null;
  /** Jungian persona label (public mask), or null. */
  persona: string | null;
  /** Disowned trait ids (Jungian shadow). */
  shadow: TraitId[];
  /** Most recent defenses, newest last (capped by psyche). */
  recentDefenses: DefenseRecord[];
}

export interface PsycheState {
  counters: { thought: number };
  byActor: Table<ActorId, ActorPsyche>;
}

export function createPsycheState(): PsycheState {
  return { counters: { thought: 0 }, byActor: {} };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Seed psyche numbers from the scenario plus trait shifts (TraitDef.psyche). */
export function initPsycheState(world: World, ctx: InitContext): void {
  const seeds = new Map(ctx.scenario.actors.map((a) => [a.key, a]));
  for (const id of idsOf<ActorId>(world.actors)) {
    const actor = mustGet(world.actors, id, 'actor');
    const seed = seeds.get(actor.key);
    let ego = seed?.psyche.ego ?? 50;
    let superego = seed?.psyche.superego ?? 50;
    let idAppetite = seed?.psyche.id_appetite ?? 50;
    for (const t of actor.traits) {
      const def = ctx.content.traits[t];
      if (!def) continue;
      ego += def.psyche.ego;
      superego += def.psyche.superego;
      idAppetite += def.psyche.id_appetite;
    }
    world.psyche.byActor[id] = {
      ego: clamp(ego, 0, 100),
      superego: clamp(superego, 0, 100),
      idAppetite: clamp(idAppetite, 0, 100),
      anxiety: seed?.anxiety ?? 0,
      thoughts: [],
      chosen: null,
      persona: seed?.persona ?? null,
      shadow: [...(seed?.shadow ?? [])],
      recentDefenses: [],
    };
  }
}
