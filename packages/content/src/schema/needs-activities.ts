/**
 * Needs, activities, occupations (schedules), the human calendar and hearths.
 * OWNER: module:needs-activities (see docs/impl/MODULES.md).
 *
 * Scale: every need is 0..1000 where 1000 = fully satisfied and 0 = desperate.
 * Rates are integer points per game-hour.
 *
 * P8 "crunch you can pack": needs are not bars that tick down for free. Hunger is calories
 * (`intake`), thirst is water, warmth is clothing + weather + a woodpile, rest is a sleep
 * debt, and what you owe once a meter bottoms out (`debt`) is repaid slowly.
 */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import {
  checkRefs,
  defineDomain,
  type Issue,
  id,
  int,
  nonNegInt,
  pct,
  posInt,
  ratePct,
  ref,
  valueId,
  weekday,
} from './common.ts';

export const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const season = () => z.enum(SEASON_IDS);
const month = () => int().min(1).max(12);
/** Inclusive month range; a > b wraps over the new year (11, 2 = Nov..Feb). */
const monthRange = () => z.tuple([month(), month()]);

/** A clock anchor relative to local sunrise/sunset (05 §4.2): "an hour before sunrise". */
export const SunAnchorSchema = z.strictObject({
  anchor: z.enum(['sunrise', 'sunset']),
  /** Whole hours after the anchor (negative = before). */
  offset_h: int().min(-8).max(8).default(0),
  /** Clamp the resulting clock hour into [min, max] (e.g. never retire before 20:00). */
  min_hour: int().min(0).max(24).default(0),
  max_hour: int().min(0).max(24).default(24),
});
export type SunAnchor = z.output<typeof SunAnchorSchema>;

