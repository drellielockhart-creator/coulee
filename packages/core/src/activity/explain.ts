import { type Explain, normalizeExplain } from '../explain.ts';

/**
 * The explanation an activity event carries: the arbitration's (or routine's) own label, terms and
 * outcome, normalized, without the candidate tree. The full arbitration stays in the actor's mind
 * (psyche state and `psyche.arbitrated`), so the log does not copy it on every move.
 */
export function activityExplain(explain: Explain): Explain {
  const { children: _children, ...top } = explain;
  return normalizeExplain({
    ...top,
    terms: explain.terms.map((t) => ({ ...t })),
    ...(explain.dc ? { dc: { total: explain.dc.total, terms: explain.dc.terms.map((t) => ({ ...t })) } } : {}),
  });
}
