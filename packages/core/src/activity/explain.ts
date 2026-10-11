import type { Explain, ExplainTerm } from '../explain.ts';

/** Preserve the chosen explanation without inheriting negative-zero values from another module. */
export function activityExplain(explain: Explain): Explain {
  const terms = (list: ExplainTerm[]) => list.map((t) => ({ ...t, value: t.value === 0 ? 0 : t.value }));
  return {
    ...explain,
    total: explain.total === 0 ? 0 : explain.total,
    terms: terms(explain.terms),
    ...(explain.margin !== undefined ? { margin: explain.margin === 0 ? 0 : explain.margin } : {}),
    ...(explain.dc
      ? { dc: { total: explain.dc.total === 0 ? 0 : explain.dc.total, terms: terms(explain.dc.terms) } }
      : {}),
    ...(explain.children ? { children: explain.children.map(activityExplain) } : {}),
  };
}
