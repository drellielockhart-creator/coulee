import { abilityMod } from '../actor.ts';
import { opposedCheck, resolveCheck } from '../checks.ts';
import { type Explain, term } from '../explain.ts';
import type { ActorId } from '../ids.ts';
import { mixKey } from '../rng.ts';
import { instantOf } from '../sim/clock.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';

export function attackTerms(w: World, id: ActorId) {
  const a = w.actors[id];
  return [
    term('ability', 'Strength', abilityMod(a?.sheet.abilities.str ?? 10)),
    term('progression', 'Attack progression', a?.sheet.combat?.attack ?? 0),
    term('condition', 'Shaken', a?.sheet.conditions.includes('combat_shaken') ? -2 : 0),
    term('condition', 'Spent', a?.sheet.conditions.includes('spent') ? -2 : 0),
  ];
}
export function defense(w: World, id: ActorId): number {
  const a = w.actors[id],
    p = w.tactical?.participants[id];
  const dex = abilityMod(a?.sheet.abilities.dex ?? 10);
  return 10 + (p?.unready ? Math.min(0, dex) : dex) + (p?.guarding ? 2 : 0);
}
/** Public outcome cannot reveal an opponent's Defense or reconstruct their hidden modifiers. */
function disclosure(label: string, a: ActorId, b: ActorId, success: boolean, full: Explain, self: Explain[]): Explain {
  return {
    kind: 'check',
    label,
    subjects: [a, b],
    knowledge: 'public',
    terms: [],
    total: success ? 1 : 0,
    outcome: success ? 'success' : 'failure',
    children: [{ ...full, knowledge: 'omniscient' }, ...self],
  };
}
export function meleeCheck(w: World, ctx: SimContext, a: ActorId, b: ActorId, token: number) {
  const r = ctx.rng('combat', mixKey(w.tactical?.enteredAt ?? 0, instantOf(w), a, b, token, 0xf157));
  const spec = {
    label: 'Unarmed attack',
    kind: 'attack' as const,
    subjects: [a],
    terms: attackTerms(w, a),
    dc: defense(w, b),
  };
  const hit = resolveCheck(spec, r);
  const confirmation =
    hit.success && hit.natural === 20 ? resolveCheck({ ...spec, label: 'Confirm nonlethal critical' }, r) : null;
  const critical = confirmation?.success === true;
  const die = hit.success ? r.int(1, ctx.content.combat_rules.brawl?.fist_die ?? 3) : 0;
  const damage = hit.success ? Math.max(1, die + abilityMod(w.actors[a]?.sheet.abilities.str ?? 10)) : 0;
  const { dc: _dc, margin: _margin, ...own } = hit.explain;
  const explain = disclosure(
    'Unarmed blow',
    a,
    b,
    hit.success,
    { ...hit.explain, children: confirmation ? [confirmation.explain] : [] },
    [
      { ...own, knowledge: 'self', note: 'Opponent Defense is withheld.' },
      ...(confirmation
        ? [
            {
              kind: 'check',
              label: 'Your critical confirmation',
              subjects: [a],
              knowledge: 'self' as const,
              terms: confirmation.explain.terms,
              roll: { die: 20, natural: confirmation.natural },
              total: confirmation.total,
              outcome: confirmation.success ? 'confirmed' : 'not confirmed',
            },
          ]
        : []),
      {
        kind: 'formula',
        label: 'Your Defense',
        subjects: [b],
        knowledge: 'self',
        terms: [term('defense', 'Defense', spec.dc)],
        total: spec.dc,
        outcome: hit.success ? 'hit' : 'miss',
      },
      ...(hit.success
        ? [
            {
              kind: 'formula',
              label: 'Nonlethal damage',
              subjects: [a],
              knowledge: 'self' as const,
              terms: [
                term('roll', 'Fist damage die', die),
                term('ability', 'Strength', abilityMod(w.actors[a]?.sheet.abilities.str ?? 10)),
              ],
              total: damage,
              outcome: critical ? 'light nonbleeding bruise' : 'nonlethal',
            },
          ]
        : []),
    ],
  );
  return { hit: hit.success, damage, critical, explain };
}
export function grappleCheck(w: World, ctx: SimContext, a: ActorId, b: ActorId, token: number) {
  const terms = (id: ActorId) => [
    ...attackTerms(w, id),
    term('size', 'Grapple size', w.actors[id]?.sheet.combat?.grappleSize ?? 0),
  ];
  const roll = opposedCheck(
    'Grapple',
    { label: 'Grappler', subject: a, terms: terms(a) },
    { label: 'Defender', subject: b, terms: terms(b) },
    ctx.rng('combat', mixKey(a, b, token, instantOf(w), 0x67ab)),
  );
  return {
    success: roll.initiatorWins,
    explain: disclosure(
      'Grapple contest (defender wins ties)',
      a,
      b,
      roll.initiatorWins,
      roll.explain,
      (roll.explain.children ?? []).map((e) => ({ ...e, knowledge: 'self' })),
    ),
  };
}
