import { beliefOf, observe } from '../belief/api.ts';
import type { ActorId } from '../ids.ts';
import { authorizationExplain, authorizeAct, type Basis } from '../psyche/api.ts';
import type { SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { windows } from './episodes.ts';
import { closeQuestion, omenCheck } from './omens.ts';
import { isProtectedSite } from './sites.ts';
import type { Episode, Window } from './state.ts';
import { signs } from './view.ts';
/** One refusal for any sign the actor never noticed or heard of, or that does not exist (no oracle). */
export const NO_SUCH_SIGN =
  'You have noticed no sign by that name. Use signs to list the ones you can follow; what is always so at a place is its character, not a sign.';
const WINDOW_SPAN: Record<Window, number> = { dawn: 120, noon: 120, dusk: 95, midnight: 120 };
const WINDOW_WORD: Record<Window, string> = { dawn: 'dawn', noon: 'noon', dusk: 'dusk', midnight: 'midnight' };

/**
 * The windows in which a sign's trace can be read (13 §3.3, §3.9): while the episode runs, and
 * afterwards at the same window of each later day while the trace lasts. Returns the window day
 * (0 = the episode's own) open at `t`, or null, plus the next opening.
 */
export function signWindow(world: World, e: Episode, t: number): { day: number | null; next: number | null } {
  const place = world.places[e.snapshot.placeId];
  if (!place) return { day: null, next: null };
  const first = Math.floor(e.snapshot.at / 1440);
  if (t >= e.snapshot.at && t <= Math.max(e.end, e.snapshot.at + WINDOW_SPAN[e.snapshot.window]))
    return { day: 0, next: null };
  let next: number | null = null;
  for (let d = first + 1; d <= Math.floor(e.traceEnd / 1440) + 1; d++) {
    const w = windows(place, d).find((x) => x.window === e.snapshot.window);
    if (!w || w.at > e.traceEnd) continue;
    if (t >= w.at && t <= w.at + WINDOW_SPAN[e.snapshot.window]) return { day: d - first, next: null };
    if (w.at > t && next === null) next = w.at;
  }
  return { day: null, next };
}

function clock(t: number): string {
  const m = ((t % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h < 10 ? '0' : ''}${h}:${mm < 10 ? '0' : ''}${mm}`;
}

export function investigationEligibility(world: World, id: ActorId, signId: string): string | null {
  const a = world.actors[id];
  if (!a) return NO_SUCH_SIGN;
  const e = world.fae.episodes[signId];
  const q = world.fae.questions[id]?.find((x) => x.signId === signId);
  // Knowledge first: nothing below may answer differently for a sign the actor does not know of.
  const knows = !!q || !!e?.observers[id]?.noticed || (!!e && signs(world, id).some((x) => x.signId === signId));
  if (!knows) return NO_SUCH_SIGN;
  if (!e || e.traceEnd < world.time) return 'That trace has faded; there is nothing left to follow.';
  const place = world.places[e.snapshot.placeId];
  if (!place || isProtectedSite(place)) return NO_SUCH_SIGN;
  if (e.attempts[id]?.found) {
    if (e.lead.kind !== 'place' || e.followups?.[id])
      return 'You have already tested this sign. Returning cannot change the evidence.';
    const destination = world.places[e.lead.placeId];
    if (!destination || isProtectedSite(destination)) return 'That destination is unavailable.';
    if (a.placeId !== destination.id) return `Follow the lead to ${destination.name} at dusk.`;
    const dusk = windows(destination, Math.floor(world.time / 1440)).find((w) => w.window === 'dusk');
    if (!dusk || world.time < dusk.at || world.time > dusk.at + 95)
      return 'Return at dusk; the trace can only be followed then.';
    return null;
  }
  if (a.placeId !== e.snapshot.placeId) return `Go back to ${place.name}, where the sign was.`;
  const open = signWindow(world, e, world.time);
  const word = WINDOW_WORD[e.snapshot.window];
  if (open.day === null)
    return open.next === null
      ? `The trace only shows at ${word}, and it will be gone before the next one.`
      : `The trace only shows at ${word}; come back then (from about ${clock(open.next)}).`;
  if (e.tries?.[id]?.includes(open.day))
    return `You have tested this sign already this ${word}. It shows again at the next ${word} while it lasts.`;
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
  // One attempt per window while the trace lasts (13 §3.9 no-reroll within an episode window); the
  // first window keeps the original key, later windows draw their own.
  const day = signWindow(world, e, ctx.now).day ?? 0;
  const result = omenCheck(world, ctx, e, id, skills[0] ?? 'perception', 10, day === 0 ? 0xfae5 : 0xfae5 ^ (day << 12));
  e.attempts[id] = { at: ctx.now, found: result.success, explain: result.explain };
  e.tries ??= {};
  e.tries[id] = [...(e.tries[id] ?? []), day];
  const word = WINDOW_WORD[e.snapshot.window];
  const text = !result.success
    ? `The trace will not yield a clear reading this time. It shows again at the next ${word} while it lasts.`
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
  // A dead end is an end: the question closes on it rather than staying open forever.
  if (result.success && e.lead.kind === 'nothing') closeQuestion(world, id, signId, ctx.now, text, true);
  return true;
}
