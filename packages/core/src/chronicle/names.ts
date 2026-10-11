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

/**
 * Courtesy title by role, marriage and sex ("Rev.", "Dr.", "Mr.", "Mrs.", "Miss"). "Rev." is for
 * an `ordained` role only (a lay preacher is Mr./Mrs./Miss); "Mrs." is a wife, a widow or a
 * mother (a spouse or parent edge, or the `widowed` trait), never an age.
 */
export function titleOf(world: World, content: ContentBundle, a: ActorCore): string {
  const roles = content.occupations?.[a.occupationId]?.roles ?? [];
  if (roles.includes('ordained')) return 'Rev.';
  if (roles.includes('doctor') || roles.includes('physician')) return 'Dr.';
  const age = ageOf(world, a);
  if (age < 15) return a.sex === 'male' ? 'Master' : 'Miss';
  if (a.sex === 'male') return 'Mr.';
  // A wife, a widow, or a mother (a grown son or daughter in town: she was married once).
  const married =
    a.traits.includes('widowed') ||
    (world.social?.relationships ?? []).some(
      (r) => (r.kind === 'spouse' && (r.a === a.id || r.b === a.id)) || (r.kind === 'parent' && r.a === a.id),
    );
  return married ? 'Mrs.' : 'Miss';
}

/** The paper's form: "Mrs. A. Pratt". */
export function formalName(world: World, content: ContentBundle, id: ActorId | number): string {
  const a = world.actors[id as ActorId];
  if (!a) return 'a person unknown';
  const initial = a.name.given.charAt(0);
  const family = a.name.family || a.name.given;
  const title = titleOf(world, content, a);
  if (!a.name.family) return `${title} ${a.name.given}`;
  // Two of a family with one initial (Josiah and Jory Trevenna) would read as one man: spell it out.
  const clash = Object.values(world.actors).some(
    (o) => o.id !== a.id && o.name.family === a.name.family && o.name.given.charAt(0) === initial,
  );
  return clash ? `${title} ${a.name.given} ${family}` : `${title} ${initial}. ${family}`;
}

/** The diarist's form: "Gussie Pratt". */
export function shortNameOf(world: World, id: ActorId | number): string {
  const a = world.actors[id as ActorId];
  if (!a) return 'someone';
  // A nickname that already carries the family name ("Captain Hurd") stands alone.
  const nick = a.name.nickname;
  if (nick && a.name.family && nick.includes(a.name.family)) return nick;
  return shortName(a);
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

const pluralSurname = (f: string): string => `${f}${/(s|x|z|ch|sh)$/i.test(f) ? 'es' : 's'}`;

/**
 * How a household is named mid-sentence. A family (two or more members sharing the head's
 * surname) is "the Kvales" (possessive "the Kvales'", plural verb); a household of one is its
 * person ("Captain Hurd", "Captain Hurd's"); any other company keeps its own name with a
 * lowercase article and no parenthetical ("Whitcomb's Survey Party", "the Penhallow Pare").
 */
export interface HouseholdForms {
  family: string;
  poss: string;
  plural: boolean;
}

export function householdForms(world: World, hid: HouseholdId | number): HouseholdForms {
  const h = world.households[hid as HouseholdId];
  if (!h) return { family: 'a household', poss: "a household's", plural: false };
  const head = world.actors[h.headId];
  const surname = head?.name.family ?? '';
  const sharing = surname ? h.memberIds.filter((m) => world.actors[m]?.name.family === surname).length : 0;
  if (surname && sharing >= 2) {
    const fam = `the ${pluralSurname(surname)}`;
    return { family: fam, poss: `${fam}'`, plural: true };
  }
  if (head && h.memberIds.length <= 1) {
    const n = shortNameOf(world, head.id);
    return { family: n, poss: `${n}'s`, plural: false };
  }
  const clean = h.name
    .replace(/\s*\([^)]*\)/g, '')
    .trim()
    .replace(/^The\s+/, 'the ');
  return { family: clean, poss: /s$/.test(clean) ? `${clean}'` : `${clean}'s`, plural: /^the .*s$/.test(clean) };
}

