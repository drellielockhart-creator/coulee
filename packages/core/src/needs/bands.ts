import { setCondition } from '../actor.ts';
import type { NeedDef } from '../content.ts';
import type { ActorId } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';

export function needBand(def: NeedDef, value: number): string {
  let below = 1002;
  let label = '';
  for (const b of def.bands)
    if (value < b.below && b.below < below) {
      below = b.below;
      label = b.label;
    }
  return label;
}

/** Synchronize immediately after every mutation, including meals and social recovery. */
export function updateBands(world: World, actorId: ActorId, def: NeedDef, ctx?: Pick<SimContext, 'emit'>): void {
  const n = world.needs.byActor[actorId];
  const actor = world.actors[actorId];
  if (!n || !actor) return;
  const value = n.values[def.id] ?? def.initial;
  const from = n.bands[def.id] ?? '';
  const to = needBand(def, value);
  n.bands[def.id] = to;
  const conditions = new Set<string>();
  const active = new Set<string>();
  for (const b of def.bands)
    if (b.condition) {
      conditions.add(b.condition);
      if (b.label === to) active.add(b.condition);
    }
  let debtLabel = '';
  let threshold = 0;
  for (const b of def.debt?.bands ?? []) {
    if (b.condition) conditions.add(b.condition);
    if ((n.debt?.[def.id] ?? 0) >= b.at_least && b.at_least > threshold) {
      threshold = b.at_least;
      debtLabel = b.label;
    }
  }
  for (const b of def.debt?.bands ?? []) if (b.condition && b.label === debtLabel) active.add(b.condition);
  for (const condition of conditions) setCondition(actor, condition, active.has(condition));
  n.debtBands ??= {};
  const previousDebt = n.debtBands[def.id] ?? '';
  n.debtBands[def.id] = debtLabel;
  for (const [previous, next, bandValue, layer] of [
    [from, to, value, 'meter'],
    [previousDebt, debtLabel, n.debt?.[def.id] ?? 0, 'debt'],
  ] as const)
    if (ctx && previous !== next)
      ctx.emit({
        kind: 'needs.band_changed',
        data: { actorId, needId: def.id, from: previous, to: next, value: bandValue, layer },
        roles: [{ actor: actorId, role: 'subject' }],
        visibility: 'inner',
        explain: {
          kind: 'formula',
          label: `${def.name}: ${layer} band`,
          subjects: [actorId],
          knowledge: 'self',
          terms: [{ source: 'need', label: layer, value: bandValue }],
          total: bandValue,
          outcome: next || 'satisfied',
        },
      });
}
