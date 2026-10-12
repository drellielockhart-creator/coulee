/**
 * Chronicle content (05 §9 story sifting, §11.2 the voices). OWNER: module:chronicle.
 *
 * Three domains, all under content/base/chronicle/:
 *   - `[[template]]`  period-voice prose. `on` is an event kind ('social.interaction') or a
 *                     pattern id ('feud') or '<pattern>.closed' / '<pattern>.truth'. A template
 *                     is chosen by voice, minimum importance, its `when` conditions (matched
 *                     against the entry's bindings; more specific templates win) and an
 *                     optional `tone` (journals take the writer's temperament). Text variants
 *                     are Tracery-like: `{slot}` fills a binding, `{_slot}` the same with a
 *                     leading space when non-empty, `{^slot}` capitalizes, `{a|b|c}` picks one
 *                     inline, and `#word#` expands a lexicon entry. All picks are deterministic.
 *   - `[[lexicon]]`   word lists for `#word#` expansion.
 *   - `[[pattern]]`   sifting knobs: whether a pattern is on, its base importance, integer
 *                     parameters and string lists. The detectors live in code; the numbers and
 *                     vocabularies they read live here (data over code), with in-code defaults so
 *                     a missing record never breaks a run.
 */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import { defineDomain, type Issue, id, int } from './common.ts';

export const VOICES = ['journal', 'paper', 'almanac', 'ballad', 'ledger', 'epilogue'] as const;
export type ChronicleVoiceId = (typeof VOICES)[number];

/** Journal temperaments, taken from the writer's strongest value (04 §3.1). */
export const TONES = [
  'piety',
  'temper',
  'thrift',
  'superstition',
  'ambition',
  'rancor',
  'neighborliness',
  'parochialism',
  'discretion',
  'skeptic',
] as const;

/**
 * Every name a template may use as a `{slot}`. The core's binding builders produce exactly
 * these names (a cli test keeps the two lists equal).
 */
export const TEMPLATE_SLOTS = [
  'deceased',
  'cause',
  'attendance',
  'omen',
  'edition',
  // time and place
  'town',
  'main_street',
  'back_road',
  'creek',
  'date',
  'weekday',
  'when',
  'moon',
  'season',
  'place',
  'at',
  'week',
  'year',
  // people
  'actor',
  'actor_short',
  'actor_given',
  'target',
  'target_short',
  'target_given',
  'other',
  'other_short',
  'other_given',
  'he',
  'his',
  'him',
  'himself',
  'target_he',
  'target_his',
  'target_him',
  'other_he',
  'other_his',
  'other_him',
  'cast',
  'author',
  // households
  'household',
  'household_b',
  'family',
  'family_b',
  'families',
  'members',
  // events
  'interaction',
  'interaction_name',
  'act',
  'act_noun',
  'label',
  'count',
  'count_word',
  'count_tall',
  'days',
  'days_word',
  'span',
  'ordinal',
  'level_word',
  // beliefs
  'rumor',
  'subject',
  'subject_given',
  'holders',
  'mutation',
  'figure',
  'rung_name',
  'projector',
  'defense_name',
  'defense_clinical',
  'anxiety',
  // food, stores and supplies (P8)
  'item',
  'items',
  'board',
  'lost',
  'why',
  'meals',
  'cold_meals',
  'fresh_pct',
  'ration_pct',
  'lowest_days',
  'condition_name',
  'kcal',
  'kcal_day',
  'fuel',
  'supplies',
  'prices',
  'market',
  'shops',
  'credit',
  'price',
  'amount',
  'balance',
  'favor',
  'matters',
  'services',
  'observances',
  'misfortune',
  'aim',
  'families_b',
  'shortages',
  'shortages_word',
  'creditor',
  'debtor',
  'need_name',
  'band',
  'masthead',
  // module:chronicle additions (story fixes)
  'weather',
  'shortages_times',
  'act_pp',
  'mediator',
  'mediator_short',
  'fights',
  // playtest 2026-10-11: the diarist's own side of a feud
  'other_families',
  // fae slice 1b (13 §6.7): The Charm at ‹town›
  'charm',
  'claim',
  'keeper',
  'keeper_short',
  'source',
  'lb',
  'resolution',
  'lent_to',
  'blame',
] as const;
export type TemplateSlot = (typeof TEMPLATE_SLOTS)[number];

/** Extra binding names usable only in `when` (enums and flags, not slots). */
export const WHEN_ONLY_KEYS = [
  'level',
  'basis',
  'voice',
  'success',
  'cls',
  'kind',
  'pred',
  'defense',
  'condition',
  'need',
  'on',
  'sex',
  'sabbath',
  'across',
  'truth',
  'hidden_kin',
  'severity',
  'rung',
  'in_need',
  'pc',
  'tone',
  'food',
  'quarrel',
  'stage',
  'diet',
  'gravity',
  'outcome',
  'closed',
  'needy',
  'violent',
  'quiet',
  'aimed',
  'actor_me',
  'target_me',
  'priced',
  'uncanny',
  'named',
  'sum',
  'detail',
  // module:chronicle additions (story fixes)
  'believed',
  'via_defense',
  'confined',
  'mediated',
  // playtest 2026-10-11: the diarist is a party (feud), the PC's real stores (shortage)
  'me',
  'children',
  'stocked',
  'again',
  // playtest r2 (module:social request): a news-carrying act told something, or nothing
  'told',
] as const;

