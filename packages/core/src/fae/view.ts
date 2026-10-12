import { beliefOf } from '../belief/api.ts';
import type { ContentBundle } from '../content.ts';
import type { ActorId, PlaceId } from '../ids.ts';
import { rowsOf } from '../ids.ts';
import { hashString32 } from '../rng.ts';
import { calendarAt } from '../time.ts';
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
  if (d) layers.push(skill >= 2 || a?.sheet.feats.includes('second_sight') ? d.reading : d.signature);
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
