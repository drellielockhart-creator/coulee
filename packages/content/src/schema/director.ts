/** Director personalities (05 §8.8) and ripening moves (DIRECTOR-PLAN §3.3). D1: land_itself and almanac act. */
import { z } from 'zod';
import { defineDomain, id, int } from './common.ts';
export const DirectorPersonalitySchema = z.object({
  id: id(),
  name: z.string().min(1),
  curve: z.enum(['seasonal', 'gentle', 'random_walk', 'slow_build', 'sabbath', 'lunar', 'none']),
  budget_per_day: int().min(0).max(30),
  relax_days: int().min(0).max(60),
  peak_threshold: int().min(0).max(1000),
  peak_hours: int().min(1).max(168),
  category_multipliers: z.record(z.string(), int().min(0).max(4000)).default({}),
  mercy: z.enum(['on', 'strong', 'none', 'meaningful_death', 'capricious']),
  /** Seasonal curve: RELAX days by season (hard winters are hard: shorter rests). */
  season_relax_days: z
    .strictObject({
      spring: int().min(0).max(60),
      summer: int().min(0).max(60),
      autumn: int().min(0).max(60),
      winter: int().min(0).max(60),
    })
    .optional(),
  /** Days a BUILD may ripen its threat before it fizzles back to FADE (seasonal curve). */
  build_days: int().min(1).max(30).default(3),
  /** Threads considered by the daily planner. */
  top_k: int().min(1).max(20).default(5),
});
/** Patterns the Director may never ripen (05 §8.3: no faekin exposure; minds are read, never steered in D1). */
export const FORBIDDEN_DIRECTOR_PATTERNS = ['faekin_suspicion', 'scapegoat', 'defense_fired'] as const;
/**
 * A ripening move: which nudge can advance a pattern, for which role, at what cost. Data, read
 * by the daily planner (05 §8.6's "incident deck" as moves on live threads).
 */
export const DirectorMoveSchema = z
  .object({
    id: id(),
    pattern: id(),
    nudge: z.enum(['N4', 'N6', 'N8', 'N9']),
    /** Pacing filter: RELAX opportunity/social/discovery; BUILD the top threat (+ N4); FADE aftermath. */
    category: z.enum(['threat', 'social', 'opportunity', 'discovery']),
    /** The owning module's decision: gossip, company_venue, call_target, loan_breach, fae.notice, fae.shortfall. */
    process: z.enum(['gossip', 'company_venue', 'call_target', 'loan_breach', 'fae.notice', 'fae.shortfall']),
    /** Thread role whose decision is tilted (default: any participant but the PC). */
    role: id().optional(),
    /** Per mille (N4/N8), DC points (N9), or minutes (N6, signed: negative = sooner). */
    amount: int().min(-4320).max(1000),
    /** N6 only: minutes used when the pacing state suppresses this thread (a delay). */
    suppress_amount: int().min(0).max(4320).optional(),
    cost: int().min(1).max(5),
    expires_hours: int().min(1).max(168).default(24),
  })
  .refine((m) => !(FORBIDDEN_DIRECTOR_PATTERNS as readonly string[]).includes(m.pattern), {
    message: 'The Director may not ripen this pattern (05 §8.3 hard prohibitions)',
  });
export type DirectorMoveDef = z.output<typeof DirectorMoveSchema>;
export type DirectorPersonalityDef = z.output<typeof DirectorPersonalitySchema>;
export const directorDomains = {
  directorPersonalities: defineDomain({ dir: 'director', key: 'personality', schema: DirectorPersonalitySchema }),
  directorMoves: defineDomain({ dir: 'director', key: 'move', schema: DirectorMoveSchema }),
};
