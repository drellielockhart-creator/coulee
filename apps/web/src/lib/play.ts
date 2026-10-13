/**
 * How the play panels arrange what the session offers. OWNER: module:web.
 *
 * Pure display: grouping, ordering and wording of `observation.actions` (the session's own
 * available actions, ADR 0002). Nothing here decides whether an action is possible; the
 * session offered it, and the session validates it again when it comes back.
 */
import type { AvailableAction, MoneyChange } from '@coulee/play';
import type { ActionCatalog, PlayObservation } from '../protocol.ts';
import type { ActGroup } from '../state/ui.ts';
import { money } from './format.ts';

export const GROUPS: ReadonlyArray<{ id: ActGroup; label: string; glyph: string }> = [
  { id: 'move', label: 'Go', glyph: '➚' },
  { id: 'talk', label: 'Talk', glyph: '❝' },
  { id: 'trade', label: 'Trade', glyph: '⚖' },
  { id: 'eat', label: 'Eat & drink', glyph: '♨' },
  { id: 'rest', label: 'Rest & wait', glyph: '☾' },
  { id: 'work', label: 'Work', glyph: '⚒' },
  { id: 'errands', label: 'Calls', glyph: '⌂' },
  { id: 'pack', label: 'Pack', glyph: '▣' },
  { id: 'signs', label: 'Signs', glyph: '✶' },
  { id: 'aid', label: 'Aid', glyph: '✚' },
  { id: 'read', label: 'Look', glyph: '◉' },
  { id: 'life', label: 'This life', glyph: '❦' },
];

/** The Act group an offered action belongs to (by its stable id and the activity's content tags). */
export function groupOf(a: AvailableAction, catalog: ActionCatalog): ActGroup {
  const [head, rest] = [a.id.split(':')[0] ?? '', a.id.split(':')[1] ?? ''];
  switch (head) {
    case 'go':
    case 'route':
    case 'travel':
    case 'journey':
      return 'move';
    case 'talk':
    case 'answer':
      return 'talk';
    case 'buy':
    case 'sell':
    case 'prices':
      return 'trade';
    case 'eat':
    case 'drink':
    case 'meal':
    case 'refill':
    case 'empty':
      return 'eat';
    case 'wait':
      return 'rest';
    case 'pack':
    case 'unpack':
    case 'rations':
    case 'plan':
      return 'pack';
    case 'signs':
    case 'investigate':
      return 'signs';
    case 'aid':
      return 'aid';
    case 'retire':
    case 'depart':
      return 'life';
    case 'activity': {
      const def = catalog.activities.find((d) => d.id === rest);
      const tags = def?.tags ?? [];
      if (tags.includes('travel')) return 'move';
      if (def?.asleep || tags.includes('camp') || tags.includes('leisure') || rest === 'idle_at_home') return 'rest';
      if (tags.includes('meal') || tags.includes('cook') || tags.includes('campfire') || rest === 'fetch_water')
        return 'eat';
      if (tags.some((t) => t === 'labor' || t === 'chore' || t === 'wild_production')) return 'work';
      return 'errands';
    }
    default:
      return 'read';
  }
}

/** Offered actions by group, in the session's order. */
export function groupActions(o: PlayObservation, catalog: ActionCatalog): Map<ActGroup, AvailableAction[]> {
  const out = new Map<ActGroup, AvailableAction[]>();
  for (const a of o.actions) {
    const g = groupOf(a, catalog);
    // Reading: only what is near to hand (people here, this place, the pack); the Ledger has the rest.
    if (g === 'read' && a.id.startsWith('inspect:')) {
      const [, kind, id] = a.id.split(':');
      const near =
        (kind === 'actor' && o.present.some((p) => p.id === Number(id))) ||
        (kind === 'place' && Number(id) === o.place.id);
      if (!near) continue;
    }
    const list = out.get(g) ?? [];
    list.push(a);
    out.set(g, list);
  }
  return out;
}

/** Where a destination lies, for the Go list. */
export function areaOf(kind: string): string {
  if (kind === 'building' || kind === 'house' || kind === 'yard') return 'In town';
  if (kind === 'farmstead' || kind === 'field') return 'Farms & fields';
  if (kind === 'road' || kind === 'landing') return 'Roads & the river';
  return 'Out in the country';
}

/** The offered action a held thought points at ("you may: sleep"), if the session offers it. */
export function actionForUrge(o: PlayObservation, urge: string): AvailableAction | null {
  const activity = /^activity:(.+)$/.exec(urge);
  if (activity) return o.actions.find((a) => a.id === urge) ?? null;
  const interaction = /^interaction:([a-z_]+)->(\d+)$/.exec(urge);
  if (interaction) return o.actions.find((a) => a.id === `talk:${interaction[1]}:${interaction[2]}`) ?? null;
  return null;
}

/** "+25¢ purse · −$1.00 household: wages from Pratt & Daughter". */
export function moneyLine(m: MoneyChange): string {
  const part = (cents: number, where: string) => `${cents > 0 ? '+' : ''}${money(cents)} ${where}`;
  const parts = [m.purse ? part(m.purse, 'purse') : '', m.household ? part(m.household, 'household') : ''].filter(
    Boolean,
  );
  return `${parts.join(' · ') || 'No change'}: ${m.reason}`;
}

/** Wait orders in the REPL's own grammar (ADR 0002 §3): every one stops on the shared interrupts. */
export const WAITS: ReadonlyArray<{ text: string; label: string }> = [
  { text: 'wait 1h', label: 'An hour' },
  { text: 'wait 4h', label: 'Four hours' },
  { text: 'wait until dawn', label: 'Till dawn' },
  { text: 'wait until morning', label: 'Till morning' },
  { text: 'wait until noon', label: 'Till noon' },
  { text: 'wait until dusk', label: 'Till dusk' },
  { text: 'wait until night', label: 'Till nightfall' },
  { text: 'wait until social.interaction', label: 'Till spoken to' },
];

/** The verb a talk action names, and the person ("Chat: Michael Dunleavy" → Chat). */
export function talkParts(a: AvailableAction): { verb: string; who: string; targetId: number | null } {
  const [verb, who] = a.label.split(': ');
  const target = /^talk:[a-z_]+:(\d+)$/.exec(a.id)?.[1];
  return { verb: verb ?? a.label, who: who ?? '', targetId: target === undefined ? null : Number(target) };
}

/** "HH:MM" from a game minute. */
export function hhmm(t: number): string {
  const m = ((t % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
