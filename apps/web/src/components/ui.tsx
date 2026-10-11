/** Small shared components: bars, tabs, ledger rows, empty states. OWNER: module:web. */
import type { ReactNode } from 'react';

/**
 * A band bar. Fill is redundant with the text next to it (11 §1.4: never color alone).
 * `value` is on [min, max]; `bad` adds the rubric treatment + a glyph.
 */
export function Bar(props: {
  value: number;
  min?: number;
  max?: number;
  bad?: boolean;
  label?: string;
  diverging?: boolean;
  className?: string;
}) {
  const min = props.min ?? 0;
  const max = props.max ?? 1000;
  const v = Math.max(min, Math.min(max, props.value));
  if (props.diverging) {
    const half = (max - min) / 2;
    const mid = min + half;
    const pct = (Math.abs(v - mid) / half) * 50;
    const left = v < mid ? 50 - pct : 50;
    return (
      <span className={`bar diverging ${props.className ?? ''}`} role="img" aria-label={props.label ?? String(v)}>
        <span className="bar-mid" />
        <span className={`bar-fill ${v < mid ? 'neg' : 'pos'}`} style={{ left: `${left}%`, width: `${pct}%` }} />
      </span>
    );
  }
  const pct = ((v - min) / (max - min)) * 100;
  return (
    <span
      className={`bar ${props.bad ? 'bad' : ''} ${props.className ?? ''}`}
      role="img"
      aria-label={props.label ?? String(v)}
    >
      <span className="bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function Tabs<T extends string>(props: {
  tabs: ReadonlyArray<{ id: T; label: string; badge?: string }>;
  value: T;
  onChange: (t: T) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={props.label}>
      {props.tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={props.value === t.id}
          className={props.value === t.id ? 'tab on' : 'tab'}
          onClick={() => props.onChange(t.id)}
        >
          {t.label}
          {t.badge ? <span className="badge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Hatched, gated information: always says why (11 §1.5), never just hides. */
export function Gated(props: { children: ReactNode }) {
  return <div className="gated">{props.children}</div>;
}

export function Empty(props: { children: ReactNode }) {
  return <p className="empty">{props.children}</p>;
}

export function SectionHead(props: { children: ReactNode; aside?: ReactNode }) {
  return (
    <h3 className="section-head">
      <span>{props.children}</span>
      {props.aside ? <span className="aside">{props.aside}</span> : null}
    </h3>
  );
}

/** Ledger row: label left, figures right, dotted leader between. */
export function Row(props: { k: ReactNode; v: ReactNode; warn?: boolean; title?: string }) {
  return (
    <div className={`row ${props.warn ? 'warn' : ''}`} title={props.title}>
      <span className="k">{props.k}</span>
      <span className="lead" />
      <span className="v">{props.v}</span>
    </div>
  );
}
