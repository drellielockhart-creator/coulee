/** Cause-specific combat physiology. Deprivation wounds and collapse keep their meaning. */
import { setCondition } from '../actor.ts';
import { resolveCheck, saveTerms, skillCheck } from '../checks.ts';
import { term } from '../explain.ts';
import { type ActorId, idsOf } from '../ids.ts';
import { mixKey } from '../rng.ts';
import { instantOf } from '../sim/clock.ts';
import type { SimContext } from '../sim/context.ts';
import { asGameMinute } from '../time.ts';
import type { World } from '../world.ts';
import { survivalOf } from './survival.ts';
import { die } from './survival-social.ts';

export interface CombatHealth {
  nonlethal: number;
  bruises: number;
  burden: number;
  vigorLost: number;
  dying: boolean;
  stable: boolean;
  failures: number;
  nextDying: number | null;
  nextRecovery: number | null;
  wakeAt?: number | null;
}
export function healthOf(w: World, id: ActorId): Readonly<CombatHealth> | undefined {
  return w.needs.byActor[id]?.combat;
}
function ensure(w: World, id: ActorId): CombatHealth | undefined {
  const n = w.needs.byActor[id];
  if (!n) return;
  n.combat ??= {
    nonlethal: 0,
    bruises: 0,
    burden: 0,
    vigorLost: 0,
    dying: false,
    stable: false,
    failures: 0,
    nextDying: null,
    nextRecovery: null,
  };
  return n.combat;
}
export function combatUnconscious(w: World, id: ActorId): boolean {
  const h = healthOf(w, id);
  return (
    !!h && (h.dying || h.stable || (h.nonlethal > 0 && h.nonlethal >= (w.needs.byActor[id]?.survival?.vigor ?? 1)))
  );
}
function conditions(w: World, id: ActorId): void {
  const a = w.actors[id],
    h = healthOf(w, id),
    s = w.needs.byActor[id]?.survival;
  if (!a || !h) return;
  setCondition(a, 'combat_unconscious', combatUnconscious(w, id));
  setCondition(a, 'dying', h.dying);
  setCondition(a, 'spent', s?.vigor === 0);
  setCondition(a, 'staggered', h.burden + (s?.wounds ?? 0) >= Math.max(1, Math.floor(a.sheet.abilities.con / 2)));
}
/** Lethal is an API hook for slice 3, never an implicit brawl escalation. */
export function applyHit(
  w: World,
  ctx: SimContext,
  id: ActorId,
  damage: number,
  options: { nonlethal: boolean; critical?: boolean; criticalBonus?: number } = { nonlethal: true },
): void {
  const a = w.actors[id],
    h = ensure(w, id),
    s = survivalOf(w, ctx.content, id),
    t = ctx.content.combat_rules.brawl;
  if (!a?.alive || !h || !s || !t || !Number.isSafeInteger(damage) || damage <= 0) return;
  if (options.nonlethal) {
    h.nonlethal += damage;
    if (options.critical) h.bruises++;
    h.nextRecovery ??= instantOf(w) + t.nonlethal_recovery_ticks;
  } else {
    const spent = Math.min(s.vigor, damage);
    s.vigor -= spent;
    h.vigorLost += spent;
    // Provenance prevents ordinary hunger recovery from refilling combat Vigor.
    s.vigorHarm ??= {};
    s.vigorHarm.combat = (s.vigorHarm.combat ?? 0) + spent;
    const con = a.sheet.abilities.con;
    const wound = Math.max(
      damage - spent,
      options.criticalBonus ?? 0,
      damage >= con ? damage - Math.floor(con / 2) : 0,
    );
    h.burden += wound >= 15 ? 8 : wound >= 10 ? 4 : wound >= 5 ? 2 : wound > 0 ? 1 : 0;
    if (h.burden + s.wounds >= con && !h.dying) {
      h.dying = true;
      h.stable = false;
      h.wakeAt = null;
      h.failures = 0;
      h.nextDying = instantOf(w) + t.dying_ticks;
    }
  }
  conditions(w, id);
  ctx.emit({
    kind: 'needs.combat_health',
    data: {
      actorId: id,
      text: h.dying
        ? 'Falls unconscious and is Dying.'
        : combatUnconscious(w, id)
          ? 'Falls unconscious from nonlethal blows.'
          : options.critical
            ? 'Suffers a light, nonbleeding bruise.'
            : 'Takes a blow.',
    },
    roles: [{ actor: id, role: 'subject' }],
    place: a.placeId,
    visibility: 'witnessed',
    importance: combatUnconscious(w, id) ? 70 : 25,
    explain: {
      kind: 'formula',
      label: 'Combat health',
      knowledge: 'self',
      subjects: [id],
      terms: [
        term(
          'damage',
          options.nonlethal ? 'Nonlethal counter' : 'Injury burden',
          options.nonlethal ? h.nonlethal : h.burden,
        ),
        term('vigor', 'Current Vigor', s.vigor),
      ],
      total: damage,
      outcome: combatUnconscious(w, id) ? 'unconscious' : 'hurt',
    },
  });
}
export function nextCombatHealthInstant(w: World): number | undefined {
  let next: number | undefined;
  for (const id of idsOf<ActorId>(w.needs.byActor)) {
    if (!w.actors[id]?.alive) continue;
    const h = healthOf(w, id);
    for (const at of [h?.nextDying, h?.nextRecovery, h?.wakeAt])
      if (at != null && (next === undefined || at < next)) next = at;
  }
  return next;
}
export function advanceCombatHealth(w: World, ctx: SimContext): void {
  const now = instantOf(w),
    t = ctx.content.combat_rules.brawl;
  if (!t) return;
  for (const id of idsOf<ActorId>(w.needs.byActor)) {
    const h = w.needs.byActor[id]?.combat,
      a = w.actors[id];
    if (!h || !a?.alive) continue;
    while (h.nextDying !== null && h.nextDying <= now && h.dying) {
      const at = h.nextDying;
      const roll = resolveCheck(
        {
          label: 'Fortitude while Dying',
          kind: 'save',
          subjects: [id],
          knowledge: 'self',
          terms: saveTerms(a, 'fortitude'),
          dc: t.dying_dc,
        },
        ctx.rngAt?.('needs', asGameMinute(Math.floor(at / 600)), mixKey(id, at, 0xd1e)) ??
          ctx.rng('needs', mixKey(id, at, 0xd1e)),
      );
      if (!roll.success) h.failures++;
      h.nextDying += t.dying_ticks;
      ctx.emit({
        kind: 'needs.combat_health',
        data: { actorId: id, text: roll.success ? 'Still Dying; holds on.' : 'Dying worsens.' },
        roles: [{ actor: id, role: 'subject' }],
        place: a.placeId,
        visibility: 'witnessed',
        explain: roll.explain,
      });
      if (h.failures >= t.dying_failures) {
        h.nextDying = null;
        h.dying = false;
        h.stable = false;
        die(w, ctx, id, 'combat injuries', { ...roll.explain, label: 'Three failed Dying saves', outcome: 'dead' });
      }
    }
    if (h.nextRecovery !== null && h.nextRecovery <= now) {
      const intervals = 1 + Math.floor((now - h.nextRecovery) / t.nonlethal_recovery_ticks);
      h.nonlethal = Math.max(0, h.nonlethal - intervals);
      h.nextRecovery = h.nonlethal > 0 ? h.nextRecovery + intervals * t.nonlethal_recovery_ticks : null;
    }
    if (h.stable && h.wakeAt == null) h.wakeAt = now + t.nonlethal_recovery_ticks;
    if (h.stable && h.wakeAt != null && h.wakeAt <= now) {
      h.stable = false;
      h.wakeAt = null;
      ctx.emit({
        kind: 'needs.combat_health',
        data: { actorId: id, text: 'Stable recovery: wakes from injury unconsciousness.' },
        roles: [{ actor: id, role: 'subject' }],
        place: a.placeId,
        visibility: 'witnessed',
      });
    }
    conditions(w, id);
  }
}
/** Called only by the timed, authorized stabilization executor. Bleeding treatment is separate. */
export function stabilize(w: World, ctx: SimContext, helper: ActorId, target: ActorId, token: number): void {
  const h = w.needs.byActor[target]?.combat,
    a = w.actors[helper];
  if (!h?.dying || !a || !w.actors[target]?.alive) return;
  const roll = skillCheck(
    ctx.content,
    a,
    {
      label: 'Medicine: stabilize Dying',
      skill: 'medicine',
      dc: ctx.content.combat_rules.brawl?.dying_dc ?? 15,
      knowledge: 'self',
    },
    ctx.rng('needs', mixKey(helper, target, token, instantOf(w))),
  );
  if (roll.success) {
    h.dying = false;
    h.stable = true;
    h.wakeAt = instantOf(w) + (ctx.content.combat_rules.brawl?.nonlethal_recovery_ticks ?? 36000);
    h.nextDying = null;
  }
  conditions(w, target);
  ctx.emit({
    kind: 'needs.combat_health',
    data: {
      actorId: target,
      text: roll.success
        ? 'Stabilized; remains unconscious. Bleeding would need separate treatment.'
        : 'Stabilization failed; still Dying.',
    },
    roles: [
      { actor: helper, role: 'agent' },
      { actor: target, role: 'subject' },
    ],
    place: a.placeId,
    visibility: 'witnessed',
    explain: roll.explain,
  });
}
