/**
 * Psyche cross-module API. OWNER: module:psyche.
 */
import { type ActorId, rowsOf, type ThoughtId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { ChosenUrge, UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import type { ActorPsyche } from './state.ts';

/** This hour's arbitration result for an actor (read by activity and social). */
export function chosenUrge(world: World, actorId: ActorId): ChosenUrge | null {
  return world.psyche.byActor[actorId]?.chosen ?? null;
}

export function psycheOf(world: World, actorId: ActorId): ActorPsyche | undefined {
  return world.psyche.byActor[actorId];
}

/**
 * Inject a thought from outside the hourly proposal pass (e.g. social: after an insult the
 * Id voices "hit him"; belief: dread after hearing a witch rumor). Returns its id. STUB.
 */
export function addThought(
  _world: World,
  _ctx: SimContext,
  _actorId: ActorId,
  _proposal: UrgeProposal,
): ThoughtId | null {
  return null; // STUB
}

/** Add (or relieve, if negative) anxiety 0..1000, e.g. from a frightening event. */
export function addAnxiety(world: World, _ctx: SimContext, actorId: ActorId, delta: number): number {
  const p = world.psyche.byActor[actorId];
  if (!p) return 0;
  p.anxiety = Math.max(0, Math.min(1000, p.anxiety + Math.round(delta)));
  return p.anxiety;
}

/** Command-only arbitration fallback for hosts running the unfinished psyche system.
 * No controller branch. A complete psyche pass can replace this choice normally.
 * Clear only expired fallback choices, never choices from another implementation.
 */
export function supplyCommandFallback(world: World, ctx: SimContext): void {
  for (const p of rowsOf(world.psyche.byActor)) {
    if (p.chosen?.explain.note === 'headless-command-fallback' && p.chosen.at < ctx.now) p.chosen = null;
  }
  for (const command of ctx.commands) {
    if (command.kind !== 'core.urge') continue;
    const p = world.psyche.byActor[command.actorId];
    if (!p) continue;
    p.chosen = {
      urge: command.data.urge,
      voice: 'command',
      compromise: false,
      at: ctx.now,
      explain: {
        kind: 'arbitration',
        label: 'Self-Command',
        subjects: [command.actorId],
        knowledge: 'self',
        terms: [{ source: 'command', label: 'Explicit intention', value: 1000 }],
        total: 1000,
        outcome: 'chosen',
        note: 'headless-command-fallback',
      },
    };
  }
}
