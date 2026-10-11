/**
 * Template bindings shared by every entry: who, where, when, and the writer's own voice.
 * OWNER: module:chronicle.
 */
import type { ContentBundle } from '../content.ts';
import type { ActorId } from '../ids.ts';
import { calendarAt, formatDate, MOON_PHASE_NAMES, WEEKDAY_NAMES } from '../time.ts';
import type { World } from '../world.ts';
import { atPlace, formalName, givenNameOf, placeName, pronounsOf, shortNameOf } from './names.ts';
import type { Bindings } from './prose.ts';
import { whenPhrase } from './text.ts';

export interface BaseBindingInput {
  t: number;
  actors: readonly number[];
  place: number;
  /** Use the paper's titled form ("Mrs. A. Pratt") for actor/target/other. */
  formal: boolean;
  /** The writer, when there is one: `other` skips them. */
  authorId: number | null;
}

/** Week number, 1-based, counting from the epoch Sunday. */
export function weekNumber(t: number): number {
  return Math.floor(Math.floor(t / 1440) / 7) + 1;
}

function person(
  out: Bindings,
  world: World,
  content: ContentBundle,
  name: 'actor' | 'target' | 'other',
  id: number | undefined,
  formal: boolean,
): void {
  if (!id) return;
  const a = world.actors[id as ActorId];
  if (!a) return;
  const pr = pronounsOf(a);
  out[name] = formal ? formalName(world, content, id) : shortNameOf(world, id);
  out[`${name}_short`] = shortNameOf(world, id);
  out[`${name}_given`] = givenNameOf(world, id);
  if (name === 'actor') {
    out.he = pr.he;
    out.his = pr.his;
    out.him = pr.him;
    out.himself = pr.himself;
  } else {
    out[`${name}_he`] = pr.he;
    out[`${name}_his`] = pr.his;
    out[`${name}_him`] = pr.him;
  }
}

export function baseBindings(world: World, content: ContentBundle, o: BaseBindingInput): Bindings {
  const cal = calendarAt(o.t as never);
  const out: Bindings = {
    date: formatDate(o.t as never),
    weekday: WEEKDAY_NAMES[cal.weekday],
    when: whenPhrase(o.t as never),
    moon: MOON_PHASE_NAMES[cal.moon.phase],
    season: cal.season,
    week: weekNumber(o.t),
    year: cal.year,
    place: placeName(world, o.place),
    at: atPlace(world, o.place),
  };
  const [first, second] = o.actors;
  person(out, world, content, 'actor', first, o.formal);
  person(out, world, content, 'target', second, o.formal);
  const otherId = o.actors.find((a) => a !== o.authorId && a !== 0);
  person(out, world, content, 'other', otherId, o.formal);
  if (o.authorId) out.author = shortNameOf(world, o.authorId);
  const cast = o.actors
    .filter((a) => a !== 0)
    .slice(0, 4)
    .map((a) => (o.formal ? formalName(world, content, a) : shortNameOf(world, a)));
  if (cast.length > 0)
    out.cast = cast.length > 1 ? `${cast.slice(0, -1).join(', ')} and ${cast[cast.length - 1]}` : (cast[0] as string);
  return out;
}
