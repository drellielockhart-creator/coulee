/** Needs mutations are shared by meals, social encounters and the hourly ledger. */

import { requiredRow } from '../activity/definitions.ts';
import type { NeedId } from '../content.ts';
import type { Explain, ExplainTerm } from '../explain.ts';
import type { ActorId, EventId } from '../ids.ts';
import { rowsOf } from '../ids.ts';
import { foodSeekingUrge } from '../provisions/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { UrgeProposal } from '../urge.ts';
import type { World } from '../world.ts';
import { updateBands } from './bands.ts';
import { hourlyLedger } from './system.ts';
import { ambientTemperatureF, heatPlaces } from './thermal.ts';

export { canAct, maxVigor, needsFrozen, needsHelp, survivalOf } from './survival.ts';

import { needsFrozen } from './survival.ts';
import { proposeCareUrges } from './survival-social.ts';

export const NEED_MIN = 0;
export const NEED_MAX = 1000;
export function needValue(world: World, actorId: ActorId, needId: NeedId): number {
  return world.needs.byActor[actorId]?.values[needId] ?? NEED_MAX;
}
export interface NeedCause {
  label: string;
  eventId?: EventId;
  /** Optional named inputs, used for the hourly physiology ledger. */
  terms?: ExplainTerm[];
  calculations?: Explain[];
  /** Routine change (the hourly balance): update the meter and bands, but log no event. */
  quiet?: boolean;
  /** Log a needs.changed line even though `eventId` names a cause (default: the cause is enough). */
  log?: boolean;
}
export function satisfyNeed(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  needId: NeedId,
  delta: number,
  cause: NeedCause,
): number {
  const n = world.needs.byActor[actorId];
  const actor = world.actors[actorId];
  if (!n || !actor?.alive || needsFrozen(world, ctx.content, actorId) || !Number.isFinite(delta))
    return needValue(world, actorId, needId);
  const def = ctx.content.needs[needId];
  const before = n.values[needId] ?? def?.initial ?? NEED_MAX;
  const credit = Math.round(delta) || 0;
  n.debt ??= {};
  const debt = n.debt;
  let repay = 0;
  if (def?.debt) {
    if (credit < 0) debt[needId] = Math.min(def.debt.cap, (debt[needId] ?? 0) + Math.max(0, -before - credit));
    else {
      repay = Math.min(debt[needId] ?? 0, Math.floor((credit * def.debt.repay_pct) / 100));
      debt[needId] = (debt[needId] ?? 0) - repay;
    }
  }
  const after = Math.max(NEED_MIN, Math.min(NEED_MAX, before + credit - repay));
  n.values[needId] = after;
  // Routine (hourly) changes and changes caused by an already-logged event (a meal, an
  // interaction: that event carries the Explain) update the meter without a needs.changed line.
  if (cause.quiet || (cause.eventId !== undefined && cause.log !== true)) {
    if (def) updateBands(world, actorId, def, ctx);
    return after;
  }
  ctx.emit({
    kind: 'needs.changed',
    data: { actorId, needId, before, after, delta: credit, debt: debt[needId] ?? 0 },
    roles: [{ actor: actorId, role: 'subject' }],
    visibility: 'inner',
    ...(cause.eventId !== undefined ? { causes: [cause.eventId] } : {}),
    explain: {
      kind: 'formula',
      label: cause.label,
      subjects: [actorId],
      knowledge: 'self',
      terms: [
        { source: 'need', label: 'Before', value: before },
        ...(cause.terms ?? [{ source: 'base', label: cause.label, value: credit }]).map((t) => ({
          ...t,
          value: t.value || 0,
        })),
        { source: 'need', label: 'Debt repaid', value: repay === 0 ? 0 : -repay },
        { source: 'need', label: 'Meter bounds', value: after - before - credit + repay },
      ],
      total: after,
      outcome: 'updated',
      ...(cause.calculations ? { children: cause.calculations } : {}),
    },
  });
  if (def) updateBands(world, actorId, def, ctx);
  return after;
}

function intake(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  amount: number,
  unit: 'kcal' | 'ml',
  cause: NeedCause,
): void {
  if (!world.actors[actorId]?.alive || !world.needs.byActor[actorId] || !Number.isFinite(amount) || amount <= 0) return;
  const def = Object.keys(ctx.content.needs)
    .sort()
    .map((key) => requiredRow(ctx.content.needs, key))
    .find((n) => n.intake?.unit === unit);
  if (!def?.intake) return;
  const units = Math.max(0, Math.round(amount));
  const before = needValue(world, actorId, def.id);
  const points = Math.round(units / def.intake.per_point);
  const after = satisfyNeed(world, ctx, actorId, def.id, points, {
    ...cause,
    terms: [{ source: 'base', label: `${units} ${unit} / ${def.intake.per_point} per point`, value: points }],
  });
  ctx.emit({
    ...(unit === 'kcal'
      ? { kind: 'needs.fed' as const, data: { actorId, kcal: units, before, after } }
      : { kind: 'needs.drank' as const, data: { actorId, ml: units, before, after } }),
    roles: [{ actor: actorId, role: 'beneficiary' }],
    visibility: 'private',
    place: world.actors[actorId]?.placeId,
    ...(cause.eventId !== undefined ? { causes: [cause.eventId] } : {}),
    explain: {
      kind: 'formula',
      label: cause.label,
      subjects: [actorId],
      knowledge: 'self',
      terms: [
        { source: 'base', label: `${unit} intake`, value: units },
        { source: 'need', label: 'Units per point', value: def.intake.per_point },
      ],
      total: after - before,
      outcome: 'satisfied',
      note: 'Labor changes expenditure, not the energy or water in an intake.',
    },
  });
}
export function feed(world: World, ctx: SimContext, actorId: ActorId, kcal: number, cause: NeedCause): void {
  intake(world, ctx, actorId, kcal, 'kcal', cause);
}
export function drink(world: World, ctx: SimContext, actorId: ActorId, ml: number, cause: NeedCause): void {
  intake(world, ctx, actorId, ml, 'ml', cause);
}
export function proposeNeedUrges(world: World, ctx: SimContext, actorId: ActorId): UrgeProposal[] {
  if (!world.actors[actorId]?.alive) return [];
  const out: UrgeProposal[] = proposeCareUrges(world, ctx, actorId);
  for (const key of Object.keys(ctx.content.needs).sort()) {
    const def = requiredRow(ctx.content.needs, key);
    const value = needValue(world, actorId, key);
    for (const urge of def.urges) {
      if (value >= urge.below || !ctx.content.activities[urge.activity]) continue;
      const intensity = Math.min(
        1000,
        Math.round(((urge.below - value) * urge.ceiling) / urge.below) +
          Math.floor((world.needs.byActor[actorId]?.debt?.[key] ?? 0) / 8),
      );
      const foodUrge =
        def.intake?.unit === 'kcal' &&
        ctx.content.activities[urge.activity]?.tags.includes('meal') &&
        world.items?.stacks
          ? foodSeekingUrge(world, ctx, actorId)
          : undefined;
      if (foodUrge === null) continue;
      out.push({
        urge: foodUrge ?? { kind: 'activity', activityId: urge.activity },
        voice: 'id',
        intensity,
        label: urge.label,
        source: 'needs',
        drive: urge.drive,
        reasons: [{ source: 'need', label: `${def.name} deficit below ${urge.below}`, value: intensity }],
      });
    }
  }
  return out;
}

