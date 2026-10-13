/** Shared survival rules: no controller-specific physiology, harm, rescue or endings. */
import { abilityMod, setCondition } from '../actor.ts';
import { resolveCheck, saveTerms } from '../checks.ts';
import type { ContentBundle } from '../content.ts';
import { type Explain, term } from '../explain.ts';
import type { ActorId } from '../ids.ts';
import { processingActorIds } from '../region/processing.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { combatUnconscious } from './combat.ts';
import type { SurvivalState } from './state.ts';
import { aftermathHour, die, helpHour } from './survival-social.ts';

export function survivalTuning(content: ContentBundle) {
  return content.survival_tuning?.survival;
}
export function maxVigor(world: World, content: ContentBundle, id: ActorId): number {
  const a = world.actors[id],
    t = survivalTuning(content);
  return Math.max(
    1,
    (t?.vigor_base ?? 6) +
      Math.max(0, (a?.sheet.level ?? 1) - 1) * (t?.vigor_per_level ?? 3) +
      abilityMod(a?.sheet.abilities.con ?? 10),
  );
}
export function survivalOf(world: World, content: ContentBundle, id: ActorId): SurvivalState | undefined {
  const n = world.needs.byActor[id];
  if (!n) return undefined;
  n.survival ??= {
    vigor: maxVigor(world, content, id),
    wounds: 0,
    hours: {},
    recovering: 0,
    collapsed: false,
    stasis: false,
  };
  return n.survival;
}
export function canAct(world: World, id: ActorId): boolean {
  const s = world.needs.byActor[id]?.survival;
  return world.actors[id]?.alive === true && !s?.collapsed && !s?.ending && !combatUnconscious(world, id);
}
/** Visible helplessness or prolonged hunger gives neighbors a reason to offer care. */
export function needsHelp(world: World, id: ActorId): boolean {
  const n = world.needs.byActor[id];
  return !!n?.survival?.collapsed || ((n?.values.hunger ?? 1000) === 0 && (n?.survival?.hours.starvation ?? 0) >= 24);
}
export function needsFrozen(world: World, content: ContentBundle, id: ActorId): boolean {
  const a = world.actors[id];
  if (!a || !content.occupations[a.occupationId]?.confined) return false;
  return (survivalTuning(content)?.stasis_place_tags ?? []).some((t) => world.places[a.placeId]?.tags.includes(t));
}
export function survivalExplain(id: ActorId, label: string, total: number, outcome: string): Explain {
  return {
    kind: 'formula',
    label,
    subjects: [id],
    knowledge: 'self',
    terms: [term('survival', label, total)],
    total,
    outcome,
  };
}
export function survivalHour(world: World, ctx: SimContext): void {
  const tuning = survivalTuning(ctx.content);
  if (!tuning) return;
  const rules = Object.keys(ctx.content.survival_rules)
    .sort()
    .map((k) => ctx.content.survival_rules[k])
    .filter((r) => r !== undefined);
  for (const id of processingActorIds(world)) {
    const a = world.actors[id],
      n = world.needs.byActor[id];
    if (!a?.alive || !n) continue;
    const s = survivalOf(world, ctx.content, id);
    if (!s || s.ending) continue;
    const frozen = needsFrozen(world, ctx.content, id);
    if (s.stasis !== frozen) {
      s.stasis = frozen;
      ctx.emit({
        kind: 'needs.stasis',
        data: { actorId: id, frozen },
        roles: [{ actor: id, role: 'subject' }],
        visibility: 'inner',
        explain: survivalExplain(
          id,
          'Time runs otherwise under the hill',
          frozen ? 0 : 1,
          frozen ? 'needs frozen' : 'time resumes',
        ),
      });
    }
    if (frozen) continue;
    let recovering = true;
    for (const [index, r] of rules.entries()) {
      const value = n.values[r.need] ?? 1000;
      const heat = r.heat_above_f === undefined || (world.needs.placeTempF?.[a.placeId] ?? 60) >= r.heat_above_f;
      const active = heat && (r.heat_above_f === undefined ? value === 0 : value < r.recovery_above);
      const safe = !heat || value >= r.recovery_above;
      const hours = active
        ? (s.hours[r.id] ?? 0) + 1
        : safe
          ? Math.max(0, (s.hours[r.id] ?? 0) - r.recover_hours)
          : (s.hours[r.id] ?? 0);
      s.hours[r.id] = hours;
      if (!safe) recovering = false;
      setCondition(a, r.condition, hours >= r.grace_hours && hours > 0);
      if (!active || hours < r.grace_hours || (hours - r.grace_hours) % r.check_hours !== 0) continue;
      const result = resolveCheck(
        {
          label: `Fortitude against ${r.name}`,
          kind: 'save',
          subjects: [id],
          knowledge: 'self',
          terms: saveTerms(a, 'fortitude'),
          dc: r.dc,
          dcTerms: [term('deprivation', 'Repeated exposure', Math.floor((hours - r.grace_hours) / r.check_hours))],
        },
        ctx.rng('needs', mixKey(id, index, 0x53555256)),
      );
      const damage = result.success ? 0 : r.damage;
      const spent = Math.min(s.vigor, damage);
      s.vigor -= spent;
      s.vigorHarm ??= {};
      s.vigorHarm[r.id] = (s.vigorHarm[r.id] ?? 0) + spent;
      s.wounds += damage - spent;
      result.explain.children = [
        survivalExplain(id, `Hours deprived of ${r.need}`, hours, 'accumulated'),
        survivalExplain(id, 'Nonlethal Vigor loss', spent, 'harm'),
        survivalExplain(id, 'Continued deprivation: Wounds', damage - spent, 'harm'),
      ];
      ctx.emit({
        kind: 'needs.survival_check',
        data: { actorId: id, cause: r.name, damage, vigor: s.vigor, wounds: s.wounds },
        roles: [{ actor: id, role: 'subject' }],
        visibility: 'inner',
        importance: damage ? 25 : 0,
        explain: result.explain,
      });
      if (s.vigor === 0 && !s.collapsed) {
        s.collapsed = true;
        setCondition(a, 'incapacitated', true);
        ctx.emit({
          kind: 'needs.collapsed',
          data: { actorId: id, cause: r.name },
          roles: [{ actor: id, role: 'subject' }],
          place: a.placeId,
          visibility: 'witnessed',
          importance: 65,
          explain: survivalExplain(id, `Collapsed from ${r.name}; needs help`, s.vigor, 'incapacitated'),
        });
      }
      if (s.wounds >= a.sheet.abilities.con) {
        die(world, ctx, id, r.name);
        break;
      }
    }
    if (!a.alive) continue;
    // Recover the harm whose cause has been relieved: hunger cannot prevent sleep
    // from relieving exhaustion, or leave a rested person permanently unconscious.
    let restored = 0;
    for (const r of rules) {
      const harm = s.vigorHarm?.[r.id] ?? 0;
      const relieved =
        (n.values[r.need] ?? 1000) >= r.recovery_above ||
        (r.heat_above_f !== undefined && (world.needs.placeTempF?.[a.placeId] ?? 60) < r.heat_above_f);
      if (!harm || !relieved) continue;
      const healed = Math.min(harm, tuning.vigor_recovery - restored);
      if (s.vigorHarm) s.vigorHarm[r.id] = harm - healed;
      restored += healed;
    }
    if (recovering && !s.vigorHarm) restored = tuning.vigor_recovery;
    s.vigor = Math.min(maxVigor(world, ctx.content, id), s.vigor + restored);
    if (recovering) {
      s.recovering++;
      if (s.recovering % tuning.wounds_recovery_hours === 0) s.wounds = Math.max(0, s.wounds - 1);
    } else s.recovering = 0;
    if (s.collapsed && s.vigor > 0) {
      s.collapsed = false;
      setCondition(a, 'incapacitated', false);
      ctx.emit({
        kind: 'needs.recovered',
        data: { actorId: id },
        roles: [{ actor: id, role: 'subject' }],
        place: a.placeId,
        visibility: 'witnessed',
        importance: 40,
        explain: survivalExplain(id, 'Needs met: Vigor returning', s.vigor, 'conscious'),
      });
    }
  }
  helpHour(world, ctx);
  aftermathHour(world, ctx);
  for (const cmd of ctx.commands) {
    if (cmd.kind !== 'needs.retire' && cmd.kind !== 'needs.depart') continue;
    const s = survivalOf(world, ctx.content, cmd.actorId);
    if (!s || !canAct(world, cmd.actorId)) continue;
    const type = cmd.kind === 'needs.retire' ? 'retire' : 'depart';
    s.ending = { type, at: ctx.now, cause: type === 'retire' ? 'A quiet retirement' : 'Departed beyond the coulee' };
    ctx.emit({
      kind: 'needs.ending',
      data: { actorId: cmd.actorId, type },
      roles: [{ actor: cmd.actorId, role: 'subject' }],
      importance: 90,
      explain: survivalExplain(cmd.actorId, s.ending.cause, ctx.now, type),
    });
  }
}
