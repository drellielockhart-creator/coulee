import { isAsleep, relocateForCare, walkMinutes } from '../activity/api.ts';
import { displayName } from '../actor.ts';
import { reportMisfortune } from '../belief/api.ts';
import { resolveCheck } from '../checks.ts';
import { term } from '../explain.ts';
import { type ActorId, idsOf, type PlaceId } from '../ids.ts';
import { carriedBy, moveStack, pantryOf, stacksAt, withInventoryPass } from '../items/api.ts';
import {
  assistIntake,
  careHome,
  careSuppliesAvailable,
  foodToHand,
  settleEstate,
  synchronizeStoreTabs,
} from '../provisions/api.ts';
import { addAnxiety, addThought, authorizeAct, commandBasis, psycheOf } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { addMemory, addOpinionReason, areKin, isAcquainted, markBereaved, opinionOf } from '../social/api.ts';
import { yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import { canAct, needsHelp, survivalExplain, survivalOf, survivalTuning } from './survival.ts';

export function die(
  world: World,
  ctx: SimContext,
  id: ActorId,
  cause: string,
  explain?: import('../explain.ts').Explain,
): void {
  const actor = world.actors[id],
    s = survivalOf(world, ctx.content, id);
  if (!actor?.alive || !s) return;
  actor.alive = false;
  s.ending = { type: 'death', at: ctx.now, cause };
  const eventId = ctx.emit({
    kind: 'needs.died',
    data: { actorId: id, cause, name: displayName(actor) },
    roles: [{ actor: id, role: 'subject' }],
    place: actor.placeId,
    visibility: 'witnessed',
    importance: 100,
    explain: explain ?? survivalExplain(id, `Death from ${cause}; Wounds reached Constitution`, s.wounds, 'dead'),
  });
  s.death = {
    at: ctx.now,
    cause,
    placeId: actor.placeId,
    eventId,
    discovered: false,
    funeralAt: 0,
    buried: false,
    mourners: [],
  };
}

export function helpHour(world: World, ctx: SimContext): void {
  withInventoryPass(world, () => helpPass(world, ctx));
}
function helpPass(world: World, ctx: SimContext): void {
  const tuning = survivalTuning(ctx.content);
  if (!tuning) return;
  const used = new Set<ActorId>();
  const aid = (helperId: ActorId, targetId: ActorId, commanded: boolean) => {
    const helper = world.actors[helperId],
      target = world.actors[targetId];
    const s = world.needs.byActor[targetId]?.survival;
    if (
      helperId === targetId ||
      !helper ||
      !target?.alive ||
      !s ||
      !needsHelp(world, targetId) ||
      !canAct(world, helperId) ||
      !authorizeAct(world, helperId, { kind: 'aid' }, commandBasis(ctx, helperId, ['needs.aid'])).ok ||
      helper.placeId !== target.placeId ||
      world.activity.byActor[helperId]?.travel ||
      used.has(helperId)
    )
      return false;
    used.add(helperId);
    s.lastAid = ctx.now;
    const opinion = opinionOf(world, helperId, targetId);
    const result = resolveCheck(
      {
        label: 'Aid a fallen neighbor',
        kind: 'ability',
        subjects: [helperId, targetId],
        knowledge: 'participants',
        terms: [
          term('command', 'Resolved to help', commanded ? 20 : 0),
          term('value', 'Neighborliness', helper.values.neighborliness * 2),
          term('opinion', 'Affection', Math.floor(opinion.affection / 10)),
          term('kin', 'Family obligation', areKin(world, helperId, targetId) ? 6 : 0),
          term('psyche', 'Anxiety', -Math.floor((psycheOf(world, helperId)?.anxiety ?? 0) / 250)),
        ],
        dc: tuning.aid_dc,
      },
      ctx.rng('social', mixKey(helperId, targetId, 0x414944)),
    );
    let carried = false,
      waterMl = 0;
    if (result.success) {
      const home = careHome(world, ctx.content, helperId, targetId);
      if (
        home !== undefined &&
        home !== target.placeId &&
        world.places[home]?.siteId === world.places[target.placeId]?.siteId
      ) {
        relocateForCare(world, ctx, helperId, home);
        relocateForCare(world, ctx, targetId, home);
        carried = true;
      }
      // Reserve the care hour first; preparation may extend it through serving time.
      relocateForCare(world, ctx, helperId, helper.placeId);
      waterMl = assistIntake(world, ctx, helperId, targetId, tuning.aid_water_ml);
    }
    const eventId = ctx.emit({
      kind: 'needs.aid',
      data: { actorId: helperId, targetId, success: result.success, waterMl, carried },
      roles: [
        { actor: helperId, role: 'agent' },
        { actor: targetId, role: 'beneficiary' },
      ],
      place: target.placeId,
      visibility: 'witnessed',
      importance: result.success ? 60 : 10,
      explain: result.explain,
    });
    if (result.success) {
      const memory = addMemory(world, ctx, {
        ownerId: targetId,
        eventId,
        kind: 'help',
        at: ctx.now,
        placeId: target.placeId,
        roles: [{ who: helperId, role: 'agent', conf: 1000 }],
        source: { kind: 'witnessed' },
        emotion: 'gratitude',
        intensity: 80,
        salience: 900,
        confidence: 1000,
        rehearsals: 0,
        pinned: false,
        summary: `${displayName(helper)} tended me when I could not stand.`,
      });
      if (memory !== null)
        addOpinionReason(world, ctx, targetId, helperId, {
          label: 'Helped me when I lay helpless',
          cites: { kind: 'memory', id: memory },
          delta: { affection: 15, respect: 10, trust: 20, fear: 0 },
          since: ctx.now,
        });
    }
    return result.success || commanded;
  };
  for (const cmd of ctx.commands)
    if (cmd.kind === 'needs.aid' && !aid(cmd.actorId, cmd.data.targetId, true))
      ctx.emit({
        kind: 'needs.command_rejected',
        data: { actorId: cmd.actorId, reason: 'Aid requires a living, incapacitated person here and an able helper.' },
        roles: [{ actor: cmd.actorId, role: 'agent' }],
        visibility: 'private',
        explain: survivalExplain(cmd.actorId, 'Aid unavailable', 0, 'rejected'),
      });
  // Triage first: an ambulatory hungry relative must not consume the only
  // caretaker's hour while a collapsed person beside them dies of thirst.
  const urgency = (id: ActorId) => {
    const n = world.needs.byActor[id],
      s = n?.survival;
    return (s?.collapsed ? 10000 : 0) + (1000 - (n?.values.thirst ?? 1000)) * 2 + (s?.wounds ?? 0) * 100;
  };
  for (const id of idsOf<ActorId>(world.actors).sort((a, b) => urgency(b) - urgency(a) || a - b)) {
    const s = world.needs.byActor[id]?.survival;
    if (
      !world.actors[id]?.alive ||
      !s ||
      !needsHelp(world, id) ||
      (s.lastAid !== undefined && ctx.now - s.lastAid < tuning.aid_interval_hours * 60)
    )
      continue;
    s.lastAid = ctx.now;
    const householdId = world.actors[id]?.householdId;
    for (const helper of idsOf<ActorId>(world.actors).sort(
      (a, b) =>
        Number(world.actors[b]?.householdId === householdId) - Number(world.actors[a]?.householdId === householdId) ||
        a - b,
    ))
      if (
        helper !== id &&
        authorizeAct(world, helper, { kind: 'consequential' }, { kind: 'own' }).ok &&
        (!needsHelp(world, helper) || foodToHand(world, ctx.content, helper)) &&
        careSuppliesAvailable(world, ctx.content, helper, id) &&
        (() => {
          const person = world.actors[helper],
            patient = world.actors[id];
          if (!person || !patient || !canAct(world, helper) || used.has(helper)) return false;
          if (person.placeId !== patient.placeId) {
            // A missed household routine prompts a daytime check-in by kin or a known neighbor.
            if (
              !s.collapsed ||
              patient.placeId !== world.households[patient.householdId]?.homePlaceId ||
              !ctx.cal.isDaylight ||
              ctx.cal.hour % tuning.care_visit_hours !== 0 ||
              world.activity.byActor[helper]?.travel ||
              isAsleep(world, ctx, helper) ||
              (person.householdId !== patient.householdId &&
                !areKin(world, helper, id) &&
                !isAcquainted(world, helper, id)) ||
              world.places[person.placeId]?.siteId !== world.places[patient.placeId]?.siteId ||
              walkMinutes(world, ctx.content, person.placeId, patient.placeId) > tuning.care_visit_max_minutes
            )
              return false;
            relocateForCare(world, ctx, helper, patient.placeId);
          }
          return aid(helper, id, false);
        })()
      )
        break;
  }
}

function reformHousehold(world: World, ctx: SimContext, id: ActorId): ActorId | undefined {
  const actor = world.actors[id];
  if (!actor) return;
  const household = world.households[actor.householdId];
  if (!household) return;
  const survivors = household.memberIds.filter((x) => world.actors[x]?.alive).sort((a, b) => a - b);
  const adults = survivors.filter((x) => yearsBetween(world.actors[x]?.born ?? ctx.now, ctx.now) >= 16);
  const kin = idsOf<ActorId>(world.actors).find(
    (x) =>
      canAct(world, x) &&
      yearsBetween(world.actors[x]?.born ?? ctx.now, ctx.now) >= 16 &&
      areKin(world, id, x) &&
      x !== id,
  );
  const adopted: ActorId[] = [];
  const heir = adults[0] ?? kin ?? survivors[0];
  if (heir === undefined) return;
  if (!adults.length && kin !== undefined) {
    const newHome = world.households[world.actors[kin]?.householdId ?? 0];
    if (newHome && newHome.id !== household.id) {
      for (const childId of survivors) {
        const child = world.actors[childId];
        if (!child) continue;
        child.householdId = newHome.id;
        adopted.push(childId);
        if (!newHome.memberIds.includes(childId)) newHome.memberIds.push(childId);
      }
      household.memberIds = household.memberIds.filter((x) => !survivors.includes(x));
      for (const stack of stacksAt(world, pantryOf(household.id)))
        moveStack(world, ctx, stack.id, stack.qty, pantryOf(newHome.id));
    }
  }
  settleEstate(world, ctx, id, heir);
  if (household.headId === id || !world.actors[household.headId]?.alive) household.headId = heir;
  synchronizeStoreTabs(world);
  for (const stack of stacksAt(world, carriedBy(id)))
    moveStack(world, ctx, stack.id, stack.qty, pantryOf(world.actors[heir]?.householdId ?? household.id));
  ctx.emit({
    kind: 'needs.estate',
    data: { actorId: id, heirId: heir, adopted },
    roles: [
      { actor: id, role: 'subject' },
      { actor: heir, role: 'beneficiary' },
    ],
    place: household.homePlaceId,
    visibility: 'public',
    importance: 60,
    explain: {
      kind: 'arbitration',
      label: 'Household succession and care of orphans',
      subjects: [id, heir],
      knowledge: 'public',
      terms: [
        term('household', 'Surviving adult members', adults.length),
        term('kin', 'Adult kin available', kin === undefined ? 0 : 1),
        term('household', 'Children taken in by kin', adopted.length),
      ],
      total: heir,
      outcome: 'estate entrusted',
      note: 'First surviving adult household member, then adult kin, then remaining member; ties by actor id. Personal goods and purse pass to that household.',
    },
  });
  return heir;
}

export function aftermathHour(world: World, ctx: SimContext): void {
  const tuning = survivalTuning(ctx.content);
  if (!tuning) return;
  for (const id of idsOf<ActorId>(world.actors)) {
    const a = world.actors[id],
      death = world.needs.byActor[id]?.survival?.death;
    if (!a || !death || death.buried) continue;
    if (!death.discovered) {
      const witnesses = idsOf<ActorId>(world.actors).filter(
        (x) => canAct(world, x) && world.actors[x]?.placeId === death.placeId && !world.activity.byActor[x]?.travel,
      );
      if (!witnesses.length) continue;
      death.discovered = true;
      death.funeralAt = ctx.now + tuning.funeral_delay_hours * 60;
      const family = idsOf<ActorId>(world.actors).filter(
        (x) => world.actors[x]?.alive && (world.actors[x]?.householdId === a.householdId || areKin(world, x, id)),
      );
      death.mourners = [...new Set([...witnesses, ...family])].sort((x, y) => x - y);
      const eventId = ctx.emit({
        kind: 'needs.death_discovered',
        data: { actorId: id, cause: death.cause, name: displayName(a) },
        roles: [
          { actor: id, role: 'subject' },
          ...death.mourners.map((actor) => ({ actor, role: 'witness' as const })),
        ],
        place: death.placeId,
        visibility: 'public',
        importance: 100,
        causes: [death.eventId],
        explain: {
          ...survivalExplain(id, 'Body found; word reaches the family', witnesses.length, 'discovered'),
          knowledge: 'public',
        },
      });
      for (const mourner of death.mourners) {
        const close = family.includes(mourner) || opinionOf(world, mourner, id).affection > 20;
        const intensity = close ? tuning.grief_intensity : Math.floor(tuning.grief_intensity / 3);
        const memory = addMemory(world, ctx, {
          ownerId: mourner,
          eventId,
          kind: 'misfortune',
          at: ctx.now,
          placeId: death.placeId,
          roles: [{ who: id, role: 'subject', conf: 1000 }],
          source: witnesses.includes(mourner)
            ? { kind: 'witnessed' }
            : { kind: 'told', by: witnesses[0] ?? mourner, rumorId: null },
          emotion: 'grief',
          intensity: Math.round(intensity / 10),
          salience: intensity,
          confidence: 1000,
          rehearsals: 0,
          pinned: false,
          summary: `${displayName(a)} is dead; there is an empty place at the table.`,
        });
        if (memory !== null)
          addOpinionReason(world, ctx, mourner, id, {
            label: 'An empty place at the table',
            cites: { kind: 'memory', id: memory },
            delta: { affection: 10, respect: 5, trust: 0, fear: 0 },
            since: ctx.now,
          });
        addAnxiety(world, ctx, mourner, close ? tuning.grief_anxiety : Math.floor(tuning.grief_anxiety / 3));
        addThought(world, ctx, mourner, {
          voice: 'id',
          drive: 'longing',
          urge: { kind: 'activity', activityId: 'attend_church' },
          intensity,
          label: `I shall not hear ${a.name.given}'s voice again.`,
          source: 'needs',
          reasons: [term('memory', 'Death of someone known', intensity)],
        });
      }
      markBereaved(world, ctx, id);
      reportMisfortune(world, ctx, {
        kindId: world.places[death.placeId]?.tags.includes('fae') ? 'strange_death' : 'survival_death',
        householdId: a.householdId,
        victimId: id,
        placeId: death.placeId,
      });
      reformHousehold(world, ctx, id);
    }
    if (death.discovered && ctx.now >= death.funeralAt && ctx.cal.hour === 10) {
      const church = idsOf<PlaceId>(world.places).find((p) =>
        tuning.funeral_place_tags.some((tag) => world.places[p]?.tags.includes(tag)),
      );
      if (church === undefined) continue;
      const attendees = death.mourners.filter(
        (x) =>
          canAct(world, x) &&
          authorizeAct(world, x, { kind: 'consequential' }, { kind: 'own' }).ok &&
          world.places[world.actors[x]?.placeId ?? 0]?.siteId === world.places[church]?.siteId,
      );
      for (const x of attendees) relocateForCare(world, ctx, x, church, 'attend_church');
      death.buried = true;
      death.burialPlaceId = church;
      ctx.emit({
        kind: 'needs.funeral',
        data: { actorId: id, name: displayName(a), attendees },
        roles: [{ actor: id, role: 'subject' }, ...attendees.map((actor) => ({ actor, role: 'witness' as const }))],
        place: church,
        visibility: 'public',
        importance: 85,
        causes: [death.eventId],
        explain: {
          ...survivalExplain(id, 'Neighbors gathered for the burial', attendees.length, 'buried'),
          knowledge: 'public',
        },
      });
    }
  }
}

/** A hungry person asks someone they know for shelter before losing the strength to walk. */
export function proposeCareUrges(world: World, ctx: SimContext, id: ActorId): import('../urge.ts').UrgeProposal[] {
  if (!canAct(world, id) || !needsHelp(world, id) || !ctx.content.activities.seek_care) return [];
  const actor = world.actors[id];
  if (!actor) return [];
  const candidates = idsOf<ActorId>(world.actors)
    .filter((other) => {
      const b = world.actors[other];
      return (
        other !== id &&
        canAct(world, other) &&
        b &&
        b.householdId !== actor.householdId &&
        (isAcquainted(world, id, other) || areKin(world, id, other)) &&
        world.places[b.placeId]?.siteId === world.places[actor.placeId]?.siteId
      );
    })
    .sort((a, b) => opinionOf(world, id, b).trust - opinionOf(world, id, a).trust || a - b);
  const donor = candidates[0];
  if (donor === undefined) return [];
  const placeId = world.households[world.actors[donor]?.householdId ?? 0]?.homePlaceId;
  if (placeId === undefined) return [];
  return [
    {
      voice: 'id',
      drive: 'hunger',
      intensity: 1000,
      urge: { kind: 'activity', activityId: 'seek_care', placeId },
      label: 'I cannot go on without help: ask a neighbor for food',
      source: 'needs',
      reasons: [term('need', 'Prolonged hunger: seek help before collapse', 1000)],
    },
  ];
}
