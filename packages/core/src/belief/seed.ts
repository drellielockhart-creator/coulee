/** Authored beliefs, secrets, past misfortunes, and concealed self-knowledge. */
import { type FigureId, rowsOf } from '../ids.ts';
import type { InitContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { internProp, propText } from './api.ts';
import { ensureBelief, formula } from './evidence.ts';
import { registerMisfortune } from './misfortune.ts';
import type { PropArg } from './state.ts';

export function seedBeliefs(world: World, ctx: InitContext, figureByKey: Record<string, FigureId>): void {
  const misfortuneByKey: Record<string, number> = {};
  for (const seed of ctx.scenario.misfortunes) {
    const householdId = world.index.householdByKey[seed.household];
    if (householdId === undefined) continue;
    const m = registerMisfortune(world, ctx, {
      kindId: seed.kind,
      householdId,
      victimId: seed.victim ? (world.index.actorByKey[seed.victim] ?? null) : null,
      culpritId: seed.culprit ? (world.index.actorByKey[seed.culprit] ?? null) : null,
      daysAgo: seed.days_ago,
    });
    if (m) misfortuneByKey[seed.key] = m.id;
  }
  function resolve(seed: { pred: string; args: (string | number)[] }) {
    const pred = ctx.content.predicates[seed.pred];
    if (!pred) return null;
    const args: PropArg[] = [];
    for (let i = 0; i < pred.args.length; i++) {
      const kind = pred.args[i];
      const value = seed.args[i];
      const key = String(value);
      let arg: PropArg | undefined;
      if (kind === 'number' && typeof value === 'number') arg = { kind: 'number', value };
      else if (kind === 'text' || kind === 'item') arg = { kind: 'text', value: key };
      else if ((kind === 'actor' || kind === 'agent') && world.index.actorByKey[key] !== undefined)
        arg = { kind: 'actor', id: world.index.actorByKey[key] };
      else if ((kind === 'figure' || kind === 'agent') && figureByKey[key] !== undefined)
        arg = { kind: 'figure', id: figureByKey[key] };
      else if (kind === 'household' && world.index.householdByKey[key] !== undefined)
        arg = { kind: 'household', id: world.index.householdByKey[key] };
      else if (kind === 'place') {
        const place = rowsOf(world.places).find((p) => p.defId === key);
        if (place) arg = { kind: 'place', id: place.id };
      } else if (kind === 'misfortune' && misfortuneByKey[key] !== undefined)
        arg = { kind: 'misfortune', id: misfortuneByKey[key] };
      if (!arg) return null;
      args.push(arg);
    }
    return internProp(world, pred.id, args);
  }
  const set = (
    holder: string,
    propId: ReturnType<typeof internProp>,
    credence: number,
    conceal: boolean,
    voiced: boolean,
  ) => {
    const holderId = world.index.actorByKey[holder];
    if (holderId === undefined) return;
    const b = ensureBelief(world, ctx, holderId, propId);
    b.credence = credence;
    b.conceal = conceal;
    b.voiced = voiced;
    b.formed = credence >= 50;
    b.evidence.push({ type: 'seed', dir: 1, memoryId: null, sourceId: null, weight: 256, at: ctx.now, rumorId: null });
    ctx.emit({
      kind: 'belief.formed',
      visibility: 'inner',
      roles: [{ actor: holderId, role: 'witness' }],
      data: { holderId, beliefId: b.id, propId, credence, text: propText(world, ctx.content, propId) },
      explain: formula('Established belief', [holderId], credence, { 'Authored credence': credence }),
    });
  };
  for (const seed of ctx.scenario.beliefs) {
    const prop = resolve(seed.prop);
    if (prop !== null) set(seed.holder, prop, seed.credence, false, seed.voiced);
  }
  for (const seed of ctx.scenario.secrets) {
    const prop = resolve(seed.prop);
    if (prop === null) continue;
    set(seed.holder, prop, 100, true, false);
    for (const key of seed.known_by) set(key, prop, 95, true, false);
  }
  for (const actor of rowsOf(world.actors)) {
    if (!ctx.content.peoples[actor.ancestryId]?.concealed) continue;
    for (const key of Object.keys(ctx.content.predicates).sort()) {
      const pred = ctx.content.predicates[key];
      if (pred?.kind_of !== actor.ancestryId) continue;
      const prop = internProp(world, pred.id, [{ kind: 'actor', id: actor.id }]);
      set(actor.key, prop, 100, true, false);
      for (const memberId of world.households[actor.householdId]?.memberIds ?? []) {
        const member = world.actors[memberId];
        if (member && member.id !== actor.id) set(member.key, prop, 95, true, false);
      }
    }
  }
}