export const NeedSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  /** physical needs: 05 §6 / 02 §11. social/spiritual: 04 §3.3. */
  kind: z.enum(['physical', 'social', 'spiritual']),
  description: z.string().default(''),
  initial: int().min(0).max(1000).default(800),
  /** Points lost per hour while awake at light labor. */
  decay_per_hour: int().min(0).max(1000),
  /** Decay multiplier while asleep, percent. */
  asleep_pct: ratePct().default(50),
  /** Decay multipliers by labor level of the current activity, percent. */
  labor_pct: z
    .strictObject({
      rest: ratePct().default(70),
      light: ratePct().default(100),
      heavy: ratePct().default(150),
    })
    .default({ rest: 70, light: 100, heavy: 150 }),
  /**
   * Legible bands. The band with the smallest `below` that still exceeds the value applies
   * (so list them highest first: Peckish < 600, Hungry < 300, Starving < 100).
   */
  bands: z
    .array(
      z.strictObject({
        below: int().min(1).max(1001),
        label: z.string().min(1),
        /** Condition id (02 §13) applied while in this band, if any. */
        condition: id().optional(),
      }),
    )
    .default([]),

  // ---- P8 crunch: how the meter is fed and what it costs to run it dry ----------------
  /**
   * What `needs.feed()` (kcal) / `needs.drink()` (ml) convert into this need: `per_point`
   * units of intake = 1 point. 3 kcal per hunger point makes 2,400 kcal a normal day (05 §6.1).
   */
  intake: z.strictObject({ unit: z.enum(['kcal', 'ml']), per_point: posInt() }).optional(),
  /** Decay scales with the actor's Values: +per_step_pct per step of the value (−3..+3). */
  value_pct: z.array(z.strictObject({ value: valueId(), per_step_pct: int().min(-90).max(300) })).default([]),
  /** Decay multiplier (percent) for actors holding a trait. Multiplied together. */
  trait_pct: z.record(id(), ratePct()).default({}),
  /**
   * Extra decay by ambient temperature (°F): each matching clause adds (pct − 100) to the
   * decay multiplier. Hunger +20% below 20°F; thirst +40% above 85°F.
   */
  temperature_pct: z
    .array(
      z.strictObject({
        below_f: int().min(-60).max(140).optional(),
        above_f: int().min(-60).max(140).optional(),
        pct: ratePct(),
        label: z.string().default(''),
      }),
    )
    .default([]),
  /** Drift back toward `toward` (security after a fright). Never pushes a need above it. */
  recovery: z.strictObject({ toward: int().min(0).max(1000), per_hour: posInt() }).optional(),
  /**
   * A personal resting level the meter drifts toward from either side (Standing: who one is in
   * the neighborhood). Target = `toward` + the bonus of each occupation role the actor holds
   * (largest only) + every `age_bonus` whose `min_age` the actor has reached, clamped 0..1000.
   * Each hour the meter moves `per_hour_permille`‰ of the gap (at least 1 point) toward it, so
   * a humiliation or an honor fades over days rather than hours.
   */
  baseline: z
    .strictObject({
      toward: int().min(0).max(1000),
      per_hour_permille: int().min(1).max(1000).default(10),
      role_bonus: z.record(id(), int().min(-1000).max(1000)).default({}),
      age_bonus: z
        .array(z.strictObject({ min_age: int().min(0).max(150), bonus: int().min(-1000).max(1000) }))
        .default([]),
    })
    .optional(),
  /**
   * A vice or a taste that is not everyone's (10 §3.4: Drink): when non-empty, the meter decays
   * only for actors holding one of these traits; for everyone else it stays where it is.
   */
  only_traits: z.array(id()).default([]),
  /** No decay below this age (children do not hanker for a dram). */
  decay_min_age: int().min(0).max(150).default(0),
  /**
   * Unmet need accumulates as DEBT when the meter is clamped at 0, and intake repays it first
   * (`repay_pct` of every credit). Debt bands are the slow, serious stages: Gaunt, Wasting.
   */
  debt: z
    .strictObject({
      cap: posInt(),
      repay_pct: pct().default(50),
      bands: z
        .array(
          z.strictObject({
            at_least: posInt(),
            label: z.string().min(1),
            condition: id().optional(),
          }),
        )
        .default([]),
    })
    .optional(),
  /**
   * Free access: while awake at a place with one of `place_tags` and below `below`, the actor
   * takes `per_hour` points from the well, pump or pail. Outside such places (the wilds) the
   * only water is what you carry (provisions calls needs.drink()).
   */
  access: z
    .strictObject({ place_tags: z.array(id()).min(1), below: int().min(1).max(1000), per_hour: posInt() })
    .optional(),
  /**
   * Exposure model (05 §6.3) for warmth: instead of flat decay, points are lost per degree
   * the effective temperature falls below the comfort edge, which clothing, work and
   * bedding push down. Indoor temperature comes from the building's hearth (see `hearths`).
   */
  exposure: z
    .strictObject({
      comfort_f: int().min(-20).max(100).default(62),
      base_insulation_f: nonNegInt().default(24),
      activity_f: z
        .strictObject({ rest: nonNegInt().default(0), light: nonNegInt().default(6), heavy: nonNegInt().default(14) })
        .default({ rest: 0, light: 6, heavy: 14 }),
      asleep_f: nonNegInt().default(10),
      loss_per_degree: posInt().default(6),
      max_loss_per_hour: posInt().default(220),
      regain_per_hour: posInt().default(100),
    })
    .optional(),
  /**
   * Sleep quality (05 §6.4): percent adjustments to the rest this need's asleep activities
   * restore, while ANOTHER need is below a threshold ("cold bed", "hungry belly").
   */
  sleep_quality: z
    .array(
      z.strictObject({
        need: ref(),
        below: int().min(1).max(1000),
        pct: int().min(-100).max(100),
        label: z.string().min(1),
      }),
    )
    .default([]),
  /**
   * Id-voiced urges (10 §3.4): when the value falls below `below`, propose `activity` with
   * intensity rising linearly from 0 at `below` to `ceiling` at 0 (plus debt/8).
   */
  urges: z
    .array(
      z.strictObject({
        activity: ref(),
        below: int().min(1).max(1000),
        ceiling: int().min(1).max(1000).default(800),
        /** Id drive this voices (10 §3.2). */
        drive: id(),
        label: z.string().min(1),
      }),
    )
    .default([]),
});
export type NeedDef = z.output<typeof NeedSchema>;

