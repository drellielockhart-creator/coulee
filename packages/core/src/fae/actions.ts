/**
 * Executors for charm acts (13 §5.3, §6.1, §6.6): the fae activities an arbitration chose, and
 * the fae Commands a player (or any issuer) gives. Every one passes `authorizeAct` before it
 * changes anything; a refusal is named on `fae.charm_refused` and changes nothing.
 * OWNER: module:fae.
 */
import { internProp, observe } from '../belief/api.ts';
import { skillCheck } from '../checks.ts';
import type { Command } from '../command.ts';
import type { Explain } from '../explain.ts';
import type { ActorId, HouseholdId, ItemId } from '../ids.ts';
import { asItemId, idsOf } from '../ids.ts';
import { atPlace, carriedBy, consumeStack, deleteStack, moveStack, pantryOf, stacksDeep } from '../items/api.ts';
import { purchase, storeOpen } from '../provisions/api.ts';
import { authorizeAct, type Basis, chosenUrge, commandBasis } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { attemptTheft } from '../social/api.ts';
import type { World } from '../world.ts';
import { restitutionOwed } from './arc.ts';
import { charmDefOf, holdingOf, keeperOf, knownRecord, learn } from './charms.ts';
import { ironByPlace } from './conditions.ts';
import { believedKeeper, householdArg, itemArg } from './desire.ts';
import { countStock } from './discovery.ts';
import { drawEffectOf } from './draws.ts';
import { takeFound } from './found.ts';
import type { CharmState } from './state.ts';
import {
  canReach,
  offeringBlocked,
  setOffering,
  stowCharm,
  type TendResult,
  thankCharm,
  tieCharm,
  tieWindow,
} from './tend.ts';
import { seedClaimId } from './witness.ts';

const SALT_STUDY = 0x57d1;
const SALT_RITE = 0x7173;

const FAE_ACTIVITIES = [
  'steal_charm',
  'tend_charm',
  'fetch_charm',
  'study_charm',
  'bury_charm',
  'destroy_charm',
  'return_charm',
];

function refuse(
  _world: World,
  ctx: SimContext,
  actorId: ActorId,
  itemId: ItemId | null,
  command: string,
  reason: string,
) {
  ctx.emit({
    kind: 'fae.charm_refused',
    visibility: 'private',
    roles: [{ actor: actorId, role: 'agent' }],
    data: { actorId, itemId, command, reason },
    explain: {
      kind: 'choice',
      label: `${command}: not done`,
      subjects: [actorId],
      knowledge: 'self',
      terms: [],
      total: 0,
      outcome: reason,
    },
  });
}

function revealed(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  c: CharmState,
  facts: string[],
  text: string,
  explain?: Explain,
  householdId?: HouseholdId,
): void {
  ctx.emit({
    kind: 'fae.charm_revealed',
    ...(world.actors[actorId] ? { place: world.actors[actorId].placeId } : {}),
    visibility: 'private',
    importance: facts.includes('effects') ? 30 : 10,
    roles: [{ actor: actorId, role: 'agent' }],
    data: {
      itemId: c.itemId,
      charm: c.defId,
      actorId,
      facts,
      text,
      ...(householdId !== undefined ? { householdId } : {}),
    },
    ...(explain ? { explain } : {}),
  });
}

/** Within reach to look at: one's own, or shown it and standing where it is. */
function canLook(world: World, actorId: ActorId, c: CharmState, now: number): boolean {
  if (canReach(world, actorId, c)) return true;
  const stack = world.items.stacks[c.itemId];
  const a = world.actors[actorId];
  if (!stack || !a) return false;
  const h = holdingOf(world, stack);
  if (h.placeId !== a.placeId) return false;
  if ((c.access?.[actorId] ?? -1) >= now) return true;
  return c.reservoir !== null && (c.noticedBy ?? []).includes(actorId);
}

