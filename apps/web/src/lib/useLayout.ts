/**
 * Layout by viewport, input by pointer (11 §1.1). OWNER: module:web.
 * Pocket: narrow (< 600 px), or a coarse pointer below Desk width (phones in landscape, small
 * tablets). Desk: everything else. Rotating a phone switches live without losing state.
 */
import { useEffect, useState } from 'react';

export type Layout = 'pocket' | 'desk';

const POCKET_QUERY = '(max-width: 599px), (pointer: coarse) and (max-width: 1023px)';

function current(): Layout {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desk';
  return window.matchMedia(POCKET_QUERY).matches ? 'pocket' : 'desk';
}

export function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(current);
  useEffect(() => {
    const mq = window.matchMedia(POCKET_QUERY);
    const on = () => setLayout(current());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return layout;
}
