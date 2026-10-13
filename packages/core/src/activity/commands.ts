/** Shell queries are Commands too; they consume no simulation time. */
import type { CommandOf } from '../command.ts';
export type ActivityCommand =
  | CommandOf<'activity.travel', import('./travel.ts').TravelOrder>
  | CommandOf<'activity.stop' | 'activity.resume' | 'activity.turn_back' | 'activity.camp', Record<string, never>>
  | CommandOf<
      'activity.observe',
      { query: 'look' | 'inspect' | 'plan' | 'journal' | 'explain' | 'route'; target?: string }
    >
  | CommandOf<'activity.wait', { minutes: number; untilTime?: number; untilEvent?: string }>;
