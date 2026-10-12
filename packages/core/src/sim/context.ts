/**
 * Contexts passed to module init and system functions. FOUNDATION-OWNED.
 */
import type { Command } from '../command.ts';
import type { ContentBundle, ScenarioDef } from '../content.ts';
import type { EventInput } from '../events/index.ts';
import type { EventId } from '../ids.ts';
import type { Rng, Stream } from '../rng.ts';
import type { CalendarInfo, GameMinute } from '../time.ts';

/** Everything a system needs besides the world. Built fresh each hour by the sim loop. */
export interface SimContext {
  readonly content: ContentBundle;
  readonly seed: number;
  /** Start of the hour being simulated. */
  readonly now: GameMinute;
  readonly cal: CalendarInfo;
  /** True on the first hour of a day (00:00): run daily bookkeeping then. */
  readonly isNewDay: boolean;
  /** Commands applied this step (already logged as 'core.command'). */
  readonly commands: readonly Command[];
  /**
   * Keyed generator bound to (seed, stream, now). Build keys from the entities involved:
   * `ctx.rng('social', mixKey(actorA, actorB, SALT))`. Never reuse one Rng across decisions.
   */
  rng(stream: Stream, key: number): Rng;
  rngAt?(stream: Stream, at: GameMinute, key: number): Rng;
  /** Append an event; returns its id. Defaults: t = now, roles = [], visibility = 'public'. */
  emit(event: EventInput): EventId;
}

/** Context for `initXState(world, ctx)` when a world is created from a scenario. */
export interface InitContext {
  readonly content: ContentBundle;
  readonly scenario: ScenarioDef;
  readonly seed: number;
  readonly now: GameMinute;
  rng(stream: Stream, key: number): Rng;
  rngAt?(stream: Stream, at: GameMinute, key: number): Rng;
  emit(event: EventInput): EventId;
}
