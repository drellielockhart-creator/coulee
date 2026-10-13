/** Read-only open-state projection, owned beside the prose pattern definitions.
 * Milestones use the detector's full facts; closure alone is not proof of resolution.
 */
import type { ActorId } from '../../ids.ts';
import type { PatternParams } from '../params.ts';
import type { ChronicleThread } from '../state.ts';
import type { DetectCtx, PatternDef } from './types.ts';
export interface OpenProjection {
  id: number;
  pattern: string;
  actors: Record<string, ActorId>;
  places: number[];
  opened_at: number;
  last_advanced: number;
  stakes_pm: number;
  state: 'Latent' | 'Foreshadowed' | 'Active' | 'Climax' | 'Resolved' | 'Abandoned';
  level: number;
  open_questions: string[];
  guns: Array<{ event: number; at: number; salience: number; window: [number, number] }>;
  firedAt: number | null;
}
const ROLES: Record<string, string[]> = {
  debt: ['creditor', 'debtor'],
  courtship: ['suitor', 'beloved'],
  feud: ['first', 'rival'],
  scapegoat: ['accused', 'accuser'],
  defense_fired: ['subject'],
  charm: ['keeper', 'neighbor'],
};
const RESOLUTIONS: Record<string, string[]> = {
  debt: ['repay'],
  courtship: ['propose', 'refused'],
  charm: ['disp'],
};
const PLANTS: Record<string, string[]> = {
  feud: ['harm'],
  debt: ['debt', 'dun'],
  courtship: ['court'],
  scapegoat: ['rung'],
  whispers: ['told'],
  faekin_suspicion: ['told'],
  charm: ['arr', 'loan', 'missing', 'stolen'],
};
export function openProjection(def: PatternDef, th: ChronicleThread, dc: DetectCtx, p: PatternParams): OpenProjection {
  // Some detectors suppress a just-told match through Chronicle.recent. A story's
  // observed milestone must not fall back to Latent merely because its prose was emitted.
  const level = Math.max(def.level(th.facts, th, dc, p, 'all'), th.emitted.pub, th.emitted.pc, th.emitted.all);
  const resolved = th.facts.find((f) => (RESOLUTIONS[def.id] ?? []).includes(f.k));
  const finished = th.closed && def.id !== 'debt' && Math.max(level, th.emitted.pub, th.emitted.pc, th.emitted.all) > 0;
  const stage =
    resolved || finished
      ? 'Resolved'
      : th.closed
        ? 'Abandoned'
        : level >= 3
          ? 'Climax'
          : level >= 1
            ? 'Active'
            : 'Latent';
  const roles = ROLES[def.id] ?? ['subject', 'other'];
  const actors: Record<string, ActorId> = {};
  for (const [i, id] of th.actorIds.entries()) actors[roles[i] ?? `participant_${i + 1}`] = id as ActorId;
  const terminal = resolved?.t ?? null;
  const plants = th.facts.filter((f) => f.e > 0 && (PLANTS[def.id] ?? []).includes(f.k));
  const consequences = th.facts.filter(
    (f) =>
      f.e > 0 &&
      ['harm', 'rung', 'dun', 'overdue', 'propose', 'refused', 'repay', 'disp', 'stolen', 'force'].includes(f.k),
  );
  return {
    id: th.id,
    pattern: def.id,
    actors,
    places: [...new Set(th.facts.map((f) => f.p).filter((p) => p > 0))].sort((a, b) => a - b),
    opened_at: th.openedAt,
    last_advanced: th.lastAt,
    stakes_pm: Math.max(0, Math.min(1000, def.importanceAt(Math.max(1, level), th, p) * 10)),
    state: stage,
    level,
    open_questions: stage === 'Resolved' || stage === 'Abandoned' ? [] : [`How will this ${def.id} develop?`],
    guns: plants.map((f) => ({
      event: f.e,
      at: f.t,
      salience: Math.min(1000, def.importance * 10),
      window: [1, def.id === 'debt' ? p.n('overdue_days', 30) : 30],
    })),
    firedAt: terminal ?? consequences[consequences.length - 1]?.t ?? null,
  };
}