/** Inspection (13 §5.3): 10 minutes, DC 10, shows construction. */
export function inspectCharm(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, basis: Basis): TendResult {
  if (!canLook(world, actorId, c, ctx.now)) return { ok: false, reason: 'You cannot get a look at it' };
  const ok = authorizeAct(world, actorId, { kind: 'inspect_charm', itemId: c.itemId }, basis);
  if (!ok.ok) return { ok: false, reason: ok.reason };
  const def = charmDefOf(ctx.content, c.defId);
  const a = world.actors[actorId];
  if (!def || !a) return { ok: false, reason: 'Nothing to see' };
  const r = skillCheck(
    ctx.content,
    a,
    { label: 'Look it over', skill: 'perception', dc: 10, knowledge: 'self' },
    ctx.rng('checks', mixKey(c.itemId, actorId, SALT_STUDY, 1)),
  );
  if (!r.success) {
    revealed(world, ctx, actorId, c, [], 'You turn it over and see an ordinary thing, oddly light.', r.explain);
    return { ok: true, text: 'An ordinary thing, oddly light.' };
  }
  learn(world, actorId, c.itemId, 'construction', ctx.now);
  const item = ctx.content.items[c.defId];
  const text = `${item?.name ?? 'It'}: no seam you can find, and it weighs less than cloth should.${def.saying ? ` The saying that goes with it: "${def.saying}"` : ''} No folk charm made it: this is fae work.`;
  revealed(world, ctx, actorId, c, ['construction'], text, r.explain);
  return { ok: true, text };
}

/**
 * Study (13 §5.3): an hour, Spellcraft DC 15 + 3·tier, spending 1 virtue: the effects and the draw
 * (where it takes from, as the studier now knows), and its harm basis. Lore (Fae) at DC +5 names
 * the counterparty. No roll reveals an owner's memories or anyone's concealed ancestry.
 */
export function studyCharm(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, basis: Basis): TendResult {
  if (!canLook(world, actorId, c, ctx.now)) return { ok: false, reason: 'You cannot get at it to study it' };
  const ok = authorizeAct(world, actorId, { kind: 'study_charm', itemId: c.itemId }, basis);
  if (!ok.ok) return { ok: false, reason: ok.reason };
  const def = charmDefOf(ctx.content, c.defId);
  const a = world.actors[actorId];
  if (!def || !a) return { ok: false, reason: 'Nothing to study' };
  learn(world, actorId, c.itemId, 'construction', ctx.now);
  if (c.virtue < 1) {
    revealed(world, ctx, actorId, c, ['construction'], 'It lies dormant: there is nothing working in it to read now.');
    return { ok: true, text: 'Dormant: nothing working in it to read now.' };
  }
  c.virtue -= 1;
  const day = Math.floor(ctx.now / 1440);
  const r = skillCheck(
    ctx.content,
    a,
    { label: 'Study what it does', skill: 'spellcraft', dc: 15 + 3 * def.tier, knowledge: 'self' },
    ctx.rng('checks', mixKey(c.itemId, actorId, SALT_STUDY, day)),
  );
  if (!r.success) {
    revealed(world, ctx, actorId, c, ['construction'], 'Whatever it does, it does not show you this time.', r.explain);
    return { ok: true, text: 'It does not show you what it does this time.' };
  }
  learn(world, actorId, c.itemId, 'effects', ctx.now);
  const facts = ['effects'];
  const sources: HouseholdId[] = [];
  for (const key of Object.keys(world.fae.drawCases ?? {}).sort()) {
    const dc = world.fae.drawCases?.[key];
    if (dc?.itemId === c.itemId && dc.householdId !== null && !sources.includes(dc.householdId))
      sources.push(dc.householdId);
  }
  const eventItem = itemArg(c.itemId);
  // The true function, as found: it steals (the truth-route claim) and from whom.
  const steals = def.claims.find((x) => x.route === 'truth');
  if (steals)
    observe(world, ctx, actorId, internProp(world, `claim.${c.defId}.${steals.id}`, [eventItem]), {
      type: 'physical',
      dir: 1,
      sourceId: null,
      eventId: null,
    });
  const seed = seedClaimId(world, ctx, c);
  for (const hid of sources) {
    observe(world, ctx, actorId, internProp(world, 'draws_from', [eventItem, householdArg(hid)]), {
      type: 'physical',
      dir: 1,
      sourceId: null,
      eventId: null,
    });
    const k = knownRecord(world, actorId, c.itemId);
    k.sources = [...(k.sources ?? []).filter((x) => x !== hid), hid];
    k.losses ??= {};
    k.losses[hid] = restitutionOwed(world, c.itemId, hid);
  }
  // From nothing it makes nothing (the exaggerations are refuted by what it is).
  for (const x of def.claims)
    if (x.group === 'output' && x.from !== undefined && x.id !== seed)
      observe(world, ctx, actorId, internProp(world, `claim.${c.defId}.${x.id}`, [eventItem]), {
        type: 'physical',
        dir: -1,
        sourceId: null,
        eventId: null,
      });
  const lore = skillCheck(
    ctx.content,
    a,
    { label: 'Whose it is', skill: 'lore_fae', dc: 20 + 3 * def.tier, knowledge: 'self' },
    ctx.rng('checks', mixKey(c.itemId, actorId, SALT_STUDY, day, 2)),
  );
  if (lore.success) {
    learn(world, actorId, c.itemId, 'counterparty', ctx.now);
    facts.push('counterparty');
  }
  const names = sources.map((h) => world.households[h]?.name ?? 'someone').join(', ');
  const item = ctx.content.items[c.defId];
  const text = `${item?.truth ?? 'It does what is said of it, at a cost.'}${sources.length ? ` It has been drawing from: ${names}.` : ' It has drawn from no one yet.'} Whatever it takes is its keeper's doing (${def.harm_basis === 'instrument' ? 'the keeper is its hand' : 'fae harm'}).${lore.success ? ` It belongs to the ${def.court === 'hearth' ? 'Hearth: the Good Neighbors of farms and mills' : def.court}.` : ''}`;
  revealed(world, ctx, actorId, c, facts, text, {
    ...r.explain,
    children: [...(r.explain.children ?? []), lore.explain],
  });
  return { ok: true, text };
}

