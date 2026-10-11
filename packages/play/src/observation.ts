import {
  type ActorId,
  activity,
  belief,
  calendarAt,
  chronicle,
  type Event,
  type Explain,
  items,
  needs,
  provisions,
  psyche,
  type Sim,
  social,
  timeView,
  toViewModel,
} from '@coulee/core';
import { availableActions } from './actions.ts';
export type ObservationMode = 'fair' | 'god';
export function knownExplain(e: Explain | undefined, pc: ActorId, mode: ObservationMode): Explain | null {
  if (!e) return null;
  if (
    mode !== 'god' &&
    !(
      e.knowledge === 'public' ||
      (e.knowledge === 'self' && e.subjects[0] === pc) ||
      (e.knowledge === 'participants' && e.subjects.includes(pc))
    )
  )
    return null;
  return {
    ...e,
    ...(e.children
      ? {
          children: e.children.flatMap((child) => {
            const x = knownExplain(child, pc, mode);
            return x ? [x] : [];
          }),
        }
      : {}),
  };
}
export function eventView(e: Event, pc: ActorId, mode: ObservationMode) {
  const explain = knownExplain(e.explain, pc, mode);
  let summary: string = e.kind;
  if (e.kind === 'social.interaction') summary = `${e.data.label}: ${e.data.success ? 'success' : 'failure'}`;
  if (e.kind === 'belief.formed') summary = `Heard: ${e.data.text}`;
  if (e.kind === 'provisions.cash_transfer') summary = `${e.data.reason}: $${(e.data.cents / 100).toFixed(2)}`;
  if (e.kind === 'provisions.meal') summary = `Meal: ${e.data.kcal} kcal (${e.data.hot ? 'hot' : 'cold'})`;
  if (e.kind === 'provisions.purchase')
    summary = `Bought ${e.data.qty} ${e.data.defId} for $${(e.data.priceCents / 100).toFixed(2)}`;
  if (e.kind === 'provisions.sale')
    summary = `Sold ${e.data.qty} ${e.data.defId} for $${(e.data.priceCents / 100).toFixed(2)}`;
  if (e.kind === 'provisions.command_rejected') summary = e.data.reason;
  if (e.kind === 'activity.moved') summary = `Travel arrival at place #${e.data.to}`;
  return { id: e.id, t: e.t, kind: e.kind, summary, explain };
}
export type KnownEvent = ReturnType<typeof eventView>;
export function observation(
  sim: Sim,
  pc: ActorId,
  known: readonly number[],
  mode: ObservationMode,
  knowledge: readonly KnownEvent[] = [],
  journalLimit = 12,
) {
  const { world: w, content: c } = sim;
  const a = w.actors[pc];
  if (!a) throw new Error('Missing player');
  const opts = { perspective: pc, omniscient: mode === 'god', includeExplain: true, recentChronicle: 12 };
  const mind = psyche.viewPsycheActor(w, c, pc, opts);
  const voice = (v: string) =>
    ({ id: 'Appetite', superego: 'Conscience', command: 'Self-Command', ego: 'Self-Command' })[v] ?? v;
  const knownSet = new Set(known);
  const journalIds = new Set<number>(
    w.chronicle.entries
      .filter(
        (e) =>
          mode === 'god' ||
          (e.knowledge !== 'omniscient' &&
            (e.authorId === undefined || e.authorId === null || e.authorId === pc) &&
            (e.knownBy?.includes(pc) ||
              (e.sourceEventIds.length > 0 && e.sourceEventIds.every((id) => knownSet.has(id))) ||
              (e.kind === 'almanac' && e.actorIds.length === 0))),
      )
      .map((e) => e.id),
  );
  const journal = chronicle
    .viewChronicleGlobal(w, c, { ...opts, recentChronicle: w.chronicle.entries.length })
    .recent.filter((e) => journalIds.has(e.id))
    .slice(journalLimit > 0 ? -journalLimit : 0);
  const publicActor = (id: ActorId) => {
    const actor = w.actors[id];
    if (!actor) throw new Error('Missing actor');
    return {
      id,
      name: `${actor.name.given} ${actor.name.family}`.trim(),
      people: c.peoples[actor.presentsAsId]?.name ?? actor.presentsAsId,
      activity: activity.viewActivityActor(w, c, id, opts).verb,
    };
  };
  const ownProvisions = provisions.viewProvisionsActor(w, c, pc, opts);
  return {
    mode,
    time: timeView(w.time),
    scenario: w.meta.scenarioId,
    weather: {
      temperatureF: provisions.airTempF(calendarAt(w.time)),
      raining: provisions.isRaining(w.meta.seed, calendarAt(w.time)),
      description: provisions.isRaining(w.meta.seed, calendarAt(w.time)) ? 'Rain' : 'Dry',
    },
    place: { id: a.placeId, name: w.places[a.placeId]?.name ?? 'Unknown', kind: w.places[a.placeId]?.kind ?? '' },
    self: {
      id: pc,
      name: `${a.name.given} ${a.name.family}`.trim(),
      alive: a.alive,
      needs: needs.viewNeedsActor(w, c, pc, opts),
      activity: activity.viewActivityActor(w, c, pc, opts),
      mind: {
        ...mind,
        thoughts: mind.thoughts.map((t) => ({ ...t, voice: voice(t.voice) })),
        chosen: mind.chosen
          ? {
              ...mind.chosen,
              voice: voice(mind.chosen.voice),
              explain: knownExplain(mind.chosen.explain ?? undefined, pc, mode),
            }
          : null,
      },
      social: social.viewSocialActor(w, c, pc, opts),
      belief: belief.viewBeliefActor(w, c, pc, opts),
      inventory: items.viewItemsActor(w, c, pc, opts),
      provisions: ownProvisions,
    },
    present: Object.values(w.actors)
      .filter((other) => other.id !== pc && other.placeId === a.placeId)
      .map((other) => publicActor(other.id)),
    places: Object.values(w.places).map((p) => ({ id: p.id, name: p.name, kind: p.kind })),
    store: provisions.viewProvisionsPlace(w, c, a.placeId, opts),
    events: mode === 'god' ? w.log.events.slice(-8).map((e) => eventView(e, pc, mode)) : knowledge.slice(-8),
    rumors: knowledge.filter((e) => e.kind === 'belief.transmitted' && e.summary.startsWith('Heard:')),
    journal,
    actions: availableActions(sim, pc),
    ...(mode === 'god' ? { truth: toViewModel(w, c, opts), beliefGraph: w.belief } : {}),
  };
}
export type Observation = ReturnType<typeof observation>;
