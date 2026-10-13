/** One social handoff per pair/episode, independent of the rolling event window. */
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
  w.social.combatIncidents[incident.key] = { ...incident, at: ctx.now };
  noteStrife(w, ctx, incident.a, incident.b, true, incident.eventId, areKin(w, incident.a, incident.b));
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
      summary: incident.text,
      aboutId: other,
    });
    if (memory && (id === incident.a || id === incident.b)) {
      const delta = ctx.content.interactions.fight?.success.target_opinion;
      addOpinionReason(w, ctx, id, other, {
        label: incident.text,
        cites: { kind: 'memory', id: memory },
        since: ctx.now,
        delta: {
          affection: delta?.affection ?? -10,
          respect: delta?.respect ?? 3,
          trust: delta?.trust ?? 0,
          fear: delta?.fear ?? 10,
        },
      });
    }
  }
  return true;
}
