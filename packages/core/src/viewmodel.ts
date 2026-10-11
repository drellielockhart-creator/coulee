/**
 * toViewModel: plain-data snapshot for the web UI (and `coulee inspect`). FOUNDATION-OWNED
 * composition; each module owns its part in `src/<module>/view.ts`.
 *
 * The web worker posts this object to the main thread (structured clone), so it must be
 * plain data. Modules may ADD fields to their parts freely; renames/removals must update
 * apps/web in the same change.
 */

import {
  type ActivityActorView,
  type ActivityPlaceView,
  viewActivityActor,
  viewActivityPlace,
} from './activity/view.ts';
import { displayName, shortName } from './actor.ts';
import { type BeliefActorView, type BeliefGlobalView, viewBeliefActor, viewBeliefGlobal } from './belief/view.ts';
import { type ChronicleGlobalView, viewChronicleGlobal } from './chronicle/view.ts';
import type { ContentBundle } from './content.ts';
import { type ActorId, type HouseholdId, idsOf, mustGet, type PlaceId } from './ids.ts';
import { type ItemsActorView, viewItemsActor } from './items/view.ts';
import { type NeedsActorView, viewNeedsActor } from './needs/view.ts';
import {
  type ProvisionsActorView,
  type ProvisionsHouseholdView,
  type ProvisionsPlaceView,
  viewProvisionsActor,
  viewProvisionsHousehold,
  viewProvisionsPlace,
} from './provisions/view.ts';
import { type PsycheActorView, viewPsycheActor } from './psyche/view.ts';
import { type SocialActorView, viewSocialActor } from './social/view.ts';
import {
  asGameMinute,
  calendarAt,
  formatDate,
  formatStamp,
  type MoonPhase,
  type Season,
  type Weekday,
  yearsBetween,
} from './time.ts';
import { DEFAULT_VIEW_OPTIONS, type ViewOptions } from './viewmodel-types.ts';
import type { World } from './world.ts';

export type { ViewOptions } from './viewmodel-types.ts';
export { DEFAULT_VIEW_OPTIONS } from './viewmodel-types.ts';

export interface TimeView {
  t: number;
  stamp: string;
  dateText: string;
  dayIndex: number;
  hour: number;
  minute: number;
  weekday: Weekday;
  season: Season;
  moon: MoonPhase;
  moonIlluminationPermille: number;
  isDaylight: boolean;
  isSabbath: boolean;
  sunriseMinute: number;
  sunsetMinute: number;
}

export interface ActorCoreView {
  id: ActorId;
  key: string;
  name: string;
  shortName: string;
  sex: 'female' | 'male';
  age: number;
  /** What the viewer knows: the presented people unless omniscient/perspective-self. */
  people: string;
  occupation: string;
  householdId: HouseholdId;
  placeId: PlaceId;
  isPlayer: boolean;
  alive: boolean;
  traits: string[];
  conditions: string[];
}

export interface ActorView extends ActorCoreView {
  needs: NeedsActorView;
  activity: ActivityActorView;
  psyche: PsycheActorView;
  social: SocialActorView;
  belief: BeliefActorView;
  items: ItemsActorView;
  provisions: ProvisionsActorView;
}

export interface PlaceView {
  id: PlaceId;
  defId: string;
  name: string;
  kind: string;
  tags: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  model: string | null;
  activity: ActivityPlaceView;
  provisions: ProvisionsPlaceView;
}

export interface HouseholdView {
  id: HouseholdId;
  name: string;
  headId: ActorId;
  memberIds: ActorId[];
  homePlaceId: PlaceId;
  provisions: ProvisionsHouseholdView;
}

export interface SiteView {
  id: string;
  name: string;
  w: number;
  h: number;
  tileFt: number;
}

