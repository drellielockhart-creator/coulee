import { beliefOf } from '../belief/api.ts';
import type { ContentBundle } from '../content.ts';
import type { ActorId, PlaceId } from '../ids.ts';
import { rowsOf } from '../ids.ts';
import { binIron } from '../items/api.ts';
import { hashString32 } from '../rng.ts';
import { calendarAt, ordinal, WEEKDAY_NAMES, weekdayOf } from '../time.ts';
import type { World } from '../world.ts';
import { effectiveFi, episodesAt } from './api.ts';
import { isProtectedSite } from './sites.ts';
export function signs(world: World, id: ActorId) {
  const known = [...(world.fae.questions[id] ?? [])];
  for (const key of Object.keys(world.fae.episodes).sort()) {
    const e = world.fae.episodes[key];
    if (!e || e.propId === undefined || known.some((q) => q.signId === e.id)) continue;
    const belief = beliefOf(world, id, e.propId);
    if (!belief?.evidence.some((x) => x.sourceId !== null && x.at >= Math.floor(e.snapshot.at / 60) * 60)) continue;
    known.push({
      signId: e.id,
      placeId: e.snapshot.placeId,
      text: `A report of strange signs at ${world.places[e.snapshot.placeId]?.name}.`,
      openedAt: belief.firstHeard,
      closedAt: null,
      evidence: null,
    });
  }
  return known.map((q) => ({
    ...q,
    available: !!world.fae.episodes[q.signId],
    instruction: q.closedAt === null ? `investigate ${q.signId}` : q.evidence,
  }));
}
/** Six ordered layers; no RNG, no hidden truth, no mutation. */
export function describe(
  world: World,
  content: ContentBundle,
  placeId: PlaceId,
  perspective: ActorId | null,
): string[] {
  const p = world.places[placeId];
  if (!p) return [];
  const c = calendarAt(world.time),
    a = perspective === null ? undefined : world.actors[perspective];
  const base =
    p.description || content.places[p.defId]?.description || `${p.name}: a ${p.kind} beside the village paths.`;
  const details = [
    'The wind carries the smell of wet earth.',
    'Last year’s leaves lie against the shaded edges.',
    'Wheel ruts and footprints cross the softer ground.',
  ];
  const weather = `${c.season[0]?.toUpperCase()}${c.season.slice(1)} at ${p.name}. ${details[hashString32(`${p.id}:${c.dayIndex}:weather`) % details.length]}`;
  const people = rowsOf(world.actors).filter((x) => x.alive && x.placeId === p.id && x.id !== perspective);
  const use = people.length
    ? `${people
        .slice(0, 3)
        .map((x) => `${x.name.given} ${x.name.family}`)
        .join(', ')} ${people.length === 1 ? 'is' : 'are'} here.`
    : `The paths about ${p.name} are quiet.`;
  const layers = [base, weather, use];
  if (isProtectedSite(p)) return layers;
  const skill = a?.sheet.skills.lore_fae ?? 0;
  const signature = world.fae.signatures[p.id];
  const d = content.omens[signature ?? ''];
  // The signature is the place's standing character, not a sign to follow (r2 playtest #7): it says so.
  if (d)
    layers.push(
      `As always here: ${lowerFirst(skill >= 2 || a?.sheet.feats.includes('second_sight') ? d.reading : d.signature)}`,
    );
  if (effectiveFi(world, p) >= 3) layers.push('There is danger here; the ordinary rules feel uncertain.');
  for (const e of episodesAt(world, p.id)) {
    const observation = perspective === null ? undefined : e.observers[perspective];
    if (observation?.noticed && e.end >= world.time) layers.push(observation.reading ?? e.text);
  }
  const residue =
    perspective === null
      ? undefined
      : world.fae.questions[perspective]?.filter((q) => q.placeId === p.id && q.openedAt < world.time).slice(-1)[0];
  if (residue && !episodesAt(world, p.id).some((e) => e.id === residue.signId && e.end >= world.time))
    layers.push(residue.evidence ?? `You remember: ${residue.text} The question is still open; use signs.`);
  if (p.tags.includes('algific')) layers.push(content.omens.ice?.counter ?? 'Cold air rises from the stones.');
  else if (p.tags.includes('iron') || p.tags.includes('ford'))
    layers.push('Iron and running water mark a boundary here.');
  else if (d) layers.push(d.counter);
  return layers;
}

function lowerFirst(text: string): string {
  return /^(A|An|The|Ash|Ice|Cold|Bells|These|People)\b/.test(text)
    ? `${text.charAt(0).toLowerCase()}${text.slice(1)}`
    : text;
}

