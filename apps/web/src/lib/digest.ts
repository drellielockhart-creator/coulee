/**
 * "What changed since you looked away" (11 §1.3 resume card, cheap form). OWNER: module:web.
 *
 * A baseline is taken when the map goes out of sight (the app is hidden, or a full sheet covers
 * it) and compared with the view model on return. Only what the PC's own view model holds is
 * used, so the digest can never leak what the character doesn't know (P1). Pure; display only.
 */
import type { ViewModel } from '@coulee/core';
import { money } from './format.ts';

export interface Baseline {
  t: number;
  lastChronicleId: number;
  purseCents: number;
  placeId: number | null;
  bands: Record<string, string>;
}

function pcOf(vm: ViewModel) {
  return vm.actors.find((a) => a.id === vm.playerId) ?? null;
}

export function baselineOf(vm: ViewModel): Baseline {
  const pc = pcOf(vm);
  return {
    t: vm.time.t,
    lastChronicleId: vm.chronicle.recent.reduce((m, e) => Math.max(m, e.id), 0),
    purseCents: pc?.provisions.purseCents ?? 0,
    placeId: pc?.placeId ?? null,
    bands: Object.fromEntries((pc?.needs.list ?? []).map((n) => [n.id, n.band])),
  };
}

/** One line for the resume card. */
export function digestLine(base: Baseline, vm: ViewModel, placeName: (id: number) => string): string {
  const pc = pcOf(vm);
  const fresh = vm.chronicle.recent.filter((e) => e.id > base.lastChronicleId);
  const hours = Math.round((vm.time.t - base.t) / 60);
  if (hours <= 0 || !pc) {
    const last = vm.chronicle.recent.at(-1);
    const where = pc ? `${pc.shortName}: ${pc.activity.verb} · ${placeName(pc.placeId)}.` : '';
    const lastText = last ? (last.text.length > 90 ? `${last.text.slice(0, 89).trimEnd()}…` : last.text) : '';
    return `Welcome back. The world waited for you. ${where}${lastText ? ` Last: ${lastText}` : ''}`.trim();
  }
  const parts: string[] = [];
  if (fresh.length) parts.push(`${fresh.length} new in the Chronicle`);
  for (const n of pc.needs.list) {
    const was = base.bands[n.id];
    if (was !== undefined && was !== n.band && n.band) parts.push(`${n.name}: ${was || 'content'} → ${n.band}`);
  }
  const dPurse = pc.provisions.purseCents - base.purseCents;
  if (dPurse !== 0) parts.push(`purse ${dPurse > 0 ? '+' : ''}${money(dPurse)}`);
  if (base.placeId !== null && pc.placeId !== base.placeId) parts.push(`now at ${placeName(pc.placeId)}`);
  const span = hours === 1 ? '1 h' : `${hours} h`;
  return `Since you looked away (${span}): ${parts.length ? parts.join(' · ') : 'nothing you’d notice'}.`;
}
