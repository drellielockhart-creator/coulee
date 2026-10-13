import type { EventOf } from '../events/base.ts';
import type { Pacing } from './state.ts';
/** Stored only in director.events, with slice-local IDs: never shifts causal sim event IDs. */
export type DirectorEvent = EventOf<
  'director.tension',
  {
    tau: number;
    tau_fast: number;
    tau_slow: number;
    pacing: Pacing;
    terms: Record<string, number>;
  }
>;
