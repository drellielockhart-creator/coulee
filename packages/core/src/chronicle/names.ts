/**
 * Period forms of address, pronouns, places and the targets of belief events.
 * OWNER: module:chronicle. Reads world state; writes nothing.
 */
import type { ActorCore } from '../actor.ts';
import { shortName } from '../actor.ts';
import type { ContentBundle } from '../content.ts';
import type { ActorId, HouseholdId, PlaceId } from '../ids.ts';
import { yearsBetween } from '../time.ts';
import type { World } from '../world.ts';

export interface Pronouns {
  he: string;
  his: string;
  him: string;
  himself: string;
}

export function pronounsOf(a: ActorCore | undefined): Pronouns {
  if (a?.sex === 'male') return { he: 'he', his: 'his', him: 'him', himself: 'himself' };
  if (a?.sex === 'female') return { he: 'she', his: 'her', him: 'her', himself: 'herself' };
  return { he: 'they', his: 'their', him: 'them', himself: 'themselves' };
}

function ageOf(world: World, a: ActorCore): number {
  return yearsBetween(a.born, world.time);
}

/** Courtesy title by role, age and sex ("Rev.", "Dr.", "Mr.", "Mrs.", "Miss"). */
export function titleOf(world: World, content: ContentBundle, a: ActorCore): string {
  const roles = content.occupations?.[a.occupationId]?.roles ?? [];
  if (roles.includes('preacher')) return 'Rev.';
  if (roles.includes('doctor') || roles.includes('physician')) return 'Dr.';
  const age = ageOf(world, a);
  if (age < 15) return a.sex === 'male' ? 'Master' : 'Miss';
  if (a.sex === 'male') return 'Mr.';
  return age >= 27 ? 'Mrs.' : 'Miss';
}

/** The paper's form: "Mrs. A. Pratt". */
export function formalName(world: World, content: ContentBundle, id: ActorId | number): string {
  const a = world.actors[id as ActorId];
  if (!a) return 'a person unknown';
  const initial = a.name.given.charAt(0);
  const family = a.name.family || a.name.given;
  const title = titleOf(world, content, a);
  return a.name.family ? `${title} ${initial}. ${family}` : `${title} ${a.name.given}`;
}

/** The diarist's form: "Gussie Pratt". */
export function shortNameOf(world: World, id: ActorId | number): string {
  const a = world.actors[id as ActorId];
  return a ? shortName(a) : 'someone';
}

/** First name, or nickname. */
export function givenNameOf(world: World, id: ActorId | number): string {
  const a = world.actors[id as ActorId];
  return a ? (a.name.nickname ?? a.name.given) : 'someone';
}

export function familyOfActor(world: World, id: ActorId | number): string {
  const a = world.actors[id as ActorId];
  return a ? a.name.family || a.name.given : 'someone';
}

/** Family name of a household: its head's, else the household name without "The ". */
export function familyOfHousehold(world: World, hid: HouseholdId | number): string {
  const h = world.households[hid as HouseholdId];
  if (!h) return 'a household';
  const head = world.actors[h.headId];
  if (head?.name.family) return head.name.family;
  return h.name.replace(/^The\s+/i, '');
}

/** "the Pratts" (plural by adding s; good enough for Yankee, German and Norse surnames). */
export function familiesOf(world: World, hid: HouseholdId | number): string {
  const f = familyOfHousehold(world, hid);
  return `the ${f}${/s$/i.test(f) ? '' : 's'}`;
}

export function placeName(world: World, pid: PlaceId | number | null | undefined): string {
  if (!pid) return '';
  return world.places[pid as PlaceId]?.name ?? '';
}

/** "at Dunleavy's Tavern", or '' when unknown. */
export function atPlace(world: World, pid: PlaceId | number | null | undefined): string {
  const n = placeName(world, pid);
  return n ? `at ${n}` : '';
}

/** Item display name, falling back to a prettified id. */
export function itemName(content: ContentBundle, defId: string, qty = 1): string {
  const def = content.items?.[defId];
  if (def) return qty !== 1 && def.plural ? def.plural : def.name.toLowerCase();
  return defId.replace(/_/g, ' ');
}

/** Unit label ("lb", "quart", "each") for an item def. */
export function itemUnit(content: ContentBundle, defId: string): string {
  return content.items?.[defId]?.unit ?? 'each';
}

/** "12 lb salt pork", "3 quarts of whiskey", "2 armloads firewood" style amount. */
export function amountText(content: ContentBundle, defId: string, qty: number): string {
  const unit = itemUnit(content, defId);
  const name = itemName(content, defId);
  if (unit === 'each') return qty === 1 ? `a ${name}` : `${qty} ${itemName(content, defId, qty)}`;
  if (unit === 'lb') return `${qty} lb of ${name}`;
  return `${qty} ${unit}${qty === 1 || /s$/.test(unit) ? '' : 's'} of ${name}`;
}

export interface ResolvedTarget {
  label: string;
  actorId: ActorId | null;
  householdId: HouseholdId | null;
  figureKey: string | null;
}

/**
 * Belief events name a target as a string. Accept 'actor:12', 'a:12', 'household:3', 'h:3',
 * 'figure:2', 'f:2', a bare number (an actor), a scenario key, a figure key, or plain text.
 */
export function resolveTarget(world: World, s: string): ResolvedTarget {
  const m = /^(actor|a|household|h|figure|f)[:#]?(\d+)$/.exec(s);
  const num = /^\d+$/.test(s) ? Number(s) : null;
  const kind = m ? (m[1] as string)[0] : num !== null ? 'a' : null;
  const n = m ? Number(m[2]) : num;
  if (kind === 'a' && n !== null && world.actors[n as ActorId]) {
    return { label: s, actorId: n as ActorId, householdId: null, figureKey: null };
  }
  if (kind === 'h' && n !== null && world.households[n as HouseholdId]) {
    return { label: s, actorId: null, householdId: n as HouseholdId, figureKey: null };
  }
  if (kind === 'f' && n !== null) {
    const f = world.belief?.figures?.[n as never] as { name: string; key: string } | undefined;
    if (f) return { label: f.name, actorId: null, householdId: null, figureKey: f.key };
  }
  const byKey = world.index.actorByKey[s];
  if (byKey !== undefined) return { label: s, actorId: byKey, householdId: null, figureKey: null };
  const hh = world.index.householdByKey[s];
  if (hh !== undefined) return { label: s, actorId: null, householdId: hh, figureKey: null };
  for (const f of Object.values(world.belief?.figures ?? {})) {
    const fig = f as { key: string; name: string };
    if (fig.key === s) return { label: fig.name, actorId: null, householdId: null, figureKey: fig.key };
  }
  return { label: s, actorId: null, householdId: null, figureKey: null };
}
