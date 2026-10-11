/**
 * Chronicle prose templates (05 §11.2: Journal, Paper, Almanac, Ballad voices).
 * OWNER: module:chronicle (see docs/impl/MODULES.md).
 *
 * Templates are period-voice strings with `{binding}` slots filled from typed event/pattern
 * bindings. Variant choice is deterministic (rng stream 'chronicle').
 */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import { defineDomain, type Issue, id, int } from './common.ts';

export const VOICES = ['journal', 'paper', 'almanac', 'ballad', 'ledger'] as const;

export const ChronicleTemplateSchema = z.strictObject({
  id: id(),
  /** What the template renders: an event kind ('core.day_started') or a pattern id ('feud'). */
  on: z.string().min(1),
  voice: z.enum(VOICES),
  /** Minimum importance 0..100 for this template to fire. */
  min_importance: int().min(0).max(100).default(0),
  /** Text variants; one is chosen deterministically. Slots: {actor}, {target}, {place}, {date}... */
  text: z.array(z.string().min(1)).min(1),
  /** Optional headline for 'paper' voice. */
  headline: z.string().optional(),
});
export type ChronicleTemplateDef = z.output<typeof ChronicleTemplateSchema>;

export const chronicleDomains = {
  chronicleTemplates: defineDomain({
    dir: 'chronicle',
    key: 'template',
    schema: ChronicleTemplateSchema,
  }),
};

export function chronicleRefs(_b: ContentBundle): Issue[] {
  return [];
}
