/** One social handoff per pair/scene, independent of the rolling event window. */
import { displayName } from '../actor.ts';
import type { ActorId, EventId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { addMemory, addOpinionReason, areKin } from './api.ts';
import { noteStrife } from './strife.ts';

export function recordCombatOutcome(
  w: World,
  ctx: SimContext,
  incident: {
    key: string;
    a: ActorId;
    b: ActorId;
    eventId: EventId;
    text: string;
    outcome: string;
    witnesses: ActorId[];
  },
): boolean {
  w.social.combatIncidents ??= {};
  if (w.social.combatIncidents[incident.key]) return false;
  // Keep a bounded recent archive; active-scene deduplication also lives on its episodes.
  const keys = Object.keys(w.social.combatIncidents).sort(
    (a, b) =>
      (w.social.combatIncidents?.[a]?.at ?? 0) - (w.social.combatIncidents?.[b]?.at ?? 0) ||
      (a < b ? -1 : a > b ? 1 : 0),
  );
  for (const key of keys.slice(0, Math.max(0, keys.length - 255))) delete w.social.combatIncidents[key];
  w.social.combatIncidents[incident.key] = { ...incident, at: ctx.now };
  noteStrife(w, ctx, incident.a, incident.b, true, incident.eventId, areKin(w, incident.a, incident.b));
  const name = (id: ActorId) => {
    const actor = w.actors[id];
    return actor ? displayName(actor) : 'someone';
  };
  for (const id of incident.witnesses) {
    const other = id === incident.a ? incident.b : incident.a;
    const memory = addMemory(w, ctx, {
      ownerId: id,
      eventId: incident.eventId,
      kind: 'fight',
      at: ctx.now,
      placeId: w.actors[id]?.placeId ?? null,
      roles: [
        { who: incident.a, role: 'agent', conf: 1000 },
        { who: incident.b, role: 'target', conf: 1000 },
      ],
      source: { kind: 'witnessed' },
      emotion: 'anger',
      intensity: 75,
      salience: 750,
      confidence: 1000,
      rehearsals: 0,
      pinned: false,
      summary:
        id === incident.a || id === incident.b
          ? `Came to blows with ${name(other)}`
          : `Saw ${name(incident.a)} fight ${name(incident.b)}`,
      aboutId: other,
    });
    if (memory && (id === incident.a || id === incident.b)) {
      const delta =
        id === incident.b
          ? ctx.content.interactions.fight?.success.target_opinion
          : ctx.content.interactions.fight?.success.initiator_opinion;
      addOpinionReason(w, ctx, id, other, {
        label: id === incident.b ? 'Came to blows with me' : 'We came to blows',
        cites: { kind: 'memory', id: memory },
        since: ctx.now,
        delta: {
          affection: delta?.affection ?? (id === incident.b ? -10 : 0),
          respect: delta?.respect ?? (id === incident.b ? 3 : 0),
          trust: delta?.trust ?? 0,
          fear: delta?.fear ?? (id === incident.b ? 10 : 0),
        },
      });
    }
  }
  return true;
}
