/**
 * Chronicle events. OWNER: module:chronicle. Sifting reads the log; it rarely writes to it.
 */
import type { EventOf } from '../events/base.ts';
import type { ChronicleEntryId } from '../ids.ts';

export type ChronicleEvent =
  /** A pattern (05 §9.2) reached a milestone and became an entry. `inner` visibility: sifting is meta. */
  EventOf<
    'chronicle.pattern_matched',
    {
      pattern: string;
      entryId: ChronicleEntryId;
      /** Milestone reached (1, 2, 3...). Additive. */
      level?: number;
      /** The voice the entry was written in. Additive. */
      voice?: string;
    }
  >;
