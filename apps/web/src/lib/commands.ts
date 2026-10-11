/**
 * Every player action in the UI is built here as a Command (ADR 0002 parity rule) and sent to
 * the worker as a `command` message. The headless REPL can issue exactly the same values.
 * OWNER: module:web. Pure: no rules, no validation beyond shape (the sim decides).
 */
import type { ActorId, Command, HouseholdId, ItemId, PlaceId } from '@coulee/core';

export const cmd = {
  /** "I want to do X" (11 §2.1 Act). Enters psyche as a 'command' proposal (P2). */
  doActivity(actorId: ActorId, activityId: string, placeId?: PlaceId): Command {
    return {
      kind: 'core.urge',
      actorId,
      data: {
        urge: placeId === undefined ? { kind: 'activity', activityId } : { kind: 'activity', activityId, placeId },
      },
    };
  },
  interact(actorId: ActorId, interactionId: string, targetId: ActorId): Command {
    return { kind: 'core.urge', actorId, data: { urge: { kind: 'interaction', interactionId, targetId } } };
  },
  buy(actorId: ActorId, placeId: PlaceId, defId: string, qty: number, onCredit: boolean): Command {
    return { kind: 'provisions.buy', actorId, data: { placeId, defId, qty, onCredit } };
  },
  eat(actorId: ActorId, itemId: ItemId, method: string, servings: number): Command {
    return { kind: 'provisions.eat', actorId, data: { itemId, method, servings } };
  },
  /** A ration is a standing order to the character, not a UI preference (11 §2.8). */
  setRations(actorId: ActorId, householdId: HouseholdId | null, rationPct: number): Command {
    return { kind: 'provisions.set_rations', actorId, data: { householdId, rationPct } };
  },
  pack(actorId: ActorId, itemId: ItemId, qty: number, intoItemId: ItemId | null): Command {
    return { kind: 'provisions.pack', actorId, data: { itemId, qty, intoItemId } };
  },
};