/** Bury it at home under the sill (or at a crossroads) with iron on it (13 §6.6). */
function buryCharm(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, basis: Basis): TendResult {
  const a = world.actors[actorId];
  const stack = world.items.stacks[c.itemId];
  if (!a || !stack || holdingOf(world, stack).actorId !== actorId)
    return { ok: false, reason: 'You must have it with you' };
  const place = world.places[a.placeId];
  const home = world.households[a.householdId]?.homePlaceId === a.placeId;
  if (!place || !(home || place.tags.includes('crossroads') || place.tags.includes('road')))
    return { ok: false, reason: 'Bury it under your own sill or at a crossroads' };
  // The iron that goes in with it: something of the actor's or the household's that is iron.
  const iron = [...stacksDeep(world, carriedBy(actorId)), ...stacksDeep(world, pantryOf(a.householdId))].find(
    ({ stack: s }) =>
      s.id !== c.itemId &&
      (ctx.content.items[s.defId]?.materials ?? []).some((m) => ['iron', 'cold_iron', 'steel'].includes(m.material)) &&
      !Object.keys(ctx.content.items[s.defId]?.affordances ?? {}).some((k) =>
        ['cook', 'boil', 'bake', 'fry'].includes(k),
      ),
  );
  if (!iron) return { ok: false, reason: 'You have no iron to bury with it (a horseshoe or nails will do)' };
  const ok = authorizeAct(world, actorId, { kind: 'bury_charm', itemId: c.itemId }, basis);
  if (!ok.ok) return { ok: false, reason: ok.reason };
  // Laid in the ground with the iron on it: both lie loose at the spot, in contact (13 §6.6).
  moveStack(world, ctx, c.itemId, 1, atPlace(a.placeId));
  moveStack(world, ctx, iron.stack.id, 1, atPlace(a.placeId));
  dispose(
    world,
    ctx,
    actorId,
    c,
    'buried',
    `buried under the sill at ${place.name} with ${ctx.content.items[iron.stack.defId]?.name.toLowerCase() ?? 'iron'} on it`,
  );
  return { ok: true, text: 'Buried, with iron on it.' };
}

