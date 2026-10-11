import { hourInBlock, isAsleep } from '../activity/api.ts';
import { resolveCheck, type SaveId, saveTerms, skillCheck } from '../checks.ts';
import { rowsOf } from '../ids.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { familiarityOf } from '../social/api.ts';
import { addMinutes, MINUTES_PER_DAY, yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import { internProp, observe } from './api.ts';

export function processTells(world: World, ctx: SimContext): void {
  for (const key of Object.keys(ctx.content.suspicionTells).sort()) {
    const tell = ctx.content.suspicionTells[key];
    const pred = tell && ctx.content.predicates[tell.predicate];
    if (
      !tell ||
      !pred?.kind_of ||
      (tell.sabbath_only && !ctx.cal.isSabbath) ||
      (tell.hours && !hourInBlock(ctx.cal.hour, tell.hours.from, tell.hours.to))
    )
      continue;
    for (const actor of rowsOf(world.actors)) {
      const place = world.places[actor.placeId];
      if (
        !actor.alive ||
        !place ||
        place.faeIntensity < tell.min_fae_intensity ||
        (tell.place_tags_any.length && !tell.place_tags_any.some((t) => place.tags.includes(t))) ||
        tell.subject_not_place_tags.some((t) => place.tags.includes(t)) ||
        (tell.subject_min_age > 0 && yearsBetween(actor.born, ctx.now) < tell.subject_min_age) ||
        isAsleep(world, ctx, actor.id) !== tell.asleep
      )
        continue;
      // Truth determines the physical symptom rate, never an observer's interpretation.
      const rate = actor.ancestryId === pred.kind_of ? tell.true_permille_per_hour : tell.lookalike_permille_per_hour;
      if (!ctx.rng('suspicion', mixKey(actor.id, hashString32(tell.id), 721)).chancePermille(rate)) continue;
      if (tell.suppress) {
        const spec = tell.suppress;
        const r = ctx.rng('suspicion', mixKey(actor.id, hashString32(tell.id), 722));
        const check =
          spec.kind === 'skill'
            ? skillCheck(
                ctx.content,
                actor,
                { label: `Suppress ${tell.name}`, skill: spec.id, dc: spec.dc, knowledge: 'self' },
                r,
              )
            : resolveCheck(
                {
                  label: `Suppress ${tell.name}`,
                  kind: 'save',
                  terms: saveTerms(actor, spec.id as SaveId),
                  dc: spec.dc,
                  subjects: [actor.id],
                  knowledge: 'self',
                },
                r,
              );
        ctx.emit({
          kind: 'belief.tell',
          visibility: 'inner',
          roles: [{ actor: actor.id, role: 'subject' }],
          data: { targetId: actor.id, tellId: tell.id, noticed: false },
          explain: check.explain,
        });
        if (check.success) continue;
        // A concealed actor knows when they gave themselves away, and keeps clear next time.
        if (tell.wary_days > 0 && ctx.content.peoples?.[actor.ancestryId]?.concealed === true) {
          world.belief.wary ??= {};
          world.belief.wary[actor.id] = {
            until: addMinutes(ctx.now, tell.wary_days * MINUTES_PER_DAY),
            tellId: tell.id,
          };
        }
      }
      for (const observer of rowsOf(world.actors)) {
        if (
          !observer.alive ||
          observer.id === actor.id ||
          (tell.observers === 'present' && observer.placeId !== actor.placeId) ||
          (tell.min_familiarity > 0 && familiarityOf(world, observer.id, actor.id) < tell.min_familiarity) ||
          (tell.observer_place_tags_any.length > 0 &&
            !tell.observer_place_tags_any.some((t) => world.places[observer.placeId]?.tags.includes(t))) ||
          isAsleep(world, ctx, observer.id) ||
          (tell.household_only && observer.householdId !== actor.householdId)
        )
          continue;
        const check = skillCheck(
          ctx.content,
          observer,
          {
            label: `Notice ${tell.name}`,
            skill: tell.observe.skill,
            dc: tell.observe.dc + (tell.observe.add_disguise ? (actor.sheet.skills.disguise ?? 0) : 0),
          },
          ctx.rng('suspicion', mixKey(actor.id, observer.id, hashString32(tell.id), 723)),
        );
        if (!check.success) check.explain.knowledge = 'omniscient';
        check.explain.note = `Possible mundane causes: ${tell.lookalikes}`;
        const eventId = ctx.emit({
          kind: 'belief.tell',
          visibility: 'private',
          place: actor.placeId,
          roles: [{ actor: observer.id, role: 'witness' }],
          data: { targetId: actor.id, tellId: tell.id, noticed: check.success },
          explain: check.explain,
        });
        if (check.success)
          observe(world, ctx, observer.id, internProp(world, pred.id, [{ kind: 'actor', id: actor.id }]), {
            type: 'observation',
            dir: 1,
            sourceId: null,
            eventId,
            scalePct: tell.strength,
          });
      }
    }
  }
}
