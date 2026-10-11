/**
 * Explain records (ADR 0001 invariant 5; 00 P1 "rules are legible").
 *
 * Every check, arbitration, and non-trivial formula that changes state produces an Explain
 * the UI can show: the inputs, each named modifier with its source, the roll, the DC, and
 * the outcome. Explains are plain data and live inline on events (and occasionally on
 * module state, e.g. the psyche's last arbitration).
 *
 * P1 knowledge gating: `knowledge` says who may see this math. The UI shows an Explain to
 * a viewer only if the viewer's character could know it; the post-run epilogue shows all.
 */
import type { ActorId } from './ids.ts';

/** Where a modifier comes from. Open string so modules can add sources; keep them short. */
export type ExplainSource =
  | 'ability'
  | 'ranks'
  | 'skill'
  | 'trait'
  | 'value'
  | 'condition'
  | 'need'
  | 'item'
  | 'tool'
  | 'weather'
  | 'light'
  | 'terrain'
  | 'place'
  | 'opinion'
  | 'belief'
  | 'memory'
  | 'psyche'
  | 'policy'
  | 'help'
  | 'fae'
  | 'base'
  | 'other'
  | (string & {});

export interface ExplainTerm {
  source: ExplainSource;
  /** Human label, period-flavored where it reads well: "Wisdom +2", "Rain +2". */
  label: string;
  /** Integer contribution. */
  value: number;
}

/**
 * Who can know this math (P1):
 * - 'public': anyone present / anyone who hears of it
 * - 'participants': the actors in `subjects`
 * - 'self': only `subjects[0]` (inner states: thoughts, arbitration, anxiety)
 * - 'omniscient': only the post-run epilogue / god view
 */
export type ExplainKnowledge = 'public' | 'participants' | 'self' | 'omniscient';

export type ExplainKind = 'check' | 'opposed' | 'arbitration' | 'formula' | 'choice' | (string & {});

export interface Explain {
  kind: ExplainKind;
  /** What was being decided: "Woodcraft check: start a fire in the rain". */
  label: string;
  subjects: ActorId[];
  knowledge: ExplainKnowledge;
  /** Additive terms that make up `total` (the roll is listed separately). */
  terms: ExplainTerm[];
  /** Natural die result, if a die was rolled. */
  roll?: { die: number; natural: number };
  /** Final total (roll + terms, or the formula result). */
  total: number;
  /** Target number and its own named terms (02 §3.3 world-state DCs). */
  dc?: { total: number; terms: ExplainTerm[] };
  /** Short outcome key: 'success', 'failure', 'chosen', 'rejected', 'tie'... */
  outcome: string;
  /** total - dc, when there is a DC. */
  margin?: number;
  /** Sub-decisions (e.g. each side of an opposed check, each candidate in an arbitration). */
  children?: Explain[];
  /** Free-form note shown under the math. */
  note?: string;
}

/** Integer, and never negative zero (`-0` prints as "band -0" and breaks plain-JSON round trips). */
export function intValue(value: number): number {
  return Math.round(value) + 0;
}

export function term(source: ExplainSource, label: string, value: number): ExplainTerm {
  return { source, label, value: intValue(value) };
}

/**
 * Normalize an Explain in place before it is stored on an event or state: every term, total,
 * margin and DC becomes an integer without negative zero (children included). Returns it.
 */
export function normalizeExplain(e: Explain): Explain {
  for (const t of e.terms) t.value = intValue(t.value);
  e.total = intValue(e.total);
  if (e.margin !== undefined) e.margin = intValue(e.margin);
  if (e.dc) {
    e.dc.total = intValue(e.dc.total);
    for (const t of e.dc.terms) t.value = intValue(t.value);
  }
  if (e.children) for (const c of e.children) normalizeExplain(c);
  return e;
}

export function sumTerms(terms: readonly ExplainTerm[]): number {
  let t = 0;
  for (const x of terms) t += x.value;
  return t;
}

/** Signed label helper: "+2" / "−3" (uses a true minus sign for display). */
export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** One-line rendering for logs and the CLI: "Woodcraft 14 (d20 9 +3 +2) vs DC 15: failure". */
export function explainLine(e: Explain): string {
  const parts: string[] = [];
  if (e.roll) parts.push(`d${e.roll.die} ${e.roll.natural}`);
  for (const t of e.terms) parts.push(`${t.label}`);
  const dc = e.dc ? ` vs DC ${e.dc.total}` : '';
  return `${e.label}: ${e.total} (${parts.join(', ')})${dc} -> ${e.outcome}`;
}