/** Cold iron and fire at a forge: Trade (Smithing) DC 15 + 3·tier with ≥ 5 lb of iron at hand. */
function destroyCharm(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, basis: Basis): TendResult {
  const a = world.actors[actorId];
  const stack = world.items.stacks[c.itemId];
  const def = charmDefOf(ctx.content, c.defId);
  if (!a || !stack || !def || holdingOf(world, stack).actorId !== actorId)
    return { ok: false, reason: 'You must have it with you' };
  const place = world.places[a.placeId];
  if (!place?.tags.includes('smithy')) return { ok: false, reason: 'It wants a forge' };
  if ((ironByPlace(world, ctx.content)[a.placeId] ?? 0) < 2270)
    return { ok: false, reason: 'Not enough iron at this forge' };
  const ok = authorizeAct(world, actorId, { kind: 'destroy_charm', itemId: c.itemId }, basis);
  if (!ok.ok) return { ok: false, reason: ok.reason };
  // The smith's hand helps: the best Trade (Smithing) among the actor and a smith at the forge.
  const smiths = (world.activity.occupancy[a.placeId] ?? [])
    .map((x) => world.actors[x])
    .filter((x) => x?.alive)
    .sort(
      (x, y) =>
        (y?.sheet.skills.trade_smithing ?? 0) - (x?.sheet.skills.trade_smithing ?? 0) || (x?.id ?? 0) - (y?.id ?? 0),
    );
  const hand =
    smiths[0] && (smiths[0].sheet.skills.trade_smithing ?? 0) > (a.sheet.skills.trade_smithing ?? 0) ? smiths[0] : a;
  const r = skillCheck(
    ctx.content,
    hand,
    { label: 'Iron and fire', skill: 'trade_smithing', dc: 15 + 3 * def.tier, knowledge: 'participants' },
    ctx.rng('checks', mixKey(c.itemId, hand.id, SALT_RITE, Math.floor(ctx.now / 1440))),
  );
  if (!r.success) {
    refuse(
      world,
      ctx,
      actorId,
      c.itemId,
      'destroy',
      'It will not take the fire this time; it comes out of the coals whole.',
    );
    return { ok: false, reason: 'It will not burn this time' };
  }
  dispose(world, ctx, actorId, c, 'destroyed', `burned on the forge at ${place.name}`, r.explain);
  deleteStack(world, c.itemId);
  return { ok: true, text: 'It goes into the coals and does not come out.' };
}

/** Given back where tribute has been kept, overnight with porridge and butter (13 §6.6). */
function returnCharm(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, basis: Basis): TendResult {
  const a = world.actors[actorId];
  const stack = world.items.stacks[c.itemId];
  const def = charmDefOf(ctx.content, c.defId);
  if (!a || !stack || !def || holdingOf(world, stack).actorId !== actorId)
    return { ok: false, reason: 'You must have it with you' };
  const place = world.places[a.placeId];
  if (!place) return { ok: false, reason: 'Nowhere to leave it' };
  const tribute = def.court === 'hearth' ? place.tags.includes('hearth_tribute') : place.faeIntensity >= 3;
  if (!tribute)
    return { ok: false, reason: 'Leave it where tribute has been kept: a saucer behind a hopper, a porridge sill' };
  const offering = def.recharge.find((r) => r.kind === 'offering');
  const items = offering?.kind === 'offering' ? offering.items : [];
  const plan: Array<{ id: ItemId; qty: number }> = [];
  for (const need of items) {
    let left = need.qty;
    for (const loc of [carriedBy(actorId), pantryOf(a.householdId)])
      for (const { stack: s } of stacksDeep(world, loc)) {
        if (left <= 0 || s.defId !== need.def || s.id === c.itemId) continue;
        const take = Math.min(left, s.qty);
        plan.push({ id: s.id, qty: take });
        left -= take;
      }
    if (left > 0) return { ok: false, reason: `It wants porridge and butter with it (${need.def})` };
  }
  const ok = authorizeAct(world, actorId, { kind: 'return_charm', itemId: c.itemId }, basis);
  if (!ok.ok) return { ok: false, reason: ok.reason };
  for (const p of plan) consumeStack(world, ctx, p.id, p.qty, 'fae_offering');
  const r = skillCheck(
    ctx.content,
    a,
    { label: 'Give it back with courtesy', skill: 'fae_courtesy', dc: 15 + 2 * def.tier, knowledge: 'self' },
    ctx.rng('checks', mixKey(c.itemId, actorId, SALT_RITE, 7)),
  );
  if (!r.success) {
    refuse(
      world,
      ctx,
      actorId,
      c.itemId,
      'return',
      'In the morning the porridge is gone and the thing is still there.',
    );
    return { ok: false, reason: 'It was not taken back this time' };
  }
  dispose(
    world,
    ctx,
    actorId,
    c,
    'returned',
    `left with porridge and butter at ${place.name}, and gone in the morning`,
    r.explain,
  );
  deleteStack(world, c.itemId);
  return { ok: true, text: 'In the morning the bowl is clean and the thing is gone.' };
}