export interface ViewModel {
  scenario: { id: string; name: string };
  seed: number;
  site: SiteView | null;
  time: TimeView;
  playerId: ActorId | null;
  actors: ActorView[];
  places: PlaceView[];
  households: HouseholdView[];
  chronicle: ChronicleGlobalView;
  belief: BeliefGlobalView;
  /** Event log size (for debugging / sanity). */
  eventCount: number;
}

export function timeView(t: number): TimeView {
  const c = calendarAt(asGameMinute(t));
  return {
    t,
    stamp: formatStamp(c.t),
    dateText: formatDate(c.t),
    dayIndex: c.dayIndex,
    hour: c.hour,
    minute: c.minute,
    weekday: c.weekday,
    season: c.season,
    moon: c.moon.phase,
    moonIlluminationPermille: c.moon.illuminationPermille,
    isDaylight: c.isDaylight,
    isSabbath: c.isSabbath,
    sunriseMinute: c.sunriseMinute,
    sunsetMinute: c.sunsetMinute,
  };
}

export function toViewModel(world: World, content: ContentBundle, options: Partial<ViewOptions> = {}): ViewModel {
  const opts: ViewOptions = { ...DEFAULT_VIEW_OPTIONS, ...options };
  const scenario = content.scenarios[world.meta.scenarioId];
  const siteDef = scenario ? content.sites[scenario.site] : undefined;
  const actors: ActorView[] = idsOf<ActorId>(world.actors).map((id) => {
    const a = mustGet(world.actors, id, 'actor');
    const seesTruth = opts.omniscient || opts.perspective === id;
    const peopleId = seesTruth ? a.ancestryId : a.presentsAsId;
    return {
      id,
      key: a.key,
      name: displayName(a),
      shortName: shortName(a),
      sex: a.sex,
      age: yearsBetween(a.born, world.time),
      people: content.peoples[peopleId]?.name ?? peopleId,
      occupation: content.occupations[a.occupationId]?.name ?? a.occupationId,
      householdId: a.householdId,
      placeId: a.placeId,
      isPlayer: world.meta.playerId === id,
      alive: a.alive,
      traits: [...a.traits],
      conditions: [...a.sheet.conditions],
      needs: viewNeedsActor(world, content, id, opts),
      activity: viewActivityActor(world, content, id, opts),
      psyche: viewPsycheActor(world, content, id, opts),
      social: viewSocialActor(world, content, id, opts),
      belief: viewBeliefActor(world, content, id, opts),
      items: viewItemsActor(world, content, id, opts),
      provisions: viewProvisionsActor(world, content, id, opts),
    };
  });
  const places: PlaceView[] = idsOf<PlaceId>(world.places).map((id) => {
    const p = mustGet(world.places, id, 'place');
    return {
      id,
      defId: p.defId,
      name: p.name,
      kind: p.kind,
      tags: [...p.tags],
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      rotation: p.rotation,
      model: p.model,
      activity: viewActivityPlace(world, content, id, opts),
      provisions: viewProvisionsPlace(world, content, id, opts),
    };
  });
  const households: HouseholdView[] = idsOf<HouseholdId>(world.households).map((id) => {
    const h = mustGet(world.households, id, 'household');
    return {
      id,
      name: h.name,
      headId: h.headId,
      memberIds: [...h.memberIds],
      homePlaceId: h.homePlaceId,
      provisions: viewProvisionsHousehold(world, content, id, opts),
    };
  });
  return {
    scenario: { id: world.meta.scenarioId, name: scenario?.name ?? world.meta.scenarioId },
    seed: world.meta.seed,
    site: siteDef
      ? { id: siteDef.id, name: siteDef.name, w: siteDef.grid.w, h: siteDef.grid.h, tileFt: siteDef.tile_ft }
      : null,
    time: timeView(world.time),
    playerId: world.meta.playerId,
    actors,
    places,
    households,
    chronicle: viewChronicleGlobal(world, content, opts),
    belief: viewBeliefGlobal(world, content, opts),
    eventCount: world.log.events.length,
  };
}
