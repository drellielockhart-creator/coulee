/** M6 brawl tuning; weapon catalog and located injuries arrive in slice 3. */
import { z } from 'zod';
import { defineDomain, id, int } from './common.ts';

export const CombatSchema = z.strictObject({
  id: id(),
  attack_ticks: int().positive(),
  recovery_ticks: int().positive(),
  grapple_ticks: int().positive(),
  declaration_ticks: int().positive(),
  reaction_ticks: int().positive(),
  reaction_windup_ticks: int().positive(),
  stabilize_ticks: int().positive(),
  dying_ticks: int().positive(),
  dying_dc: int().positive(),
  dying_failures: int().positive(),
  nonlethal_recovery_ticks: int().positive(),
  fist_die: int().positive(),
  morale_threat: int().nonnegative(),
});
export const combatDomains = {
  combat_rules: defineDomain({ dir: 'combat', key: 'combat', schema: CombatSchema }),
};
