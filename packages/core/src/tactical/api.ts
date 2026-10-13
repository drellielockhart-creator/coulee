import { installTacticalPositions, tacticalPosition } from '../activity/api.ts';
import { abilityMod } from '../actor.ts';
import type { Command } from '../command.ts';
import type { ContentBundle } from '../content.ts';
import { type ActorId, idsOf, type PlaceId } from '../ids.ts';
import { loadReport } from '../items/api.ts';
import { canAct } from '../needs/api.ts';
import { authorizationExplain, authorizeAct, type Basis, tacticalReaction } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import { instantOf, TICKS_PER_SECOND } from '../sim/clock.ts';
import type { SimContext } from '../sim/context.ts';
import { compareEntries, heapPush } from '../sim/heap.ts';
import type { World } from '../world.ts';
import type { TacticalCommand } from './commands.ts';
import { cellKey, movementCheck, sceneCells } from './spatial.ts';
import type { Action } from './state.ts';
export function requestEncounter(
  w: World,
  ctx: SimContext,
  sceneId: string,
  placeId: PlaceId,
  actors: ActorId[],
  text: string,
): boolean {
  if (w.tactical?.active || w.tactical?.sceneId === sceneId || w.time % 60 !== 0 || (w.tenth ?? 0) !== 0) return false;
  const ids = [...new Set(actors)]
    .sort((a, b) => a - b)
    .filter((id) => w.actors[id]?.placeId === placeId && canAct(w, id));
  const cells = sceneCells(w, ctx.content, placeId);
  if (ids.length < 2 || cells.length < ids.length) return false;
  const now = instantOf(w);
  w.tactical = {
    version: 1,
    sceneId,
    placeId,
    active: true,
    enteredAt: now,
    quietSince: now,
    participants: {},
    heap: [],
    seq: 0,
    commandSeq: 0,
    pendingCommands: [],
    declarations: {},
    reservations: {},
    pause: null,
  };
  w.tenth = 0;
  installTacticalPositions(w, placeId, ids, cells);
  for (const id of ids) {
    const actor = w.actors[id];
    if (!actor) continue;
    const die = ctx.rng('combat', mixKey(id, now, 0x1a17)).int(1, 20);
    const dex = abilityMod(actor.sheet.abilities.dex),
      total = die + dex;
    const delay = (Math.max(3, 30 - total) * TICKS_PER_SECOND) / 10;
    w.tactical.participants[id] = { readyAt: now + delay, action: null, unready: true, guarding: false };
    ctx.emit({
      kind: 'tactical.initiative',
      data: { actorId: id, delay },
      roles: [{ actor: id, role: 'subject' }],
      visibility: 'inner',
      explain: {
        kind: 'check',
        label: 'Initiative',
        subjects: [id],
        knowledge: 'self',
        terms: [
          { source: 'roll', label: 'd20', value: die },
          { source: 'ability', label: 'Dexterity', value: dex },
        ],
        total,
        outcome: 'ready',
        note: `Initial delay ${delay} clock ticks.`,
      },
    });
  }
  const eventId = ctx.emit({
    kind: 'tactical.danger',
    data: { sceneId, text, actorIds: ids },
    place: placeId,
    roles: ids.map((actor) => ({ actor, role: 'participant' })),
    visibility: 'witnessed',
    importance: 80,
  });
  w.tactical.pause = { instant: now, eventId };
  for (const id of ids) {
    const reaction = tacticalReaction(w, id);
    if (reaction) startAction(w, ctx, id, reaction, { kind: 'own' });
  }
  return true;
}
export function tacticalCommandCheck(w: World, c: ContentBundle, command: Command): string | null {
  if (!command.kind.startsWith('tactical.')) return 'Not a tactical command';
  const s = w.tactical,
    p = s?.participants[command.actorId];
  if (!s?.active || !p) return 'No active tactical scene';
  const cmd = command as TacticalCommand;
  if (cmd.kind === 'tactical.advance')
    return Number.isSafeInteger(cmd.data.ticks) && cmd.data.ticks > 0 && cmd.data.ticks <= 36000
      ? null
      : 'Advance 1..36000 clock ticks';
  if (cmd.kind === 'tactical.breathe')
    return s.heap.length || instantOf(w) - s.quietSince < 6 * TICKS_PER_SECOND
      ? 'Wait for six quiet seconds and all recovery to finish'
      : null;
  if (cmd.kind === 'tactical.cancel')
    return p.action?.phase === 'windup' ? null : 'No cancellable windup; recovery must finish';
  if (p.action) return 'Finish recovery or cancel the current windup';
  if ((s.declarations[command.actorId] ?? 0) >= 3) return 'Resume time before declaring another action';
  if (cmd.kind === 'tactical.move') return movementCheck(w, c, cmd.actorId, cmd.data);
  return cmd.kind === 'tactical.guard' ? null : 'Unknown tactical command';
}
export function startAction(
  w: World,
  ctx: SimContext,
  id: ActorId,
  kind: 'move' | 'guard',
  basis: Basis,
  destination?: { x: number; y: number },
): boolean {
  const s = w.tactical,
    p = s?.participants[id];
  if (!s?.active || !p || p.action || !canAct(w, id) || !authorizeAct(w, id, { kind: `tactical.${kind}` }, basis).ok)
    return false;
  if ((s.declarations[id] ?? 0) >= 3) return false;
  if (kind === 'move' && (!destination || movementCheck(w, ctx.content, id, destination))) return false;
  const load = loadReport(w, ctx.content, id);
  if (kind === 'move' && load.band.speedPct <= 0) return false;
  const duration =
    kind === 'guard'
      ? 1 * TICKS_PER_SECOND
      : Math.max(1, Math.ceil((5 * 60 * TICKS_PER_SECOND * 100) / (264 * Math.max(1, load.band.speedPct))));
  const token = ++s.seq,
    due = Math.max(instantOf(w), p.readyAt) + duration;
  const action: Action = {
    token,
    kind,
    phase: 'windup',
    basis,
    due,
    recoverUntil: due + Math.round(1.2 * TICKS_PER_SECOND),
    ...(destination ? { destination } : {}),
  };
  p.action = action;
  if (kind === 'move') p.guarding = false;
  s.declarations[id] = (s.declarations[id] ?? 0) + 1;
  if (destination) s.reservations[cellKey(destination)] = { actorId: id, token };
  heapPush(s.heap, { instant: due, actorId: id, seq: ++s.seq, kind: 'commit', token });
  ctx.emit({
    kind: 'tactical.action',
    data: {
      actorId: id,
      action: kind,
      phase: 'windup',
      text: kind === 'guard' ? 'You prepare to guard.' : 'You begin a step.',
    },
    roles: [{ actor: id, role: 'agent' }],
    visibility: 'private',
    explain: authorizationExplain(w, id, { kind: `tactical.${kind}` }, basis),
  });
  return true;
}
export function releaseReservation(w: World, id: ActorId, action: Action): void {
  const s = w.tactical;
  if (s && action.destination && s.reservations[cellKey(action.destination)]?.actorId === id)
    delete s.reservations[cellKey(action.destination)];
}
export function cancelAction(w: World, ctx: SimContext, id: ActorId): void {
  const s = w.tactical,
    p = s?.participants[id],
    a = p?.action;
  if (!s || !p || !a || a.phase !== 'windup') return;
  releaseReservation(w, id, a);
  s.heap = s.heap.filter((e) => e.token !== a.token).sort(compareEntries);
  a.phase = 'recovery';
  heapPush(s.heap, { instant: a.recoverUntil, actorId: id, seq: ++s.seq, kind: 'recover', token: a.token });
  ctx.emit({
    kind: 'tactical.action',
    data: {
      actorId: id,
      action: a.kind,
      phase: 'cancelled',
      text: 'Cancelled before commitment; recovery still has to finish.',
    },
    roles: [{ actor: id, role: 'agent' }],
    visibility: 'private',
  });
}
export function commandTactical(w: World, ctx: SimContext, cmd: TacticalCommand): void {
  if (tacticalCommandCheck(w, ctx.content, cmd)) return;
  if (
    !authorizeAct(w, cmd.actorId, { kind: cmd.kind }, { kind: 'command', issuer: cmd.issuer ?? { kind: 'player' } }).ok
  )
    return;
  const s = w.tactical;
  if (!s) return;
  s.commandSeq++;
  if (cmd.kind === 'tactical.cancel') cancelAction(w, ctx, cmd.actorId);
  else if (cmd.kind === 'tactical.breathe') {
    s.active = false;
    s.pause = null;
    ctx.emit({
      kind: 'tactical.breathe',
      data: { text: 'You take a breath. Ordinary time resumes from this instant.' },
      place: s.placeId,
      visibility: 'public',
    });
  } else if (cmd.kind === 'tactical.move' || cmd.kind === 'tactical.guard')
    startAction(
      w,
      ctx,
      cmd.actorId,
      cmd.kind === 'tactical.move' ? 'move' : 'guard',
      { kind: 'command', issuer: cmd.issuer ?? { kind: 'player' } },
      cmd.kind === 'tactical.move' ? cmd.data : undefined,
    );
}
export function participants(w: World): ActorId[] {
  return w.tactical?.active ? idsOf<ActorId>(w.tactical.participants) : [];
}
export { tacticalPosition };
