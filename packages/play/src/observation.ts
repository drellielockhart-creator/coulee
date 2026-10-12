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
  if (e.kind === 'belief.transmitted' && e.data.text) summary = `Told: ${e.data.text}`;
  // What was said (social talk lines): the act on social.interaction, the news itself on the
  // private belief.transmitted (only its teller and hearer perceive it).
  const words =
    (e.kind === 'social.interaction' || e.kind === 'belief.transmitted') && e.data.lines
      ? {
          line: e.data.line ?? '',
          lines: e.data.lines.map((l) => ({ speaker: l.speaker, speakerId: l.speakerId, text: l.text })),
        }
      : {};
  return { id: e.id, t: e.t, kind: e.kind, summary, explain, ...words } as {
    id: number;
    t: number;
    kind: Event['kind'];
    summary: string;
    explain: Explain | null;
    line?: string;
    lines?: Array<{ speaker: string; speakerId: number; text: string }>;
  };
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
    place: {
      id: a.placeId,
      name: w.places[a.placeId]?.name ?? 'Unknown',
      kind: w.places[a.placeId]?.kind ?? '',
      description: c.places[w.places[a.placeId]?.defId ?? '']?.description ?? '',
    },
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
      provisions: { ...ownProvisions, householdCents: w.provisions.households[a.householdId]?.cashCents ?? 0 },
      agencyMode: psyche.agencyMode(w, pc),
      standingOrders: psyche.standingOrders(w, pc),
    },
    present: Object.values(w.actors)
      .filter((other) => other.id !== pc && other.placeId === a.placeId)
      .map((other) => publicActor(other.id)),
    places: Object.values(w.places).map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      description: c.places[p.defId]?.description ?? '',
    })),
    knownPeople: Object.values(w.actors)
      .filter((other) => other.placeId === a.placeId || social.isAcquainted(w, pc, other.id))
      .map((other) => publicActor(other.id)),
    interactionVerbs: Object.values(c.interactions).map((d) => ({ id: d.id, name: d.name })),
    changes: { elapsed: 0, money: [] as MoneyChange[], needs: [] as string[], events: [] as string[], skipped: 0 },
    store: provisions.viewProvisionsPlace(w, c, a.placeId, opts),
    events: mode === 'god' ? w.log.events.slice(-8).map((e) => eventView(e, pc, mode)) : knowledge.slice(-8),
    rumors: knowledge.filter((e) => e.kind === 'belief.transmitted' && e.summary.startsWith('Heard:')),
    // What the PC heard said in the last hour, in the speakers' words: their own exchanges first
    // (a command's words, what was said to them, news they were told), then talk overheard.
    said: (() => {
      const recent = knowledge.filter((e) => e.t >= w.time - 60 && e.lines && e.lines.length > 0);
      const mine = recent.filter((e) => e.lines?.some((l) => l.speakerId === pc));
      return [...mine, ...recent.filter((e) => !mine.includes(e))].slice(0, 4);
    })(),
    journal,
    actions: availableActions(sim, pc),
    ...(mode === 'god' ? { truth: toViewModel(w, c, opts), beliefGraph: w.belief } : {}),
  };
}
export type Observation = ReturnType<typeof observation>;

export interface MoneyChange {
  at: number;
  eventId: number;
  purse: number;
  household: number;
  reason: string;
}
