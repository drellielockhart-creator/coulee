/** Observational D0 personalities. Other budgets are dormant until later slices. */
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
});
export type DirectorPersonalityDef = z.output<typeof DirectorPersonalitySchema>;
export const directorDomains = {
  directorPersonalities: defineDomain({ dir: 'director', key: 'personality', schema: DirectorPersonalitySchema }),
};