function dispose(
  world: World,
  ctx: SimContext,
  actorId: ActorId,
  c: CharmState,
  kind: 'buried' | 'destroyed' | 'returned',
  how: string,
  explain?: Explain,
): void {
  const placeId = world.actors[actorId]?.placeId;
  if (placeId === undefined) return;
  c.disposed = { kind, at: ctx.now, by: actorId, placeId };
  c.tie = null;
  ctx.emit({
    kind: 'fae.charm_disposed',
    place: placeId,
    visibility: 'witnessed',
    importance: 40,
    roles: [
      { actor: actorId, role: 'agent' },
      ...(world.activity.occupancy[placeId] ?? [])
        .filter((x) => x !== actorId && world.actors[x]?.alive)
        .slice(0, 4)
        .map((x) => ({ actor: x, role: 'witness' as const })),
    ],
    data: {
      itemId: c.itemId,
      charm: c.defId,
      actorId,
      kind,
      placeId,
      text: `${world.actors[actorId]?.name.given ?? 'Someone'} ${how}.`,
    },
    ...(explain ? { explain } : {}),
  });
}

/** Taking occupies this hour here, so the ordinary schedule cannot carry the actor away. */
function stealCharm(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, basis: Basis): TendResult {
  const victimId = believedKeeper(world, actorId, c.itemId);
  if (victimId === null) return { ok: false, reason: 'You do not know whose sack this is' };
  const outcome = attemptTheft(world, ctx, { actorId, victimId, itemId: c.itemId, basis, interactionId: 'take' });
  return outcome.success ? { ok: true, text: 'You took the sack.' } : { ok: false, reason: 'The sack was not taken' };
}

/** Out of the household stores, to carry it somewhere. */
function fetchCharm(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, basis: Basis): TendResult {
  const a = world.actors[actorId];
  const stack = world.items.stacks[c.itemId];
  if (!a || !stack || !canReach(world, actorId, c)) return { ok: false, reason: 'It is not here' };
  if (holdingOf(world, stack).actorId === actorId) return { ok: true, text: 'You have it already.' };
  const ok = authorizeAct(world, actorId, { kind: 'fetch_charm', itemId: c.itemId }, basis);
  if (!ok.ok) return { ok: false, reason: ok.reason };
  moveStack(world, ctx, c.itemId, 1, carriedBy(actorId));
  return { ok: true, text: 'You take it along.' };
}