/**
 * "the Pratts", "the Hatches" (surnames take -es after s, x, z, ch, sh; never an apostrophe).
 * A household of one is "Captain Hurd's household": a bachelor is not a family of Hurds.
 */
export function familiesOf(world: World, hid: HouseholdId | number): string {
  const h = world.households[hid as HouseholdId];
  const f = familyOfHousehold(world, hid);
  const head = h ? world.actors[h.headId] : undefined;
  if (h && head?.name.family) {
    const sharing = h.memberIds.filter((m) => world.actors[m]?.name.family === head.name.family).length;
    if (sharing < 2) return `${shortNameOf(world, head.id)}'s household`;
  }
  return `the ${pluralSurname(f)}`;
}

/** A proposition argument in words, with the `{n.form}` forms predicate texts may use. */
export function argForm(
  world: World,
  content: ContentBundle,
  a: { kind: string; id?: number; value?: string | number } | undefined,
  form: string | undefined,
  actorName: (id: number) => string,
): string | null {
  if (!a) return null;
  if (a.kind === 'actor' && a.id !== undefined) {
    const who = world.actors[a.id as ActorId];
    if (form === undefined) return actorName(a.id);
    const pr = pronounsOf(who);
    if (form === 'he' || form === 'his' || form === 'him' || form === 'himself') return pr[form];
    if (form === 'poss') return `${actorName(a.id)}'s`;
    return actorName(a.id);
  }
  if (a.kind === 'household' && a.id !== undefined) {
    const f = householdForms(world, a.id);
    if (form === 'poss') return f.poss;
    if (form === 'has') return f.plural ? 'have' : 'has';
    if (form === 'is') return f.plural ? 'are' : 'is';
    return f.family;
  }
  if (a.kind === 'number' && form === 'money') return moneyWords(Number(a.value ?? 0));
  if (a.kind === 'text' && form === 'trait') {
    const t = content.traits?.[String(a.value)];
    if (!t) return String(a.value).replaceAll('_', ' ');
    const label = t.period_label ?? '';
    return /^(Of|A|An|Given|Fond|Close|Pious|Pledged|Open)\b/.test(label) ? label.toLowerCase() : t.name.toLowerCase();
  }
  return null;
}

/** "$310.00" (money in a rumor reads as money, not as a count of cents). */
function moneyWords(cents: number): string {
  const c = Math.abs(Math.round(cents));
  const rem = c % 100;
  return `$${Math.floor(c / 100)}.${rem < 10 ? `0${rem}` : rem}`;
}

export function placeName(world: World, pid: PlaceId | number | null | undefined): string {
  if (!pid) return '';
  return world.places[pid as PlaceId]?.name ?? '';
}

/** "at Dunleavy's Tavern", or '' when unknown. */
export function atPlace(world: World, pid: PlaceId | number | null | undefined): string {
  const n = placeName(world, pid);
  return n ? `at ${n.replace(/^The /, 'the ')}` : '';
}

/** Item display name, falling back to a prettified id. */
export function itemName(content: ContentBundle, defId: string, qty = 1): string {
  const def = content.items?.[defId];
  if (def) {
    const name = qty !== 1 && def.plural ? def.plural : def.name.toLowerCase();
    // "butter, salted" reads better in a sentence as "salted butter".
    const m = /^([^,]+), ([^,]+)$/.exec(name);
    return m ? `${m[2]} ${m[1]}` : name;
  }
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
    if (fig.key === s || fig.name === s)
      return { label: fig.name, actorId: null, householdId: null, figureKey: fig.key };
  }
  // The belief module labels targets by display name ("Loveday Trevenna", a household's name).
  for (const a of Object.values(world.actors)) {
    if (`${a.name.given} ${a.name.family}`.trim() === s) {
      return { label: s, actorId: a.id, householdId: null, figureKey: null };
    }
  }
  for (const h of Object.values(world.households)) {
    if (h.name === s) return { label: s, actorId: null, householdId: h.id, figureKey: null };
  }
  return { label: s, actorId: null, householdId: null, figureKey: null };
}

