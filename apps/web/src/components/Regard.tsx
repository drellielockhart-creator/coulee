import type { social } from '@coulee/core';
import { ExplainRow } from './ExplainView.tsx';

/** Shared inspect impression from the worker; the UI makes no perception rolls. */
export function Regard({ regard }: { regard: social.RegardView | undefined }) {
  if (!regard) return null;
  return (
    <div className="opinion" data-testid="regard">
      <ExplainRow k="Seems to feel about you" v={`${regard.band} — ${regard.phrase}`} explain={regard.explain} />
      {regard.reasons.length > 0 ? (
        <ul className="reasons">
          {regard.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      {regard.truth ? (
        <p className="hint">
          True regard: affection {regard.truth.opinion.affection}, respect {regard.truth.opinion.respect}, trust{' '}
          {regard.truth.opinion.trust}, fear {regard.truth.opinion.fear}.
        </p>
      ) : null}
    </div>
  );
}
