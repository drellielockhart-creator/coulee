/** Shell queries are Commands too; they consume no simulation time. */
import type { CommandOf } from '../command.ts';
export type ActivityCommand =
  | CommandOf<'activity.observe', { query: 'look' | 'inspect' | 'plan' | 'journal' | 'explain'; target?: string }>
  | CommandOf<'activity.wait', { minutes: number; untilTime?: number; untilEvent?: string }>;
