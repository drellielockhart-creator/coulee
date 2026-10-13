import type { ActorId, PlaceId } from '../ids.ts';
import type { Basis } from '../psyche/api.ts';
import type { TimedEntry } from '../sim/heap.ts';
export interface Cell {
  x: number;
  y: number;
}
export interface Position extends Cell {
  site: string;
  level: 0;
}
export interface Action {
  token: number;
  kind:
    | 'move'
    | 'guard'
    | 'attack'
    | 'grapple'
    | 'escape'
    | 'yield'
    | 'accept'
    | 'parley'
    | 'flee'
    | 'stabilize'
    | 'reaction';
  phase: 'windup' | 'recovery';
  basis: Basis;
  destination?: Cell;
  targetId?: ActorId;
  cancelled?: boolean;
  /** Hostility already underway when this windup began; peace invalidates it. */
  brawlId?: number;
  fromReaction?: boolean;
  reactionCount?: number;
  due: number;
  recoverUntil: number;
}
export interface Participant {
  readyAt: number;
  action: Action | null;
  unready: boolean;
  guarding: boolean;
  submitted?: boolean;
  reactionAt?: number;
  fled?: boolean;
  reaction?: { remaining: number; until: number; nextAt: number; basis: Basis };
}
export interface Brawl {
  id: number;
  a: ActorId;
  b: ActorId;
  startedAt: number;
  attempts: number;
  stamped?: boolean;
  endedAt?: number;
  outcome?: 'submission' | 'knockout' | 'flight' | 'peace' | 'incapacity';
  witnesses: ActorId[];
}
export interface Entry extends TimedEntry {
  actorId: ActorId;
  kind: 'commit' | 'recover';
  token: number;
}
export interface HourFrame {
  start: number;
  through: number;
  end: number;
  phase: 'open' | 'settling' | 'settled';
  temperatures?: Record<number, number>;
  commands: import('../command.ts').Command[];
  /** Actors owned by T0 for this frame, retained after scene exit. */
  live: ActorId[];
  rates: Record<number, Record<string, number>>;
  activeRates: Record<number, Record<string, number>>;
  carries: Record<number, Record<string, number>>;
  elapsed: Record<number, number>;
}
export interface TacticalState {
  brawls?: Brawl[];
  /** Saved marker: this scene has hosted a fight or a cancelled hostile declaration. */
  engaged?: boolean;
  grapples?: Array<{ holder: ActorId; target: ActorId; stage: 1 | 2 | 3 }>;
  version: 1;
  sceneId: string;
  placeId: PlaceId;
  active: boolean;
  enteredAt: number;
  quietSince: number;
  participants: Record<number, Participant>;
  heap: Entry[];
  seq: number;
  commandSeq: number;
  pendingCommands: import('../command.ts').Command[];
  declarations: Record<number, number>;
  reservations: Record<string, { actorId: ActorId; token: number }>;
  frame?: HourFrame;
  /** Saved latch acknowledged only by an explicit resume/advance Command. */
  pause: { instant: number; eventId: number } | null;
}
