/**
 * Refusal has costs on both sides (design-docs/00 decisions, 2026-10-12: "the option that leads to
 * the most interesting gameplay outcomes"). A keeper at the attachment cap may turn a neighbor
 * away, but the refusal becomes a story, not a stall.
 *
 * - The keeper: each refusal accrues duty-guilt scaled by honesty and neighborliness, by the asker's
 *   need and by the bond between them. Guilt is an inner cost (moral anxiety, a superego thought to
 *   make it right), it weighs on the next decision to lend (social `holderDecision`) and on lending
 *   unasked, it eases with lending to those turned away, and it fades slowly. An honest keeper ends
 *   up lending and running a rota; a dishonest one feels little and hoards. A commanded keeper (the
 *   player) still feels it, and still lends or refuses only by Command.
 * - The refused: regard for the keeper falls, the wish for the thing rises (covet acts follow), the
 *   refusal becomes gossip ("they keep it to themselves while others go short"), and refusal after
 *   refusal founds grudges that run along the existing strife lines (an apology owed; humiliation).
 *
 * `charmCovetPressure` feeds the Id proposal in urges.ts; social owns the theft executor.
 * OWNER: module:fae.
 */
import { formGrudge, internProp, observe } from '../belief/api.ts';
import { term } from '../explain.ts';
import type { ActorId, HouseholdId, ItemId } from '../ids.ts';
import { addAnxiety, addThought, normStrength } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import { addOpinionReason, opinionOf } from '../social/api.ts';
import type { World } from '../world.ts';
import { charmDefOf, keeperOf } from './charms.ts';
import { householdArg, householdShort, itemArg } from './desire.ts';
import type { CharmState } from './state.ts';
import { loanTerms } from './urges.ts';

/** Guilt never piles past this: a conscience can only weigh so much. */
export const GUILT_CAP = 600;
/** Refusals of the same asker that found a grudge, and its aim. */
const GRUDGE_STEPS: ReadonlyArray<{ n: number; aim: 'apology' | 'humiliation'; intensity: number; label: string }> = [
  { n: 3, aim: 'apology', intensity: 45, label: 'Turned us away three times' },
  { n: 5, aim: 'humiliation', intensity: 55, label: 'Sits on plenty and turns neighbors away' },
];

/** A keeper's duty-guilt over this charm (0 if none). */
export function charmGuilt(world: World, keeperId: ActorId, itemId: ItemId): number {
  return world.fae?.charms?.[itemId]?.guilt?.[keeperId] ?? 0;
}

/** Whether anyone of a household has been turned away from this charm (and not since lent to). */
export function refusedHousehold(world: World, c: CharmState, hid: HouseholdId): boolean {
  for (const key of Object.keys(c.refusals ?? {})) {
    const rec = c.refusals?.[Number(key)];
    if (rec && rec.n > 0 && world.actors[Number(key)]?.householdId === hid) return true;
  }
  return false;
}

/**
 * The guilt a keeper weighs when `askerId` asks: in full toward someone already turned away (or of
 * their household), half toward anyone else (13 §5.6: attachment competes with conscience).
 */
export function guiltToward(world: World, keeperId: ActorId, askerId: ActorId, itemId: ItemId): number {
  const c = world.fae?.charms?.[itemId];
  const guilt = c?.guilt?.[keeperId] ?? 0;
  if (!c || guilt <= 0) return 0;
  const hid = world.actors[askerId]?.householdId;
  return hid !== undefined && refusedHousehold(world, c, hid) ? guilt : Math.floor(guilt / 2);
}

/**
 * A keeper turned a neighbor away: `how` is the keeper's own decision, a commanded keeper's answer,
 * or a request left to lapse. Both sides pay (see the file header).
 */
