import { beliefOf, observe } from '../belief/api.ts';
import type { ActorId } from '../ids.ts';
import { authorizationExplain, authorizeAct, type Basis } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { windows } from './episodes.ts';
import { closeQuestion, omenCheck } from './omens.ts';
import { isProtectedSite } from './sites.ts';
import { signs } from './view.ts';
export function investigationEligibility(world: World, id: ActorId, signId: string): string | null {
  const e = world.fae.episodes[signId],
    a = world.actors[id];
  if (!e || !a || e.traceEnd < world.time) return 'That sign has left no trace to investigate.';
  const place = world.places[e.snapshot.placeId];
  if (!place || isProtectedSite(place)) return 'No fae investigation here.';
  if (a.placeId !== e.snapshot.placeId && a.placeId !== e.lead.placeId) return 'Go to the sign or its lead first.';
  if (!e.observers[id]?.noticed && !signs(world, id).some((q) => q.signId === signId))
    return 'You have neither noticed nor heard of that sign.';
  if (e.attempts[id]) {
    if (!e.attempts[id]?.found || e.lead.kind !== 'place' || e.followups?.[id])
      return 'You have already tested this sign. Returning cannot change the evidence.';
    const destination = world.places[e.lead.placeId];
    if (!destination || isProtectedSite(destination)) return 'That destination is unavailable.';
    if (a.placeId !== destination.id) return `Follow the lead to ${destination.name} at dusk.`;
    const dusk = windows(destination, Math.floor(world.time / 1440)).find((w) => w.window === 'dusk');
    if (!dusk || world.time < dusk.at || world.time > dusk.at + 95)
      return 'Return at dusk; the trace can only be followed then. No time spent.';
  } else if (a.placeId !== e.snapshot.placeId) return 'First discover the lead at the original sign.';
  return null;
}
export function investigate(world: World, ctx: SimContext, id: ActorId, signId: string, basis: Basis): boolean {
  const permission = authorizeAct(world, id, { kind: 'investigate' }, basis);
  const reason = !permission.ok ? permission.reason : investigationEligibility(world, id, signId);
  if (reason) {
    ctx.emit({
      kind: 'fae.refused',
      data: { actorId: id, signId, reason },
      visibility: 'private',
      roles: [{ actor: id, role: 'agent' }],
      explain: {
        ...authorizationExplain(world, id, { kind: 'investigate' }, basis),
        label: 'Investigation refused',
        total: 0,
        outcome: reason,
      },
    });
    return false;
  }
  const e = world.fae.episodes[signId];
  const a = world.actors[id];
  if (!e || !a) return false;
  if (e.attempts[id]?.found && e.lead.kind === 'place') {
    const text = `At ${world.places[e.lead.placeId]?.name}, dusk reveals the end of the trace: ${e.truth === 'mundane' ? e.plain : ctx.content.omens[e.defId]?.reading}`;
    e.followups ??= {};
    e.followups[id] = { at: ctx.now, text };
    const eventId = ctx.emit({
      kind: 'fae.investigated',
      data: { signId, actorId: id, found: true, text },
      roles: [{ actor: id, role: 'agent' }],
      visibility: 'private',
      explain: {
        kind: 'choice',
        label: 'Follow the trace at dusk',
        subjects: [id],
        knowledge: 'self',
        terms: [],
        total: 1,
        outcome: text,
      },
    });
    if (e.propId !== undefined) {
      observe(world, ctx, id, e.propId, { type: 'physical', dir: e.truth === 'fae' ? 1 : -1, sourceId: null, eventId });
      const credence = beliefOf(world, id, e.propId)?.credence ?? 50;
      closeQuestion(world, id, signId, ctx.now, text, credence >= 70 || credence <= 30);
    }
    return true;
  }
  if (!world.fae.questions[id]?.some((q) => q.signId === signId)) {
    const heard = signs(world, id).find((q) => q.signId === signId);
    if (heard) {
      world.fae.questions[id] ??= [];
      world.fae.questions[id].push({
        signId,
        placeId: heard.placeId,
        text: heard.text,
        openedAt: ctx.now,
        closedAt: null,
        evidence: null,
      });
    }
  }
  const skills = ['woodcraft', 'lore_fae', 'perception'].sort(
    (x, y) => (a.sheet.skills[y] ?? 0) - (a.sheet.skills[x] ?? 0) || (x < y ? -1 : x > y ? 1 : 0),
  );
  const result = omenCheck(world, ctx, e, id, skills[0] ?? 'perception', 10, 0xfae5);
  e.attempts[id] = { at: ctx.now, found: result.success, explain: result.explain };
  const text = !result.success
    ? 'The trace will not yield a clear reading. Another attempt would tell you nothing new.'
    : e.lead.kind === 'place'
      ? `The trace runs toward ${world.places[e.lead.placeId]?.name}. Return there at dusk; the timing matters.`
      : e.lead.kind === 'actor'
        ? `Someone here may know more: ${world.actors[e.lead.actorId ?? 0]?.name.given}.`
        : e.lead.kind === 'trace'
          ? `You examine the residue: ${e.truth === 'mundane' ? e.plain : ctx.content.omens[e.defId]?.reading}`
          : 'You find where the trace ends. It points nowhere further.';
  const eventId = ctx.emit({
    kind: 'fae.investigated',
    data: { signId, actorId: id, found: result.success, text },
    roles: [{ actor: id, role: 'agent' }],
    visibility: 'private',
    explain: { ...result.explain, label: 'Investigate', note: text },
  });
  if (result.success && e.lead.kind === 'trace' && e.propId !== undefined) {
    observe(world, ctx, id, e.propId, { type: 'physical', dir: e.truth === 'fae' ? 1 : -1, sourceId: null, eventId });
    const credence = beliefOf(world, id, e.propId)?.credence ?? 50;
    closeQuestion(world, id, signId, ctx.now, text, credence >= 70 || credence <= 30);
  }
  return true;
}
