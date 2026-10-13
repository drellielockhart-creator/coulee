import type { ActorId } from '../ids.ts';
import type { World } from '../world.ts';
import { authorizeAct } from './agency.ts';
/** Slice 1 has no hostile executor: an independently acting mind can brace once at entry. */
export function tacticalReaction(w: World, id: ActorId): 'guard' | null {
  return authorizeAct(w, id, { kind: 'tactical.guard' }, { kind: 'own' }).ok ? 'guard' : null;
}

import { setCondition } from '../actor.ts';
import { resolveCheck, saveTerms } from '../checks.ts';
import { term } from '../explain.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { addAnxiety, composureOf } from './api.ts';

/** Saved, source-specific fear; only new transitions roll, never observations or resumes. */
export function brawlFear(w: World, ctx: SimContext, id: ActorId, episode: number, trigger: string): void {
  const p = w.psyche.byActor[id],
    a = w.actors[id];
  if (!p || !a) return;
  const key = `${w.tactical?.sceneId}:${episode}:${trigger}`;
  p.combatFear ??= { triggers: [], shaken: false };
  if (p.combatFear.triggers.includes(key)) return;
  p.combatFear.triggers.push(key);
  const roll = resolveCheck(
    {
      label: `Composure: ${trigger}`,
      kind: 'save',
      subjects: [id],
      knowledge: 'self',
      terms: [...saveTerms(a, 'will'), term('psyche', 'Self-Command less anxiety band', composureOf(w, id))],
      dc: 10 + (ctx.content.combat_rules.brawl?.morale_threat ?? 2),
    },
    ctx.rng('psyche', mixKey(id, episode, p.combatFear.triggers.length, w.tactical?.enteredAt ?? 0)),
  );
  if (!roll.success) {
    addAnxiety(w, ctx, id, roll.margin <= -10 ? 200 : roll.margin <= -5 ? 100 : 50);
    p.combatFear.shaken = true;
    setCondition(a, 'combat_shaken', true);
  }
  ctx.emit({
    kind: 'tactical.morale',
    data: {
      actorId: id,
      text: roll.success
        ? 'You steady yourself.'
        : 'You feel shaken (−2 to attacks). Yield, escape or stand your ground; the choice remains yours.',
    },
    roles: [{ actor: id, role: 'subject' }],
    visibility: 'inner',
    explain: roll.explain,
  });
}
export function endBrawlFear(w: World, id: ActorId): void {
  const p = w.psyche.byActor[id],
    a = w.actors[id];
  if (p?.combatFear) p.combatFear.shaken = false;
  if (a) setCondition(a, 'combat_shaken', false);
}
export function brawlIntent(
  w: World,
  ctx: SimContext,
  id: ActorId,
  facts: { hurt: boolean; pinned: boolean; canFlee: boolean },
): 'attack' | 'escape' | 'yield' | 'flee' | null {
  if (!authorizeAct(w, id, { kind: 'tactical.attack' }, { kind: 'own' }).ok) return null;
  const afraid = w.psyche.byActor[id]?.combatFear?.shaken === true;
  const intent = facts.hurt
    ? afraid && facts.canFlee && !facts.pinned
      ? 'flee'
      : 'yield'
    : facts.pinned
      ? 'escape'
      : 'attack';
  ctx.emit({
    kind: 'tactical.morale',
    data: { actorId: id, text: `You choose to ${intent}.` },
    roles: [{ actor: id, role: 'subject' }],
    visibility: 'inner',
    explain: {
      kind: 'arbitration',
      label: 'Brawl: defend yourself or withdraw',
      subjects: [id],
      knowledge: 'self',
      terms: [
        term('health', 'Hurt past half stamina', facts.hurt ? 1 : 0),
        term('psyche', 'Shaken', afraid ? 1 : 0),
        term('condition', 'Restrained', facts.pinned ? 1 : 0),
      ],
      total: facts.hurt ? 1 : 0,
      outcome: intent,
    },
  });
  return intent;
}
