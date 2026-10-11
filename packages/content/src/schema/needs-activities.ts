/**
 * Needs, activities, occupations (schedules).
 * OWNER: module:needs-activities (see docs/impl/MODULES.md).
 *
 * Scale: every need is 0..1000 where 1000 = fully satisfied and 0 = desperate.
 * Rates are integer points per game-hour.
 */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import { checkRefs, defineDomain, type Issue, id, int, nonNegInt, ratePct, ref, weekday } from './common.ts';

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
  /** Legible bands, highest first: the first band whose `below` exceeds the value applies. */
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
});
export type NeedDef = z.output<typeof NeedSchema>;

export const LABOR = ['rest', 'light', 'heavy'] as const;

export const ActivitySchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  /** Present participle for UI/chronicle: "sleeping", "working the forge". */
  verb: z.string().min(1),
  description: z.string().default(''),
  /**
   * Where it happens: the actor's home, the actor's workplace (from occupation), a venue
   * with one of `venue_tags`, or wherever the actor already is.
   */
  at: z.enum(['home', 'workplace', 'venue', 'anywhere']),
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
  tags: z.array(id()).default([]),
});
export type ActivityDef = z.output<typeof ActivitySchema>;

export const ScheduleBlockSchema = z.strictObject({
  /** Days this block applies. Omit for every day. */
  days: z.array(weekday()).optional(),
  /** Start hour inclusive, end hour exclusive (0..24). from > to wraps past midnight. */
  from: int().min(0).max(23),
  to: int().min(1).max(24),
  activity: ref(),
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
  schedule: z.array(ScheduleBlockSchema).default([]),
});
export type OccupationDef = z.output<typeof OccupationSchema>;

export const needsActivitiesDomains = {
  needs: defineDomain({ dir: 'needs', key: 'need', schema: NeedSchema }),
  activities: defineDomain({ dir: 'activities', key: 'activity', schema: ActivitySchema }),
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
  for (const a of Object.values(b.activities)) {
    checkRefs(issues, `activities:${a.id}`, 'needs', Object.keys(a.needs), b.needs, 'need');
    checkRefs(issues, `activities:${a.id}`, 'skill', [a.skill], b.skills, 'skill');
    if (a.at === 'venue' && a.venue_tags.length === 0) {
      issues.push({ where: `activities:${a.id}`, message: "at = 'venue' requires venue_tags" });
    }
  }
  for (const o of Object.values(b.occupations)) {
    const where = `occupations:${o.id}`;
    checkRefs(issues, where, 'skills', o.skills, b.skills, 'skill');
    checkRefs(
      issues,
      where,
      'schedule.activity',
      o.schedule.map((s) => s.activity),
      b.activities,
      'activity',
    );
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