export const LABOR = ['rest', 'light', 'heavy'] as const;

/** How a chore reads the household's larder or woodpile (activity-driven provisioning). */
export const ChoreSchema = z.strictObject({
  supply: z.enum(['fuel', 'food']),
  /** Propose once the household has fewer days than this of the supply. */
  below_days: posInt(),
  /** Intensity at zero days; scales linearly up from 0 at `below_days`. */
  intensity: int().min(1).max(1000),
  /** Only people this old and up (and below 70) are asked. */
  min_age: nonNegInt().default(14),
  label: z.string().min(1),
});

export const YieldSchema = z.strictObject({
  item: ref(),
  /** Tenths of a unit produced per hour of work, before tool and check scaling. */
  tenths_per_hour: posInt(),
  /** Only in these months (inclusive, wrapping). */
  months: monthRange().optional(),
  /** Skip silently if the item doesn't exist in this content set. */
  optional: z.boolean().default(false),
  /** Where it goes: the household's stores, or the actor's own kit. */
  to: z.enum(['household', 'actor']).default('household'),
});

export const ActivitySchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  /** Present participle for UI/chronicle: "sleeping", "working the forge". */
  verb: z.string().min(1),
  description: z.string().default(''),
  /**
   * Where it happens: the actor's home, the actor's workplace (from occupation), a venue
   * with one of `venue_tags`, the home of kin or a neighbor, or wherever the actor already is.
   */
  at: z.enum(['home', 'workplace', 'venue', 'kin', 'anywhere']),
  /** Optional participation limits; shared by activity resolution and social proposals. */
  min_age: nonNegInt().optional(),
  max_age: nonNegInt().optional(),
  sexes: z.array(z.enum(['female', 'male'])).optional(),
  venue_tags: z.array(id()).default([]),
  labor: z.enum(LABOR).default('light'),
  asleep: z.boolean().default(false),
  /** Need deltas per hour while doing this (positive satisfies). */
  needs: z.record(id(), int().min(-1000).max(1000)).default({}),
  /** 0..100: how strongly this activity pools actors into social encounters (04 §11.2). */
  sociability: int().min(0).max(100).default(0),
  /** Minimum block length in hours before re-arbitration may switch away. */
  min_hours: int().min(1).max(24).default(1),
  /** Skill exercised (02 §4.4 practice), if any. */
  skill: ref().optional(),
  /**
   * Tags: 'labor' (stops on the Sabbath unless 'essential'), 'essential' (stock must be fed),
   * 'meal', 'cook', 'commerce' (a shopping hour: provisions may buy), 'worship', 'school', 'leisure'.
   */
  tags: z.array(id()).default([]),
  /** Doable only in these months (inclusive, wrapping); otherwise the schedule falls back. */
  months: monthRange().optional(),
  /** Superego voice for "the forge won't tend itself". */
  duty_label: z.string().optional(),
  /** Norm this duty voices (10 §3.3); default 'duty'. */
  norm: id().optional(),
  /** Supply-driven chore: the household's woodpile or larder asks for it (see ChoreSchema). */
  chore: ChoreSchema.optional(),
  /** Goods produced by an hour of this work (firewood chopped, greens foraged, pork put down). */
  yields: z.array(YieldSchema).default([]),
  /** Affordance the work needs (03 §3.2): no axe, slow chopping. Looked up on the actor then the household. */
  tool: z
    .strictObject({
      affordance: id(),
      /** Magnitude (tenths) that gives the full yield. */
      full_tenths: posInt().default(20),
      /** Percent of the yield with no tool at all. */
      bare_pct: pct().default(20),
    })
    .optional(),
  /** Skill check for the hour's yield (02 §3): success 100%, failure 50%, bad failure 0%, exceptional 150%. */
  check: z.strictObject({ skill: ref(), dc: nonNegInt() }).optional(),
});
export type ActivityDef = z.output<typeof ActivitySchema>;