/** A tend hour does what the evening wants: stow it, tie it, feed it. */
function tendCharm(world: World, ctx: SimContext, actorId: ActorId, c: CharmState, basis: Basis): TendResult {
  const a = world.actors[actorId];
  const stack = world.items.stacks[c.itemId];
  if (!a || !stack) return { ok: false, reason: 'Nothing to tend' };
  const out: string[] = [];
  const h = holdingOf(world, stack);
  if (h.actorId === actorId && world.households[a.householdId]?.homePlaceId === a.placeId) {
    const r = stowCharm(world, ctx, actorId, c, basis);
    if (r.ok) out.push(r.text);
  }
  if (tieWindow(ctx)) {
    if (c.virtue <= 2) {
      const r = setOffering(world, ctx, actorId, c, basis);
      if (r.ok) out.push(r.text);
    }
    const r = tieCharm(world, ctx, actorId, c, basis);
    if (r.ok) out.push(r.text);
  }
  return out.length ? { ok: true, text: out.join(' ') } : { ok: false, reason: 'Nothing wanted doing' };
}

/** After the activity pass: act on chosen fae activities; run the stock count. */
export function actionsHour(world: World, ctx: SimContext): void {
  for (const id of idsOf<ActorId>(world.actors)) {
    const st = world.activity.byActor[id];
    const actId = st?.activityId;
    if (!actId || !world.actors[id]?.alive) continue;
    if (actId === 'stocktake') {
      if (st.since === ctx.now) countStock(world, ctx, id);
      continue;
    }
    if (!FAE_ACTIVITIES.includes(actId)) continue;
    const chosen = chosenUrge(world, id);
    const urge = chosen?.urge;
    if (urge?.kind !== 'activity' || urge.activityId !== actId || urge.itemId === undefined) continue;
    const c = world.fae.charms?.[urge.itemId];
    if (!c) continue;
    const basis: Basis = chosen?.voice === 'command' ? commandBasis(ctx, id, ['core.urge']) : { kind: 'own' };
    const r =
      actId === 'steal_charm'
        ? stealCharm(world, ctx, id, c, basis)
        : actId === 'tend_charm'
          ? tendCharm(world, ctx, id, c, basis)
          : actId === 'fetch_charm'
            ? fetchCharm(world, ctx, id, c, basis)
            : actId === 'study_charm'
              ? studyCharm(world, ctx, id, c, basis)
              : actId === 'bury_charm'
                ? buryCharm(world, ctx, id, c, basis)
                : actId === 'destroy_charm'
                  ? destroyCharm(world, ctx, id, c, basis)
                  : returnCharm(world, ctx, id, c, basis);
    if (!r.ok && chosen?.voice === 'command') refuse(world, ctx, id, c.itemId, actId, r.reason);
  }
}

/**
 * The standing order `tie_the_sack_nightly` (13 §5.2): at 21:00 a keeper granted it ties the sack
 * they keep, through the same executor and the same authorization (basis: standing).
 */
export function standingTies(world: World, ctx: SimContext): void {
  if (ctx.cal.hour !== 21) return;
  for (const key of Object.keys(world.fae.charms ?? {}).sort((a, b) => Number(a) - Number(b))) {
    const c = world.fae.charms?.[Number(key)];
    if (!c || !drawEffectOf(charmDefOf(ctx.content, c.defId))) continue;
    const keeper = keeperOf(world, c);
    if (keeper === null) continue;
    const basis: Basis = { kind: 'standing', capability: 'tie_the_sack_nightly' };
    if (!authorizeAct(world, keeper, { kind: 'tie_charm', itemId: c.itemId }, basis).ok) continue;
    tieCharm(world, ctx, keeper, c, basis);
  }
}

