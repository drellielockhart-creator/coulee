/**
 * The full Event union and the append-only log. FOUNDATION-OWNED.
 * Modules never edit this file: they add kinds to their own `src/<module>/events.ts`.
 */
import type { ActivityEvent } from '../activity/events.ts';
import type { BeliefEvent } from '../belief/events.ts';
import type { ChronicleEvent } from '../chronicle/events.ts';
import { asEventId, type EventId } from '../ids.ts';
import type { ItemsEvent } from '../items/events.ts';
import type { NeedsEvent } from '../needs/events.ts';
import type { ProvisionsEvent } from '../provisions/events.ts';
import type { PsycheEvent } from '../psyche/events.ts';
import type { SocialEvent } from '../social/events.ts';
import type { GameMinute } from '../time.ts';
import type { DistributiveOmit, EventRole, Visibility } from './base.ts';
import type { CoreEvent } from './core-events.ts';

export type { DistributiveOmit, EventBase, EventOf, EventRole, EventRoleKind, Visibility } from './base.ts';
export type { CoreEvent } from './core-events.ts';

export type Event =
  | CoreEvent
  | NeedsEvent
  | ActivityEvent
  | PsycheEvent
  | SocialEvent
  | BeliefEvent
  | ItemsEvent
  | ProvisionsEvent
  | ChronicleEvent;

export type EventKind = Event['kind'];
export type EventOfKind<K extends EventKind> = Extract<Event, { kind: K }>;

/**
 * What a system passes to `ctx.emit(...)`: an event without id, with t/roles/visibility
 * optional (defaults: t = start of current hour, roles = [], visibility = 'public').
 */
export type EventInput = DistributiveOmit<Event, 'id' | 't' | 'roles' | 'visibility'> & {
  t?: GameMinute;
  roles?: EventRole[];
  visibility?: Visibility;
};

export interface EventLog {
  /** Last allocated EventId; ids start at 1 and increase by 1. */
  lastId: number;
  /** Append-only, in id order. Never mutated after append. */
  events: Event[];
}

export function emptyLog(): EventLog {
  return { lastId: 0, events: [] };
}

/** Append an event (used by SimContext.emit; systems call ctx.emit, not this). */
export function appendEvent(log: EventLog, input: EventInput, now: GameMinute): EventId {
  const id = asEventId(log.lastId + 1);
  log.lastId = id;
  const ev = {
    ...input,
    id,
    t: input.t ?? now,
    roles: input.roles ?? [],
    visibility: input.visibility ?? 'public',
  } as Event;
  log.events.push(ev);
  return id;
}

/** Events with id > afterId, in order. O(log n) seek since ids are dense. */
export function eventsSince(log: EventLog, afterId: number): Event[] {
  const first = log.events[0];
  if (!first) return [];
  const start = Math.max(0, afterId - (first.id as number) + 1);
  return log.events.slice(start);
}

export function isKind<K extends EventKind>(e: Event, kind: K): e is EventOfKind<K> {
  return e.kind === kind;
}

export function eventsOfKind<K extends EventKind>(events: readonly Event[], kind: K): EventOfKind<K>[] {
  return events.filter((e): e is EventOfKind<K> => e.kind === kind);
}

/** Module prefix of a kind: 'social.insult' -> 'social'. */
export function kindModule(kind: string): string {
  const i = kind.indexOf('.');
  return i < 0 ? kind : kind.slice(0, i);
}