export function charmRefused(
  world: World,
  ctx: SimContext,
  keeperId: ActorId,
  askerId: ActorId,
  itemId: ItemId,
  how: 'decided' | 'answered' | 'lapsed',
): void {
  const c = world.fae?.charms?.[itemId];
  const keeper = world.actors[keeperId];
  const asker = world.actors[askerId];
  const def = charmDefOf(ctx.content, c?.defId);
  if (!c || !def || !keeper?.alive || !asker?.alive || keeper.householdId === asker.householdId) return;
  c.refusals ??= {};
  const rec: NonNullable<CharmState['refusals']>[number] = c.refusals[askerId] ?? { n: 0, last: 0, grudges: 0 };
  rec.n += 1;
  rec.last = ctx.now;
  rec.by = keeperId;
  c.refusals[askerId] = rec;

  // The keeper: duty-guilt by conscience, need and bond.
  const honesty = normStrength(world, keeperId, 'honesty');
  const neighborly = normStrength(world, keeperId, 'neighborliness');
  const short = householdShort(world, asker.householdId);
  const affection = Math.max(-50, Math.min(100, opinionOf(world, keeperId, askerId).affection));
  const conscience = honesty * 2 + neighborly;
  const needPct = short ? 150 : 100;
  const bondPct = 100 + affection;
  const gain = Math.floor((conscience * needPct * bondPct) / 10000);
  c.guilt ??= {};
  const guilt = Math.min(GUILT_CAP, (c.guilt[keeperId] ?? 0) + gain);
  c.guilt[keeperId] = guilt;
  if (gain > 0) addAnxiety(world, ctx, keeperId, Math.floor(gain / 4), 'moral');
  const asked = `${asker.name.given} ${asker.name.family}`.trim();
  addThought(world, ctx, keeperId, {
    urge: { kind: 'interaction', interactionId: 'share_out', targetId: askerId, itemId, terms: loanTerms(ctx.now) },
    voice: 'superego',
    intensity: Math.min(1000, 150 + guilt),
    label: `I turned ${asker.name.given} away${short ? ', and their children short' : ''}`,
    source: 'fae',
    norm: 'duty',
    reasons: [term('psyche', 'Guilt over turning neighbors away', guilt)],
  });
  ctx.emit({
    kind: 'fae.turned_away',
    visibility: 'inner',
    roles: [
      { actor: keeperId, role: 'agent' },
      { actor: askerId, role: 'target' },
    ],
    data: {
      itemId,
      keeperId,
      askerId,
      guilt,
      refusals: rec.n,
      text: `${keeper.name.given} turned ${asked} away${how === 'lapsed' ? ', by saying nothing' : ''}; it sits on ${keeper.sex === 'female' ? 'her' : keeper.sex === 'male' ? 'his' : 'their'} conscience.`,
    },
    explain: {
      kind: 'formula',
      label: 'Duty-guilt for turning a neighbor away',
      subjects: [keeperId],
      knowledge: 'self',
      terms: [
        term('psyche', 'Honesty ×2 + Neighborliness', conscience),
        term('need', short ? 'They are short (×150%)' : 'They are not short (×100%)', needPct),
        term('opinion', 'Bond (100 + affection)', bondPct),
        term('psyche', 'Guilt added', gain),
      ],
      total: guilt,
      outcome: `guilt ${guilt}`,
    },
  });

  // The refused: regard falls, the wish rises, the story goes round, grudges grow.
  addOpinionReason(world, ctx, askerId, keeperId, {
    label: 'Turned us away when we asked',
    cites: { kind: 'other', strength: 600 },
    delta: { affection: -4, respect: -2, trust: -6, fear: 0 },
    since: ctx.now as never,
  });
  c.desire[askerId] = Math.min(100, (c.desire[askerId] ?? 0) + 8 + (short ? 8 : 0));
  observe(world, ctx, askerId, internProp(world, 'hoards', [householdArg(keeper.householdId), itemArg(itemId)]), {
    type: 'observation',
    dir: 1,
    sourceId: null,
    eventId: null,
    scalePct: 50 + 25 * Math.min(rec.n, 2),
  });
  for (const [i, step] of GRUDGE_STEPS.entries()) {
    if (rec.n < step.n || rec.grudges > i) continue;
    formGrudge(world, ctx, {
      holderId: askerId,
      target: { kind: 'actor', id: keeperId },
      aim: step.aim,
      intensity: step.intensity,
      label: step.label,
    });
    rec.grudges += 1;
  }
}

/** Daily: guilt fades slowly (about 4% a day, at least 2), and is forgotten at zero. */
export function guiltDaily(c: CharmState): void {
  for (const key of Object.keys(c.guilt ?? {})) {
    const g = c.guilt?.[Number(key)] ?? 0;
    const next = g - Math.max(2, Math.floor(g / 25));
    if (c.guilt) {
      if (next <= 0) delete c.guilt[Number(key)];
      else c.guilt[Number(key)] = next;
    }
  }
}

/**
 * The charm went to someone from a household that had been turned away: the giver's guilt halves,
 * and that household's count of refusals starts again (grudges already founded stay founded).
 */
export function guiltEased(world: World, c: CharmState, giverId: ActorId | null, receiverId: ActorId): void {
  const hid = world.actors[receiverId]?.householdId;
  if (giverId === null || hid === undefined || !refusedHousehold(world, c, hid)) return;
  if (c.guilt?.[giverId] !== undefined) c.guilt[giverId] = Math.floor(c.guilt[giverId] / 2);
  for (const key of Object.keys(c.refusals ?? {})) {
    const rec = c.refusals?.[Number(key)];
    if (rec && world.actors[Number(key)]?.householdId === hid) rec.n = 0;
  }
}

/**
 * The pressure behind desperation theft: how hard a refused, wanting actor presses toward
 * the charm. Desire, plus 100 for each time turned away, plus 200 when the household is short.
 * A generic theft act in module:social can compare this against its own threshold and the
 * actor's honesty; it is 0 for the keeping household.
 */
export function charmCovetPressure(world: World, actorId: ActorId, itemId: ItemId): number {
  const c = world.fae?.charms?.[itemId];
  const a = world.actors[actorId];
  if (!c || !a) return 0;
  const keeper = keeperOf(world, c);
  if (keeper !== null && world.actors[keeper]?.householdId === a.householdId) return 0;
  const refused = c.refusals?.[actorId]?.n ?? 0;
  return (c.desire[actorId] ?? 0) + refused * 100 + (householdShort(world, a.householdId) ? 200 : 0);
}
