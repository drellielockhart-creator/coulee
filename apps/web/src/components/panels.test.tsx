import type { ActorView, provisions, ViewModel } from '@coulee/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { Chronicle, Dossier, People } from '../App.tsx';
import { useUi } from '../state/ui.ts';
import type { SimHandle } from '../useSim.ts';
import { Book } from './Book.tsx';
import { SimCtx } from './ctx.ts';
import { KnownTab } from './dossier/KnownTab.tsx';
import { MindTab } from './dossier/MindTab.tsx';
import { NeedsTab } from './dossier/NeedsTab.tsx';
import { OpinionsTab } from './dossier/OpinionsTab.tsx';
import { KitSheet, ReadinessLedger } from './KitSheet.tsx';
import { detentAfterDrag } from './Sheet.tsx';

const readiness: provisions.Readiness = {
  kcalOnHand: 0,
  kcalPerDay: 0,
  daysOfFoodTenths: 0,
  daysOfFuelTenths: null,
  spoilsFirst: null,
  unpreparable: [],
  warnings: [],
};
const actor: ActorView = {
  id: 1 as never,
  key: 'test',
  name: 'Ada North',
  shortName: 'Ada',
  sex: 'female',
  age: 28,
  people: 'Human',
  occupation: 'Traveler',
  householdId: 1 as never,
  placeId: 1 as never,
  isPlayer: true,
  alive: true,
  traits: [],
  conditions: [],
  needs: { list: [] },
  activity: {
    activityId: null,
    name: 'Idle',
    verb: 'idling',
    placeId: 1 as never,
    since: 0,
    source: 'init',
    travelingTo: null,
    arriveAt: null,
  },
  psyche: {
    visible: true,
    ego: 0,
    superego: 0,
    idAppetite: 0,
    anxiety: 0,
    thoughts: [],
    chosen: null,
    recentDefenses: [],
    persona: null,
    shadow: [],
  },
  social: { opinions: [], memories: [], relationships: [] },
  belief: { beliefs: [], grudges: [] },
  items: { carried: [], totalWeightG: 0, totalBulkTenths: 0, loadBand: 'Unburdened' },
  provisions: {
    purseCents: 0,
    readiness,
    nutrition: { kcalToday: 0, kcalAvg: 0, proteinAvgG: 0, freshAvg: 0, scurvy: 0, monotony: 0, lastMealAt: null },
  },
};
const vm = {
  playerId: actor.id,
  actors: [actor],
  places: [],
  households: [],
  time: { t: 0 },
  chronicle: { recent: [] },
} as unknown as ViewModel;
const sim = {
  vm,
  items: {},
  actions: { activities: [], interactions: [] },
  query: async () => ({ kind: 'readiness', readiness }),
} as unknown as SimHandle;
const render = (node: React.ReactNode, snapshot = vm) =>
  renderToStaticMarkup(<SimCtx.Provider value={{ ...sim, vm: snapshot }}>{node}</SimCtx.Provider>);

afterEach(() => useUi.setState({ dossierTab: 'mind', selectedActor: null, panel: 'none', godViewLog: [] }));

describe('empty module snapshots', () => {
  it('renders all dossier tabs without data or catalog entries', () => {
    expect(render(<MindTab actor={actor} />)).toContain('No thoughts are pressing');
    expect(render(<NeedsTab actor={actor} />)).toContain('No needs defined');
    expect(render(<OpinionsTab actor={actor} />)).toContain('No settled opinions');
    expect(render(<KnownTab actor={actor} />)).toContain('Nothing yet stands out');
    expect(render(<KitSheet actor={actor} />)).toContain('Nothing recorded');
    for (const dossierTab of ['mind', 'needs', 'opinions', 'known', 'pack'] as const) {
      useUi.setState({ dossierTab });
      expect(render(<Dossier actor={actor} />)).toContain('data-testid="dossier"');
    }
  });
  it('renders empty population, chronicle and core readiness without NaN or missing controls', () => {
    expect(render(<People />, { ...vm, actors: [] })).toContain('No people recorded');
    expect(render(<Chronicle />)).toContain('The ledger is quiet');
    const html = render(<ReadinessLedger readiness={readiness} />);
    expect(html).toContain('0.0 days');
    expect(html).toContain('None forecast');
    expect(html).not.toMatch(/NaN|undefined/);
  });
  it('does not render inner thoughts when the perspective hides the mind', () => {
    const hidden = {
      ...actor,
      psyche: {
        ...actor.psyche,
        visible: false,
        thoughts: [{ id: 1, voice: 'id', label: 'SECRET', intensity: 800, urge: 'eat', ageMinutes: 0 }],
      },
    };
    const html = render(<MindTab actor={hidden} />);
    expect(html).toContain('Read People');
    expect(html).not.toContain('SECRET');
  });
  it('renders the core spoil-first forecast and warnings verbatim', () => {
    const r = {
      ...readiness,
      daysOfFoodTenths: 37,
      spoilsFirst: { defId: 'trout', name: 'Trout', inDaysTenths: 4 },
      warnings: ['No fresh food'],
      unpreparable: [{ defId: 'beans', name: 'Beans', missing: ['kettle'] }],
    };
    const html = render(<ReadinessLedger readiness={r} />);
    expect(html).toContain('3.7 days');
    expect(html).toContain('Trout · 0.4 days');
    expect(html).toContain('No fresh food');
    expect(html).toContain('Beans: missing kettle');
  });
});