export const ScheduleBlockSchema = z.strictObject({
  /** Days this block applies. Omit for every day. */
  days: z.array(weekday()).optional(),
  /** Seasons / month range this block applies (harvest hours, winter hours). Omit for all year. */
  seasons: z.array(season()).optional(),
  months: monthRange().optional(),
  /** Start hour inclusive, end hour exclusive (0..24). from > to wraps past midnight. */
  from: int().min(0).max(23),
  to: int().min(1).max(24),
  /** Sun-relative overrides of from/to ("up with the sun, in at dusk"). */
  from_sun: SunAnchorSchema.optional(),
  to_sun: SunAnchorSchema.optional(),
  activity: ref(),
  /** Used if `activity` is out of season or has no venue ("plowing" in January -> "tend stock"). */
  fallback: ref().optional(),
  /** Superego weight of this duty when psyche arbitrates (0..1000). */
  duty: int().min(0).max(1000).default(500),
});
export type ScheduleBlock = z.output<typeof ScheduleBlockSchema>;

export const OccupationSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  description: z.string().default(''),
  /** Venue tags a workplace must have (resolved against the actor's household/scenario). */
  workplace_tags: z.array(id()).default([]),
  wage_cents_per_day: nonNegInt().default(0),
  skills: z.array(ref()).default([]),
  /** Office/role tags for institutions (04 §9.3): 'preacher', 'jp', 'editor', 'storekeeper'... */
  roles: z.array(id()).default([]),
  /**
   * Held at the workplace and unable to leave of their own will (a captive of a fae court, a
   * prisoner, a lost man who cannot find the way out). Every activity happens at the workplace;
   * urges still form and are arbitrated (the wish to go home is real), but the body stays put.
   */
  confined: z.boolean().default(false),
  schedule: z.array(ScheduleBlockSchema).default([]),
});
export type OccupationDef = z.output<typeof OccupationSchema>;

// ---- The human calendar (05 §4.6): Sabbath, market day, court day, harvest ----------------

/** Who a communal block calls. Every given filter must match. */
export const WhoSchema = z.strictObject({
  /** Occupation roles, any of. */
  roles: z.array(id()).optional(),
  not_roles: z.array(id()).optional(),
  /** Kind of the household's home place ('farmstead' for farm families who come in to town). */
  home_kinds: z.array(id()).optional(),
  not_home_kinds: z.array(id()).optional(),
  /** Tags of the actor's resolved workplace: shopkeepers and smiths are at their posts on market day. */
  not_workplace_tags: z.array(id()).optional(),
  /** Period rules the sim models without endorsing them (who voted in 1855). */
  sexes: z.array(z.enum(['female', 'male'])).optional(),
  min_age: nonNegInt().optional(),
  max_age: nonNegInt().optional(),
  /**
   * A household rota: of the eligible members of each household, exactly one (drawn per day
   * and block, stable within the day) is called. "Somebody has to cook dinner."
   */
  rota: z.boolean().optional(),
});
export type Who = z.output<typeof WhoSchema>;

/**
 * Probability that an eligible actor turns up, in percent, rolled once per actor per day
 * (a stable counter-based draw, so the same person is at church all morning):
 * `base_pct + Σ value_step * value + Σ trait add`, clamped 0..100, with an Explain.
 */
export const AttendSchema = z.strictObject({
  base_pct: pct(),
  value_pct: z.partialRecord(valueId(), int().min(-100).max(100)).default({}),
  trait_pct: z.record(id(), int().min(-100).max(100)).default({}),
  /**
   * Weather on the day scales the chance (percent, applied after the sum): a winter's day
   * below `below_f` at noon keeps callers and market-goers home (snowbound roads).
   */
  weather_pct: z
    .array(z.strictObject({ below_f: int().min(-60).max(140), pct: pct(), label: z.string().default('Bad roads') }))
    .default([]),
});
export type Attend = z.output<typeof AttendSchema>;

