import { loadContentOrThrow } from '@coulee/content';
import { asGameMinute } from '@coulee/core';
import { PlaySession, routePreviewOf, sessionSimOf } from '@coulee/play';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { groupOf } from '../lib/play.ts';
import type { ActOutcome, PlayState } from '../protocol.ts';
import { useUi } from '../state/ui.ts';
import type { SimHandle } from '../useSim.ts';
import { SimCtx } from './ctx.ts';
import { PlayPanel } from './PlayPanel.tsx';
import { RouteCard, routeDistance, routeDuration } from './RouteCard.tsx';

// Static renders do not subscribe; read the current selection instead of Zustand's SSR snapshot.
vi.mock('../state/ui.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../state/ui.ts')>();
  return { ...actual, useUi: Object.assign(() => actual.useUi.getState(), actual.useUi) };
});

const content = loadContentOrThrow(['base']);
function preview() {
  const session = PlaySession.create(content, { source: 'iron_ford_neighbors', seed: 42 });
  const before = session.hash;
  const result = session.act('route:cedar_farm');
  if (!result.routePreview) throw new Error('No structured route preview');
  return { session, result, route: result.routePreview, before };
}

afterEach(() => {
  vi.restoreAllMocks();
  useUi.setState({ routePreview: null, actGroup: null });
});

describe('route preview views', () => {
  it('projects known, directed legs and supply checks without changing the world or legacy detail', () => {
    const { session, route, result, before } = preview();
    expect(session.hash).toBe(before);
    expect(result.elapsedMinutes).toBe(0);
    expect(route.forecast).toEqual(result.detail);
    expect(route.legs).toEqual([
      { edgeId: 'cedar_road', name: 'Cedar Ridge Road', from: 'Iron Ford', to: 'Cedar Farm', distanceFt: 60000 },
    ]);
    expect(route.distanceFt).toBe(60000);
    expect(route.arrival).toBe('1855-04-01 06:00');
    expect(route.checks.map((c) => c.id)).toEqual(['food', 'water', 'warmth', 'load', 'light']);
    expect(route.checks.find((c) => c.id === 'water')?.status).toBe('ok');
    expect(route.checks.find((c) => c.id === 'light')?.status).toBe('watch');
    expect(route.weather).toEqual({ temperatureF: 55, raining: false });
    for (const action of session.observe().actions.filter((a) => /^(route:|travel:)/.test(a.id)))
      expect(groupOf(action, { activities: [], interactions: [] })).toBe('move');
  });

  it('handles midnight, reversed legs and partial forecasts without certifying unprojected supplies', () => {
    const { session, route } = preview();
    const sim = sessionSimOf(session);
    sim.world.time = asGameMinute(1380);
    const farm = sim.world.region?.sites.cedar_farm;
    const actor = sim.world.actors[session.playerId];
    if (!farm || !actor) throw new Error('Missing fixture');
    actor.placeId = farm.entranceId;
    const forecast = {
      ...route.forecast,
      destination: 'Iron Ford',
      elapsedMinutes: 120,
      arrivalTime: 1500,
      arrived: false,
      waterLeftMl: 0,
      needs: { ...route.forecast.needs, hunger: 50, thirst: 100, warmth: 1000 },
    };
    const back = routePreviewOf(sim, session.playerId, 'iron_ford', ['cedar_road'], forecast);
    expect(back.arrival).toBe('1855-04-02 01:00');
    expect(back.legs[0]).toMatchObject({ from: 'Cedar Farm', to: 'Iron Ford' });
    expect(back.checks.find((c) => c.id === 'food')?.status).toBe('short');
    expect(back.checks.find((c) => c.id === 'water')?.status).toBe('short');
    expect(back.checks.find((c) => c.id === 'warmth')?.status).toBe('unknown');
    const html = renderToStaticMarkup(
      <RouteCard route={back} busy={false} canGo={false} onGo={() => {}} onCancel={() => {}} />,
    );
    expect(html).toContain('Decision required');
    expect(html).toContain('Arrival if the stop is resolved');
    expect(html).toContain('! Short');
    expect(html).toContain('? Unconfirmed');
    expect(html).toMatch(/disabled=""[^>]*>Go to Iron Ford/);
    expect(html).not.toContain('OK in this projection');
  });

  it('renders the card once in both Act views, hides the raw reading, and expires or cancels it', () => {
    const { route, result } = preview();
    const last: ActOutcome = { ...result, label: 'Route to Cedar Farm', t: 0, text: 'RAW ROUTE READING' };
    const play: PlayState = {
      observation: result.observation,
      last,
      mode: 'fair',
      money: [],
      steps: 1,
      digest: {
        from: 0,
        to: 0,
        elapsed: 0,
        money: [],
        needs: [],
        events: [],
        said: [],
        stops: [],
        skipped: 0,
      },
    };
    const sim = { play, actions: { activities: [], interactions: [] }, busy: false } as unknown as SimHandle;
    const render = () =>
      renderToStaticMarkup(
        <SimCtx.Provider value={sim}>
          <PlayPanel />
        </SimCtx.Provider>,
      );
    useUi.getState().showRoute('cedar_farm', last.text ?? '', 0, route);
    for (const actGroup of [null, 'move'] as const) {
      useUi.setState({ actGroup });
      const html = render();
      expect(html.match(/data-testid="route-preview"/g)).toHaveLength(1);
      expect(html).not.toContain('RAW ROUTE READING');
      expect(html).toContain('Go to Cedar Farm');
      expect(html).not.toContain('Depart for Cedar Farm');
      expect(html).toContain('11.4 mi');
      expect(html).toContain('1855-04-01 06:00');
      expect(html).not.toMatch(/<pre|NaN|undefined/);
    }
    useUi.getState().clearRoute();
    expect(render()).not.toContain('data-testid="route-preview"');
    useUi.getState().showRoute('cedar_farm', '', -60, route);
    expect(render()).not.toContain('data-testid="route-preview"');
    expect(routeDuration(95)).toBe('1 h 35 min');
    expect(routeDuration(0)).toBe('0 min');
    expect(routeDistance(5280)).toContain('1.0 mi');
  });
});
