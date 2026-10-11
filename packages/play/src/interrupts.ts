/** Shared worker/headless policy, 11 §1.6. Input must already be perspective-filtered.
 * Host wall-clock coalescing belongs outside this deterministic policy. */
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
