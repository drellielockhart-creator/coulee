import { isAsleep } from '../activity/api.ts';
import { beliefOf, internProp, observe } from '../belief/api.ts';
import { skillCheck } from '../checks.ts';
import { noteNudge } from '../director/api.ts';
import { type ExplainTerm, term } from '../explain.ts';
import type { ActorId } from '../ids.ts';
import { asEventId } from '../ids.ts';
import { addAnxiety, addThought, psycheOf } from '../psyche/api.ts';
import { processingActors } from '../region/processing.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { addMemory } from '../social/api.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { thresholdTilt } from './api.ts';
import type { Episode } from './state.ts';
export function omenCheck(
  world: World,
  ctx: SimContext,
  e: Episode,
  id: ActorId,
  skill: string,
  dc: number,
  salt: number,
  extraDc: ExplainTerm[] = [],
) {
  if (!ctx.rngAt) throw new Error('Fae checks require canonical-time RNG');
  const a = world.actors[id];
  if (!a) throw new Error('Missing omen observer');
  const modifiers = [],
    dcTerms = [];
  const d = ctx.content.omens[e.defId];
  if (skill === 'perception' && salt === 0xfae2) {
    const people = ctx.content.peoples[a.ancestryId];
    const drift = world.fae.drift?.[id] ?? people?.fae.drift_floor ?? 0;
    modifiers.push(term('drift', 'Drift', Math.min(3, Math.floor(drift / 20))));
    if (a.sheet.feats.includes('second_sight') || people?.senses.includes('second_sight'))
      modifiers.push(term('sense', 'Second Sight', 5));
    if (d?.glamour && (a.traits.includes('see_the_seam') || people?.traits.includes('see_the_seam')))
      modifiers.push(term('sense', 'See the Seam', 4));
    if (d?.deep_sense && (a.traits.includes('deep_sense') || people?.traits.includes('deep_sense')))
      modifiers.push(term('sense', 'Deep Sense', 2));
    const c = calendarAt(ctx.now);
    const minute = ((ctx.now % 1440) + 1440) % 1440;
    const indoors = world.places[a.placeId]?.tags.some((t) =>
      ['home', 'store', 'mill', 'tavern', 'church'].includes(t),
    );
    if (d?.sight && !indoors && !people?.senses.includes('darkvision')) {
      const dark = minute < c.sunriseMinute - 60 || minute > c.sunsetMinute + 35;
      const dusk = minute < c.sunriseMinute || minute > c.sunsetMinute - 60;
      const light = dark ? (c.moon.phase === 'new' ? 10 : people?.senses.includes('low_light') ? 2 : 5) : dusk ? 2 : 0;
      dcTerms.push(term('light', dark ? 'Night light' : 'Dusk light', light));
    }
    if (!indoors)
      dcTerms.push(
        term(
          'weather',
          e.snapshot.thunder ? 'Heavy rain' : e.snapshot.fog ? 'Valley fog' : 'Rain',
          e.snapshot.thunder ? 5 : e.snapshot.rain || e.snapshot.fog ? 2 : 0,
        ),
      );
  }
  dcTerms.push(...extraDc);
  return skillCheck(
    ctx.content,
    a,
    { label: skill.replaceAll('_', ' '), skill, dc, modifiers, dcTerms, knowledge: 'self' },
    ctx.rngAt('checks', asGameMinute(e.snapshot.at), mixKey(hashString32(e.id), id, salt)),
  );
}
export function noticeEpisode(world: World, ctx: SimContext, e: Episode): void {
  const d = ctx.content.omens[e.defId];
  if (!d) return;
  if (!e.witnessed && (world.fae.cooldowns[`place:${e.snapshot.placeId}:${e.family}`] ?? -1) > ctx.now) return;
  const present = processingActors(world).filter(
    (a) => a.alive && a.placeId === e.snapshot.placeId && !isAsleep(world, ctx, a.id),
  );
  present.sort((a, b) => mixKey(hashString32(e.id), a.id) - mixKey(hashString32(e.id), b.id) || a.id - b.id);
  const newcomers: ActorId[] = [];
  for (const a of present.slice(0, 6)) {
    if (e.observers[a.id]) continue;
    if ((world.fae.cooldowns[`text:actor:${a.id}:${e.text}`] ?? -1) > ctx.now) continue;
    const cooldown = `actor:${a.id}:${e.family}`;
    if ((world.fae.cooldowns[cooldown] ?? -10000) > ctx.now) continue;
    // N9 (Director discovery steer): at most DC −2 on noticing, never where the PC could see.
    const tilt = thresholdTilt(world, 'fae.notice', e.snapshot.placeId, [a.id], [e.snapshot.placeId]);
    const result = omenCheck(
      world,
      ctx,
      e,
      a.id,
      'perception',
      d.notice_dc,
      0xfae2,
      tilt ? [term('director', 'Director discovery steer (N9)', -tilt.amount)] : [],
    );
    if (tilt && result.success && result.margin < tilt.amount)
      noteNudge(world, tilt.bias, a.id, 'unnoticed', 'noticed', true);
    e.observers[a.id] = {
      noticed: result.success,
      read: false,
      reading: null,
      notice: result.explain,
      interpretation: null,
      at: ctx.now,
    };
    if (!result.success) continue;
    world.fae.cooldowns[cooldown] = ctx.now + 360;
    world.fae.cooldowns[`text:actor:${a.id}:${e.text}`] = ctx.now + 10080;
    newcomers.push(a.id);
  }
  if (!newcomers.length) return;
  if (!e.witnessed) {
    e.witnessed = true;
    world.fae.cooldowns[`place:${e.snapshot.placeId}:${e.family}`] = ctx.now + 1440;
    if (e.truth === 'fae')
      world.fae.thinning[e.snapshot.placeId] = Math.max(
        0,
        Math.min(299, (world.fae.thinning[e.snapshot.placeId] ?? 0) + d.thins),
      );
  }
  const noticeEventId = ctx.emit({
    kind: 'fae.omen',
    place: e.snapshot.placeId,
    visibility: 'witnessed',
    importance: 20,
    roles: newcomers.map((actor) => ({ actor, role: 'witness' })),
    data: {
      signId: e.id,
      placeId: e.snapshot.placeId,
      family: e.family,
      text: e.text,
      witnesses: newcomers,
      truth: e.truth,
    },
    explain: {
      kind: 'choice',
      label: 'An uncertain sign',
      subjects: newcomers,
      knowledge: 'participants',
      terms: [],
      total: 0,
      outcome: 'noticed',
      children: [
        ...newcomers.flatMap((id) => e.observers[id]?.notice ?? []),
        {
          kind: 'formula',
          label: 'Episode truth',
          subjects: [],
          knowledge: 'omniscient',
          terms: [],
          total: e.snapshot.trueRate,
          outcome: e.truth,
        },
      ],
    },
  });
  e.eventId ??= noticeEventId;
  for (const id of newcomers) {
    const o = e.observers[id];
    if (!o) continue;
    const q = {
      signId: e.id,
      placeId: e.snapshot.placeId,
      text: e.text,
      openedAt: ctx.now,
      closedAt: null,
      evidence: null,
    };
    world.fae.questions[id] ??= [];
    world.fae.questions[id].push(q);
    addMemory(world, ctx, {
      ownerId: id,
      eventId: e.eventId === null ? null : asEventId(e.eventId),
      kind: 'omen',
      at: ctx.now,
      placeId: e.snapshot.placeId,
      roles: [],
      source: { kind: 'witnessed' },
      emotion: e.family === 'ice' ? 'awe' : 'fear',
      intensity: e.strength,
      salience: 600,
      confidence: 600,
      rehearsals: 0,
      pinned: false,
      summary: e.text,
    });
    addAnxiety(world, ctx, id, e.family === 'ice' ? -10 : 10);
    addThought(world, ctx, id, {
      voice: 'id',
      urge: { kind: 'activity', activityId: 'idle_at_home' },
      intensity: e.family === 'ice' ? 120 : 250,
      label: e.family === 'ice' ? 'Stay a little by the cold stones.' : 'I should tell someone what I saw.',
      source: 'fae',
      drive: e.family === 'ice' ? 'longing' : 'fear',
      reasons: [{ source: 'fae', label: e.text, value: e.strength }],
    });
    readEpisode(world, ctx, e, id);
  }
}
export function readEpisode(world: World, ctx: SimContext, e: Episode, id: ActorId): void {
  const o = e.observers[id],
    d = ctx.content.omens[e.defId];
  if (!o || !d) return;
  const fae = omenCheck(world, ctx, e, id, 'lore_fae', d.read_dc, 0xfae3);
  const a = world.actors[id];
  const plainSkills = [
    'lore_nature',
    'woodcraft',
    ...Object.keys(a?.sheet.skills ?? {}).filter((s) => s.startsWith('trade_')),
  ].sort((x, y) => (a?.sheet.skills[y] ?? 0) - (a?.sheet.skills[x] ?? 0) || (x < y ? -1 : x > y ? 1 : 0));
  const plain = omenCheck(world, ctx, e, id, plainSkills[0] ?? 'lore_nature', d.plain_dc, 0xfae4);
  const result = e.truth === 'fae' ? fae : plain;
  o.read = result.success;
  o.reading = result.success ? (e.truth === 'fae' ? d.reading : e.plain) : null;
  o.interpretation = {
    kind: 'choice',
    label: 'Reading the sign',
    subjects: [id],
    knowledge: 'self',
    terms: [],
    total: 0,
    outcome: o.reading ?? 'You cannot say what it was.',
    children: [
      { ...fae.explain, knowledge: 'omniscient' },
      { ...plain.explain, knowledge: 'omniscient' },
    ],
  };
  const superstition = a?.values.superstition ?? 0;
  const drift = world.fae.drift?.[id] ?? 0;
  const weights = [
    {
      pred: 'fae_abroad',
      weight: Math.max(0, 100 + 40 * superstition + 10 * (a?.sheet.skills.lore_fae ?? 0) + Math.floor(drift / 2)),
    },
    { pred: 'natural_sign', weight: Math.max(20, 100 + 10 * (a?.sheet.skills.lore_nature ?? 0) - 30 * superstition) },
    ...(e.snapshot.fi <= 1 ? [{ pred: 'portent', weight: 50 + (psycheOf(world, id)?.norms.piety ?? 0) }] : []),
  ].sort((x, y) => y.weight - x.weight || (x.pred < y.pred ? -1 : 1));
  const leader = weights[0];
  const sum = weights.reduce((n, x) => n + x.weight, 0);
  const attribution =
    leader && leader.weight * 1000 >= sum * 350 && leader.weight * 2 >= (weights[1]?.weight ?? 0) * 3
      ? leader.pred
      : null;
  o.interpretation.children?.push({
    kind: 'choice',
    label: 'Tentative attribution (not identifying evidence)',
    subjects: [id],
    knowledge: 'self',
    terms: weights.map((x) => term('attribution', x.pred.replaceAll('_', ' '), x.weight)),
    total: leader?.weight ?? 0,
    outcome: result.success
      ? 'Identifying evidence supersedes these inclinations'
      : (attribution ?? 'No attribution has a clear lead'),
    note: 'A leading weight needs 350 per mille of the total and a three-to-two lead over the next.',
  });
  if (!result.success && attribution && attribution !== 'fae_abroad') {
    const candidate = internProp(
      world,
      attribution,
      attribution === 'portent' ? [{ kind: 'actor', id }] : [{ kind: 'place', id: e.snapshot.placeId }],
    );
    observe(world, ctx, id, candidate, {
      type: 'inference',
      sourceId: null,
      eventId: e.eventId === null ? null : asEventId(e.eventId),
      scalePct: 45,
      dir: 1,
    });
  }
  const prop = internProp(world, 'fae_abroad', [{ kind: 'place', id: e.snapshot.placeId }]);
  e.propId = prop;
  if (result.success || attribution === 'fae_abroad')
    observe(world, ctx, id, prop, {
      type: result.success ? 'observation' : 'inference',
      sourceId: null,
      eventId: e.eventId === null ? null : asEventId(e.eventId),
      scalePct: result.success ? 100 : 45,
      dir: result.success && e.truth === 'mundane' ? -1 : 1,
    });
  ctx.emit({
    kind: 'fae.read',
    data: {
      signId: e.id,
      actorId: id,
      text: o.reading ?? 'You cannot say what it was. An open question remains; use signs.',
    },
    roles: [{ actor: id, role: 'witness' }],
    visibility: 'private',
    explain: o.interpretation,
  });
  // An initial low prior never closes a question. A successful read is actual evidence.
  const credence = beliefOf(world, id, prop)?.credence ?? 50;
  if (result.success) closeQuestion(world, id, e.id, ctx.now, o.reading ?? '', credence >= 70 || credence <= 30);
  else if ((beliefOf(world, id, prop)?.credence ?? 0) >= 70) {
    /* uncertainty remains until later evidence */
  }
}
export function closeQuestion(
  world: World,
  id: ActorId,
  signId: string,
  at: number,
  evidence: string,
  verified: boolean,
): void {
  const q = world.fae.questions[id]?.find((q) => q.signId === signId);
  if (q && q.closedAt === null && verified && at >= q.openedAt) {
    q.closedAt = at;
    q.evidence = evidence;
  }
}
