/**
 * Ego arbitration (10 §5). OWNER: module:psyche. Pure: inputs in, scored options and an
 * Explain out; the system applies the result.
 *
 *   S(o) = floor(R(o) × E / 100) + floor(V(o) × (150 − E) / 100) + noise,   noise ∈ ±floor((100 − E)/5) × 10
 *
 * R is the reality appraisal (−1000..1000: need relief, the schedule's call, inertia,
 * feasibility), V the net voice support (Σ supporting − Σ opposing thought intensities).
 * A strong ego weighs reality and dampens voices; a weak one is pushed by the loudest voice
 * and by impulse. A 'command' proposal always wins (10 §5.5, §14.5 #3): it is scored and
 * shown like any option, but no score can beat it.
 */
import type { Explain, ExplainTerm } from '../explain.ts';
import { sumTerms } from '../explain.ts';
import type { ActorId } from '../ids.ts';
import { sameUrge, type Urge, urgeLabel } from '../urge.ts';
import type { Thought } from './state.ts';
import { cmpStr, intersects, urgeKey } from './tags.ts';

export interface OptionInput {
  urge: Urge;
  /** Display name: "Take a meal". */
  name: string;
  tags: readonly string[];
  /** Reality appraisal terms (sum = R). */
  reality: ExplainTerm[];
}

export interface ScoredOption {
  urge: Urge;
  key: string;
  name: string;
  R: number;
  V: number;
  /** Support by voice (for-thoughts only). */
  idSupport: number;
  superegoSupport: number;
  commandSupport: number;
  /** Opposition by voice (against-thoughts and norm prohibitions). */
  idOpposition: number;
  superegoOpposition: number;
  noise: number;
  /** Score before noise (for impulse detection). */
  base: number;
  score: number;
  supporters: Thought[];
  opposers: Thought[];
  explain: Explain;
}

export interface ArbitrationResult {
  options: ScoredOption[];
  /** Ranked by score desc then key (total order). */
  ranked: ScoredOption[];
  winner: ScoredOption;
  /** Set when a 'command' thought forced the winner. */
  command: boolean;
  /** Noise flipped the winner (only counts when E < 40: 10 §5.4 'impulse'). */
  impulse: boolean;
}

export function supports(t: Thought, o: Urge): boolean {
  return (t.stance ?? 'for') === 'for' && sameUrge(t.urge, o);
}

export function opposes(t: Thought, o: Urge, tags: readonly string[]): boolean {
  if ((t.stance ?? 'for') !== 'against') return false;
  if (sameUrge(t.urge, o)) return true;
  return t.against !== undefined && intersects(t.against, tags);
}

/** Noise amplitude for an ego strength: floor((100 − E) / 5) × 10. */
export function noiseAmplitude(ego: number): number {
  return Math.floor((100 - Math.max(0, Math.min(100, ego))) / 5) * 10;
}

/** The distinct options the live thoughts want (for-stance), in key order. */
export function optionsFromThoughts(thoughts: readonly Thought[]): Urge[] {
  const seen = new Map<string, Urge>();
  for (const t of thoughts) {
    if ((t.stance ?? 'for') !== 'for') continue;
    const k = urgeKey(t.urge);
    if (!seen.has(k)) seen.set(k, t.urge);
  }
  return [...seen.entries()].sort((a, b) => cmpStr(a[0], b[0])).map(([, u]) => u);
}

/**
 * Score every option and pick the winner. `noiseOf(key)` returns the option's noise draw
 * (keyed per option so it does not depend on the option set). `commandKey` names the option
 * a command chose this hour, if any (the last command wins).
 */
