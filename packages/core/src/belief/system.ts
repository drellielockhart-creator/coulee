import { isAsleep } from '../activity/api.ts';
/** Hourly evidence/attribution; daily pressure, forgetting, grudges, and Commons. */
import { rowsOf } from '../ids.ts';
import { canAct } from '../needs/api.ts';
import { authorizeAct } from '../psyche/api.ts';
import {
  isDailyProcessing,
  processesActor,
  processingActors,
  processingHouseholds,
  recordBeliefCompartment,
} from '../region/processing.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { memoriesOf, opinionOf } from '../social/api.ts';
import { yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import { beliefOf, channelForPlace, transmit } from './api.ts';
import { updatePersecutions } from './escalation.ts';
import { formula } from './evidence.ts';
import { decayStep, logitQ8, logitStep, view3 } from './intmath.ts';
import { attributeMisfortunes, reportMisfortune, targetLabel } from './misfortune.ts';
import { makeGrudge } from './state.ts';
import { processTells } from './tells.ts';

function daily(world: World, ctx: SimContext): void {
  const pressure = decayStep(world.belief.misfortune, world.belief.misfortuneResidue, 30);
  if (!isDailyProcessing(world)) {
    world.belief.misfortune = pressure.value;
    world.belief.misfortuneResidue = pressure.residue;
  }
  for (const b of rowsOf(world.belief.beliefs)) {
    if (!processesActor(world, b.holderId)) continue;
    if (b.conceal || b.credence === 0 || b.credence === 100 || ctx.now - b.lastEvidenceAt < 1440) continue;
    const prop = world.belief.props[b.propId];
    const pred = prop && ctx.content.predicates[prop.pred];
    const prior = pred?.prior ?? 20;
    const diff = logitQ8(prior) - logitQ8(b.credence) - b.carry;
    const delta = Math.trunc(diff / (b.voiced ? 60 : 30));
    if (delta === 0) continue;
    const before = b.credence;
    Object.assign(b, logitStep(b.credence, b.carry, delta));
    // Fading is routine and silent; the moment a held belief lapses (falls under 50) is the event.
    if (!(b.formed && before >= 50 && b.credence < 50)) continue;
    b.formed = false;
    ctx.emit({
      kind: 'belief.decayed',
      visibility: 'inner',
      roles: [{ actor: b.holderId, role: 'subject' }],
      data: { holderId: b.holderId, propId: b.propId, before, credence: b.credence },
      explain: formula('Belief fades toward its prior', [b.holderId], b.credence, {
        Before: before,
        'Prior credence': prior,
        'Logit Q8 decay': delta,
      }),
    });
  }
  for (const g of rowsOf(world.belief.grudges)) {
    if (!processesActor(world, g.holderId)) continue;
    if (g.decay === 'none' || ctx.now - g.lastRehearsedAt < 1440) continue;
    const before = g.intensity;
    const tau = Math.max(15, 60 * (1 + view3(world.actors[g.holderId]?.values.rancor)));
    const next = decayStep(g.intensity, g.residue, tau, g.decay === 'floor' ? g.decayFloor : 0);
    g.intensity = next.value;
    g.residue = next.residue;
    // A grudge cooling by a point a day is silent; each ten-point step down is logged.
    if (Math.floor(before / 10) !== Math.floor(g.intensity / 10))
      ctx.emit({
        kind: 'belief.grudge_changed',
        visibility: 'inner',
        roles: [{ actor: g.holderId, role: 'subject' }],
        data: { grudgeId: g.id, before, intensity: g.intensity, reason: 'time' },
        explain: formula('Grudge fades without rehearsal', [g.holderId], g.intensity, {
          Before: before,
          'Time constant days': tau,
        }),
      });
  }
  for (const actor of processingActors(world)) {
    if (!actor.alive) continue;
    for (const m of memoriesOf(world, actor.id)) {
      if (m.intensity < 60 || ctx.content.memory_kinds[m.kind]?.valence !== 'negative') continue;
      for (const role of m.roles) {
        if (role.role !== 'agent' || role.who === actor.id) continue;
        const affection = opinionOf(world, actor.id, role.who).affection;
        if (affection > -50 && !(actor.values.rancor >= 2 && affection <= -35)) continue;
        if (
          rowsOf(world.belief.grudges).some(
            (g) => g.holderId === actor.id && g.target.kind === 'actor' && g.target.id === role.who,
          )
        )
          continue;
        const g = makeGrudge(world, {
          holderId: actor.id,
          target: { kind: 'actor', id: role.who },
          founding: [{ kind: 'memory', id: m.id, label: m.summary }],
          intensity: Math.min(100, Math.floor((-affection + m.intensity) / 2)),
          aim: 'apology',
          public: false,
          since: ctx.now,
        });
        ctx.emit({
          kind: 'belief.grudge_formed',
          visibility: 'inner',
          roles: [
            { actor: actor.id, role: 'subject' },
            { actor: role.who, role: 'target' },
          ],
          data: {
            holderId: actor.id,
            target: targetLabel(world, g.target),
            targetId: role.who,
            intensity: g.intensity,
            aim: g.aim,
          },
          explain: formula('A slight becomes a grudge', [actor.id], g.intensity, {
            Affection: affection,
            'Memory intensity': m.intensity,
          }),
        });
      }
    }
  }
  for (const household of processingHouseholds(world)) {
    for (const key of Object.keys(ctx.content.misfortunes).sort()) {
      const def = ctx.content.misfortunes[key];
      if (!def || def.base_permille_per_household_day <= 0) continue;
      // Only what the household has can go wrong (misfortunes.toml `requires`).
      const req = def.requires;
      const home = world.places[household.homePlaceId];
      const members = household.memberIds.filter((id) => world.actors[id]?.alive === true);
      if (req.home_kinds.length > 0 && !(home && req.home_kinds.includes(home.kind))) continue;
      if (members.length < req.min_members) continue;
      const children =
        req.child_under > 0
          ? members.filter((id) => yearsBetween(world.actors[id]?.born ?? ctx.now, ctx.now) < req.child_under)
          : [];
      if (req.child_under > 0 && children.length === 0) continue;
      const r = ctx.rng('belief', mixKey(household.id, hashString32(key), 731));
      if (!r.chancePermille(def.base_permille_per_household_day)) continue;
      const victimId = children.length > 0 ? (r.pick(children) ?? null) : null;
      reportMisfortune(world, ctx, { kindId: key, householdId: household.id, victimId });
    }
  }
  if (!isDailyProcessing(world)) updateCommons(world, ctx);
}

function updateCommons(world: World, ctx: SimContext): void {
  const adults = rowsOf(world.actors).filter((a) => a.alive && yearsBetween(a.born, ctx.now) >= 16);
  for (const prop of rowsOf(world.belief.props)) {
    const holders = adults.filter((a) => {
      const b = beliefOf(world, a.id, prop.id);
      return b && !b.conceal && b.credence > 50;
    });
    const prevalence = Math.floor((holders.length * 1000) / Math.max(1, adults.length));
    const old = world.belief.commons[prop.id];
    world.belief.commons[prop.id] = { prevalence, assumed: prevalence >= 600, since: old?.since ?? ctx.now };
    const subject = prop.args[0];
    const figure = prop.args[1];
    if (prop.pred === 'is_figure' && subject?.kind === 'actor' && figure?.kind === 'figure' && prevalence >= 500) {
      const f = world.belief.figures[figure.id];
      if (f && !f.attachedIds.includes(subject.id)) {
        f.attachedIds.push(subject.id);
        ctx.emit({
          kind: 'belief.figure_attached',
          importance: 65,
          roles: [{ actor: subject.id, role: 'subject' }],
          data: { figureId: f.id, actorId: subject.id, consensus: prevalence },
          explain: formula(
            'Attach a rumor identity',
            [],
            prevalence,
            { 'Believing adults': holders.length, Adults: adults.length },
            'public',
          ),
        });
      }
    }
    if (ctx.content.predicates[prop.pred]?.kind_of && subject?.kind === 'actor' && prevalence >= 500) {
      const p = world.belief.persecutions.find((p) => p.target.kind === 'actor' && p.target.id === subject.id);
      if (p && !p.revealed) {
        p.revealed = true;
        ctx.emit({
          kind: 'belief.revealed',
          importance: 75,
          roles: [{ actor: subject.id, role: 'subject' }],
          data: { actorId: subject.id, propId: prop.id, consensus: prevalence },
          explain: formula(
            'The community believes an ancestry revealed',
            [],
            prevalence,
            { 'Believing adults': holders.length, Adults: adults.length },
            'public',
          ),
        });
      }
    }
  }
  for (const f of rowsOf(world.belief.figures)) {
    const count = adults.filter((a) =>
      (world.belief.beliefsByHolder[a.id] ?? []).some((id) => {
        const b = world.belief.beliefs[id];
        return (
          b &&
          b.credence > 20 &&
          world.belief.props[b.propId]?.args.some((arg) => arg.kind === 'figure' && arg.id === f.id)
        );
      }),
    ).length;
    f.notoriety = Math.max(f.baseNotoriety, Math.floor((count * 100) / Math.max(1, adults.length)));
  }
}

export function beliefSystem(world: World, ctx: SimContext): void {
  processTells(world, ctx);
  if (ctx.isNewDay) daily(world, ctx);
  attributeMisfortunes(world, ctx);
  if (isDailyProcessing(world) && ctx.cal.hour % 6 === 0) compartmentStep(world, ctx);
  if (!isDailyProcessing(world)) updatePersecutions(world, ctx);
}

/** Four canonical daily opportunities, restricted to named adults sharing a physical venue.
 * A compartment records prevalence, never installs a common belief into every mind. */
function compartmentStep(world: World, ctx: SimContext): void {
  const sites = new Map<string, ReturnType<typeof processingActors>>();
  for (const actor of processingActors(world)) {
    if (!actor.alive || yearsBetween(actor.born, ctx.now) < 16) continue;
    const site = world.places[actor.placeId]?.siteId ?? '';
    const group = sites.get(site) ?? [];
    group.push(actor);
    sites.set(site, group);
  }
  for (const [site, adults] of [...sites].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const holders: Record<number, number> = {};
    for (const actor of adults) {
      for (const id of world.belief.beliefsByHolder[actor.id] ?? []) {
        const b = world.belief.beliefs[id];
        if (b && !b.conceal && b.credence > 50) holders[b.propId] = (holders[b.propId] ?? 0) + 1;
      }
      if (
        !canAct(world, actor.id) ||
        isAsleep(world, ctx, actor.id) ||
        !authorizeAct(world, actor.id, { kind: 'consequential' }, { kind: 'own' }).ok
      )
        continue;
      const peers = adults.filter(
        (a) => a.id !== actor.id && a.placeId === actor.placeId && canAct(world, a.id) && !isAsleep(world, ctx, a.id),
      );
      const peer = ctx.rng('belief', mixKey(actor.id, 0x632d)).pick(peers);
      if (peer)
        transmit(world, ctx, {
          speakerId: actor.id,
          listenerId: peer.id,
          placeId: actor.placeId,
          channel: channelForPlace(world, ctx.content, actor.placeId),
          interactionEventId: null,
        });
    }
    recordBeliefCompartment(world, site, ctx.now, adults.length, holders);
  }
}
