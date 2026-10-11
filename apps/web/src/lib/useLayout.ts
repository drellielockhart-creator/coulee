/**
 * Layout by viewport, input by pointer (11 §1.1). OWNER: module:web.
 * - Pocket: narrow (< 600 px): map, bottom rail, bottom sheets.
 * - Folio: 600–1023 px, or any viewport under 500 px tall (a phone in landscape): map plus one
 *   docked side panel; sheets become side drawers (11 §3.4, §4.2: no forced rotation).
 * - Desk: everything else.
 * Rotating a phone switches live without losing state (UI state lives in the store).
 */
import { useEffect, useState } from 'react';

export type Layout = 'pocket' | 'folio' | 'desk';

export const POCKET_QUERY = '(max-width: 599px)';
export const FOLIO_QUERY = '(min-width: 600px) and (max-width: 1023px), (min-width: 600px) and (max-height: 499px)';

/** Pure: which layout a viewport gets (the media queries above, as numbers, for tests). */
export function layoutFor(width: number, height: number): Layout {
  if (width < 600) return 'pocket';
  if (width < 1024 || height < 500) return 'folio';
  return 'desk';
}

function current(): Layout {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desk';
  if (window.matchMedia(POCKET_QUERY).matches) return 'pocket';
  return window.matchMedia(FOLIO_QUERY).matches ? 'folio' : 'desk';
}

export function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(current);
  useEffect(() => {
    const queries = [window.matchMedia(POCKET_QUERY), window.matchMedia(FOLIO_QUERY)];
    const on = () => setLayout(current());
    for (const mq of queries) mq.addEventListener('change', on);
    return () => {
      for (const mq of queries) mq.removeEventListener('change', on);
    };
  }, []);
  return layout;
}
