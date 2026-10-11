/**
 * Chronicle events. OWNER: module:chronicle. Sifting reads the log; it rarely writes to it.
 */
import type { EventOf } from '../events/base.ts';
import type { ChronicleEntryId } from '../ids.ts';

export type ChronicleEvent =
  /** A pattern (05 §9.2) completed and became an entry. */
  EventOf<'chronicle.pattern_matched', { pattern: string; entryId: ChronicleEntryId }>;