export const ObservanceBlockSchema = z.strictObject({
  from: int().min(0).max(23),
  to: int().min(1).max(24),
  from_sun: SunAnchorSchema.optional(),
  to_sun: SunAnchorSchema.optional(),
  activity: ref(),
  fallback: ref().optional(),
  /** Beats occupation blocks (priority 20) when higher. Sleep (100) is only beaten with `override_sleep`. */
  priority: int().min(0).max(99).default(30),
  duty: int().min(0).max(1000).default(500),
  /** Extra duty per step of an actor Value ("the pious feel the Sabbath more"). */
  duty_values: z.partialRecord(valueId(), int().min(-200).max(200)).default({}),
  norm: id().optional(),
  speaker: z.string().optional(),
  override_sleep: z.boolean().default(false),
  who: WhoSchema.default({}),
  attend: AttendSchema.optional(),
  /** Emit an `activity.gathering` event when this block begins (chronicle fodder). */
  announce: z.boolean().default(false),
});
export type ObservanceBlock = z.output<typeof ObservanceBlockSchema>;

export const ObservanceSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  description: z.string().default(''),
  /** All given conditions must hold. */
  when: z
    .strictObject({
      weekdays: z.array(weekday()).optional(),
      months: z.array(month()).optional(),
      /** Day of month, inclusive: [1,7] with a weekday = "first Tuesday". */
      day_range: z.tuple([int().min(1).max(31), int().min(1).max(31)]).optional(),
      date: z.strictObject({ month: month(), day: int().min(1).max(31) }).optional(),
      /** Days from Easter Sunday (integer computus): −2 = Good Friday, 0 = Easter, −7 = Palm Sunday. */
      easter_offset: int().min(-60).max(70).optional(),
    })
    .refine((w) => Object.values(w).some((v) => v !== undefined), 'observance needs at least one `when` condition'),
  /** Labor-tagged activities (not 'essential' ones) are replaced by `rest_activity` for non-exempt roles. */
  rest_labor: z.boolean().default(false),
  rest_activity: ref().optional(),
  exempt_roles: z.array(id()).default([]),
  /** Workplaces with these tags are shut: their staff get `rest_activity` instead. */
  closes: z.array(id()).default([]),
  /** Chronicle: announce at 00:00 as `activity.observance` (market day, the Fourth). */
  announce: z.boolean().default(false),
  blocks: z.array(ObservanceBlockSchema).default([]),
});
export type ObservanceDef = z.output<typeof ObservanceSchema>;

// ---- Hearths: where the winter's wood goes -----------------------------------------------

/**
 * A building's fire (05 §6.3). The first hearth whose `place_tags` match a place applies.
 * It is lit while the building is occupied and the air is below `when_below_f`, burns
 * `burn_base + burn_per_10f × (ref_f − air)/10` minutes of fuel per hour from the keeping
 * household's stores (items with `supply.kind = fuel_kind`), and warms the inside to
 * `air + gain_f` (never above `cap_f`). Out of wood = a cold house.
 */
export const HearthSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  place_tags: z.array(id()).min(1),
  when_below_f: int().min(-40).max(140),
  fuel_kind: id().default('fire'),
  burn_base: nonNegInt(),
  burn_per_10f: nonNegInt().default(0),
  ref_f: int().min(-40).max(100).default(40),
  gain_f: nonNegInt(),
  cap_f: int().min(32).max(100).default(68),
  /** Shelter without a fire: degrees above the outdoor air. */
  unlit_gain_f: nonNegInt().default(6),
  /** 'household' draws from the stores of the household that lives there; 'free' is communal/abstract. */
  fuel_from: z.enum(['household', 'free']).default('household'),
  /** Lit only while somebody is present (a church stove isn't banked all week). */
  occupied_only: z.boolean().default(true),
});
export type HearthDef = z.output<typeof HearthSchema>;

export const needsActivitiesDomains = {
  needs: defineDomain({ dir: 'needs', key: 'need', schema: NeedSchema }),
  activities: defineDomain({ dir: 'activities', key: 'activity', schema: ActivitySchema }),
  observances: defineDomain({ dir: 'activities', key: 'observance', schema: ObservanceSchema }),
  hearths: defineDomain({ dir: 'activities', key: 'hearth', schema: HearthSchema }),
  occupations: defineDomain({ dir: 'occupations', key: 'occupation', schema: OccupationSchema }),
};

