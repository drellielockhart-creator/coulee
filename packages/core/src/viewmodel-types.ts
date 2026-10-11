/**
 * View options shared by every module's view functions. FOUNDATION-OWNED.
 * (Separate from viewmodel.ts so module view files can import it without a cycle.)
 */
import type { ActorId } from './ids.ts';

export interface ViewOptions {
  /**
   * Whose knowledge filters the view (P1). null = god/debug view (everything current, but
   * still not the omniscient epilogue). Usually the player's actor id.
   */
  perspective: ActorId | null;
  /** Post-run epilogue: reveal ground truth (concealed peoples, secret events, true causes). */
  omniscient: boolean;
  /** Include Explain records (bigger payload; the UI asks for them on demand). */
  includeExplain: boolean;
  /** How many recent chronicle entries to include. */
  recentChronicle: number;
}

export const DEFAULT_VIEW_OPTIONS: ViewOptions = {
  perspective: null,
  omniscient: false,
  includeExplain: false,
  recentChronicle: 50,
};
