import { loadContentOrThrow } from '@coulee/content';
import { PlaySession, type RoutePreview } from '@coulee/play';
import type { ReactElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { RouteCard } from './RouteCard.tsx';

// Exercise the real button handlers without a browser; preserve state between explicit renders.
const hook = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (initial: unknown) => [
    hook.value ?? initial,
    (value: unknown) => {
      hook.value = value;
    },
  ],
}));
afterEach(() => {
  hook.value = null;
});
function primary(tree: ReactElement): ReactElement<{ onClick: () => void; className?: string }> {
  const element = tree as ReactElement<{ children?: unknown; className?: string; onClick: () => void }>;
  if (element.props.className === 'route-action primary') return element;
  const children = [element.props.children]
    .flat(2)
    .filter((child) => child && typeof child === 'object' && 'props' in child);
  for (const child of children) {
    try {
      return primary(child as ReactElement);
    } catch {
      /* Search the next sibling. */
    }
  }
  throw new Error('No primary route button');
}
it('critical travel needs two clicks on the same preview; ordinary Go does not preconfirm a changed forecast', () => {
  const session = PlaySession.create(loadContentOrThrow(['base']), { source: 'iron_ford_neighbors', seed: 42 });
  const preview = session.act('route:cedar_farm').routePreview;
  if (!preview) throw new Error('No preview');
  const critical: RoutePreview = {
    ...preview,
    forecast: { ...preview.forecast, warnings: ['Critical vitals along the route'] },
  };
  const onGo = vi.fn();
  const draw = (route: RoutePreview) =>
    primary(RouteCard({ route, busy: false, canGo: true, onGo, onCancel: () => {} }));
  draw(critical).props.onClick();
  expect(onGo).not.toHaveBeenCalled();
  draw(critical).props.onClick();
  expect(onGo).toHaveBeenLastCalledWith(true);
  onGo.mockClear();
  const revised = { ...critical, at: critical.at + 60 };
  draw(revised).props.onClick();
  expect(onGo).not.toHaveBeenCalled();
  draw(revised).props.onClick();
  expect(onGo).toHaveBeenLastCalledWith(true);
  draw({ ...preview, forecast: { ...preview.forecast, warnings: [] } }).props.onClick();
  expect(onGo).toHaveBeenLastCalledWith(false);
});
