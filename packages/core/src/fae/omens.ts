import { isAsleep } from '../activity/api.ts';
import { abilityMod } from '../actor.ts';
import { beliefOf, internProp, observe } from '../belief/api.ts';
import { resolveCheck } from '../checks.ts';
import type { ActorId } from '../ids.ts';
import { asEventId, rowsOf } from '../ids.ts';
import { addAnxiety, addThought } from '../psyche/api.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { addMemory } from '../social/api.ts';
import { asGameMinute } from '../time.ts';
import type { World } from '../world.ts';
import type { Episode } from './state.ts';
export function omenCheck(
  world: World,
  ctx: SimContext,
  e: Episode,
  id: ActorId,
  skill: string,
  dc: number,
  salt: number,
) {
  if (!ctx.rngAt) throw new Error('Fae checks require canonical-time RNG');
  const a = world.actors[id];
  const ability = ctx.content.skills[skill]?.ability ?? (skill === 'perception' ? 'wis' : 'int');
  return resolveCheck(
    {
      label: skill.replaceAll('_', ' '),
      kind: 'skill',
      subjects: [id],
      knowledge: 'self',
      terms: [
        {
          source: 'ability',
          label: ability,
          value: abilityMod(a?.sheet.abilities[ability] ?? 10),
        },
        { source: 'ranks', label: skill, value: a?.sheet.skills[skill] ?? 0 },
      ],
      dc,
    },
    ctx.rngAt('checks', asGameMinute(e.snapshot.at), mixKey(hashString32(e.id), id, salt)),
  );
}
export function noticeEpisode(world: World, ctx: SimContext, e: Episode): void {
  const d = ctx.content.omens[e.defId];
  if (!d) return;
  const present = rowsOf(world.actors).filter(
    (a) => a.alive && a.placeId === e.snapshot.placeId && !isAsleep(world, ctx, a.id),
  );
  present.sort((a, b) => mixKey(hashString32(e.id), a.id) - mixKey(hashString32(e.id), b.id) || a.id - b.id);
  const newcomers: ActorId[] = [];
  for (const a of present.slice(0, 6)) {
    if (e.observers[a.id]) continue;
    const cooldown = `actor:${a.id}:${e.family}`;
    if ((world.fae.cooldowns[cooldown] ?? -10000) > ctx.now) continue;
    const result = omenCheck(world, ctx, e, a.id, 'perception', d.notice_dc, 0xfae2);
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
    newcomers.push(a.id);
  }
  if (!newcomers.length) return;
  if (!e.witnessed) {
    e.witnessed = true;
    if (e.truth === 'fae')
      world.fae.thinning[e.snapshot.placeId] = Math.max(
        0,
        Math.min(299, (world.fae.thinning[e.snapshot.placeId] ?? 0) + d.thins),
      );
    e.eventId = ctx.emit({
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
  }
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
  const plain = omenCheck(world, ctx, e, id, 'lore_nature', d.plain_dc, 0xfae4);
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
    children: [fae.explain, plain.explain],
  };
  const prop = internProp(world, 'fae_abroad', [{ kind: 'place', id: e.snapshot.placeId }]);
  e.propId = prop;
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
