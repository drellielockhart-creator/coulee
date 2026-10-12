import type { Place } from '../actor.ts';
import type { ContentBundle } from '../content.ts';
import { rowsOf } from '../ids.ts';
import { isRaining } from '../provisions/api.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { effectiveFi } from './api.ts';
import { isProtectedSite } from './sites.ts';
import type { Episode, Snapshot, Window } from './state.ts';
export function windows(place: Place, day: number) {
  const cal = calendarAt(asGameMinute(day * 1440));
  return (
    [
      ['midnight', 0],
      ['dawn', cal.sunriseMinute - 60],
      ['noon', 720],
      ['dusk', cal.sunsetMinute - 60 - (place.tags.includes('coulee') ? 90 : 0)],
    ] as [Window, number][]
  ).map(([period, minute]) => ({ window: period, at: day * 1440 + minute }));
}
export function eligibleFamilies(content: ContentBundle, p: Place, fi: number): string[] {
  if (isProtectedSite(p)) return [];
  return Object.keys(content.omens ?? {})
    .sort()
    .filter((id) => {
      const d = content.omens[id];
      if (!d) return false;
      if (p.tags.includes('algific')) return d.family === 'ice' && fi > 0;
      if (d.family === 'ice') return false;
      if (fi === 0) return d.family === 'providence';
      return fi >= d.fi_min && fi <= d.fi_max && (!d.tags.length || d.tags.some((t) => p.tags.includes(t)));
    });
}
export function snapshotWindow(world: World, ctx: SimContext, p: Place, period: Window, at: number): Snapshot {
  const c = calendarAt(asGameMinute(at)),
    fi = effectiveFi(world, p, asGameMinute(at));
  const families = eligibleFamilies(ctx.content, p, fi);
  const bells =
    c.isSabbath &&
    c.hour >= 6 &&
    c.hour < 13 &&
    rowsOf(world.places).some((b) => {
      const range = ctx.content.places[b.defId]?.bell_range_tiles ?? 0;
      return (
        range > 0 && b.siteId === p.siteId && (b.x - p.x) * (b.x - p.x) + (b.y - p.y) * (b.y - p.y) <= range * range
      );
    });
  const rain = isRaining(ctx.seed, c);
  // Rates share the same ordered multipliers and are rounded only once.
  let factor = { dawn: 700, noon: 150, dusk: 1000, midnight: 600 }[period] / 1000;
  if (c.moon.phase === 'full' && families.some((f) => ['lights', 'bells'].includes(f))) factor *= 2;
  if (c.moon.phase === 'new' && families.includes('echo')) factor *= 1.5;
  if (bells || p.tags.includes('church')) factor = 0;
  else if (c.isSabbath && period === 'dusk') factor *= 1.5;
  if (c.season === 'winter') factor *= 0.6;
  if (rain) factor *= 0.5;
  if (p.tags.includes('spring')) factor *= 2;
  if (p.tags.includes('iron') && families.every((f) => ctx.content.omens[f]?.subtle)) factor *= 0.2;
  let tr = ([0, 40, 180, 350, 600, 850][fi] ?? 0) * factor;
  let lr = ([60, 160, 120, 60, 40, 0][fi] ?? 0) * factor;
  const scale = tr + lr > 950 ? 950 / (tr + lr) : 1;
  tr = Math.round(tr * scale);
  lr = Math.round(lr * scale);
  const leadPlaces = rowsOf(world.places).filter(
    (q) =>
      q.id !== p.id && q.siteId === p.siteId && !isProtectedSite(q) && effectiveFi(world, q, asGameMinute(at)) >= 2,
  );
  leadPlaces.sort(
    (a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - Math.abs(b.x - p.x) - Math.abs(b.y - p.y) || a.id - b.id,
  );
  const leadActors = rowsOf(world.actors)
    .filter((a) => a.alive && a.placeId === p.id)
    .map((a) => a.id);
  return {
    placeId: p.id,
    day: c.dayIndex,
    window: period,
    at,
    fi,
    trueRate: tr,
    lookRate: lr,
    families,
    moon: c.moon.phase,
    rain,
    bells,
    leadPlaces: leadPlaces.map((q) => q.id),
    leadActors,
  };
}
/** Pure snapshot resolution: calling later cannot substitute current conditions. */
export function resolveEpisode(world: World, ctx: SimContext, s: Snapshot): Episode | null {
  const p = world.places[s.placeId];
  if (!p || isProtectedSite(p) || !s.families.length) return null;
  const id = `${s.placeId}:${s.day}:${s.window}`;
  if (!ctx.rngAt) throw new Error('Fae episodes require canonical-time RNG');
  const r = ctx.rngAt('fae', asGameMinute(s.at), mixKey(s.placeId, s.day, hashString32(s.window), 0xfae1));
  const roll = r.int(0, 999);
  if (roll >= s.trueRate + s.lookRate) return null;
  const defId = r.pick(s.families);
  if (!defId) return null;
  const d = ctx.content.omens[defId];
  if (!d) return null;
  const truth = roll < s.trueRate ? 'fae' : 'mundane';
  const variant = r.int(0, d.text.length - 1);
  const candidates: Array<{ weight: number; lead: Episode['lead'] }> = [
    { weight: 600, lead: { kind: 'nothing', placeId: p.id } },
    { weight: 200, lead: { kind: 'trace', placeId: p.id } },
  ];
  const site = s.leadPlaces[0],
    actor = s.leadActors[0];
  if (site !== undefined) candidates.push({ weight: 150, lead: { kind: 'place', placeId: site } });
  if (actor !== undefined) candidates.push({ weight: 50, lead: { kind: 'actor', placeId: p.id, actorId: actor } });
  let draw = r.int(0, candidates.reduce((n, x) => n + x.weight, 0) - 1);
  let lead: Episode['lead'] = { kind: 'nothing', placeId: p.id };
  for (const candidate of candidates) {
    draw -= candidate.weight;
    if (draw < 0) {
      lead = candidate.lead;
      break;
    }
  }
  return {
    id,
    snapshot: s,
    defId,
    family: d.family,
    truth,
    strength: s.fi >= 3 ? 60 : 40,
    end: s.at + d.duration_minutes,
    traceEnd: s.at + d.trace_minutes,
    text: d.text[variant] ?? '',
    plain: r.pick(d.plain) ?? '',
    variant,
    lead,
    observers: {},
    attempts: {},
    witnessed: false,
    eventId: null,
  };
}
