/**
 * The Explain sheet (11 §1.5 rung 4): inputs, named terms, roll, DC, outcome, in a ledger
 * layout, set in the mono "machine" voice (11 §7.2). Gated by `knowledge`: the core already
 * withheld what the viewer may not see; this only renders.
 */
import type { Explain, ExplainTerm } from '@coulee/core';
import { type ReactNode, useId, useState } from 'react';
import { num, signed, title } from '../lib/format.ts';

const KNOWLEDGE_WORD: Record<string, string> = {
  public: 'anyone present could know this',
  participants: 'known to those involved',
  self: 'known only to this mind',
  omniscient: 'hidden truth (epilogue / god view)',
};

/** Sources that are units rather than causes: the value already says what they are. */
const UNIT_SOURCES = new Set(['days', 'pct', 'permille']);

/** Tenths of a day as "6.0 d". */
export function dayTenths(v: number): string {
  return `${v < 0 ? '−' : ''}${(Math.abs(v) / 10).toFixed(1)} d`;
}

/** A term in its own unit: rate multipliers as ×%, per mille as ‰, day tenths as days. */
function termValue(t: ExplainTerm): string {
  switch (t.source) {
    case 'pct':
      return `×${t.value}%`;
    case 'permille':
      return `${t.value}‰`;
    case 'days':
      return t.value < 0 ? dayTenths(t.value) : `+${dayTenths(t.value)}`;
    default:
      return Math.abs(t.value) >= 1000 ? `${t.value < 0 ? '−' : '+'}${num(Math.abs(t.value))}` : signed(t.value);
  }
}

export function ExplainView(props: { explain: Explain; depth?: number; totalUnit?: 'days' }) {
  const e = props.explain;
  const depth = props.depth ?? 0;
  const total = props.totalUnit === 'days' ? dayTenths(e.total) : num(e.total);
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
            {t.label}
            {UNIT_SOURCES.has(t.source) ? null : <span className="xsrc"> {t.source}</span>}
          </span>
          <span className="xval">{termValue(t)}</span>
        </div>
      ))}
      <div className="xrow total">
        <span>Total</span>
        <span className="xval">{total}</span>
      </div>
      {e.dc ? (
        <div className="xrow">
          <span>vs DC {e.dc.terms.map((t) => `${t.label} ${signed(t.value)}`).join(', ')}</span>
          <span>{e.dc.total}</span>
        </div>
      ) : null}
      <div className={`xoutcome ${/fail|reject|short|cannot/.test(e.outcome) ? 'bad' : ''}`}>
        {/fail|reject|short|cannot/.test(e.outcome) ? '✗' : '✓'} {title(e.outcome)}
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

/**
 * A ledger row whose figure climbs the legibility ladder (11 §1.5): tap the row and its Explain
 * opens beneath it. The whole row is the target (≥ 44 px), so it works one-thumbed.
 */
export function ExplainRow(props: {
  k: ReactNode;
  v: ReactNode;
  explain: Explain | null | undefined;
  totalUnit?: 'days';
  warn?: boolean;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!props.explain)
    return (
      <div className={`row ${props.warn ? 'warn' : ''}`}>
        <span className="k">{props.k}</span>
        <span className="lead" />
        <span className="v">{props.v}</span>
      </div>
    );
  return (
    <div className={`xrow-wrap ${open ? 'open' : ''}`} data-testid={props.testId}>
      <button
        type="button"
        className={`row row-btn ${props.warn ? 'warn' : ''}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="k">{props.k}</span>
        <span className="lead" />
        <span className="v">{props.v}</span>
        <span className="why" aria-hidden="true">
          {open ? '▾' : 'ⓘ'}
        </span>
        <span className="visually-hidden">{open ? 'Hide the math' : 'Show the math'}</span>
      </button>
      {open ? (
        <div id={id} className="explain-pop">
          <ExplainView explain={props.explain} {...(props.totalUnit ? { totalUnit: props.totalUnit } : {})} />
        </div>
      ) : null}
    </div>
  );
}
