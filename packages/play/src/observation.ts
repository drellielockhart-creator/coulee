import {
  type ActorId,
  activity,
  belief,
  type ContentBundle,
  calendarAt,
  chronicle,
  type Event,
  type Explain,
  fae,
  items,
  needs,
  provisions,
  psyche,
  region,
  type Sim,
  social,
  tactical,
  timeView,
  toViewModel,
  type World,
  yearsBetween,
} from '@coulee/core';
import { availableActions } from './actions.ts';
import { describeEvent, fallbackText } from './describe.ts';
import { claimsOf, obligationsOf } from './obligations.ts';
export type ObservationMode = 'fair' | 'god';
/** Under this age someone is marked a child in the Here list. */
const CHILD_AGE = 13;
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
    ...(e.tenth === undefined ? {} : { tenth: e.tenth }),
    kind: e.kind,
    summary,
    explain,
    ...(described.routine ? { routine: true } : {}),
    ...by,
    ...words,
  } as {
    id: number;
    t: number;
    tenth?: number;
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
/** Text that closes a fair epilogue when the omniscient reckoning is withheld (a branched story). */
export const FAIR_EPILOGUE_NOTE =
  'What the county never knew stays untold here: this story has a fork that lives on. Play an unforked life to its end, or open a --god session, to read it.';

export function observation(
  sim: Sim,
  pc: ActorId,
  known: readonly number[],
  mode: ObservationMode,
  knowledge: readonly KnownEvent[] = [],
  journalLimit = 12,
  /**
   * 'omniscient' appends "what the county never knew" to an ended life's epilogue; 'fair' keeps
   * the reckoning to what the character knew (playtest r2: a fork could retire, read every
   * neighbor's private defenses, and play on in the original). God mode always reads it all.
   */
  epilogueMode: 'omniscient' | 'fair' = 'omniscient',
) {
  const { world: w, content: c } = sim;
  const a = w.actors[pc];
  if (!a) throw new Error('Missing player');
  const ending = w.needs.byActor[pc]?.survival?.ending;
  const omniscientEpilogue = mode === 'god' || epilogueMode === 'omniscient';
  const epilogue = ending
    ? chronicle.renderChronicleMarkdown(w, c, `${a.name.given} ${a.name.family}: ${ending.type}`, {
        perspective: pc,
        epilogue: omniscientEpilogue,
      }) + (omniscientEpilogue ? '' : `\n\n${FAIR_EPILOGUE_NOTE}\n`)
    : undefined;
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
    const seen = activity.viewActivityActor(w, c, id, opts);
    const def = seen.activityId ? c.activities[seen.activityId] : undefined;
    return {
      id,
      name: `${actor.name.given} ${actor.name.family}`.trim(),
      people: c.peoples[actor.presentsAsId]?.name ?? actor.presentsAsId,
      activity: seen.verb,
      // ---- additive (playtest r2: the Here list marks who is working, asleep, a child) ----
      ...(seen.observed !== false
        ? {
            asleep: def?.asleep === true,
            working: def?.tags.includes('labor') === true,
            child: yearsBetween(actor.born, w.time) < CHILD_AGE,
          }
        : {}),
    };
  };
  const regional = region.regionView(w, pc);
  const ownProvisions = provisions.viewProvisionsActor(w, c, pc, opts);
  return {
    region: regional,
    tactical: tactical.tacticalView(sim.world, pc),
    remains: needs.remainsAt(w, a.placeId),
    ending: ending ?? null,
    epilogue: epilogue ?? null,
    mode,
    time: timeView(w.time),
    minuteBudget: activity.minuteBudget(w, pc),
    scenario: w.meta.scenarioId,
    signs: fae.signs(w, pc),
    /** Fae charms as the character knows them (fair: own charms, found ones, believed keepers). */
    charms: fae.charmView(w, c, pc),
    requests: social.pendingRequests(w, pc),
    weather: {
      temperatureF: provisions.airTempF(calendarAt(w.time), w),
      raining: provisions.isRaining(w.meta.seed, calendarAt(w.time), w),
      description: provisions.isRaining(w.meta.seed, calendarAt(w.time), w) ? 'Rain' : 'Dry',
    },
    place: {
      id: a.placeId,
      fireLit: !!w.provisions.fires[a.placeId]?.lit && (w.provisions.fires[a.placeId]?.until ?? 0) > w.time,
      name: w.places[a.placeId]?.name ?? 'Unknown',
      kind: w.places[a.placeId]?.kind ?? '',
      description: fae.describe(w, c, a.placeId, pc).join(' '),
      layers: fae.describe(w, c, a.placeId, pc),
    },
    self: {
      id: pc,
      name: `${a.name.given} ${a.name.family}`.trim(),
      alive: a.alive,
      needs: needs.viewNeedsActor(w, c, pc, opts),
      activity: {
        ...activity.viewActivityActor(w, c, pc, opts),
        asleep: !!c.activities[w.activity.byActor[pc]?.activityId ?? '']?.asleep,
        /** Until when her present activity holds her (sleep's 4 hours, a camp's 8), when it does. */
        lockedUntil:
          (w.activity.byActor[pc]?.lockedUntil ?? 0) > w.time ? (w.activity.byActor[pc]?.lockedUntil ?? null) : null,
      },
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
      /** Her own ration order, percent (rations <pct>). */
      rationPct: w.provisions.nutrition[pc]?.rationPct ?? 100,
      // Where her bed is, and whether she stands on open ground with something to sleep in.
      lodging: (() => {
        const home = w.households[a.householdId]?.homePlaceId;
        const place = home === undefined ? undefined : w.places[home];
        return place ? { placeId: place.id, name: place.name } : null;
      })(),
      camp: items.campContext(w, c, pc),
      obligations: obligationsOf(w, c, pc),
      /** What others owe her: money she lent, favors she did (playtest r2). */
      claims: claimsOf(w, pc, c),
      // Household errands buy into the household pantry at her lodgings, not into her pack: say so.
      pantry: (() => {
        const home = w.households[a.householdId]?.homePlaceId;
        if (w.region && mode !== 'god' && w.places[home ?? 0]?.siteId !== w.places[a.placeId]?.siteId) return null;
        const food = items
          .stacksDeep(w, items.pantryOf(a.householdId))
          .map((s) => s.stack)
          .filter((s) => c.items[s.defId]?.food && provisions.foodServings(c, s) > 0);
        if (home === undefined || !food.length) return null;
        const r = provisions.readinessOf(w, c, { householdId: a.householdId }, w.time, 60);
        return {
          placeId: home,
          placeName: w.places[home]?.name ?? 'your lodgings',
          withPack: a.placeId === home,
          daysOfFoodTenths: r.daysOfFoodTenths,
          kcalOnHand: r.kcalOnHand,
          items: food.map((s) => ({ id: s.id, name: c.items[s.defId]?.name ?? s.defId, qty: s.qty })),
        };
      })(),
    },
    present: Object.values(w.actors)
      .filter((other) => other.id !== pc && other.placeId === a.placeId)
      .map((other) => publicActor(other.id)),
    places: Object.values(w.places)
      .filter((p) => !w.region || mode === 'god' || p.siteId === w.places[a.placeId]?.siteId)
      .map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        description: c.places[p.defId]?.description ?? '',
      })),
    knownPeople: Object.values(w.actors)
      .filter((other) => other.placeId === a.placeId || social.isAcquainted(w, pc, other.id))
      .map((other) => publicActor(other.id)),
    interactionVerbs: Object.values(c.interactions).map((d) => ({ id: d.id, name: d.name })),
    changes: { elapsed: 0, money: [], needs: [], events: [], skipped: 0 } as ObservationChanges,
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

/** What changed since the last order: time, money, needs, the events that stopped a wait. */
export interface ObservationChanges {
  elapsed: number;
  elapsedTicks?: number;
  money: MoneyChange[];
  needs: string[];
  events: string[];
  skipped: number;
  /** Additive (playtest r2): what was said or done to her that asked nothing of her (the digest). */
  addressed?: string[];
}

export interface MoneyChange {
  at: number;
  eventId: number;
  purse: number;
  household: number;
  reason: string;
}
