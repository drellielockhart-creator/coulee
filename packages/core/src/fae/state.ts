import type { Explain } from '../explain.ts';
import type { ActorId, PlaceId } from '../ids.ts';
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
export interface FaeState {
  episodes: Record<string, Episode>;
  thinning: Record<number, number>;
  fiShift: number;
  signatures: Record<number, string>;
  cooldowns: Record<string, number>;
  questions: Record<number, Question[]>;
  aura: Record<number, number>;
  incursion: Record<number, number>;
  enabled: boolean;
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