const store = {
  id: 5,
  name: 'Pratt & Daughter',
  kind: 'building',
  tags: ['store'],
  activity: { occupantIds: [] },
  provisions: {
    open: true,
    stock: [
      { itemId: 1, defId: 'haversack', name: 'Haversack', qty: 1, priceCents: 75 },
      { itemId: 2, defId: 'haversack', name: 'Haversack', qty: 1, priceCents: 75 },
      { itemId: 3, defId: 'flour', name: 'Flour', qty: 4, priceCents: 5 },
    ],
  },
};
const items = {
  haversack: { section: 'packs_bedding', unit: 'each', weight_g: 454, copy: 'Slung at the hip.' },
  flour: { section: 'provisions', unit: 'lb', weight_g: 454, copy: '' },
};
const withStore = { ...vm, places: [store] } as unknown as ViewModel;
const renderStore = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <SimCtx.Provider value={{ ...sim, vm: withStore, items } as unknown as SimHandle}>{node}</SimCtx.Provider>,
  );

describe('review fixes (pocket UX)', () => {
  it('keeps the Book out of the Kit Sheet: one link, no buy buttons', () => {
    const html = renderStore(<KitSheet actor={actor} />);
    expect(html).not.toContain('Buy one');
    expect(html).toContain('Pratt &amp; Daughter: the Book');
  });
  it('pages the Book by section, one line per item, credit behind a second tap', () => {
    const html = renderStore(<Book placeId={5} />);
    expect(html).toContain('Packs &amp; Bedding');
    expect(html.match(/Haversack/g)?.length).toBe(1);
    expect(html).toContain('2 in stock');
    expect(html).not.toContain('Flour');
    expect(html).toContain('On credit…');
    expect(html).toContain('1 lb');
  });
  it('puts band words beside psyche numbers and opinion values, and reads ties label-first', () => {
    const mind = render(<MindTab actor={{ ...actor, psyche: { ...actor.psyche, ego: 45, anxiety: 69 } }} />);
    expect(mind).toContain('steady');
    expect(mind).toContain('calm');
    expect(mind).not.toMatch(/title="/);
    const ties = render(
      <OpinionsTab
        actor={{
          ...actor,
          social: {
            ...actor.social,
            relationships: [{ otherId: 2 as never, otherName: 'Augusta Pratt', label: 'child of' }],
            opinions: [
              {
                targetId: 2 as never,
                targetName: 'Augusta Pratt',
                label: null,
                affection: 30,
                respect: 0,
                trust: 0,
                fear: 0,
                reasons: [],
              },
            ] as never,
          },
        }}
      />,
    );
    expect(ties.indexOf('child of')).toBeLessThan(ties.indexOf('Augusta Pratt'));
    expect(ties).toContain('Warm');
    expect(ties).toContain('Neutral');
  });
  it('dossier tabs use short labels on one row, and the dossier no longer buries the orders', () => {
    const html = render(<Dossier actor={actor} />);
    for (const t of ['Mind', 'Body', 'Ties', 'Known', 'Pack']) expect(html).toContain(`>${t}<`);
    expect(html).not.toContain('Give an order');
  });
  it('People has a find field instead of the God view toggle (God view lives in Settings)', () => {
    const people = render(<People />);
    expect(people).toContain('type="search"');
    expect(people).not.toContain('God view');
    // The confirm + Chronicle tag flow is driven in scripts/screens.ts (store state is client-only).
  });
  it('sheet drags step one detent at a time; a small wobble does nothing', () => {
    expect(detentAfterDrag('peek', -60)).toBe('half');
    expect(detentAfterDrag('half', -60)).toBe('full');
    expect(detentAfterDrag('full', 80)).toBe('half');
    expect(detentAfterDrag('peek', 80)).toBe('closed');
    expect(detentAfterDrag('half', 10)).toBe('half');
  });
});
