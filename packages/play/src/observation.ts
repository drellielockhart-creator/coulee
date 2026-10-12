import {
  type ActorId,
  activity,
  belief,
  type ContentBundle,
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
  type World,
} from '@coulee/core';
import { availableActions } from './actions.ts';
import { describeEvent, fallbackText } from './describe.ts';
import { obligationsOf } from './obligations.ts';
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
/** The world and content an event's sentence needs for names (places, items, activities). */
export interface EventViewContext {
  world: World;
  content: ContentBundle;
}
export function eventView(e: Event, pc: ActorId, mode: ObservationMode, view?: EventViewContext) {
  const explain = knownExplain(e.explain, pc, mode);
  // Every event is told in plain words (describe.ts): never an event kind, whatever its source.
  const described = view
    ? describeEvent(view.world, view.content, pc, e)
    : { text: e.kind === 'social.interaction' ? e.data.label : fallbackText(e.kind), routine: true };
  const summary: string = described.text;
  // What was said (social talk lines): the act on social.interaction, the news itself on the
  // private belief.transmitted (only its teller and hearer perceive it).
  const words =
    (e.kind === 'social.interaction' || e.kind === 'belief.transmitted') && e.data.lines
      ? {
          line: e.data.line ?? '',
          lines: e.data.lines.map((l) => ({ speaker: l.speaker, speakerId: l.speakerId, text: l.text })),
        }
      : {};
  // Who spoke first: a command's own words are the player's exchange, printed before the rest.
  const by =
    e.kind === 'social.interaction'
      ? { speakerId: e.data.initiatorId, hearerId: e.data.targetId }
      : e.kind === 'belief.transmitted'
        ? { speakerId: e.data.speakerId, hearerId: e.data.listenerId }
        : {};
  return {
    id: e.id,
    t: e.t,
    kind: e.kind,
    summary,
    explain,
    ...(described.routine ? { routine: true } : {}),
    ...by,
    ...words,
  } as {
    id: number;
    t: number;
    kind: Event['kind'];
    summary: string;
    explain: Explain | null;
    routine?: boolean;
    speakerId?: number;
    hearerId?: number;
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
        // The id of the arbitration she can `explain` (why she chose what she did this hour).
        verdictEventId: knowledge.findLast((e) => e.kind === 'psyche.arbitrated' && e.explain !== null)?.id,
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
      // Where her bed is, and whether she stands on open ground with something to sleep in.
      lodging: (() => {
        const home = w.households[a.householdId]?.homePlaceId;
        const place = home === undefined ? undefined : w.places[home];
        return place ? { placeId: place.id, name: place.name } : null;
      })(),
      camp: items.campContext(w, c, pc),
      obligations: obligationsOf(w, c, pc),
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
    events:
      mode === 'god'
        ? w.log.events.slice(-8).map((e) => eventView(e, pc, mode, { world: w, content: c }))
        : knowledge.filter((e) => !e.routine).slice(-8),
    rumors: knowledge.filter((e) => e.kind === 'belief.transmitted' && e.summary.startsWith('Heard:')),
    // What the PC heard said in the last hour, in the speakers' words: their own exchanges first
    // (a command's words, what was said to them, news they were told), then talk overheard.
    said: (() => {
      // Their own exchange first: what she said and was answered, then what was said to her,
      // then news she was told, then talk overheard. A command's act with no composed words is
      // still listed (the renderer says so) rather than dropped.
      const recent = knowledge.filter(
        (e) =>
          e.t >= w.time - 60 &&
          ((e.lines && e.lines.length > 0) || (e.kind === 'social.interaction' && e.speakerId === pc)),
      );
      const rank = (e: KnownEvent) =>
        e.speakerId === pc ? 0 : e.hearerId === pc ? 1 : e.lines?.some((l) => l.speakerId === pc) ? 2 : 3;
      return recent
        .map((e, i) => ({ e, i }))
        .sort((x, y) => rank(x.e) - rank(y.e) || x.i - y.i)
        .map((x) => x.e)
        .slice(0, 4);
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
