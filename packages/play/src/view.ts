/** Fair readings of another person's manner (00 decision, 2026-10-13; 08 #13). */
import {
  type ActorId,
  type ContentBundle,
  mixKey,
  rng,
  skillCheck,
  social,
  term,
  toViewModel,
  type ViewOptions,
  type World,
} from '@coulee/core';

import type { KnownEvent } from './observation.ts';

const BANDS = ['hostile', 'cool', 'civil', 'friendly', 'warm'] as const;
const WORDS = [
  ['has little good will for you', 'would sooner give you a hard word'],
  ['is cool toward you', 'keeps you at arm’s length'],
  ['is civil toward you', 'offers you ordinary courtesy'],
  ['is friendly toward you', 'is well disposed toward you'],
  ['has a warm regard for you', 'takes kindly to you'],
] as const;

/** One daily draw per directed pair. Queries never change the sim or consume its streams. */
export function regardOf(
  world: World,
  content: ContentBundle,
  viewer: ActorId,
  target: ActorId,
  god = false,
  knowledge: readonly KnownEvent[] = [],
): social.RegardView | undefined {
  const pc = world.actors[viewer];
  const other = world.actors[target];
  if (!pc || !other || viewer === target) return undefined;
  // A familiar name is not a sightline: fair inspect cannot read a distant mind.
  if (!god && pc.placeId !== other.placeId) return undefined;
  const op = social.opinionOf(world, target, viewer);
  const score = Math.round((op.affection + op.trust) / 2);
  let band = score <= -40 ? 0 : score < -10 ? 1 : score < 10 ? 2 : score < 40 ? 3 : 4;
  const day = Math.floor(world.time / 1440);
  const r = rng(world.meta.seed, 'checks', day, mixKey(viewer, target, 0x52454741));
  const familiarity = social.familiarityOf(world, viewer, target);
  const guarded = Math.max(0, other.values.discretion ?? 0);
  const check = skillCheck(
    content,
    pc,
    {
      label: 'Perception: reading their manner',
      skill: 'perception',
      dc: 10,
      modifiers: [term('familiarity', 'Time spent in their company', Math.floor(familiarity / 200))],
      dcTerms: [
        term('familiarity', 'Little acquaintance', familiarity < 200 ? 5 : 0),
        term('condition', 'A guarded manner', guarded),
      ],
      knowledge: 'self',
    },
    r,
  );
  // A failed reading shifts one band; the offset and wording stay fixed all day.
  // Actual deeds can still change the underlying band within that day.
  const offset = r.int(0, 1) === 0 ? -1 : 1;
  if (!god && !check.success) band = Math.max(0, Math.min(4, band + offset));
  const variant = r.int(0, 1);
  const ownMemories = social.memoriesOf(world, viewer);
  const targetMemories = new Map(social.memoriesOf(world, target).map((m) => [m.id, m]));
  const reasons: string[] = [];
  for (const reason of social.reasonsOf(world, target, viewer)) {
    if (reason.viaDefense !== undefined || reason.cites.kind !== 'memory') continue;
    const memory = targetMemories.get(reason.cites.id);
    if (!memory || memory.eventId === null) continue;
    // Use the viewer's account of the deed, never the other mind's interpretation.
    const known = ownMemories.find(
      (m) =>
        m.eventId === memory.eventId &&
        (m.source.kind === 'witnessed' || m.source.kind === 'overheard') &&
        m.roles.some((role) => role.who === viewer && role.role === 'agent'),
    );
    const archived = knowledge.find(
      (e) => e.id === memory.eventId && e.deed?.agentId === viewer && e.deed.targetIds.includes(target),
    );
    const summary = known?.summary ?? archived?.summary;
    if (summary && !reasons.includes(summary)) reasons.push(summary);
  }
  const truthView = god
    ? social
        .viewSocialActor(world, content, target, {
          perspective: viewer,
          omniscient: true,
          includeExplain: true,
          recentChronicle: 0,
        })
        .opinions.find((o) => o.targetId === viewer)
    : undefined;
  const record = god ? world.social.opinions[target]?.[viewer] : undefined;
  return {
    band: BANDS[band] ?? 'civil',
    phrase: WORDS[band]?.[variant] ?? 'offers you ordinary courtesy',
    reasons,
    explain: {
      ...check.explain,
      // Show the reading's difficulty, without publishing a private Discretion value.
      ...(!god
        ? {
            dc: {
              total: check.explain.dc?.total ?? 10,
              terms: [term('base', 'Difficulty reading their manner', check.explain.dc?.total ?? 10)],
            },
          }
        : {}),
      note: 'A fallible impression; the die is fixed for today.',
    },
    ...(god
      ? {
          truth: {
            opinion: op,
            base: { ...(record?.base ?? op) },
            volatile: { ...(record?.volatile ?? { affection: 0, respect: 0, trust: 0, fear: 0 }) },
            reasons: truthView?.reasons ?? [],
          },
        }
      : {}),
  };
}

/** Web snapshots use the same impressions as inspect, with no exact NPC labels or axes. */
export function playViewModel(
  world: World,
  content: ContentBundle,
  opts: ViewOptions,
  knowledge: readonly KnownEvent[] = [],
) {
  const vm = toViewModel(world, content, opts);
  const viewer = opts.perspective ?? world.meta.playerId;
  const god = opts.omniscient || opts.perspective === null;
  if (viewer === null) return vm;
  for (const actor of vm.actors) {
    if (actor.id === viewer) continue;
    actor.social = {
      ...actor.social,
      ...(!god ? { opinions: [] } : {}),
      regard: regardOf(world, content, viewer, actor.id, god, knowledge),
    };
  }
  return vm;
}
