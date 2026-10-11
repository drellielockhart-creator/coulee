/**
 * The Explain sheet (11 §1.5 rung 4): inputs, named terms, roll, DC, outcome, in a ledger
 * layout, set in the mono "machine" voice (11 §7.2). Gated by `knowledge`: the core already
 * withheld what the viewer may not see; this only renders.
 */
import type { Explain } from '@coulee/core';
import { signed, title } from '../lib/format.ts';

const KNOWLEDGE_WORD: Record<string, string> = {
  public: 'anyone present could know this',
  participants: 'known to those involved',
  self: 'known only to this mind',
  omniscient: 'hidden truth (epilogue / god view)',
};

export function ExplainView(props: { explain: Explain; depth?: number }) {
  const e = props.explain;
  const depth = props.depth ?? 0;
  return (
    <div className={`explain depth-${Math.min(depth, 2)}`}>
      <div className="explain-head">
        <span>{e.label}</span>
        <span className="explain-kind">{title(e.kind)}</span>
      </div>
      {e.roll ? (
        <div className="xrow">
          <span>d{e.roll.die}</span>
          <span>{e.roll.natural}</span>
        </div>
      ) : null}
      {e.terms.map((t, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: terms are an ordered, static list
        <div className="xrow" key={i}>
          <span>
            {t.label} <span className="xsrc">{t.source}</span>
          </span>
          <span>{signed(t.value)}</span>
        </div>
      ))}
      <div className="xrow total">
        <span>Total</span>
        <span>{e.total}</span>
      </div>
      {e.dc ? (
        <div className="xrow">
          <span>vs DC {e.dc.terms.map((t) => `${t.label} ${signed(t.value)}`).join(', ')}</span>
          <span>{e.dc.total}</span>
        </div>
      ) : null}
      <div className={`xoutcome ${/fail|reject/.test(e.outcome) ? 'bad' : ''}`}>
        {/fail|reject/.test(e.outcome) ? '✗' : '✓'} {title(e.outcome)}
        {e.margin !== undefined ? ` by ${Math.abs(e.margin)}` : ''}
      </div>
      {e.note ? <p className="xnote">{e.note}</p> : null}
      {e.children && e.children.length > 0 && depth < 3 ? (
        <details className="xchildren">
          <summary>{e.children.length} considered</summary>
          {e.children.map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: candidates are an ordered, static list
            <ExplainView key={i} explain={c} depth={depth + 1} />
          ))}
        </details>
      ) : null}
      {depth === 0 ? <p className="xknow">⚿ {KNOWLEDGE_WORD[e.knowledge] ?? e.knowledge}</p> : null}
    </div>
  );
}
