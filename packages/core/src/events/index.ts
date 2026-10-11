/**
 * The full Event union and the append-only log. FOUNDATION-OWNED.
 * Modules never edit this file: they add kinds to their own `src/<module>/events.ts`.
 */
import type { ActivityEvent } from '../activity/events.ts';
import type { BeliefEvent } from '../belief/events.ts';
import type { ChronicleEvent } from '../chronicle/events.ts';
import { normalizeExplain } from '../explain.ts';
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

/**
 * Bounded in-memory retention (ADR 0001 + P6). The log is append-only and ids are dense forever;
 * what the World *holds* is a rolling window. Every event is still emitted in order to the sim's
 * sink (the CLI streams the full log to events.jsonl), and the chronicle has sifted everything
 * before it is dropped. Replay needs only seed + content hash + the `core.command` events.
 */
export interface LogRetention {
  /** Events without importance are kept this many game-minutes after they happen. */
  routineMinutes: number;
  /** Events with importance >= `notableImportance` are kept this long. */
  notableMinutes: number;
  notableImportance: number;
}

/** Two days of everything, two weeks of the notable: enough for the UI's recent views on a phone. */
export const DEFAULT_LOG_RETENTION: LogRetention = {
  routineMinutes: 2 * 24 * 60,
  notableMinutes: 14 * 24 * 60,
  notableImportance: 20,
};

export interface EventLog {
  /** Last allocated EventId; ids start at 1 and increase by 1. */
  lastId: number;
  /** Append-only, in id order; the retained window only (see `retention`). Never mutated after append. */
  events: Event[];
  /** null = keep every event in memory (tests, short debug runs). Optional for older saves (= keep all). */
  retention?: LogRetention | null;
  /** How many events have been dropped from memory so far. */
  dropped?: number;
}

export function emptyLog(retention: LogRetention | null = DEFAULT_LOG_RETENTION): EventLog {
  return { lastId: 0, events: [], retention: retention === null ? null : { ...retention }, dropped: 0 };
}

/**
 * Drop events older than the retention window (called by the sim loop once a day, after the
 * chronicle has sifted). Pure function of the log and `now`, so it is deterministic.
 */
export function trimLog(log: EventLog, now: GameMinute): void {
  const r = log.retention;
  if (!r) return;
  const routineCut = now - r.routineMinutes;
  const notableCut = now - r.notableMinutes;
  const first = log.events[0];
  if (!first || first.t >= Math.max(routineCut, notableCut)) return;
  const kept: Event[] = [];
  for (const e of log.events) {
    if (e.t >= routineCut || (e.t >= notableCut && (e.importance ?? 0) >= r.notableImportance)) kept.push(e);
  }
  log.dropped = (log.dropped ?? 0) + (log.events.length - kept.length);
  log.events = kept;
}

/** Detach plain event data recursively from mutable simulation state and commands. */
function copyData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copyData) as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) out[key] = copyData((value as Record<string, unknown>)[key]);
    return out as T;
  }
  return value;
}

/** Append an event (used by SimContext.emit; systems call ctx.emit, not this). */
export function appendEvent(log: EventLog, input: EventInput, now: GameMinute): EventId {
  const id = asEventId(log.lastId + 1);
  log.lastId = id;
  input = copyData(input);
  // Foundation guard: Explains on events are integers without negative zero (P1 + invariant 2).
  if (input.explain) normalizeExplain(input.explain);
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

/**
 * Events with id > afterId, in order. Ids are dense while every event is retained; after a trim
 * the retained events may have gaps, so seek from the end (callers ask for recent events).
 */
export function eventsSince(log: EventLog, afterId: number): Event[] {
  const ev = log.events;
  let i = ev.length;
  while (i > 0 && (ev[i - 1]?.id as number) > afterId) i--;
  return ev.slice(i);
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