/** One charm as an actor may know it (13 §5.3 knowledge gating; never omniscient fields). */
export interface CharmCard {
  itemId: number;
  name: string;
  /** held: yours or your household's, to hand; stores: at home in your household's stores;
   * lent: yours, lent out; found: seen lying here; known: someone you believe has it. */
  relation: 'held' | 'stores' | 'lent' | 'borrowed' | 'found' | 'known';
  /** Who has it as you believe (known relation), else null. */
  keeperId: number | null;
  /** Self-known virtue (13 §5.7: a holder knows it as lamp oil is known). */
  virtue: number | null;
  tiedTonight: boolean;
  offeringOut: boolean;
  /** Facts you have verified: construction, effects, counterparty, observed. */
  facts: string[];
  /** What you have heard said of it (claim texts at credence ≥ 40). */
  heard: string[];
  /** The saying that came with it, once you have looked it over. */
  saying: string | null;
  /** Ungated iron arithmetic for your own charm. */
  ironG: number | null;
  status: string;
}

export function charmView(world: World, content: ContentBundle, perspective: ActorId): CharmCard[] {
  const out: CharmCard[] = [];
  const me = world.actors[perspective];
  if (!me || !world.fae.charms) return out;
  for (const key of Object.keys(world.fae.charms).sort((a, b) => Number(a) - Number(b))) {
    const c = world.fae.charms[Number(key)];
    const stack = world.items.stacks[Number(key) as never];
    const def = content.charms?.[c?.defId ?? ''];
    if (!c || !def) continue;
    const name = content.items[c.defId]?.name ?? c.defId;
    const k = world.fae.known?.[perspective]?.[c.itemId] ?? {};
    const facts = (['construction', 'effects', 'counterparty', 'observed'] as const).filter((f) => k[f] !== undefined);
    const heard: string[] = [];
    for (const x of def.claims) {
      const prop = world.belief.propByKey[`claim.${c.defId}.${x.id}(i:${c.itemId})`];
      const b = prop === undefined ? undefined : beliefOf(world, perspective, prop);
      if (b && b.credence >= 40) heard.push(x.text.replace('{0}', 'it'));
    }
    let relation: CharmCard['relation'] | null = null;
    let keeperId: number | null = null;
    if (stack) {
      let cur = stack;
      for (let i = 0; i < 16 && cur.location.kind === 'container'; i++) {
        const up = world.items.stacks[cur.location.itemId];
        if (!up) break;
        cur = up;
      }
      const loc = cur.location;
      if (loc.kind === 'actor' && loc.actorId === perspective) relation = 'held';
      else if (loc.kind === 'household' && loc.householdId === me.householdId) relation = 'stores';
      else if (
        loc.kind === 'place' &&
        loc.placeId === me.placeId &&
        c.reservoir &&
        (c.noticedBy ?? []).includes(perspective)
      )
        relation = 'found';
    }
    const loan = (world.social.objectLoans ?? []).find((l) => l.itemId === c.itemId && l.status === 'open');
    if (relation === null && loan && world.actors[loan.lenderId]?.householdId === me.householdId) relation = 'lent';
    if (
      (relation === 'held' || relation === 'stores') &&
      loan &&
      world.actors[loan.borrowerId]?.householdId === me.householdId
    )
      relation = 'borrowed';
    if (relation === null) {
      // Someone you believe has it (your own belief, not where it is).
      for (const a of Object.values(world.actors)) {
        const prop = world.belief.propByKey[`has(a:${a.id},i:${c.itemId})`];
        const b = prop === undefined ? undefined : beliefOf(world, perspective, prop);
        if (b && b.credence >= 50) {
          relation = 'known';
          keeperId = a.id;
          break;
        }
      }
    }
    if (relation === null) continue;
    const mine = relation === 'held' || relation === 'stores' || relation === 'borrowed';
    const iron = mine && stack ? binIron(world, content, stack) : null;
    const status =
      relation === 'found'
        ? 'Lying here where you found it; take it or leave it.'
        : relation === 'lent'
          ? `Lent to ${world.actors[loan?.borrowerId as never]?.name.given ?? 'a neighbor'}, due back ${loan ? dueText(loan.dueAt) : 'soon'}.`
          : relation === 'known'
            ? `${world.actors[keeperId as never]?.name.given ?? 'Someone'} has it, as you understand it.`
            : `${c.virtue} virtue${c.tie ? '; tied shut for tonight' : ''}${c.offering ? '; porridge set out' : ''}${c.rechargeBlockedUntil > world.time ? '; it will take nothing for now' : ''}${loan ? `; borrowed, due back ${dueText(loan.dueAt)}` : ''}.`;
    out.push({
      itemId: c.itemId,
      name,
      relation,
      keeperId,
      virtue: mine ? c.virtue : null,
      tiedTonight: mine && !!c.tie,
      offeringOut: mine && !!c.offering,
      facts,
      heard,
      saying: facts.includes('construction') || relation === 'found' ? def.saying || null : null,
      ironG: iron ? iron.grams : null,
      status,
    });
  }
  return out;
}

/** "Sunday the 8th, at noon": a due time in words. */
function dueText(t: number): string {
  const c = calendarAt(t as never);
  const day = WEEKDAY_NAMES[weekdayOf(t as never)];
  return `${day} the ${ordinal(c.day)}${c.hour === 12 ? ', at noon' : ''}`;
}
