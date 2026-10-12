/**
 * Who a speaker is, for talk lines that belong to a person or a kind of person (a story's teller;
 * a rib aimed at the man who tells it). Wave 5 group D, additive: `when.initiator` / `when.target`
 * in social/talk*.toml (schema: TalkWhoSchema). Pure reads of the actor's sheet, never `controller`.
 * OWNER: module:social.
 */

import type { TalkWho } from '@coulee/content/schema';
import type { ActorCore } from '../actor.ts';
import { type GameMinute, yearsBetween } from '../time.ts';

/** Age bands for `age = "young" | "prime" | "elder"`. */
const YOUNG_MAX = 24;
const ELDER_MIN = 50;

/**
 * Does `actor` fit `who`? Every field present must hold; ids within a field are alternatives.
 * `culture` is the culture the actor was raised in (null when the scenario does not say).
 */
export function whoMatches(who: TalkWho, actor: ActorCore, culture: string | null, now: GameMinute): boolean {
  if (who.actor !== undefined && !who.actor.includes(actor.key)) return false;
  if (who.occupation !== undefined && !who.occupation.includes(actor.occupationId)) return false;
  if (who.culture !== undefined && (culture === null || !who.culture.includes(culture))) return false;
  if (who.trait !== undefined && !actor.traits.some((t) => who.trait?.includes(t))) return false;
  if (who.sex !== undefined && actor.sex !== who.sex) return false;
  if (who.age !== undefined) {
    const years = yearsBetween(actor.born, now);
    const band = years <= YOUNG_MAX ? 'young' : years >= ELDER_MIN ? 'elder' : 'prime';
    if (band !== who.age) return false;
  }
  return true;
}

/**
 * How specific a line's `when` is (conditions it names, counting the fields inside `initiator` /
 * `target`), so a line that names its teller outweighs a general one.
 */
export function whenSpecificity(when: Record<string, unknown>): number {
  let n = 0;
  for (const [k, v] of Object.entries(when)) {
    if (v === undefined) continue;
    if ((k === 'initiator' || k === 'target') && typeof v === 'object' && v !== null)
      n += Object.values(v).filter((x) => x !== undefined).length;
    else n += 1;
  }
  return n;
}
