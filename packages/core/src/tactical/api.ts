import { installTacticalPositions, tacticalPosition } from '../activity/api.ts';
import { abilityMod } from '../actor.ts';
import type { Command } from '../command.ts';
import type { ContentBundle } from '../content.ts';
import { type ActorId, idsOf, type PlaceId } from '../ids.ts';
import { loadReport } from '../items/api.ts';
import { canAct, healthOf } from '../needs/api.ts';
import { authorizationExplain, authorizeAct, type Basis, tacticalReaction } from '../psyche/api.ts';
import { mixKey } from '../rng.ts';
import { instantOf, TICKS_PER_SECOND } from '../sim/clock.ts';
import type { SimContext } from '../sim/context.ts';
import { compareEntries, heapPush } from '../sim/heap.ts';
import type { World } from '../world.ts';
import { activeBrawls, beginBrawl, brawlCheck, decideBrawl, movementReactions } from './brawl.ts';
import type { TacticalCommand } from './commands.ts';
import { cellKey, fleeStep, movementCheck, sceneCells } from './spatial.ts';
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
    return s.heap.length ||
      activeBrawls(w).length ||
      idsOf<ActorId>(s.participants).some((id) => healthOf(w, id)?.dying) ||
      instantOf(w) - s.quietSince < 6 * TICKS_PER_SECOND
      ? 'Wait for six quiet seconds and all recovery to finish'
      : null;
  if (
    cmd.kind === 'tactical.reaction' &&
    (!Number.isInteger(cmd.data.count) || cmd.data.count < 0 || cmd.data.count > 3)
  )
    return 'Grant 0..3 reactions';
  if (cmd.kind === 'tactical.reaction' && cmd.data.count === 0)
    return p.reaction || (p.action?.phase === 'windup' && (p.action.kind === 'reaction' || p.action.fromReaction))
      ? null
      : 'No defensive reaction to revoke';
  if (cmd.kind === 'tactical.cancel')
    return p.action?.phase === 'windup' ? null : 'No cancellable windup; recovery must finish';
  if (p.action) return 'Finish recovery or cancel the current windup';
  if ((s.declarations[command.actorId] ?? 0) >= 3) return 'Resume time before declaring another action';
  const rule = brawlCheck(
    w,
    c,
    cmd.actorId,
    cmd.kind.slice(9) as Action['kind'],
    'targetId' in cmd.data ? cmd.data.targetId : undefined,
  );
  if (rule) return rule;
  if (cmd.kind === 'tactical.move') return movementCheck(w, c, cmd.actorId, cmd.data);
  return [
    'tactical.guard',
    'tactical.attack',
    'tactical.grapple',
    'tactical.escape',
    'tactical.yield',
    'tactical.accept',
    'tactical.parley',
    'tactical.flee',
    'tactical.stabilize',
    'tactical.reaction',
  ].includes(cmd.kind)
    ? null
    : 'Unknown tactical command';
}
export function startAction(
  w: World,
  ctx: SimContext,
  id: ActorId,
  kind: Action['kind'],
  basis: Basis,
  destination?: { x: number; y: number },
  targetId?: ActorId,
  reactionCount?: number,
  fromReaction = false,
): boolean {
  const s = w.tactical,
    p = s?.participants[id];
  if (!s?.active || !p || p.action || !canAct(w, id) || !authorizeAct(w, id, { kind: `tactical.${kind}` }, basis).ok)
    return false;
  if ((s.declarations[id] ?? 0) >= 3) return false;
  if (
    fromReaction &&
    (!p.reaction || p.reaction.remaining <= 0 || p.reaction.until < instantOf(w) || (p.reactionAt ?? 0) > instantOf(w))
  )
    return false;
  if (brawlCheck(w, ctx.content, id, kind, targetId)) return false;
  if (kind === 'flee') destination = fleeStep(w, ctx.content, id) ?? undefined;
  if (kind === 'move' && (!destination || movementCheck(w, ctx.content, id, destination))) return false;
  const load = loadReport(w, ctx.content, id);
  if ((kind === 'move' || kind === 'flee') && load.band.speedPct <= 0) return false;
  const t = ctx.content.combat_rules.brawl;
  const moving = kind === 'move' || kind === 'flee';
  const moveDuration = Math.max(
    1,
    Math.ceil((5 * 60 * TICKS_PER_SECOND * 100) / (264 * Math.max(1, load.band.speedPct))),
  );
  const duration = fromReaction
    ? (t?.reaction_windup_ticks ?? 1)
    : moving
      ? moveDuration * (kind === 'move' ? 2 : 1) * (w.actors[id]?.sheet.conditions.includes('staggered') ? 2 : 1)
      : kind === 'guard'
        ? 10
        : kind === 'stabilize'
          ? (t?.stabilize_ticks ?? 600)
          : kind === 'attack' || kind === 'parley'
            ? (t?.attack_ticks ?? 18)
            : kind === 'grapple' || kind === 'escape'
              ? (t?.grapple_ticks ?? 18)
              : (t?.declaration_ticks ?? 5);
  const token = ++s.seq,
    due = Math.max(instantOf(w), p.readyAt) + duration;
  const action: Action = {
    token,
    kind,
    phase: 'windup',
    basis,
    due,
    recoverUntil: Math.max(
      due + (t?.recovery_ticks ?? 12),
      w.actors[id]?.sheet.conditions.includes('staggered') ? Math.max(instantOf(w), p.readyAt) + 60 : 0,
    ),
    ...(targetId !== undefined ? { targetId } : {}),
    ...(reactionCount !== undefined ? { reactionCount } : {}),
    ...(fromReaction ? { fromReaction: true } : {}),
    ...(destination ? { destination } : {}),
  };
  p.action = action;
  if (kind !== 'guard') p.guarding = false;
  s.declarations[id] = (s.declarations[id] ?? 0) + 1;
  if (destination) s.reservations[cellKey(destination)] = { actorId: id, token };
  heapPush(s.heap, { instant: due, actorId: id, seq: ++s.seq, kind: 'commit', token });
  ctx.emit({
    kind: 'tactical.action',
    data: {
      actorId: id,
      action: kind,
      phase: 'windup',
      text: kind === 'guard' ? 'You prepare to guard.' : `You begin ${kind}.`,
    },
    roles: [{ actor: id, role: 'agent' }],
    visibility: 'private',
    explain: authorizationExplain(w, id, { kind: `tactical.${kind}` }, basis),
  });
  if ((kind === 'attack' || kind === 'grapple') && targetId !== undefined) beginBrawl(w, ctx, id, targetId);
  if (kind === 'flee') movementReactions(w, ctx, id);
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
  a.cancelled = true;
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
  if (cmd.kind === 'tactical.reaction' && cmd.data.count === 0) {
    const p = s.participants[cmd.actorId];
    if (p) {
      delete p.reaction;
      if (p.action?.kind === 'reaction' || p.action?.fromReaction) cancelAction(w, ctx, cmd.actorId);
    }
  } else if (cmd.kind === 'tactical.cancel') cancelAction(w, ctx, cmd.actorId);
  else if (cmd.kind === 'tactical.breathe') {
    s.active = false;
    s.pause = null;
    ctx.emit({
      kind: 'tactical.breathe',
      data: { text: 'You take a breath. Ordinary time resumes from this instant.' },
      place: s.placeId,
      visibility: 'public',
    });
  } else if (cmd.kind !== 'tactical.advance')
    startAction(
      w,
      ctx,
      cmd.actorId,
      cmd.kind.slice(9) as Action['kind'],
      { kind: 'command', issuer: cmd.issuer ?? { kind: 'player' } },
      cmd.kind === 'tactical.move' ? cmd.data : undefined,
      'targetId' in cmd.data ? cmd.data.targetId : undefined,
      cmd.kind === 'tactical.reaction' ? cmd.data.count : undefined,
    );
}
export function participants(w: World): ActorId[] {
  return w.tactical?.active ? idsOf<ActorId>(w.tactical.participants) : [];
}
export { tacticalPosition };

/** Authored/owner request: hostility still requires agency, reach, and a living opponent. */
export function requestBrawl(w: World, ctx: SimContext, a: ActorId, b: ActorId, basis: Basis): boolean {
  if (
    !authorizeAct(w, a, { kind: 'tactical.attack', targetId: b }, basis).ok ||
    brawlCheck(w, ctx.content, a, 'attack', b)
  )
    return false;
  beginBrawl(w, ctx, a, b);
  decideBrawl(w, ctx, a);
  return true;
}
