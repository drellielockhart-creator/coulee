/**
 * Social tuning access and the actor dispositions social formulas read (04 §3.1).
 * OWNER: module:social.
 */
import type { MemoryKindDef, SocialTuningDef } from '@coulee/content/schema';
import type { ActorCore } from '../actor.ts';
import type { ContentBundle, ValueId } from '../content.ts';
import type { GameMinute } from '../time.ts';
import { yearsBetween } from '../time.ts';
import { clampInt } from './model.ts';

/** Schema defaults, used when content has no `social_tuning` record (unit tests, mods). */
export const DEFAULT_TUNING: SocialTuningDef = {
  id: 'default',
  compat_weights: { piety: 2, parochialism: 2, superstition: 2, thrift: 1, neighborliness: 1, temper: 1 },
  compat_cap: 15,
  compat_offset: 5,
  relationship_priors: [],
  household_prior: { affection: 10, respect: 0, trust: 10, fear: 0 },
  kin_kinds: ['parent', 'sibling', 'spouse', 'betrothed', 'cousin', 'in_law'],
  encounter_rate_permille: 300,
  venue_pct: [],
  activity_sociability_pct: 1,
  sociability_per_neighborliness: 15,
  sociability_per_company_deficit: 8,
  sociability_drunk: 40,
  min_social_age: 3,
  max_initiations_per_hour: 2,
  max_participations_per_hour: 3,
  tie_sample: 4,
  stranger_attempts: 3,
  max_witnesses: 2,
  audience_cap: 12,
  volition_noise: 15,
  salience_base: 300,
  salience_per_intensity: 7,
  initiator_intensity_pct: 60,
  witness_intensity_pct: 40,
  audience_intensity_per_onlooker: 2,
  audience_intensity_cap: 40,
  surprise_pct: 30,
  forget_below: 50,
  consolidate_below: 250,
  max_memories: 300,
  max_reasons: 8,
  bucket_tau_days: 60,
  volatile_keep_pct: 40,
  volatile_cap: 20,
  familiarity_per_encounter: 40,
  familiarity_decay_per_day: 2,
  max_opinions: 150,
  courtship_min_age: 16,
  courtship_opposite_sex: true,
  escalation_dc: 12,
  escalation_per_temper: 2,
  escalation_cooldown_hours: 48,
  escalation_household_dc: -4,
  escalation_kin_dc: -3,
  escalation_weary_dc: -2,
  strife_window_days: 14,
  strife_weariness_pct: 60,
  rupture_window_days: 30,
  rupture_fights: 4,
  estrangement_days: 28,
  mediation_min_affection: 15,
  mediation_min_age: 16,
  mediation_skill: 'persuade',
  mediation_dc: 12,
  mediation_soften_pct: 50,
  estranged_allow_tags: ['amends'],
  company_seek_below: 450,
  seek_company: [],
  max_targeted_urges: 2,
  public_venue_tags: ['tavern', 'store', 'church', 'street', 'landing'],
  public_audience_min: 4,
  shun_volition_penalty: 60,
  defense_interactions: [],
  channels: [],
  work_talk_minutes: 15,
  work_talk_sociability: 50,
  kept_from_work: { reason: 'Kept me from my work', delta: { affection: -2, respect: 0, trust: 0, fear: 0 } },
  request_cooldown_hours: 72,
  refused_request_cooldown_hours: 168,
  repay_trust_min_hours: 24,
  gift_sections: ['trade_goods', 'provisions', 'books', 'medicine', 'wild_food'],
  gift_value_cents: 10,
};

/** The 'default' tuning record, else the first by id, else the schema defaults. */
export function tuningOf(content: ContentBundle): SocialTuningDef {
  const table = content.social_tuning ?? {};
  const d = table.default;
  if (d) return d;
  const ids = Object.keys(table).sort();
  const first = ids[0] !== undefined ? table[ids[0]] : undefined;
  return first ?? DEFAULT_TUNING;
}

/** Memory-kind record (04 §4.3), or a neutral fallback for kinds content does not define. */
export function memoryKindOf(content: ContentBundle, kind: string): MemoryKindDef {
  const def = content.memory_kinds?.[kind];
  if (def) return def;
  return {
    id: 'other',
    name: kind,
    valence: 'neutral',
    tau_days: 10,
    floor: 0,
    consolidate: true,
    summary: '{other}: {count} times since {since}',
  };
}

/** Value view −3..+3 (04 §3.1 derived views; M1 reads the stored Values). */
export function valueView(actor: ActorCore, v: ValueId): number {
  return clampInt(Math.round(actor.values[v] ?? 0), -3, 3);
}

export function ageYears(actor: ActorCore, now: GameMinute): number {
  return yearsBetween(actor.born, now);
}