/** Per-actor scenario fields owned by this module (merged into ScenarioActorSchema). */
export const needsActivitiesActorFields = {
  /** Starting need values (0..1000); omitted needs use NeedDef.initial. */
  needs: z.record(id(), int().min(0).max(1000)).default({}),
  /** Place id of the actor's workplace, if not derivable from occupation + household. */
  workplace: ref().optional(),
};

export function needsActivitiesRefs(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  for (const n of Object.values(b.needs)) {
    const where = `needs:${n.id}`;
    checkRefs(
      issues,
      where,
      'urges.activity',
      n.urges.map((u) => u.activity),
      b.activities,
      'activity',
    );
    checkRefs(
      issues,
      where,
      'sleep_quality.need',
      n.sleep_quality.map((s) => s.need),
      b.needs,
      'need',
    );
    checkRefs(issues, where, 'trait_pct', Object.keys(n.trait_pct), b.traits, 'trait');
    checkRefs(issues, where, 'only_traits', n.only_traits, b.traits, 'trait');
    for (const t of n.temperature_pct) {
      if (t.below_f === undefined && t.above_f === undefined) {
        issues.push({ where, path: 'temperature_pct', message: 'clause needs below_f or above_f' });
      }
    }
    if (n.exposure && n.decay_per_hour !== 0) {
      issues.push({
        where,
        path: 'exposure',
        message: 'an exposure need loses points by weather: set decay_per_hour = 0',
      });
    }
  }
  const intakeUnits = new Set<string>();
  for (const n of Object.values(b.needs)) {
    if (!n.intake) continue;
    if (intakeUnits.has(n.intake.unit)) {
      issues.push({ where: `needs:${n.id}`, path: 'intake', message: `two needs take '${n.intake.unit}'` });
    }
    intakeUnits.add(n.intake.unit);
  }
  for (const a of Object.values(b.activities)) {
    const where = `activities:${a.id}`;
    checkRefs(issues, where, 'needs', Object.keys(a.needs), b.needs, 'need');
    checkRefs(issues, where, 'skill', [a.skill, a.check?.skill], b.skills, 'skill');
    checkRefs(
      issues,
      where,
      'yields.item',
      a.yields.filter((y) => !y.optional).map((y) => y.item),
      b.items,
      'item',
    );
    if (a.at === 'venue' && a.venue_tags.length === 0) {
      issues.push({ where, message: "at = 'venue' requires venue_tags" });
    }
  }
  for (const o of Object.values(b.occupations)) {
    const where = `occupations:${o.id}`;
    checkRefs(issues, where, 'skills', o.skills, b.skills, 'skill');
    checkRefs(
      issues,
      where,
      'schedule.activity',
      o.schedule.flatMap((s) => [s.activity, s.fallback]),
      b.activities,
      'activity',
    );
  }
  for (const ob of Object.values(b.observances)) {
    const where = `observances:${ob.id}`;
    checkRefs(issues, where, 'rest_activity', [ob.rest_activity], b.activities, 'activity');
    if (ob.rest_labor && ob.rest_activity === undefined) {
      issues.push({ where, path: 'rest_activity', message: 'rest_labor needs a rest_activity' });
    }
    if (ob.closes.length > 0 && ob.rest_activity === undefined) {
      issues.push({ where, path: 'rest_activity', message: 'closes needs a rest_activity' });
    }
    for (const blk of ob.blocks) {
      checkRefs(issues, where, 'blocks.activity', [blk.activity, blk.fallback], b.activities, 'activity');
      if (blk.attend)
        checkRefs(issues, where, 'blocks.attend.trait_pct', Object.keys(blk.attend.trait_pct), b.traits, 'trait');
    }
  }
  for (const s of Object.values(b.scenarios)) {
    for (const a of s.actors) {
      const where = `scenarios:${s.id}/actors:${a.key}`;
      checkRefs(issues, where, 'needs', Object.keys(a.needs), b.needs, 'need');
      checkRefs(issues, where, 'workplace', [a.workplace], b.places, 'place');
    }
  }
  return issues;
}
