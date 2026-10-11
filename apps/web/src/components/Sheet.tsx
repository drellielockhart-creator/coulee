/**
 * Pocket bottom sheet with three detents (11 §2.3): peek, half (≈ 50% of the map), full.
 * OWNER: module:web.
 *
 * One 48 px header row holds the grabber, the title and the icon controls; an optional sub-line
 * carries the summary. Drag the header up or down to change detent; tap the grabber to step it.
 * On Full the controls also sit at the bottom, in thumb reach (11 §1.2: the top is for glancing).
 */
import { type ReactNode, useEffect, useRef } from 'react';
import type { SheetState } from '../lib/timePolicy.ts';
import { useUi } from '../state/ui.ts';

const UP: Record<SheetState, SheetState> = { closed: 'peek', peek: 'half', half: 'full', full: 'full' };
const DOWN: Record<SheetState, SheetState> = { closed: 'closed', peek: 'closed', half: 'peek', full: 'half' };

/** Next detent for a vertical drag of `dy` CSS px (negative = up). Pure, for tests. */
export function detentAfterDrag(from: SheetState, dy: number): SheetState {
  if (dy <= -28) return UP[from];
  if (dy >= 28) return DOWN[from];
  return from;
}

export function Sheet({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  const ui = useUi();
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; id: number; grabber: boolean } | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, []);
  const full = ui.sheet === 'full';
  return (
    <section
      ref={ref}
      tabIndex={-1}
      className={`paper sheet sheet-${ui.sheet}`}
      role="dialog"
      aria-label={title}
      data-testid="sheet"
      data-detent={ui.sheet}
      onKeyDown={(e) => {
        if (e.key === 'Escape') ui.close();
      }}
    >
      <header
        className="sheet-head"
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button:not(.grabber)')) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = { y: e.clientY, id: e.pointerId, grabber: target.closest('.grabber') !== null };
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.id !== e.pointerId) return;
          let next = detentAfterDrag(ui.sheet, e.clientY - d.y);
          // A tap (no drag) on the grabber steps the detent.
          if (next === ui.sheet && d.grabber) next = full ? 'half' : UP[ui.sheet];
          if (next === 'closed') ui.close();
          else if (next !== ui.sheet) ui.setSheet(next);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div className="sheet-row">
          <button
            type="button"
            className="grabber"
            aria-label={`Sheet: ${ui.sheet}. Tap to ${full ? 'lower' : 'raise'} it; drag to resize`}
            onClick={(e) => {
              // Pointer taps are handled on pointerup above; this is keyboard activation.
              if (e.detail === 0) ui.setSheet(full ? 'half' : UP[ui.sheet]);
            }}
          >
            <span className="grabber-bar" aria-hidden="true" />
          </button>
          <h2>{title}</h2>
          <button
            type="button"
            className="icon"
            aria-label={full ? 'Lower sheet to half' : 'Expand sheet'}
            onClick={() => ui.setSheet(full ? 'half' : UP[ui.sheet])}
          >
            {full ? '▾' : '▴'}
          </button>
          <button type="button" className="icon" aria-label="Close sheet" onClick={() => ui.close()}>
            ✕
          </button>
        </div>
        {subtitle ? <div className="sheet-sub">{subtitle}</div> : null}
      </header>
      <div className="sheet-body">{children}</div>
      {full ? (
        <footer className="sheet-foot">
          <button type="button" onClick={() => ui.setSheet('half')}>
            ▾ Half
          </button>
          <button type="button" aria-pressed={ui.pinned} onClick={() => ui.setPinned(!ui.pinned)}>
            {ui.pinned ? '▶ Keeps running' : 'Keep running'}
          </button>
          <button type="button" onClick={() => ui.close()}>
            Close
          </button>
        </footer>
      ) : null}
    </section>
  );
}

/** Folio side drawer (11 §3.4): the same panels, docked beside the map instead of over it. */
export function Drawer({ title, children }: { title: string; children: ReactNode }) {
  const ui = useUi();
  return (
    <section
      className="paper drawer"
      role="dialog"
      aria-label={title}
      data-testid="sheet"
      data-detent="side"
      onKeyDown={(e) => {
        if (e.key === 'Escape') ui.close();
      }}
    >
      <header className="sheet-head">
        <div className="sheet-row">
          <h2>{title}</h2>
          <button type="button" className="icon" aria-label="Close panel" onClick={() => ui.close()}>
            ✕
          </button>
        </div>
      </header>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
