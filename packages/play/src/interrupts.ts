/** Shared worker/headless policy, 11 §1.6. Input must already be perspective-filtered.
 * Host wall-clock coalescing belongs outside this deterministic policy. */
import {
  type ActorId,
  type ContentBundle,
  type Event,
  needs,
  type PlaceId,
  provisions,
  psyche,
  social,
  type World,
} from '@coulee/core';
import { describeEvent } from './describe.ts';

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
  /** Why the game stopped, in plain words ("You are getting hungry"). */
  reason: string;
  /** The machine key of the event behind it ('needs.band_changed'), for logs and tests. */
  kind?: string;
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
  return {
    category,
    reason: event.kind,
    kind: event.kind,
    score,
    eventId: event.id,
    pause: category !== 'notable' || score >= 700,
  };
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
    if (e.kind === 'activity.journey' && e.data.actorId === pc && e.place !== undefined) place = e.place;
    if (e.kind === 'activity.moved' && e.data.actorId === pc) place = e.data.to;
    if (e.kind === 'fae.omen' && !e.data.witnesses.includes(pc)) continue;
    const role = e.roles.find((r) => r.actor === pc);
    const own =
      role &&
      ((e.visibility !== 'secret' && e.visibility !== 'inner') || role.role === 'agent' || role.role === 'subject');
    const visible =
      own ||
      (e.visibility === 'public' && e.place !== undefined && e.place === place) ||
      (e.visibility === 'witnessed' && e.place === place);
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
  // The policy decides on the event; the player is told in words, never in an event kind.
  return { ...classify(world, content, pc, e), reason: describeEvent(world, content, pc, e).text };
}
/**
 * Playtest r2: a wait stops only for what needs an answer or changes her situation. Talk among
 * others (greetings, slights, gossip, comfort, arrivals) never stops it; what is said or done to
 * her that asks nothing of her (a good day, a slight, a rumor) goes to the digest. A request
 * (it needs her answer), her own arrival somewhere, a blow, danger and a worsening body still stop.
 */
const background = (e: Event): Interrupt => ({
  category: 'background',
  reason: e.kind,
  kind: e.kind,
  eventId: e.id,
  score: 0,
  pause: false,
});

/** Said or done to the PC, asking nothing of her: the digest's "to you" lines. */
export function addressedToPC(content: ContentBundle, pc: ActorId, e: Event): boolean {
  if (e.kind === 'social.interaction')
    return (
      e.data.targetId === pc &&
      e.data.initiatorId !== pc &&
      !content.interactions[e.data.interactionId]?.tags.includes('violent')
    );
  if (e.kind === 'belief.transmitted') return e.data.listenerId === pc && e.data.speakerId !== pc;
  return false;
}

function classify(world: World, content: ContentBundle, pc: ActorId, e: Event): Interrupt {
  if (
    (e.kind === 'tactical.blow' && e.data.targetId === pc) ||
    e.kind === 'tactical.submission' ||
    e.kind === 'tactical.outcome' ||
    (e.kind === 'needs.combat_health' && e.data.actorId === pc)
  )
    return { ...background(e), category: 'danger', score: 900, pause: true };
  if (e.kind === 'tactical.danger') return { ...background(e), category: 'danger', score: 1000, pause: true };
  if (e.kind === 'tactical.action' && e.data.actorId === pc && e.data.phase === 'complete')
    return { ...background(e), category: 'action', score: 800, pause: true };
  if (e.kind === 'activity.journey' && e.data.actorId === pc && (e.data.kind === 'camp' || e.data.kind === 'stopped'))
    return { ...background(e), category: 'arrival', score: 80, pause: true };
  const participant =
    e.roles.some((r) => r.actor === pc && r.role !== 'witness') ||
    (e.kind === 'social.interaction' && (e.data.initiatorId === pc || e.data.targetId === pc));
  const strongTie = e.roles.some(
    (r) => social.areKin(world, pc, r.actor) || Math.abs(social.opinionOf(world, pc, r.actor).affection) >= 50,
  );
  const violent =
    e.kind === 'social.interaction' && !!content.interactions[e.data.interactionId]?.tags.includes('violent');
  // Others' talk and comings and goings are background, even a brawl between two others; so is
  // what is said to her that needs no answer. A blow aimed at her is not.
  if (e.kind === 'social.interaction' && e.data.initiatorId !== pc && !(violent && e.data.targetId === pc))
    return background(e);
  if (e.kind === 'belief.transmitted' && e.data.speakerId !== pc) return background(e);
  if (e.kind === 'activity.moved' && e.data.actorId !== pc) return background(e);
  if (e.kind === 'social.label_changed') return background(e);
  if (e.kind === 'needs.band_changed' && e.data.actorId === pc && e.data.layer !== 'debt') {
    const band = content.needs[e.data.needId]?.bands.find((b) => b.label === e.data.to);
    const orders = psyche.standingOrders(world, pc);
    const handled =
      needs.canAct(world, pc) &&
      ((e.data.needId === 'hunger' && orders.eat && provisions.foodToHand(world, content, pc)) ||
        (e.data.needId === 'thirst' && orders.drink && provisions.drinkingWater(world, content, pc) > 0) ||
        // A mild tiredness band: the sleep order puts her to bed when night comes.
        (e.data.needId === 'rest' && orders.sleep));
    if (band && band.below > 300 && handled)
      return { category: 'background', reason: e.kind, kind: e.kind, eventId: e.id, score: 0, pause: false };
  }
  return alertFor({
    id: e.id,
    notablePerson: strongTie,
    kind: e.kind,
    importance: e.importance,
    participant: e.roles.some((r) => r.actor === pc && r.role !== 'witness'),
    addressed:
      (e.kind === 'social.requested' && e.data.actorId === pc) ||
      (e.kind === 'social.interaction' && e.data.targetId === pc) ||
      (e.kind === 'belief.transmitted' &&
        e.data.listenerId === pc &&
        !!world.belief.props[e.data.propId]?.args.some((arg) => arg.kind === 'actor' && arg.id === pc)),
    danger:
      ((e.kind === 'needs.died' ||
        e.kind === 'needs.collapsed' ||
        (e.kind === 'needs.survival_check' && e.data.damage > 0)) &&
        e.roles.some((r) => r.actor === pc)) ||
      (e.kind === 'social.interaction' &&
        !!content.interactions[e.data.interactionId]?.tags.includes('hostile') &&
        (participant || e.place === world.actors[pc]?.placeId)),
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
