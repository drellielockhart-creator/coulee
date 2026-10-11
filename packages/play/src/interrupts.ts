/** Shared worker/headless policy, 11 §1.6. Input must already be perspective-filtered.
 * Host wall-clock coalescing belongs outside this deterministic policy. */
import type { ActorId, ContentBundle, Event, PlaceId, World } from '@coulee/core';

export interface AlertEvent {
  id: number;
  kind: string;
  importance?: number;
  participant?: boolean;
  notablePerson?: boolean;
  firstLearned?: boolean;
  danger?: boolean;
  addressed?: boolean;
  arrival?: boolean;
  worseVital?: boolean;
}
export interface Interrupt {
  category: string;
  reason: string;
  score: number;
  eventId?: number;
  pause: boolean;
}
export function alertFor(event: AlertEvent): Interrupt {
  const category = event.danger
    ? 'danger'
    : event.addressed
      ? 'summons'
      : event.worseVital
        ? 'vitals'
        : event.arrival
          ? 'arrival'
          : 'notable';
  const score = Math.min(
    1000,
    (event.importance ?? 0) * 10 +
      (event.participant ? 250 : 0) +
      (event.notablePerson ? 150 : 0) +
      (event.firstLearned ? 100 : 0),
  );
  return { category, reason: event.kind, score, eventId: event.id, pause: category !== 'notable' || score >= 700 };
}
export function provisionsAlert(
  beforeFood: number,
  food: number,
  beforeFuel: number | null,
  fuel: number | null,
): Interrupt | null {
  if ((beforeFood >= 10 && food < 10) || (beforeFuel !== null && beforeFuel >= 10 && fuel !== null && fuel < 10))
    return {
      category: 'provisions',
      reason: 'Less than one day of food or cooking fuel remains',
      score: 700,
      pause: true,
    };
  return null;
}

/**
 * The events of one step that the PC perceives (fair play, 04 §12.6): her own, public events at
 * her place, and arrivals she witnesses. `priorPlace` is where she stood before the step; her own
 * moves update it as the events are read. Headless (PlaySession) and the web worker both call
 * this, so they stop on the same events (ADR 0002 §3).
 */
export function perceivedEvents(events: readonly Event[], pc: ActorId, priorPlace: PlaceId | undefined): Event[] {
  let place = priorPlace;
  const seen: Event[] = [];
  for (const e of events) {
    if (e.kind === 'activity.moved' && e.data.actorId === pc) place = e.data.to;
    const role = e.roles.find((r) => r.actor === pc);
    const own =
      role &&
      ((e.visibility !== 'secret' && e.visibility !== 'inner') || role.role === 'agent' || role.role === 'subject');
    const visible =
      own ||
      (e.visibility === 'public' && e.place !== undefined && e.place === place) ||
      (e.kind === 'activity.moved' && (e.visibility === 'witnessed' || e.visibility === 'public') && e.place === place);
    if (
      visible &&
      e.kind !== 'psyche.defense' &&
      !(e.kind === 'belief.tell' && !e.data.noticed && e.data.targetId !== pc)
    )
      seen.push(e);
  }
  return seen;
}

/** Classify one perceived event for the alert policy (danger, summons, vitals, arrival). */
export function alertForEvent(world: World, content: ContentBundle, pc: ActorId, e: Event): Interrupt {
  return alertFor({
    id: e.id,
    kind: e.kind,
    importance: e.importance,
    participant: e.roles.some((r) => r.actor === pc && r.role !== 'witness'),
    addressed: e.kind === 'social.interaction' && e.data.targetId === pc,
    danger:
      (String(e.kind) === 'core.actor_died' && e.roles.some((r) => r.actor === pc)) ||
      (e.kind === 'social.interaction' &&
        !!content.interactions[e.data.interactionId]?.tags.includes('hostile') &&
        (e.data.targetId === pc || e.data.initiatorId === pc)),
    arrival:
      e.kind === 'activity.moved' && (e.data.actorId === pc || (world.chronicle.notoriety[e.data.actorId] ?? 0) >= 50),
    worseVital:
      e.kind === 'needs.band_changed' &&
      e.data.actorId === pc &&
      (() => {
        const def = content.needs[e.data.needId];
        if (def?.kind !== 'physical') return false;
        if (e.data.layer === 'debt') {
          const threshold = (label: string) => def.debt?.bands.find((b) => b.label === label)?.at_least ?? 0;
          return threshold(e.data.to) > threshold(e.data.from);
        }
        const threshold = (label: string) => def.bands.find((b) => b.label === label)?.below ?? 1001;
        return threshold(e.data.to) < threshold(e.data.from);
      })(),
  });
}