export function arbitrate(
  actorId: ActorId,
  ego: number,
  thoughts: readonly Thought[],
  options: readonly OptionInput[],
  noiseOf: (key: string, amplitude: number) => number,
  commandKey?: string,
): ArbitrationResult | null {
  if (options.length === 0) return null;
  const E = Math.max(0, Math.min(100, ego));
  const amp = noiseAmplitude(E);
  const scored: ScoredOption[] = options.map((o) => {
    const key = urgeKey(o.urge);
    const R = Math.max(-1000, Math.min(1000, sumTerms(o.reality)));
    let idSupport = 0;
    let superegoSupport = 0;
    let commandSupport = 0;
    let idOpposition = 0;
    let superegoOpposition = 0;
    const supporters: Thought[] = [];
    const opposers: Thought[] = [];
    for (const t of thoughts) {
      if (supports(t, o.urge)) {
        supporters.push(t);
        if (t.voice === 'id') idSupport += t.intensity;
        else if (t.voice === 'superego') superegoSupport += t.intensity;
        else commandSupport += t.intensity;
      } else if (opposes(t, o.urge, o.tags)) {
        opposers.push(t);
        if (t.voice === 'id') idOpposition += t.intensity;
        else if (t.voice === 'superego') superegoOpposition += t.intensity;
      }
    }
    const V = idSupport + superegoSupport + commandSupport - idOpposition - superegoOpposition;
    // `+ 0` folds a negative zero (R < 0 at E = 0) so events stay plain JSON.
    const rTerm = Math.floor((R * E) / 100) + 0;
    const vTerm = Math.floor((V * (150 - E)) / 100) + 0;
    const noise = amp > 0 ? noiseOf(key, amp) : 0;
    const terms: ExplainTerm[] = [
      { source: 'psyche', label: `Reality ${R} × Self-Command ${E}%`, value: rTerm },
      { source: 'psyche', label: `Voices ${V} × ${150 - E}%`, value: vTerm },
      { source: 'psyche', label: `Impulse (±${amp})`, value: noise },
    ];
    const score = rTerm + vTerm + noise;
    const parts: string[] = [];
    for (const x of supporters) parts.push(`+${x.intensity} ${x.label}`);
    for (const x of opposers) parts.push(`−${x.intensity} ${x.label}`);
    for (const r of o.reality) parts.push(`R ${r.value >= 0 ? '+' : ''}${r.value} ${r.label}`);
    const explain: Explain = {
      kind: 'choice',
      label: o.name,
      subjects: [actorId],
      knowledge: 'self',
      terms,
      total: score,
      outcome: 'rejected',
      ...(parts.length > 0 ? { note: parts.join('; ') } : {}),
    };
    return {
      urge: o.urge,
      key,
      name: o.name,
      R,
      V,
      idSupport,
      superegoSupport,
      commandSupport,
      idOpposition,
      superegoOpposition,
      noise,
      base: rTerm + vTerm,
      score,
      supporters,
      opposers,
      explain,
    };
  });
  const ranked = [...scored].sort((a, b) => b.score - a.score || cmpStr(a.key, b.key));
  const byBase = [...scored].sort((a, b) => b.base - a.base || cmpStr(a.key, b.key));
  const top = ranked[0] as ScoredOption;
  const commanded = commandKey !== undefined ? scored.find((s) => s.key === commandKey) : undefined;
  const winner = commanded ?? top;
  const impulse = !commanded && E < 40 && byBase[0] !== undefined && byBase[0].key !== top.key;
  return { options: scored, ranked, winner, command: commanded !== undefined, impulse };
}

/** Which agency dominates an option's support: 'id' | 'superego' | 'command' | 'none'. */
export function dominantVoice(o: ScoredOption): 'id' | 'superego' | 'command' | 'none' {
  if (o.commandSupport > 0) return 'command';
  if (o.idSupport === 0 && o.superegoSupport === 0) return 'none';
  return o.idSupport >= o.superegoSupport ? 'id' : 'superego';
}

/** The arbitration Explain: kind 'arbitration', knowledge 'self', children = every option. */
export function arbitrationExplain(
  actorId: ActorId,
  label: string,
  result: ArbitrationResult,
  chosenKey: string,
  outcome: string,
  extraChildren: Explain[] = [],
  note?: string,
): Explain {
  const children = result.ranked.map((o) => ({
    ...o.explain,
    outcome: o.key === chosenKey ? 'chosen' : 'rejected',
  }));
  const chosen = result.options.find((o) => o.key === chosenKey) ?? result.winner;
  const terms = chosen.explain.terms.map((t) => ({ ...t }));
  return {
    kind: 'arbitration',
    label,
    subjects: [actorId],
    knowledge: 'self',
    terms,
    total: sumTerms(terms),
    outcome,
    children: [...children, ...extraChildren],
    ...(note !== undefined ? { note } : {}),
  };
}

export { urgeLabel };
