/** Omen prose consumes only witnessed text; truth never enters fair chronicles. */
import type { Event } from '../events/index.ts';
import { newDraft, writeEntry } from './entries.ts';
import type { DetectCtx } from './patterns/types.ts';
export function omenEntries(dc: DetectCtx, e: Extract<Event, { kind: 'fae.omen' }>): void {
  const st = dc.world.chronicle;
  const day = Math.floor(e.t / 1440),
    week = Math.floor(day / 7);
  st.omenPeriods ??= {};
  st.omenCounts ??= {};
  const periods = st.omenPeriods;
  const counts = st.omenCounts;
  const bindFor = (voice: string) => {
    const edition = (counts[voice] ?? 0) % 12;
    counts[voice] = (counts[voice] ?? 0) + 1;
    return { ...base.bind, edition };
  };
  const witnesses = e.data.witnesses;
  const place = dc.world.places[e.data.placeId]?.name ?? 'the coulee';
  const base = {
    key: 'fae.omen',
    importance: 20,
    t: e.t,
    tEnd: e.t,
    sources: [e.id],
    placeIds: [e.data.placeId],
    actorIds: witnesses,
    knownBy: witnesses,
    topics: ['omens'],
    bind: { omen: e.data.text, place },
    fallback: `At ${place}: ${e.data.text}`,
  };
  const pc = dc.pcId;
  if (witnesses.includes(pc as never) && periods[`omen:journal:${pc}`] !== day + 1) {
    periods[`omen:journal:${pc}`] = day + 1;
    writeEntry(dc, newDraft({ ...base, bind: bindFor('journal'), voice: 'journal', basis: 'witnessed', authorId: pc }));
  }
  for (const key of Object.keys(periods).sort())
    if (key.startsWith('omen:text:') && (periods[key] ?? 0) <= e.t) delete periods[key];
  if (periods['omen:almanac'] !== week + 1 && !periods[`omen:text:published:${e.data.text}`]) {
    periods['omen:almanac'] = week + 1;
    periods[`omen:text:published:${e.data.text}`] = e.t + 43200;
    writeEntry(
      dc,
      newDraft({ ...base, bind: bindFor('almanac'), voice: 'almanac', basis: 'witnessed', kind: 'digest' }),
    );
  }
  if (witnesses.length >= 3 && periods['omen:paper'] !== week + 1 && !periods[`omen:text:published:${e.data.text}`]) {
    periods['omen:paper'] = week + 1;
    periods[`omen:text:published:${e.data.text}`] = e.t + 43200;
    writeEntry(dc, newDraft({ ...base, bind: bindFor('paper'), voice: 'paper', basis: 'witnessed' }));
  }
}