/** Fae item Commands (13 §7.2): each validated and authorized; a refusal costs nothing in play. */
export function charmCommand(world: World, ctx: SimContext, cmd: Command): void {
  if (!cmd.kind.startsWith('fae.') || cmd.kind === 'fae.investigate' || cmd.kind === 'fae.signs') return;
  const actorId = cmd.actorId;
  const basis: Basis = { kind: 'command', issuer: cmd.issuer ?? { kind: 'player' } };
  if (cmd.kind === 'fae.count') {
    const ok = authorizeAct(world, actorId, { kind: 'stocktake' }, basis);
    if (!ok.ok) refuse(world, ctx, actorId, null, cmd.kind, ok.reason);
    else countStock(world, ctx, actorId);
    return;
  }
  const itemId = asItemId((cmd.data as { itemId?: number }).itemId ?? 0);
  const c = world.fae.charms?.[itemId];
  if (!c) {
    refuse(world, ctx, actorId, null, cmd.kind, 'You know of no such charm.');
    return;
  }
  let r: TendResult;
  switch (cmd.kind) {
    case 'fae.use': {
      const def = charmDefOf(ctx.content, c.defId);
      r = drawEffectOf(def)
        ? tieCharm(world, ctx, actorId, c, basis)
        : {
            ok: false,
            reason: 'It works by itself while stitched into a bag; hang the bag empty in the dew at dawn to wake it',
          };
      break;
    }
    case 'fae.recharge':
      r = setOffering(world, ctx, actorId, c, basis);
      break;
    case 'fae.thank':
      r = thankCharm(world, ctx, actorId, c, basis);
      break;
    case 'fae.inspect':
      r = inspectCharm(world, ctx, actorId, c, basis);
      break;
    case 'fae.study':
      r = studyCharm(world, ctx, actorId, c, basis);
      break;
    case 'fae.take': {
      const a = world.actors[actorId];
      const ok =
        c.reservoir !== null && (c.noticedBy ?? []).includes(actorId) && a?.placeId === c.reservoir.placeId
          ? authorizeAct(world, actorId, { kind: 'pick_up', itemId: c.itemId }, basis)
          : { ok: false as const, reason: 'There is nothing of the kind here that you have seen' };
      if (ok.ok) {
        takeFound(world, ctx, actorId, c);
        r = { ok: true, text: 'You pick it up.' };
      } else r = { ok: false, reason: ok.reason };
      break;
    }
    case 'fae.bury':
      r = buryCharm(world, ctx, actorId, c, basis);
      break;
    case 'fae.destroy':
      r = destroyCharm(world, ctx, actorId, c, basis);
      break;
    case 'fae.return':
      r = returnCharm(world, ctx, actorId, c, basis);
      break;
    case 'fae.stow':
      r = stowCharm(world, ctx, actorId, c, basis);
      break;
    case 'fae.fetch':
      r = fetchCharm(world, ctx, actorId, c, basis);
      break;
    default:
      return;
  }
  if (!r.ok) refuse(world, ctx, actorId, c.itemId, cmd.kind, r.reason);
}

/**
 * The offering errand (13 §5.8 recharge): a keeper-household adult standing in an open store
 * buys the porridge makings the house lacks (on the tab if need be), with a real purchase that passes their own
 * authorization (a commanded actor needs an order or a standing allowance).
 */
export function offeringErrands(world: World, ctx: SimContext): void {
  for (const key of Object.keys(world.fae.charms ?? {}).sort((a, b) => Number(a) - Number(b))) {
    const c = world.fae.charms?.[Number(key)];
    const def = charmDefOf(ctx.content, c?.defId);
    const stack = c ? world.items.stacks[c.itemId] : undefined;
    if (!c || !def || !stack || c.virtue > 2 || !drawEffectOf(def) || offeringBlocked(world, ctx, c) !== null) continue;
    const offering = def.recharge.find((r) => r.kind === 'offering');
    if (offering?.kind !== 'offering') continue;
    const h = holdingOf(world, stack);
    const hid = h.householdId ?? (h.actorId !== null ? world.actors[h.actorId]?.householdId : undefined);
    if (hid === undefined || hid === null) continue;
    for (const m of world.households[hid]?.memberIds ?? []) {
      const a = world.actors[m];
      if (!a?.alive || !world.provisions.stores[a.placeId] || !storeOpen(world, ctx.content, a.placeId)) continue;
      for (const need of offering.items) {
        let have = 0;
        for (const { stack: s } of stacksDeep(world, pantryOf(hid))) if (s.defId === need.def) have += s.qty;
        // On the tab when the purse is empty, as the house buys any staple (provisions' basket).
        if (have < need.qty) purchase(world, ctx, m, a.placeId, need.def, need.qty - have, true, pantryOf(hid));
      }
      break;
    }
  }
}
