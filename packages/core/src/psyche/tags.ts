/**
 * How the psyche reads options: merged tags per urge (the activity/interaction's own `tags`
 * plus psyche's `urge_tags` rows), drive relief, and norm prohibitions (10 §5.2).
 * OWNER: module:psyche. Pure helpers; the index is rebuilt per call site (cheap: ~100 rows).
 */

import type { DriveDef, NormDef } from '@coulee/content/schema';
import type { ContentBundle } from '../content.ts';
import type { Urge } from '../urge.ts';
import { termsLabel } from '../urge.ts';

export interface TagIndex {
  activity: Map<string, string[]>;
  interaction: Map<string, string[]>;
}

export function buildTagIndex(content: ContentBundle): TagIndex {
  const activity = new Map<string, string[]>();
  const interaction = new Map<string, string[]>();
  const add = (m: Map<string, string[]>, key: string, tags: readonly string[]) => {
    const cur = m.get(key) ?? [];
    for (const t of tags) if (!cur.includes(t)) cur.push(t);
    m.set(key, cur);
  };
  for (const id of Object.keys(content.activities ?? {}).sort()) {
    add(activity, id, content.activities[id]?.tags ?? []);
  }
  for (const id of Object.keys(content.interactions ?? {}).sort()) {
    add(interaction, id, content.interactions[id]?.tags ?? []);
  }
  for (const id of Object.keys(content.urge_tags ?? {}).sort()) {
    const row = content.urge_tags[id];
    if (!row) continue;
    add(row.kind === 'activity' ? activity : interaction, row.ref, row.tags);
  }
  for (const m of [activity, interaction]) for (const [k, v] of m) m.set(k, [...v].sort());
  return { activity, interaction };
}

export function urgeTags(idx: TagIndex, u: Urge): readonly string[] {
  if (u.kind === 'activity') return idx.activity.get(u.activityId) ?? [];
  if (u.kind === 'interaction') return idx.interaction.get(u.interactionId) ?? [];
  return [];
}

export const intersects = (a: readonly string[], b: readonly string[]): boolean => a.some((x) => b.includes(x));

/** Display name of an urge's option ("Drink at the tavern"), for {option} in lines. */
export function optionName(content: ContentBundle, u: Urge): string {
  if (u.kind === 'activity') return content.activities[u.activityId]?.name ?? u.activityId;
  if (u.kind === 'interaction') return content.interactions[u.interactionId]?.name ?? u.interactionId;
  return content.defenses?.[u.defense]?.name ?? u.defense;
}

/** Present participle of an urge's option ("drinking at the tavern"), for {verb}. */
export function optionVerb(content: ContentBundle, u: Urge): string {
  if (u.kind === 'activity') return content.activities[u.activityId]?.verb ?? u.activityId;
  return optionName(content, u).toLowerCase();
}

/** Does this drive find relief in this option (by tags)? */
export function relieves(drive: DriveDef, tags: readonly string[]): boolean {
  return intersects(drive.relief_tags, tags);
}

/** The norm's prohibitions that hit these tags (ignoring `when`). */
export function forbiddingRules(norm: NormDef, tags: readonly string[]): NormDef['forbids'] {
  return norm.forbids.filter((f) => intersects(f.tags, tags));
}

/** Stable sort key for an urge (total order). */
export function urgeKey(u: Urge): string {
  switch (u.kind) {
    case 'activity':
      return `a:${u.activityId}${u.placeId !== undefined ? `@${u.placeId}` : ''}${u.itemId !== undefined ? `$${u.itemId}` : ''}`;
    case 'interaction':
      return `i:${u.interactionId}${u.targetId !== undefined ? `>${u.targetId}` : ''}${u.topic !== undefined ? `#${u.topic}` : ''}${u.itemId !== undefined ? `$${u.itemId}` : ''}${u.terms !== undefined ? `/${termsLabel(u.terms)}` : ''}`;
    case 'defense':
      return `d:${u.defense}${u.targetId !== undefined ? `>${u.targetId}` : ''}`;
  }
}

export const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
