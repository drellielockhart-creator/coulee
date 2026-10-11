/**
 * The prose engine: Tracery-like template expansion with typed bindings, deterministic via
 * the keyed rng stream 'chronicle' (05 §11.2; no LLM). OWNER: module:chronicle.
 *
 * Syntax inside a template string:
 *   {slot}      fill from the entry's bindings ('' if absent)
 *   {_slot}     same, with a leading space when non-empty ("{target}{_at}.")
 *   {^slot}     same, first letter capitalized
 *   {a|b|c}     one of the alternatives, chosen by the rng
 *   #word#      a random word or phrase from the content lexicon (may itself use #word#)
 */
import type { ContentBundle } from '../content.ts';
import type { Rng } from '../rng.ts';
import { capFirst } from './text.ts';

export type Bv = string | number | boolean;
export type Bindings = Record<string, Bv>;
type WhenVal = string | number | boolean | Array<string | number>;

export interface TemplateRec {
  id: string;
  on: string;
  voice: string;
  min_importance: number;
  tone?: string | undefined;
  when: Record<string, WhenVal>;
  text: string[];
  headline?: string | undefined;
}

export interface TemplateIndex {
  byOn: Record<string, TemplateRec[]>;
  lexicon: Record<string, string[]>;
}

export function buildTemplateIndex(content: ContentBundle): TemplateIndex {
  const byOn: Record<string, TemplateRec[]> = {};
  const all = Object.values(content.chronicleTemplates ?? {}) as TemplateRec[];
  all.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const t of all) {
    const list = byOn[t.on] ?? [];
    list.push(t);
    byOn[t.on] = list;
  }
  const lexicon: Record<string, string[]> = {};
  for (const lex of Object.values(content.chronicleLexicon ?? {})) lexicon[lex.id] = lex.words;
  return { byOn, lexicon };
}

function same(b: Bv | undefined, w: string | number | boolean): boolean {
  if (b === undefined) return w === false;
  if (typeof w === 'boolean' || typeof b === 'boolean') return b === w;
  return String(b) === String(w);
}

export function whenMatches(when: Record<string, WhenVal>, bind: Bindings): boolean {
  for (const [k, w] of Object.entries(when)) {
    const b = bind[k];
    if (Array.isArray(w)) {
      if (b === undefined || !w.some((x) => same(b, x))) return false;
    } else if (!same(b, w)) {
      return false;
    }
  }
  return true;
}

function expandLexicon(text: string, lex: Record<string, string[]>, rng: Rng, depth: number): string {
  if (depth > 4) return text.replace(/#[a-z][a-z0-9_]*#/g, '');
  return text.replace(/#([a-z][a-z0-9_]*)#/g, (_m, id: string) => {
    const words = lex[id];
    if (!words || words.length === 0) return '';
    return expandLexicon(rng.pick(words) as string, lex, rng, depth + 1);
  });
}

function expandAlternatives(text: string, rng: Rng): string {
  return text.replace(/\{([^{}]*\|[^{}]*)\}/g, (_m, body: string) => rng.pick(body.split('|')) as string);
}

function bv(b: Bv | undefined): string {
  if (b === undefined || b === false) return '';
  if (b === true) return 'yes';
  return String(b);
}

function fillSlots(text: string, bind: Bindings): string {
  return text.replace(/\{([_^]*)([a-z][a-z0-9_]*)\}/g, (_m, mods: string, name: string) => {
    let v = bv(bind[name]);
    if (v === '') return '';
    if (mods.includes('^')) v = capFirst(v);
    return mods.includes('_') ? ` ${v}` : v;
  });
}

/** Tidy spacing and punctuation after expansion. */
export function tidy(s: string): string {
  const out = s
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([,.;:!?])/g, '$1')
    .replace(/([,;:]) *([.!?])/g, '$2')
    .replace(/,{2,}/g, ',')
    .replace(/(?<!\.)\.\.(?!\.)/g, '.')
    .replace(/ *\n */g, '\n')
    .trim();
  return out
    .split('\n')
    .map((line) =>
      capFirst(line).replace(/([.!?]["”']?) +([a-z])/g, (_m, p: string, c: string) => `${p} ${c.toUpperCase()}`),
    )
    .join('\n');
}

export function expand(text: string, bind: Bindings, index: TemplateIndex, rng: Rng): string {
  return tidy(fillSlots(expandAlternatives(expandLexicon(text, index.lexicon, rng, 0), rng), bind));
}

export interface Rendered {
  text: string;
  headline: string | null;
  templateId: string;
}

/**
 * Choose and render a template for (key, voice). Returns null when nothing matches.
 * `variants` remembers the last variant used per template so the same line is not told twice
 * in a row (a deterministic variety rule; the state is part of the chronicle slice).
 */
export function renderTemplate(
  index: TemplateIndex,
  rng: Rng,
  variants: Record<string, number>,
  key: string,
  voice: string,
  importance: number,
  bind: Bindings,
  tone: string | null,
): Rendered | null {
  let cands = (index.byOn[key] ?? []).filter(
    (t) => t.voice === voice && importance >= t.min_importance && whenMatches(t.when, bind),
  );
  if (cands.length === 0) return null;
  const toned = tone ? cands.filter((t) => t.tone === tone) : [];
  cands = toned.length > 0 ? toned : cands.filter((t) => t.tone === undefined);
  if (cands.length === 0) return null;
  let best = 0;
  for (const t of cands) best = Math.max(best, Object.keys(t.when).length);
  cands = cands.filter((t) => Object.keys(t.when).length === best);
  const tpl = rng.pick(cands) as TemplateRec;
  const n = tpl.text.length;
  let vi = rng.int(0, n - 1);
  const last = variants[tpl.id];
  if (n > 1 && last === vi) vi = (vi + 1 + rng.int(0, n - 2)) % n;
  variants[tpl.id] = vi;
  const text = expand(tpl.text[vi] as string, bind, index, rng);
  const headline = tpl.headline ? expand(tpl.headline, bind, index, rng) : null;
  return { text, headline, templateId: tpl.id };
}
