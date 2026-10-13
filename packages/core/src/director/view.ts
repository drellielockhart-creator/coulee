import { rowsOf } from '../ids.ts';
import type { World } from '../world.ts';
import { rankThreads } from './threads.ts';
/** Host analytics / epilogue only. No fair-view call site. */
export function directorReport(world: World) {
  const st = world.director;
  if (!st) return null;
  return {
    version: st.version,
    settings: { ...st.settings },
    focus: st.focus,
    tau: st.tau,
    tau_fast: st.tau_fast,
    tau_slow: st.tau_slow,
    pacing: st.pacing,
    months: Object.fromEntries(
      Object.entries(st.months).map(([key, m]) => [
        key,
        {
          hours: m.hours,
          fast_mean: Math.floor(m.fast_sum / Math.max(1, m.hours)),
          fast_max: m.fast_max,
          slow_mean: Math.floor(m.slow_sum / Math.max(1, m.hours)),
          slow_max: m.slow_max,
          pacing: { ...m.pacing },
          dead_air_hours: m.dead_air_hours,
          dead_air_days: m.dead_air_days,
          terms_mean: Object.fromEntries(
            Object.entries(m.terms_sum).map(([k, v]) => [k, Math.floor(v / Math.max(1, m.hours))]),
          ),
        },
      ]),
    ),
    dead_air: { ...st.dead_air },
    patterns: structuredPatterns(st.patterns),
    guns: { ...st.guns },
    top_threads: st.top_threads.map((t) => ({
      id: t.id,
      pattern: t.pattern,
      interest: t.interest,
      state: t.state,
      actors: { ...t.actors },
      opened_at: t.opened_at,
    })),
    active_top_threads: rowsOf(st.threads)
      .filter((t) => t.closed_at === null)
      .sort(rankThreads)
      .slice(0, 10)
      .map((t) => ({ id: t.id, pattern: t.pattern, interest: t.interest, state: t.state, actors: { ...t.actors } })),
    ledger: st.ledger.map((l) => ({ ...l })),
    ledger_compacted: st.ledger_compacted,
  };
}
function structuredPatterns(patterns: NonNullable<World['director']>['patterns']) {
  return Object.fromEntries(Object.entries(patterns).map(([k, v]) => [k, { ...v }]));
}
export function directorView(world: World, omniscient: boolean) {
  return omniscient ? directorReport(world) : null;
}
