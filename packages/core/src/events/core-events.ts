/**
 * Events emitted by the foundation itself (sim loop, commands). FOUNDATION-OWNED.
 */
import type { Command } from '../command.ts';
import type { MoonPhase, Season, Weekday } from '../time.ts';
import type { EventOf } from './base.ts';

export type CoreEvent =
  /** Emitted at 00:00 of every simulated day (before any system runs that hour). */
  | EventOf<
      'core.day_started',
      {
        dayIndex: number;
        year: number;
        month: number;
        day: number;
        weekday: Weekday;
        season: Season;
        moon: MoonPhase;
        isSabbath: boolean;
      }
    >
  /** Every Command applied this step is logged first, so a run replays from seed + log. */
  | EventOf<'core.command', { command: Command }>
  /** Scenario loaded and world initialized. */
  | EventOf<'core.world_created', { scenarioId: string; seed: number; actorCount: number }>;
