/**
 * Commands: player (or script) actions as data (P2). FOUNDATION-OWNED.
 *
 * Commands are applied at the start of a step, logged as 'core.command' events, and then
 * handled by the owning module during its system, by the SAME rules as AI decisions.
 * Registry pattern as for events: each module declares `XCommand` in its own commands.ts.
 */

import type { ActivityCommand } from './activity/commands.ts';
import type { BeliefCommand } from './belief/commands.ts';
import type { ChronicleCommand } from './chronicle/commands.ts';
import type { FaeCommand } from './fae/commands.ts';
import type { ActorId } from './ids.ts';
import type { NeedsCommand } from './needs/commands.ts';
import type { ProvisionsCommand } from './provisions/commands.ts';
import type { PsycheCommand } from './psyche/commands.ts';
import type { SocialCommand } from './social/commands.ts';
import type { Urge } from './urge.ts';

/** Define one command kind: `CommandOf<'provisions.buy', { itemDefId: string; qty: number }>`. */
export type CommandOf<K extends string, D> = {
  kind: K;
  actorId: ActorId;
  issuer?: import('./psyche/agency.ts').Issuer;
  data: D;
};

export type CoreCommand =
  /**
   * "I want to do X": enters psyche arbitration as a proposal with voice 'command' and
   * very high intensity. The rules may still interfere (P2): e.g. exhaustion.
   */
  CommandOf<'core.urge', { urge: Urge }>;

export type Command =
  | import('./tactical/commands.ts').TacticalCommand
  | FaeCommand
  | CoreCommand
  | NeedsCommand
  | ActivityCommand
  | PsycheCommand
  | SocialCommand
  | BeliefCommand
  | ProvisionsCommand
  | ChronicleCommand;

export type CommandKind = Command['kind'];

/** Commands of one module, by kind prefix: `commandsFor(ctx.commands, 'provisions.')`. */
export function commandsFor<P extends string>(
  commands: readonly Command[],
  prefix: P,
): Extract<Command, { kind: `${P}${string}` }>[] {
  return commands.filter((c) => c.kind.startsWith(prefix)) as Extract<Command, { kind: `${P}${string}` }>[];
}