export const WHEN_KEYS: readonly string[] = [...TEMPLATE_SLOTS, ...WHEN_ONLY_KEYS, 'interaction'];

const WhenValueSchema = z.union([
  z.string(),
  z.number().int(),
  z.boolean(),
  z.array(z.union([z.string(), z.number().int()])).min(1),
]);

export const ChronicleTemplateSchema = z.strictObject({
  id: id(),
  /** What the template renders: an event kind ('core.day_started'), a pattern id ('feud'), or '<pattern>.closed' / '<pattern>.truth'. */
  on: z.string().min(1),
  voice: z.enum(VOICES),
  /** Minimum importance 0..100 for this template to fire. */
  min_importance: int().min(0).max(100).default(0),
  /** Journal temperament this variant belongs to; omitted = the default pool. */
  tone: z.enum(TONES).optional(),
  /** Conditions on the entry's bindings, all of which must hold. A list matches any member. */
  when: z.record(z.string().min(1), WhenValueSchema).default({}),
  /** Text variants; one is chosen deterministically. */
  text: z.array(z.string().min(1)).min(1),
  /** Optional headline for the 'paper' voice (same slot syntax). */
  headline: z.string().optional(),
});
export type ChronicleTemplateDef = z.output<typeof ChronicleTemplateSchema>;

export const ChronicleLexiconSchema = z.strictObject({
  id: id(),
  words: z.array(z.string().min(1)).min(1),
});
export type ChronicleLexiconDef = z.output<typeof ChronicleLexiconSchema>;

export const ChroniclePatternSchema = z.strictObject({
  id: id(),
  /** Display name ("the feud") for tooling and the thread list. */
  name: z.string().min(1),
  description: z.string().default(''),
  enabled: z.boolean().default(true),
  /** Base importance 0..100 of this pattern's entries (levels add to it). */
  importance: int().min(0).max(100).default(50),
  /** Integer knobs (thresholds, windows in days, cents). Names are defined by the detector. */
  params: z.record(id(), int()).default({}),
  /** String vocabularies (interaction ids, label names, memory kinds). */
  lists: z.record(id(), z.array(z.string().min(1))).default({}),
});
export type ChroniclePatternDef = z.output<typeof ChroniclePatternSchema>;

export const chronicleDomains = {
  chronicleTemplates: defineDomain({
    dir: 'chronicle',
    key: 'template',
    schema: ChronicleTemplateSchema,
  }),
  chronicleLexicon: defineDomain({
    dir: 'chronicle',
    key: 'lexicon',
    schema: ChronicleLexiconSchema,
  }),
  chroniclePatterns: defineDomain({
    dir: 'chronicle',
    key: 'pattern',
    schema: ChroniclePatternSchema,
  }),
};

/** The parsed pieces of one template string: slots, inline alternatives, lexicon refs. */
export function templateRefs(text: string): { slots: string[]; lexicon: string[]; alternatives: string[][] } {
  const slots: string[] = [];
  const alternatives: string[][] = [];
  const lexicon: string[] = [];
  for (const m of text.matchAll(/#([a-z][a-z0-9_]*)#/g)) lexicon.push(m[1] as string);
  for (const m of text.matchAll(/\{([^{}]*)\}/g)) {
    const body = m[1] as string;
    if (body.includes('|')) alternatives.push(body.split('|'));
    else slots.push(body.replace(/^[_^]/, ''));
  }
  return { slots, lexicon, alternatives };
}

export function chronicleRefs(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  const slotSet = new Set<string>(TEMPLATE_SLOTS);
  const whenSet = new Set<string>(WHEN_KEYS);
  const lexicon = b.chronicleLexicon ?? {};
  for (const t of Object.values(b.chronicleTemplates ?? {})) {
    const where = `chronicleTemplates:${t.id}`;
    const texts = [...t.text, ...(t.headline ? [t.headline] : [])];
    texts.forEach((text, i) => {
      const refs = templateRefs(text);
      for (const s of refs.slots) {
        if (!slotSet.has(s)) issues.push({ where, path: `text.${i}`, message: `unknown slot '{${s}}'` });
      }
      for (const w of refs.lexicon) {
        if (!Object.hasOwn(lexicon, w)) issues.push({ where, path: `text.${i}`, message: `unknown lexicon '#${w}#'` });
      }
      for (const alt of refs.alternatives) {
        if (alt.some((a) => a.includes('{') || a.includes('}'))) {
          issues.push({ where, path: `text.${i}`, message: 'inline alternatives {a|b} cannot nest slots' });
        }
      }
    });
    for (const k of Object.keys(t.when)) {
      if (!whenSet.has(k)) issues.push({ where, path: `when.${k}`, message: `unknown binding '${k}'` });
    }
  }
  for (const lex of Object.values(lexicon)) {
    lex.words.forEach((w, i) => {
      for (const m of w.matchAll(/#([a-z][a-z0-9_]*)#/g)) {
        if (!Object.hasOwn(lexicon, m[1] as string)) {
          issues.push({
            where: `chronicleLexicon:${lex.id}`,
            path: `words.${i}`,
            message: `unknown lexicon '#${m[1]}#'`,
          });
        }
      }
    });
  }
  return issues;
}
