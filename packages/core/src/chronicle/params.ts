/**
 * Pattern parameters: content-tunable knobs with in-code defaults (data over code, but a
 * missing record must never break a run). OWNER: module:chronicle.
 */
import type { ContentBundle } from '../content.ts';

export interface PatternParams {
  id: string;
  enabled: boolean;
  /** Base importance 0..100. */
  importance: number;
  /** Integer knob. The default is written next to each use, so the TOML mirrors it. */
  n(key: string, dflt: number): number;
  /** String list (interaction ids, label names, memory kinds). */
  l(key: string, dflt: readonly string[]): readonly string[];
}

export function patternParams(content: ContentBundle, id: string, dfltImportance: number): PatternParams {
  const rec = content.chroniclePatterns?.[id];
  return {
    id,
    enabled: rec?.enabled ?? true,
    importance: rec?.importance ?? dfltImportance,
    n: (key, dflt) => rec?.params[key] ?? dflt,
    l: (key, dflt) => rec?.lists[key] ?? dflt,
  };
}