/** The subject (first actor argument) of a proposition, 0 if none. */
export function subjectOfProp(world: World, propId: number): number {
  const prop = world.belief?.props?.[propId as never] as { args: Array<{ kind: string; id?: number }> } | undefined;
  const a = prop?.args.find((x) => x.kind === 'actor');
  return a?.id ?? 0;
}

/** Predicate id of a proposition, '' if unknown. */
export function predOfProp(world: World, propId: number): string {
  return (world.belief?.props?.[propId as never] as { pred: string } | undefined)?.pred ?? '';
}

/**
 * A proposition in words ("Loveday Trevenna is a witch"). Local to the Chronicle so sifting
 * does not depend on the belief module's runtime code; reads the same predicate templates.
 */
export function rumorText(world: World, content: ContentBundle, propId: number): string {
  const p = world.belief?.props?.[propId as never] as
    | { pred: string; args: Array<{ kind: string; id?: number; value?: string | number }> }
    | undefined;
  if (!p) return '';
  const tpl = content.predicates?.[p.pred]?.text ?? `${p.pred}({0})`;
  return tpl.replace(/\{(\d)(?:\.([a-z]+))?\}/g, (_m, i: string, form: string | undefined) => {
    const a = p.args[Number(i)];
    if (!a) return 'someone';
    const formed = argForm(world, content, a, form, (id) => shortNameOf(world, id));
    if (formed !== null) return formed;
    switch (a.kind) {
      case 'actor':
        return shortNameOf(world, a.id as number);
      case 'household':
        return familiesOf(world, a.id as number);
      case 'figure': {
        const f = world.belief?.figures?.[a.id as never] as { name: string } | undefined;
        return f?.name ?? 'a certain party';
      }
      case 'place':
        return placeName(world, a.id as number) || 'a place';
      case 'text':
      case 'number':
        return String(a.value);
      case 'misfortune':
        return misfortuneText(world, content, a.id as number) ?? 'some misfortune';
      default:
        return 'some misfortune';
    }
  });
}

/** A misfortune in words ("the Tveits' best cow sickened and died"), null if unknown. */
export function misfortuneText(world: World, content: ContentBundle, misfortuneId: number): string | null {
  const m = world.belief?.misfortunes?.[misfortuneId as never] as
    | { kindId: string; householdId: number; victimId: number | null }
    | undefined;
  const def = m ? content.misfortunes?.[m.kindId] : undefined;
  if (!m || !def) return null;
  const forms = householdForms(world, m.householdId);
  const victim = m.victimId === null ? 'a child' : (world.actors[m.victimId as ActorId]?.name.given ?? 'someone');
  return def.text.replace('{0.poss}', forms.poss).replace('{0}', forms.family).replace('{1}', victim);
}

/** Display name of a persecution rung (0 = unease ... ). */
export function rungName(content: ContentBundle, rung: number): string {
  for (const r of Object.values(content.persecutionRungs ?? {})) {
    if (r.rung === rung) return r.name.toLowerCase();
  }
  return `rung ${rung}`;
}

/** Defense display names from content ("Laying it at another's door"). */
export function defenseNames(content: ContentBundle, id: string): { name: string; clinical: string } {
  const d = content.defenses?.[id as never] as { name: string; period_label?: string } | undefined;
  if (!d) return { name: id.replace(/_/g, ' '), clinical: id.replace(/_/g, ' ') };
  return { name: (d.period_label ?? d.name).toLowerCase(), clinical: d.name.toLowerCase() };
}

/** Nutrition conditions in plain words. */
const CONDITION_WORDS: Record<string, string> = {
  scurvy_early: 'the first signs of scurvy',
  scurvy: 'scurvy',
  malnourished: 'want of food',
};

export function conditionName(id: string): string {
  return CONDITION_WORDS[id] ?? id.replace(/_/g, ' ');
}