/**
 * What the coming hour costs this need at the current activity (labor, sleep, values, traits,
 * physiology, weather), in points: the same ledger the hourly balance applies. Nutrition sums it
 * into the energy actually spent each day.
 */
export function hourlyExpenditure(
  world: World,
  content: import('../content.ts').ContentBundle,
  actorId: ActorId,
  needId: NeedId,
  air: number,
): number {
  const n = world.needs.byActor[actorId];
  if (!n || !world.actors[actorId]?.alive || !content.needs[needId]) return 0;
  const ledger = hourlyLedger(world, content, actorId, needId, air, air, n.values, undefined, false);
  return Math.max(0, -ledger.delta);
}

/** The need (by name) whose current band rouses a sleeper (content: band `wakes`), or null. */
export function rousedBy(
  world: World,
  content: import('../content.ts').ContentBundle,
  actorId: ActorId,
): string | null {
  const n = world.needs.byActor[actorId];
  if (!n) return null;
  for (const key of Object.keys(content.needs).sort()) {
    const def = content.needs[key];
    const value = n.values[key] ?? def?.initial ?? NEED_MAX;
    const band = def?.bands.filter((b) => value < b.below).sort((a, b) => a.below - b.below)[0];
    if (band?.wakes) return def?.name ?? key;
  }
  return null;
}

/** Shared hearth state: cooking may use the fire whose heating fuel was paid this hour. */
export function litHearthAt(world: World, placeId: import('../ids.ts').PlaceId): boolean {
  return (world.needs.hearthLit?.[placeId] ?? 0) > 0;
}

/** Readiness advances the same hourly physiology and heating rules in its private world. */
export function projectWaterHour(world: World, ctx: SimContext): void {
  const temperatures = heatPlaces(world, ctx),
    air = ambientTemperatureF(ctx.cal, world);
  if (!ctx.content.needs.thirst) return;
  for (const actor of rowsOf(world.actors)) {
    const n = world.needs.byActor[actor.id];
    if (!actor.alive || !n) continue;
    const ledger = hourlyLedger(
      world,
      ctx.content,
      actor.id,
      'thirst',
      air,
      temperatures[actor.placeId] ?? air,
      n.values,
      undefined,
      false,
    );
    satisfyNeed(world, ctx, actor.id, 'thirst', ledger.delta, { label: 'Hourly water expenditure', quiet: true });
  }
}

/** Bodies and graves are lasting world facts, visible only when visiting their place. */
export function remainsAt(
  world: World,
  placeId: import('../ids.ts').PlaceId,
): Array<{ actorId: ActorId; name: string; buried: boolean }> {
  return rowsOf(world.actors).flatMap((a) => {
    const d = world.needs.byActor[a.id]?.survival?.death;
    return d && (d.buried ? d.burialPlaceId : d.placeId) === placeId
      ? [{ actorId: a.id, name: `${a.name.given} ${a.name.family}`.trim(), buried: d.buried }]
      : [];
  });
}

export * from './combat.ts';
export { needsSystem as itineraryNeedsHour } from './system.ts';
export * from './tactical.ts';

/** Read-only danger projection; unlike survivalOf this never initializes physiology. */
export function tensionNeeds(world: World, content: import('../content.ts').ContentBundle, id: ActorId) {
  const n = world.needs.byActor[id],
    s = n?.survival;
  const maximum = tensionMaxVigor(world, content, id);
  const lost = s ? Math.floor((Math.max(0, maximum - s.vigor) * 1000) / maximum) : 0;
  const exposure = 1000 - needValue(world, id, 'warmth');
  const worst = Math.max(0, ...Object.values(n?.values ?? {}).map((v) => 1000 - v));
  return { physical: Math.min(1000, Math.max(lost, (s?.wounds ?? 0) * 200, exposure)), survival: worst };
}

import { maxVigor as tensionMaxVigor } from './survival.ts';

export { dormantNeeds } from './dormant.ts';
export { survivalHour as dormantSurvivalHour } from './survival.ts';
export { die as recordRegionalDeath } from './survival-social.ts';
